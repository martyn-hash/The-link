import type { Express } from "express";
import fetch from "node-fetch";

export function registerAddressRoutes(
  app: Express,
  isAuthenticated: any
) {
  app.get('/api/address-lookup/:term', isAuthenticated, async (req: any, res) => {
    try {
      const { term } = req.params;

      if (!term || term.trim().length === 0) {
        return res.status(400).json({ error: 'Search term is required' });
      }

      const apiKey = process.env.GETADDRESS_API_KEY;
      if (!apiKey) {
        console.error('GETADDRESS_API_KEY not found in environment variables');
        return res.status(500).json({ error: 'Address lookup service not configured' });
      }

      const cleanTerm = term.trim();
      const url = `https://api.getaddress.io/autocomplete/${encodeURIComponent(cleanTerm)}?api-key=${apiKey}`;

      const response = await fetch(url);

      if (response.status === 404) {
        return res.status(404).json({ error: 'No addresses found for this search term' });
      }

      if (!response.ok) {
        console.error('getaddress.io API error:', response.status, await response.text());
        return res.status(500).json({ error: 'Address lookup service unavailable' });
      }

      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error('Address lookup error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get('/api/address-details/:id', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;

      if (!id || id.trim().length === 0) {
        return res.status(400).json({ error: 'Address ID is required' });
      }

      const apiKey = process.env.GETADDRESS_API_KEY;
      if (!apiKey) {
        console.error('GETADDRESS_API_KEY not found in environment variables');
        return res.status(500).json({ error: 'Address lookup service not configured' });
      }

      const url = `https://api.getaddress.io/get/${encodeURIComponent(id)}?api-key=${apiKey}`;

      const response = await fetch(url);

      if (response.status === 404) {
        return res.status(404).json({ error: 'Address not found' });
      }

      if (!response.ok) {
        console.error('getaddress.io details API error:', response.status, await response.text());
        return res.status(500).json({ error: 'Address details service unavailable' });
      }

      const data = await response.json() as any;

      const transformedAddress = {
        line1: data.line_1 || "",
        line2: data.line_2 || "",
        city: data.town_or_city || "",
        county: data.county || "",
        postcode: data.postcode || "",
        country: "United Kingdom"
      };

      res.json(transformedAddress);
    } catch (error) {
      console.error('Address details error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get('/api/address-find/:postcode', isAuthenticated, async (req: any, res) => {
    try {
      const { postcode } = req.params;

      if (!postcode || postcode.trim().length === 0) {
        return res.status(400).json({ error: 'Postcode is required' });
      }

      const apiKey = process.env.GETADDRESS_API_KEY;
      if (!apiKey) {
        console.error('GETADDRESS_API_KEY not found in environment variables');
        return res.status(500).json({ error: 'Address lookup service not configured' });
      }

      const cleanPostcode = postcode.trim().replace(/\s+/g, '').toUpperCase();
      const url = `https://api.getaddress.io/find/${encodeURIComponent(cleanPostcode)}?api-key=${apiKey}&expand=true`;

      const response = await fetch(url);

      if (response.status === 404) {
        return res.status(404).json({ 
          error: 'No addresses found for this postcode',
          postcode: cleanPostcode 
        });
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error('getaddress.io Find API error:', response.status, errorText);
        return res.status(500).json({ error: 'Address lookup service unavailable' });
      }

      const data = await response.json() as any;
      
      const extractHouseNumber = (line1: string): { primary: number; secondary: string } => {
        if (!line1) return { primary: Infinity, secondary: '' };
        
        const leadingMatch = line1.match(/^(\d+)([A-Za-z])?/);
        if (leadingMatch) {
          return { 
            primary: parseInt(leadingMatch[1], 10), 
            secondary: leadingMatch[2] || '' 
          };
        }
        
        const flatMatch = line1.match(/^(?:Flat|Unit|Apartment|Suite)\s+\d+[A-Za-z]?,?\s+(\d+)([A-Za-z])?/i);
        if (flatMatch) {
          return { 
            primary: parseInt(flatMatch[1], 10), 
            secondary: flatMatch[2] || '' 
          };
        }
        
        const anyNumberMatch = line1.match(/(\d+)([A-Za-z])?/);
        if (anyNumberMatch) {
          return { 
            primary: parseInt(anyNumberMatch[1], 10), 
            secondary: anyNumberMatch[2] || '' 
          };
        }
        
        return { primary: Infinity, secondary: '' };
      };
      
      const addresses = (data.addresses || []).map((addr: any, index: number) => ({
        id: `${cleanPostcode}-${index}`,
        formatted: addr.formatted_address ? 
          addr.formatted_address.filter((line: string) => line.trim()).join(', ') :
          [addr.line_1, addr.line_2, addr.line_3, addr.town_or_city, addr.county].filter(Boolean).join(', '),
        line1: addr.line_1 || '',
        line2: addr.line_2 || '',
        line3: addr.line_3 || '',
        city: addr.town_or_city || '',
        county: addr.county || '',
        postcode: data.postcode || cleanPostcode,
        country: 'United Kingdom'
      }));
      
      addresses.sort((a: any, b: any) => {
        const numA = extractHouseNumber(a.line1);
        const numB = extractHouseNumber(b.line1);
        
        if (numA.primary !== numB.primary) return numA.primary - numB.primary;
        if (numA.secondary !== numB.secondary) return numA.secondary.localeCompare(numB.secondary);
        
        return a.line1.localeCompare(b.line1);
      });

      res.json({
        postcode: data.postcode || cleanPostcode,
        latitude: data.latitude,
        longitude: data.longitude,
        addresses
      });
    } catch (error) {
      console.error('Postcode find error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
}
