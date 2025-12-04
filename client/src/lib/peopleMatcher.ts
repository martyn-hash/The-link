/**
 * Shared People-Client Matching Module
 * 
 * Used by both AI Magic Assistant and the Matcher Debug Panel
 * to provide consistent fuzzy matching with transparent scoring.
 */

export interface PersonWithClient {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email?: string | null;
  primaryEmail?: string | null;
  telephone?: string | null;
  primaryPhone?: string | null;
  relatedCompanies?: { id: string; name: string }[];
  clientId?: string;
}

export interface Client {
  id: string;
  name: string;
}

export interface MatchScoreBreakdown {
  personNameScore: number;
  clientNameScore: number;
  exactMatchBonus: number;
  fromPatternBonus: number;
  suggestedClientBonus: number;
  total: number;
}

export interface MatchResult<T extends PersonWithClient> {
  person: T;
  score: number;
  scoreBreakdown: MatchScoreBreakdown;
  clientName: string;
  clientId: string;
  matchedPersonName: string;
  hasEmail: boolean;
  hasMobile: boolean;
  debugInfo: {
    queryParsed: {
      personSearch: string;
      clientSearch: string | null;
      usedFromPattern: boolean;
    };
    personNameLower: string;
    clientNameLower: string;
  };
}

export interface MatcherOptions {
  minScore?: number;
  maxResults?: number;
  requireEmail?: boolean;
  requireMobile?: boolean;
}

export interface MatcherInput {
  personTerm: string;
  companyTerm?: string;
}

/**
 * Calculates Levenshtein distance between two strings
 * Used for fuzzy matching when exact/substring matches fail
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix = Array(b.length + 1).fill(null).map(() => Array(a.length + 1).fill(null));

  for (let i = 0; i <= a.length; i++) matrix[0][i] = i;
  for (let j = 0; j <= b.length; j++) matrix[j][0] = j;

  for (let j = 1; j <= b.length; j++) {
    for (let i = 1; i <= a.length; i++) {
      const indicator = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1,
        matrix[j - 1][i] + 1,
        matrix[j - 1][i - 1] + indicator
      );
    }
  }
  return matrix[b.length][a.length];
}

/**
 * Calculates fuzzy match score based on Levenshtein distance
 * Returns 0-1 where 1 is perfect match
 */
function fuzzyScore(needle: string, haystack: string): number {
  if (!needle || !haystack) return 0;
  
  needle = needle.toLowerCase().trim();
  haystack = haystack.toLowerCase().trim();
  
  if (needle === haystack) return 1;
  if (haystack.includes(needle)) return 0.8 + (0.2 * needle.length / haystack.length);
  if (needle.includes(haystack)) return 0.7;
  
  // Check word-level matches
  const haystackWords = haystack.split(/\s+/);
  const needleWords = needle.split(/\s+/);
  
  let wordMatches = 0;
  for (const nw of needleWords) {
    if (haystackWords.some(hw => hw.includes(nw) || nw.includes(hw))) {
      wordMatches++;
    }
  }
  if (wordMatches > 0) {
    return 0.5 + (0.3 * wordMatches / needleWords.length);
  }
  
  // Fallback to Levenshtein for typo tolerance
  const distance = levenshteinDistance(needle, haystack);
  const maxLen = Math.max(needle.length, haystack.length);
  if (distance <= maxLen * 0.3) { // Allow up to 30% edit distance
    return 0.3 * (1 - distance / maxLen);
  }
  
  return 0;
}

/**
 * Parse search query for "from" pattern
 * e.g., "mark from monkey access" -> { person: "mark", client: "monkey access" }
 */
function parseSearchQuery(query: string): { personSearch: string; clientSearch: string | null; usedFromPattern: boolean } {
  const fromMatch = query.match(/^(.+?)\s+from\s+(.+)$/i);
  if (fromMatch) {
    return {
      personSearch: fromMatch[1].trim().toLowerCase(),
      clientSearch: fromMatch[2].trim().toLowerCase(),
      usedFromPattern: true
    };
  }
  return {
    personSearch: query.toLowerCase().trim(),
    clientSearch: null,
    usedFromPattern: false
  };
}

/**
 * Main matching function with comprehensive scoring and debug output
 */
