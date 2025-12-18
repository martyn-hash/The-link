# Staff Performance League Table - Implementation Specification

## Purpose

Generate a league table measuring how effectively project assignees keep projects on schedule, normalised for workload, using a 0–100 score where higher is better.

---

## 1. Core Definitions

### 1.1 "Behind Schedule" Definition
A project is considered **behind schedule** when it exceeds the `maxInstanceTime` (in hours) defined for its current stage in `kanbanStages`.

- `maxInstanceTime`: Maximum hours allowed per single visit to a stage
- If `maxInstanceTime` is `NULL` for a stage, that stage has no time limit and cannot trigger lateness

### 1.2 Late Event
A **late event** occurs when a project transitions from "on schedule" to "behind schedule" for a specific stage visit.

Rules:
- Each distinct period of lateness counts as a separate event
- If a project re-enters a stage and goes late again, this is a NEW late event
- A late event is attributed to the `assigneeId` recorded at the moment lateness began

### 1.3 Late Days (Business Days)
**Late days** are the total number of **business days** a project remains behind schedule within the selected date range.

Business Day Calculation:
- Use company settings: `workingDays` array (default: [1, 2, 3, 4, 5] = Mon-Fri)
- Exclude weekends and any non-working days defined in settings

### 1.4 Attribution Rule
Projects are attributed to the assignee responsible **at the time the lateness occurs**, not the current assignee.

This requires:
1. Calculating when lateness began for each stage visit
2. Looking up the `assigneeId` from `projectChronology` at that point in time

---

## 2. Data Sources

### 2.1 Primary Tables

| Table | Purpose |
|-------|---------|
| `projects` | Project list with current state |
| `projectChronology` | Stage transitions, assignees, timestamps |
| `kanbanStages` | Stage definitions including `maxInstanceTime` |
| `projectTypes` | Links projects to services |
| `services` | Service names for filtering |
| `users` | Assignee names |
| `companySettings` | Business hours/days configuration |

### 2.2 Key Relationships

```
projects
  → projectChronology (one-to-many)
    → assigneeId → users
  → projectTypes
    → services (for filtering by service)
  → kanbanStages (via currentStatus matching stage name)
```

---

## 3. Filtering Parameters

The league table supports the following filters:

| Filter | Type | Required | Example |
|--------|------|----------|---------|
| Service | Dropdown | Yes | "Bookkeeping" |
| Date Range Start | Date | Yes | 2024-11-01 |
| Date Range End | Date | Yes | 2024-11-30 |
| Minimum Projects | Number | No (default: 5) | 5 |

---

## 4. Metrics Per Assignee

### 4.1 Primary Metrics

| Metric | Description | Calculation |
|--------|-------------|-------------|
| **Project Count** | Number of distinct projects assigned to user during period | Count unique `projectId` where user was assignee at any point in date range |
| **Project Days** | Total exposure time (business days × projects) | Sum of business days each project was assigned to user within period |
| **Late Events** | Count of times projects became behind schedule | Count distinct lateness onset events attributed to user |
| **Total Late Days** | Business days projects spent late | Sum of business days while projects were behind schedule |

### 4.2 Normalised Rates

```
Late Incidence Rate (LIR) = late_events / project_count
Late Duration Rate (LDR) = total_late_days / project_count
```

### 4.3 Raw Performance Score

```
raw_score = (0.6 × LIR) + (0.4 × LDR)
```

Rules:
- Do not round intermediate values
- Store `raw_score` as a decimal (float/double)
- Lower `raw_score` = better performance

### 4.4 Performance Score (0–100)

Convert raw scores to a relative performance index:

```
max_raw_score = MAX(raw_score) across all assignees in cohort
performance_score = 100 × (1 − (raw_score / max_raw_score))
```

Constraints:
- Minimum score: 0
- Maximum score: 100
- Round only for display (store full precision)

Edge Cases:
- If `max_raw_score = 0` (everyone perfect): All assignees get 100
- If only one assignee: They get 100 (no peers to compare)

---

## 5. Edge Case Handling

### 5.1 Projects with NULL Assignee
- **Action**: Exclude from all calculations
- **Display**: Optionally show aggregate "Unassigned" row separately

### 5.2 Projects Created Within Date Range
- Include in calculations from their creation date
- Only count business days within the date range

### 5.3 Projects Completed Before Going Late
- These contribute to `project_count` but not to `late_events` or `late_days`
- This is the ideal outcome

### 5.4 Projects Already Late at Date Range Start
- **Include** ongoing lateness in calculations
- Count business days late from date range start (not from when lateness began)
- Late event already occurred before period, so don't count as new event

### 5.5 Projects Without Stage Time Limits
- If `maxInstanceTime = NULL` for all stages a project visits, it cannot be late
- Include in `project_count` (reduces LIR/LDR denominators fairly)

