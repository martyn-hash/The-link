import { db } from '../../db.js';
import { pageActions, pageVisits, pageActionLogs, clients, people, campaignRecipients, campaigns, internalTasks, communications } from '@shared/schema';
import { eq, desc } from 'drizzle-orm';
import { pageActionStorage, pageVisitStorage } from '../../storage/pages/index.js';

export interface ActionResult {
  success: boolean;
  requiresOtp?: boolean;
  message?: string;
  data?: any;
}

export async function executePageAction(
  actionId: string,
  visitToken: string,
  actionData?: any,
  ipAddress?: string,
  userAgent?: string
): Promise<ActionResult> {
  const visit = await pageVisitStorage.getByToken(visitToken);
  if (!visit) {
    return { success: false, message: 'Invalid visit token' };
  }

  const action = await pageActionStorage.getById(actionId);
  if (!action || !action.isEnabled) {
    return { success: false, message: 'Action not found or disabled' };
  }

  if (action.requiresOtp && !visit.otpVerifiedAt) {
    return { success: false, requiresOtp: true, message: 'OTP verification required' };
  }

  const [client] = await db.select().from(clients).where(eq(clients.id, visit.clientId));
  const [person] = await db.select().from(people).where(eq(people.id, visit.personId));
  
  const recipient = visit.recipientId 
    ? await db.select().from(campaignRecipients).where(eq(campaignRecipients.id, visit.recipientId)).then(r => r[0])
    : null;

  let result: ActionResult;

  try {
    switch (action.actionType) {
      case 'interested':
        result = await handleInterestedAction(action, client, person, recipient, actionData);
        break;

      case 'not_interested':
        result = await handleNotInterestedAction(action, client, person, recipient, actionData);
        break;

      case 'request_callback':
        result = await handleRequestCallbackAction(action, client, person, recipient, actionData);
        break;

      case 'book_call':
        result = await handleBookCallAction(action, client, person, recipient, actionData);
        break;

      case 'confirm_details':
        result = await handleConfirmDetailsAction(action, client, person, recipient, actionData);
        break;

      case 'documents_uploaded':
        result = await handleDocumentsUploadedAction(action, client, person, recipient, actionData);
        break;

      case 'request_extension':
        result = await handleRequestExtensionAction(action, client, person, recipient, actionData);
        break;

      case 'custom_form':
        result = await handleCustomFormAction(action, client, person, recipient, actionData);
        break;

      case 'custom_webhook':
        result = await handleCustomWebhookAction(action, client, person, recipient, actionData);
        break;

      default:
        result = { success: false, message: 'Unknown action type' };
    }

    await pageVisitStorage.createActionLog({
      pageId: action.pageId,
      actionId: action.id,
      visitId: visit.id,
      recipientId: visit.recipientId,
      clientId: visit.clientId,
      personId: visit.personId,
      actionData: actionData || null,
      resultData: result as any,
      ipAddress: ipAddress || null,
      userAgent: userAgent || null,
    });

    return result;
  } catch (error: any) {
    console.error('[PageAction] Error executing action:', error);
    return { success: false, message: error.message || 'Action failed' };
  }
}

async function handleInterestedAction(
  action: any,
  client: any,
  person: any,
  recipient: any,
  actionData?: any
): Promise<ActionResult> {
  const config = (action.config || {}) as any;

  if (config.createTask) {
    await db.insert(internalTasks).values({
      title: config.createTask.title || `Follow up: ${person.fullName} interested`,
      description: `${person.fullName} expressed interest via campaign page: ${action.label}`,
      assignedToUserId: config.createTask.assignToManager ? client.managerId : config.createTask.assignToUserId,
      clientId: client.id,
      dueDate: new Date(Date.now() + (config.createTask.dueInDays || 2) * 24 * 60 * 60 * 1000),
      priority: 'medium',
    });
  }

  await db.insert(communications).values({
    clientId: client.id,
    personId: person.id,
    type: 'note',
    subject: `Interest expressed: ${action.label}`,
    content: `${person.fullName} clicked "${action.label}" on campaign page`,
    actualContactTime: new Date(),
  });

  return {
    success: true,
    message: action.successMessage || 'Thank you for your interest! We will be in touch soon.',
  };
}

async function handleNotInterestedAction(
  action: any,
  client: any,
  person: any,
  recipient: any,
  actionData?: any
): Promise<ActionResult> {
  await db.insert(communications).values({
    clientId: client.id,
    personId: person.id,
    type: 'note',
    subject: `Not interested: ${action.label}`,
    content: `${person.fullName} clicked "${action.label}" on campaign page${actionData?.reason ? `. Reason: ${actionData.reason}` : ''}`,
    actualContactTime: new Date(),
  });

  return {
    success: true,
    message: action.successMessage || 'Thank you for letting us know.',
  };
}

async function handleRequestCallbackAction(
  action: any,
  client: any,
  person: any,
  recipient: any,
  actionData?: any
): Promise<ActionResult> {
  const config = (action.config || {}) as any;

  await db.insert(internalTasks).values({
    title: `Callback requested: ${person.fullName}`,
    description: `${person.fullName} requested a callback via campaign page.\nPreferred time: ${actionData?.preferredTime || 'Not specified'}\nPhone: ${person.telephone || actionData?.phone || 'Not provided'}`,
    assignedToUserId: config.assignToManager ? client.managerId : config.assignToUserId,
    clientId: client.id,
    dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
    priority: 'high',
  });

  await db.insert(communications).values({
    clientId: client.id,
    personId: person.id,
    type: 'note',
    subject: 'Callback requested',
    content: `${person.fullName} requested a callback via campaign page. Preferred time: ${actionData?.preferredTime || 'Not specified'}`,
    actualContactTime: new Date(),
  });

  return {
    success: true,
    message: action.successMessage || 'Callback request received. We will call you soon!',
  };
}

