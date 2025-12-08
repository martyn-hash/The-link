export function matchPersonWithClientContext<T extends { id: string; firstName: string | null; lastName: string | null; clientId: string }>(
  searchQuery: string,
  suggestedClient: string | undefined,
  people: T[],
  clients: { id: string; name: string }[],
  filterFn?: (person: T) => boolean
): { person: T; score: number; clientName: string } | null {
  if (!people || people.length === 0) return null;
  
  const query = searchQuery.toLowerCase().trim();
  if (!query) return null;
  
  const clientMap = new Map(clients.map(c => [c.id, c.name]));
  const filteredPeople = filterFn ? people.filter(filterFn) : people;
  
  const scored = filteredPeople
    .map(p => {
      const firstName = (p.firstName || '').toLowerCase();
      const lastName = (p.lastName || '').toLowerCase();
      const fullName = `${firstName} ${lastName}`.trim();
      const clientName = (clientMap.get(p.clientId) || '').toLowerCase();
      
      let score = 0;
      
      const fromMatch = query.match(/^(.+?)\s+from\s+(.+)$/i);
      if (fromMatch) {
        const personSearch = fromMatch[1].toLowerCase().trim();
        const clientSearch = fromMatch[2].toLowerCase().trim();
        
        if (firstName === personSearch || lastName === personSearch) {
          score += 50;
        } else if (fullName.includes(personSearch) || personSearch.includes(fullName)) {
          score += 30;
        } else if (firstName.includes(personSearch) || lastName.includes(personSearch)) {
          score += 20;
        }
        
        if (clientName.includes(clientSearch) || clientSearch.includes(clientName)) {
          score += 40;
        } else if (clientName.split(/\s+/).some(word => clientSearch.includes(word))) {
          score += 20;
        }
      } else {
        if (firstName === query || lastName === query || fullName === query) {
          score += 60;
        } else if (fullName.includes(query) || query.includes(fullName)) {
          score += 40;
        } else if (firstName.includes(query) || query.includes(firstName) || 
                   lastName.includes(query) || query.includes(lastName)) {
          score += 25;
        }
        
        if (suggestedClient) {
          const suggestedLower = suggestedClient.toLowerCase();
          if (clientName.includes(suggestedLower) || suggestedLower.includes(clientName)) {
            score += 30;
          }
        }
      }
      
      return { person: p, score, clientName: clientMap.get(p.clientId) || '' };
    })
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score);
  
  return scored.length > 0 ? scored[0] : null;
}
