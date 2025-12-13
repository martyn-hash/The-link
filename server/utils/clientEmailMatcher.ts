import { db } from "../db";
import { eq, sql } from "drizzle-orm";
import { clients, clientEmailAliases, clientDomainAllowlist, people, clientPeople } from "@shared/schema";

export interface ClientMatchResult {
  clientId: string;
  matchType: 'email' | 'alias' | 'domain' | 'person';
  confidence: 'high' | 'medium' | 'low';
  personId?: string;
}

export async function matchEmailToClient(email: string): Promise<ClientMatchResult | null> {
  const normalizedEmail = email.toLowerCase().trim();
  const domain = normalizedEmail.split('@')[1];

  // 1. Check client's direct email field
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

  // 2. Check people's emails (email, primary_email, email_2) and find linked client
  const personByEmail = await db
    .select({ 
      personId: people.id,
      clientId: clientPeople.clientId 
    })
    .from(people)
    .innerJoin(clientPeople, eq(clientPeople.personId, people.id))
    .where(sql`
      lower(${people.email}) = ${normalizedEmail} OR
      lower(${people.primaryEmail}) = ${normalizedEmail} OR
      lower(${people.email2}) = ${normalizedEmail}
    `)
    .limit(1);

  if (personByEmail.length > 0) {
    return {
      clientId: personByEmail[0].clientId,
      matchType: 'person',
      confidence: 'high',
      personId: personByEmail[0].personId,
    };
  }

  // 3. Check client email aliases
  const clientByAlias = await db
    .select({ clientId: clientEmailAliases.clientId })
    .from(clientEmailAliases)
    .where(sql`lower(email) = ${normalizedEmail}`)
    .limit(1);

  if (clientByAlias.length > 0) {
    return {
      clientId: clientByAlias[0].clientId,
      matchType: 'alias',
      confidence: 'high',
    };
  }

  // 4. Check client's company email domain
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

    // 5. Check domain allowlist
    const clientByDomainAllowlist = await db
      .select({ 
        clientId: clientDomainAllowlist.clientId,
      })
      .from(clientDomainAllowlist)
      .where(eq(clientDomainAllowlist.domain, domain))
      .limit(1);

    if (clientByDomainAllowlist.length > 0) {
      return {
        clientId: clientByDomainAllowlist[0].clientId,
        matchType: 'domain',
        confidence: 'medium',
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
