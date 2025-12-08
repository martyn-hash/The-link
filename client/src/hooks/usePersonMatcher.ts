import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getBestMatch } from '@/lib/peopleMatcher';

interface PersonWithRelations {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email?: string | null;
  primaryEmail?: string | null;
  telephone?: string | null;
  primaryPhone?: string | null;
  relatedCompanies?: { id: string; name: string }[];
}

interface Client {
  id: string;
  name: string;
}

interface PersonMatchResult {
  person: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email?: string;
    telephone?: string;
    clientId: string;
  };
  clientId: string;
  clientName: string;
  score: number;
}

interface UsePersonMatcherOptions {
  personName: string;
  clientName?: string;
  requireEmail?: boolean;
  requireMobile?: boolean;
  enabled?: boolean;
}

export function usePersonMatcher({
  personName,
  clientName,
  requireEmail = false,
  requireMobile = false,
  enabled = true,
}: UsePersonMatcherOptions) {
  const { data: rawPeople, isLoading: isLoadingPeople } = useQuery<PersonWithRelations[]>({
    queryKey: ['/api/people'],
    enabled,
  });

  const { data: clients, isLoading: isLoadingClients } = useQuery<Client[]>({
    queryKey: ['/api/clients'],
    enabled,
  });

  const matchResult = useMemo((): PersonMatchResult | null => {
    if (!rawPeople || !clients) return null;

    const people = rawPeople.map(p => ({
      ...p,
      email: p.email || p.primaryEmail || undefined,
      telephone: p.telephone || p.primaryPhone || undefined,
      clientId: p.relatedCompanies?.[0]?.id || ''
    }));

    const result = getBestMatch(
      { personTerm: personName, companyTerm: clientName },
      people,
      clients,
      { requireEmail, requireMobile }
    );

    if (!result?.person) return null;

    return {
      person: {
        id: result.person.id,
        firstName: result.person.firstName,
        lastName: result.person.lastName,
        email: result.person.email || undefined,
        telephone: result.person.telephone || undefined,
        clientId: result.clientId || '',
      },
      clientId: result.clientId || '',
      clientName: result.clientName || '',
      score: result.score || 0,
    };
  }, [rawPeople, clients, personName, clientName, requireEmail, requireMobile]);

  return {
    matchResult,
    isLoading: isLoadingPeople || isLoadingClients,
    people: rawPeople,
    clients,
  };
}

export function matchStaffMember(
  suggestedName: string | undefined,
  staffMembers: { id: string; firstName: string | null; lastName: string | null }[] | undefined
): { user: { id: string; firstName: string | null; lastName: string | null }; score: number } | undefined {
  if (!suggestedName || !staffMembers) return undefined;
  
  const searchTerms = suggestedName.toLowerCase().trim().split(/\s+/);
  
  let bestMatch: { user: typeof staffMembers[0]; score: number } | undefined;
  
  for (const staff of staffMembers) {
    const firstName = (staff.firstName || '').toLowerCase();
    const lastName = (staff.lastName || '').toLowerCase();
    let score = 0;
    
    for (const term of searchTerms) {
      if (firstName === term) score += 50;
      else if (lastName === term) score += 50;
      else if (firstName.startsWith(term) && term.length >= 2) score += 30;
      else if (lastName.startsWith(term) && term.length >= 2) score += 30;
    }
    
    if (score >= 30 && (!bestMatch || score > bestMatch.score)) {
      bestMatch = { user: staff, score };
    }
  }
  
  return bestMatch;
}
