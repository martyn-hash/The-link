# Test User Credentials - File Attachments QA Testing

**Created:** October 10, 2025
**Purpose:** QA testing of file attachments and voice notes feature

---

## Quick Access Summary

| User Type | Email | Password | Client | Login URL |
|-----------|-------|----------|--------|-----------|
| **Staff** | georgewandhe@gmail.com | TestPassword123 | All clients | `/login` |
| **Portal A** | georgewandhe@icloud.com | (verification code) | Client A | `/portal` |
| **Portal B** | george@softwaresynth.com | (verification code) | Client B | `/portal` |

---

## Staff User (Full Access)

### Login Credentials
- **Email:** `georgewandhe@gmail.com`
- **Password:** `TestPassword123`
- **User ID:** `qa-test-staff-user`

### Authentication Method
- **Primary:** Email + Password
- **Alternative:** Magic link (4-digit code sent to email)

### Login Steps
1. Navigate to `/login`
2. Enter email: `georgewandhe@gmail.com`
3. Enter password: `TestPassword123`
4. Click "Log in"

### Access Level
- ✅ **Admin user** (isAdmin: true)
- ✅ Can see admin menu
- ✅ Can access **ALL clients**
- ✅ Can upload attachments to any client's threads
- ✅ Can download attachments from any client
- ✅ No access restrictions

### Use For Testing
- Access control: Staff can access all client attachments
- Upload attachments to both Client A and Client B threads
- View documents in Client Detail pages for both clients
- Test staff-to-client messaging with attachments

---

## Portal User A (Client A Access Only)

### Login Credentials
- **Email:** `georgewandhe@icloud.com`
- **User ID:** `qa-test-portal-user-a`
- **Client ID:** `qa-test-client-a`
- **Client Name:** QA Test Client A

### Authentication Method
- **Verification code** (6-digit code sent to email)
- Expires in 10 minutes
- JWT-based session (180 days)

### Login Steps
1. Navigate to `/portal`
2. Enter email: `georgewandhe@icloud.com`
3. Click "Send verification code"
4. Check email for 6-digit code
5. Enter code and submit
6. **Development shortcut:** Check server logs for code
   ```bash
   # Look for: [Portal Auth] Verification code for georgewandhe@icloud.com: 123456
   ```

### Access Level
- ⚠️ **Restricted to Client A only**
- ✅ Can upload attachments to Client A threads
- ✅ Can download Client A attachments
- ❌ **Cannot** access Client B attachments
- ❌ Attempting to access Client B files returns **403 Forbidden**

### Test Thread
- **Thread ID:** `qa-thread-client-a`
- **Subject:** "Test Thread - Client A"
- **Status:** Open

### Use For Testing
- Portal user file upload functionality
- Access control: Can only access own client's files
- Isolation testing: Verify cannot access Client B attachments
- Auto-document creation for portal uploads
- Voice note recording and playback

---

## Portal User B (Client B Access Only)

### Login Credentials
- **Email:** `george@softwaresynth.com`
- **User ID:** `qa-test-portal-user-b`
- **Client ID:** `qa-test-client-b`
- **Client Name:** QA Test Client B

### Authentication Method
- **Verification code** (6-digit code sent to email)
- Same process as Portal User A

### Login Steps
1. Navigate to `/portal`
2. Enter email: `george@softwaresynth.com`
3. Click "Send verification code"
4. Check email for 6-digit code
5. Enter code and submit
6. **Development shortcut:** Check server logs for code

### Access Level
- ⚠️ **Restricted to Client B only**
- ✅ Can upload attachments to Client B threads
- ✅ Can download Client B attachments
- ❌ **Cannot** access Client A attachments
- ❌ Attempting to access Client A files returns **403 Forbidden**

### Test Thread
- **Thread ID:** `qa-thread-client-b`
- **Subject:** "Test Thread - Client B"
- **Status:** Open

### Use For Testing
- Portal user file upload functionality
- Access control: Can only access own client's files
- Isolation testing: Verify cannot access Client A attachments
- Cross-client isolation verification
- Voice note features

---

## Testing Scenarios

### 1. Staff User - Universal Access
**Test:** Staff can access all attachments

**Steps:**
1. Log in as staff user (georgewandhe@gmail.com)
2. Upload attachment to Client A thread
3. Upload attachment to Client B thread
4. Verify both uploads succeed
5. Download attachments from both clients
6. Navigate to Client Detail pages for both clients
7. Verify can see all documents

**Expected:** All operations succeed ✅

---

### 2. Portal User A - Own Client Access
**Test:** Portal user can access own client's files

