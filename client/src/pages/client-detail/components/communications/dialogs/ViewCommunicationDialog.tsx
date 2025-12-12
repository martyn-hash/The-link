import DOMPurify from "dompurify";
import { Clock, UserIcon, FileAudio, Loader2, AlertCircle, Phone, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatPersonName } from "../../../utils/formatters";
import { getIcon, getTypeLabel, getTypeColor } from "../helpers";
import type { ViewCommunicationDialogProps } from "../types";

function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds} second${seconds !== 1 ? 's' : ''}`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (remainingSeconds === 0) {
    return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
  }
  return `${minutes}m ${remainingSeconds}s`;
}

export function ViewCommunicationDialog({ 
  communication, 
  isOpen, 
  onClose 
}: ViewCommunicationDialogProps) {
  if (!communication) return null;

  const metadata = communication.metadata as Record<string, any> | null;
  const isPhoneCall = communication.type === 'phone_call';
  const transcriptionStatus = metadata?.transcriptionStatus;
  const transcript = metadata?.transcript;
  const summary = metadata?.summary;
  const duration = metadata?.duration;
  const phoneNumber = metadata?.phoneNumber;
  const direction = metadata?.direction;
  const callDescription = metadata?.callDescription;

  if (isPhoneCall) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Phone className="h-5 w-5" />
              Phone Call Details
            </DialogTitle>
          </DialogHeader>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 p-4 bg-muted/50 rounded-lg">
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
                  <span className="text-xs text-muted-foreground">Duration</span>
                  <div className="mt-1 flex items-center gap-2">
                    <Timer className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm" data-testid={`text-modal-duration-${communication.id}`}>
                      {typeof duration === 'number' ? formatDuration(duration) : '—'}
                    </span>
                  </div>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Contact</span>
                  <div className="mt-1 flex items-center gap-2">
                    <UserIcon className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm" data-testid={`text-modal-person-${communication.id}`}>
                      {communication.person 
                        ? formatPersonName(communication.person.fullName) 
                        : callDescription 
                          ? callDescription 
                          : '—'}
                    </span>
                  </div>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Phone</span>
                  <div className="mt-1 flex items-center gap-2">
                    <Phone className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm" data-testid={`text-modal-phone-${communication.id}`}>
                      {phoneNumber || '—'}
                    </span>
                  </div>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Direction</span>
                  <div className="mt-1">
                    <Badge variant="secondary" className={direction === 'inbound' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' : 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'}>
                      {direction === 'inbound' ? 'Inbound' : 'Outbound'}
                    </Badge>
                  </div>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Made by</span>
                  <div className="mt-1 flex items-center gap-2">
                    <UserIcon className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm" data-testid={`text-modal-user-${communication.id}`}>
                      {communication.user.firstName} {communication.user.lastName}
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <span className="text-xs text-muted-foreground font-medium block mb-2">Summary</span>
                {(transcriptionStatus === 'pending' || transcriptionStatus === 'requesting') && (
                  <div className="flex items-center gap-2 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg" data-testid="transcript-pending">
                    <Loader2 className="w-4 h-4 animate-spin text-yellow-600" />
                    <span className="text-sm text-yellow-700 dark:text-yellow-300">
                      Waiting for call recording...
                    </span>
                  </div>
                )}
                {transcriptionStatus === 'processing' && (
                  <div className="flex items-center gap-2 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg" data-testid="transcript-processing">
                    <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                    <span className="text-sm text-blue-700 dark:text-blue-300">
                      Transcribing call...
                    </span>
                  </div>
                )}
                {transcriptionStatus === 'not_available' && (
                  <div className="p-4 bg-muted/30 rounded-lg" data-testid="transcript-not-available">
                    <span className="text-sm text-muted-foreground">
                      Call too short for transcription.
                    </span>
                  </div>
                )}
                {transcriptionStatus === 'failed' && (
                  <div className="flex items-center gap-2 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg" data-testid="transcript-failed">
                    <AlertCircle className="w-4 h-4 text-red-600" />
                    <span className="text-sm text-red-700 dark:text-red-300">
                      Transcription failed.
                    </span>
                  </div>
                )}
                {transcriptionStatus === 'completed' && summary && (
                  <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg" data-testid="transcript-summary">
                    <p className="text-sm text-green-800 dark:text-green-200">{summary}</p>
                  </div>
                )}
                {transcriptionStatus === 'completed' && !summary && (
                  <div className="p-4 bg-muted/30 rounded-lg">
                    <span className="text-sm text-muted-foreground">No summary available.</span>
                  </div>
                )}
                {!transcriptionStatus && (
                  <div className="p-4 bg-muted/30 rounded-lg" data-testid="transcript-unknown">
                    <span className="text-sm text-muted-foreground">
                      Transcript status unknown.
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <FileAudio className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground font-medium">Transcript</span>
              </div>
              <ScrollArea className="h-[350px] rounded-lg border p-4 bg-muted/20">
                {transcriptionStatus === 'completed' && transcript ? (
                  <p className="text-sm whitespace-pre-wrap leading-relaxed" data-testid="transcript-content">
                    {transcript}
                  </p>
                ) : transcriptionStatus === 'pending' || transcriptionStatus === 'requesting' || transcriptionStatus === 'processing' ? (
                  <div className="flex flex-col items-center justify-center h-full text-center py-8">
                    <Loader2 className="w-8 h-8 animate-spin text-muted-foreground mb-3" />
                    <span className="text-sm text-muted-foreground">
                      Transcript will appear here once ready...
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-center py-8">
                    <FileAudio className="w-8 h-8 text-muted-foreground/50 mb-3" />
                    <span className="text-sm text-muted-foreground">
                      No transcript available
                    </span>
                  </div>
                )}
              </ScrollArea>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button
              onClick={() => onClose()}
              data-testid="button-close-communication-detail"
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

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
                    className="prose prose-sm dark:prose-invert max-w-none [&_table]:border-collapse [&_table]:w-full [&_td]:border [&_td]:border-gray-300 [&_td]:p-2 [&_th]:border [&_th]:border-gray-300 [&_th]:p-2 [&_th]:bg-gray-100 [&_th]:dark:bg-gray-800 [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded"
                    dangerouslySetInnerHTML={{ 
                      __html: DOMPurify.sanitize(communication.content, {
                        ALLOWED_TAGS: ['br', 'p', 'strong', 'em', 'b', 'i', 'u', 'ul', 'ol', 'li', 'a', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'span', 'div', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'caption', 'img'],
                        ALLOWED_ATTR: ['href', 'style', 'class', 'colspan', 'rowspan', 'border', 'cellpadding', 'cellspacing', 'align', 'valign', 'width', 'src', 'alt', 'title', 'height'],
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
