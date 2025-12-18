# File Attachments & Voice Notes - QA Testing Checklist

**Feature Version:** 1.0
**Last Updated:** October 10, 2025
**Status:** Ready for Testing

---

## Pre-Testing Setup

### Environment Verification
- [ ] Database migration applied successfully
  ```bash
  psql $DATABASE_URL -c "SELECT column_name FROM information_schema.columns WHERE table_name = 'documents' AND column_name IN ('message_id', 'thread_id', 'task_id', 'source');"
  ```
- [ ] Environment variables configured
  - [ ] `PRIVATE_OBJECT_DIR` is set
  - [ ] `PUBLIC_OBJECT_SEARCH_PATHS` is set
- [ ] Test data prepared
  - [ ] At least 2 portal users with different clients
  - [ ] At least 1 staff user
  - [ ] At least 2 active message threads

### Test Files Preparation
Prepare the following test files:

- [ ] **Valid files:**
  - [ ] Small image (< 1MB) - e.g., test-image.jpg
  - [ ] Large image (5-10MB) - e.g., large-photo.png
  - [ ] PDF document (2-5MB) - e.g., sample-document.pdf
  - [ ] Word document (.docx) - e.g., report.docx
  - [ ] Excel spreadsheet (.xlsx) - e.g., data.xlsx
  - [ ] Text file (.txt) - e.g., notes.txt

- [ ] **Invalid files for negative testing:**
  - [ ] File > 25MB (should fail)
  - [ ] Executable file (.exe) (should fail)
  - [ ] Script file (.sh, .bat) (should fail)
  - [ ] 6 files at once (should fail - max is 5)

---

## Section 1: File Upload - Portal User

### 1.1 Single File Upload
**Test Case ID:** FU-P-001
**Priority:** Critical

**Steps:**
1. [ ] Log in as portal user
2. [ ] Navigate to Messages page
3. [ ] Select an existing thread
4. [ ] Click paperclip icon to upload file
5. [ ] Select a single image file (< 5MB)
6. [ ] Verify file appears in attachment list
7. [ ] Type optional message text
8. [ ] Click Send button

**Expected Results:**
- [ ] File selection dialog opens
- [ ] Selected file appears in preview list with:
  - [ ] Correct file name
  - [ ] File size displayed
  - [ ] Appropriate file type icon
  - [ ] Remove button (X) visible
- [ ] Upload progress indicator shows (0-100%)
- [ ] Message sent successfully
- [ ] Attachment appears in message thread
- [ ] Download/preview button visible on attachment

**Actual Results:**
```
[Record your observations here]
```

---

### 1.2 Multiple Files Upload (Valid)
**Test Case ID:** FU-P-002
**Priority:** Critical

**Steps:**
1. [ ] Log in as portal user
2. [ ] Navigate to Messages page
3. [ ] Select a thread
4. [ ] Click paperclip icon
5. [ ] Select 3 files at once (1 image, 1 PDF, 1 document)
6. [ ] Verify all 3 files appear in preview
7. [ ] Click Send

**Expected Results:**
- [ ] All 3 files appear in attachment list
- [ ] Each file shows correct metadata
- [ ] Progress indicator shows for each upload
- [ ] All files uploaded successfully
- [ ] Message shows all 3 attachments
- [ ] Each attachment has preview/download button

**Actual Results:**
```
[Record your observations here]
```

---

### 1.3 Maximum Files (5 Files)
**Test Case ID:** FU-P-003
**Priority:** High

**Steps:**
1. [ ] Log in as portal user
2. [ ] Select a thread
3. [ ] Upload 5 different files at once
4. [ ] Verify all 5 appear in preview
5. [ ] Try to add a 6th file

**Expected Results:**
- [ ] All 5 files accepted and displayed
- [ ] Attempting 6th file shows error: "Maximum 5 files per message"
- [ ] Error message is clear and user-friendly
- [ ] Can proceed with 5 files
- [ ] All 5 files upload successfully

**Actual Results:**
```
[Record your observations here]
```

---

### 1.4 Drag and Drop Upload
**Test Case ID:** FU-P-004
**Priority:** High

**Steps:**
1. [ ] Log in as portal user
2. [ ] Navigate to Messages page
3. [ ] Select a thread
4. [ ] Drag a file from desktop/file explorer
5. [ ] Drop onto the file upload zone
6. [ ] Verify file appears in preview
7. [ ] Send message

**Expected Results:**
- [ ] Drop zone highlights when file dragged over
- [ ] File accepted on drop
- [ ] File appears in attachment list
- [ ] Upload proceeds normally
- [ ] Message sent with attachment

**Actual Results:**
```
[Record your observations here]
```

---

### 1.5 Remove File Before Sending
**Test Case ID:** FU-P-005
**Priority:** Medium

