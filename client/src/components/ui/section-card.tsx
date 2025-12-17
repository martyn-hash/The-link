import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight, AlertCircle, CheckCircle2, Settings } from "lucide-react";
import { useState } from "react";

export type SectionStatus = "configured" | "needs-setup" | "error" | "optional";

interface SectionCardProps {
  icon: ReactNode;
  title: string;
  description?: string;
  status?: SectionStatus;
  itemCount?: number;
  itemLabel?: string;
  children?: ReactNode;
  defaultOpen?: boolean;
  collapsible?: boolean;
  onEdit?: () => void;
  className?: string;
  headerAction?: ReactNode;
}

const statusConfig: Record<SectionStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: ReactNode }> = {
  configured: {
    label: "Configured",
    variant: "default",
    icon: <CheckCircle2 className="h-3 w-3" />,
  },
  "needs-setup": {
    label: "Needs Setup",
    variant: "secondary",
    icon: <Settings className="h-3 w-3" />,
  },
  error: {
    label: "Error",
    variant: "destructive",
    icon: <AlertCircle className="h-3 w-3" />,
  },
  optional: {
    label: "Optional",
    variant: "outline",
    icon: null,
  },
};

export function SectionCard({
  icon,
  title,
  description,
  status,
  itemCount,
  itemLabel = "items",
  children,
  defaultOpen = false,
  collapsible = true,
  onEdit,
  className,
  headerAction,
}: SectionCardProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const statusInfo = status ? statusConfig[status] : null;

  const headerContent = (
    <div className="flex items-start gap-4 w-full">
      <div
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
          status === "configured" && "bg-primary/10 text-primary",
          status === "needs-setup" && "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
          status === "error" && "bg-destructive/10 text-destructive",
          status === "optional" && "bg-muted text-muted-foreground",
          !status && "bg-muted text-muted-foreground"
        )}
      >
        {icon}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <CardTitle className="text-base font-semibold">{title}</CardTitle>
          {statusInfo && (
            <Badge
              variant={statusInfo.variant}
              className="text-xs gap-1"
            >
              {statusInfo.icon}
              {statusInfo.label}
            </Badge>
          )}
        </div>
        {(description || itemCount !== undefined) && (
          <div className="flex items-center gap-2 mt-1">
            {description && (
              <CardDescription className="text-sm">{description}</CardDescription>
            )}
            {itemCount !== undefined && (
              <span className="text-xs text-muted-foreground">
                {itemCount} {itemCount === 1 ? itemLabel.replace(/s$/, "") : itemLabel}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {headerAction}
        {onEdit && !collapsible && (
          <Button variant="outline" size="sm" onClick={onEdit}>
            Edit
          </Button>
        )}
        {collapsible && (
          <div className="text-muted-foreground">
            {isOpen ? (
              <ChevronDown className="h-5 w-5" />
            ) : (
              <ChevronRight className="h-5 w-5" />
            )}
          </div>
        )}
      </div>
    </div>
  );

  if (!collapsible) {
    return (
      <Card
        className={cn(
          "transition-all duration-200 hover:shadow-md",
          className
        )}
        data-testid={`section-card-${title.toLowerCase().replace(/\s+/g, "-")}`}
      >
        <CardHeader className="pb-2">{headerContent}</CardHeader>
        {children && <CardContent>{children}</CardContent>}
      </Card>
    );
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card
        className={cn(
          "transition-all duration-200",
          isOpen && "ring-1 ring-primary/20 shadow-md",
          !isOpen && "hover:shadow-md",
          className
        )}
        data-testid={`section-card-${title.toLowerCase().replace(/\s+/g, "-")}`}
      >
        <CollapsibleTrigger asChild>
          <CardHeader className="pb-2 cursor-pointer select-none">
            {headerContent}
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          {children && (
            <CardContent className="pt-2 border-t">{children}</CardContent>
          )}
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

interface SectionCardGridProps {
  children: ReactNode;
  className?: string;
}

export function SectionCardGrid({ children, className }: SectionCardGridProps) {
  return (
    <div className={cn("grid gap-4 md:grid-cols-2 lg:grid-cols-1", className)}>
      {children}
    </div>
  );
}
