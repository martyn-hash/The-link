import type { Express } from "express";
import { storage } from "../../storage/index";
import { z } from "zod";
import { sendWebhookRequestSchema } from "@shared/schema";
import type { WebhookConfig, Client, Person, ClientPerson } from "@shared/schema";

interface WebhookResult {
  webhookId: string;
  webhookName: string;
  success: boolean;
  responseCode?: string;
  errorMessage?: string;
}

function checkRequiredFields(
  client: Client & { people?: (ClientPerson & { person: Person })[] },
  webhook: WebhookConfig
): { isAvailable: boolean; missingFields: string[] } {
  const missingFields: string[] = [];
  
  const requiredClientFields = webhook.requiredClientFields || [];
  for (const field of requiredClientFields) {
    const value = (client as any)[field];
    if (!value || (typeof value === 'string' && value.trim() === '')) {
      missingFields.push(`Client: ${field}`);
    }
  }

  const requiredPersonFields = webhook.requiredPersonFields || [];
  if (requiredPersonFields.length > 0 && client.people) {
    for (const field of requiredPersonFields) {
      const hasFieldInAnyPerson = client.people.some(cp => {
        const value = (cp.person as any)[field];
        return value && (typeof value !== 'string' || value.trim() !== '');
      });
      if (!hasFieldInAnyPerson) {
        missingFields.push(`Person: ${field}`);
      }
    }
  }

  return {
    isAvailable: missingFields.length === 0,
    missingFields
  };
}

function buildWebhookPayload(
  client: Client & { people?: (ClientPerson & { person: Person })[] },
  webhook: WebhookConfig,
  userId: string,
  userName: string
) {
  const includedClientFields = webhook.includedClientFields || [];
  const includedPersonFields = webhook.includedPersonFields || [];
  
  const clientData: Record<string, any> = {
    client_id: client.id,
    client_name: client.name,
  };
  
  const allClientFields = [
    'email', 'companyNumber', 'companyUtr', 'companiesHouseAuthCode',
    'companyTelephone', 'registeredAddress1', 'registeredAddress2',
    'registeredAddress3', 'registeredPostcode', 'registeredCountry',
    'postalAddress1', 'postalAddress2', 'postalAddress3',
    'postalAddressPostcode', 'postalAddressCountry', 'companyEmailDomain',
    'tradingAs', 'clientType', 'companyType', 'dateOfCreation'
  ];
  
  const fieldsToInclude = includedClientFields.length > 0 ? includedClientFields : allClientFields;
  for (const field of fieldsToInclude) {
    const value = (client as any)[field];
    clientData[`client_${field}`] = value !== undefined && value !== null ? value : '';
  }

  const allPersonFields = [
    'firstName', 'lastName', 'email', 'telephone', 'primaryPhone', 'primaryEmail',
    'addressLine1', 'addressLine2', 'locality', 'region', 'postalCode', 'country',
    'dateOfBirth', 'niNumber', 'personalUtrNumber', 'nationality', 'countryOfResidence'
  ];
  
  const personFieldsToInclude = includedPersonFields.length > 0 ? includedPersonFields : allPersonFields;
  
  const flattenedPeopleData: Record<string, any> = {};
  const MAX_PEOPLE = 4;
  const people = client.people || [];
  
  flattenedPeopleData['person_count'] = Math.min(people.length, MAX_PEOPLE);
  
  for (let i = 0; i < MAX_PEOPLE; i++) {
    const personNum = i + 1;
    const prefix = `person_${personNum}_`;
    
    if (i < people.length) {
      const cp = people[i];
      const person = cp.person;
      
      flattenedPeopleData[`${prefix}id`] = person.id;
      flattenedPeopleData[`${prefix}fullName`] = person.fullName;
      flattenedPeopleData[`${prefix}officerRole`] = cp.officerRole || '';
      flattenedPeopleData[`${prefix}isPrimaryContact`] = cp.isPrimaryContact || false;
      
      for (const field of personFieldsToInclude) {
        const value = (person as any)[field];
        flattenedPeopleData[`${prefix}${field}`] = value !== undefined && value !== null ? value : '';
      }
    } else {
      flattenedPeopleData[`${prefix}id`] = '';
      flattenedPeopleData[`${prefix}fullName`] = '';
      flattenedPeopleData[`${prefix}officerRole`] = '';
      flattenedPeopleData[`${prefix}isPrimaryContact`] = false;
      
      for (const field of personFieldsToInclude) {
        flattenedPeopleData[`${prefix}${field}`] = '';
      }
    }
  }

  return {
    ...clientData,
    ...flattenedPeopleData,
    metadata_sentAt: new Date().toISOString(),
    metadata_sentBy: userName,
    metadata_webhookName: webhook.name,
    metadata_source: 'The Link'
  };
}

async function sendToWebhook(
  webhookUrl: string,
  payload: any
): Promise<{ success: boolean; responseCode?: string; responseBody?: string; errorMessage?: string }> {
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    
    const responseBody = await response.text();
    
    return {
      success: response.ok,
      responseCode: response.status.toString(),
      responseBody: responseBody.substring(0, 1000),
      errorMessage: response.ok ? undefined : `HTTP ${response.status}: ${response.statusText}`
    };
  } catch (error: any) {
    return {
      success: false,
      errorMessage: error.message || 'Failed to send webhook'
    };
  }
}

