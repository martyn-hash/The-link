# File Attachments & Voice Notes - Development Requirements

## Executive Summary
This document outlines the requirements and implementation details for adding comprehensive file attachment and voice note capabilities to the client portal messaging system. The feature will enable both client portal users and staff users to share files (images, PDFs) and voice notes through the messaging interface, with automatic integration into the client's document repository.

---

## Current System Analysis

### Existing Infrastructure

#### 1. Database Models (shared/schema.ts)

**Messages Table**
- Already has `attachments` field (JSONB type)
- Stores array of attachment metadata:
  ```typescript
  {
    fileName: string;
    fileType: string;
    fileSize: number;
    objectPath: string;
  }
  ```

**MessageThreads Table**
- Links to clients via `clientId`
- Has status management (open, in_progress, resolved, closed, archived)
- Tracks creation by both staff (`createdByUserId`) and portal users (`createdByClientPortalUserId`)

**Documents Table**
- Stores document metadata
- Links to clients via `clientId`
- Links to portal users via `clientPortalUserId`
- Can be organized into folders via `folderId`
- Fields include:
  - `fileName`, `fileType`, `fileSize`
  - `objectPath` (storage location)
  - `uploadedAt` timestamp

**DocumentFolders Table**
- Organizes documents hierarchically
- Links to clients via `clientId`
- Supports nested folder structure via `parentFolderId`

#### 2. Object Storage Setup (server/objectStorage.ts)

**ObjectStorageService**
- Uses Google Cloud Storage backend
- Environment variables:
  - `PUBLIC_OBJECT_SEARCH_PATHS` - for public assets
  - `PRIVATE_OBJECT_DIR` - for private uploads
- Key methods:
  - `getObjectEntityUploadURL()` - generates presigned upload URLs
  - `downloadObject()` - streams files for download
  - Access control via `ObjectAclPolicy`

#### 3. Existing API Endpoints

**Portal User Messaging** (`/api/portal/...`)
- `GET /api/portal/threads` - list threads
- `GET /api/portal/threads/:threadId` - get thread details
- `POST /api/portal/threads` - create new thread
- `GET /api/portal/threads/:threadId/messages` - get messages
- `POST /api/portal/threads/:threadId/messages` - send message (already supports attachments)
- `POST /api/portal/attachments/upload-url` - get presigned URL for upload
- `PUT /api/portal/threads/:threadId/mark-read` - mark messages as read

**Staff Messaging** (`/api/internal/messages/...`)
- `GET /api/internal/messages/threads` - list all threads
- `GET /api/internal/messages/threads/:threadId/messages` - get messages
- `POST /api/internal/messages/threads/:threadId/messages` - send message
- `POST /api/internal/messages/attachments/upload-url` - get upload URL
- `PUT /api/internal/messages/threads/:threadId/status` - update thread status
- `PUT /api/internal/messages/threads/:threadId/archive` - archive thread

**Document Management** (`/api/clients/:clientId/...`)
- `GET /api/clients/:clientId/documents` - list all documents
- `POST /api/clients/:clientId/documents` - create document record
- `GET /api/clients/:clientId/folders` - list folders
- `POST /api/clients/:clientId/folders` - create folder

#### 4. Frontend Components

**Client Portal**
- `PortalThreadDetail.tsx` - message thread view
  - Already has file upload state management
  - Already has voice recording state management
  - Displays messages with attachments
  - File input handling and validation (10MB limit)

**Staff Interface**
- `messages.tsx` - staff message management
  - Thread list and message view
  - File upload functionality (10MB limit)
  - Voice recording capability
  - Attachment display in messages

**Document Management**
- `DocumentFolderView.tsx` - folder/document browser
- `DocumentPreviewDialog.tsx` - file preview modal
- `DocumentUploadDialog.tsx` - upload interface
- `ObjectUploader.tsx` - generic file upload component

---

## Feature Requirements

### 1. Client Portal User File Uploads

#### 1.1 File Type Support
**Requirement**: Support the following file types in portal messages:
- **Images**: PNG, JPEG, JPG
- **Documents**: PDF
- **Future considerations**: DOCX, XLSX, CSV

**Implementation**:
- Update allowed file types in `PortalThreadDetail.tsx`
- Validate file types on both client and server
- Add MIME type validation in upload endpoint

**Files to Modify**:
- `client/src/pages/portal/PortalThreadDetail.tsx` - Add file type constants
- `server/routes.ts` - Add validation in `/api/portal/attachments/upload-url`
- `server/storage.ts` - Document file type validation logic

#### 1.2 File Size Limits
**Current**: 10MB limit already implemented in portal
**Requirement**: Maintain 10MB limit with clear error messaging

**Implementation**:
- Keep existing validation in `PortalThreadDetail.tsx` (lines 243-257)
- Add server-side validation as backup
- Display file size in user-friendly format (KB/MB)

**Files to Modify**:
- `server/routes.ts` - Add server-side size validation
- `client/src/pages/portal/PortalThreadDetail.tsx` - Enhance error messages

#### 1.3 Upload Flow
**Current Flow** (already partially implemented):
1. User selects files via file input
2. Files validated client-side (size, type)
3. Request presigned URL from `/api/portal/attachments/upload-url`
4. Upload file directly to object storage using presigned URL
5. Send message with attachment metadata

**Enhancement Requirements**:
- Add upload progress indicator
- Support multiple file selection (up to 5 files per message)
- Show file preview before sending
- Allow removing files before sending

**Files to Modify**:
- `client/src/pages/portal/PortalThreadDetail.tsx`:
  - Enhance `handleFileSelect()` function
  - Add upload progress tracking
  - Add file preview UI
  - Update `uploadFile()` to track progress

#### 1.4 In-Chat Preview
**Requirement**: Display file previews inline in message thread