**Steps:**
1. [ ] Log in as portal user
2. [ ] Select a thread
3. [ ] Upload 3 files
4. [ ] Click X button on the 2nd file
5. [ ] Verify file removed from list
6. [ ] Send message with remaining 2 files

**Expected Results:**
- [ ] Clicked file removed from preview
- [ ] Other files remain intact
- [ ] File count updates correctly
- [ ] Only 2 files uploaded
- [ ] Message shows only 2 attachments

**Actual Results:**
```
[Record your observations here]
```

---

## Section 2: File Validation - Portal User

### 2.1 File Size Validation - Over Limit
**Test Case ID:** FV-P-001
**Priority:** Critical

**Steps:**
1. [ ] Log in as portal user
2. [ ] Attempt to upload file > 25MB

**Expected Results:**
- [ ] Client-side validation error shown
- [ ] Error message: "File size must be less than 25MB"
- [ ] File not added to preview list
- [ ] Can continue with other files

**Actual Results:**
```
[Record your observations here]
```

---

### 2.2 File Type Validation - Disallowed Type
**Test Case ID:** FV-P-002
**Priority:** Critical

**Steps:**
1. [ ] Log in as portal user
2. [ ] Attempt to upload .exe file
3. [ ] Attempt to upload .sh script file

**Expected Results:**
- [ ] Client-side validation error shown
- [ ] Error message: "File type not allowed. Allowed types: Images, PDFs, Documents, Audio"
- [ ] Files not added to preview
- [ ] Clear guidance on allowed types

**Actual Results:**
```
[Record your observations here]
```

---

### 2.3 File Type Validation - All Allowed Types
**Test Case ID:** FV-P-003
**Priority:** High

**Steps:**
Test each allowed file type individually:
1. [ ] Image - JPEG (.jpg)
2. [ ] Image - PNG (.png)
3. [ ] Image - GIF (.gif)
4. [ ] Image - WebP (.webp)
5. [ ] Document - PDF (.pdf)
6. [ ] Document - Word (.docx)
7. [ ] Document - Excel (.xlsx)
8. [ ] Document - Text (.txt)
9. [ ] Document - CSV (.csv)
10. [ ] Audio - MP3 (.mp3)

**Expected Results:**
- [ ] All file types accepted
- [ ] Appropriate icons displayed for each type
- [ ] All files upload successfully
- [ ] Preview/download works for each type

**Actual Results:**
```
[Record your observations here]
```

---

### 2.4 Filename Sanitization
**Test Case ID:** FV-P-004
**Priority:** Medium

**Steps:**
1. [ ] Create file with path traversal attempt: `../../malicious.pdf`
2. [ ] Upload this file
3. [ ] Check stored filename in database

**Expected Results:**
- [ ] File accepted (if PDF)
- [ ] Filename sanitized (path removed)
- [ ] Stored as `malicious.pdf` without path
- [ ] No directory traversal possible

**Database Check:**
```sql
SELECT file_name FROM documents ORDER BY uploaded_at DESC LIMIT 1;
```

**Actual Results:**
```
[Record your observations here]
```

---

## Section 3: Voice Notes - Portal User

### 3.1 Voice Note Recording
**Test Case ID:** VN-P-001
**Priority:** Critical

**Steps:**
1. [ ] Log in as portal user
2. [ ] Navigate to Messages page
3. [ ] Select a thread
4. [ ] Click microphone icon
5. [ ] Grant microphone permission if prompted
6. [ ] Observe recording indicator
7. [ ] Speak for 10 seconds
8. [ ] Click Stop recording

**Expected Results:**
- [ ] Microphone permission requested (first time)
- [ ] Recording starts immediately
- [ ] Visual indicator shown (pulsing red dot)
- [ ] Duration displays in MM:SS format
- [ ] Duration updates in real-time
- [ ] Recording stops when clicked
- [ ] Preview player appears

**Actual Results:**
```
[Record your observations here]
```

---

### 3.2 Voice Note Preview Playback
**Test Case ID:** VN-P-002
**Priority:** High

**Steps:**
1. [ ] Complete voice note recording (from VN-P-001)
2. [ ] Click Play button on preview player
3. [ ] Observe playback
4. [ ] Test pause button
5. [ ] Test volume slider
6. [ ] Test mute button
7. [ ] Test seek slider

**Expected Results:**
- [ ] Audio plays back correctly
- [ ] Play/pause button toggles
- [ ] Volume control works
- [ ] Mute button works
- [ ] Seek slider allows jumping in audio
- [ ] Time displays current position / total duration
- [ ] Audio quality is clear

**Actual Results:**
```
[Record your observations here]
```

---

### 3.3 Voice Note Re-record
**Test Case ID:** VN-P-003
**Priority:** High