export function registerWebhookRoutes(
  app: Express,
  isAuthenticated: any,
  resolveEffectiveUser: any
) {
  app.get(
    "/api/clients/:clientId/webhooks",
    isAuthenticated,
    resolveEffectiveUser,
    async (req: any, res: any) => {
      try {
        const { clientId } = req.params;
        
        const client = await storage.getClientById(clientId);
        if (!client) {
          return res.status(404).json({ message: "Client not found" });
        }
        
        const clientPeople = await storage.getClientPeopleByClientId(clientId);
        const clientWithPeople = {
          ...client,
          people: clientPeople
        };
        
        const webhooks = await storage.getEnabledWebhookConfigs();
        
        const webhooksWithStatus = await Promise.all(webhooks.map(async (webhook) => {
          const { isAvailable, missingFields } = checkRequiredFields(clientWithPeople, webhook);
          const hasPriorSuccess = await storage.hasSuccessfulWebhookForClient(clientId, webhook.id);
          const willUseUpdateUrl = hasPriorSuccess && !!webhook.updateWebhookUrl;
          return {
            ...webhook,
            isAvailable,
            unavailableReason: isAvailable ? undefined : `Missing required fields: ${missingFields.join(', ')}`,
            hasPriorSuccess,
            willUseUpdateUrl,
          };
        }));
        
        res.json(webhooksWithStatus);
      } catch (error) {
        console.error("Error fetching webhooks for client:", error);
        res.status(500).json({ message: "Failed to fetch webhooks" });
      }
    }
  );

  app.get(
    "/api/clients/:clientId/webhook-logs",
    isAuthenticated,
    resolveEffectiveUser,
    async (req: any, res: any) => {
      try {
        const { clientId } = req.params;
        const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
        
        const logs = await storage.getWebhookLogsByClientId(clientId, limit);
        res.json(logs);
      } catch (error) {
        console.error("Error fetching webhook logs:", error);
        res.status(500).json({ message: "Failed to fetch webhook logs" });
      }
    }
  );

  app.post(
    "/api/clients/:clientId/webhooks/send",
    isAuthenticated,
    resolveEffectiveUser,
    async (req: any, res: any) => {
      try {
        const { clientId } = req.params;
        
        const validationResult = sendWebhookRequestSchema.safeParse(req.body);
        if (!validationResult.success) {
          return res.status(400).json({ 
            message: "Invalid request", 
            errors: validationResult.error.errors 
          });
        }
        
        const { webhookConfigIds } = validationResult.data;
        
        const client = await storage.getClientById(clientId);
        if (!client) {
          return res.status(404).json({ message: "Client not found" });
        }
        
        const clientPeople = await storage.getClientPeopleByClientId(clientId);
        const clientWithPeople = {
          ...client,
          people: clientPeople
        };
        
        const userName = `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim() || req.user.email || 'Unknown';
        
        const results: WebhookResult[] = [];
        
        for (const webhookId of webhookConfigIds) {
          const webhook = await storage.getWebhookConfigById(webhookId);
          
          if (!webhook) {
            results.push({
              webhookId,
              webhookName: 'Unknown',
              success: false,
              errorMessage: 'Webhook configuration not found'
            });
            continue;
          }
          
          if (!webhook.isEnabled) {
            results.push({
              webhookId,
              webhookName: webhook.name,
              success: false,
              errorMessage: 'Webhook is disabled'
            });
            continue;
          }
          
          const { isAvailable, missingFields } = checkRequiredFields(clientWithPeople, webhook);
          if (!isAvailable) {
            results.push({
              webhookId,
              webhookName: webhook.name,
              success: false,
              errorMessage: `Missing required fields: ${missingFields.join(', ')}`
            });
            continue;
          }
          
          const payload = buildWebhookPayload(clientWithPeople, webhook, req.user.id, userName);
          
          const hasPriorSuccess = await storage.hasSuccessfulWebhookForClient(clientId, webhookId);
          const shouldUseUpdateUrl = hasPriorSuccess && !!webhook.updateWebhookUrl;
          const targetUrl = shouldUseUpdateUrl ? webhook.updateWebhookUrl! : webhook.webhookUrl;
          
          const log = await storage.createWebhookLog({
            webhookConfigId: webhookId,
            clientId,
            triggeredBy: req.user.id,
            payload: payload,
            status: 'pending'
          });
          
          const sendResult = await sendToWebhook(targetUrl, payload);
          
          await storage.updateWebhookLogStatus(
            log.id,
            sendResult.success ? 'success' : 'failed',
            sendResult.responseCode,
            sendResult.responseBody,
            sendResult.errorMessage
          );
          
          results.push({
            webhookId,
            webhookName: webhook.name,
            success: sendResult.success,
            responseCode: sendResult.responseCode,
            errorMessage: sendResult.errorMessage
          });
        }
        
        const allSuccessful = results.every(r => r.success);
        const anySuccessful = results.some(r => r.success);
        
        res.status(anySuccessful ? 200 : 400).json({
          success: allSuccessful,
          results,
          message: allSuccessful 
            ? 'All webhooks sent successfully' 
            : anySuccessful 
              ? 'Some webhooks failed' 
              : 'All webhooks failed'
        });
      } catch (error) {
        console.error("Error sending webhooks:", error);
        res.status(500).json({ message: "Failed to send webhooks" });
      }
    }
  );
}
