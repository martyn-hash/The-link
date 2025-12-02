/**
 * Application-Level Microsoft Graph Client
 * 
 * Uses client credentials flow (daemon/service authentication) to access
 * Microsoft Graph API with application-level permissions.
 * 
 * This allows tenant-wide access to read emails and calendars for any user
 * without requiring individual user OAuth consent.
 * 
 * Required permissions (Application type, admin consent required):
 * - Mail.Read or Mail.ReadWrite: Read/write mail in all mailboxes
 * - Mail.Send: Send mail as any user
 * - User.Read.All: Read all users' full profiles
 * - Calendars.Read or Calendars.ReadWrite: Read/write calendars in all mailboxes
 */

import { Client } from '@microsoft/microsoft-graph-client';

// Environment configuration
const CLIENT_ID = process.env.MICROSOFT_CLIENT_ID;
const CLIENT_SECRET = process.env.MICROSOFT_CLIENT_SECRET;
const TENANT_ID = process.env.MICROSOFT_TENANT_ID;

// Token cache
let cachedToken: { token: string; expiresAt: number } | null = null;

/**
 * Check if application credentials are configured
 */
export function isApplicationGraphConfigured(): boolean {
  return !!(CLIENT_ID && CLIENT_SECRET && TENANT_ID);
}

/**
 * Get access token using client credentials flow
 * Uses tenant-specific endpoint with .default scope for application permissions
 */
async function getApplicationAccessToken(): Promise<string> {
  if (!CLIENT_ID || !CLIENT_SECRET || !TENANT_ID) {
    throw new Error(
      'Microsoft application credentials not configured. Required: MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET, MICROSOFT_TENANT_ID'
    );
  }

  // Check if we have a valid cached token (with 5 minute buffer)
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now + 5 * 60 * 1000) {
    return cachedToken.token;
  }

  // Request new token using client credentials flow
  const tokenUrl = `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`;
  
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'client_credentials',
  });

  console.log('[Application Graph] Requesting new access token...');

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[Application Graph] Token request failed:', errorText);
    throw new Error(`Failed to get application access token: ${response.status} ${response.statusText}`);
  }

  const tokenData = await response.json() as {
    access_token: string;
    expires_in: number;
    token_type: string;
  };

  // Cache the token
  cachedToken = {
    token: tokenData.access_token,
    expiresAt: now + tokenData.expires_in * 1000,
  };

  console.log('[Application Graph] Successfully obtained access token');
  return tokenData.access_token;
}

/**
 * Get a Microsoft Graph client using application credentials
 * This client can access any user's data in the tenant
 * 
 * WARNING: Never cache this client. Always call this function for fresh auth.
 */
export async function getApplicationGraphClient(): Promise<Client> {
  const accessToken = await getApplicationAccessToken();

  return Client.initWithMiddleware({
    authProvider: {
      getAccessToken: async () => accessToken,
    },
  });
}

/**
 * Look up a user by their email address and get their Azure AD GUID
 */
export async function getUserByEmail(email: string): Promise<{
  id: string;
  displayName: string;
  mail: string;
  userPrincipalName: string;
} | null> {
  try {
    const client = await getApplicationGraphClient();
    
    // Try direct lookup by userPrincipalName (email)
    const user = await client
      .api(`/users/${encodeURIComponent(email)}`)
      .select('id,displayName,mail,userPrincipalName')
      .get();

    return {
      id: user.id,
      displayName: user.displayName,
      mail: user.mail,
      userPrincipalName: user.userPrincipalName,
    };
  } catch (error: any) {
    // If direct lookup fails, try filter by mail or userPrincipalName
    if (error.statusCode === 404) {
      try {
        const client = await getApplicationGraphClient();
        const users = await client
          .api('/users')
          .filter(`mail eq '${email}' or userPrincipalName eq '${email}'`)
          .select('id,displayName,mail,userPrincipalName')
          .top(1)
          .get();

        if (users.value && users.value.length > 0) {
          const user = users.value[0];
          return {
            id: user.id,
            displayName: user.displayName,
            mail: user.mail,
            userPrincipalName: user.userPrincipalName,
          };
        }
      } catch (filterError) {
        console.error('[Application Graph] Filter lookup also failed:', filterError);
      }
    }
    
    console.error('[Application Graph] Error looking up user by email:', error);
    return null;
  }
}

