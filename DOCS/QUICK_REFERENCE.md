# File Attachments System - Quick Reference Guide

## 🚀 Quick Start

### Upload a File (Frontend)

```typescript
import { FileUploadZone, AttachmentList } from '@/components/attachments';

function MyComponent() {
  const [files, setFiles] = useState<File[]>([]);

  return (
    <>
      <FileUploadZone
        onFilesSelected={(newFiles) => setFiles([...files, ...newFiles])}
        maxFiles={5}
        maxSize={25 * 1024 * 1024}
      />
      <AttachmentList
        attachments={files}
        onRemove={(index) => setFiles(files.filter((_, i) => i !== index))}
      />
    </>
  );
}
```

### Validate File (Backend)

```typescript
import { validateFileUpload } from './utils/fileValidation';

const result = validateFileUpload(fileName, fileType, fileSize);
if (!result.valid) {
  return res.status(400).json({ message: result.error });
}
```

### Auto-Create Documents

```typescript
import { createDocumentsFromAttachments } from './utils/documentHelpers';

await createDocumentsFromAttachments({
  clientId: 'client-123',
  messageId: 'msg-456',
  threadId: 'thread-789',
  attachments: [
    { fileName: 'file.pdf', fileType: 'application/pdf', fileSize: 1024, objectPath: '/objects/...' }
  ],
  uploadedBy: 'user-id'
});
```

### Verify Access

```typescript
import { verifyThreadAccess } from './middleware/attachmentAccess';

const { hasAccess, clientId } = await verifyThreadAccess(
  userId,
  portalUserId,
  threadId
);

if (!hasAccess) {
  return res.status(403).json({ message: 'Access denied' });
}
```

---

## 📋 Cheat Sheet

### File Size Limits

| Type | Limit |
|------|-------|
| Attachments | 25MB |
| Voice Notes | 10MB |
| Max Files per Message | 5 |

### Allowed File Types

**Images:** jpg, png, gif, webp, svg
**Documents:** pdf, doc, docx, xls, xlsx, txt, csv
**Audio:** webm, mp3, wav, ogg

### Database Fields

```typescript
// documents table
{
  message_id: varchar,  // Links to messages.id
  thread_id: varchar,   // Links to message_threads.id
  task_id: varchar,     // For future use
  source: 'direct_upload' | 'message_attachment' | 'task_upload' | 'portal_upload'
}
```

### API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/portal/attachments/upload-url` | Get upload URL (portal) |
| POST | `/api/internal/messages/attachments/upload-url` | Get upload URL (staff) |
| GET | `/objects/*` | Download file |

---

## 🔧 Common Tasks

### Change File Size Limit

**File:** `/server/utils/fileValidation.ts`

```typescript
export const MAX_FILE_SIZE = 50 * 1024 * 1024; // Change to 50MB
```

### Add New File Type

**File:** `/server/utils/fileValidation.ts`

```typescript
export const ALLOWED_FILE_TYPES = {
  documents: [
    'application/pdf',
    'application/zip', // Add ZIP files
  ]
};
```

### Change Max Files per Message

**Files:**
1. `/server/utils/fileValidation.ts`
```typescript
export const MAX_FILES_PER_MESSAGE = 10; // Change to 10
```

2. `/client/src/pages/messages.tsx`
```typescript
if (selectedFiles.length + files.length > 10) { // Update to 10
```

### Query Message Attachments

```sql
SELECT
  d.file_name,
  m.content as message,
  mt.subject as thread
FROM documents d
JOIN messages m ON d.message_id = m.id
JOIN message_threads mt ON d.thread_id = mt.id
WHERE d.source = 'message_attachment'
  AND d.client_id = 'client-123'
ORDER BY d.uploaded_at DESC;
```

---

## 🐛 Debug Commands

### Check Database Schema

```bash
psql $DATABASE_URL -c "SELECT column_name FROM information_schema.columns WHERE table_name = 'documents';"
```

### Check Indexes

```bash
psql $DATABASE_URL -c "SELECT indexname FROM pg_indexes WHERE tablename = 'documents';"
```

