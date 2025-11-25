import DOMPurify from "dompurify";
import { Clock, UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatPersonName } from "../../../utils/formatters";
import { getIcon, getTypeLabel, getTypeColor } from "../helpers";
import type { ViewCommunicationDialogProps } from "../types";

export function ViewCommunicationDialog({ 
  communication, 
  isOpen, 
  onClose 
}: ViewCommunicationDialogProps) {
  if (!communication) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {getIcon(communication.type)}
            Communication Details
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
            <div>
              <span className="text-xs text-muted-foreground">Type</span>
              <div className="mt-1">
                <Badge variant="secondary" className={getTypeColor(communication.type)} data-testid={`modal-badge-type-${communication.id}`}>
                  {getTypeLabel(communication.type)}
                </Badge>
              </div>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">Date/Time</span>
              <div className="mt-1 flex items-center gap-2">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm" data-testid={`text-modal-date-${communication.id}`}>
                  {communication.loggedAt 
                    ? new Date(communication.loggedAt).toLocaleString() 
                    : 'No date'}
                </span>
              </div>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">Created By</span>
              <div className="mt-1 flex items-center gap-2">
                <UserIcon className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm" data-testid={`text-modal-user-${communication.id}`}>
                  {communication.user.firstName} {communication.user.lastName}
                </span>
              </div>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">Contact Person</span>
              <div className="mt-1">
                {communication.person ? (
                  <div className="flex items-center gap-2">
                    <UserIcon className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm" data-testid={`text-modal-person-${communication.id}`}>
                      {formatPersonName(communication.person.fullName)}
                    </span>
                  </div>
                ) : (
                  <span className="text-sm text-muted-foreground" data-testid={`text-modal-no-person-${communication.id}`}>—</span>
                )}
              </div>
            </div>
          </div>

          {communication.subject && (
            <div>
              <span className="text-xs text-muted-foreground font-medium">Subject</span>
              <h4 className="font-medium text-lg mt-1" data-testid={`text-modal-subject-${communication.id}`}>
                {communication.subject}
              </h4>
            </div>
          )}

          {communication.content && (
            <div>
              <span className="text-xs text-muted-foreground font-medium">Content</span>
              <div className="mt-2 p-4 bg-muted/30 rounded-lg" data-testid={`div-modal-content-${communication.id}`}>
                {communication.type === 'email_sent' || communication.type === 'email_received' ? (
                  <div 
                    className="prose prose-sm dark:prose-invert max-w-none"
                    dangerouslySetInnerHTML={{ 
                      __html: DOMPurify.sanitize(communication.content, {
                        ALLOWED_TAGS: ['br', 'p', 'strong', 'em', 'b', 'i', 'u', 'ul', 'ol', 'li', 'a', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'span', 'div'],
                        ALLOWED_ATTR: ['href', 'style', 'class'],
                        ALLOW_DATA_ATTR: false
                      })
                    }}
                  />
                ) : (
                  <p className="text-sm whitespace-pre-wrap">{communication.content}</p>
                )}
              </div>
            </div>
          )}

          <div className="flex justify-end pt-4">
            <Button
              onClick={() => onClose()}
              data-testid="button-close-communication-detail"
            >
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