**Steps:**
1. Log in as Portal User A (georgewandhe@icloud.com)
2. Navigate to Messages
3. Upload attachment to Client A thread
4. Send message
5. Verify attachment appears in message
6. Download attachment
7. Check Documents tab (if visible)

**Expected:** All operations succeed ✅

---

### 3. Portal User A - Cannot Access Client B
**Test:** Portal user CANNOT access other client's files

**Steps:**
1. Log in as Portal User B (george@softwaresynth.com)
2. Upload attachment to Client B thread
3. Note the attachment URL or object path
4. Log out
5. Log in as Portal User A (georgewandhe@icloud.com)
6. Try to access Portal User B's attachment URL directly
   - Copy URL from browser network tab
   - Or construct: `/objects/{objectPath}`

**Expected:**
- ❌ 403 Forbidden error
- ❌ Error message: "You do not have permission to access this file"
- ❌ File not downloaded

---

### 4. Auto-Document Creation
**Test:** Attachments auto-create document records

**Steps:**
1. Log in as Portal User A
2. Upload 2 attachments (1 image, 1 PDF) to thread
3. Send message
4. Check database:
   ```sql
   SELECT * FROM documents
   WHERE source = 'message_attachment'
   AND client_id = 'qa-test-client-a'
   ORDER BY uploaded_at DESC;
   ```
5. Verify:
   - 2 document records created
   - `source` = 'message_attachment'
   - `message_id` populated
   - `thread_id` = 'qa-thread-client-a'
   - "Message Attachments" folder created

**Expected:** All documents created correctly ✅

---

### 5. Voice Notes
**Test:** Voice recording and playback

**Steps:**
1. Log in as Portal User A
2. Click microphone icon
3. Grant microphone permission
4. Record 10 seconds of audio
5. Stop recording
6. Preview playback
7. Test re-record
8. Send voice note
9. Verify voice note appears in thread
10. Play voice note from message

**Expected:** All voice note features work ✅

---

## Database Reference

### Clients
```sql
SELECT * FROM clients WHERE name LIKE 'QA Test%';
```

| ID | Name | Email |
|----|------|-------|
| qa-test-client-a | QA Test Client A | client-a@test.com |
| qa-test-client-b | QA Test Client B | client-b@test.com |

### Users (Staff)
```sql
SELECT id, email, first_name, is_admin FROM users
WHERE email = 'georgewandhe@gmail.com';
```

| ID | Email | Name | Admin |
|----|-------|------|-------|
| qa-test-staff-user | georgewandhe@gmail.com | George (Staff) Wandhe | true |

### Client Portal Users
```sql
SELECT id, email, name, client_id FROM client_portal_users
WHERE email IN ('georgewandhe@icloud.com', 'george@softwaresynth.com');
```

| ID | Email | Name | Client ID |
|----|-------|------|-----------|
| qa-test-portal-user-a | georgewandhe@icloud.com | George (Portal User A) | qa-test-client-a |
| qa-test-portal-user-b | george@softwaresynth.com | George (Portal User B) | qa-test-client-b |

### Message Threads
```sql
SELECT id, client_id, subject FROM message_threads
WHERE id LIKE 'qa-thread%';
```

| ID | Client ID | Subject |
|----|-----------|---------|
| qa-thread-client-a | qa-test-client-a | Test Thread - Client A |
| qa-thread-client-b | qa-test-client-b | Test Thread - Client B |

---

## Useful Database Queries

### Check documents created from attachments
```sql
SELECT
  d.id,
  d.file_name,
  d.source,
  d.message_id,
  d.thread_id,
  d.client_id,
  c.name as client_name,
  d.uploaded_at
FROM documents d
JOIN clients c ON d.client_id = c.id
WHERE d.source = 'message_attachment'
AND d.client_id IN ('qa-test-client-a', 'qa-test-client-b')
ORDER BY d.uploaded_at DESC;
```

### Check Message Attachments folder
```sql
SELECT * FROM document_folders
WHERE name = 'Message Attachments'
AND client_id IN ('qa-test-client-a', 'qa-test-client-b');
```

### View messages with attachments
```sql
SELECT
  m.id,
  m.content,
  m.attachments,
  mt.subject as thread,
  c.name as client
FROM messages m
JOIN message_threads mt ON m.thread_id = mt.id
JOIN clients c ON mt.client_id = c.id
WHERE mt.client_id IN ('qa-test-client-a', 'qa-test-client-b')
AND m.attachments IS NOT NULL
AND jsonb_array_length(m.attachments) > 0
ORDER BY m.created_at DESC;
```

