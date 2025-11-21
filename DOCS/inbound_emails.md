# Inbound Email to Ticket System - Technical Specification

## Overview
This document outlines the feasibility and architecture for automatically monitoring inbound emails to connected Microsoft Outlook mailboxes, matching senders to customers in The Link, and creating support tickets with email thread grouping.

## Current Infrastructure

### Existing Support
- **Outlook Integration**: System-wide Microsoft Graph API connection via Replit connectors
- **Communications Table**: Already supports `email_received` type with client/person linking
- **People/Client Email Fields**: Multiple email fields (`email`, `email2`, `primaryEmail`) for matching
- **User OAuth Accounts**: Per-user OAuth connection support via `userOauthAccounts` table

### Existing Capabilities
- Send emails via Microsoft Graph API
- User profile retrieval
- Token refresh logic
- Communication logging with metadata support

---

## ✅ What's Possible

### 1. Inbound Email Monitoring
- **Microsoft Graph Webhooks**: Subscribe to mailbox changes via `/me/mailFolders('Inbox')/messages`
- **Real-time Notifications**: Receive webhook callbacks when new emails arrive
- **Existing Infrastructure**: Current Outlook integration can support webhook subscriptions

### 2. Sender to Customer Matching
- **Email Matching**: Query `people` table against `email`, `email2`, `primaryEmail` fields
- **Client Matching**: Also match against `clients.email` field
- **Efficient Lookups**: Database queries to identify known customers

### 3. Email to Client Profile Attachment
- **Communications Table Ready**: 
  - `email_received` type already exists in enum
  - Links to `clientId` and `personId`
  - Fields: `subject`, `content`, `metadata`
  - Stores full email details including thread information

### 4. Ticket Creation System
- **New Table**: Create `tickets` or `support_tickets` table
- **Link to Communication**: Each ticket references communication record(s)
- **Status Tracking**: open, pending, resolved, closed
- **User Assignment**: Assign tickets to users for response

### 5. Email Thread Grouping
- **Conversation ID**: Microsoft Graph provides `conversationId` for email threads
- **Metadata Storage**: Store `conversationId` in `communications.metadata` field
- **Thread Tracking**: Group emails with same `conversationId` to same ticket
- **Reply Tracking**: New communication entries for each reply in thread

---

## ⚠️ Challenges & Considerations

### 1. Webhook Infrastructure Requirements

**Publicly Accessible Endpoint**
- Replit deployments provide public URLs
- Need dedicated webhook endpoint (e.g., `/api/webhooks/outlook`)

**Webhook Lifecycle Management**
- Microsoft Graph webhooks expire after **maximum 3 days**
- Requires automatic renewal logic
- Must handle webhook validation tokens
- Implement retry logic for failed deliveries

**Subscription Storage**
- Track active subscriptions in database
- Monitor expiration times
- Automated renewal before expiry

### 2. Connection Model Decision

**System-Wide (Current)**
- Monitor single shared Outlook inbox
- Uses existing Replit connector integration
- Simpler implementation
- Single point of monitoring

**Per-User (Future)**
- Monitor individual user inboxes
- Uses `userOauthAccounts` table
- More complex but more flexible
- Each user's email becomes support channel

**Recommendation**: Start with system-wide, migrate to per-user in Phase 3

### 3. Email Threading Complexity

**Reply Detection**
- Handle "Re:" and "Fwd:" prefixes
- Parse `In-Reply-To` and `References` headers
- Account for missing or changing conversation IDs

**Conversation History**
- Track full email chains
- Handle split threads
- Manage multiple replies

### 4. Automatic Ticket Creation Strategy

**Challenge**: Fully automatic creation could generate tickets for:
- Spam emails
- Marketing emails
- Newsletter subscriptions
- Non-customer emails

**Options**:
1. **Known Customers Only**: Only create tickets when sender matches known person/client
2. **Manual Review**: Queue unmatched emails for review before ticket creation
3. **Smart Filtering**: Implement rules to skip automated emails
4. **Approval Flow**: Create draft tickets requiring approval