/**
 * Get a user by their Azure AD GUID
 */
export async function getUserById(userId: string): Promise<{
  id: string;
  displayName: string;
  mail: string;
  userPrincipalName: string;
} | null> {
  try {
    const client = await getApplicationGraphClient();
    
    const user = await client
      .api(`/users/${userId}`)
      .select('id,displayName,mail,userPrincipalName')
      .get();

    return {
      id: user.id,
      displayName: user.displayName,
      mail: user.mail,
      userPrincipalName: user.userPrincipalName,
    };
  } catch (error) {
    console.error('[Application Graph] Error getting user by ID:', error);
    return null;
  }
}

/**
 * Get emails from a user's mailbox using application permissions
 * 
 * @param userIdOrEmail - Azure AD user GUID or email address
 * @param options - Query options
 */
export async function getUserEmails(
  userIdOrEmail: string,
  options: {
    folder?: 'Inbox' | 'SentItems' | 'Drafts' | 'DeletedItems' | string;
    top?: number;
    skip?: number;
    filter?: string;
    orderBy?: string;
    select?: string[];
  } = {}
): Promise<{
  messages: any[];
  nextLink?: string;
  count?: number;
}> {
  const {
    folder = 'Inbox',
    top = 50,
    skip,
    filter,
    orderBy = 'receivedDateTime desc',
    select = [
      'id',
      'internetMessageId',
      'conversationId',
      'subject',
      'from',
      'toRecipients',
      'ccRecipients',
      'receivedDateTime',
      'sentDateTime',
      'hasAttachments',
      'bodyPreview',
      'isRead',
    ],
  } = options;

  const client = await getApplicationGraphClient();

  // Build the API path
  const apiPath = folder
    ? `/users/${encodeURIComponent(userIdOrEmail)}/mailFolders/${folder}/messages`
    : `/users/${encodeURIComponent(userIdOrEmail)}/messages`;

  let request = client
    .api(apiPath)
    .select(select.join(','))
    .top(top)
    .orderby(orderBy);

  if (skip) {
    request = request.skip(skip);
  }

  if (filter) {
    request = request.filter(filter);
  }

  const response = await request.get();

  return {
    messages: response.value || [],
    nextLink: response['@odata.nextLink'],
    count: response['@odata.count'],
  };
}

/**
 * Get a specific email message from any user's mailbox
 */
export async function getUserEmailById(
  userIdOrEmail: string,
  messageId: string,
  includeBody: boolean = true
): Promise<any> {
  const client = await getApplicationGraphClient();

  const select = [
    'id',
    'internetMessageId',
    'conversationId',
    'conversationIndex',
    'subject',
    'from',
    'toRecipients',
    'ccRecipients',
    'bccRecipients',
    'receivedDateTime',
    'sentDateTime',
    'hasAttachments',
    'bodyPreview',
    'isRead',
  ];

  if (includeBody) {
    select.push('body');
  }

  const message = await client
    .api(`/users/${encodeURIComponent(userIdOrEmail)}/messages/${messageId}`)
    .select(select.join(','))
    .get();

  return message;
}

/**
 * List all users in the tenant
 */
export async function listTenantUsers(options: {
  top?: number;
  filter?: string;
} = {}): Promise<{
  users: Array<{
    id: string;
    displayName: string;
    mail: string;
    userPrincipalName: string;
  }>;
  nextLink?: string;
}> {
  const { top = 100, filter } = options;

  const client = await getApplicationGraphClient();

  let request = client
    .api('/users')
    .select('id,displayName,mail,userPrincipalName')
    .top(top);

  if (filter) {
    request = request.filter(filter);
  }

  const response = await request.get();

  return {
    users: response.value || [],
    nextLink: response['@odata.nextLink'],
  };
}

