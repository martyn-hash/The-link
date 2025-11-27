import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Search, MapPin, Loader2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

interface AddressResult {
  id: string;
  formatted: string;
  line1: string;
  line2?: string;
  line3?: string;
  city: string;
  county?: string;
  postcode: string;
  country: string;
}

interface PostcodeFindResponse {
  postcode: string;
  latitude?: number;
  longitude?: number;
  addresses: AddressResult[];
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
  const [postcode, setPostcode] = useState("");
  const [addresses, setAddresses] = useState<AddressResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { toast } = useToast();

  const findAddresses = async () => {
    if (!postcode.trim()) {
      setErrorMessage("Please enter a postcode");
      return;
    }

    setIsLoading(true);
    setHasSearched(false);
    setErrorMessage(null);
    setAddresses([]);

    try {
      const response = await fetch(`/api/address-find/${encodeURIComponent(postcode.trim())}`);
      
      if (response.status === 404) {
        setErrorMessage("No addresses found for this postcode. Please check and try again.");
        setHasSearched(true);
        return;
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data: PostcodeFindResponse = await response.json();
      
      if (data.addresses && data.addresses.length > 0) {
        setAddresses(data.addresses);
        setHasSearched(true);
      } else {
        setErrorMessage("No addresses found for this postcode.");
        setHasSearched(true);
      }
    } catch (error) {
      console.error("Postcode lookup error:", error);
      setErrorMessage("Address lookup failed. Please try again or enter the address manually.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddressSelect = (selectedAddress: AddressResult) => {
    // Build address line 1 from line1 and line2 if present
    const addressLine1 = [selectedAddress.line1, selectedAddress.line2]
      .filter(Boolean)
      .join(', ');

    const formattedAddress = {
      addressLine1: addressLine1 || selectedAddress.line1,
      addressLine2: selectedAddress.line3 || "",
      locality: selectedAddress.city,
      region: selectedAddress.county || "",
      postalCode: selectedAddress.postcode,
      country: selectedAddress.country,
    };

    onAddressSelect(formattedAddress);
    
    toast({
      title: "Address selected",
      description: "Address has been populated in the form",
    });

    // Clear the lookup state after selection
    setAddresses([]);
    setPostcode("");
    setHasSearched(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      findAddresses();
    }
  };

  return (
    <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
      <div className="flex items-center gap-2 mb-2">
        <MapPin className="h-4 w-4 text-muted-foreground" />
        <Label className="text-sm font-medium">Postcode Lookup</Label>
      </div>
      
      <div className="flex gap-2">
        <div className="flex-1">
          <Input
            placeholder="Enter postcode (e.g. SW1A 1AA)"
            value={postcode}
            onChange={(e) => {
              setPostcode(e.target.value.toUpperCase());
              setErrorMessage(null);
            }}
            onKeyPress={handleKeyPress}
            data-testid="input-postcode-lookup"
            className="uppercase"
          />
        </div>
        <Button
          type="button"
          onClick={findAddresses}
          disabled={isLoading || !postcode.trim()}
          data-testid="button-find-address"
          className="min-w-[100px]"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <Search className="h-4 w-4 mr-2" />
              Find
            </>
          )}
        </Button>
      </div>

      {errorMessage && (
        <p className="text-sm text-destructive" data-testid="postcode-error">
          {errorMessage}
        </p>
      )}

      {hasSearched && addresses.length > 0 && (
        <div className="space-y-2">
          <Label className="text-sm">Select your address ({addresses.length} found)</Label>
          <Select onValueChange={(value) => {
            const selectedAddress = addresses[parseInt(value)];
            if (selectedAddress) {
              handleAddressSelect(selectedAddress);
            }
          }}>
            <SelectTrigger data-testid="select-address">
              <SelectValue placeholder="Choose your address from the list" />
            </SelectTrigger>
            <SelectContent>
              {addresses.map((address, index) => (
                <SelectItem key={address.id || index} value={index.toString()}>
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <span className="text-left">
                      {address.formatted || [
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

      <p className="text-xs text-muted-foreground">
        Enter your postcode and click Find, then select your address from the list. 
        You can also enter the address manually in the fields below.
      </p>
    </div>
  );
}
