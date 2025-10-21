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
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { X, User as UserIcon } from 'lucide-react';
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

  // Fetch all users for participant selection
  const { data: allUsers } = useQuery<User[]>({
    queryKey: ['/api/users'],
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
    mutationFn: async (data: { topic: string; participantUserIds: string[] }) => {
      return await apiRequest('POST', '/api/internal/project-messages/threads', {
        projectId: project.id,
        topic: data.topic,
        participantUserIds: data.participantUserIds,
        initialMessage: null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/internal/project-messages/threads', project.id] });
      toast({
        title: "Thread created",
        description: "The conversation thread has been created successfully.",
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

    createThreadMutation.mutate({
      topic: topic.trim(),
      participantUserIds: selectedParticipants,
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
            Create a new conversation thread for this project. Select staff members to invite.
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
            
            {/* Selected Participants */}
            {selectedParticipants.length > 0 && (
              <div className="flex flex-wrap gap-2 p-3 bg-muted rounded-md">
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

            {/* Search Input */}
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search staff members..."
              data-testid="input-search-participants"
            />

            {/* User List */}
            <ScrollArea className="h-[300px] border rounded-md">
              <div className="p-4 space-y-2">
                {sortedUsers.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No staff members found
                  </p>
                ) : (
                  sortedUsers.map(staffUser => {
                    const isProjectStaff = projectStaffIds.has(staffUser.id);
                    const isSelected = selectedParticipants.includes(staffUser.id);
                    
                    return (
                      <div
                        key={staffUser.id}
                        className="flex items-center space-x-2 p-2 hover:bg-muted rounded-md"
                        data-testid={`user-item-${staffUser.id}`}
                      >
                        <Checkbox
                          id={`user-${staffUser.id}`}
                          checked={isSelected}
                          onCheckedChange={() => toggleParticipant(staffUser.id)}
                          data-testid={`checkbox-participant-${staffUser.id}`}
                        />
                        <label
                          htmlFor={`user-${staffUser.id}`}
                          className="flex-1 cursor-pointer flex items-center gap-2"
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
                            </div>
                            <p className="text-xs text-muted-foreground">{staffUser.email}</p>
                          </div>
                        </label>
                      </div>
                    );
                  })
                )}
              </div>
            </ScrollArea>
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
            disabled={createThreadMutation.isPending || !topic.trim() || selectedParticipants.length === 0}
            data-testid="button-create"
          >
            {createThreadMutation.isPending ? 'Creating...' : 'Create Thread'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
