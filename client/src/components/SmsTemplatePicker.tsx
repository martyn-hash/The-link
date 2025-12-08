import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText, Loader2, MessageSquare, AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface SmsTemplate {
  id: string;
  name: string;
  content: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface SmsTemplatePickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (content: string, templateId: string) => void;
  recipientFirstName?: string;
}

export function SmsTemplatePicker({
  isOpen,
  onClose,
  onSelect,
  recipientFirstName,
}: SmsTemplatePickerProps) {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);

  const { data: templates, isLoading } = useQuery<SmsTemplate[]>({
    queryKey: ["/api/sms/templates"],
    enabled: isOpen,
  });

  const availableTemplates = templates || [];

  const getPreviewContent = (content: string): string => {
    if (recipientFirstName) {
      return content.replace(/\{firstName\}/g, recipientFirstName);
    }
    return content.replace(/\{firstName\}/g, "[First Name]");
  };

  const hasVariables = (content: string): boolean => {
    return /\{firstName\}/.test(content);
  };

  const handleSelect = (template: SmsTemplate) => {
    onSelect(template.content, template.id);
    onClose();
    setSelectedTemplateId(null);
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onClose();
      setSelectedTemplateId(null);
    }
  };

  const selectedTemplate = availableTemplates.find(t => t.id === selectedTemplateId);
  const selectedHasVariables = selectedTemplate && hasVariables(selectedTemplate.content) && !recipientFirstName;

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh]" data-testid="dialog-template-picker">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Select SMS Template
          </DialogTitle>
          <DialogDescription>
            Choose a template to insert into your message.
            {recipientFirstName ? (
              <span className="block mt-1 text-primary">
                Variables will be replaced with "{recipientFirstName}"
              </span>
            ) : (
              <span className="block mt-1 text-muted-foreground">
                Select a recipient first to auto-fill name variables
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : availableTemplates.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-20" />
            <p>No SMS templates available.</p>
            <p className="text-sm mt-1">Ask an admin to create some templates.</p>
          </div>
        ) : (
          <ScrollArea className="max-h-[400px] pr-4">
            <div className="space-y-3">
              {availableTemplates.map((template) => (
                <Card
                  key={template.id}
                  className={`cursor-pointer transition-colors hover:border-primary ${
                    selectedTemplateId === template.id ? "border-primary bg-primary/5" : ""
                  }`}
                  onClick={() => setSelectedTemplateId(template.id)}
                  data-testid={`template-card-${template.id}`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-sm">{template.name}</h4>
                        <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">
                          {getPreviewContent(template.content)}
                        </p>
                        <p className="text-xs text-muted-foreground mt-2">
                          {template.content.length} characters
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        )}

        {selectedHasVariables && (
          <Alert variant="default" className="mt-2">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              This template uses name personalization. Select a recipient first, or the name will be automatically filled when you select a recipient later.
            </AlertDescription>
          </Alert>
        )}

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => selectedTemplate && handleSelect(selectedTemplate)}
            disabled={!selectedTemplate}
            data-testid="button-use-template"
          >
            Use Template
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