### 5.6 Small Sample Sizes
- Assignees with fewer than `minimum_projects` (default: 5) are flagged
- Still displayed in table but with warning indicator
- Can be filtered out via UI toggle

### 5.7 Projects That Span Multiple Assignees
- Late events attribute to whoever was assigned when lateness began
- Late days split proportionally if assignee changed during late period

---

## 6. Stage-Level Breakdown

For coaching purposes, provide a per-stage analysis showing which stages are causing the most lateness for each assignee.

### 6.1 Stage Metrics Per Assignee

| Metric | Description |
|--------|-------------|
| Stage Name | The kanban stage |
| Late Events in Stage | Count of late events in this stage |
| Late Days in Stage | Business days late in this stage |
| Avg Time to Late | Average hours from stage entry to lateness onset |
| % of Total Lateness | This stage's late days as % of user's total |

### 6.2 Insights
- Identify "problem stages" for each assignee
- Compare against team averages
- Surface patterns (e.g., "Client Approval" stage consistently causing delays)

---

## 7. Trend Scoring

Compare current period performance against the previous equivalent period.

### 7.1 Trend Calculation

```
trend_delta = previous_performance_score - current_performance_score
```

| Delta | Indicator |
|-------|-----------|
| > 5 | Improving ↑ (green) |
| -5 to 5 | Stable → (neutral) |
| < -5 | Declining ↓ (red) |

### 7.2 Previous Period Definition
- If current = Nov 1-30, previous = Oct 1-31
- Match to same service
- Handle edge case: no data for previous period = "New" indicator

---

## 8. Drill-Down Detail View

When a user clicks their position in the league table, show a detailed breakdown:

### 8.1 Summary Panel

| Field | Value |
|-------|-------|
| Rank | 3 of 12 |
| Performance Score | 78 |
| Trend | ↑ Improving (+8 from last period) |
| Projects Handled | 24 |
| Late Events | 6 |
| Total Late Days | 14 |

### 8.2 Stage Breakdown Table

| Stage | Late Events | Late Days | % of Lateness | Team Avg | Status |
|-------|-------------|-----------|---------------|----------|--------|
| Client Approval | 4 | 10 | 71% | 45% | Above Avg |
| Review | 2 | 4 | 29% | 30% | Average |
| Processing | 0 | 0 | 0% | 25% | Below Avg |

### 8.3 Project-Level Detail

Expandable list of projects that experienced lateness:

| Project | Client | Stage | Days Late | Cause |
|---------|--------|-------|-----------|-------|
| Monthly Bookkeeping - Oct | ABC Ltd | Client Approval | 6 | Awaiting documents |
| VAT Return Q3 | XYZ Corp | Review | 4 | Complex reconciliation |

### 8.4 Coaching Insights Panel

Auto-generated advice based on patterns:

```
Based on your performance data:

📊 KEY FINDING: 71% of your late days occurred in "Client Approval" stage.

💡 SUGGESTIONS:
• Consider sending document reminders earlier in the cycle
• Review projects approaching Client Approval stage daily
• Coordinate with Client Manager on high-risk clients

📈 POSITIVE: You had zero late events in "Processing" stage - great work!

🎯 GOAL: Reduce Client Approval lateness by 50% to reach top 5 ranking
```

---

## 9. Output Format

### 9.1 League Table Columns

| Column | Type | Sortable |
|--------|------|----------|
| Rank | Number | Default DESC |
| Assignee Name | String | Yes |
| Service | String | Display only |
| Date Range | String | Display only |
| Project Count | Number | Yes |
| Project Days | Number | Yes |
| Late Events | Number | Yes |
| Late Days | Number | Yes |
| LIR | Decimal (2dp) | Yes |
| LDR | Decimal (2dp) | Yes |
| Performance Score | Number (0-100) | Yes |
| Trend | Indicator | Yes |
| Sample Flag | Boolean | Filter |

### 9.2 Default Sort
- Primary: Performance Score DESC
- Secondary: Late Events ASC (tiebreaker)

---

## 10. API Endpoints

### 10.1 Get League Table

```
GET /api/analytics/performance-league

Query Parameters:
- serviceId: string (required)
- startDate: ISO date (required)  
- endDate: ISO date (required)
- minProjects: number (optional, default: 5)
- includeTrend: boolean (optional, default: true)

Response: PerformanceLeagueResponse
```

### 10.2 Get Assignee Detail

```
GET /api/analytics/performance-league/:assigneeId

Query Parameters:
- serviceId: string (required)
- startDate: ISO date (required)
- endDate: ISO date (required)

Response: AssigneeDetailResponse
```

---

## 11. Database Queries (Pseudocode)

### 11.1 Calculate Late Events