/**
 * Get mailbox folder information for a user
 */
export async function getUserMailFolders(userIdOrEmail: string): Promise<Array<{
  id: string;
  displayName: string;
  totalItemCount: number;
  unreadItemCount: number;
}>> {
  const client = await getApplicationGraphClient();

  const response = await client
    .api(`/users/${encodeURIComponent(userIdOrEmail)}/mailFolders`)
    .select('id,displayName,totalItemCount,unreadItemCount')
    .get();

  return response.value || [];
}

// ============================================================================
// CALENDAR FUNCTIONS
// ============================================================================

/**
 * Calendar event type definition
 */
export interface CalendarEvent {
  id?: string;
  subject: string;
  body?: {
    contentType: 'text' | 'html';
    content: string;
  };
  start: {
    dateTime: string; // ISO 8601 format
    timeZone: string;
  };
  end: {
    dateTime: string;
    timeZone: string;
  };
  location?: {
    displayName: string;
  };
  attendees?: Array<{
    emailAddress: {
      address: string;
      name?: string;
    };
    type: 'required' | 'optional' | 'resource';
  }>;
  isOnlineMeeting?: boolean;
  onlineMeetingProvider?: 'teamsForBusiness' | 'skypeForBusiness' | 'skypeForConsumer';
  onlineMeeting?: {
    joinUrl: string;
  };
  isAllDay?: boolean;
  showAs?: 'free' | 'tentative' | 'busy' | 'oof' | 'workingElsewhere' | 'unknown';
  importance?: 'low' | 'normal' | 'high';
  sensitivity?: 'normal' | 'personal' | 'private' | 'confidential';
  categories?: string[];
  recurrence?: any; // Recurrence pattern
  reminderMinutesBeforeStart?: number;
  responseRequested?: boolean;
  organizer?: {
    emailAddress: {
      address: string;
      name?: string;
    };
  };
  webLink?: string;
  createdDateTime?: string;
  lastModifiedDateTime?: string;
}

/**
 * Get user's calendars
 */
export async function getUserCalendars(userIdOrEmail: string): Promise<Array<{
  id: string;
  name: string;
  color: string;
  isDefaultCalendar: boolean;
  canEdit: boolean;
  canShare: boolean;
}>> {
  const client = await getApplicationGraphClient();

  const response = await client
    .api(`/users/${encodeURIComponent(userIdOrEmail)}/calendars`)
    .select('id,name,color,isDefaultCalendar,canEdit,canShare')
    .get();

  return response.value || [];
}

/**
 * Get calendar events for a user
 * 
 * @param userIdOrEmail - Azure AD user GUID or email address
 * @param options - Query options for filtering events
 */
