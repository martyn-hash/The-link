import { useState } from "react";
import { useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

interface ClientSearchProps {
  // For local search on clients page
  value?: string;
  onChange?: (value: string) => void;
  
  // For global search in navigation
  isGlobal?: boolean;
  placeholder?: string;
  className?: string;
}

export default function ClientSearch({ 
  value, 
  onChange, 
  isGlobal = false, 
  placeholder = "Search clients...",
  className = ""
}: ClientSearchProps) {
  const [localValue, setLocalValue] = useState("");
  const [, setLocation] = useLocation();

  const searchValue = isGlobal ? localValue : (value || "");
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    
    if (isGlobal) {
      setLocalValue(newValue);
    } else if (onChange) {
      onChange(newValue);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && isGlobal && searchValue.trim()) {
      // Navigate to clients page with search - we'll handle this via URL params later
      setLocation(`/clients?search=${encodeURIComponent(searchValue.trim())}`);
    }
  };

  return (
    <div className={`relative ${className}`}>
      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
      <Input
        type="text"
        placeholder={placeholder}
        value={searchValue}
        onChange={handleChange}
        onKeyPress={handleKeyPress}
        className="pl-10"
        data-testid={isGlobal ? "input-global-search-clients" : "input-search-clients"}
      />
    </div>
  );
}