async function handleBookCallAction(
  action: any,
  client: any,
  person: any,
  recipient: any,
  actionData?: any
): Promise<ActionResult> {
  const config = (action.config || {}) as any;

  if (config.calendlyLink) {
    return {
      success: true,
      message: 'Redirecting to booking calendar...',
      data: { redirectUrl: config.calendlyLink },
    };
  }

  return {
    success: true,
    message: action.successMessage || 'Please contact us to book a call.',
  };
}

async function handleConfirmDetailsAction(
  action: any,
  client: any,
  person: any,
  recipient: any,
  actionData?: any
): Promise<ActionResult> {
  await db.insert(communications).values({
    clientId: client.id,
    personId: person.id,
    type: 'note',
    subject: 'Details confirmed',
    content: `${person.fullName} confirmed their details via campaign page.${actionData ? `\nConfirmed data: ${JSON.stringify(actionData)}` : ''}`,
    actualContactTime: new Date(),
  });

  return {
    success: true,
    message: action.successMessage || 'Thank you for confirming your details.',
  };
}

async function handleDocumentsUploadedAction(
  action: any,
  client: any,
  person: any,
  recipient: any,
  actionData?: any
): Promise<ActionResult> {
  const config = (action.config || {}) as any;

  if (config.createTask) {
    await db.insert(internalTasks).values({
      title: `Documents uploaded: ${client.name}`,
      description: `${person.fullName} uploaded documents via campaign page.`,
      assignedToUserId: config.assignToManager ? client.managerId : config.assignToUserId,
      clientId: client.id,
      dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      priority: 'medium',
    });
  }

  await db.insert(communications).values({
    clientId: client.id,
    personId: person.id,
    type: 'note',
    subject: 'Documents uploaded',
    content: `${person.fullName} uploaded documents via campaign page.`,
    actualContactTime: new Date(),
  });

  return {
    success: true,
    message: action.successMessage || 'Documents received. Thank you!',
  };
}

async function handleRequestExtensionAction(
  action: any,
  client: any,
  person: any,
  recipient: any,
  actionData?: any
): Promise<ActionResult> {
  const config = (action.config || {}) as any;

  await db.insert(internalTasks).values({
    title: `Extension requested: ${client.name}`,
    description: `${person.fullName} requested an extension via campaign page.\nReason: ${actionData?.reason || 'Not provided'}\nRequested date: ${actionData?.requestedDate || 'Not specified'}`,
    assignedToUserId: config.assignToManager ? client.managerId : config.assignToUserId,
    clientId: client.id,
    dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
    priority: 'high',
  });

  await db.insert(communications).values({
    clientId: client.id,
    personId: person.id,
    type: 'note',
    subject: 'Extension requested',
    content: `${person.fullName} requested an extension via campaign page. Reason: ${actionData?.reason || 'Not provided'}`,
    actualContactTime: new Date(),
  });

  return {
    success: true,
    message: action.successMessage || 'Extension request submitted. We will review and respond shortly.',
  };
}

async function handleCustomFormAction(
  action: any,
  client: any,
  person: any,
  recipient: any,
  actionData?: any
): Promise<ActionResult> {
  const config = (action.config || {}) as any;

  if (config.createTask) {
    await db.insert(internalTasks).values({
      title: config.createTask.title || `Form submission: ${client.name}`,
      description: `${person.fullName} submitted a form via campaign page.\nData: ${JSON.stringify(actionData || {})}`,
      assignedToUserId: config.assignToManager ? client.managerId : config.assignToUserId,
      clientId: client.id,
      dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      priority: 'medium',
    });
  }

  await db.insert(communications).values({
    clientId: client.id,
    personId: person.id,
    type: 'note',
    subject: `Form submitted: ${action.label}`,
    content: `${person.fullName} submitted form via campaign page.\nData: ${JSON.stringify(actionData || {})}`,
    actualContactTime: new Date(),
  });

  return {
    success: true,
    message: action.successMessage || 'Form submitted successfully.',
  };
}

async function handleCustomWebhookAction(
  action: any,
  client: any,
  person: any,
  recipient: any,
  actionData?: any
): Promise<ActionResult> {
  const config = (action.config || {}) as any;

  if (config.webhookUrl) {
    try {
      await fetch(config.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actionType: action.actionType,
          actionLabel: action.label,
          client: { id: client.id, name: client.name },
          person: { id: person.id, fullName: person.fullName, email: person.email },
          actionData,
          timestamp: new Date().toISOString(),
        }),
      });
    } catch (error) {
      console.error('[PageAction] Webhook failed:', error);
    }
  }

  return {
    success: true,
    message: action.successMessage || 'Action completed.',
  };
}

export async function getActionLogsForPage(pageId: string, limit = 50): Promise<any[]> {
  return pageVisitStorage.getActionLogsByPageId(pageId);
}

export async function getActionLogsForClient(clientId: string, limit = 50): Promise<any[]> {
  return pageVisitStorage.getActionLogsByClientId(clientId);
}