export async function getUserCalendarEvents(
  userIdOrEmail: string,
  options: {
    calendarId?: string; // Specific calendar ID, or omit for default calendar
    startDateTime?: string; // ISO 8601 start date/time
    endDateTime?: string; // ISO 8601 end date/time
    top?: number;
    skip?: number;
    filter?: string;
    orderBy?: string;
    select?: string[];
  } = {}
): Promise<{
  events: CalendarEvent[];
  nextLink?: string;
  count?: number;
}> {
  const {
    calendarId,
    startDateTime,
    endDateTime,
    top = 50,
    skip,
    filter,
    orderBy = 'start/dateTime',
    select = [
      'id',
      'subject',
      'body',
      'start',
      'end',
      'location',
      'attendees',
      'isOnlineMeeting',
      'onlineMeeting',
      'isAllDay',
      'showAs',
      'importance',
      'sensitivity',
      'organizer',
      'webLink',
      'createdDateTime',
      'lastModifiedDateTime',
    ],
  } = options;

  const client = await getApplicationGraphClient();

  // Build the API path
  let apiPath: string;
  if (calendarId) {
    apiPath = `/users/${encodeURIComponent(userIdOrEmail)}/calendars/${calendarId}/events`;
  } else {
    apiPath = `/users/${encodeURIComponent(userIdOrEmail)}/calendar/events`;
  }

  // Use calendarView endpoint if date range is specified for better results
  if (startDateTime && endDateTime) {
    apiPath = calendarId
      ? `/users/${encodeURIComponent(userIdOrEmail)}/calendars/${calendarId}/calendarView`
      : `/users/${encodeURIComponent(userIdOrEmail)}/calendar/calendarView`;
  }

  let request = client
    .api(apiPath)
    .select(select.join(','))
    .top(top)
    .orderby(orderBy);

  // Add date range for calendarView
  if (startDateTime && endDateTime) {
    request = request.query({
      startDateTime,
      endDateTime,
    });
  }

  if (skip) {
    request = request.skip(skip);
  }

  if (filter) {
    request = request.filter(filter);
  }

  const response = await request.get();

  return {
    events: response.value || [],
    nextLink: response['@odata.nextLink'],
    count: response['@odata.count'],
  };
}

/**
 * Get a specific calendar event by ID
 */
export async function getUserCalendarEventById(
  userIdOrEmail: string,
  eventId: string
): Promise<CalendarEvent | null> {
  try {
    const client = await getApplicationGraphClient();

    const event = await client
      .api(`/users/${encodeURIComponent(userIdOrEmail)}/calendar/events/${eventId}`)
      .select('id,subject,body,start,end,location,attendees,isOnlineMeeting,onlineMeeting,isAllDay,showAs,importance,sensitivity,organizer,webLink,recurrence,reminderMinutesBeforeStart,createdDateTime,lastModifiedDateTime')
      .get();

    return event;
  } catch (error: any) {
    if (error.statusCode === 404) {
      return null;
    }
    console.error('[Application Graph] Error getting calendar event:', error);
    throw error;
  }
}

/**
 * Create a calendar event for a user
 * 
 * If isOnlineMeeting is true and onlineMeetingProvider is 'teamsForBusiness',
 * a Teams meeting will be automatically created with a join link.
 * 
 * @param userIdOrEmail - Azure AD user GUID or email address (the organizer)
 * @param event - The event details to create
 * @returns The created event including the Teams join URL if applicable
 */
export async function createUserCalendarEvent(
  userIdOrEmail: string,
  event: {
    subject: string;
    body?: {
      contentType: 'text' | 'html';
      content: string;
    };
    start: {
      dateTime: string;
      timeZone: string;
    };
    end: {
      dateTime: string;
      timeZone: string;
    };
    location?: {
      displayName: string;
    };
    attendees?: Array<{
      emailAddress: {
        address: string;
        name?: string;
      };
      type: 'required' | 'optional';
    }>;
    isOnlineMeeting?: boolean;
    onlineMeetingProvider?: 'teamsForBusiness' | 'skypeForBusiness' | 'skypeForConsumer';
    isAllDay?: boolean;
    showAs?: 'free' | 'tentative' | 'busy' | 'oof' | 'workingElsewhere';
    importance?: 'low' | 'normal' | 'high';
    sensitivity?: 'normal' | 'personal' | 'private' | 'confidential';
    categories?: string[];
    reminderMinutesBeforeStart?: number;
    responseRequested?: boolean;
    recurrence?: {
      pattern: {
        type: 'daily' | 'weekly' | 'absoluteMonthly' | 'relativeMonthly' | 'absoluteYearly' | 'relativeYearly';
        interval: number;
        daysOfWeek?: string[];
        dayOfMonth?: number;
        month?: number;
        firstDayOfWeek?: string;
      };
      range: {
        type: 'endDate' | 'noEnd' | 'numbered';
        startDate: string;
        endDate?: string;
        numberOfOccurrences?: number;
      };
    };
  },
  calendarId?: string
): Promise<CalendarEvent> {
  const client = await getApplicationGraphClient();

  // Build the API path
  const apiPath = calendarId
    ? `/users/${encodeURIComponent(userIdOrEmail)}/calendars/${calendarId}/events`
    : `/users/${encodeURIComponent(userIdOrEmail)}/calendar/events`;

  const createdEvent = await client
    .api(apiPath)
    .post(event);

  console.log(`[Application Graph] Created calendar event for ${userIdOrEmail}: ${createdEvent.subject}`);
  
  if (createdEvent.onlineMeeting?.joinUrl) {
    console.log(`[Application Graph] Teams meeting link: ${createdEvent.onlineMeeting.joinUrl}`);
  }

  return createdEvent;
}