**Image Preview**:
- Show thumbnail in message bubble
- Click to open full-size modal
- Support zoom/pan in modal

**PDF Preview**:
- Show PDF icon with filename
- Click to open in browser preview
- Add download button

**Implementation**:
- Create `AttachmentPreview` component
- Use existing `DocumentPreviewDialog.tsx` as reference
- Add image loading states
- PDF preview using browser's native viewer

**Files to Create/Modify**:
- `client/src/components/AttachmentPreview.tsx` (new)
- `client/src/pages/portal/PortalThreadDetail.tsx` - integrate preview
- `client/src/pages/messages.tsx` - integrate preview

### 2. Voice Note Recording

#### 2.1 Recording Capability
**Current**: Voice recording already implemented in `PortalThreadDetail.tsx`
- Uses MediaRecorder API
- Records in WebM/MP3 format
- Stores as Blob with timestamp

**Enhancement Requirements**:
- Visual recording indicator (animated icon)
- Recording duration display
- Preview playback before sending
- Option to re-record
- Save as `.webm` or `.mp3` file

**Files to Modify**:
- `client/src/pages/portal/PortalThreadDetail.tsx`:
  - Enhance recording UI (lines 653-730)
  - Add waveform visualization (optional)
  - Improve recording controls

#### 2.2 Voice Note Upload
**Implementation**:
1. Convert Blob to File object
2. Generate filename: `voice-note-${timestamp}.webm`
3. Upload using same flow as regular files
4. Store with `fileType: 'audio/webm'` or `'audio/mpeg'`

**Files to Modify**:
- `client/src/pages/portal/PortalThreadDetail.tsx`:
  - Update `handleSendMessage()` to handle voice notes
  - Add voice note to attachments array

#### 2.3 Voice Note Playback
**Requirement**: In-line audio player in message thread

**Features**:
- Play/pause button
- Progress bar
- Duration display
- Volume control
- Download option

**Files to Create/Modify**:
- `client/src/components/VoiceNotePlayer.tsx` (new)
- `client/src/pages/portal/PortalThreadDetail.tsx` - integrate player
- `client/src/pages/messages.tsx` - integrate player

### 3. Staff User Interface

#### 3.1 Viewing Attachments in /messages Page
**Current**: Staff messages page already displays attachments
**Location**: `client/src/pages/messages.tsx`

**Enhancement Requirements**:
- Match portal preview functionality
- Show attachment thumbnails
- Support image preview modal
- Support PDF preview
- Display voice note player
- Show file metadata (size, upload date)

**Files to Modify**:
- `client/src/pages/messages.tsx`:
  - Enhance attachment display (lines 400-500)
  - Add preview modals
  - Integrate `AttachmentPreview` component

#### 3.2 Staff File Upload
**Current**: Upload functionality exists (lines 263-296)

**Enhancement Requirements**:
- Match portal upload experience
- Support drag-and-drop
- Multiple file selection
- Upload progress indicators
- File previews before sending

**Files to Modify**:
- `client/src/pages/messages.tsx`:
  - Add drag-and-drop zone
  - Enhance file selection UI
  - Add upload progress tracking

#### 3.3 Staff Voice Recording
**Current**: Voice recording exists in messages.tsx

**Enhancement Requirements**:
- Match portal recording experience
- Same controls and preview
- Same file format

**Files to Modify**:
- `client/src/pages/messages.tsx` - enhance recording UI

### 4. Client Detail Page Integration

#### 4.1 Documents Tab
**Current**: `DocumentFolderView` component displays client documents
**Location**: `client/src/components/DocumentFolderView.tsx`

**Requirement**: Message attachments should automatically appear in Documents tab

**Implementation**:

**Option A: Automatic Document Creation** (Recommended)
- When message with attachment is sent, automatically create document record
- Link document to client via `clientId`
- Link to portal user via `clientPortalUserId`
- Store in special "Message Attachments" folder (auto-created)
- Add `messageId` and `threadId` metadata to track source

**Option B: Manual Document Saving**
- Add "Save to Documents" button on each attachment
- Staff/client can choose to save specific attachments
- Prompt for folder selection

**Database Changes Required**:
- Add `messageId` field to `documents` table (optional, for reference)
- Add `threadId` field to `documents` table (optional, for reference)
- Add `source` field to track upload source ('message', 'direct_upload', 'task')

**Files to Modify**:
- `shared/schema.ts`:
  ```typescript
  export const documents = pgTable("documents", {
    // ... existing fields ...
    source: varchar("source").default('direct_upload'), // 'message', 'direct_upload', 'task'
    messageId: varchar("message_id").references(() => messages.id, { onDelete: 'set null' }),
    threadId: varchar("thread_id").references(() => messageThreads.id, { onDelete: 'set null' }),
  });
  ```
- `server/storage.ts`:
  - Add `createDocumentFromAttachment()` method
  - Update `IStorage` interface
- `server/routes.ts`:
  - Update message send endpoints to auto-create documents
  - Add logic in `/api/portal/threads/:threadId/messages`
  - Add logic in `/api/internal/messages/threads/:threadId/messages`

**Automatic Folder Creation**:
- Check if "Message Attachments" folder exists for client
- Create if not exists
- Store folder ID in document record

**Files to Modify**:
- `server/storage.ts`:
  ```typescript
  async getOrCreateMessageAttachmentsFolder(clientId: string): Promise<DocumentFolder> {
    // Check for existing folder
    // Create if not exists
    // Return folder
  }
  ```

#### 4.2 Communications Tab
**Current**: Shows logged communications and message threads
**Location**: `client/src/pages/client-detail.tsx` (Communications tab)

**Requirement**: Message threads should appear in Communications tab

**Current Implementation**:
- Already fetches message threads via `useQuery`
- Displays threads with status and metadata
- Shows unread counts
- Allows selecting thread to view messages