**Steps:**
1. [ ] Complete voice note recording
2. [ ] Click Re-record button (refresh icon)
3. [ ] Record new voice note (5 seconds)
4. [ ] Stop recording
5. [ ] Verify new recording replaces old

**Expected Results:**
- [ ] Re-record button visible with refresh icon
- [ ] Clicking starts new recording
- [ ] Previous recording discarded
- [ ] New recording preview appears
- [ ] Duration reset to 0:00
- [ ] New recording can be played

**Actual Results:**
```
[Record your observations here]
```

---

### 3.4 Voice Note Discard
**Test Case ID:** VN-P-004
**Priority:** Medium

**Steps:**
1. [ ] Complete voice note recording
2. [ ] Click Discard/Trash button
3. [ ] Verify recording removed

**Expected Results:**
- [ ] Discard button visible (trash icon)
- [ ] Recording removed from preview
- [ ] Microphone icon reappears
- [ ] Can record new voice note

**Actual Results:**
```
[Record your observations here]
```

---

### 3.5 Voice Note Send and Playback
**Test Case ID:** VN-P-005
**Priority:** Critical

**Steps:**
1. [ ] Complete voice note recording
2. [ ] Preview to ensure quality
3. [ ] Click Send button
4. [ ] Wait for upload
5. [ ] Check message thread
6. [ ] Play voice note from thread

**Expected Results:**
- [ ] Upload progress shown
- [ ] Voice note appears in thread
- [ ] File named: `voice-note-{timestamp}.webm`
- [ ] Audio player embedded in message
- [ ] Can play audio from thread
- [ ] Audio quality maintained

**Actual Results:**
```
[Record your observations here]
```

---

### 3.6 Voice Note Size Limit
**Test Case ID:** VN-P-006
**Priority:** High

**Steps:**
1. [ ] Record very long voice note (> 10 minutes)
2. [ ] Attempt to send

**Expected Results:**
- [ ] If file > 10MB, validation error shown
- [ ] Error message: "Voice note size must be less than 10MB"
- [ ] Option to re-record shorter note
- [ ] Clear guidance on limit

**Actual Results:**
```
[Record your observations here]
```

---

## Section 4: Auto-Document Creation

### 4.1 Document Creation from Portal Message
**Test Case ID:** AD-001
**Priority:** Critical

**Steps:**
1. [ ] Log in as portal user
2. [ ] Send message with 2 attachments (1 image, 1 PDF)
3. [ ] Note the client ID
4. [ ] Check database for document records

**Database Queries:**
```sql
-- Check documents created
SELECT * FROM documents
WHERE source = 'message_attachment'
ORDER BY uploaded_at DESC
LIMIT 5;

-- Check folder creation
SELECT * FROM document_folders
WHERE name = 'Message Attachments';
```

**Expected Results:**
- [ ] 2 document records created
- [ ] `source` = 'message_attachment'
- [ ] `message_id` populated (links to message)
- [ ] `thread_id` populated (links to thread)
- [ ] `client_id` matches portal user's client
- [ ] `client_portal_user_id` populated
- [ ] `is_portal_visible` = true
- [ ] "Message Attachments" folder created (if first time)

**Actual Results:**
```
[Record your observations here]
```

---

### 4.2 Message Attachments Folder Creation
**Test Case ID:** AD-002
**Priority:** High

**Steps:**
1. [ ] Use new client without "Message Attachments" folder
2. [ ] Send message with attachment as portal user
3. [ ] Check database for folder creation

**Database Query:**
```sql
SELECT * FROM document_folders
WHERE name = 'Message Attachments'
AND client_id = '[CLIENT_ID]';
```

**Expected Results:**
- [ ] Folder auto-created
- [ ] `name` = 'Message Attachments'
- [ ] `client_id` matches
- [ ] `source` = 'message_attachment'
- [ ] Folder visible in portal

**Actual Results:**
```
[Record your observations here]
```

---

### 4.3 Document Metadata Verification
**Test Case ID:** AD-003
**Priority:** High

**Steps:**
1. [ ] Send message with attachment
2. [ ] Query document record

**Database Query:**
```sql
SELECT
  d.file_name,
  d.file_size,
  d.file_type,
  d.source,
  d.message_id,
  d.thread_id,
  d.client_id,
  d.uploaded_by,
  d.client_portal_user_id,
  d.is_portal_visible,
  m.content as message_content,
  mt.subject as thread_subject
FROM documents d
JOIN messages m ON d.message_id = m.id
JOIN message_threads mt ON d.thread_id = mt.id
WHERE d.source = 'message_attachment'
ORDER BY d.uploaded_at DESC
LIMIT 1;
```

**Expected Results:**
- [ ] All fields populated correctly
- [ ] `file_name` matches uploaded file
- [ ] `file_size` accurate
- [ ] `file_type` correct MIME type
- [ ] Links to correct message and thread
- [ ] Uploader info correct