/**
 * Update a calendar event for a user
 * 
 * @param userIdOrEmail - Azure AD user GUID or email address
 * @param eventId - The ID of the event to update
 * @param updates - The fields to update
 */
export async function updateUserCalendarEvent(
  userIdOrEmail: string,
  eventId: string,
  updates: Partial<{
    subject: string;
    body: {
      contentType: 'text' | 'html';
      content: string;
    };
    start: {
      dateTime: string;
      timeZone: string;
    };
    end: {
      dateTime: string;
      timeZone: string;
    };
    location: {
      displayName: string;
    };
    attendees: Array<{
      emailAddress: {
        address: string;
        name?: string;
      };
      type: 'required' | 'optional';
    }>;
    isOnlineMeeting: boolean;
    onlineMeetingProvider: 'teamsForBusiness' | 'skypeForBusiness' | 'skypeForConsumer';
    isAllDay: boolean;
    showAs: 'free' | 'tentative' | 'busy' | 'oof' | 'workingElsewhere';
    importance: 'low' | 'normal' | 'high';
    sensitivity: 'normal' | 'personal' | 'private' | 'confidential';
    categories: string[];
    reminderMinutesBeforeStart: number;
    responseRequested: boolean;
  }>
): Promise<CalendarEvent> {
  const client = await getApplicationGraphClient();

  const updatedEvent = await client
    .api(`/users/${encodeURIComponent(userIdOrEmail)}/calendar/events/${eventId}`)
    .patch(updates);

  console.log(`[Application Graph] Updated calendar event ${eventId} for ${userIdOrEmail}`);

  return updatedEvent;
}

/**
 * Delete a calendar event for a user
 * 
 * @param userIdOrEmail - Azure AD user GUID or email address
 * @param eventId - The ID of the event to delete
 */
export async function deleteUserCalendarEvent(
  userIdOrEmail: string,
  eventId: string
): Promise<void> {
  const client = await getApplicationGraphClient();

  await client
    .api(`/users/${encodeURIComponent(userIdOrEmail)}/calendar/events/${eventId}`)
    .delete();

  console.log(`[Application Graph] Deleted calendar event ${eventId} for ${userIdOrEmail}`);
}

/**
 * Accept, decline, or tentatively accept a calendar event
 * 
 * @param userIdOrEmail - Azure AD user GUID or email address
 * @param eventId - The ID of the event
 * @param response - The response type: accept, decline, or tentativelyAccept
 * @param comment - Optional comment to include in the response
 * @param sendResponse - Whether to send a response to the organizer (default true)
 */
export async function respondToUserCalendarEvent(
  userIdOrEmail: string,
  eventId: string,
  response: 'accept' | 'decline' | 'tentativelyAccept',
  comment?: string,
  sendResponse: boolean = true
): Promise<void> {
  const client = await getApplicationGraphClient();

  await client
    .api(`/users/${encodeURIComponent(userIdOrEmail)}/calendar/events/${eventId}/${response}`)
    .post({
      comment,
      sendResponse,
    });

  console.log(`[Application Graph] Responded ${response} to event ${eventId} for ${userIdOrEmail}`);
}

