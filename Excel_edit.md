# Excel Inline Editing Feature - Implementation Plan

## Vision
Enable seamless Excel collaboration within message threads. Team member A sends an Excel file during a stage change, team member B views, edits, and saves it back - all without leaving The Link or downloading files locally.

---

## User Story
> "As a team member, I want to open an Excel attachment directly in the app, make edits, and save my changes as a new version that my colleague can see immediately in the thread."

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

## Implementation Stages

### Stage 1: Luckysheet Integration (Read-Only)
**Objective:** Replace current table preview with interactive Luckysheet viewer

#### Tasks
1. Install Luckysheet package and configure lazy loading
2. Create `ExcelEditor.tsx` component with Luckysheet container
3. Modify `AttachmentPreview.tsx` to use Luckysheet for Excel files
4. Pass SheetJS-parsed data to Luckysheet in read-only mode
5. Ensure multi-sheet support (tabs at bottom)
6. Handle loading states and error boundaries

#### Success Criteria
- [ ] Excel files open in Luckysheet viewer within 2 seconds
- [ ] All sheets visible via tabs at bottom of viewer
- [ ] Cell formatting (bold, colors, borders) displays correctly
- [ ] Formulas calculate and display results
- [ ] Scrolling and navigation feels smooth
- [ ] Works on mobile (responsive container)

#### Testing
- Open Excel file with 3 sheets, 200 rows each
- Verify all sheets accessible via tabs
- Verify cell styles render correctly
- Verify formulas show calculated values
- Test on mobile viewport

---

### Stage 2: Enable Editing Mode
**Objective:** Allow users to modify spreadsheet content

#### Tasks
1. Add "Edit" button to preview header (next to Download)
2. Toggle Luckysheet from read-only to edit mode
3. Show visual indicator when in edit mode (banner/border)
4. Add "Cancel" button to discard changes and exit edit mode
5. Track dirty state (has user made changes?)
6. Warn user if closing with unsaved changes

#### Success Criteria
- [ ] "Edit" button clearly visible in preview header
- [ ] Clicking Edit enables cell editing, formatting tools
- [ ] Edit mode has clear visual distinction (colored border)
- [ ] Cancel exits edit mode without saving
- [ ] Closing modal with unsaved changes shows confirmation
- [ ] Cell editing feels native (type, tab, enter navigation)

#### Testing
- Enter edit mode, modify cells, cancel - verify no changes saved
- Enter edit mode, try to close modal - verify warning appears
- Edit multiple cells across sheets - verify all edits persist in session
- Test keyboard navigation (Tab, Enter, Arrow keys)

---

### Stage 3: Save & Version System
**Objective:** Save edited spreadsheet as new versioned attachment

#### Tasks
1. Add "Save to Thread" button in edit mode
2. Export Luckysheet data back to SheetJS workbook
3. Generate new XLSX binary from SheetJS
4. Create version naming logic: `filename_v2.xlsx`, `filename_v3.xlsx`
5. Upload new version to object storage
6. Create new attachment record linked to original
7. Post auto-generated message to thread: "Saved new version"
8. Update attachment list to show new version
9. Exit edit mode after successful save

#### Backend API Changes
```typescript
POST /api/internal/attachments/save-excel-edit
Body: {
  threadId: string,
  originalAttachmentId: string,
  workbookData: LuckysheetData,
  projectId?: string  // for stage-change-attachments
}
Response: {
  newAttachment: Attachment,
  versionNumber: number,
  messageId: string
}
```

#### Success Criteria
- [ ] "Save to Thread" button visible only in edit mode
- [ ] Save completes within 3 seconds for typical files
- [ ] New file appears in thread with correct version suffix
- [ ] Auto-message posted: "[User] saved [filename]_v2.xlsx"
- [ ] Original file remains unchanged
- [ ] New version previewable immediately
- [ ] Version lineage tracked (v1 → v2 → v3)

#### Testing
- Edit file, save, verify new attachment appears
- Verify original file unchanged by re-opening
- Save multiple versions, verify v2, v3, v4 naming
- Verify auto-message posted with correct username
- Large file (300 rows) saves successfully

---