**Actual Results:**
```
[Record your observations here]
```

---

### 4.4 Multiple Messages, Same Thread
**Test Case ID:** AD-004
**Priority:** Medium

**Steps:**
1. [ ] Send 3 messages in same thread, each with 2 attachments
2. [ ] Query documents by thread

**Database Query:**
```sql
SELECT
  d.id,
  d.file_name,
  d.message_id,
  m.content
FROM documents d
JOIN messages m ON d.message_id = m.id
WHERE d.thread_id = '[THREAD_ID]'
AND d.source = 'message_attachment'
ORDER BY d.uploaded_at;
```

**Expected Results:**
- [ ] 6 document records total (3 messages × 2 attachments)
- [ ] All linked to same thread
- [ ] Each linked to different message
- [ ] All in "Message Attachments" folder
- [ ] Order preserved

**Actual Results:**
```
[Record your observations here]
```

---

## Section 5: Access Control - Portal Users

### 5.1 Portal User - Access Own Attachments
**Test Case ID:** AC-P-001
**Priority:** Critical

**Steps:**
1. [ ] Log in as Portal User A (Client 1)
2. [ ] Send message with attachment
3. [ ] Click to preview/download attachment
4. [ ] Verify access granted

**Expected Results:**
- [ ] Attachment preview opens
- [ ] Download succeeds
- [ ] No access denied errors

**Actual Results:**
```
[Record your observations here]
```

---

### 5.2 Portal User - Cannot Access Other Client's Attachments
**Test Case ID:** AC-P-002
**Priority:** Critical

**Steps:**
1. [ ] Log in as Portal User A (Client 1)
2. [ ] Send message with attachment, note the object path
3. [ ] Log out
4. [ ] Log in as Portal User B (Client 2)
5. [ ] Try to access Portal User A's attachment URL directly

**How to get URL:**
- Inspect network tab
- Copy object path from message
- Construct URL: `GET /objects/{objectPath}`

**Expected Results:**
- [ ] HTTP 403 Forbidden response
- [ ] Error message: "You do not have permission to access this file"
- [ ] Attachment not downloaded
- [ ] No file content visible

**Actual Results:**
```
[Record your observations here]
```

---

### 5.3 Portal User - Cannot Access Documents of Other Clients
**Test Case ID:** AC-P-003
**Priority:** Critical

**Steps:**
1. [ ] As Portal User A, create document in Documents tab
2. [ ] Note the document ID
3. [ ] Log in as Portal User B (different client)
4. [ ] Try to access: `GET /api/portal/documents/{documentId}/download`

**Expected Results:**
- [ ] HTTP 403 Forbidden response
- [ ] Access denied message
- [ ] Document not downloaded

**Actual Results:**
```
[Record your observations here]
```

---

### 5.4 Unauthenticated Access Denied
**Test Case ID:** AC-P-004
**Priority:** Critical

**Steps:**
1. [ ] Log out completely (clear session)
2. [ ] Try to access attachment URL directly
3. [ ] Try to access document download URL

**Expected Results:**
- [ ] HTTP 401 Unauthorized response
- [ ] Redirect to login page (or error)
- [ ] No file access

**Actual Results:**
```
[Record your observations here]
```

---

## Section 6: Access Control - Staff Users

### 6.1 Staff User - Access All Client Attachments
**Test Case ID:** AC-S-001
**Priority:** Critical

**Steps:**
1. [ ] As Portal User A (Client 1), send message with attachment
2. [ ] As Portal User B (Client 2), send message with attachment
3. [ ] Log in as Staff User
4. [ ] Access both attachments

**Expected Results:**
- [ ] Staff can view Client 1's attachment
- [ ] Staff can view Client 2's attachment
- [ ] Staff can download both
- [ ] No access restrictions for staff

**Actual Results:**
```
[Record your observations here]
```

---

### 6.2 Staff User - Upload Attachments to Any Client
**Test Case ID:** AC-S-002
**Priority:** High

**Steps:**
1. [ ] Log in as Staff User
2. [ ] Navigate to Messages page (staff view)
3. [ ] Reply to Client 1's thread with attachment
4. [ ] Reply to Client 2's thread with attachment

**Expected Results:**
- [ ] Staff can upload to any client thread
- [ ] Both uploads succeed
- [ ] Documents auto-created with `uploaded_by` = staff user ID
- [ ] Portal users can see staff attachments

**Actual Results:**
```
[Record your observations here]
```

---

## Section 7: UI Components

### 7.1 AttachmentPreview - Image Preview
**Test Case ID:** UI-001
**Priority:** High

**Steps:**
1. [ ] Send message with image attachment
2. [ ] Click image to preview
3. [ ] Test zoom functionality
4. [ ] Test download button
5. [ ] Test close button

