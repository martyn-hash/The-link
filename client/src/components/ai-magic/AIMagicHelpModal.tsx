import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, Eye, Compass } from 'lucide-react';
import { AI_COMMAND_CATEGORIES } from './types';

interface AIMagicHelpModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const iconMap: Record<string, typeof Plus> = {
  plus: Plus,
  eye: Eye,
  compass: Compass,
};

export function AIMagicHelpModal({ open, onOpenChange }: AIMagicHelpModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]" data-testid="modal-ai-help">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            What can I help you with?
          </DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="max-h-[60vh]">
          <div className="space-y-6 pr-4">
            {AI_COMMAND_CATEGORIES.map((category) => {
              const Icon = iconMap[category.icon] || Plus;
              return (
                <div key={category.title}>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Icon className="w-4 h-4 text-primary" />
                    </div>
                    <h3 className="font-semibold">{category.title}</h3>
                  </div>
                  <div className="space-y-2 ml-10">
                    {category.commands.map((command, idx) => (
                      <div 
                        key={idx}
                        className="p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                      >
                        <p className="text-sm font-medium text-foreground">
                          "{command.phrase}"
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {command.description}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

            <div className="pt-4 border-t">
              <h4 className="font-medium text-sm mb-2">Tips</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Say "my" to refer to yourself (e.g., "show me my tasks")</li>
                <li>• Use natural dates like "tomorrow" or "next Wednesday"</li>
                <li>• Say "them" or "their" to refer to the last mentioned person/client</li>
                <li>• Use the microphone button for voice input</li>
              </ul>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
