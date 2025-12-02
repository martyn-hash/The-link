# Projects Page Makeover - Implementation Plan

## Overview

This document outlines the plan to make the `/projects` page the primary landing page (dashboard) when users log in, consolidate navigation, and implement a user-selectable "default view" preference.

## Testing Instructions

**Login Credentials:**
- URL: Root page (/)
- Method: Password tab
- Email: `admin@example.com`
- Password: `admin123`

---

## Current State Analysis

### Existing Pages
- **Dashboard (`/`)**: Shows:
  - Recently Viewed panel (clients, people, projects) - *TO BE PRESERVED FOR REUSE*
  - Dashboard Summary Cards (My Tasks, My Projects, Overdue Tasks, Behind Schedule)
  - My Dashboard Panel (desktop only)

- **Projects (`/projects`)**: Has multiple view modes:
  - List view
  - Kanban view (requires service filter)
  - Calendar view
  - Dashboard view (custom dashboards with widgets)
  - Saved views and dashboards functionality

### Existing Navigation Structure
| Component | Dashboard Link | Projects Link |
|-----------|---------------|---------------|
| Top Navigation (logo dropdown) | `/` (Dashboard) | `/projects` (Projects) |
| Mobile Menu | `/` (Dashboard) | `/projects` (Projects) |
| Bottom Nav (mobile) | `/` (Home) | `/projects` (Projects) |
| Sidebar | `/` (Dashboard) | `/projects` (My Projects) |

### Existing User Preferences
The `userProjectPreferences` table already exists with:
- `defaultViewId` - ID of saved view/dashboard to load
- `defaultViewType` - Type of default view ('list', 'kanban', 'calendar', 'dashboard')

---

## Target State

### New User Flow
1. User logs in → lands on `/` which now renders the Projects page
2. Projects page checks for user's `defaultViewType` preference
3. If preference exists → load that view (list, kanban, calendar, or specific dashboard)
4. If no preference → default to list view

### Navigation Changes
- "Dashboard" menu item → navigates to `/` → renders Projects page
- Remove separate "Projects" menu item from all navigation
- `/projects` route → redirects to `/`
- `/dashboard` route → already redirects to `/`

---

## Implementation Tasks

### Phase 1: Schema & API for Default View Preference

#### 1.1 Add API endpoints for user project preferences
- [ ] `GET /api/user-project-preferences` - Get current user's default view preference
- [ ] `PUT /api/user-project-preferences` - Update default view preference

**Schema already exists:**
```typescript
// shared/schema/users/tables.ts (lines 189-198)
export const userProjectPreferences = pgTable("user_project_preferences", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }).unique(),
  defaultViewId: varchar("default_view_id"),
  defaultViewType: varchar("default_view_type"), // 'list' | 'kanban' | 'calendar' | 'dashboard'
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
```

#### 1.2 Add storage methods
- [ ] Add `getUserProjectPreferences(userId: string)` method
- [ ] Add `upsertUserProjectPreferences(preferences)` method

### Phase 2: Projects Page Enhancements

#### 2.1 Accept initial view from user preferences
- [ ] Query user project preferences on mount
- [ ] Set initial `viewMode` state based on preference (before rendering)
- [ ] If `defaultViewType` is 'dashboard' and `defaultViewId` exists, load that specific dashboard
- [ ] Handle loading state while preferences load (prevent flash of wrong view)

#### 2.2 Add "Set as Default" functionality
- [ ] Add UI to save current view as default (e.g., in view mode switcher or settings)
- [ ] When user saves a view/dashboard, offer option to make it the default
- [ ] Persist preference via API call

### Phase 3: Routing Changes

#### 3.1 Update App.tsx routing
**Current:**
```tsx
<Route path="/" component={isAuthenticated ? Dashboard : Landing} />
<Route path="/projects" component={Projects} />
```

**Target:**
```tsx
<Route path="/" component={isAuthenticated ? Projects : Landing} />
<Route path="/projects">
  <Redirect to="/" />
</Route>
```

#### 3.2 Ensure backward compatibility
- [ ] `/dashboard` → `/` (already redirects)
- [ ] `/projects` → `/` (new redirect)
- [ ] `/all-projects` → `/` (update existing redirect)

### Phase 4: Navigation Updates

#### 4.1 Top Navigation (`client/src/components/top-navigation.tsx`)
- [ ] Remove Projects menu item from logo dropdown
- [ ] Rename "Dashboard" to keep as-is (it will now go to the unified Projects page)

**Lines to modify:** ~158-169 (remove Projects link from dropdown)