**Enhancement Requirements**:
- Show attachment indicators on threads (e.g., "📎 3 attachments")
- Display voice note indicator (e.g., "🎤 1 voice note")
- Quick preview of attachments in thread list
- Filter threads by "has attachments"

**Files to Modify**:
- `client/src/pages/client-detail.tsx`:
  - Add attachment count to thread display
  - Add attachment filter option
  - Enhance thread preview UI

**Storage Layer Changes**:
- `server/storage.ts`:
  - Update `getMessageThreadsWithUnreadCount()` to include attachment counts
  - Add attachment metadata to thread query results

### 5. Document Download & Access Control

#### 5.1 Download Functionality
**Current**: Download implemented in `DocumentFolderView.tsx`

**Requirements**:
- Same download flow for message attachments
- Generate presigned download URLs
- Track download events (optional, for audit)

**Files to Modify**:
- `server/routes.ts`:
  - Add `/api/messages/attachments/:objectPath/download` endpoint
  - Add `/api/portal/attachments/:objectPath/download` endpoint
- `client/src/components/AttachmentPreview.tsx`:
  - Add download button
  - Handle download click

#### 5.2 Access Control
**Requirements**:
- Portal users can only access their own client's attachments
- Staff users can access all attachments
- Validate access on every download request

**Implementation**:
- Use existing `ObjectAclPolicy` system
- Check client association before generating download URL
- Set appropriate ACL when uploading attachments

**Files to Modify**:
- `server/objectAcl.ts`:
  - Define access rules for message attachments
- `server/routes.ts`:
  - Add access validation in download endpoints

---

## Future Scenarios

### 1. Task-Based Document Uploads

**Use Case**: Staff creates task for client to upload specific documents (e.g., bank statement)

**Requirements**:
- Task model links to client
- Task can specify required document types
- Client receives notification to upload
- Upload interface accessible from portal tasks page
- Uploaded documents linked to task
- Task marked complete when documents uploaded

**Database Changes Needed**:
- Add `tasks` table or extend `projects` table:
  ```typescript
  export const clientTasks = pgTable("client_tasks", {
    id: varchar("id").primaryKey(),
    clientId: varchar("client_id").notNull(),
    title: varchar("title").notNull(),
    description: text("description"),
    taskType: varchar("task_type"), // 'document_upload', 'form_completion', etc.
    requiredDocumentTypes: text("required_document_types").array(), // ['bank_statement', 'invoice', etc.]
    status: varchar("status").default('pending'), // 'pending', 'in_progress', 'completed'
    dueDate: timestamp("due_date"),
    completedAt: timestamp("completed_at"),
    assignedBy: varchar("assigned_by").references(() => users.id),
    createdAt: timestamp("created_at").defaultNow(),
  });
  ```

**Files to Create**:
- `client/src/pages/portal/PortalTaskDetail.tsx` - task view with upload
- `client/src/components/TaskDocumentUpload.tsx` - specialized upload UI
- `server/routes.ts` - add task-related endpoints

**Integration Points**:
- Link uploaded documents to task via `taskId` field in documents table
- Show task completion status in client detail page
- Send notification when task created/updated
- Allow staff to review uploaded documents

### 2. Bulk Document Uploads

**Use Case**: Client needs to upload multiple documents at once (e.g., monthly receipts)

**Requirements**:
- Support selecting multiple files (10+)
- Batch upload with progress tracking
- Organize into folder automatically
- Add metadata/tags to batch

**Implementation Considerations**:
- Extend current upload limit
- Add batch progress UI
- Create temporary upload session
- Allow canceling batch upload

### 3. Document Request Workflow

**Use Case**: Staff requests specific document from client, client responds

**Requirements**:
- Staff creates document request
- Request appears in client portal
- Client uploads in response
- Staff gets notification
- Document linked to request

**Similar to task-based uploads but lighter weight**

### 4. Document Versioning

**Use Case**: Client uploads updated version of existing document

**Requirements**:
- Track document versions
- Show version history
- Allow reverting to previous version
- Compare versions (for some file types)

**Database Changes**:
- Add `documentVersions` table
- Link to parent document
- Track version number and upload date

### 5. Document Sharing with Third Parties

**Use Case**: Share specific documents with accountant, lawyer, etc.

**Requirements**:
- Generate secure sharing link
- Set expiration on links
- Track who accessed documents
- Revoke access anytime

**Implementation**:
- Add `documentShares` table
- Generate unique tokens
- Access control via token validation

---

## API Endpoints Summary

### Required New Endpoints

#### Portal User Endpoints
```
POST /api/portal/threads/:threadId/messages
  - Enhanced to auto-create document records
  - Body: { content, attachments[] }
  
POST /api/portal/attachments/upload-url
  - Enhanced validation
  - Body: { fileName, fileType, fileSize }
  
GET /api/portal/attachments/:objectPath/preview
  - Generate presigned preview URL
  
GET /api/portal/attachments/:objectPath/download
  - Generate presigned download URL
```

#### Staff User Endpoints
```
POST /api/internal/messages/threads/:threadId/messages
  - Enhanced to auto-create document records
  - Body: { content, attachments[] }
  
POST /api/internal/messages/attachments/upload-url
  - Enhanced validation
  - Body: { fileName, fileType, fileSize }
  
GET /api/internal/messages/attachments/:objectPath/preview
  - Generate presigned preview URL
  
GET /api/internal/messages/attachments/:objectPath/download
  - Generate presigned download URL
```

#### Document Management
```
GET /api/clients/:clientId/documents
  - Enhanced to include message attachment source
  - Query params: ?source=message (filter)
  
POST /api/documents/link-to-message
  - Manually link existing document to message
  - Body: { documentId, messageId }
```

---

## Component Architecture

### New Components to Create

