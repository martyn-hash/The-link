# Excel Inline Editing Feature - Implementation Plan

## Vision
Enable seamless Excel collaboration within message threads. Team member A sends an Excel file during a stage change, team member B views, edits, and saves it back - all without leaving The Link or downloading files locally.

---

## User Story
> "As a team member, I want to open an Excel attachment directly in the app, make edits, and save my changes as a new version that my colleague can see immediately in the thread."

---

## Constraints & Requirements

### Platform Support
| Platform | Behavior |
|----------|----------|
| **Desktop** | Full inline editing experience |
| **Mobile/Tablet** | "Excel editing is only available on desktop. Tap below to download the file." + Download button |

### File Limits
| Limit | Value | Fallback |
|-------|-------|----------|
| Max file size | **5 MB** | Show download button only |
| Max cell count | **20,000 cells** | Show download button only |

### Supported vs Unsupported Features
| Supported | Unsupported (graceful degradation) |
|-----------|-----------------------------------|
| Cell values & text | Pivot tables (display as static) |
| Basic formatting (bold, italic, colors) | Charts (ignored, not displayed) |
| Cell borders | Macros (ignored, not executed) |
| Number formatting | Complex conditional formatting |
| Formulas (standard calculations) | External data connections |
| Multiple sheets/tabs | Sparklines |
| Column/row sizing | Comments (stripped) |

**Important:** Unsupported features do NOT block loading. The file opens with supported features intact.

### Editing Behavior
| Rule | Description |
|------|-------------|
| Default mode | **Always read-only** on open |
| Edit activation | Only after clicking "Edit Spreadsheet" button |
| Autosave | **Disabled** - no automatic saving |
| Save action | Only "Save to Thread" creates a new version |
| File format | All saves standardized to **.xlsx** (converts XLS, CSV, ODS) |

### Security & Safety
| Feature | Implementation |
|---------|---------------|
| File locking | When user enters edit mode, file is locked; others see "Being edited by [Name]" |
| Formula injection protection | Block dangerous formulas: `WEBSERVICE`, `HYPERLINK`, `IMPORTDATA`, `IMPORTXML`, `IMPORTHTML`, `IMPORTRANGE` |
| Audit trail | Each version stores: editor name, timestamp, cells changed, rows changed |

### Error Handling
If inline loading fails for any reason:
```
┌─────────────────────────────────────────────────┐
│  ⚠️  Unable to display spreadsheet inline       │
│                                                 │
│  This file couldn't be opened in the editor.   │
│  You can still download and edit it locally.   │
│                                                 │
│           [ Download File ]                    │
└─────────────────────────────────────────────────┘
```

---

## Technical Approach

### Core Stack
| Component | Technology | Purpose |
|-----------|------------|---------|
| XLSX Parsing | **SheetJS** (already installed) | Convert Excel ↔ JSON |
| Spreadsheet UI | **Luckysheet** (MIT license) | Excel-like editing experience |
| Storage | Existing object storage | Store versioned files |
| Messaging | Existing thread system | Version notifications |

### Data Flow
```
┌─────────────┐     ┌──────────┐     ┌────────────┐
│ XLSX File   │────▶│ SheetJS  │────▶│ Luckysheet │
│ (storage)   │     │ (parse)  │     │ (display)  │
└─────────────┘     └──────────┘     └────────────┘
                                            │
                                      [User Edits]
                                            │
                                            ▼
┌─────────────┐     ┌──────────┐     ┌────────────┐
│ New Version │◀────│ SheetJS  │◀────│ Luckysheet │
│ (v2.xlsx)   │     │ (write)  │     │ (export)   │
└─────────────┘     └──────────┘     └────────────┘
        │
        ▼
┌─────────────────────────────────────────────────┐
│ Auto-message: "Sarah saved VAT_v2.xlsx          │
│ (edited 12 cells in Sheet1, added 2 rows)"      │
└─────────────────────────────────────────────────┘
```

---

## Database Schema Additions

### File Lock Table
```sql
CREATE TABLE excel_edit_locks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attachment_id UUID NOT NULL REFERENCES attachments(id),
  locked_by UUID NOT NULL REFERENCES users(id),
  locked_at TIMESTAMP NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL, -- Auto-expire after 30 mins inactivity
  UNIQUE(attachment_id)
);
```