**Expected Results:**
- [ ] Modal opens with image
- [ ] Image displays correctly
- [ ] Can zoom in/out (if implemented)
- [ ] Download button works
- [ ] Close button closes modal
- [ ] File name and size displayed

**Actual Results:**
```
[Record your observations here]
```

---

### 7.2 AttachmentPreview - PDF Preview
**Test Case ID:** UI-002
**Priority:** High

**Steps:**
1. [ ] Send message with PDF attachment
2. [ ] Click PDF to preview
3. [ ] Test scrolling through PDF
4. [ ] Test download button

**Expected Results:**
- [ ] Modal opens with PDF iframe
- [ ] PDF renders correctly
- [ ] Can scroll through pages
- [ ] Download button works
- [ ] Loading indicator shown while loading

**Actual Results:**
```
[Record your observations here]
```

---

### 7.3 AttachmentPreview - Audio Preview
**Test Case ID:** UI-003
**Priority:** High

**Steps:**
1. [ ] Send message with audio file (MP3)
2. [ ] Click audio to preview
3. [ ] Test play/pause
4. [ ] Test volume control
5. [ ] Test seek functionality

**Expected Results:**
- [ ] Modal opens with audio player
- [ ] Audio plays correctly
- [ ] Controls are responsive
- [ ] Time display accurate
- [ ] Download button works

**Actual Results:**
```
[Record your observations here]
```

---

### 7.4 Attachment Count Indicators
**Test Case ID:** UI-004
**Priority:** Medium

**Steps:**
1. [ ] Send message with 3 attachments to Thread A
2. [ ] Send message with no attachments to Thread B
3. [ ] Navigate to Client Detail page → Communications tab
4. [ ] View thread list

**Expected Results:**
- [ ] Thread A shows "📎 3" badge
- [ ] Thread B shows no badge (no attachments)
- [ ] Badge positioned next to thread subject
- [ ] Badge styling consistent

**Actual Results:**
```
[Record your observations here]
```

---

### 7.5 Upload Progress Indicator
**Test Case ID:** UI-005
**Priority:** Medium

**Steps:**
1. [ ] Select large file (10-20MB)
2. [ ] Start upload
3. [ ] Observe progress indicator

**Expected Results:**
- [ ] Progress bar or percentage shown
- [ ] Progress updates smoothly (0% → 100%)
- [ ] UI remains responsive during upload
- [ ] Can cancel upload (if implemented)
- [ ] Success message on completion

**Actual Results:**
```
[Record your observations here]
```

---

### 7.6 Error Message Display
**Test Case ID:** UI-006
**Priority:** Medium

**Steps:**
Test various error scenarios:
1. [ ] File too large
2. [ ] File type not allowed
3. [ ] Too many files
4. [ ] Network error during upload
5. [ ] Server error

**Expected Results:**
- [ ] Error messages clear and user-friendly
- [ ] Errors displayed prominently
- [ ] Errors auto-dismiss after 5-10 seconds (or have close button)
- [ ] User can retry after error
- [ ] No technical jargon in messages

**Actual Results:**
```
[Record your observations here]
```

---

## Section 8: Client Detail Page Integration

### 8.1 Documents Tab - Message Attachments Folder
**Test Case ID:** CD-001
**Priority:** High

**Steps:**
1. [ ] Send messages with 5 total attachments to a client
2. [ ] Log in as staff user
3. [ ] Navigate to Client Detail page
4. [ ] Go to Documents tab
5. [ ] Look for "Message Attachments" folder

**Expected Results:**
- [ ] "Message Attachments" folder visible
- [ ] Folder contains 5 documents
- [ ] Each document shows:
  - [ ] File name
  - [ ] Upload date
  - [ ] Uploader
  - [ ] File size
- [ ] Can click to view/download

**Actual Results:**
```
[Record your observations here]
```

---

### 8.2 Documents Tab - Source Filtering
**Test Case ID:** CD-002
**Priority:** Medium

**Steps:**
1. [ ] Upload 2 documents directly via Documents tab
2. [ ] Send message with 2 attachments
3. [ ] View Documents tab

**Expected Results:**
- [ ] Can distinguish between direct uploads and message attachments
- [ ] Folder organization clear
- [ ] Source type visible (if implemented)

**Actual Results:**
```
[Record your observations here]
```

---

### 8.3 Communications Tab - Thread Attachments
**Test Case ID:** CD-003
**Priority:** Medium

**Steps:**
1. [ ] Navigate to Client Detail → Communications tab
2. [ ] View threads with attachments
3. [ ] Click on thread with attachments
4. [ ] View messages with attachments

**Expected Results:**
- [ ] Threads show attachment count badge
- [ ] Clicking thread shows messages
- [ ] Attachments visible in messages
- [ ] Can preview/download from Communications tab

