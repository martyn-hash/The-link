import { matchEmailToClient, ClientMatchResult } from "../utils/clientEmailMatcher";
import { storage } from "../storage";
import type { QuarantineReason, InsertEmailQuarantine } from "@shared/schema";

interface EmailRecipient {
  address: string;
  name?: string;
}

interface EmailToCheck {
  inboxId: string;
  microsoftId: string;
  fromAddress: string;
  fromName?: string | null;
  toRecipients: EmailRecipient[];
  ccRecipients: EmailRecipient[];
  subject?: string | null;
  bodyPreview?: string | null;
  receivedAt: Date;
  hasAttachments: boolean;
}

export interface CustomerGateResult {
  passed: boolean;
  clientMatch: ClientMatchResult | null;
  quarantineReason: QuarantineReason | null;
}

interface DevOverrideSettings {
  enabled: boolean;
  bypassGate: boolean;
  logOverrides: boolean;
}

export async function checkCustomerGate(email: EmailToCheck): Promise<CustomerGateResult> {
  const devOverride = await getDevOverrideSettings();
  
  if (devOverride.enabled && devOverride.bypassGate) {
    if (devOverride.logOverrides) {
      console.log(`[CustomerGate] Dev override active - bypassing gate for email ${email.microsoftId}`);
    }
    const senderMatch = await matchEmailToClient(email.fromAddress);
    return {
      passed: true,
      clientMatch: senderMatch,
      quarantineReason: null,
    };
  }

  const senderMatch = await matchEmailToClient(email.fromAddress);
  if (senderMatch) {
    return {
      passed: true,
      clientMatch: senderMatch,
      quarantineReason: null,
    };
  }

  for (const cc of email.ccRecipients) {
    if (cc.address) {
      const ccMatch = await matchEmailToClient(cc.address.toLowerCase());
      if (ccMatch) {
        return {
          passed: true,
          clientMatch: ccMatch,
          quarantineReason: null,
        };
      }
    }
  }

  for (const to of email.toRecipients) {
    if (to.address) {
      const toMatch = await matchEmailToClient(to.address.toLowerCase());
      if (toMatch) {
        return {
          passed: true,
          clientMatch: toMatch,
          quarantineReason: null,
        };
      }
    }
  }

  return {
    passed: false,
    clientMatch: null,
    quarantineReason: "no_client_match",
  };
}

export async function quarantineEmail(
  email: EmailToCheck,
  reason: QuarantineReason
): Promise<void> {
  const existingQuarantine = await storage.getQuarantineByMicrosoftId(email.inboxId, email.microsoftId);
  if (existingQuarantine) {
    return;
  }

  const quarantineData: InsertEmailQuarantine = {
    inboxId: email.inboxId,
    microsoftId: email.microsoftId,
    fromAddress: email.fromAddress,
    fromName: email.fromName || null,
    toRecipients: email.toRecipients,
    ccRecipients: email.ccRecipients,
    subject: email.subject || null,
    bodyPreview: email.bodyPreview || null,
    receivedAt: email.receivedAt,
    hasAttachments: email.hasAttachments,
    quarantineReason: reason,
  };

  await storage.createEmailQuarantine(quarantineData);
  console.log(`[CustomerGate] Email ${email.microsoftId} quarantined: ${reason}`);
}

async function getDevOverrideSettings(): Promise<DevOverrideSettings> {
  try {
    const settings = await storage.getCompanySettings();
    if (settings?.emailDevOverride && typeof settings.emailDevOverride === 'object') {
      const override = settings.emailDevOverride as any;
      return {
        enabled: override.enabled ?? false,
        bypassGate: override.bypassGate ?? false,
        logOverrides: override.logOverrides ?? true,
      };
    }
  } catch (error) {
    console.error("[CustomerGate] Error getting dev override settings:", error);
  }
  
  return {
    enabled: false,
    bypassGate: false,
    logOverrides: true,
  };
}

export async function processEmailThroughGate(email: EmailToCheck): Promise<{
  processed: boolean;
  clientMatch: ClientMatchResult | null;
  quarantined: boolean;
}> {
  const gateResult = await checkCustomerGate(email);

  if (!gateResult.passed) {
    await quarantineEmail(email, gateResult.quarantineReason!);
    return {
      processed: false,
      clientMatch: null,
      quarantined: true,
    };
  }

  return {
    processed: true,
    clientMatch: gateResult.clientMatch,
    quarantined: false,
  };
}