#### 1. AttachmentPreview Component
**Location**: `client/src/components/AttachmentPreview.tsx`

**Props**:
```typescript
interface AttachmentPreviewProps {
  attachment: {
    fileName: string;
    fileType: string;
    fileSize: number;
    objectPath: string;
  };
  onDownload?: () => void;
  showDownload?: boolean;
  compact?: boolean; // For inline display vs modal
}
```

**Features**:
- Detect file type and render appropriate preview
- Image: thumbnail with lightbox
- PDF: icon with click-to-preview
- Audio: inline player
- Other: file icon with download

#### 2. VoiceNotePlayer Component
**Location**: `client/src/components/VoiceNotePlayer.tsx`

**Props**:
```typescript
interface VoiceNotePlayerProps {
  audioUrl: string;
  fileName: string;
  duration?: number;
  onDownload?: () => void;
}
```

**Features**:
- Play/pause control
- Seek bar with progress
- Duration display
- Playback speed control (1x, 1.5x, 2x)
- Download button

#### 3. FileUploadZone Component
**Location**: `client/src/components/FileUploadZone.tsx`

**Props**:
```typescript
interface FileUploadZoneProps {
  onFilesSelected: (files: File[]) => void;
  maxFiles?: number;
  maxSizeBytes?: number;
  allowedTypes?: string[];
  showPreview?: boolean;
}
```

**Features**:
- Drag-and-drop zone
- Click to browse files
- File type and size validation
- Preview selected files
- Remove files before upload
- Progress indicators

#### 4. AttachmentList Component
**Location**: `client/src/components/AttachmentList.tsx`

**Props**:
```typescript
interface AttachmentListProps {
  attachments: Attachment[];
  onPreview?: (attachment: Attachment) => void;
  onDownload?: (attachment: Attachment) => void;
  onRemove?: (index: number) => void; // For pre-upload list
  compact?: boolean;
}
```

**Features**:
- Display list of attachments
- Show file icons/thumbnails
- File size display
- Action buttons (preview, download, remove)

---

## Storage Layer Updates

### IStorage Interface Extensions

**Location**: `server/storage.ts`

```typescript
interface IStorage {
  // ... existing methods ...
  
  // Message attachment methods
  createDocumentFromAttachment(data: {
    clientId: string;
    clientPortalUserId: string;
    fileName: string;
    fileType: string;
    fileSize: number;
    objectPath: string;
    messageId: string;
    threadId: string;
  }): Promise<Document>;
  
  getOrCreateMessageAttachmentsFolder(clientId: string): Promise<DocumentFolder>;
  
  getDocumentsByMessageId(messageId: string): Promise<Document[]>;
  
  getDocumentsByThreadId(threadId: string): Promise<Document[]>;
  
  // Enhanced thread queries
  getMessageThreadsWithAttachmentCounts(clientId: string): Promise<ThreadWithMetadata[]>;
  
  // Attachment access validation
  validateAttachmentAccess(objectPath: string, userId: string, userType: 'staff' | 'portal'): Promise<boolean>;
}
```

### Implementation Details

**DbStorage Class Methods**:
```typescript
async createDocumentFromAttachment(data) {
  // 1. Get or create "Message Attachments" folder
  const folder = await this.getOrCreateMessageAttachmentsFolder(data.clientId);
  
  // 2. Create document record
  const [document] = await this.db.insert(documents).values({
    clientId: data.clientId,
    clientPortalUserId: data.clientPortalUserId,
    folderId: folder.id,
    fileName: data.fileName,
    fileType: data.fileType,
    fileSize: data.fileSize,
    objectPath: data.objectPath,
    source: 'message',
    messageId: data.messageId,
    threadId: data.threadId,
    uploadedAt: new Date(),
  }).returning();
  
  return document;
}

async getOrCreateMessageAttachmentsFolder(clientId: string) {
  // Check for existing folder
  const existing = await this.db.query.documentFolders.findFirst({
    where: and(
      eq(documentFolders.clientId, clientId),
      eq(documentFolders.name, 'Message Attachments')
    ),
  });
  
  if (existing) return existing;
  
  // Create new folder
  const [folder] = await this.db.insert(documentFolders).values({
    clientId,
    name: 'Message Attachments',
    description: 'Documents uploaded via messages',
  }).returning();
  
  return folder;
}
```

---

## File Upload Flow Diagram

### Client Portal Upload Flow

```
┌─────────────────┐
│ User selects    │
│ file(s) in UI   │
└────────┬────────┘
         │
         ▼
┌─────────────────────────┐
│ Client-side validation  │
│ - File type             │
│ - File size (10MB)      │
│ - File count (max 5)    │
└────────┬────────────────┘
         │
         ▼
┌──────────────────────────────┐
│ Request presigned URL        │
│ POST /api/portal/            │
│   attachments/upload-url     │
│ Body: {fileName, fileType}   │
└────────┬─────────────────────┘
         │
         ▼
┌─────────────────────────────┐
│ Server validates & generates│
│ presigned URL via GCS       │
│ Returns: {url, objectPath}  │
└────────┬────────────────────┘
         │
         ▼
┌─────────────────────────────┐
│ Upload file directly to GCS │
│ PUT to presigned URL        │
│ Progress tracking           │
└────────┬────────────────────┘
         │
         ▼
┌──────────────────────────────┐
│ Send message with metadata   │
│ POST /api/portal/threads/    │
│   :threadId/messages         │
│ Body: {                      │
│   content,                   │
│   attachments: [{            │
│     fileName,                │
│     fileType,                │
│     fileSize,                │
│     objectPath               │
│   }]                         │
│ }                            │
└────────┬─────────────────────┘
         │
         ▼
┌──────────────────────────────┐
│ Server creates message       │
│ AND creates document record  │
│ in "Message Attachments"     │
│ folder automatically         │
└────────┬─────────────────────┘
         │
         ▼
┌──────────────────────────────┐
│ Response sent                │
│ UI updates message thread    │
│ Attachment appears inline    │
└──────────────────────────────┘
```