/**
 * Get free/busy schedule for one or more users
 * 
 * @param organizerIdOrEmail - The user making the request
 * @param schedules - Array of email addresses to get schedules for
 * @param startTime - Start of the time window
 * @param endTime - End of the time window
 * @param availabilityViewInterval - Interval in minutes (15, 30, or 60)
 */
export async function getScheduleAvailability(
  organizerIdOrEmail: string,
  schedules: string[],
  startTime: { dateTime: string; timeZone: string },
  endTime: { dateTime: string; timeZone: string },
  availabilityViewInterval: number = 30
): Promise<Array<{
  scheduleId: string;
  availabilityView: string;
  scheduleItems: Array<{
    status: 'free' | 'tentative' | 'busy' | 'oof' | 'workingElsewhere';
    start: { dateTime: string; timeZone: string };
    end: { dateTime: string; timeZone: string };
    subject?: string;
    location?: string;
  }>;
  workingHours: any;
}>> {
  const client = await getApplicationGraphClient();

  const response = await client
    .api(`/users/${encodeURIComponent(organizerIdOrEmail)}/calendar/getSchedule`)
    .post({
      schedules,
      startTime,
      endTime,
      availabilityViewInterval,
    });

  return response.value || [];
}

// ============================================================================
// EMAIL SENDING FUNCTIONS (Tenant-Wide)
// ============================================================================

/**
 * Send an email on behalf of a user using application permissions
 * 
 * @param userIdOrEmail - Azure AD user GUID or email address (the sender)
 * @param to - Recipient email address(es)
 * @param subject - Email subject
 * @param content - Email body content (HTML or plain text)
 * @param isHtml - Whether the content is HTML (default: true)
 * @param options - Additional options (cc, bcc, attachments, saveToSentItems)
 */
export async function sendEmailAsUser(
  userIdOrEmail: string,
  to: string | string[],
  subject: string,
  content: string,
  isHtml: boolean = true,
  options: {
    cc?: string[];
    bcc?: string[];
    attachments?: Array<{
      name: string;
      contentType: string;
      contentBytes: string; // Base64 encoded
    }>;
    saveToSentItems?: boolean;
  } = {}
): Promise<{ success: boolean }> {
  const client = await getApplicationGraphClient();

  const toRecipients = (Array.isArray(to) ? to : [to]).map(email => ({
    emailAddress: { address: email }
  }));

  const message: any = {
    subject,
    body: {
      contentType: isHtml ? 'HTML' : 'Text',
      content
    },
    toRecipients
  };

  if (options.cc && options.cc.length > 0) {
    message.ccRecipients = options.cc.map(email => ({
      emailAddress: { address: email }
    }));
  }

  if (options.bcc && options.bcc.length > 0) {
    message.bccRecipients = options.bcc.map(email => ({
      emailAddress: { address: email }
    }));
  }

  if (options.attachments && options.attachments.length > 0) {
    message.attachments = options.attachments.map(att => ({
      '@odata.type': '#microsoft.graph.fileAttachment',
      name: att.name,
      contentType: att.contentType,
      contentBytes: att.contentBytes
    }));
  }

  await client
    .api(`/users/${encodeURIComponent(userIdOrEmail)}/sendMail`)
    .post({
      message,
      saveToSentItems: options.saveToSentItems !== false // default to true
    });

  console.log(`[Application Graph] Email sent from ${userIdOrEmail} to ${Array.isArray(to) ? to.join(', ') : to}`);
  return { success: true };
}

/**
 * Create a reply to an email message using application permissions
 * 
 * @param userIdOrEmail - Azure AD user GUID or email address (the sender)
 * @param messageId - The Graph API message ID to reply to
 * @param content - The reply content (HTML or plain text)
 * @param isHtml - Whether the content is HTML (default: true)
 * @param options - Additional options (subject, to, cc, attachments)
 */
