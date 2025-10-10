# File Attachments & Voice Notes Implementation Plan

## Overview
This document outlines the comprehensive plan to fix and enhance file attachment, voice note, and document management features across the application.

---

## Current Issues Identified

### 1. Database Schema Updates Required
* Documents table needs new fields added:
    * `source` field (to track if document came from message, direct upload, or task)
    * `messageId` field (to link documents back to their source message)
    * `threadId` field (to link documents to message threads)
    * `taskId` field (for future task-based uploads)
    * New indexes for these fields

### 2. Incomplete File Attachment Features
* File upload flow exists but needs enhancements:
    * Multiple file selection (up to 5 files per message)
    * Upload progress indicators
    * File preview before sending
    * Ability to remove files before sending
    * Drag-and-drop support

### 3. Voice Note Features Need Enhancement
* Basic recording exists but needs:
    * Visual recording indicator with animation ✓ (Already implemented)
    * Recording duration display ✓ (Already implemented)
    * Preview playback before sending ✓ (Already implemented)
    * Re-record option
    * Proper file naming convention (`voice-note-${timestamp}.webm`)

### 4. Missing Auto-Document Creation
* **Critical feature**: When users attach files to messages, those files should automatically create document records in the client's "Message Attachments" folder
* This integration between messaging and document management doesn't exist yet

### 5. Missing UI Components
* Need to create several new components:
    * `AttachmentPreview.tsx` - for viewing images/PDFs inline
    * `VoiceNotePlayer.tsx` - for playing voice notes with controls
    * `FileUploadZone.tsx` - enhanced drag-and-drop upload
    * `AttachmentList.tsx` - display list of attachments

### 6. Staff Interface Gaps
* Staff messages page needs:
    * Better attachment display matching portal functionality
    * Image preview modals ✓ (Partially implemented)
    * PDF preview capability
    * Voice note player integration ✓ (Already working)
    * Drag-and-drop file upload

### 7. Client Detail Page Integration Issues
* **Documents Tab**: Message attachments don't automatically appear here
* **Communications Tab**: Missing attachment indicators on threads (like "📎 3 attachments")

### 8. Missing API Endpoints
Need to add/enhance:
* Preview endpoints for attachments
* Download endpoints with proper access control
* Enhanced validation in existing upload-url endpoints

### 9. Security & Validation Gaps
* Server-side file type validation needed (currently only client-side)
* Server-side file size validation as backup
* Access control validation for downloads
* Malware scanning recommendation (not implemented)

### 10. Access Control Issues
* Need to implement proper validation ensuring:
    * Portal users can only access their own client's attachments
    * Staff can access all attachments
    * Validation happens on every download request

### 11. Replit Object Storage Integration Issues
* Upload feature should work with Replit Object Storage but it's currently misconfigured
* Need to verify proper integration with Replit's App Storage (formerly Object Storage)
* Environment variables need to be properly set up

---

## Implementation Plan

## Phase 1: Infrastructure & Database (Tasks 1-4)