**Recommendation**: Start with "Known Customers Only" approach

---

## 🚀 Recommended Architecture

### Workflow Overview

```
1. Microsoft Graph Webhook → /api/webhooks/outlook
2. Webhook receives new email notification (contains email ID)
3. Fetch full email details via Graph API using email ID
4. Extract sender email address
5. Query people/clients tables for matching email
6. IF match found:
   a. Create communication record (type: email_received)
   b. Store full email in communication (subject, content, metadata)
   c. Check if conversationId exists in active tickets
   d. IF conversation exists:
      - Link communication to existing ticket
      - Update ticket status if needed
   e. IF new conversation:
      - Create new ticket
      - Link communication to new ticket
      - Assign ticket based on client relationships
   f. Send notification to assigned user
7. IF no match found:
   - Log unknown sender (optional review queue)
8. Return 200 OK to Microsoft (acknowledge webhook)
```

### Database Schema Additions

#### Tickets Table
```typescript
export const tickets = pgTable("tickets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").references(() => clients.id, { onDelete: "cascade" }),
  personId: varchar("person_id").references(() => people.id, { onDelete: "set null" }),
  conversationId: varchar("conversation_id").notNull(), // Microsoft Graph conversation ID
  subject: varchar("subject").notNull(),
  status: varchar("status").notNull().default("open"), // open, pending, resolved, closed
  priority: varchar("priority").default("normal"), // low, normal, high, urgent
  assignedUserId: varchar("assigned_user_id").references(() => users.id, { onDelete: "set null" }),
  createdByUserId: varchar("created_by_user_id").references(() => users.id), // Who created (system for auto)
  firstEmailId: varchar("first_email_id").references(() => communications.id), // Original email
  lastResponseAt: timestamp("last_response_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Junction table linking tickets to communications
export const ticketCommunications = pgTable("ticket_communications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ticketId: varchar("ticket_id").notNull().references(() => tickets.id, { onDelete: "cascade" }),
  communicationId: varchar("communication_id").notNull().references(() => communications.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow(),
});

// Webhook subscriptions tracking
export const outlookWebhookSubscriptions = pgTable("outlook_webhook_subscriptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  subscriptionId: varchar("subscription_id").notNull().unique(), // Microsoft subscription ID
  resource: varchar("resource").notNull(), // e.g., "me/mailFolders('Inbox')/messages"
  changeType: varchar("change_type").notNull(), // "created"
  expiresAt: timestamp("expires_at").notNull(),
  clientState: varchar("client_state"), // Validation token
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  renewedAt: timestamp("renewed_at"),
});
```

### API Endpoints Needed

1. **POST /api/webhooks/outlook** - Receive webhook notifications
2. **POST /api/webhooks/outlook/setup** - Initialize webhook subscription
3. **POST /api/webhooks/outlook/renew** - Renew expiring subscription
4. **GET /api/tickets** - List all tickets
5. **GET /api/tickets/:id** - Get ticket details with communications
6. **PATCH /api/tickets/:id** - Update ticket (status, assignment, etc.)
7. **POST /api/tickets/:id/reply** - Send reply to ticket (creates email)

---

## 📋 Phased Implementation Plan

### Phase 1: MVP (Core Functionality)
**Goal**: Basic inbound email to ticket creation

**Features**:
- ✅ Set up Microsoft Graph webhook subscription
- ✅ Create webhook endpoint to receive notifications
- ✅ Fetch email details from Graph API
- ✅ Match sender email to people/clients
- ✅ Create communication record for matched emails
- ✅ Create basic ticket system with statuses
- ✅ Link communications to tickets
- ✅ Simple ticket list view in UI

**Estimated Effort**: 2-3 days

### Phase 2: Enhanced Experience
**Goal**: Thread grouping and better UX