### Version Lineage (extend attachments table)
```sql
ALTER TABLE attachments ADD COLUMN parent_attachment_id UUID REFERENCES attachments(id);
ALTER TABLE attachments ADD COLUMN version_number INTEGER DEFAULT 1;
ALTER TABLE attachments ADD COLUMN edit_metadata JSONB;
-- edit_metadata: { editorId, editorName, timestamp, cellsChanged, rowsChanged, sheetsChanged }
```

---

## Implementation Stages

### Stage 1: Luckysheet Integration (Read-Only)
**Objective:** Replace current table preview with interactive Luckysheet viewer (desktop only)

#### Tasks
1. Install Luckysheet package and configure lazy loading
2. Create `ExcelEditor.tsx` component with Luckysheet container
3. Add viewport detection - show mobile fallback message on non-desktop
4. Add file size check (5MB limit) - show download fallback if exceeded
5. Add cell count check (20,000 limit) - show download fallback if exceeded
6. Modify `AttachmentPreview.tsx` to use Luckysheet for Excel files
7. Pass SheetJS-parsed data to Luckysheet in read-only mode
8. Ensure multi-sheet support (tabs at bottom)
9. Handle unsupported features gracefully (strip charts, macros, pivots)
10. Handle loading states and error boundaries with download fallback
11. Add formula sanitization (block dangerous formulas on parse)

#### Success Criteria
- [ ] Desktop: Excel files open in Luckysheet viewer within 2 seconds
- [ ] Mobile/Tablet: Shows "Desktop only" message with download button
- [ ] Files > 5MB: Shows download button with size warning
- [ ] Files > 20,000 cells: Shows download button with complexity warning
- [ ] All sheets visible via tabs at bottom of viewer
- [ ] Cell formatting (bold, colors, borders) displays correctly
- [ ] Formulas calculate and display results (except blocked formulas)
- [ ] Files with pivot tables/charts still load (unsupported parts ignored)
- [ ] Dangerous formulas neutralized (WEBSERVICE, HYPERLINK, etc.)
- [ ] Load failure shows clean error with download option

#### Testing
- Open Excel file with 3 sheets, 200 rows each on desktop
- Open same file on mobile viewport → verify fallback message
- Open 6MB file → verify download fallback
- Open file with 25,000 cells → verify download fallback
- Open file with pivot table → verify file loads, pivot ignored
- Open file with WEBSERVICE formula → verify formula blocked
- Simulate load error → verify download fallback appears

---

### Stage 2: Enable Editing Mode with Locking
**Objective:** Allow users to modify spreadsheet content with concurrency protection

#### Tasks
1. Add "Edit Spreadsheet" button to preview header (desktop only)
2. Implement file locking API endpoint
3. When "Edit Spreadsheet" clicked: acquire lock, then enable edit mode
4. Show visual indicator when in edit mode (amber border, "Editing" badge)
5. If file locked by another user: show "Being edited by [Name]" message
6. Add "Cancel" button to discard changes and release lock
7. Track dirty state (has user made changes?)
8. Warn user if closing with unsaved changes
9. Auto-release lock after 30 minutes of inactivity
10. Heartbeat mechanism to keep lock alive during active editing

#### API Endpoints
```typescript
POST /api/excel/lock
Body: { attachmentId: string }
Response: { success: true } | { success: false, lockedBy: string, lockedAt: string }

DELETE /api/excel/lock/:attachmentId
Response: { success: true }

POST /api/excel/lock/:attachmentId/heartbeat
Response: { success: true }
```

#### Success Criteria
- [ ] "Edit Spreadsheet" button visible only on desktop
- [ ] Clicking Edit acquires lock and enables editing
- [ ] Other users see "Being edited by [Name]" with lock holder's name
- [ ] Edit mode has clear visual distinction (amber border + badge)
- [ ] Cancel exits edit mode, releases lock, discards changes
- [ ] Closing modal with unsaved changes shows confirmation
- [ ] Lock auto-expires after 30 mins inactivity
- [ ] Heartbeat keeps lock alive during active editing

#### Testing
- User A enters edit mode → verify lock acquired
- User B tries to edit same file → verify "Being edited by User A" shown
- User A cancels → verify lock released, User B can now edit
- User A edits, closes tab without saving → verify lock expires after timeout
- Edit multiple cells across sheets → verify all edits persist in session

---

### Stage 3: Save & Version System
**Objective:** Save edited spreadsheet as new versioned attachment with audit trail

