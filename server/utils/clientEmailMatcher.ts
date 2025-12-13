import { db } from "../db";
import { eq, sql } from "drizzle-orm";
import { clients, clientEmailAliases, clientDomainAllowlist } from "@shared/schema";

export interface ClientMatchResult {
  clientId: string;
  matchType: 'email' | 'alias' | 'domain';
  confidence: 'high' | 'medium' | 'low';
}

export async function matchEmailToClient(email: string): Promise<ClientMatchResult | null> {
  const normalizedEmail = email.toLowerCase().trim();
  const domain = normalizedEmail.split('@')[1];

  const clientByEmail = await db
    .select({ id: clients.id })
    .from(clients)
    .where(sql`lower(${clients.email}) = ${normalizedEmail}`)
    .limit(1);

  if (clientByEmail.length > 0) {
    return {
      clientId: clientByEmail[0].id,
      matchType: 'email',
      confidence: 'high',
    };
  }

  const clientByAlias = await db
    .select({ clientId: clientEmailAliases.clientId })
    .from(clientEmailAliases)
    .where(eq(clientEmailAliases.emailLowercase, normalizedEmail))
    .limit(1);

  if (clientByAlias.length > 0) {
    return {
      clientId: clientByAlias[0].clientId,
      matchType: 'alias',
      confidence: 'high',
    };
  }

  if (domain) {
    const clientByCompanyDomain = await db
      .select({ id: clients.id })
      .from(clients)
      .where(sql`lower(${clients.companyEmailDomain}) = ${domain}`)
      .limit(1);

    if (clientByCompanyDomain.length > 0) {
      return {
        clientId: clientByCompanyDomain[0].id,
        matchType: 'domain',
        confidence: 'medium',
      };
    }

    const clientByDomainAllowlist = await db
      .select({ 
        clientId: clientDomainAllowlist.clientId,
        matchConfidence: clientDomainAllowlist.matchConfidence,
      })
      .from(clientDomainAllowlist)
      .where(eq(clientDomainAllowlist.domain, domain))
      .limit(1);

    if (clientByDomainAllowlist.length > 0) {
      return {
        clientId: clientByDomainAllowlist[0].clientId,
        matchType: 'domain',
        confidence: clientByDomainAllowlist[0].matchConfidence || 'medium',
      };
    }
  }

  return null;
}

export async function matchEmailsToClients(emails: string[]): Promise<Map<string, ClientMatchResult | null>> {
  const results = new Map<string, ClientMatchResult | null>();
  
  for (const email of emails) {
    const match = await matchEmailToClient(email);
    results.set(email, match);
  }
  
  return results;
}
