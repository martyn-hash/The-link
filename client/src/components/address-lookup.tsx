import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Search, MapPin, Loader2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

// Debounce utility function
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

interface GetAddressAutocompleteResponse {
  suggestions: {
    address: string;
    url: string;
    id: string;
  }[];
}

interface AddressResult {
  formatted: string;
  line1: string;
  line2?: string;
  city: string;
  county?: string;
  region?: string;
  postcode: string;
  country: string;
}

interface AddressLookupProps {
  onAddressSelect: (address: {
    addressLine1: string;
    addressLine2?: string;
    locality: string;
    region: string;
    postalCode: string;
    country: string;
  }) => void;
  value?: {
    addressLine1?: string;
    addressLine2?: string;
    locality?: string;
    region?: string;
    postalCode?: string;
    country?: string;
  };
}

export default function AddressLookup({ onAddressSelect, value }: AddressLookupProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [addresses, setAddresses] = useState<AddressResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const { toast } = useToast();

  // Debounced search function
  const debouncedSearch = useCallback(
    debounce(async (term: string) => {
      if (term.trim().length >= 3) {
        await searchAddresses(term);
      } else {
        setAddresses([]);
        setHasSearched(false);
      }
    }, 500),
    []
  );

  // Effect to trigger search when searchTerm changes
  useEffect(() => {
    if (searchTerm) {
      debouncedSearch(searchTerm);
    } else {
      setAddresses([]);
      setHasSearched(false);
    }
  }, [searchTerm, debouncedSearch]);

  const searchAddresses = async (term?: string) => {
    const searchValue = term || searchTerm;
    
    if (!searchValue.trim()) {
      return;
    }

    setIsLoading(true);
    setHasSearched(false);

    try {
      const response = await fetch(`/api/address-lookup/${encodeURIComponent(searchValue.trim())}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          setAddresses([]);
          setHasSearched(true);
        } else {
          throw new Error(`HTTP ${response.status}`);
        }
        return;
      }

      const data: GetAddressAutocompleteResponse = await response.json();
      
      // Transform getaddress.io autocomplete response to our format
      const transformedAddresses: AddressResult[] = (data.suggestions || []).map((suggestion) => {
        const parts = suggestion.address.split(', ');
        return {
          formatted: suggestion.address,
          line1: parts[0] || '',
          line2: parts[1] || undefined,
          city: parts[parts.length - 3] || '',
          county: parts[parts.length - 2] || '',
          region: parts[parts.length - 2] || '',
          postcode: parts[parts.length - 1] || '',
          country: 'United Kingdom'
        };
      });
      
      setAddresses(transformedAddresses);
      setHasSearched(true);
    } catch (error) {
      console.error("Address lookup error:", error);
      setAddresses([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddressSelect = (selectedAddress: AddressResult) => {
    const formattedAddress = {
      addressLine1: selectedAddress.line1,
      addressLine2: selectedAddress.line2 || "",
      locality: selectedAddress.city,
      region: selectedAddress.county || selectedAddress.region || "",
      postalCode: selectedAddress.postcode,
      country: selectedAddress.country,
    };

    onAddressSelect(formattedAddress);
    
    toast({
      title: "Address selected",
      description: "Address has been populated in the form",
    });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      searchAddresses();
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="searchTerm">Address or Postcode</Label>
        <div className="relative">
          <Input
            id="searchTerm"
            placeholder="Start typing address (e.g., 11 Primrose Crescent, Worcester...)"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            data-testid="input-address-search"
            className="pr-10"
          />
          {isLoading && (
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Type at least 3 characters to see suggestions
        </p>
      </div>

      {hasSearched && addresses.length > 0 && (
        <div className="space-y-2">
          <Label>Select Address</Label>
          <Select onValueChange={(value) => {
            const selectedAddress = addresses[parseInt(value)];
            if (selectedAddress) {
              handleAddressSelect(selectedAddress);
            }
          }}>
            <SelectTrigger data-testid="select-address">
              <SelectValue placeholder="Choose an address" />
            </SelectTrigger>
            <SelectContent>
              {addresses.map((address, index) => (
                <SelectItem key={index} value={index.toString()}>
                  <div className="flex items-center space-x-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span>
                      {[
                        address.line1,
                        address.line2,
                        address.city,
                        address.county
                      ].filter(Boolean).join(", ")}
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {hasSearched && addresses.length === 0 && searchTerm.length >= 3 && (
        <div className="text-sm text-muted-foreground">
          No addresses found for "{searchTerm}". Try a different search term.
        </div>
      )}
    </div>
  );
}