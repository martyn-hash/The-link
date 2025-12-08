import DOMPurify from "dompurify";
import { Clock, UserIcon, FileAudio, Loader2, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
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
  const [showFullTranscript, setShowFullTranscript] = useState(false);
  
  if (!communication) return null;

  const metadata = communication.metadata as Record<string, any> | null;
  const isPhoneCall = communication.type === 'phone_call';
  const transcriptionStatus = metadata?.transcriptionStatus;
  const transcript = metadata?.transcript;
  const summary = metadata?.summary;

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
                    className="prose prose-sm dark:prose-invert max-w-none [&_table]:border-collapse [&_table]:w-full [&_td]:border [&_td]:border-gray-300 [&_td]:p-2 [&_th]:border [&_th]:border-gray-300 [&_th]:p-2 [&_th]:bg-gray-100 [&_th]:dark:bg-gray-800"
                    dangerouslySetInnerHTML={{ 
                      __html: DOMPurify.sanitize(communication.content, {
                        ALLOWED_TAGS: ['br', 'p', 'strong', 'em', 'b', 'i', 'u', 'ul', 'ol', 'li', 'a', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'span', 'div', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'caption'],
                        ALLOWED_ATTR: ['href', 'style', 'class', 'colspan', 'rowspan', 'border', 'cellpadding', 'cellspacing', 'align', 'valign', 'width'],
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

          {isPhoneCall && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <FileAudio className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground font-medium">Call Transcript</span>
              </div>

              {(transcriptionStatus === 'pending' || transcriptionStatus === 'requesting') && (
                <div className="flex items-center gap-2 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg" data-testid="transcript-pending">
                  <Loader2 className="w-4 h-4 animate-spin text-yellow-600" />
                  <span className="text-sm text-yellow-700 dark:text-yellow-300">
                    Waiting for call recording to be processed...
                  </span>
                </div>
              )}

              {transcriptionStatus === 'processing' && (
                <div className="flex items-center gap-2 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg" data-testid="transcript-processing">
                  <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                  <span className="text-sm text-blue-700 dark:text-blue-300">
                    Transcribing call... This may take a few minutes.
                  </span>
                </div>
              )}

              {transcriptionStatus === 'not_available' && (
                <div className="p-4 bg-muted/30 rounded-lg" data-testid="transcript-not-available">
                  <span className="text-sm text-muted-foreground">
                    No transcript available for this call (call too short for transcription).
                  </span>
                </div>
              )}

              {transcriptionStatus === 'failed' && (
                <div className="flex items-center gap-2 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg" data-testid="transcript-failed">
                  <AlertCircle className="w-4 h-4 text-red-600" />
                  <span className="text-sm text-red-700 dark:text-red-300">
                    Transcription failed. {metadata?.transcriptionError || 'Please try again later.'}
                  </span>
                </div>
              )}

              {transcriptionStatus === 'completed' && (
                <div className="space-y-3">
                  {summary && (
                    <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg" data-testid="transcript-summary">
                      <span className="text-xs text-green-700 dark:text-green-300 font-medium block mb-2">Summary</span>
                      <p className="text-sm text-green-800 dark:text-green-200">{summary}</p>
                    </div>
                  )}

                  {transcript && (
                    <div className="p-4 bg-muted/30 rounded-lg" data-testid="transcript-full">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-muted-foreground font-medium">Full Transcript</span>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => setShowFullTranscript(!showFullTranscript)}
                          data-testid="toggle-transcript"
                        >
                          {showFullTranscript ? (
                            <>Hide <ChevronUp className="w-4 h-4 ml-1" /></>
                          ) : (
                            <>Show <ChevronDown className="w-4 h-4 ml-1" /></>
                          )}
                        </Button>
                      </div>
                      {showFullTranscript && (
                        <p className="text-sm whitespace-pre-wrap text-muted-foreground" data-testid="transcript-content">
                          {transcript}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {!transcriptionStatus && transcriptionStatus !== 'not_available' && (
                <div className="p-4 bg-muted/30 rounded-lg" data-testid="transcript-unknown">
                  <span className="text-sm text-muted-foreground">
                    Transcript status unknown.
                  </span>
                </div>
              )}
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
