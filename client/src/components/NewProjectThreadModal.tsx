import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { X, Check } from 'lucide-react';
import { apiRequest, queryClient } from '@/lib/queryClient';

interface User {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
}

interface Project {
  id: string;
  clientId: string;
  currentAssigneeId: string | null;
  clientManagerId: string | null;
  bookkeeperId: string | null;
}

interface NewProjectThreadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: Project;
}

export default function NewProjectThreadModal({
  open,
  onOpenChange,
  project,
}: NewProjectThreadModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [topic, setTopic] = useState('');
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [initialMessage, setInitialMessage] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);

  // Fetch all users for participant selection
  const { data: allUsers } = useQuery<User[]>({
    queryKey: ['/api/users/for-messaging'],
    enabled: open,
  });

  // Fetch project-assigned staff for prioritization
  const projectStaffIds = new Set([
    project.currentAssigneeId,
    project.clientManagerId,
    project.bookkeeperId,
    user?.id,
  ].filter(Boolean));

  // Create thread mutation
  const createThreadMutation = useMutation({
    mutationFn: async (data: { topic: string; participantUserIds: string[]; initialMessage: string }) => {
      return await apiRequest('POST', '/api/internal/project-messages/threads', {
        projectId: project.id,
        topic: data.topic,
        participantUserIds: data.participantUserIds,
        initialMessage: data.initialMessage ? { content: data.initialMessage } : null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/internal/project-messages/threads', project.id] });
      toast({
        title: "Thread created",
        description: "The conversation thread has been created with your message.",
      });
      handleClose();
    },
    onError: (error: any) => {
      toast({
        title: "Failed to create thread",
        description: error.message || "An error occurred",
        variant: "destructive",
      });
    },
  });

  const handleClose = () => {
    setTopic('');
    setSelectedParticipants([]);
    setSearchTerm('');
    setInitialMessage('');
    setShowSearchResults(false);
    onOpenChange(false);
  };

  const handleCreate = () => {
    if (!topic.trim()) {
      toast({
        title: "Topic required",
        description: "Please enter a topic for the thread",
        variant: "destructive",
      });
      return;
    }

    if (selectedParticipants.length === 0) {
      toast({
        title: "Participants required",
        description: "Please select at least one participant",
        variant: "destructive",
      });
      return;
    }

    if (!initialMessage.trim()) {
      toast({
        title: "Message required",
        description: "Please enter an initial message for the thread",
        variant: "destructive",
      });
      return;
    }

    createThreadMutation.mutate({
      topic: topic.trim(),
      participantUserIds: selectedParticipants,
      initialMessage: initialMessage.trim(),
    });
  };

  const getUserDisplayName = (user: User) => {
    if (user.firstName && user.lastName) {
      return `${user.firstName} ${user.lastName}`;
    }
    return user.email;
  };

  const toggleParticipant = (userId: string) => {
    setSelectedParticipants(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const filteredUsers = allUsers?.filter(u =>
    getUserDisplayName(u).toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  // Sort users: project-assigned staff first, then alphabetically
  const sortedUsers = [...filteredUsers].sort((a, b) => {
    const aIsProjectStaff = projectStaffIds.has(a.id);
    const bIsProjectStaff = projectStaffIds.has(b.id);
    
    if (aIsProjectStaff && !bIsProjectStaff) return -1;
    if (!aIsProjectStaff && bIsProjectStaff) return 1;
    
    return getUserDisplayName(a).localeCompare(getUserDisplayName(b));
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl" data-testid="dialog-new-thread">
        <DialogHeader>
          <DialogTitle>New Conversation Thread</DialogTitle>
          <DialogDescription>
            Create a new conversation thread for this project. Add staff members and send your first message.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Topic Input */}
          <div className="space-y-2">
            <Label htmlFor="topic">Topic</Label>
            <Input
              id="topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Enter thread topic..."
              data-testid="input-topic"
            />
          </div>

          {/* Participant Selection */}
          <div className="space-y-2">
            <Label>Participants</Label>
            
            {/* Search Input */}
            <div className="relative">
              <Input
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setShowSearchResults(e.target.value.length > 0);
                }}
                onFocus={() => setShowSearchResults(searchTerm.length > 0)}
                placeholder="Search and select staff members..."
                data-testid="input-search-participants"
              />
              
              {/* Search Results Dropdown */}
              {showSearchResults && searchTerm.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-background border rounded-md shadow-lg max-h-[200px] overflow-y-auto">
                  {sortedUsers.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No staff members found
                    </p>
                  ) : (
                    <div className="p-1">
                      {sortedUsers.map(staffUser => {
                        const isProjectStaff = projectStaffIds.has(staffUser.id);
                        const isSelected = selectedParticipants.includes(staffUser.id);
                        
                        return (
                          <div
                            key={staffUser.id}
                            className="flex items-center space-x-2 p-2 hover:bg-muted rounded-md cursor-pointer"
                            onClick={() => {
                              toggleParticipant(staffUser.id);
                              setSearchTerm('');
                              setShowSearchResults(false);
                            }}
                            data-testid={`user-item-${staffUser.id}`}
                          >
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium">
                                  {getUserDisplayName(staffUser)}
                                </span>
                                {isProjectStaff && (
                                  <Badge variant="outline" className="text-xs">
                                    Project Staff
                                  </Badge>
                                )}
                                {isSelected && (
                                  <Check className="w-4 h-4 text-primary" />
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground">{staffUser.email}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Selected Participants */}
            {selectedParticipants.length > 0 && (
              <div className="flex flex-wrap gap-2 p-2 bg-muted/50 rounded-md min-h-[40px]">
                {selectedParticipants.map(userId => {
                  const participant = allUsers?.find(u => u.id === userId);
                  if (!participant) return null;
                  
                  return (
                    <Badge
                      key={userId}
                      variant="secondary"
                      className="flex items-center gap-1"
                      data-testid={`selected-participant-${userId}`}
                    >
                      <span>{getUserDisplayName(participant)}</span>
                      <button
                        onClick={() => toggleParticipant(userId)}
                        className="hover:bg-muted-foreground/20 rounded-full p-0.5"
                        data-testid={`remove-participant-${userId}`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  );
                })}
              </div>
            )}
          </div>

          {/* Initial Message */}
          <div className="space-y-2">
            <Label htmlFor="message">Initial Message</Label>
            <Textarea
              id="message"
              value={initialMessage}
              onChange={(e) => setInitialMessage(e.target.value)}
              placeholder="Type your first message..."
              className="min-h-[100px]"
              data-testid="input-initial-message"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            data-testid="button-cancel"
          >
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={createThreadMutation.isPending || !topic.trim() || selectedParticipants.length === 0 || !initialMessage.trim()}
            data-testid="button-create"
          >
            {createThreadMutation.isPending ? 'Creating...' : 'Create Thread'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