**Features**:
- ✅ Conversation ID tracking
- ✅ Thread grouping (multiple emails to same ticket)
- ✅ Auto-assign tickets based on:
  - Client service owner
  - Primary contact relationships
  - Previous ticket assignments
- ✅ Email notifications to assigned users
- ✅ Ticket detail page with full email thread
- ✅ Quick reply functionality

**Estimated Effort**: 2-3 days

### Phase 3: Advanced Features
**Goal**: Multi-user and intelligent filtering

**Features**:
- ✅ Per-user inbox monitoring (via `userOauthAccounts`)
- ✅ Smart filtering to ignore:
  - Marketing emails (unsubscribe links)
  - Automated emails (noreply addresses)
  - Newsletters
- ✅ Unknown sender review queue
- ✅ Ticket templates
- ✅ SLA tracking (response times)
- ✅ Ticket search and filtering
- ✅ Ticket analytics dashboard

**Estimated Effort**: 3-4 days

---

## 🔧 Technical Implementation Details

### Webhook Setup Process

```javascript
// Setup webhook subscription
async function setupOutlookWebhook() {
  const graphClient = await getUncachableOutlookClient();
  
  const subscription = {
    changeType: 'created',
    notificationUrl: 'https://yourapp.replit.app/api/webhooks/outlook',
    resource: 'me/mailFolders(\'Inbox\')/messages',
    expirationDateTime: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days
    clientState: 'secretValidationToken123' // For validation
  };
  
  const result = await graphClient.api('/subscriptions').post(subscription);
  
  // Store subscription in database
  await storage.createWebhookSubscription({
    subscriptionId: result.id,
    resource: subscription.resource,
    changeType: subscription.changeType,
    expiresAt: new Date(result.expirationDateTime),
    clientState: subscription.clientState,
  });
}
```

### Webhook Renewal (Cron Job)

```javascript
// Run every 24 hours to renew subscriptions expiring within 48 hours
async function renewExpiringSubscriptions() {
  const expiringSubscriptions = await storage.getSubscriptionsExpiringBefore(
    new Date(Date.now() + 48 * 60 * 60 * 1000)
  );
  
  for (const sub of expiringSubscriptions) {
    const graphClient = await getUncachableOutlookClient();
    
    // Renew for another 3 days
    const newExpiry = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    
    await graphClient.api(`/subscriptions/${sub.subscriptionId}`).patch({
      expirationDateTime: newExpiry.toISOString()
    });
    
    await storage.updateWebhookSubscription(sub.id, {
      expiresAt: newExpiry,
      renewedAt: new Date(),
    });
  }
}
```

### Webhook Handler