export async function createReplyToMessage(
  userIdOrEmail: string,
  messageId: string,
  content: string,
  isHtml: boolean = true,
  options: {
    subject?: string;
    to?: string[];
    cc?: string[];
    attachments?: Array<{
      objectPath: string;
      fileName: string;
      contentType?: string;
      fileSize?: number;
    }>;
  } = {}
): Promise<{ success: boolean }> {
  const client = await getApplicationGraphClient();

  // For plain text without attachments, use simple reply action
  if (!isHtml && (!options.attachments || options.attachments.length === 0)) {
    await client
      .api(`/users/${encodeURIComponent(userIdOrEmail)}/messages/${messageId}/reply`)
      .post({ comment: content });
    console.log(`[Application Graph] Simple reply sent from ${userIdOrEmail}`);
    return { success: true };
  }

  // For HTML content or attachments, create draft and update it
  // Step 1: Create draft reply
  const draftReply = await client
    .api(`/users/${encodeURIComponent(userIdOrEmail)}/messages/${messageId}/createReply`)
    .post({});

  if (!draftReply || !draftReply.id) {
    throw new Error('Failed to create draft reply');
  }

  // Step 2: Update draft body with HTML content and custom recipients/subject
  const patchData: any = {
    body: {
      contentType: 'HTML',
      content
    }
  };

  if (options.subject) {
    patchData.subject = options.subject;
  }

  if (options.to && options.to.length > 0) {
    patchData.toRecipients = options.to.map(email => ({
      emailAddress: { address: email }
    }));
  }

  if (options.cc && options.cc.length > 0) {
    patchData.ccRecipients = options.cc.map(email => ({
      emailAddress: { address: email }
    }));
  }

  await client
    .api(`/users/${encodeURIComponent(userIdOrEmail)}/messages/${draftReply.id}`)
    .patch(patchData);

  // Step 3: Add attachments if provided
  if (options.attachments && options.attachments.length > 0) {
    const { ObjectStorageService } = await import('../objectStorage');
    
    for (const attachment of options.attachments) {
      const fileBuffer = await ObjectStorageService.downloadFile(attachment.objectPath);
      const base64Content = fileBuffer.toString('base64');

      await client
        .api(`/users/${encodeURIComponent(userIdOrEmail)}/messages/${draftReply.id}/attachments`)
        .post({
          '@odata.type': '#microsoft.graph.fileAttachment',
          name: attachment.fileName,
          contentType: attachment.contentType || 'application/octet-stream',
          contentBytes: base64Content
        });
    }
  }

  // Step 4: Send the draft
  await client
    .api(`/users/${encodeURIComponent(userIdOrEmail)}/messages/${draftReply.id}/send`)
    .post({});

  console.log(`[Application Graph] Reply sent from ${userIdOrEmail}`);
  return { success: true };
}

/**
 * Create a reply-all to an email message using application permissions
 * 
 * @param userIdOrEmail - Azure AD user GUID or email address (the sender)
 * @param messageId - The Graph API message ID to reply to
 * @param content - The reply content (HTML or plain text)
 * @param isHtml - Whether the content is HTML (default: true)
 * @param options - Additional options (subject, to, cc, attachments)
 */