### Task 1: Analyze and verify current Replit Object Storage integration
**Status**: Pending
**Priority**: Critical
**Details**:
- Review current `/server/objectStorage.ts` implementation
- Verify `PRIVATE_OBJECT_DIR` and `PUBLIC_OBJECT_SEARCH_PATHS` environment variables are set
- Test authentication with Replit sidecar endpoint (http://127.0.0.1:1106)
- Verify bucket configuration in Replit workspace
- Test upload/download functionality

**Files to review**:
- `/server/objectStorage.ts`
- `/server/routes.ts` (upload endpoints)

### Task 2: Update database schema - add messageId, threadId, taskId fields
**Status**: Pending
**Priority**: Critical
**Details**:
Update the `documents` table in `/shared/schema.ts`:
```typescript
export const documents = pgTable("documents", {
  // ... existing fields ...

  // NEW FIELDS
  messageId: varchar("message_id").references(() => messages.id, { onDelete: "cascade" }),
  threadId: varchar("thread_id").references(() => messageThreads.id, { onDelete: "cascade" }),
  taskId: varchar("task_id"), // For future task integration

  // Update source field to be more specific
  source: varchar("source", { enum: ['direct_upload', 'message_attachment', 'task_upload', 'portal_upload'] })
    .notNull()
    .default('direct_upload'),
}, (table) => [
  // ... existing indexes ...

  // NEW INDEXES
  index("idx_documents_message_id").on(table.messageId),
  index("idx_documents_thread_id").on(table.threadId),
  index("idx_documents_task_id").on(table.taskId),
  index("idx_documents_source").on(table.source),
]);
```

### Task 3: Create database migration script
**Status**: Pending
**Priority**: Critical
**Details**:
- Create migration script to add new columns
- Add indexes for performance
- Ensure backward compatibility
- Update existing records with appropriate source values

**Migration script location**: Create `db/migrations/add_document_source_tracking.sql`

### Task 4: Fix/verify Replit Object Storage configuration
**Status**: Pending
**Priority**: Critical
**Details**:
- Ensure environment variables are set:
  - `PRIVATE_OBJECT_DIR` - e.g., `/bucket-name/private`
  - `PUBLIC_OBJECT_SEARCH_PATHS` - e.g., `/bucket-name/public`
- Verify bucket exists in Replit Object Storage tool
- Test signed URL generation
- Verify authentication with sidecar

---

## Phase 2: Backend Security & API (Tasks 5-8)

### Task 5: Create server-side validation utilities
**Status**: Pending
**Priority**: High
**Details**:
Create `/server/utils/fileValidation.ts`:
```typescript
export const ALLOWED_FILE_TYPES = {
  images: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  documents: ['application/pdf', 'application/msword',
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
              'application/vnd.ms-excel',
              'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  audio: ['audio/webm', 'audio/mpeg', 'audio/wav'],
};

export const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB
export const MAX_FILES_PER_MESSAGE = 5;

export function validateFileType(mimeType: string): boolean { ... }
export function validateFileSize(size: number): boolean { ... }
```

### Task 6: Add API endpoint for attachment preview
**Status**: Pending
**Priority**: High
**Details**:
Add to `/server/routes.ts`:
```typescript
// GET /api/internal/messages/attachments/:attachmentId/preview
app.get('/api/internal/messages/attachments/:attachmentId/preview',
  authenticate,
  async (req, res) => {
    // Verify user has access to thread
    // Stream file from object storage
    // Set appropriate cache headers
});
```

### Task 7: Add API endpoint for secure attachment download
**Status**: Pending
**Priority**: High
**Details**:
Add to `/server/routes.ts`:
```typescript
// GET /api/internal/messages/attachments/:attachmentId
// GET /api/portal/attachments/:attachmentId
app.get('/api/internal/messages/attachments/:attachmentId',
  authenticate,
  async (req, res) => {
    // Verify access control
    // Generate download URL or stream file
});
```

### Task 8: Implement auto-document creation for message attachments
**Status**: Pending
**Priority**: Critical
**Details**:
When a message with attachments is created:
1. Check if "Message Attachments" folder exists for client
2. If not, create it with `source: 'message_attachment'`
3. For each attachment in the message:
   - Create a document record
   - Set `messageId`, `threadId`, `source: 'message_attachment'`
   - Link to the "Message Attachments" folder
   - Use the existing `objectPath` from the attachment

**File to update**: `/server/routes.ts` - in the message creation endpoints

---

## Phase 3: UI Components (Tasks 9-12)

### Task 9: Create AttachmentPreview component
**Status**: Pending
**Priority**: Medium
**Details**:
Create `/client/src/components/AttachmentPreview.tsx`:
- Support images (inline preview)
- Support PDFs (iframe or PDF.js integration)
- Support audio files (audio player)
- Fallback for other file types (download link)

**Props**:
```typescript
interface AttachmentPreviewProps {
  fileName: string;
  fileType: string;
  fileSize: number;
  objectPath: string;
  onClose?: () => void;
}
```

### Task 10: Create VoiceNotePlayer component
**Status**: Pending
**Priority**: Medium
**Details**:
Create `/client/src/components/VoiceNotePlayer.tsx`:
- Custom audio player UI
- Play/pause controls
- Progress bar
- Duration display
- Speed control (optional)

**Props**:
```typescript
interface VoiceNotePlayerProps {
  audioUrl: string;
  duration?: number;
  fileName?: string;
}
```

### Task 11: Create FileUploadZone component
**Status**: Pending
**Priority**: Medium
**Details**:
Create `/client/src/components/FileUploadZone.tsx`:
- Drag-and-drop area
- File selection button
- Visual feedback on drag over
- File type/size validation
- Multiple file support

**Props**:
```typescript
interface FileUploadZoneProps {
  onFilesSelected: (files: File[]) => void;
  maxFiles?: number;
  acceptedTypes?: string[];
  maxSize?: number;
}
```

### Task 12: Create AttachmentList component
**Status**: Pending
**Priority**: Medium
**Details**:
Create `/client/src/components/AttachmentList.tsx`:
- Display list of attachments
- Show file icons based on type
- Display file size
- Remove button (before sending)
- Preview button (after sending)

**Props**:
```typescript
interface AttachmentListProps {
  attachments: Attachment[];
  onRemove?: (index: number) => void;
  onPreview?: (attachment: Attachment) => void;
  readonly?: boolean;
}
```

---

## Phase 4: Message Attachments Enhancement (Tasks 13-16)

### Task 13: Enhance messages page - multiple file selection (up to 5)
**Status**: Pending
**Priority**: High
**Details**:
Update `/client/src/pages/messages.tsx`:
- Allow selecting multiple files (max 5)
- Show count of selected files
- Display preview of each file
- Validate total count

### Task 14: Add upload progress indicators
**Status**: Pending
**Priority**: Medium
**Details**:
- Add progress bar for each file being uploaded
- Show overall progress
- Handle upload failures gracefully
- Allow cancellation of uploads

### Task 15: Add file preview before sending
**Status**: Pending
**Priority**: Medium
**Details**:
- Show thumbnails for images
- Show file name and size for other types
- Allow removing files before sending
- Integrate with AttachmentList component

### Task 16: Implement drag-and-drop file upload
**Status**: Pending
**Priority**: Medium
**Details**:
- Add drop zone to message input area
- Visual feedback on drag over
- Integrate with FileUploadZone component
- Validate files on drop

---

## Phase 5: Voice Note Improvements (Tasks 17-21)

### Task 17: Enhance voice recording - visual animation indicator
**Status**: ✓ Already implemented
**Priority**: Low
**Details**: Visual recording indicator with pulsing red dot is already implemented

### Task 18: Add duration display to voice recording
**Status**: ✓ Already implemented
**Priority**: Low
**Details**: Recording duration display is already showing in format "0:00"

### Task 19: Add preview playback for voice notes
**Status**: ✓ Already implemented
**Priority**: Low
**Details**: Audio preview with controls is already implemented

### Task 20: Add re-record option for voice notes
**Status**: Pending
**Priority**: Low
**Details**:
- Add "Re-record" button to voice note preview
- Clear existing recording
- Start new recording session
- Keep same UI flow

### Task 21: Update voice note file naming convention
**Status**: Pending
**Priority**: Low
**Details**:
Update in `/client/src/pages/messages.tsx`:
```typescript
const audioFile = new File(
  [recordedAudio],
  `voice-note-${Date.now()}.webm`,  // ✓ Already correct format
  { type: 'audio/webm' }
);
```

---

## Phase 6: Staff Interface (Tasks 22-26)

### Task 22: Update staff messages page - better attachment display
**Status**: Pending
**Priority**: Medium
**Details**:
Update staff messages interface to match portal functionality:
- Use consistent attachment display
- Show file type icons
- Proper spacing and layout

### Task 23: Add image preview modals to staff interface
**Status**: ✓ Partially implemented
**Priority**: Low
**Details**: Image preview modal is already working in messages.tsx

### Task 24: Add PDF preview capability
**Status**: Pending
**Priority**: Medium
**Details**:
- Integrate PDF viewer (PDF.js or iframe)
- Add to AttachmentPreview component
- Support both portal and staff interfaces

### Task 25: Integrate VoiceNotePlayer in staff interface
**Status**: ✓ Already working
**Priority**: Low
**Details**: Audio player with controls is already functional

### Task 26: Add drag-and-drop to staff messages interface
**Status**: Pending
**Priority**: Medium
**Details**:
- Same functionality as portal
- Use FileUploadZone component
- Maintain consistent UX

---

## Phase 7: Client Detail Integration (Tasks 27-28)

### Task 27: Update client detail Documents tab to show message attachments
**Status**: Pending
**Priority**: High
**Details**:
- Query documents where `source = 'message_attachment'`
- Group by folder (Message Attachments)
- Show link to original message/thread
- Allow filtering by source type

**File to update**: Client detail page Documents tab component

### Task 28: Add attachment indicators to Communications tab
**Status**: Pending
**Priority**: Medium
**Details**:
- Count attachments per thread
- Display indicator like "📎 3" next to thread
- Show in thread list
- Update on new messages with attachments

**File to update**: Client detail page Communications tab component

---

## Phase 8: Security Hardening (Tasks 29-32)

### Task 29: Implement server-side file type validation
**Status**: Pending
**Priority**: Critical
**Details**:
Add to ALL upload endpoints:
- `/api/portal/attachments/upload-url`
- `/api/internal/messages/attachments/upload-url`
- `/api/portal/documents/upload-url`

Validate `fileType` parameter against allowed types.

### Task 30: Implement server-side file size validation
**Status**: Pending
**Priority**: Critical
**Details**:
Add to ALL upload endpoints:
- Validate `fileSize` parameter
- Enforce max size limit (25MB for attachments)
- Return clear error messages

### Task 31: Add access control validation for downloads
**Status**: Pending
**Priority**: Critical
**Details**:
For every attachment download:
1. Verify user is authenticated
2. Get the message/thread associated with attachment
3. Verify user has access to that thread:
   - Staff: can access all threads
   - Portal user: can only access threads for their client

### Task 32: Add security middleware for portal access control
**Status**: Pending
**Priority**: Critical
**Details**:
Create middleware in `/server/middleware/attachmentAccess.ts`:
```typescript
export async function verifyAttachmentAccess(
  userId: string | undefined,
  portalUserId: string | undefined,
  attachmentId: string
): Promise<boolean> {
  // Get attachment's thread
  // Verify user has access to thread
  // Return true/false
}
```

---

## Phase 9: Testing & Validation (Tasks 33-36)

### Task 33: Test file upload flow end-to-end
**Status**: Pending
**Priority**: High
**Details**:
- Portal user uploads file in message
- Staff uploads file in message
- Verify files appear in Documents tab
- Verify files are downloadable
- Test with various file types

### Task 34: Test voice note recording and playback
**Status**: Pending
**Priority**: Medium
**Details**:
- Record voice note
- Preview before sending
- Send voice note
- Play back on both portal and staff side
- Verify auto-document creation

### Task 35: Test auto-document creation
**Status**: Pending
**Priority**: High
**Details**:
- Send message with attachments
- Verify documents created in "Message Attachments" folder
- Verify messageId and threadId are set
- Verify source is 'message_attachment'

### Task 36: Test access control security
**Status**: Pending
**Priority**: Critical
**Details**:
- Portal User A tries to access Portal User B's attachments (should fail)
- Portal user tries to access staff-only attachments (should fail)
- Staff can access all attachments (should succeed)
- Direct object path access is blocked (should fail)

---

## Implementation Priority

### Critical Priority (Must Fix First)
1. ✅ Task 1: Verify Replit Object Storage integration
2. ✅ Task 2: Update database schema
3. ✅ Task 3: Create migration script
4. ✅ Task 4: Fix Object Storage configuration
5. ✅ Task 8: Auto-document creation
6. ✅ Task 29-32: Security hardening

### High Priority (Core Features)
7. ✅ Task 5-7: API endpoints with validation
8. ✅ Task 13: Multiple file selection
9. ✅ Task 27-28: Client detail integration
10. ✅ Task 33, 35, 36: Testing

### Medium Priority (UX Enhancements)
11. ✅ Tasks 9-12: UI Components
12. ✅ Tasks 14-16: Upload enhancements
13. ✅ Tasks 22, 24, 26: Staff interface
14. ✅ Task 34: Voice note testing

### Low Priority (Polish)
15. ✅ Task 20: Re-record option
16. ✅ Tasks 17-19, 21, 23, 25: Already implemented

---

## Technical Notes

### Replit Object Storage Integration
The app uses Replit's App Storage (Google Cloud Storage backend):
- Authentication via sidecar endpoint (http://127.0.0.1:1106)
- Signed URLs for uploads (15 min TTL)
- Environment variables required:
  - `PRIVATE_OBJECT_DIR`: Private bucket path
  - `PUBLIC_OBJECT_SEARCH_PATHS`: Public bucket paths (comma-separated)

### Current Object Storage Implementation
File: `/server/objectStorage.ts`
- Uses `@google-cloud/storage` library
- External account authentication via Replit sidecar
- Methods:
  - `getObjectEntityUploadURL()`: Generate signed upload URL
  - `getObjectEntityFile()`: Get file from object path
  - `normalizeObjectEntityPath()`: Convert GCS URLs to app paths
  - `downloadObject()`: Stream file to response

### Database Schema
Current `documents` table has:
- Basic fields: id, clientId, fileName, fileSize, fileType, objectPath
- Upload tracking: uploadedBy, clientPortalUserId
- Organization: folderId
- Legacy fields: uploadName, source (being enhanced)

### Message Attachments Storage
Messages table has:
```typescript
attachments: jsonb("attachments") // Array of { fileName, fileType, fileSize, objectPath }
```

Currently, attachments are stored only in the message record, not as separate document records.

---

## Success Criteria

### Must Have
- ✅ Files attached to messages automatically create document records
- ✅ Portal users can only access their own client's attachments
- ✅ Staff can access all attachments
- ✅ Server-side validation for file types and sizes
- ✅ Multiple file uploads work (up to 5 files)
- ✅ Voice notes are properly stored and playable

### Should Have
- ✅ Drag-and-drop file upload
- ✅ Upload progress indicators
- ✅ Image preview modals
- ✅ PDF preview capability
- ✅ Attachment count indicators on threads

### Nice to Have
- ✅ Re-record option for voice notes
- ✅ Advanced audio player controls
- ✅ Malware scanning integration

---

## Risks & Mitigations

### Risk: Replit Object Storage misconfiguration
**Mitigation**: Verify environment variables and test upload/download before implementing new features

### Risk: Database migration issues
**Mitigation**: Test migration on development database first, create rollback script

### Risk: Access control bypass
**Mitigation**: Implement middleware-level checks, never trust client-side validation, comprehensive security testing

### Risk: Large file uploads causing performance issues
**Mitigation**: Enforce strict file size limits, implement chunked uploads for large files (future enhancement)

### Risk: Race conditions in auto-document creation
**Mitigation**: Use database transactions, implement idempotency checks

---

## Estimated Timeline

**Phase 1**: 1-2 days
**Phase 2**: 2-3 days
**Phase 3**: 2-3 days
**Phase 4**: 1-2 days
**Phase 5**: 0.5-1 day (mostly done)
**Phase 6**: 1-2 days
**Phase 7**: 1-2 days
**Phase 8**: 1-2 days
**Phase 9**: 1-2 days

**Total Estimated Time**: 11-19 days

---

## Next Steps

1. Review and approve this plan
2. Verify Replit Object Storage setup
3. Create database migration
4. Begin Phase 1 implementation
5. Progress through phases sequentially
6. Test thoroughly before deployment

---

*Document created: 2025-10-08*
*Last updated: 2025-10-08*