#### Tasks
1. Add "Save to Thread" button (visible only in edit mode)
2. Export Luckysheet data back to SheetJS workbook
3. Convert to XLSX format (standardize from XLS, CSV, ODS if needed)
4. Sanitize formulas before save (remove any dangerous formulas)
5. Generate version naming: `filename_v2.xlsx`, `filename_v3.xlsx`
6. Create diff calculation (for audit metadata)
7. Upload new version to object storage
8. Create attachment record with:
   - `parent_attachment_id` pointing to original
   - `version_number` incremented
   - `edit_metadata` with audit trail
9. Post auto-generated message to thread with change summary
10. Release file lock after successful save
11. Update UI to show new version in attachment list

#### Backend API
```typescript
POST /api/excel/save
Body: {
  threadId: string,
  originalAttachmentId: string,
  workbookData: LuckysheetData,
  projectId?: string
}
Response: {
  newAttachment: {
    id: string,
    filename: string,
    versionNumber: number,
    parentAttachmentId: string,
    editMetadata: {
      editorId: string,
      editorName: string,
      timestamp: string,
      cellsChanged: number,
      rowsChanged: number,
      sheetsChanged: string[]
    }
  },
  messageId: string
}
```

#### Success Criteria
- [ ] "Save to Thread" button visible only in edit mode
- [ ] Save converts any format (XLS, CSV, ODS) to XLSX
- [ ] Dangerous formulas stripped before save
- [ ] Save completes within 3 seconds for typical files
- [ ] New file appears in thread with correct version suffix
- [ ] Auto-message posted: "[User] saved [filename]_v2.xlsx"
- [ ] Original file remains unchanged and accessible
- [ ] New version previewable immediately
- [ ] Version lineage tracked in database
- [ ] Audit metadata stored (editor, timestamp, changes)
- [ ] File lock released after save

#### Testing
- Edit file, save → verify new attachment `filename_v2.xlsx` appears
- Verify original `filename.xlsx` unchanged
- Save multiple versions → verify v2, v3, v4 naming
- Verify audit metadata stored correctly
- Upload XLS file, edit, save → verify saves as XLSX
- File with WEBSERVICE formula → verify stripped on save

---

### Stage 4: Change Summary (Diff Engine)
**Objective:** Auto-generate human-readable summary of changes

#### Tasks
1. Create diff utility comparing before/after workbook states
2. Detect: cells modified, rows added/deleted, sheets added/deleted
3. Generate natural language summary
4. Include summary in auto-posted save message
5. Store detailed diff in edit_metadata

#### Diff Algorithm
```typescript
interface ExcelDiff {
  cellsChanged: number;
  rowsAdded: number;
  rowsDeleted: number;
  sheetsAdded: string[];
  sheetsDeleted: string[];
  sheetSummaries: {
    sheetName: string;
    cellsModified: number;
    rowsAdded: number;
    rowsDeleted: number;
  }[];
}

// Example outputs:
// "Edited 12 cells in Sheet1, added 4 rows."
// "Added new sheet 'Summary'. Edited 3 cells in Sheet1."
// "Deleted 2 rows in Data, edited 8 cells across 2 sheets."
```

#### Success Criteria
- [ ] Diff calculates in under 1 second for 20,000 cells
- [ ] Accurately counts modified cells
- [ ] Accurately counts added/deleted rows
- [ ] Detects new/deleted sheets
- [ ] Generates readable, grammatically correct summary
- [ ] Summary appears in thread auto-message
- [ ] Detailed diff stored in edit_metadata for audit

#### Testing
- Modify 5 cells → verify "Edited 5 cells in Sheet1"
- Add 3 rows → verify "added 3 rows"
- Delete 2 rows → verify "deleted 2 rows"
- Add new sheet → verify "Added new sheet 'Name'"
- Multiple changes across sheets → verify combined summary
- Large file (15,000 cells) → verify diff completes < 1 second

---

### Stage 5: Version History & Polish
**Objective:** Production-ready, delightful experience with full version lineage

#### Tasks
1. Create Version History panel showing all versions of a file
2. Display for each version: version number, editor, timestamp, change summary
3. Allow opening any previous version (read-only)
4. Add loading spinner during save operation
5. Handle save failures gracefully (retry option, lock preserved)
6. Add keyboard shortcuts (Ctrl+S to save when in edit mode)
7. Optimize Luckysheet bundle (code splitting, lazy load)
8. Final mobile/tablet testing and polish
9. Performance optimization for large files