**Actual Results:**
```
[Record your observations here]
```

---

## Section 9: Database Integrity

### 9.1 Schema Verification
**Test Case ID:** DB-001
**Priority:** Critical

**Database Queries:**
```sql
-- Check new columns exist
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'documents'
AND column_name IN ('message_id', 'thread_id', 'task_id', 'source');

-- Check indexes exist
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'documents'
AND indexname IN ('idx_documents_message_id', 'idx_documents_thread_id', 'idx_documents_task_id', 'idx_documents_source');

-- Check foreign key constraints
SELECT
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_name = 'documents'
AND tc.constraint_type = 'FOREIGN KEY'
AND kcu.column_name IN ('message_id', 'thread_id');
```

**Expected Results:**
- [ ] All 4 columns exist (message_id, thread_id, task_id, source)
- [ ] Data types correct (varchar)
- [ ] `source` has default value 'direct_upload'
- [ ] All 4 indexes exist
- [ ] Foreign key constraints on message_id and thread_id
- [ ] ON DELETE CASCADE configured

**Actual Results:**
```
[Record your observations here]
```

---

### 9.2 Data Integrity - Referential Integrity
**Test Case ID:** DB-002
**Priority:** High

**Steps:**
1. [ ] Create message with attachment
2. [ ] Verify document created with message_id and thread_id
3. [ ] Delete the message
4. [ ] Check if document was cascade deleted

**Database Queries:**
```sql
-- Get document before deletion
SELECT id, message_id, thread_id FROM documents WHERE message_id = '[MESSAGE_ID]';

-- Delete message
DELETE FROM messages WHERE id = '[MESSAGE_ID]';

-- Check document deleted
SELECT COUNT(*) FROM documents WHERE message_id = '[MESSAGE_ID]';
-- Should return 0
```

**Expected Results:**
- [ ] Document exists before deletion
- [ ] Message deletion succeeds
- [ ] Document automatically deleted (cascade)
- [ ] No orphaned document records

**Actual Results:**
```
[Record your observations here]
```

---

### 9.3 Data Integrity - Source Field Values
**Test Case ID:** DB-003
**Priority:** Medium

**Database Query:**
```sql
-- Check all source values are valid
SELECT DISTINCT source FROM documents;

-- Should only return:
-- 'direct_upload'
-- 'message_attachment'
-- 'task_upload'
-- 'portal_upload'
```

**Expected Results:**
- [ ] Only valid enum values present
- [ ] No NULL values in source column
- [ ] Default 'direct_upload' working for existing records

**Actual Results:**
```
[Record your observations here]
```

---

## Section 10: Performance Testing

### 10.1 Upload Performance - Single File
**Test Case ID:** PERF-001
**Priority:** Medium

**Steps:**
1. [ ] Upload 1MB file
2. [ ] Measure time from upload start to success message

**Expected Results:**
- [ ] Upload completes in < 3 seconds
- [ ] No UI freezing
- [ ] Progress indicator smooth

**Actual Results:**
- Upload time: _______ seconds
- Performance: [ ] Acceptable [ ] Needs improvement

---

### 10.2 Upload Performance - Multiple Files
**Test Case ID:** PERF-002
**Priority:** Medium

**Steps:**
1. [ ] Upload 5 files (total 25MB)
2. [ ] Measure time from upload start to completion

**Expected Results:**
- [ ] All uploads complete in < 15 seconds
- [ ] Parallel uploads (not sequential)
- [ ] UI remains responsive

**Actual Results:**
- Upload time: _______ seconds
- Performance: [ ] Acceptable [ ] Needs improvement

---

### 10.3 Database Query Performance
**Test Case ID:** PERF-003
**Priority:** Medium

**Database Queries:**
```sql
-- Test index usage
EXPLAIN ANALYZE
SELECT * FROM documents WHERE message_id = '[MESSAGE_ID]';

EXPLAIN ANALYZE
SELECT * FROM documents WHERE thread_id = '[THREAD_ID]';

EXPLAIN ANALYZE
SELECT * FROM documents WHERE source = 'message_attachment';
```

**Expected Results:**
- [ ] Queries use indexes (shows "Index Scan")
- [ ] Query time < 10ms
- [ ] No sequential scans on large tables

**Actual Results:**
```
[Record your observations here]
```

---

## Section 11: Browser Compatibility

### 11.1 Chrome/Edge (Chromium)
**Test Case ID:** BROWSER-001

Test all core features:
- [ ] File upload works
- [ ] Drag and drop works
- [ ] Voice recording works
- [ ] Voice playback works
- [ ] Preview modals work
- [ ] All UI components render correctly

**Chrome Version:** _____________
**Results:** [ ] Pass [ ] Fail
**Issues:**
```
[List any issues]
```

