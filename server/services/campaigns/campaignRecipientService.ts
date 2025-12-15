import { db } from '../../db.js';
import { clients, clientPeople, people, campaignRecipients, campaigns, contactPreferences } from '@shared/schema';
import { eq, and, desc, isNull, isNotNull } from 'drizzle-orm';
import { getMatchingClients } from './campaignTargetingService.js';
import { contactPreferencesStorage } from '../../storage/contacts/index.js';
import { campaignRecipientStorage } from '../../storage/campaigns/index.js';

export interface RecipientRules {
  strategy: 'primary_only' | 'all_contacts' | 'role_based';
  roles?: string[];
  channels: {
    email: boolean;
    sms: boolean;
    voice: boolean;
  };
}

export interface ResolvedRecipient {
  clientId: string;
  personId: string;
  channel: 'email' | 'sms' | 'voice';
  channelAddress: string;
  inclusionReason: string;
  lastCampaignReceivedAt: Date | null;
  lastCampaignCategory: string | null;
  isOptedOut: boolean;
  optedOutCategory: string | null;
  clientName?: string;
  personName?: string;
}

function normalizePhoneToE164(phone: string): string {
  if (!phone) return '';
  let cleaned = phone.replace(/[^0-9+]/g, '');
  if (cleaned.startsWith('0')) {
    cleaned = '+44' + cleaned.substring(1);
  }
  if (!cleaned.startsWith('+')) {
    cleaned = '+44' + cleaned;
  }
  return cleaned;
}

export async function resolveRecipients(
  campaignId: string,
  rules: RecipientRules,
  category: string
): Promise<ResolvedRecipient[]> {
  const matchedClients = await getMatchingClients(campaignId, 10000, 0);
  const recipients: ResolvedRecipient[] = [];
  const seenAddresses = new Set<string>();

  for (const client of matchedClients) {
    let contacts: Array<{
      personId: string;
      officerRole: string | null;
      isPrimaryContact: boolean | null;
    }> = [];

    const clientPeopleRelations = await db
      .select({
        personId: clientPeople.personId,
        officerRole: clientPeople.officerRole,
        isPrimaryContact: clientPeople.isPrimaryContact,
      })
      .from(clientPeople)
      .where(eq(clientPeople.clientId, client.id));

    switch (rules.strategy) {
      case 'primary_only':
        contacts = clientPeopleRelations.filter(cp => cp.isPrimaryContact === true);
        if (contacts.length === 0 && clientPeopleRelations.length > 0) {
          contacts = [clientPeopleRelations[0]];
        }
        break;
      case 'all_contacts':
        contacts = clientPeopleRelations;
        break;
      case 'role_based':
        contacts = clientPeopleRelations.filter(cp => 
          rules.roles?.some(role => 
            cp.officerRole?.toLowerCase().includes(role.toLowerCase())
          )
        );
        break;
    }

    for (const contact of contacts) {
      const [person] = await db
        .select()
        .from(people)
        .where(eq(people.id, contact.personId));

      if (!person) continue;
      if (person.receiveNotifications === false) continue;

      for (const channel of ['email', 'sms', 'voice'] as const) {
        if (!rules.channels[channel]) continue;

        const address = channel === 'email' ? person.email : person.telephone;
        if (!address) continue;

        const normalizedAddress = channel === 'email'
          ? address.toLowerCase().trim()
          : normalizePhoneToE164(address);

        const dedupKey = `${channel}:${normalizedAddress}`;
        if (seenAddresses.has(dedupKey)) continue;
        seenAddresses.add(dedupKey);

        const isOptedOut = await contactPreferencesStorage.isOptedOut(
          person.id,
          channel,
          category
        );

        const lastCampaign = await campaignRecipientStorage.getLastForPersonChannel(
          person.id,
          channel
        );

        const reasons: string[] = [];
        reasons.push('Client matched targeting criteria');
        if (rules.strategy === 'primary_only') reasons.push('Primary contact');
        if (rules.strategy === 'role_based' && contact.officerRole) {
          reasons.push(`Role: ${contact.officerRole}`);
        }
        reasons.push(`Channel: ${channel}`);

        recipients.push({
          clientId: client.id,
          personId: person.id,
          channel,
          channelAddress: normalizedAddress,
          inclusionReason: reasons.join('; '),
          lastCampaignReceivedAt: lastCampaign?.sentAt || null,
          lastCampaignCategory: lastCampaign?.category || null,
          isOptedOut,
          optedOutCategory: isOptedOut ? category : null,
          clientName: client.name,
          personName: person.fullName || undefined,
        });
      }
    }
  }

  return recipients;
}

