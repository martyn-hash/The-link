import { useState } from "react";
import SuperSearch from "@/components/super-search";

export default function MobileSearchTrigger() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <SuperSearch
      isOpen={isOpen}
      onOpenChange={setIsOpen}
    />
  );
}

export function useMobileSearch() {
  const [isOpen, setIsOpen] = useState(false);

  return {
    isOpen,
    openSearch: () => setIsOpen(true),
    closeSearch: () => setIsOpen(false),
    SearchComponent: () => (
      <SuperSearch
        isOpen={isOpen}
        onOpenChange={setIsOpen}
      />
    ),
  };
}
