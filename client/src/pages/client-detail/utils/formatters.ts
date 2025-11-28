export function formatPersonName(fullName: string): string {
  if (!fullName) return '';
  
  if (fullName.includes(',')) {
    const [lastName, firstName] = fullName.split(',').map(part => part.trim());
    
    const formattedFirstName = firstName.toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
    const formattedLastName = lastName.toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
    
    return `${formattedFirstName} ${formattedLastName}`;
  }
  
  return fullName;
}

export function formatDate(date: string | Date | null): string {
  if (!date) return 'Not provided';
  
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(dateObj.getTime())) return 'Invalid date';
  
  return dateObj.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
}

export function formatBirthDate(dateOfBirth: string | Date | null): string {
  if (!dateOfBirth) return 'Not provided';
  
  if (typeof dateOfBirth === 'string') {
    // Handle UK format DD/MM/YYYY (stored by import)
    const ukDatePattern = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
    const ukMatch = dateOfBirth.match(ukDatePattern);
    
    if (ukMatch) {
      const [, day, month, year] = ukMatch;
      const date = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day)));
      
      if (!isNaN(date.getTime())) {
        return date.toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
          timeZone: 'UTC'
        });
      }
    }
    
    // Handle partial date format YYYY-MM (Companies House style)
    const partialDatePattern = /^(\d{4})-(\d{2})(?:-01(?:T00:00:00(?:\.\d+)?Z?)?)?$/;
    const match = dateOfBirth.match(partialDatePattern);
    
    if (match) {
      const [, year, month] = match;
      const date = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, 1));
      
      if (!isNaN(date.getTime())) {
        return date.toLocaleDateString('en-GB', { 
          month: 'long', 
          year: 'numeric',
          timeZone: 'UTC'
        });
      }
    }
  }
  
  // Fallback to standard Date parsing (ISO format, etc.)
  const date = new Date(dateOfBirth);
  
  if (isNaN(date.getTime())) {
    return 'Invalid date';
  }
  
  return date.toLocaleDateString('en-GB', {
    timeZone: 'UTC'
  });
}

export function maskIdentifier(value: string, visibleChars = 2): string {
  if (!value || value.length <= visibleChars) return value;
  const masked = '*'.repeat(Math.max(0, value.length - visibleChars));
  return masked + value.slice(-visibleChars);
}