---

## Database Schema Changes

### 1. Update Documents Table

```typescript
// shared/schema.ts

export const documents = pgTable("documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  clientPortalUserId: varchar("client_portal_user_id").references(() => clientPortalUsers.id, { onDelete: "set null" }),
  folderId: varchar("folder_id").references(() => documentFolders.id, { onDelete: "set null" }),
  fileName: varchar("file_name").notNull(),
  fileType: varchar("file_type").notNull(),
  fileSize: integer("file_size").notNull(),
  objectPath: varchar("object_path").notNull(),
  uploadedAt: timestamp("uploaded_at").notNull().defaultNow(),
  
  // NEW FIELDS
  source: varchar("source").notNull().default('direct_upload'), // 'message', 'direct_upload', 'task'
  messageId: varchar("message_id").references(() => messages.id, { onDelete: "set null" }),
  threadId: varchar("thread_id").references(() => messageThreads.id, { onDelete: "set null" }),
  taskId: varchar("task_id").references(() => projects.id, { onDelete: "set null" }), // For future task uploads
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  clientIdIdx: index("documents_client_id_idx").on(table.clientId),
  folderIdIdx: index("documents_folder_id_idx").on(table.folderId),
  messageIdIdx: index("documents_message_id_idx").on(table.messageId), // NEW
  threadIdIdx: index("documents_thread_id_idx").on(table.threadId), // NEW
  sourceIdx: index("documents_source_idx").on(table.source), // NEW
}));
```

### 2. Migration Strategy

**Step 1**: Add new columns
```sql
-- Add source column with default
ALTER TABLE documents 
ADD COLUMN source VARCHAR NOT NULL DEFAULT 'direct_upload';

-- Add message reference columns
ALTER TABLE documents 
ADD COLUMN message_id VARCHAR REFERENCES messages(id) ON DELETE SET NULL;

ALTER TABLE documents 
ADD COLUMN thread_id VARCHAR REFERENCES message_threads(id) ON DELETE SET NULL;

-- Add task reference column (for future)
ALTER TABLE documents 
ADD COLUMN task_id VARCHAR REFERENCES projects(id) ON DELETE SET NULL;

-- Add indexes
CREATE INDEX documents_message_id_idx ON documents(message_id);
CREATE INDEX documents_thread_id_idx ON documents(thread_id);
CREATE INDEX documents_source_idx ON documents(source);
```

**Step 2**: Update existing data (if needed)
```sql
-- No migration needed for existing data
-- All existing documents will have source='direct_upload'
```

**Step 3**: Update Drizzle schema and push
```bash
npm run db:push
```

---

## Validation & Security

### 1. File Type Validation

**Allowed Types**:
```typescript
const ALLOWED_ATTACHMENT_TYPES = [
  // Images
  'image/png',
  'image/jpeg',
  'image/jpg',
  
  // Documents
  'application/pdf',
  
  // Audio (voice notes)
  'audio/webm',
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
];
```

**Validation Points**:
1. Client-side: Before upload request
2. Server-side: When generating presigned URL
3. Storage-side: Object ACL policies

### 2. File Size Limits

**Limits**:
- Individual file: 10MB
- Total per message: 50MB (5 files × 10MB)
- Voice notes: 5MB max (roughly 5 minutes at medium quality)

**Validation**:
```typescript
// Client-side
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_VOICE_NOTE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_FILES_PER_MESSAGE = 5;
const MAX_TOTAL_SIZE = 50 * 1024 * 1024; // 50MB

// Server-side validation in upload-url endpoint
if (fileSize > MAX_FILE_SIZE) {
  return res.status(400).json({ 
    message: `File size exceeds maximum of ${MAX_FILE_SIZE / 1024 / 1024}MB` 
  });
}
```

### 3. Access Control

**Portal User Access**:
- Can only upload to their own client's messages
- Can only download attachments from their own client's messages
- Validate `clientId` matches authenticated portal user

**Staff User Access**:
- Can upload to any message thread
- Can download any attachment
- Role-based filtering (optional)

**Implementation**:
```typescript
// In download endpoint
async function validateAttachmentAccess(
  objectPath: string, 
  userId: string, 
  userType: 'staff' | 'portal'
): Promise<boolean> {
  // Get message from attachment metadata
  const message = await storage.getMessageByAttachmentPath(objectPath);
  
  if (!message) return false;
  
  if (userType === 'staff') {
    return true; // Staff can access all
  }
  
  // Portal user - check client match
  const portalUser = await storage.getClientPortalUserById(userId);
  const thread = await storage.getMessageThreadById(message.threadId);
  
  return thread.clientId === portalUser?.clientId;
}
```

### 4. Malware Scanning

**Recommendation**: Implement virus scanning for uploaded files

**Options**:
1. Use Cloud Storage's built-in scanning (if available)
2. Integrate ClamAV or similar
3. Use third-party API (VirusTotal, etc.)

**Implementation Point**: After upload, before making available

---

## Testing Checklist

### Unit Tests

**File Upload**:
- [ ] Validate file type filtering
- [ ] Validate file size limits
- [ ] Test presigned URL generation
- [ ] Test upload error handling

**Voice Notes**:
- [ ] Test recording start/stop
- [ ] Test audio blob conversion
- [ ] Test upload as file

**Document Creation**:
- [ ] Test auto-folder creation
- [ ] Test document record creation
- [ ] Test message-document linking

**Access Control**:
- [ ] Test portal user can only access own client attachments
- [ ] Test staff can access all attachments
- [ ] Test invalid access denied

### Integration Tests