### Stage 4: Change Summary (Diff Engine)
**Objective:** Auto-generate human-readable summary of changes

#### Tasks
1. Create diff utility comparing before/after workbook states
2. Detect: cells modified, rows added/deleted, sheets added/deleted
3. Generate natural language summary
4. Include summary in auto-posted save message
5. Store diff metadata for future reference

#### Diff Algorithm
```typescript
interface ExcelDiff {
  sheetsAdded: string[];
  sheetsDeleted: string[];
  sheetChanges: {
    sheetName: string;
    cellsModified: number;
    rowsAdded: number;
    rowsDeleted: number;
  }[];
}

// Example output:
// "Edited 12 cells in Sheet1, added 4 rows. Added new sheet 'Summary'."
```

#### Success Criteria
- [ ] Diff calculates in under 1 second for 500 cells
- [ ] Accurately counts modified cells
- [ ] Accurately counts added/deleted rows
- [ ] Detects new/deleted sheets
- [ ] Generates readable summary message
- [ ] Summary appears in thread message

#### Testing
- Modify 5 cells → verify "Edited 5 cells in Sheet1"
- Add 3 rows → verify "added 3 rows"
- Delete 2 rows → verify "deleted 2 rows"
- Add new sheet → verify "Added new sheet 'Name'"
- Multiple changes → verify combined summary

---

### Stage 5: Polish & Edge Cases
**Objective:** Production-ready, delightful experience

#### Tasks
1. Add loading spinner during save operation
2. Handle save failures gracefully (retry option)
3. Add keyboard shortcuts (Ctrl+S to save)
4. Optimize Luckysheet bundle (code splitting)
5. Add permission checks (can user edit this thread?)
6. Handle concurrent edit attempts (optimistic locking)
7. Mobile touch optimization
8. Add "View Version History" showing all versions

#### Success Criteria
- [ ] Save shows progress indicator
- [ ] Failed save shows clear error with retry option
- [ ] Ctrl+S triggers save in edit mode
- [ ] Initial load under 2 seconds (lazy loaded)
- [ ] Unauthorized users see view-only mode
- [ ] Version history accessible from attachment menu

#### Testing
- Interrupt network during save → verify error handling
- Test Ctrl+S shortcut
- Test with slow network (3G throttle)
- Test permission: view-only user cannot enter edit mode
- View version history shows all versions in order

---

## File Structure

```
client/src/components/attachments/
├── AttachmentPreview.tsx        # Updated to use ExcelEditor
├── ExcelEditor.tsx              # NEW: Luckysheet wrapper
├── ExcelDiff.ts                 # NEW: Diff calculation utility
└── ExcelVersionHistory.tsx      # NEW: Version list component

server/routes/
├── messages.ts                  # Updated: save-excel-edit endpoint
└── excel-service.ts             # NEW: XLSX generation, diff logic

shared/
└── excel-types.ts               # NEW: Shared type definitions
```

---

## Rollout Plan

| Week | Milestone | Deliverable |
|------|-----------|-------------|
| 1 | Stage 1 Complete | Luckysheet viewer live (read-only) |
| 2 | Stage 2 + 3 Complete | Edit & Save working |
| 3 | Stage 4 Complete | Change summaries live |
| 4 | Stage 5 Complete | Polished, production-ready |

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Luckysheet bundle too large | Lazy load, only fetch when opening Excel |
| Formula compatibility issues | Test common formulas; document unsupported features |
| Data loss during round-trip | Keep original file intact; new version is additive |
| Concurrent editing conflicts | Lock file during edit; show "in use" indicator |
| Mobile usability | Test touch interactions; consider mobile-specific UI |

---

## Out of Scope (Future Enhancements)
- Real-time collaborative editing (Google Sheets style)
- Excel macro support
- Pivot table creation/editing
- Chart creation/editing
- Commenting on specific cells

---

## Definition of Done
- [ ] All 5 stages completed with success criteria met
- [ ] End-to-end test: Upload → Edit → Save → View new version
- [ ] Mobile testing passed
- [ ] Performance acceptable (<3s save, <2s open)
- [ ] Documentation updated in replit.md
- [ ] Team demo completed
