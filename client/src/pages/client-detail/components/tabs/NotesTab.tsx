import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { StickyNote, Plus, Eye, Paperclip } from "lucide-react";
import { format } from "date-fns";
import { AddNoteDialog } from "../modals/AddNoteDialog";
import { ViewNoteModal } from "../modals/ViewNoteModal";
import type { ClientNote } from "@shared/schema";

interface ClientNoteWithRelations extends ClientNote {
  createdByUser?: {
    id: string;
    firstName: string | null;
    lastName: string | null;
  } | null;
  project?: {
    id: string;
    description: string | null;
    projectTypeId: string;
    projectTypeName: string | null;
  } | null;
}

interface NotesTabProps {
  clientId: string;
  projectId?: string;
  projectTypeId?: string;
  mode?: 'client' | 'project';
}

export function NotesTab({ clientId, projectId, projectTypeId: propProjectTypeId, mode = 'client' }: NotesTabProps) {
  // In project mode, default to "this-project" filter; in client mode, default to "all"
  const [filter, setFilter] = useState<string>(mode === 'project' && projectId ? 'this-project' : 'all');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [viewingNote, setViewingNote] = useState<ClientNoteWithRelations | null>(null);

  // Always fetch all notes for the client - filter on frontend for better UX
  const { data: allNotes = [], isLoading } = useQuery<ClientNoteWithRelations[]>({
    queryKey: ['/api/clients', clientId, 'notes'],
    queryFn: async () => {
      const res = await fetch(`/api/clients/${clientId}/notes`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch notes');
      return res.json();
    },
  });

  // Extract unique project types from notes for the filter dropdown
  const projectTypes = useMemo(() => {
    const typeMap = new Map<string, string>();
    allNotes.forEach(note => {
      if (note.project?.projectTypeId && note.project?.projectTypeName) {
        typeMap.set(note.project.projectTypeId, note.project.projectTypeName);
      }
    });
    return Array.from(typeMap.entries()).map(([id, name]) => ({ id, name }));
  }, [allNotes]);

  // Get the current project's type name for display
  const currentProjectTypeName = useMemo(() => {
    if (mode !== 'project' || !projectId) return null;
    if (propProjectTypeId) {
      const pt = projectTypes.find(p => p.id === propProjectTypeId);
      return pt?.name || null;
    }
    const projectNote = allNotes.find(n => n.projectId === projectId);
    return projectNote?.project?.projectTypeName || null;
  }, [allNotes, mode, projectId, propProjectTypeId, projectTypes]);

  // Reset filter to "this-project" when projectId changes (navigating to different project)
  useEffect(() => {
    if (mode === 'project' && projectId) {
      setFilter('this-project');
    }
  }, [mode, projectId]);

  // Filter notes based on selected filter
  const filteredNotes = useMemo(() => {
    if (filter === 'all') return allNotes;
    if (filter === 'client-only') return allNotes.filter(n => !n.projectId);
    if (filter === 'this-project' && projectId) {
      // Show notes for this specific project + client-level notes
      return allNotes.filter(n => n.projectId === projectId || !n.projectId);
    }
    // Filter by project type ID
    return allNotes.filter(n => n.project?.projectTypeId === filter);
  }, [allNotes, filter, projectId]);

  const formatUserName = (user: ClientNoteWithRelations['createdByUser']) => {
    if (!user) return 'Unknown';
    const parts = [user.firstName, user.lastName].filter(Boolean);
    return parts.length > 0 ? parts.join(' ') : 'Unknown';
  };

  const formatDate = (date: Date | string | null | undefined) => {
    if (!date) return '-';
    return format(new Date(date), 'd MMM yyyy');
  };

  const getAttachmentCount = (attachments: any): number => {
    if (!attachments) return 0;
    if (Array.isArray(attachments)) return attachments.length;
    return 0;
  };

  const stripHtml = (html: string): string => {
    const div = document.createElement('div');
    div.innerHTML = html;
    return div.textContent || div.innerText || '';
  };

  // Show filter when there are notes with project associations or in project mode
  const showFilter = mode === 'project' || projectTypes.length > 0 || allNotes.some(n => n.projectId);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <StickyNote className="w-5 h-5" />
            Notes
          </CardTitle>
          <div className="flex items-center gap-3">
            {showFilter && (
              <Select value={filter} onValueChange={setFilter}>
                <SelectTrigger className="w-[180px]" data-testid="select-notes-filter">
                  <SelectValue placeholder="Filter notes" />
                </SelectTrigger>
                <SelectContent>
                  {mode === 'project' && projectId && (
                    <SelectItem value="this-project">
                      This Project{currentProjectTypeName ? ` (${currentProjectTypeName})` : ''}
                    </SelectItem>
                  )}
                  <SelectItem value="all">All Notes</SelectItem>
                  <SelectItem value="client-only">Client Only</SelectItem>
                  {projectTypes.map((pt) => (
                    <SelectItem key={pt.id} value={pt.id}>
                      {pt.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button
              onClick={() => setIsAddDialogOpen(true)}
              size="sm"
              data-testid="button-add-note"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Note
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : filteredNotes.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <StickyNote className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>No notes yet</p>
            <p className="text-sm mt-1">
              Add notes to track important information about this {mode === 'project' ? 'project' : 'client'}
            </p>
          </div>
        ) : (
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[200px]">Title</TableHead>
                  <TableHead>Preview</TableHead>
                  <TableHead className="w-[140px]">Related To</TableHead>
                  <TableHead className="w-[100px]">Created</TableHead>
                  <TableHead className="w-[120px]">By</TableHead>
                  <TableHead className="text-right w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredNotes.map((note) => (
                  <TableRow key={note.id} data-testid={`row-note-${note.id}`}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <span data-testid={`text-title-${note.id}`} className="line-clamp-1">
                          {note.title}
                        </span>
                        {getAttachmentCount(note.attachments) > 0 && (
                          <Badge variant="secondary" className="text-xs flex items-center gap-1 shrink-0">
                            <Paperclip className="h-3 w-3" />
                            {getAttachmentCount(note.attachments)}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground line-clamp-1">
                        {stripHtml(note.content).substring(0, 100)}
                        {stripHtml(note.content).length > 100 && '...'}
                      </span>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {note.project?.projectTypeName ? (
                        <Badge variant="outline" className="text-xs">
                          {note.project.projectTypeName}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">Client</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm whitespace-nowrap">
                      {formatDate(note.createdAt)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatUserName(note.createdByUser)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => setViewingNote(note)}
                        data-testid={`button-view-note-${note.id}`}
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <AddNoteDialog
        clientId={clientId}
        projectId={mode === 'project' ? projectId : undefined}
        isOpen={isAddDialogOpen}
        onClose={() => setIsAddDialogOpen(false)}
        mode={mode}
      />

      <ViewNoteModal
        note={viewingNote}
        isOpen={!!viewingNote}
        onClose={() => setViewingNote(null)}
        clientId={clientId}
      />
    </Card>
  );
}
