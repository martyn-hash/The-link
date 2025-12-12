# Queries Feature - User Guide

The Queries feature helps you manage bookkeeping questions efficiently. Instead of endless email threads, you can upload transaction queries, organise them into groups, send them to clients in one go, and track responses automatically. This saves hours of chasing and keeps everything in one place.

---

## Getting Started with Queries

Every project has a Queries tab. This is where you'll add questions about transactions that need clarification from your client.

*Insert Screenshot of the Queries tab showing the main interface here.*

### Understanding Query Status

Each query moves through a simple workflow:

| Status | What it Means |
|--------|---------------|
| **Open** | You've added the query but haven't sent it yet |
| **Staff Answered** | Your team has added an internal answer or note |
| **Sent to Client** | The query has been emailed to the client |
| **Client Answered** | The client has responded |
| **Resolved** | You've reviewed the response and marked it complete |

The status badges help you see at a glance where each query stands.

---

## Uploading Queries

You can add queries one at a time, or upload many at once from a spreadsheet. Bulk uploading is much faster when you have a lot of transactions to query.

### Adding a Single Query

1. Click the **Add Query** button
2. Fill in the transaction details:
   - **Date** - When the transaction occurred
   - **Description** - What the transaction says on the bank statement
   - **Money In/Out** - The amount (helps the client identify the transaction)
   - **Our Query** - Your question for the client
   - **Internal Comment** - Notes for your team (the client won't see this)
3. Click **Save**

*Insert Screenshot of the Add Query dialog here.*

### Bulk Importing from Excel or CSV

This is the fastest way to add many queries at once.

1. Click the **Import** button (looks like an upload icon)
2. Choose your file (CSV or Excel format)
3. The system will try to match your columns automatically
4. Review the column mapping and adjust if needed
5. Preview your queries before importing

*Insert Screenshot of the column mapping screen here.*

#### Supported Column Names

The system recognises common column names like:
- **Date** - "Date", "Transaction Date"
- **Description** - "Description", "Details", "Desc"
- **Money In** - "Credit", "Income", "Receipts", "Money In"
- **Money Out** - "Debit", "Expense", "Payments", "Money Out"
- **Query** - "Query", "Question", "Notes", "Comments"

If your columns have different names, simply select the correct mapping from the dropdown.

---

## Scrolling & Deleting from Preview

Before you confirm the import, you can review all the queries that will be created.

### Reviewing Your Import

- Scroll through the preview list to check the data looks correct
- Look for any date parsing issues or missing information
- The system shows you exactly what will be created

### Removing Items Before Import

If you spot something that shouldn't be imported:

1. Find the row in the preview
2. Click the **X** button next to it to remove it from the import
3. The query will not be created
4. You can remove as many as you need before clicking Import

This is helpful when your spreadsheet contains some transactions that don't need querying.

*Insert Screenshot of the preview screen with delete buttons visible here.*

---

## Organising Queries with Groups

Groups help you organise related queries together. For example, you might group all queries about the same supplier, or all cash withdrawals.

### Creating a Group Manually

1. Select the queries you want to group (tick the checkboxes)
2. Click the **Create Group** button (folder icon)
3. Enter a name for the group
4. Add a description (this helps you remember what the group is for)
5. Click **Create**

The selected queries will now appear together under that group name.

*Insert Screenshot of the Create Group dialog here.*

### Expanding and Collapsing Groups

- Click on a group header to expand or collapse it
- Collapsed groups show a summary of how many queries are inside
- Expanding shows all the individual queries

### Removing a Query from a Group

If a query was grouped by mistake:

1. Find the query within its group
2. Click the three-dot menu on the query row
3. Select **Remove from Group**

The query will become ungrouped but won't be deleted.

---

## Auto-Group: Let the System Organise for You

When you have many queries, Auto-Group can save significant time. It analyses your query descriptions and suggests groups based on common patterns.

### How Auto-Group Works

The system looks at the first few characters of each description. Transactions that start the same way (like "AMAZON" or "TESCO") get proposed as a group.

### Using Auto-Group

1. Click the **Auto-Group** button (magic wand icon)
2. Choose the prefix length (how many characters to match)
   - Shorter = broader groups
   - Longer = more specific groups
3. Click **Analyse**
4. Review the suggested groups

*Insert Screenshot of the Auto-Group analysis results here.*

### Reviewing Auto-Group Suggestions

For each suggested group, you can:

- **Rename the group** - Edit the suggested name to something clearer
- **Add a description** - Explain what this group contains
- **Deselect individual queries** - Untick queries that don't belong
- **Skip the whole group** - Untick the checkbox if you don't want it

Once you're happy, click **Create Groups** to apply your selections.

### What About Ungrouped Queries?

The system will tell you how many queries couldn't be grouped. These are usually unique transactions that don't match any pattern. You can group these manually later or leave them ungrouped.

---

## Filtering and Searching

When you have many queries, filters help you find what you need quickly.

### Filtering by Status

Use the status dropdown to show only:
- **All** - Everything
- **Open** - Not yet sent
- **Sent to Client** - Awaiting response
- **Client Answered** - Ready for your review
- **Resolved** - Completed

### Filtering by Money In / Money Out

Click the filter icons to show only:
- **All amounts** - Show everything
- **Money In** - Show only credits/income
- **Money Out** - Show only debits/expenses

This is useful when you want to focus on one type of transaction.

*Insert Screenshot of the amount filter buttons here.*

### Filtering by Group

If you have groups, use the Group dropdown to show only queries from a specific group.

### Searching with Text

Type in the search box to find queries by:
- Description text
- The query question text

The search updates as you type. Clear it by clicking the X button.

---

## Sending Queries to Your Client

Once your queries are ready, you can send them to your client in one professional email.

### Send to Client - Step by Step

1. **Select the queries** you want to send (tick the checkboxes)
2. Click **Send to Client**
3. The Send Options panel opens

*Insert Screenshot of the Send Options panel here.*

### Selecting the Client Email

1. Choose who should receive the queries from the dropdown
2. This list shows people linked to the client with their email addresses
3. If the right person isn't listed, you'll need to add them in the client's People tab first

### Adding Top and Bottom Text to Emails

Personalise your email with:

- **Introduction text** - Appears at the top, before the queries (e.g., a friendly greeting)
- **Sign-off text** - Appears at the bottom, after the queries (e.g., your signature)

You can edit these each time, or the system will use sensible defaults.

*Insert Screenshot of the email introduction editor here.*

### Choosing Your Reminder Schedule

Don't let clients forget! Set up automatic reminders:

1. Toggle **Include Online Response Link** on (recommended)
2. Set how many days the link should be valid
3. Configure reminders:
   - **Email reminders** - Follow-up emails on specific dates
   - **SMS reminders** - Text message nudges
   - **Voice reminders** - Automated phone call reminders (if available)

*Insert Screenshot of the reminder configuration panel here.*

You can add multiple reminders at different intervals. For example:
- Day 2: Email reminder
- Day 5: SMS reminder
- Day 7: Final email

#### Editing or Removing Reminders Before Sending

Each reminder shows in a list. You can:
- Toggle reminders on/off individually
- Change the date
- Change the channel (email/SMS/voice)
- Remove unwanted reminders

Once you're happy, click **Send** to dispatch the email and schedule the reminders.

---

## What Happens for the Client

When you send queries, your client receives a friendly email with a link to respond.

### The Client's Experience

1. They receive an email listing the queries
2. They click the link to open the response page
3. They see each query as a card they can swipe through (on mobile) or scroll through
4. For each query, they type their answer in the response box
5. They can upload attachments (receipts, invoices) if needed
6. Their answers save automatically as they type
7. When done, they click **Submit All Responses**

*Insert Screenshot of the client query response page here.*

### Grouped Queries for Clients

If you grouped similar queries, the client sees them together. They can provide one answer that applies to all queries in the group, saving them time.

### Progress Tracking

The client sees a progress bar showing how many queries they've answered. A celebration animation plays when they complete everything!

---

## What Does 'Notify' Do?

The Notify button lets you alert your team when queries need attention.

### When to Use Notify

- When a client has responded and someone needs to review
- When urgent queries need prioritising
- When you want to draw a colleague's attention to specific items

### How to Notify

1. Click the **Notify** button
2. Select which team members to alert
3. Add an optional message explaining why you're notifying them
4. Click **Send Notification**

They'll receive an alert pointing them to the queries.

---

## The Reminders Tab

Next to the Queries tab, you'll see a **Reminders** tab with a count badge. This shows all scheduled reminders for this project.

### Viewing Scheduled Reminders

The Reminders tab displays:
- Each reminder's scheduled date and time
- The channel (email/SMS/voice)
- Current status (pending, sent, cancelled, failed)
- Who created the reminder
- Which client will receive it

*Insert Screenshot of the Scheduled Reminders tab here.*

### Cancelling All Scheduled Reminders

If the client has responded or circumstances have changed:

1. Open the Reminders tab
2. Find the reminders you want to cancel
3. Click the **Cancel** button on each one

Cancelled reminders won't be sent, but you'll still see them for your records.

### Adding Extra Reminders Later

If you need to send another reminder after the original schedule:

1. Go to the Reminders tab
2. Click **Add Reminder**
3. Choose the date, time, and channel
4. Click **Schedule**

### Editing Reminders

For pending reminders, you can:
- Change the scheduled date/time
- Switch the channel
- Edit the message content

Click the pencil icon on any pending reminder to make changes.

---

## Answering Queries as an Internal User

Sometimes your team can answer a query without needing to ask the client.

### Adding a Staff Answer

1. Find the query in the list
2. Click to expand or open it
3. Add your answer in the response field
4. Change the status to **Staff Answered**
5. Save

This marks the query as having an internal answer. You can still send it to the client later if needed.

### Answering a Whole Group at Once

If all queries in a group have the same answer:

1. Click the group header
2. Select **Answer Group**
3. Enter the answer that applies to all queries
4. Click **Apply to All**

Every query in the group gets the same answer instantly.

---

## Marking Queries as Resolved

Once you've reviewed a client's response and are satisfied:

1. Find the query (or select multiple queries)
2. Click the **Resolve** button or change status to **Resolved**
3. The query moves to the resolved list

Resolved queries won't clutter your active view but remain searchable if you need to check them later.

### Bulk Resolving

To resolve many queries at once:

1. Tick all the queries you want to resolve
2. Click the status dropdown in the toolbar
3. Select **Resolved**
4. All selected queries update together

---

## How the System Learns from Responses (Auto-Suggest)

Over time, the system learns from client answers. It spots patterns and suggests responses.

### What is Auto-Suggest?

Auto-suggest remembers how similar queries were answered. It saves you typing the same things repeatedly.

### When to Use It

Look for the **lightbulb icon** on any query. This indicates suggestions are available.

*Insert Screenshot of a query row showing the lightbulb icon here.*

### Using Auto-Suggest - Step by Step

1. Find a query that needs an answer
2. Click the **lightbulb icon** next to it
3. A popover appears with suggested answers
4. Each suggestion shows the original query and response
5. Click a suggestion to apply it
6. Edit the text if needed
7. Save your changes

*Insert Screenshot of the auto-suggest popover showing suggestions here.*

### How the System Finds Suggestions

The system looks at:
- Transaction descriptions that match
- Previous answers given for similar items
- Responses from any project, not just this one

The more queries your team answers, the smarter suggestions become.

### Benefits of Auto-Suggest

- Answer common queries in seconds
- Ensure consistent responses
- New team members learn from past answers
- Reduce typing and errors

### Building Better Suggestions

Good suggestions come from good historical data. When answering queries:
- Write clear, complete responses
- Use consistent terminology
- Avoid abbreviations others might not understand

Your answers today become tomorrow's suggestions.

---

## Tips for Getting the Best Results

### Before Importing

- Clean your spreadsheet so descriptions are clear
- Remove transactions you don't need to query
- Check your column headers match common names

### When Grouping

- Use Auto-Group first, then fine-tune manually
- Good group names help clients understand faster
- Add group descriptions for complex categories

### When Sending

- Always preview the email before sending
- Check the recipient email is correct
- Set sensible reminder intervals (not too aggressive)

### For Faster Responses

- Keep your query questions short and specific
- Include enough transaction detail for identification
- Use the online link option for easiest client experience

---

## Summary

The Queries feature transforms how you handle bookkeeping questions. Instead of scattered emails, you have one organised system that:

- Imports queries from your working spreadsheets
- Groups similar items together
- Sends professional emails with tracking
- Reminds clients automatically
- Learns from past responses

Your team spends less time chasing and more time doing valuable work.