export async function getRecipientSummary(campaignId: string): Promise<{
  total: number;
  byChannel: { email: number; sms: number; voice: number };
  optedOut: number;
  recentlyContacted: number;
}> {
  const recipients = await campaignRecipientStorage.getByCampaignId(campaignId);
  
  const summary = {
    total: recipients.length,
    byChannel: { email: 0, sms: 0, voice: 0 },
    optedOut: 0,
    recentlyContacted: 0,
  };

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  for (const r of recipients) {
    if (r.channel === 'email') summary.byChannel.email++;
    if (r.channel === 'sms') summary.byChannel.sms++;
    if (r.channel === 'voice') summary.byChannel.voice++;
    if (r.status === 'opted_out') summary.optedOut++;
    if (r.lastCampaignReceivedAt && new Date(r.lastCampaignReceivedAt) > sevenDaysAgo) {
      summary.recentlyContacted++;
    }
  }

  return summary;
}

export async function getDuplicateWarnings(
  campaignId: string,
  daysThreshold = 7
): Promise<Array<{ personId: string; personName: string; lastCampaignDate: Date; lastCampaignCategory: string }>> {
  const recipients = await campaignRecipientStorage.getByCampaignId(campaignId);
  const warnings: Array<{ personId: string; personName: string; lastCampaignDate: Date; lastCampaignCategory: string }> = [];

  const thresholdDate = new Date();
  thresholdDate.setDate(thresholdDate.getDate() - daysThreshold);

  for (const r of recipients) {
    if (r.lastCampaignReceivedAt && new Date(r.lastCampaignReceivedAt) > thresholdDate) {
      const [person] = await db.select({ fullName: people.fullName }).from(people).where(eq(people.id, r.personId));
      warnings.push({
        personId: r.personId,
        personName: person?.fullName || 'Unknown',
        lastCampaignDate: new Date(r.lastCampaignReceivedAt),
        lastCampaignCategory: r.lastCampaignCategory || 'unknown',
      });
    }
  }

  return warnings;
}

export async function saveResolvedRecipients(
  campaignId: string,
  recipients: ResolvedRecipient[]
): Promise<void> {
  for (const r of recipients) {
    if (r.isOptedOut) {
      await campaignRecipientStorage.create({
        campaignId,
        clientId: r.clientId,
        personId: r.personId,
        channel: r.channel,
        channelAddress: r.channelAddress,
        inclusionReason: r.inclusionReason,
        lastCampaignReceivedAt: r.lastCampaignReceivedAt,
        lastCampaignCategory: r.lastCampaignCategory,
        status: 'opted_out',
        manuallyAdded: false,
        manuallyRemoved: false,
      });
    } else {
      await campaignRecipientStorage.create({
        campaignId,
        clientId: r.clientId,
        personId: r.personId,
        channel: r.channel,
        channelAddress: r.channelAddress,
        inclusionReason: r.inclusionReason,
        lastCampaignReceivedAt: r.lastCampaignReceivedAt,
        lastCampaignCategory: r.lastCampaignCategory,
        status: 'pending',
        manuallyAdded: false,
        manuallyRemoved: false,
      });
    }
  }
}