**Portal User Flow**:
- [ ] Upload image in message
- [ ] Upload PDF in message
- [ ] Record and send voice note
- [ ] View attachment preview
- [ ] Download attachment

**Staff User Flow**:
- [ ] Upload file in staff message interface
- [ ] View portal user's uploaded attachments
- [ ] Reply with attachment
- [ ] Download attachment

**Document Integration**:
- [ ] Message attachment appears in Documents tab
- [ ] Attachment shows correct metadata
- [ ] Attachment in "Message Attachments" folder
- [ ] Can access from Documents tab

**Communications Tab**:
- [ ] Message thread shows in Communications
- [ ] Attachment count displayed
- [ ] Can view thread from Communications
- [ ] Unread counts update correctly

### End-to-End Tests

**Scenario 1**: Client uploads bank statement via message
1. Client logs into portal
2. Opens message thread
3. Selects PDF file
4. Sends message with attachment
5. Staff views message and downloads PDF
6. PDF appears in client's Documents tab
7. Staff can view from both Messages and Documents

**Scenario 2**: Staff requests document via message
1. Staff sends message requesting document
2. Client receives notification
3. Client replies with attachment
4. Staff views and downloads
5. Document saved in client folder

**Scenario 3**: Voice note communication
1. Client records voice note
2. Plays back to verify
3. Sends in message
4. Staff receives and plays voice note
5. Staff replies with voice note
6. Both voice notes downloadable

---

## Performance Considerations

### 1. File Upload Optimization

**Chunked Upload** (for large files):
- Split files >5MB into chunks
- Upload chunks in parallel
- Resume failed uploads

**Compression**:
- Compress images before upload (client-side)
- Maintain original for download
- Use WebP format for better compression

### 2. Preview Generation

**Image Thumbnails**:
- Generate thumbnails server-side
- Store in separate object path
- Cache thumbnail URLs

**PDF Previews**:
- Generate first page image
- Store as thumbnail
- Use for list views

### 3. Caching Strategy

**Browser Caching**:
- Cache downloaded files
- Cache presigned URLs (with expiry)
- Use service workers for offline access

**CDN**:
- Serve attachments via CDN
- Cache frequently accessed files
- Set appropriate cache headers

### 4. Database Query Optimization

**Indexes**:
- Add indexes on `messageId`, `threadId`, `source`
- Composite index on `(clientId, source)` for document filtering
- Index on `objectPath` for lookups

**Query Optimization**:
- Batch fetch attachments with messages
- Use pagination for document lists
- Limit attachment metadata in list views

---

## Monitoring & Analytics

### 1. Metrics to Track

**Upload Metrics**:
- Total uploads per day/week/month
- Upload success/failure rates
- Average file size
- Popular file types
- Upload duration

**Usage Metrics**:
- Messages with attachments (%)
- Voice notes sent
- Downloads per attachment
- Preview interactions

**Performance Metrics**:
- Upload time (by file size)
- Download time
- Preview generation time
- Storage usage by client

### 2. Error Tracking

**Upload Errors**:
- File too large
- Invalid file type
- Upload timeout
- Network failures
- Presigned URL expiry

**Access Errors**:
- Unauthorized access attempts
- Missing files
- Corrupted files

### 3. Logging

**Log Events**:
```typescript
// Upload started
logger.info('Attachment upload started', {
  userId,
  clientId,
  fileName,
  fileSize,
  fileType,
});

// Upload completed
logger.info('Attachment upload completed', {
  objectPath,
  duration,
});

// Document created
logger.info('Document created from attachment', {
  documentId,
  messageId,
  threadId,
});

// Download requested
logger.info('Attachment downloaded', {
  objectPath,
  userId,
  userType,
});
```

---

## Implementation Phases

### Phase 1: Core File Attachments (Week 1-2)
**Scope**: Basic file upload and display

**Tasks**:
1. Update database schema (add source, messageId, threadId fields)
2. Implement auto-document creation on message send
3. Create AttachmentPreview component
4. Enhance portal message UI for file upload
5. Enhance staff message UI for file upload
6. Add file preview in message threads
7. Implement download functionality

**Deliverables**:
- Portal users can attach images/PDFs to messages
- Staff can view and download attachments
- Attachments appear in Documents tab

### Phase 2: Voice Notes (Week 3)
**Scope**: Voice recording and playback

**Tasks**:
1. Create VoiceNotePlayer component
2. Enhance recording UI in portal
3. Enhance recording UI in staff interface
4. Implement voice note upload
5. Add voice note preview/playback
6. Add voice note download

**Deliverables**:
- Portal users can record and send voice notes
- Staff can listen to voice notes
- Voice notes downloadable

### Phase 3: Document Integration (Week 4)
**Scope**: Enhanced document management

**Tasks**:
1. Auto-create "Message Attachments" folder
2. Display attachment counts in Communications tab
3. Add filter by attachments in Documents tab
4. Show message source in document metadata
5. Link from Documents to original message

**Deliverables**:
- Seamless integration between Messages and Documents
- Easy navigation between contexts
- Clear document provenance

### Phase 4: Polish & Optimization (Week 5)
**Scope**: UX improvements and performance

**Tasks**:
1. Add drag-and-drop upload
2. Improve upload progress indicators
3. Add thumbnail generation
4. Implement caching strategy
5. Add error recovery
6. Comprehensive testing

**Deliverables**:
- Polished upload experience
- Fast preview loading
- Robust error handling

### Phase 5: Future Features (Backlog)
**Scope**: Advanced features

**Tasks**:
- Task-based document uploads
- Document request workflow
- Bulk upload support
- Document versioning
- Third-party sharing

**Deliverables**:
- Advanced document workflows
- Enhanced collaboration features

---

## Code Examples

### Example 1: Enhanced Message Send (Portal)