---

### 11.2 Firefox
**Test Case ID:** BROWSER-002

Test all core features:
- [ ] File upload works
- [ ] Drag and drop works
- [ ] Voice recording works
- [ ] Voice playback works
- [ ] Preview modals work
- [ ] All UI components render correctly

**Firefox Version:** _____________
**Results:** [ ] Pass [ ] Fail
**Issues:**
```
[List any issues]
```

---

### 11.3 Safari
**Test Case ID:** BROWSER-003

Test all core features:
- [ ] File upload works
- [ ] Drag and drop works
- [ ] Voice recording works (may need permission)
- [ ] Voice playback works
- [ ] Preview modals work
- [ ] All UI components render correctly

**Safari Version:** _____________
**Results:** [ ] Pass [ ] Fail
**Issues:**
```
[List any issues]
```

---

## Section 12: Security Testing

### 12.1 SQL Injection Prevention
**Test Case ID:** SEC-001
**Priority:** Critical

**Steps:**
1. [ ] Try uploading file named: `'; DROP TABLE documents; --`
2. [ ] Check database integrity

**Expected Results:**
- [ ] File name sanitized
- [ ] No SQL injection possible
- [ ] Database remains intact

**Actual Results:**
```
[Record your observations here]
```

---

### 12.2 Path Traversal Prevention
**Test Case ID:** SEC-002
**Priority:** Critical

**Steps:**
1. [ ] Upload file: `../../etc/passwd`
2. [ ] Check stored path
3. [ ] Try to download with manipulated path

**Expected Results:**
- [ ] Path sanitized
- [ ] File stored safely
- [ ] Cannot access system files

**Actual Results:**
```
[Record your observations here]
```

---

### 12.3 MIME Type Validation
**Test Case ID:** SEC-003
**Priority:** High

**Steps:**
1. [ ] Rename .exe file to .pdf
2. [ ] Attempt upload

**Expected Results:**
- [ ] Server-side validation checks actual MIME type
- [ ] Upload rejected despite .pdf extension

**Actual Results:**
```
[Record your observations here]
```

---

## Section 13: Edge Cases

### 13.1 Empty File
**Test Case ID:** EDGE-001

**Steps:**
1. [ ] Create 0-byte file
2. [ ] Attempt upload

**Expected Results:**
- [ ] Validation error or warning
- [ ] Clear message about empty file

**Actual Results:**
```
[Record your observations here]
```

---

### 13.2 Special Characters in Filename
**Test Case ID:** EDGE-002

**Steps:**
Test filenames with:
1. [ ] Spaces: `my document.pdf`
2. [ ] Unicode: `文档.pdf`
3. [ ] Special chars: `invoice #123 (final).pdf`
4. [ ] Emoji: `report 📄.pdf`

**Expected Results:**
- [ ] Files upload successfully
- [ ] Filenames preserved (or sanitized safely)
- [ ] Downloads work with special chars

**Actual Results:**
```
[Record your observations here]
```

---

### 13.3 Concurrent Uploads - Same Thread
**Test Case ID:** EDGE-003

**Steps:**
1. [ ] Open thread in 2 browser tabs
2. [ ] Upload file from Tab 1
3. [ ] Simultaneously upload file from Tab 2

**Expected Results:**
- [ ] Both uploads succeed
- [ ] No race conditions
- [ ] Both messages appear correctly
- [ ] All documents created

**Actual Results:**
```
[Record your observations here]
```

---

### 13.4 Network Interruption During Upload
**Test Case ID:** EDGE-004

**Steps:**
1. [ ] Start uploading large file (10MB+)
2. [ ] Disable network mid-upload
3. [ ] Observe behavior
4. [ ] Re-enable network

**Expected Results:**
- [ ] Upload fails with clear error
- [ ] User can retry
- [ ] No partial data corruption
- [ ] UI recovers gracefully

**Actual Results:**
```
[Record your observations here]
```

---

### 13.5 Session Timeout During Upload
**Test Case ID:** EDGE-005

**Steps:**
1. [ ] Log in
2. [ ] Wait for session to expire (or expire manually)
3. [ ] Attempt file upload

**Expected Results:**
- [ ] Authentication error
- [ ] Redirect to login
- [ ] Clear message about session expiry

**Actual Results:**
```
[Record your observations here]
```

---

## Section 14: Regression Testing

### 14.1 Existing Direct Upload Still Works
**Test Case ID:** REG-001
**Priority:** Critical

**Steps:**
1. [ ] Navigate to Documents tab
2. [ ] Upload document directly (not via message)
3. [ ] Verify it works as before

**Expected Results:**
- [ ] Direct upload unaffected
- [ ] Document created with source = 'direct_upload'
- [ ] No message_id or thread_id
- [ ] Appears in Documents tab normally

