import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Copy, HelpCircle, Search } from "lucide-react";
import { 
  NOTIFICATION_VARIABLES, 
  getCategories, 
  getVariablesByCategory,
  type NotificationVariable 
} from "@/lib/notificationVariables";

interface NotificationVariableGuideProps {
  /**
   * Optional channel filter to show only variables relevant to a specific notification type
   */
  channel?: "email" | "sms" | "push";
  
  /**
   * Optional trigger element (if not provided, a default button will be shown)
   */
  trigger?: React.ReactNode;
  
  /**
   * Optional className for the trigger button
   */
  triggerClassName?: string;
}

export function NotificationVariableGuide({ 
  channel, 
  trigger,
  triggerClassName 
}: NotificationVariableGuideProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  
  const categories = getCategories();
  
  // Filter variables based on search query and optional channel
  const getFilteredVariables = (category: NotificationVariable["category"]) => {
    let variables = getVariablesByCategory(category);
    
    // Filter by channel if specified
    if (channel) {
      variables = variables.filter(v => !v.channels || v.channels.includes(channel));
    }
    
    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      variables = variables.filter(v => 
        v.label.toLowerCase().includes(query) ||
        v.token.toLowerCase().includes(query) ||
        v.description.toLowerCase().includes(query)
      );
    }
    
    return variables;
  };
  
  // Copy variable token to clipboard
  const copyToClipboard = (variable: NotificationVariable) => {
    navigator.clipboard.writeText(variable.token);
    toast({
      title: "Copied to clipboard",
      description: `${variable.token} has been copied`,
      duration: 2000,
    });
  };
  
  // Default trigger button
  const defaultTrigger = (
    <Button 
      variant="outline" 
      size="sm" 
      className={triggerClassName}
      data-testid="button-view-variables"
    >
      <HelpCircle className="h-4 w-4 mr-2" />
      View available variables
    </Button>
  );
  
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {trigger || defaultTrigger}
      </SheetTrigger>
      <SheetContent 
        side="right" 
        className="w-full sm:max-w-xl overflow-y-auto"
        data-testid="sheet-variable-guide"
      >
        <SheetHeader>
          <SheetTitle>Available Variables</SheetTitle>
          <SheetDescription>
            Copy and paste these variables into your notification templates. 
            They will be automatically replaced with real data when notifications are sent.
          </SheetDescription>
        </SheetHeader>
        
        <div className="mt-6 space-y-4">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search variables..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
              data-testid="input-search-variables"
            />
          </div>
          
          {/* Channel Badge (if filtered) */}
          {channel && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Showing variables for:</span>
              <Badge variant="secondary" className="uppercase">{channel}</Badge>
            </div>
          )}
          
          {/* Variables by Category */}
          <Accordion type="multiple" defaultValue={categories} className="w-full">
            {categories.map(category => {
              const variables = getFilteredVariables(category);
              
              // Hide empty categories when searching
              if (variables.length === 0) return null;
              
              return (
                <AccordionItem key={category} value={category}>
                  <AccordionTrigger data-testid={`accordion-category-${category.toLowerCase()}`}>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{category}</span>
                      <Badge variant="outline" className="ml-auto mr-2">
                        {variables.length}
                      </Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-3">
                      {variables.map(variable => (
                        <div
                          key={variable.id}
                          className="rounded-lg border bg-card p-3 hover:bg-accent/50 transition-colors"
                          data-testid={`variable-${variable.id}`}
                        >
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="flex-1">
                              <h4 className="text-sm font-medium">{variable.label}</h4>
                              <code className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                                {variable.token}
                              </code>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => copyToClipboard(variable)}
                              className="h-8 w-8 p-0"
                              data-testid={`button-copy-${variable.id}`}
                              aria-label={`Copy ${variable.token}`}
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                          <p className="text-xs text-muted-foreground mb-1">
                            {variable.description}
                          </p>
                          {variable.example && (
                            <p className="text-xs text-muted-foreground italic">
                              Example: "{variable.example}"
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
          
          {/* No Results Message */}
          {searchQuery && categories.every(cat => getFilteredVariables(cat).length === 0) && (
            <div className="text-center py-8 text-muted-foreground">
              <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No variables found matching "{searchQuery}"</p>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