#### 4.2 Mobile Menu (`client/src/components/mobile-menu.tsx`)
- [ ] Remove Projects item from `navItems` array
- [ ] Keep Dashboard item pointing to `/`

**Lines to modify:** ~58-64 (navItems array)

#### 4.3 Bottom Nav (`client/src/components/bottom-nav.tsx`)
- [ ] Remove Projects item from `navItems` array
- [ ] Keep Home item pointing to `/`

**Lines to modify:** ~33-63 (navItems array)

#### 4.4 Sidebar (`client/src/components/sidebar.tsx`)
- [ ] Remove "My Projects" item from `navigationItems` array
- [ ] Keep "Dashboard" item pointing to `/`

**Lines to modify:** ~33-46 (navigationItems array)

### Phase 5: Dashboard Page Cleanup

#### 5.1 Preserve Recently Viewed components
- [ ] Extract `RecentlyViewedPanel` component from `dashboard.tsx`
- [ ] Move to shared location (e.g., `client/src/components/recently-viewed-panel.tsx`)
- [ ] Keep fully functional for later reuse elsewhere

#### 5.2 Remove dashboard page from routing
- [ ] Remove Dashboard lazy import from App.tsx
- [ ] Remove Dashboard component usage
- [ ] Keep `dashboard.tsx` file temporarily (for reference/components extraction)

### Phase 6: Testing & Validation

#### 6.1 Manual Testing Scenarios
- [ ] New user login → lands on Projects (list view)
- [ ] User with list preference → lands on Projects in list view
- [ ] User with kanban preference → lands on Projects in kanban view
- [ ] User with calendar preference → lands on Projects in calendar view
- [ ] User with dashboard preference → lands on specific custom dashboard
- [ ] Deep links work: `/projects/123` → project detail page
- [ ] All navigation paths lead to unified Projects page
- [ ] Old bookmarks to `/projects` and `/dashboard` redirect properly

#### 6.2 UI/UX Verification
- [ ] No "flash" of wrong view on initial load
- [ ] Loading state displays while preferences load
- [ ] View preference saves correctly
- [ ] Navigation highlighting works correctly on all devices

---

## Files to Modify

| File | Changes |
|------|---------|
| `client/src/App.tsx` | Update routing, remove Dashboard import |
| `client/src/pages/projects.tsx` | Add preference loading, default view logic |
| `client/src/components/top-navigation.tsx` | Remove Projects link |
| `client/src/components/mobile-menu.tsx` | Remove Projects link |
| `client/src/components/bottom-nav.tsx` | Remove Projects link |
| `client/src/components/sidebar.tsx` | Remove My Projects link |
| `server/routes.ts` | Add user-project-preferences endpoints |
| `server/storage/settings/` | Add preference storage methods |

## Files to Create

| File | Purpose |
|------|---------|
| `client/src/components/recently-viewed-panel.tsx` | Extracted Recently Viewed component |
| `server/storage/settings/userProjectPreferencesStorage.ts` | Storage class for preferences |

## Files to Keep (for component extraction)

| File | Components to Extract |
|------|----------------------|
| `client/src/pages/dashboard.tsx` | `RecentlyViewedPanel`, `DashboardSummaryCards` |

---

## Risk Assessment

### Low Risk
- Navigation changes are straightforward link updates
- Schema and API additions are non-breaking
- Preference loading is a new feature, not modifying existing behavior

### Medium Risk
- Routing changes require careful redirect handling
- Need to handle race condition where preferences load after initial render

### Mitigation
- Add loading state before rendering Projects page
- Test all navigation paths thoroughly
- Keep old routes as redirects for backward compatibility

---

## Estimated Effort

| Phase | Effort |
|-------|--------|
| Phase 1: Schema & API | 1-2 hours |
| Phase 2: Projects Page | 2-3 hours |
| Phase 3: Routing | 30 minutes |
| Phase 4: Navigation | 1 hour |
| Phase 5: Cleanup | 1 hour |
| Phase 6: Testing | 1-2 hours |
| **Total** | **7-10 hours** |

---

## Implementation Order

1. **Phase 1** - API foundation (non-breaking)
2. **Phase 2** - Projects page enhancements (non-breaking)
3. **Phase 5** - Extract components (non-breaking)
4. **Phase 3** - Routing changes (breaking change point)
5. **Phase 4** - Navigation updates (must follow routing)
6. **Phase 6** - Testing throughout

---

## Rollback Plan

If issues arise:
1. Revert routing in App.tsx to original
2. Navigation changes are independent and can be reverted separately
3. API endpoints are additive and don't need removal
4. User preferences are stored separately and won't affect other functionality
