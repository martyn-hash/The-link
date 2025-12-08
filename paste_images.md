# Paste Images into Email Body - Implementation Plan

## Overview
Add support for pasting images directly into email composition areas across the application. Images will be uploaded to object storage and embedded inline in the email HTML.

## Affected Areas

### 1. Comms Tab (EmailDialog)
- Location: `client/src/pages/client-detail/components/communications/dialogs/EmailDialog.tsx`
- Uses: `TiptapEditor` component

### 2. Comms from Kanban Modal
- Location: `client/src/components/ClientCommsPanel.tsx`
- Uses: Same `EmailDialog` component (shares implementation)

### 3. Stage Change Notifications
- Location: `client/src/components/stage-change-notification-modal.tsx`
- Uses: `TiptapEditor` component

## Technical Implementation

### Phase 1: Backend - Image Upload Endpoint

**New Route: `/api/upload/inline-image`**
- Accept base64 image data from paste events
- Validate image type (JPEG, PNG, GIF, WebP)
- Limit image size (max 5MB recommended)
- Upload to object storage public bucket
- Return publicly accessible URL

**File:** `server/routes/upload.ts` (or existing route file)

### Phase 2: Frontend - Tiptap Image Extension

**Install Package:**
```bash
npm install @tiptap/extension-image
```

**Modify `client/src/lib/tiptapSetup.ts`:**
- Add Image extension to getTiptapExtensions()
- Configure with inline display

### Phase 3: Paste Handler Implementation

**Modify `client/src/components/TiptapEditor.tsx`:**
- Add paste event handler to detect images
- Convert pasted images to base64
- Call upload endpoint
- Insert image into editor at cursor position
- Show loading state during upload

### Phase 4: Email Service Updates

**Modify `server/emailService.ts`:**
- Update DOMPurify configuration to allow `<img>` tags with `src` attribute
- Ensure image URLs are preserved in sanitization

## Implementation Details

### Backend Upload Endpoint

```typescript
// Validation schema
const inlineImageSchema = z.object({
  imageData: z.string(), // base64 data URL
  filename: z.string().optional(),
});

// Endpoint logic
1. Parse and validate base64 data
2. Extract mime type from data URL
3. Generate unique filename
4. Upload to object storage: `.private/inline-images/{uuid}.{ext}`
5. Return signed URL or public URL
```

### Frontend Paste Handler

```typescript
// In TiptapEditor, add editor props:
handlePaste: (view, event, slice) => {
  const items = event.clipboardData?.items;
  for (const item of items) {
    if (item.type.startsWith('image/')) {
      // Read as base64, upload, insert
      return true; // handled
    }
  }
  return false; // not handled, let Tiptap process
}
```

### Image Extension Config

```typescript
import Image from '@tiptap/extension-image';

Image.configure({
  inline: true,
  allowBase64: false, // Force URL-based images
  HTMLAttributes: {
    class: 'inline-image',
    style: 'max-width: 100%; height: auto;',
  },
})
```

## Security Considerations

1. **File Type Validation** - Only allow image MIME types
2. **Size Limits** - Max 5MB per image to prevent abuse
3. **Sanitization** - Allow only `src`, `alt`, `width`, `height`, `style` attributes on images
4. **Rate Limiting** - Consider rate limiting uploads per user

## Testing Checklist

- [ ] Paste image from clipboard in EmailDialog
- [ ] Paste image in stage change notification modal
- [ ] Verify image appears in sent email (SendGrid)
- [ ] Verify image appears in sent email (Outlook)
- [ ] Test with different image formats (PNG, JPEG, GIF)
- [ ] Test size limit enforcement
- [ ] Test invalid paste (non-image) still works normally

## Task Breakdown

1. Install @tiptap/extension-image package
2. Create backend inline image upload endpoint
3. Add Image extension to tiptapSetup.ts
4. Implement paste handler in TiptapEditor
5. Update DOMPurify config in emailService.ts
6. Add toolbar button for manual image insertion (optional)
7. Test across all three email areas
