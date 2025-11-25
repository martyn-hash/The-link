import { Button } from "@/components/ui/button";
import { PhoneCall, Send, Mail, MessageSquare, FileText } from "lucide-react";
import type { CommunicationFiltersProps, CommunicationFilterType, TimelineItem } from "./types";

function getFilterCount(items: TimelineItem[], type: CommunicationFilterType): number {
  if (type === 'all') return items.length;
  if (type === 'sms') return items.filter(i => i.type === 'sms_sent' || i.type === 'sms_received').length;
  if (type === 'email') return items.filter(i => i.type === 'email_sent' || i.type === 'email_received').length;
  return items.filter(i => i.type === type).length;
}

export function CommunicationFilters({ filter, onFilterChange, items }: CommunicationFiltersProps) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-2 -mx-2 px-2" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
      <Button
        variant={filter === 'all' ? 'default' : 'outline'}
        size="sm"
        onClick={() => onFilterChange('all')}
        data-testid="button-filter-all"
        className="flex-shrink-0"
      >
        All ({getFilterCount(items, 'all')})
      </Button>
      <Button
        variant={filter === 'phone_call' ? 'default' : 'outline'}
        size="sm"
        onClick={() => onFilterChange('phone_call')}
        data-testid="button-filter-phone-call"
        className="flex-shrink-0"
      >
        <PhoneCall className="h-3 w-3 mr-1" />
        Calls ({getFilterCount(items, 'phone_call')})
      </Button>
      <Button
        variant={filter === 'sms' ? 'default' : 'outline'}
        size="sm"
        onClick={() => onFilterChange('sms')}
        data-testid="button-filter-sms"
        className="flex-shrink-0"
      >
        <Send className="h-3 w-3 mr-1" />
        SMS ({getFilterCount(items, 'sms')})
      </Button>
      <Button
        variant={filter === 'email' ? 'default' : 'outline'}
        size="sm"
        onClick={() => onFilterChange('email')}
        data-testid="button-filter-email"
        className="flex-shrink-0"
      >
        <Mail className="h-3 w-3 mr-1" />
        Emails ({getFilterCount(items, 'email')})
      </Button>
      <Button
        variant={filter === 'message_thread' ? 'default' : 'outline'}
        size="sm"
        onClick={() => onFilterChange('message_thread')}
        data-testid="button-filter-message-thread"
        className="flex-shrink-0"
      >
        <MessageSquare className="h-3 w-3 mr-1" />
        Messages ({getFilterCount(items, 'message_thread')})
      </Button>
      <Button
        variant={filter === 'note' ? 'default' : 'outline'}
        size="sm"
        onClick={() => onFilterChange('note')}
        data-testid="button-filter-note"
        className="flex-shrink-0"
      >
        <FileText className="h-3 w-3 mr-1" />
        Notes ({getFilterCount(items, 'note')})
      </Button>
      <Button
        variant={filter === 'email_thread' ? 'default' : 'outline'}
        size="sm"
        onClick={() => onFilterChange('email_thread')}
        data-testid="button-filter-email-thread"
        className="flex-shrink-0"
      >
        <Mail className="h-3 w-3 mr-1" />
        Email Threads ({getFilterCount(items, 'email_thread')})
      </Button>
    </div>
  );
}