### Find Message Attachments

```sql
SELECT COUNT(*) FROM documents WHERE source = 'message_attachment';
```

### Check Environment Variables

```bash
echo $PRIVATE_OBJECT_DIR
echo $PUBLIC_OBJECT_SEARCH_PATHS
```

---

## 📦 Component Props Quick Reference

### FileUploadZone

```typescript
<FileUploadZone
  onFilesSelected={(files: File[]) => void}  // Required
  maxFiles={5}                                // Optional, default: 5
  maxSize={25 * 1024 * 1024}                 // Optional, default: 25MB
  acceptedTypes={['image/*', '.pdf']}        // Optional
/>
```

### AttachmentList

```typescript
<AttachmentList
  attachments={files}                         // Required
  onRemove={(index: number) => void}         // Optional
  onPreview={(attachment) => void}           // Optional
  readonly={false}                            // Optional, default: false
/>
```

### VoiceNotePlayer

```typescript
<VoiceNotePlayer
  audioUrl="https://..."                      // Required
  fileName="Voice Note"                       // Optional
  duration={120}                              // Optional (seconds)
/>
```

### AttachmentPreview

```typescript
<AttachmentPreview
  attachment={{                               // Required
    fileName: string,
    fileType: string,
    fileSize: number,
    objectPath: string,
    url: string
  }}
  open={true}                                 // Required
  onClose={() => void}                        // Required
/>
```

---

## 🔐 Security Checklist

- [ ] File type validated server-side
- [ ] File size checked server-side
- [ ] File name sanitized
- [ ] Access control verified on download
- [ ] Portal users isolated to own client
- [ ] Staff users can access all files
- [ ] Signed URLs expire after 15 minutes

---

## 🧪 Testing Checklist

### File Upload
- [ ] Single file upload works
- [ ] Multiple file upload (up to 5) works
- [ ] File size validation (>25MB rejected)
- [ ] File type validation (disallowed types rejected)
- [ ] Progress indicator shows
- [ ] Remove file before send works

### Voice Notes
- [ ] Recording starts
- [ ] Duration displays correctly
- [ ] Preview playback works
- [ ] Re-record works
- [ ] Send works
- [ ] File naming is correct (voice-note-timestamp.webm)

### Auto-Document Creation
- [ ] Documents created from message attachments
- [ ] "Message Attachments" folder auto-created
- [ ] Documents have correct metadata
- [ ] Links to message/thread set correctly

### Access Control
- [ ] Portal user can access own files
- [ ] Portal user cannot access other client files
- [ ] Staff can access all files
- [ ] Download without auth fails

---

## 📁 File Locations

| File | Location |
|------|----------|
| File Validation | `/server/utils/fileValidation.ts` |
| Access Control | `/server/middleware/attachmentAccess.ts` |
| Document Helpers | `/server/utils/documentHelpers.ts` |
| Messages Page | `/client/src/pages/messages.tsx` |
| Client Detail | `/client/src/pages/client-detail.tsx` |
| Components | `/client/src/components/attachments/` |
| Database Schema | `/shared/schema.ts` |
| Migration | `/db/migrations/20251008_add_document_source_tracking.sql` |

---

## 🎯 Implementation Status

| Issue | Status |
|-------|--------|
| 1. Database Schema | ✅ Complete |
| 2. File Attachment Features | ✅ Complete |
| 3. Voice Note Enhancements | ✅ Complete |
| 4. Auto-Document Creation | ✅ Complete |
| 5. UI Components | ✅ Complete |
| 6. Staff Interface | ✅ Complete |
| 7. Client Detail Integration | ✅ Complete |
| 8. API Endpoints | ✅ Complete |
| 9. Security & Validation | ✅ Complete |
| 10. Access Control | ✅ Complete |

**Overall:** 10/10 Complete ✅

---

## 📞 Support

- **Full Documentation:** `ATTACHMENT_SYSTEM_DOCUMENTATION.md`
- **GitHub Issues:** Report bugs or request features
- **Server Logs:** Check for error messages
- **Database:** Run diagnostic queries

---

**Last Updated:** October 9, 2025