#### Version History UI
```
┌─────────────────────────────────────────────────┐
│ 📄 VAT_Returns.xlsx                             │
│                                                 │
│ Version History                                 │
│ ─────────────────                               │
│ v3 · Sarah · 2 hours ago                        │
│     "Edited 8 cells in Sheet1"                  │
│     [View] [Download]                           │
│                                                 │
│ v2 · Martyn · Yesterday                         │
│     "Added 12 rows, edited 3 cells"             │
│     [View] [Download]                           │
│                                                 │
│ v1 · Original · 3 days ago                      │
│     [View] [Download]                           │
└─────────────────────────────────────────────────┘
```

#### Success Criteria
- [ ] Version history shows all versions with metadata
- [ ] Can view any previous version (opens read-only)
- [ ] Can download any version
- [ ] Save shows progress indicator
- [ ] Failed save shows clear error with retry option
- [ ] Ctrl+S triggers save in edit mode
- [ ] Initial load under 2 seconds (lazy loaded)
- [ ] Bundle size optimized (< 500KB gzipped for Luckysheet chunk)

#### Testing
- Create 3 versions of a file → verify all appear in history
- Click "View" on v1 → verify opens read-only
- Interrupt network during save → verify error handling + lock preserved
- Test Ctrl+S shortcut
- Test with slow network (3G throttle)
- Measure bundle size and load performance

---

## File Structure

```
client/src/components/attachments/
├── AttachmentPreview.tsx          # Updated: routes Excel to ExcelEditor
├── ExcelEditor.tsx                # NEW: Luckysheet wrapper component
├── ExcelEditorMobileFallback.tsx  # NEW: Mobile "desktop only" message
├── ExcelEditorLimitFallback.tsx   # NEW: File too large message
├── ExcelVersionHistory.tsx        # NEW: Version list component
└── excel/
    ├── luckysheet-config.ts       # NEW: Luckysheet configuration
    ├── formula-sanitizer.ts       # NEW: Dangerous formula detection
    └── diff-engine.ts             # NEW: Cell/row/sheet diff logic

server/routes/
├── excel.ts                       # NEW: Lock, save, version endpoints

server/services/
└── excel-service.ts               # NEW: XLSX generation, diff calculation

shared/
└── excel-types.ts                 # NEW: Shared type definitions
```

---

## Rollout Plan

| Week | Milestone | Deliverable |
|------|-----------|-------------|
| 1 | Stage 1 Complete | Luckysheet viewer (read-only) with all fallbacks |
| 2 | Stage 2 Complete | Edit mode with file locking |
| 2-3 | Stage 3 Complete | Save & versioning working |
| 3 | Stage 4 Complete | Change summaries live |
| 3-4 | Stage 5 Complete | Version history, polish, production-ready |

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Luckysheet bundle too large | Lazy load chunk, only fetch when opening Excel |
| Formula compatibility | Document supported formulas; graceful degradation |
| Data loss during round-trip | Keep original file intact; new version is additive |
| Concurrent editing conflicts | File locking with clear "in use" messaging |
| Mobile usability issues | Desktop-only editing; clean mobile fallback |
| Dangerous formula injection | Sanitize on parse AND save; block known dangerous formulas |
| Large file performance | Hard limits (5MB, 20k cells) with download fallback |

---

## Security Checklist

- [ ] File locking prevents concurrent edit conflicts
- [ ] Dangerous formulas blocked: WEBSERVICE, HYPERLINK, IMPORTDATA, IMPORTXML, IMPORTHTML, IMPORTRANGE
- [ ] All saves sanitized before writing to storage
- [ ] Audit trail captures: who, when, what changed
- [ ] Original files preserved (versions are additive)
- [ ] Lock expiry prevents indefinite file blocking
- [ ] Authorization checked before edit mode enabled

---

## Out of Scope (Future Enhancements)
- Real-time collaborative editing (Google Sheets style)
- Excel macro execution
- Pivot table creation/editing
- Chart creation/editing
- Cell commenting
- Conditional formatting editor
- Print layout view

---

## Definition of Done
- [ ] All 5 stages completed with success criteria met
- [ ] Desktop: Full edit workflow functional
- [ ] Mobile/Tablet: Clean fallback with download option
- [ ] File limits enforced with clear messaging
- [ ] File locking prevents conflicts
- [ ] Version history accessible
- [ ] Audit trail complete
- [ ] Dangerous formulas blocked
- [ ] End-to-end test: Upload → Edit → Save → View new version → Check history
- [ ] Performance: <2s open, <3s save
- [ ] Documentation updated in replit.md
- [ ] Team demo completed
