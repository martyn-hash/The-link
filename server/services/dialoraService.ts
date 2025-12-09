/**
 * Dialora AI Voice Call Service
 * 
 * Integrates with Dialora.ai for automated voice calls as part of the 
 * query reminder system. Sends outbound calls with contextual information
 * about pending bookkeeping queries.
 */

export interface DialoraCallPayload {
  name: string;
  phone: string;
  email: string;
  company: string;
  message: string;
  querycount: number;
}

export interface DialoraCallResult {
  success: boolean;
  callId?: string;
  error?: string;
}

export interface DialoraVariableMapping {
  key: string;
  field: string;
}

export interface DialoraCallContext {
  recipient?: {
    firstName?: string;
    lastName?: string;
    fullName?: string;
    email?: string;
    phone?: string;
  };
  client?: {
    name?: string;
    tradingAs?: string;
    companyNumber?: string;
    companyUtr?: string;
    telephone?: string;
    email?: string;
  };
  project?: {
    name?: string;
    reference?: string;
    dueDate?: string;
    status?: string;
  };
  queries?: {
    pending?: number;
    total?: number;
    answered?: number;
  };
}

export interface DialoraWebhookConfig {
  url: string;
  messageTemplate?: string;
  variables?: string;
  variableMappings?: DialoraVariableMapping[];
}

/**
 * Resolve variable mappings to actual values from context
 */
export function resolveVariableMappings(
  mappings: DialoraVariableMapping[] | undefined,
  context: DialoraCallContext
): Record<string, string | number> {
  if (!mappings || mappings.length === 0) {
    return {};
  }

  const result: Record<string, string | number> = {};

  for (const mapping of mappings) {
    const { key, field } = mapping;
    if (!key || !field) continue;

    let value: string | number | undefined;

    switch (field) {
      case 'recipient.firstName':
        value = context.recipient?.firstName;
        break;
      case 'recipient.lastName':
        value = context.recipient?.lastName;
        break;
      case 'recipient.fullName':
        value = context.recipient?.fullName;
        break;
      case 'recipient.email':
        value = context.recipient?.email;
        break;
      case 'recipient.phone':
        value = context.recipient?.phone;
        break;
      case 'client.name':
        value = context.client?.name;
        break;
      case 'client.tradingAs':
        value = context.client?.tradingAs;
        break;
      case 'client.companyNumber':
        value = context.client?.companyNumber;
        break;
      case 'client.companyUtr':
        value = context.client?.companyUtr;
        break;
      case 'client.telephone':
        value = context.client?.telephone;
        break;
      case 'client.email':
        value = context.client?.email;
        break;
      case 'project.name':
        value = context.project?.name;
        break;
      case 'project.reference':
        value = context.project?.reference;
        break;
      case 'project.dueDate':
        value = context.project?.dueDate;
        break;
      case 'project.status':
        value = context.project?.status;
        break;
      case 'queries.pending':
        value = context.queries?.pending;
        break;
      case 'queries.total':
        value = context.queries?.total;
        break;
      case 'queries.answered':
        value = context.queries?.answered;
        break;
    }

    if (value !== undefined && value !== null && value !== '') {
      result[key] = value;
    }
  }

  return result;
}

/**
 * Process variable string into key format and create placeholder object
 * Converts "name, number of transactions, Due Date" to { name: "{name}", numberoftransactions: "{numberoftransactions}", DueDate: "{DueDate}" }
 * Spaces are removed but casing is preserved
 * These are sent in a separate "customVariables" object to avoid overwriting core payload fields
 */
export function processWebhookVariables(variablesString: string | undefined): Record<string, string> {
  if (!variablesString || !variablesString.trim()) {
    return {};
  }
  
  const result: Record<string, string> = {};
  const variables = variablesString.split(',');
  
  for (const variable of variables) {
    const trimmed = variable.trim();
    if (trimmed) {
      const key = trimmed.replace(/\s+/g, '');
      result[key] = `{${key}}`;
    }
  }
  
  return result;
}

/**
 * Format phone number to E.164 international format for Dialora API
 */