export function matchPeopleWithContext<T extends PersonWithClient>(
  input: MatcherInput,
  people: T[],
  clients: Client[],
  options: MatcherOptions = {}
): MatchResult<T>[] {
  const { minScore = 10, maxResults = 10, requireEmail = false, requireMobile = false } = options;
  
  if (!people || people.length === 0) return [];
  
  const combinedQuery = input.companyTerm 
    ? `${input.personTerm} from ${input.companyTerm}`
    : input.personTerm;
  
  const parsed = parseSearchQuery(combinedQuery);
  
  // Create client lookup map
  const clientMap = new Map(clients.map(c => [c.id, c.name]));
  
  // Filter and score each person
  const results: MatchResult<T>[] = [];
  
  for (const person of people) {
    // Check contact requirements
    const hasEmail = !!(person.email || person.primaryEmail);
    const hasMobile = !!(person.telephone || person.primaryPhone);
    
    if (requireEmail && !hasEmail) continue;
    if (requireMobile && !hasMobile) continue;
    
    // Get client info
    const clientId = person.relatedCompanies?.[0]?.id || person.clientId || '';
    const clientName = person.relatedCompanies?.[0]?.name || clientMap.get(clientId) || '';
    
    // Build person name variations
    const firstName = (person.firstName || '').toLowerCase().trim();
    const lastName = (person.lastName || '').toLowerCase().trim();
    const fullName = `${firstName} ${lastName}`.trim();
    const reverseName = `${lastName} ${firstName}`.trim();
    const clientNameLower = clientName.toLowerCase();
    
    // Score breakdown
    const breakdown: MatchScoreBreakdown = {
      personNameScore: 0,
      clientNameScore: 0,
      exactMatchBonus: 0,
      fromPatternBonus: 0,
      suggestedClientBonus: 0,
      total: 0
    };
    
    // Score person name matching
    const personSearchTerm = parsed.personSearch;
    
    // Exact matches get highest score
    if (firstName === personSearchTerm || lastName === personSearchTerm) {
      breakdown.personNameScore = 50;
      breakdown.exactMatchBonus = 10;
    } else if (fullName === personSearchTerm || reverseName === personSearchTerm) {
      breakdown.personNameScore = 55;
      breakdown.exactMatchBonus = 15;
    } else {
      // Fuzzy matching
      const firstNameScore = fuzzyScore(personSearchTerm, firstName) * 40;
      const lastNameScore = fuzzyScore(personSearchTerm, lastName) * 40;
      const fullNameScore = fuzzyScore(personSearchTerm, fullName) * 50;
      
      breakdown.personNameScore = Math.max(firstNameScore, lastNameScore, fullNameScore);
    }
    
    // Score client/company name matching
    if (parsed.clientSearch) {
      breakdown.fromPatternBonus = 5; // Bonus for using structured query
      
      if (clientNameLower === parsed.clientSearch) {
        breakdown.clientNameScore = 40;
        breakdown.exactMatchBonus += 10;
      } else {
        breakdown.clientNameScore = fuzzyScore(parsed.clientSearch, clientNameLower) * 35;
      }
    } else if (input.companyTerm) {
      // Direct company term provided
      const companySearchLower = input.companyTerm.toLowerCase();
      if (clientNameLower === companySearchLower) {
        breakdown.clientNameScore = 40;
      } else {
        breakdown.clientNameScore = fuzzyScore(companySearchLower, clientNameLower) * 35;
      }
      breakdown.suggestedClientBonus = breakdown.clientNameScore > 0 ? 5 : 0;
    }
    
    // Calculate total
    breakdown.total = 
      breakdown.personNameScore + 
      breakdown.clientNameScore + 
      breakdown.exactMatchBonus + 
      breakdown.fromPatternBonus +
      breakdown.suggestedClientBonus;
    
    if (breakdown.total >= minScore) {
      results.push({
        person,
        score: breakdown.total,
        scoreBreakdown: breakdown,
        clientName,
        clientId,
        matchedPersonName: fullName || `${person.firstName || ''} ${person.lastName || ''}`.trim(),
        hasEmail,
        hasMobile,
        debugInfo: {
          queryParsed: parsed,
          personNameLower: fullName,
          clientNameLower
        }
      });
    }
  }
  
  // Sort by score descending and limit results
  results.sort((a, b) => b.score - a.score);
  
  return results.slice(0, maxResults);
}

/**
 * Convenience function to get the best match (used by AI Magic)
 */
export function getBestMatch<T extends PersonWithClient>(
  input: MatcherInput,
  people: T[],
  clients: Client[],
  options: MatcherOptions = {}
): MatchResult<T> | null {
  const results = matchPeopleWithContext(input, people, clients, { ...options, maxResults: 1 });
  return results.length > 0 ? results[0] : null;
}

/**
 * Get all scored matches for debug panel
 */
export function getAllScoredMatches<T extends PersonWithClient>(
  input: MatcherInput,
  people: T[],
  clients: Client[],
  options: MatcherOptions = {}
): MatchResult<T>[] {
  return matchPeopleWithContext(input, people, clients, { ...options, minScore: 1, maxResults: 50 });
}
