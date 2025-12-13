import { PhoneCall, FileText, Send, Inbox, Mail, MessageSquare } from "lucide-react";

export function getIcon(type: string) {
  switch (type) {
    case 'phone_call':
      return <PhoneCall className="h-4 w-4" />;
    case 'note':
      return <FileText className="h-4 w-4" />;
    case 'sms_sent':
      return <Send className="h-4 w-4" />;
    case 'sms_received':
      return <Inbox className="h-4 w-4" />;
    case 'email_sent':
      return <Mail className="h-4 w-4" />;
    case 'email_received':
      return <Inbox className="h-4 w-4" />;
    case 'message_thread':
      return <MessageSquare className="h-4 w-4" />;
    case 'email_thread':
      return <Mail className="h-4 w-4" />;
    case 'email':
      return <Mail className="h-4 w-4" />;
    default:
      return <MessageSquare className="h-4 w-4" />;
  }
}

export function getTypeLabel(type: string): string {
  switch (type) {
    case 'phone_call':
      return 'Phone Call';
    case 'note':
      return 'Note';
    case 'sms_sent':
      return 'SMS Sent';
    case 'sms_received':
      return 'SMS Received';
    case 'email_sent':
      return 'Email Sent';
    case 'email_received':
      return 'Email Received';
    case 'message_thread':
      return 'Instant Message';
    case 'email_thread':
      return 'Email Thread';
    case 'email':
      return 'Email';
    default:
      return 'Communication';
  }
}

export function getTypeColor(type: string): string {
  switch (type) {
    case 'phone_call':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
    case 'note':
      return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
    case 'sms_sent':
      return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    case 'sms_received':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
    case 'email_sent':
      return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
    case 'email_received':
      return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200';
    case 'message_thread':
      return 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200';
    case 'email_thread':
      return 'bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200';
    case 'email':
      return 'bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200';
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
  }
}
