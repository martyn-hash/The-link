import type { ReactNode } from "react";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { StageChangeContent } from "./stage-change-content";

interface StageChangePopoverProps {
  projectId: string;
  children: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function StageChangePopover({
  projectId,
  children,
  open,
  onOpenChange,
}: StageChangePopoverProps) {
  return (
    <HoverCard
      open={open}
      onOpenChange={onOpenChange}
      openDelay={300}
      closeDelay={100}
    >
      <HoverCardTrigger asChild>
        {children}
      </HoverCardTrigger>
      <HoverCardContent
        side="right"
        align="start"
        sideOffset={8}
        className="w-[500px] max-w-[90vw] p-0 overflow-hidden"
        data-testid="stage-change-popover"
      >
        <div className="max-h-[400px] overflow-y-auto p-4">
          <div className="mb-3 text-sm font-semibold text-foreground">
            Last Stage Change
          </div>
          <StageChangeContent projectId={projectId} compact={true} />
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