```typescript
// client/src/pages/portal/PortalThreadDetail.tsx

const handleSendMessage = async () => {
  if (!newMessage.trim() && selectedFiles.length === 0 && !recordedAudio) {
    return;
  }
  
  try {
    setUploading(true);
    let attachments: Attachment[] = [];
    
    // Upload regular files
    if (selectedFiles.length > 0) {
      const fileAttachments = await uploadFiles(selectedFiles.map(sf => sf.file));
      attachments.push(...fileAttachments);
    }
    
    // Upload voice note if present
    if (recordedAudio) {
      const voiceFile = new File(
        [recordedAudio],
        `voice-note-${Date.now()}.webm`,
        { type: 'audio/webm' }
      );
      const voiceAttachment = await uploadFiles([voiceFile]);
      attachments.push(...voiceAttachment);
      
      // Clear voice note after upload
      setRecordedAudio(null);
      setAudioUrl(null);
    }
    
    // Send message with attachments
    await sendMessageMutation.mutateAsync({
      content: newMessage.trim() || '(Attachment)',
      attachments: attachments.length > 0 ? attachments : undefined,
    });
    
    // Clear form
    setNewMessage('');
    setSelectedFiles([]);
    
  } catch (error) {
    toast({
      title: "Error",
      description: error.message || "Failed to send message",
      variant: "destructive",
    });
  } finally {
    setUploading(false);
  }
};
```

### Example 2: Auto-Create Document Record (Server)

```typescript
// server/routes.ts

app.post('/api/portal/threads/:threadId/messages', authenticatePortal, async (req: any, res) => {
  try {
    const { threadId } = req.params;
    const { content, attachments } = req.body;
    const clientId = req.portalUser!.clientId;
    const portalUserId = req.portalUser!.id;
    
    // Validate thread access
    const thread = await storage.getMessageThreadById(threadId);
    if (!thread || thread.clientId !== clientId) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    // Create message
    const message = await storage.createMessage({
      threadId,
      content,
      clientPortalUserId: portalUserId,
      attachments,
      isReadByStaff: false,
      isReadByClient: true,
    });
    
    // Auto-create document records for attachments
    if (attachments && attachments.length > 0) {
      for (const attachment of attachments) {
        await storage.createDocumentFromAttachment({
          clientId,
          clientPortalUserId: portalUserId,
          fileName: attachment.fileName,
          fileType: attachment.fileType,
          fileSize: attachment.fileSize,
          objectPath: attachment.objectPath,
          messageId: message.id,
          threadId: thread.id,
        });
      }
    }
    
    // Update thread last message time
    await storage.updateMessageThread(threadId, {
      lastMessageAt: new Date(),
    });
    
    res.status(201).json(message);
  } catch (error) {
    console.error('Error creating message:', error);
    res.status(500).json({ message: 'Failed to create message' });
  }
});
```

### Example 3: Attachment Preview Component

```typescript
// client/src/components/AttachmentPreview.tsx

import { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, Eye, FileText, Image as ImageIcon } from 'lucide-react';
import VoiceNotePlayer from './VoiceNotePlayer';

interface AttachmentPreviewProps {
  attachment: {
    fileName: string;
    fileType: string;
    fileSize: number;
    objectPath: string;
  };
  onDownload?: () => void;
  compact?: boolean;
}

export function AttachmentPreview({ attachment, onDownload, compact = false }: AttachmentPreviewProps) {
  const [showPreview, setShowPreview] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  
  const isImage = attachment.fileType.startsWith('image/');
  const isPDF = attachment.fileType === 'application/pdf';
  const isAudio = attachment.fileType.startsWith('audio/');
  
  const handlePreview = async () => {
    if (isImage || isPDF) {
      // Get presigned URL for preview
      const response = await fetch(`/api/portal/attachments/${attachment.objectPath}/preview`);
      const data = await response.json();
      setPreviewUrl(data.url);
      setShowPreview(true);
    }
  };
  
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };
  
  if (isAudio) {
    return (
      <VoiceNotePlayer
        audioUrl={`/api/portal/attachments/${attachment.objectPath}/preview`}
        fileName={attachment.fileName}
        onDownload={onDownload}
      />
    );
  }
  
  if (compact) {
    return (
      <div className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-800 rounded">
        {isImage ? (
          <ImageIcon className="w-4 h-4 text-blue-500" />
        ) : (
          <FileText className="w-4 h-4 text-gray-500" />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{attachment.fileName}</p>
          <p className="text-xs text-gray-500">{formatFileSize(attachment.fileSize)}</p>
        </div>
        <div className="flex gap-1">
          {(isImage || isPDF) && (
            <Button
              size="sm"
              variant="ghost"
              onClick={handlePreview}
              data-testid={`button-preview-${attachment.fileName}`}
            >
              <Eye className="w-4 h-4" />
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={onDownload}
            data-testid={`button-download-${attachment.fileName}`}
          >
            <Download className="w-4 h-4" />
          </Button>
        </div>
      </div>
    );
  }
  
  return (
    <>
      <div className="border rounded-lg p-4">
        {isImage && (
          <img
            src={`/api/portal/attachments/${attachment.objectPath}/preview`}
            alt={attachment.fileName}
            className="max-w-full h-auto rounded cursor-pointer"
            onClick={handlePreview}
          />
        )}
        
        {isPDF && (
          <div className="flex items-center gap-3">
            <FileText className="w-12 h-12 text-red-500" />
            <div className="flex-1">
              <p className="font-medium">{attachment.fileName}</p>
              <p className="text-sm text-gray-500">{formatFileSize(attachment.fileSize)}</p>
            </div>
            <Button onClick={handlePreview}>
              <Eye className="w-4 h-4 mr-2" />
              Preview
            </Button>
          </div>
        )}
        
        {onDownload && (
          <Button
            variant="outline"
            onClick={onDownload}
            className="mt-2"
            data-testid="button-download-attachment"
          >
            <Download className="w-4 h-4 mr-2" />
            Download
          </Button>
        )}
      </div>
      
      {/* Preview Modal */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-4xl">
          {isImage && previewUrl && (
            <img src={previewUrl} alt={attachment.fileName} className="w-full h-auto" />
          )}
          {isPDF && previewUrl && (
            <iframe
              src={previewUrl}
              className="w-full h-[80vh]"
              title={attachment.fileName}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
```