export async function createReplyAllToMessage(
  userIdOrEmail: string,
  messageId: string,
  content: string,
  isHtml: boolean = true,
  options: {
    subject?: string;
    to?: string[];
    cc?: string[];
    attachments?: Array<{
      objectPath: string;
      fileName: string;
      contentType?: string;
      fileSize?: number;
    }>;
  } = {}
): Promise<{ success: boolean }> {
  const client = await getApplicationGraphClient();

  // For plain text without attachments, use simple replyAll action
  if (!isHtml && (!options.attachments || options.attachments.length === 0)) {
    await client
      .api(`/users/${encodeURIComponent(userIdOrEmail)}/messages/${messageId}/replyAll`)
      .post({ comment: content });
    console.log(`[Application Graph] Simple reply-all sent from ${userIdOrEmail}`);
    return { success: true };
  }

  // For HTML content or attachments, create draft and update it
  // Step 1: Create draft reply-all
  const draftReply = await client
    .api(`/users/${encodeURIComponent(userIdOrEmail)}/messages/${messageId}/createReplyAll`)
    .post({});

  if (!draftReply || !draftReply.id) {
    throw new Error('Failed to create draft reply-all');
  }

  // Step 2: Update draft body with HTML content and custom recipients/subject
  const patchData: any = {
    body: {
      contentType: 'HTML',
      content
    }
  };

  if (options.subject) {
    patchData.subject = options.subject;
  }

  if (options.to && options.to.length > 0) {
    patchData.toRecipients = options.to.map(email => ({
      emailAddress: { address: email }
    }));
  }

  if (options.cc && options.cc.length > 0) {
    patchData.ccRecipients = options.cc.map(email => ({
      emailAddress: { address: email }
    }));
  }

  await client
    .api(`/users/${encodeURIComponent(userIdOrEmail)}/messages/${draftReply.id}`)
    .patch(patchData);

  // Step 3: Add attachments if provided
  if (options.attachments && options.attachments.length > 0) {
    const { ObjectStorageService } = await import('../objectStorage');
    
    for (const attachment of options.attachments) {
      const fileBuffer = await ObjectStorageService.downloadFile(attachment.objectPath);
      const base64Content = fileBuffer.toString('base64');

      await client
        .api(`/users/${encodeURIComponent(userIdOrEmail)}/messages/${draftReply.id}/attachments`)
        .post({
          '@odata.type': '#microsoft.graph.fileAttachment',
          name: attachment.fileName,
          contentType: attachment.contentType || 'application/octet-stream',
          contentBytes: base64Content
        });
    }
  }

  // Step 4: Send the draft
  await client
    .api(`/users/${encodeURIComponent(userIdOrEmail)}/messages/${draftReply.id}/send`)
    .post({});

  console.log(`[Application Graph] Reply-all sent from ${userIdOrEmail}`);
  return { success: true };
}

/**
 * Download an email attachment using application permissions
 * 
 * @param userIdOrEmail - Azure AD user GUID or email address (mailbox owner)
 * @param messageId - The Graph API message ID containing the attachment
 * @param attachmentId - The Graph API attachment ID to download
 * @returns Buffer containing the attachment content
 */
export async function downloadEmailAttachment(
  userIdOrEmail: string,
  messageId: string,
  attachmentId: string
): Promise<Buffer> {
  const client = await getApplicationGraphClient();

  const attachmentContent = await client
    .api(`/users/${encodeURIComponent(userIdOrEmail)}/messages/${messageId}/attachments/${attachmentId}/$value`)
    .getStream();

  // Convert stream to buffer
  const chunks: Uint8Array[] = [];
  for await (const chunk of attachmentContent) {
    chunks.push(chunk);
  }

  console.log(`[Application Graph] Downloaded attachment ${attachmentId} from ${userIdOrEmail}`);
  return Buffer.concat(chunks);
}

/**
 * Get user's Outlook profile using application permissions
 */
export async function getUserOutlookProfile(userIdOrEmail: string): Promise<{
  id: string;
  email: string;
  displayName: string;
  givenName?: string;
  surname?: string;
} | null> {
  try {
    const client = await getApplicationGraphClient();
    
    const profile = await client
      .api(`/users/${encodeURIComponent(userIdOrEmail)}`)
      .select('id,mail,userPrincipalName,displayName,givenName,surname')
      .get();

    return {
      id: profile.id,
      email: profile.mail || profile.userPrincipalName,
      displayName: profile.displayName,
      givenName: profile.givenName,
      surname: profile.surname,
    };
  } catch (error) {
    console.error('[Application Graph] Error getting user profile:', error);
    return null;
  }
}
