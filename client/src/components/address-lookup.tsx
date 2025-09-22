import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Search, MapPin, Loader2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

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

  const searchAddresses = async () => {
    if (!searchTerm.trim()) {
      toast({
        title: "Search term required",
        description: "Please enter an address or postcode to search",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setHasSearched(false);

    try {
      const response = await fetch(`/api/address-lookup/${encodeURIComponent(searchTerm.trim())}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          toast({
            title: "No addresses found",
            description: "No addresses were found for this search. Please try a different term.",
            variant: "destructive",
          });
          setAddresses([]);
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

      if (!transformedAddresses || transformedAddresses.length === 0) {
        toast({
          title: "No addresses found",
          description: "No addresses were found for this search term.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Address lookup error:", error);
      toast({
        title: "Address lookup failed",
        description: "Unable to search for addresses. Please try again later.",
        variant: "destructive",
      });
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
      <div className="flex items-center space-x-2">
        <div className="flex-1">
          <Label htmlFor="searchTerm">Address or Postcode</Label>
          <div className="flex space-x-2 mt-1">
            <Input
              id="searchTerm"
              placeholder="Enter address or postcode (e.g., 10 Downing Street, SW1A 1AA)"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyPress={handleKeyPress}
              data-testid="input-address-search"
            />
            <Button 
              onClick={searchAddresses}
              disabled={isLoading || !searchTerm.trim()}
              data-testid="button-search-address"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
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

      {/* Current address display */}
      {value && (value.addressLine1 || value.locality) && (
        <div className="p-3 bg-muted/20 rounded-lg border">
          <Label className="text-sm font-medium">Current Address</Label>
          <div className="mt-1 text-sm text-muted-foreground">
            <div>{value.addressLine1}</div>
            {value.addressLine2 && <div>{value.addressLine2}</div>}
            <div>
              {[value.locality, value.region, value.postalCode]
                .filter(Boolean)
                .join(", ")}
            </div>
            {value.country && <div>{value.country}</div>}
          </div>
        </div>
      )}
    </div>
  );
}