### Delete test data (cleanup)
```sql
-- WARNING: This will delete all test data
DELETE FROM client_portal_users WHERE email IN ('georgewandhe@icloud.com', 'george@softwaresynth.com');
DELETE FROM users WHERE email = 'georgewandhe@gmail.com';
DELETE FROM message_threads WHERE id LIKE 'qa-thread%';
DELETE FROM clients WHERE name IN ('QA Test Client A', 'QA Test Client B');
-- Note: Documents and messages will cascade delete
```

---

## Development Tips

### Getting Verification Codes Quickly
When testing portal login in development:

1. **Check server logs** for verification codes:
   ```bash
   # The server logs codes in development mode
   [Portal Auth] Verification code for georgewandhe@icloud.com: 123456
   ```

2. **Alternative:** Check email (if SendGrid configured)

### Resetting Users
To reset a user's verification code:
```sql
UPDATE client_portal_users
SET verification_code = NULL, code_expiry = NULL
WHERE email = 'georgewandhe@icloud.com';
```

### Testing Access Control
Use browser DevTools Network tab to:
1. Copy attachment URL
2. Try accessing in different user session
3. Verify 403 response

### Quick Login Script
Save this as a bookmark for quick testing:
```javascript
// Staff login
fetch('/api/login', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({
    email: 'georgewandhe@gmail.com',
    password: 'TestPassword123'
  })
}).then(r => r.json()).then(console.log);
```

---

## Troubleshooting

### "Invalid email or password" (Staff)
- Verify password is exactly: `TestPassword123` (case-sensitive)
- Check database: `SELECT email, password_hash FROM users WHERE email = 'georgewandhe@gmail.com';`
- Password hash should start with `$2b$12$`

### "Invalid or expired verification code" (Portal)
- Code expires in 10 minutes
- Request new code
- Check server logs for code (development only)
- Verify email is correct

### "403 Forbidden" on attachment download
- **Expected behavior** when testing access control
- Portal users should only access their own client's files
- Staff users should have universal access

### No verification code email received
1. Check server logs (development mode prints codes)
2. Verify SendGrid configured: `process.env.SENDGRID_API_KEY`
3. Check email spam folder
4. Verify portal user exists in database

### Attachments not creating documents
1. Check server logs for errors
2. Verify migration ran: `SELECT column_name FROM information_schema.columns WHERE table_name = 'documents' AND column_name = 'message_id';`
3. Check auto-creation integration in routes.ts
4. Query documents table: `SELECT * FROM documents WHERE source = 'message_attachment';`

---

## Security Notes

### Password Storage
- Staff passwords stored as bcrypt hash (12 rounds)
- Never store plain text passwords
- Test password: `TestPassword123` → Hash: `$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5LS2LhQY9Tfaa`

### Portal Authentication
- JWT tokens expire in 180 days
- Verification codes expire in 10 minutes
- Magic links expire in 15 minutes
- Codes are single-use (cleared after verification)

### Access Control
- Portal users: Restricted by `clientId` foreign key
- Staff users: No client restrictions
- Middleware validates access on every request
- 403 Forbidden for unauthorized access attempts

---

## Next Steps

1. ✅ Run through QA Testing Checklist (`DOCS/QA_TESTING_CHECKLIST.md`)
2. ✅ Test all file upload scenarios
3. ✅ Verify access control isolation
4. ✅ Test voice note functionality
5. ✅ Check auto-document creation
6. ✅ Test UI components (preview, player, etc.)
7. ✅ Verify database integrity
8. ✅ Test across different browsers

---

## Cleanup Script

When QA testing is complete, run this to remove test data:

```bash
psql $DATABASE_URL << 'EOF'
DELETE FROM client_portal_users WHERE email IN ('georgewandhe@icloud.com', 'george@softwaresynth.com');
DELETE FROM users WHERE email = 'georgewandhe@gmail.com';
DELETE FROM message_threads WHERE id LIKE 'qa-thread%';
DELETE FROM clients WHERE name IN ('QA Test Client A', 'QA Test Client B');
EOF
```

---

**Created by:** Claude Code Assistant
**Date:** October 10, 2025
**Related Docs:**
- `DOCS/QA_TESTING_CHECKLIST.md` - Full QA test cases
- `DOCS/IMPLEMENTATION_COMPLETE.md` - Feature implementation details
- `DOCS/ATTACHMENT_SYSTEM_DOCUMENTATION.md` - System documentation
- `db/seed_test_users.sql` - SQL script to recreate users