```javascript
// POST /api/webhooks/outlook
async function handleOutlookWebhook(req, res) {
  // Validation request from Microsoft
  if (req.query.validationToken) {
    return res.send(req.query.validationToken);
  }
  
  const { value: notifications } = req.body;
  
  for (const notification of notifications) {
    // Verify clientState
    const subscription = await storage.getWebhookSubscription(notification.subscriptionId);
    if (notification.clientState !== subscription.clientState) {
      console.error('Invalid client state');
      continue;
    }
    
    // Process the email
    await processInboundEmail(notification.resourceData.id);
  }
  
  res.status(200).send('OK');
}

async function processInboundEmail(emailId) {
  const graphClient = await getUncachableOutlookClient();
  
  // Fetch full email details
  const email = await graphClient.api(`/me/messages/${emailId}`).get();
  
  const senderEmail = email.from.emailAddress.address.toLowerCase();
  
  // Try to match to person
  const person = await storage.findPersonByEmail(senderEmail);
  
  if (!person) {
    // No match - log and skip or queue for review
    console.log('Unknown sender:', senderEmail);
    return;
  }
  
  // Get client associations for this person
  const clientAssociations = await storage.getClientPeopleByPersonId(person.id);
  const clientId = clientAssociations[0]?.clientId; // Use first client
  
  // Create communication record
  const communication = await storage.createCommunication({
    clientId,
    personId: person.id,
    userId: 'system', // Or get fallback user
    type: 'email_received',
    subject: email.subject,
    content: email.body.content,
    actualContactTime: new Date(email.receivedDateTime),
    metadata: {
      emailId: email.id,
      conversationId: email.conversationId,
      from: email.from,
      to: email.toRecipients,
      hasAttachments: email.hasAttachments,
    },
  });
  
  // Check if ticket exists for this conversation
  let ticket = await storage.getTicketByConversationId(email.conversationId);
  
  if (!ticket) {
    // Create new ticket
    ticket = await storage.createTicket({
      clientId,
      personId: person.id,
      conversationId: email.conversationId,
      subject: email.subject,
      status: 'open',
      priority: 'normal',
      firstEmailId: communication.id,
      createdByUserId: 'system',
    });
    
    // Auto-assign based on client service owner
    const assignedUser = await getTicketAssignee(clientId);
    if (assignedUser) {
      await storage.updateTicket(ticket.id, { assignedUserId: assignedUser.id });
      // Send notification
      await sendTicketNotification(assignedUser, ticket, communication);
    }
  }
  
  // Link communication to ticket
  await storage.linkCommunicationToTicket(ticket.id, communication.id);
  
  // Update ticket last response time
  await storage.updateTicket(ticket.id, { 
    lastResponseAt: new Date(email.receivedDateTime),
    updatedAt: new Date(),
  });
}
```

---

## 🔐 Security Considerations

1. **Webhook Validation**: Verify `clientState` token on all webhook requests
2. **HTTPS Only**: Ensure webhook endpoint uses HTTPS
3. **Rate Limiting**: Implement rate limiting on webhook endpoint
4. **Token Security**: Store Microsoft Graph tokens encrypted
5. **Access Control**: Only allow authorized users to view tickets
6. **Email Content**: Sanitize HTML content before displaying

---

## 📊 Monitoring & Maintenance

### Key Metrics to Track
- Webhook subscription health (active/expired)
- Email processing success rate
- Ticket creation rate
- Average response time
- Unknown sender frequency

### Automated Tasks
- Webhook renewal (daily cron job)
- Subscription health check (hourly)
- Failed webhook retry queue
- Old ticket archival

### Logging
- All webhook requests (with validation status)
- Email processing attempts (success/failure)
- Ticket creation and updates
- Subscription renewals

---

## 🎯 Success Criteria

**MVP Success**:
- ✅ Webhooks reliably receive email notifications
- ✅ 95%+ of known customer emails create tickets
- ✅ Tickets properly linked to clients and persons
- ✅ Basic ticket list accessible to users

**Phase 2 Success**:
- ✅ Email threads properly grouped into single tickets
- ✅ Auto-assignment works for 80%+ of tickets
- ✅ Users receive timely notifications

**Phase 3 Success**:
- ✅ Less than 5% false positive tickets (spam/marketing)
- ✅ Multi-user inbox monitoring functional
- ✅ Ticket analytics provide actionable insights

---

## 📝 Future Enhancements

- AI-powered email categorization and priority detection
- Automatic response suggestions
- Email signature extraction and contact info updates
- Attachment handling and storage
- Integration with other email providers (Gmail, etc.)
- Customer portal for self-service ticket viewing
- SMS integration for ticket notifications
- Ticket escalation rules
- Customer satisfaction surveys after ticket closure

---

## 🔗 Related Documentation

- Microsoft Graph API: https://learn.microsoft.com/en-us/graph/api/subscription-post-subscriptions
- Webhook Change Notifications: https://learn.microsoft.com/en-us/graph/webhooks
- Current Outlook Integration: `server/utils/outlookClient.ts`
- Communications Schema: `shared/schema.ts` (line 1710)

---

**Document Version**: 1.0  
**Last Updated**: October 3, 2025  
**Status**: Proposal - Not Yet Implemented