export function formatPhoneForDialora(phone: string): string {
  const cleanPhone = phone.replace(/[^\d]/g, '');

  if (cleanPhone.startsWith('07') && cleanPhone.length === 11) {
    return '+44' + cleanPhone.slice(1);
  }
  
  if (cleanPhone.startsWith('44') && cleanPhone.length >= 11) {
    return '+' + cleanPhone;
  }
  
  return phone.startsWith('+') ? phone : `+${cleanPhone}`;
}

/**
 * Validate that a phone number is suitable for voice calls
 */
export function validatePhoneForVoiceCall(phone: string | null): { isValid: boolean; reason?: string } {
  if (!phone) {
    return { isValid: false, reason: 'No phone number provided' };
  }

  const formattedPhone = formatPhoneForDialora(phone);
  const e164Regex = /^\+[1-9]\d{1,14}$/;
  
  if (!e164Regex.test(formattedPhone)) {
    return { 
      isValid: false, 
      reason: 'Invalid phone number format for voice calls' 
    };
  }

  return { isValid: true };
}

/**
 * Trigger an outbound voice call via Dialora webhook
 * @param payload - Call payload with recipient and message details
 * @param webhookConfig - Webhook configuration (required - no default fallback)
 * @param context - Optional context for resolving variable mappings
 */
export async function triggerDialoraCall(
  payload: DialoraCallPayload,
  webhookConfig: DialoraWebhookConfig,
  context?: DialoraCallContext
): Promise<DialoraCallResult> {
  try {
    if (!webhookConfig?.url) {
      return {
        success: false,
        error: 'No webhook URL configured for voice calls'
      };
    }

    const formattedPhone = formatPhoneForDialora(payload.phone);
    
    const phoneValidation = validatePhoneForVoiceCall(formattedPhone);
    if (!phoneValidation.isValid) {
      return {
        success: false,
        error: phoneValidation.reason
      };
    }

    const customVariables = processWebhookVariables(webhookConfig.variables);
    const resolvedVariables = context 
      ? resolveVariableMappings(webhookConfig.variableMappings, context)
      : {};
    
    const mergedCustomVariables = {
      ...customVariables,
      ...resolvedVariables
    };
    
    const webhookPayload = {
      ...payload,
      phone: formattedPhone,
      ...(Object.keys(mergedCustomVariables).length > 0 ? { customVariables: mergedCustomVariables } : {})
    };

    const webhookUrl = webhookConfig.url;
    console.log(`[Dialora] Triggering outbound call to ${formattedPhone} for ${payload.company} via ${webhookUrl}`);

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(webhookPayload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Dialora] Webhook error:', response.status, errorText);
      return {
        success: false,
        error: `Dialora API error: ${response.status} - ${errorText}`
      };
    }

    const result = await response.json() as { call_id?: string; id?: string; status?: string };
    const callId = result.call_id || result.id || `dialora-${Date.now()}`;

    console.log(`[Dialora] Call triggered successfully, call ID: ${callId}`);

    return {
      success: true,
      callId
    };
  } catch (error) {
    console.error('[Dialora] Failed to trigger call:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error triggering voice call'
    };
  }
}

/**
 * Generate a contextual message for the voice call based on query status
 */
export function generateVoiceCallMessage(
  clientName: string,
  pendingQueries: number,
  totalQueries: number,
  companyName: string = 'your accountant'
): string {
  if (pendingQueries === totalQueries) {
    if (pendingQueries === 1) {
      return `Hello ${clientName}, this is a friendly reminder from ${companyName}. We have 1 outstanding bookkeeping query that requires your attention. Please check your email for the secure link to respond. Thank you.`;
    }
    return `Hello ${clientName}, this is a friendly reminder from ${companyName}. We have ${pendingQueries} outstanding bookkeeping queries that require your attention. Please check your email for the secure link to respond. Thank you.`;
  }
  
  const answeredQueries = totalQueries - pendingQueries;
  return `Hello ${clientName}, thank you for responding to ${answeredQueries} of our queries. We still have ${pendingQueries} remaining question${pendingQueries > 1 ? 's' : ''} that ${pendingQueries > 1 ? 'need' : 'needs'} your attention. Please check your email to complete the remaining responses. Thank you.`;
}