```sql
WITH stage_visits AS (
  SELECT 
    pc.project_id,
    pc.to_status as stage_name,
    pc.assignee_id,
    pc.timestamp as entered_at,
    LEAD(pc.timestamp) OVER (PARTITION BY pc.project_id ORDER BY pc.timestamp) as exited_at,
    ks.max_instance_time
  FROM project_chronology pc
  JOIN projects p ON pc.project_id = p.id
  JOIN project_types pt ON p.project_type_id = pt.id
  JOIN kanban_stages ks ON ks.project_type_id = pt.id AND ks.name = pc.to_status
  WHERE pc.timestamp BETWEEN :start_date AND :end_date
    AND pt.service_id = :service_id
    AND pc.assignee_id IS NOT NULL
),
lateness_events AS (
  SELECT 
    project_id,
    stage_name,
    assignee_id,
    entered_at,
    CASE 
      WHEN max_instance_time IS NOT NULL 
        AND (COALESCE(exited_at, NOW()) - entered_at) > (max_instance_time * INTERVAL '1 hour')
      THEN entered_at + (max_instance_time * INTERVAL '1 hour')
      ELSE NULL
    END as late_at
  FROM stage_visits
)
SELECT 
  assignee_id,
  COUNT(*) as late_events
FROM lateness_events
WHERE late_at IS NOT NULL
  AND late_at BETWEEN :start_date AND :end_date
GROUP BY assignee_id;
```

### 11.2 Calculate Project Count

```sql
SELECT 
  pc.assignee_id,
  COUNT(DISTINCT pc.project_id) as project_count
FROM project_chronology pc
JOIN projects p ON pc.project_id = p.id
JOIN project_types pt ON p.project_type_id = pt.id
WHERE pc.timestamp BETWEEN :start_date AND :end_date
  AND pt.service_id = :service_id
  AND pc.assignee_id IS NOT NULL
GROUP BY pc.assignee_id;
```

---

## 12. UI Components

### 12.1 Filter Bar
- Service dropdown (required)
- Date range picker (required)
- Minimum projects slider (optional)
- Include trend toggle
- Export button (CSV/PDF)

### 12.2 League Table
- Sortable columns
- Clickable rows → detail view
- Color-coded performance scores (green/yellow/red bands)
- Trend indicators with color
- Small sample warning icons

### 12.3 Detail Modal/Page
- Summary metrics panel
- Stage breakdown chart (horizontal bar)
- Project list (expandable)
- Coaching insights panel (AI-generated or rule-based)

---

## 13. Interpretation Notes

For UI tooltips and documentation:

1. Scores are **relative to peers** within the selected service and date range
2. A higher score indicates **better workflow control**, not lower workload
3. Scores are intended for **coaching and improvement**, not punitive evaluation
4. **Do not compare** scores across different services or date ranges without recalculation
5. Trend indicators require at least 2 comparable periods of data

---

## 14. Future Extensions

Not in scope for initial release, but noted for later:

1. **Severity Bands** - Weight late events by project priority/value
2. **Capacity-Adjusted Scoring** - Account for assignee's total capacity/hours
3. **Predictive Alerts** - Warn when a project is at risk of going late
4. **Team Aggregation** - Roll up to team/department level
5. **Benchmark Targets** - Set goal LIR/LDR targets for the organization

---

## 15. Implementation Checklist

### Phase 1: Core Calculation Engine
- [ ] Create lateness detection utility function
- [ ] Build business days calculation utility (reuse existing SLA logic)
- [ ] Implement late event attribution logic
- [ ] Implement late days calculation with date range constraints
- [ ] Build scoring engine (LIR, LDR, raw_score, performance_score)

### Phase 2: API Layer
- [ ] Create `/api/analytics/performance-league` endpoint
- [ ] Create `/api/analytics/performance-league/:assigneeId` endpoint
- [ ] Add caching for expensive calculations
- [ ] Implement edge case handling

### Phase 3: Stage Breakdown
- [ ] Calculate per-stage lateness metrics
- [ ] Compare against team averages
- [ ] Build stage insights generator

### Phase 4: Trend Scoring
- [ ] Implement previous period calculation
- [ ] Calculate trend deltas
- [ ] Handle edge cases (new assignees, incomplete data)

### Phase 5: UI Components
- [ ] League table component with filters
- [ ] Detail drill-down modal/page
- [ ] Stage breakdown visualizations
- [ ] Coaching insights panel

### Phase 6: Polish
- [ ] Export functionality (CSV/PDF)
- [ ] Performance optimization
- [ ] Unit tests for calculation logic
- [ ] Documentation and tooltips

---

## 16. Technical Notes

### 16.1 Performance Considerations
- Use database-level aggregation where possible
- Cache league table results (invalidate on project updates)
- Consider pre-computing lateness events in background job

### 16.2 Timezone Handling
- All timestamps stored in UTC
- Business day calculations use company timezone setting
- Display dates in user's local timezone

### 16.3 Concurrency
- Multiple users can view simultaneously
- Real-time updates not required (5-minute cache acceptable)

---

*Document Version: 1.0*  
*Last Updated: 2024-12-15*  
*Status: Ready for Implementation*