---

## Security Best Practices

### 1. Input Validation
- Validate file types on both client and server
- Check file extensions AND MIME types
- Verify file size limits
- Sanitize filenames (remove special characters)

### 2. Upload Security
- Use presigned URLs with short expiry (15 minutes)
- Validate user permissions before generating URL
- Set appropriate CORS headers
- Limit concurrent uploads per user

### 3. Download Security
- Generate one-time download URLs
- Set expiry on download links (1 hour)
- Validate user access before generating link
- Log all download attempts

### 4. Storage Security
- Encrypt files at rest
- Use private buckets (not public)
- Set appropriate IAM permissions
- Regular security audits

### 5. Content Security
- Scan uploads for malware
- Block executable file types
- Strip metadata from images (EXIF data)
- Validate file contents match declared type

---

## Deployment Checklist

### Pre-Deployment
- [ ] Run database migration (add new fields)
- [ ] Update environment variables (if needed)
- [ ] Run full test suite
- [ ] Performance testing with large files
- [ ] Security audit of upload endpoints
- [ ] Review access control logic
- [ ] Check object storage quotas/limits

### Deployment
- [ ] Deploy database changes
- [ ] Deploy backend code
- [ ] Deploy frontend code
- [ ] Verify object storage connectivity
- [ ] Test in staging environment
- [ ] Monitor error rates
- [ ] Check upload/download functionality

### Post-Deployment
- [ ] Monitor upload success rates
- [ ] Check storage usage
- [ ] Verify auto-document creation
- [ ] Test from multiple devices
- [ ] Collect user feedback
- [ ] Monitor performance metrics
- [ ] Review security logs

---

## Documentation Updates Needed

### User Documentation
1. **Client Portal Guide**:
   - How to attach files to messages
   - Supported file types and size limits
   - How to record voice notes
   - How to view and download attachments

2. **Staff User Guide**:
   - Uploading files in messages
   - Viewing client attachments
   - Accessing documents from messages
   - Using voice notes

### Technical Documentation
1. **API Documentation**:
   - New endpoints for attachments
   - Request/response formats
   - Authentication requirements
   - Error codes

2. **Developer Guide**:
   - File upload flow
   - Component architecture
   - Database schema
   - Security considerations

---

## Success Metrics

### Adoption Metrics
- % of messages with attachments (target: 30%)
- % of clients using file upload (target: 60%)
- Voice notes sent per week (baseline to track)
- Documents uploaded via messages vs direct upload

### Performance Metrics
- Average upload time (target: <5s for 5MB file)
- Upload success rate (target: >95%)
- Preview load time (target: <2s)
- Document auto-creation success rate (target: 100%)

### User Satisfaction
- Support tickets related to file uploads (target: decrease)
- User feedback scores (target: 4.5/5)
- Feature usage retention (target: >80% after 30 days)

---

## Appendix

### A. File Type MIME Type Reference

```typescript
const FILE_TYPE_MAPPINGS = {
  // Images
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  
  // Documents
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  
  // Audio
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.webm': 'audio/webm',
  '.m4a': 'audio/mp4',
};
```

### B. Error Code Reference

```typescript
const ERROR_CODES = {
  // Upload errors
  'UPLOAD_001': 'File too large',
  'UPLOAD_002': 'Invalid file type',
  'UPLOAD_003': 'Upload timeout',
  'UPLOAD_004': 'Too many files',
  'UPLOAD_005': 'Total size exceeds limit',
  
  // Access errors
  'ACCESS_001': 'Unauthorized',
  'ACCESS_002': 'File not found',
  'ACCESS_003': 'Access denied',
  
  // Processing errors
  'PROCESS_001': 'Document creation failed',
  'PROCESS_002': 'Preview generation failed',
  'PROCESS_003': 'Virus scan failed',
};
```

### C. Environment Variables

```bash
# Object Storage
PUBLIC_OBJECT_SEARCH_PATHS=gs://bucket-name/public
PRIVATE_OBJECT_DIR=gs://bucket-name/private

# Upload Limits
MAX_FILE_SIZE_MB=10
MAX_FILES_PER_MESSAGE=5
MAX_VOICE_NOTE_SIZE_MB=5

# Feature Flags
ENABLE_VOICE_NOTES=true
ENABLE_AUTO_DOCUMENT_CREATION=true
ENABLE_MALWARE_SCANNING=false
```

---

## Summary

This document provides a comprehensive plan for implementing file attachments and voice notes in the client portal. The implementation leverages existing infrastructure (object storage, database models, API patterns) while adding new capabilities for seamless document management.

### Key Takeaways

1. **Minimal Schema Changes**: Only need to add 3 fields to documents table
2. **Leverage Existing Code**: Much of the upload infrastructure already exists
3. **Auto-Integration**: Attachments automatically become documents
4. **Security First**: Multi-layer validation and access control
5. **Future-Ready**: Architecture supports task-based uploads and other scenarios
6. **Phased Approach**: Can deliver core functionality quickly, then iterate

### Next Steps

1. Review this document with stakeholders
2. Prioritize features for initial release
3. Create detailed task breakdown for Phase 1
4. Set up development environment
5. Begin implementation

---

**Document Version**: 1.0  
**Last Updated**: October 7, 2025  
**Author**: Development Team  
**Review Status**: Draft - Pending Review