**Actual Results:**
```
[Record your observations here]
```

---

### 14.2 Messages Without Attachments Still Work
**Test Case ID:** REG-002
**Priority:** Critical

**Steps:**
1. [ ] Send plain text message (no attachments)
2. [ ] Verify message sent successfully

**Expected Results:**
- [ ] Message sends normally
- [ ] No errors
- [ ] No document creation attempted

**Actual Results:**
```
[Record your observations here]
```

---

### 14.3 Existing Documents Not Affected
**Test Case ID:** REG-003
**Priority:** High

**Steps:**
1. [ ] Query existing documents (uploaded before feature)
2. [ ] Check schema compatibility

**Database Query:**
```sql
SELECT * FROM documents WHERE uploaded_at < '[MIGRATION_DATE]';
```

**Expected Results:**
- [ ] Old documents still accessible
- [ ] New fields NULL for old records
- [ ] source = 'direct_upload' (default)
- [ ] No data corruption

**Actual Results:**
```
[Record your observations here]
```

---

## Section 15: User Experience

### 15.1 Portal User Experience - Overall
**Test Case ID:** UX-001

**Criteria:**
- [ ] File upload is intuitive
- [ ] Drag-and-drop easy to discover
- [ ] Error messages helpful
- [ ] Progress feedback clear
- [ ] Voice recording easy to use
- [ ] Preview functionality helpful
- [ ] Loading states present
- [ ] No confusing UI elements

**User Feedback:**
```
[Collect feedback from actual portal users]
```

---

### 15.2 Staff User Experience - Overall
**Test Case ID:** UX-002

**Criteria:**
- [ ] Can easily reply with attachments
- [ ] Can access all client files
- [ ] Documents tab useful
- [ ] Attachment counts helpful
- [ ] No unnecessary restrictions
- [ ] Workflow efficient

**User Feedback:**
```
[Collect feedback from staff users]
```

---

### 15.3 Mobile Responsiveness
**Test Case ID:** UX-003

**Test on mobile device or emulator:**
- [ ] File upload works on mobile
- [ ] Drag-and-drop disabled gracefully (or works)
- [ ] Voice recording works on mobile
- [ ] Preview modals work on small screens
- [ ] Touch interactions smooth
- [ ] UI elements properly sized

**Device Tested:** _____________
**Results:** [ ] Pass [ ] Fail
**Issues:**
```
[List any issues]
```

---

## Test Summary Report

### Test Execution Summary

**Tested By:** ___________________________
**Test Date:** ___________________________
**Build/Version:** _______________________

| Category | Total Tests | Passed | Failed | Skipped | Pass Rate |
|----------|-------------|--------|--------|---------|-----------|
| File Upload | | | | | |
| File Validation | | | | | |
| Voice Notes | | | | | |
| Auto-Document Creation | | | | | |
| Access Control - Portal | | | | | |
| Access Control - Staff | | | | | |
| UI Components | | | | | |
| Client Detail Integration | | | | | |
| Database Integrity | | | | | |
| Performance | | | | | |
| Browser Compatibility | | | | | |
| Security | | | | | |
| Edge Cases | | | | | |
| Regression | | | | | |
| User Experience | | | | | |
| **TOTAL** | | | | | |

---

### Critical Issues Found

| Issue ID | Severity | Description | Status |
|----------|----------|-------------|--------|
| | | | |
| | | | |

---

### Recommendations

**Priority 1 (Must Fix Before Release):**
```
[List critical issues that must be fixed]
```

**Priority 2 (Should Fix Soon):**
```
[List important issues]
```

**Priority 3 (Nice to Have):**
```
[List minor issues or enhancements]
```

---

### Sign-Off

**QA Lead:** _________________________ **Date:** _________
**Development Lead:** _________________ **Date:** _________
**Product Owner:** ____________________ **Date:** _________

---

## Appendix: Quick Test Data

### Portal Users for Testing
```
Portal User A (Client 1):
- Email: portal-user-a@example.com
- Client ID: [INSERT]

Portal User B (Client 2):
- Email: portal-user-b@example.com
- Client ID: [INSERT]
```

### Staff Users for Testing
```
Staff User:
- Email: staff@example.com
- User ID: [INSERT]
```

### Test File Checklist
Prepare these files before testing:
- [ ] small-image.jpg (< 1MB)
- [ ] large-image.png (5-10MB)
- [ ] sample-document.pdf (2-5MB)
- [ ] report.docx (1-2MB)
- [ ] data.xlsx (1-2MB)
- [ ] notes.txt (< 1MB)
- [ ] audio-sample.mp3 (2-3MB)
- [ ] huge-file.zip (> 25MB) - for negative testing
- [ ] malicious.exe - for negative testing

---

**End of QA Testing Checklist**
