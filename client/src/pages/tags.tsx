import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Tags, Users, Building2, Edit, Trash2, X } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import TopNavigation from "@/components/top-navigation";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { getQueryFn, apiRequest, queryClient } from "@/lib/queryClient";
import type { ClientTag, PeopleTag, InsertClientTag, InsertPeopleTag } from "@shared/schema";

// Color options for tags
const TAG_COLORS = [
  { label: "Blue", value: "#3b82f6" },
  { label: "Red", value: "#ef4444" },
  { label: "Green", value: "#10b981" },
  { label: "Yellow", value: "#f59e0b" },
  { label: "Purple", value: "#8b5cf6" },
  { label: "Pink", value: "#ec4899" },
  { label: "Indigo", value: "#6366f1" },
  { label: "Gray", value: "#6b7280" },
];

// Form schemas
const clientTagSchema = z.object({
  name: z.string().min(1, "Name is required").max(50, "Name too long"),
  color: z.string().min(1, "Color is required"),
  description: z.string().optional(),
});

const peopleTagSchema = z.object({
  name: z.string().min(1, "Name is required").max(50, "Name too long"),
  color: z.string().min(1, "Color is required"),
  description: z.string().optional(),
});

type ClientTagForm = z.infer<typeof clientTagSchema>;
type PeopleTagForm = z.infer<typeof peopleTagSchema>;

// Tag creation modal component
function CreateTagModal({ 
  type, 
  onSuccess 
}: { 
  type: "client" | "people"; 
  onSuccess: () => void; 
}) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const isClient = type === "client";
  
  const form = useForm<ClientTagForm | PeopleTagForm>({
    resolver: zodResolver(isClient ? clientTagSchema : peopleTagSchema),
    defaultValues: {
      name: "",
      color: "#3b82f6",
      description: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: ClientTagForm | PeopleTagForm) => {
      const endpoint = isClient ? "/api/client-tags" : "/api/people-tags";
      return apiRequest("POST", endpoint, data);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: `${isClient ? 'Client' : 'People'} tag created successfully`,
      });
      queryClient.invalidateQueries({ queryKey: [isClient ? "/api/client-tags" : "/api/people-tags"] });
      onSuccess();
      setOpen(false);
      form.reset();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create tag",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (data: ClientTagForm | PeopleTagForm) => {
    createMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button data-testid={`button-create-${type}-tag`}>
          <Plus className="w-4 h-4 mr-2" />
          Add {isClient ? 'Client' : 'People'} Tag
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create {isClient ? 'Client' : 'People'} Tag</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tag Name</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Enter tag name" data-testid="input-tag-name" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="color"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Color</FormLabel>
                  <FormControl>
                    <div className="grid grid-cols-4 gap-2">
                      {TAG_COLORS.map((color) => (
                        <button
                          key={color.value}
                          type="button"
                          className={`w-12 h-8 rounded border-2 ${
                            field.value === color.value ? 'border-black' : 'border-gray-300'
                          }`}
                          style={{ backgroundColor: color.value }}
                          onClick={() => field.onChange(color.value)}
                          data-testid={`color-${color.label.toLowerCase()}`}
                        />
                      ))}
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (Optional)</FormLabel>
                  <FormControl>
                    <Textarea 
                      {...field} 
                      placeholder="Enter tag description"
                      data-testid="input-tag-description"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end space-x-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                data-testid="button-cancel"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending}
                data-testid="button-save-tag"
              >
                {createMutation.isPending ? "Creating..." : "Create Tag"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// Tag list component
function TagList({ 
  type, 
  tags, 
  onDelete 
}: { 
  type: "client" | "people";
  tags: ClientTag[] | PeopleTag[];
  onDelete: (id: string) => void;
}) {
  const { toast } = useToast();

  const deleteMutation = useMutation({
    mutationFn: async (tagId: string) => {
      const endpoint = type === "client" ? `/api/client-tags/${tagId}` : `/api/people-tags/${tagId}`;
      return apiRequest("DELETE", endpoint);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Tag deleted successfully",
      });
      queryClient.invalidateQueries({ 
        queryKey: [type === "client" ? "/api/client-tags" : "/api/people-tags"] 
      });
    },
    onError: (error) => {
      toast({
        title: "Error", 
        description: error instanceof Error ? error.message : "Failed to delete tag",
        variant: "destructive",
      });
    },
  });

  const handleDelete = (tagId: string) => {
    if (confirm("Are you sure you want to delete this tag?")) {
      deleteMutation.mutate(tagId);
    }
  };

  if (!tags || tags.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">No {type} tags created yet.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {tags.map((tag) => (
        <Card key={tag.id} className="relative">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between mb-2">
              <Badge 
                style={{ backgroundColor: tag.color }}
                className="text-white"
                data-testid={`tag-${tag.name}`}
              >
                {tag.name}
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDelete(tag.id)}
                className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                data-testid={`button-delete-${tag.id}`}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
            {tag.description && (
              <p className="text-sm text-muted-foreground">{tag.description}</p>
            )}
            <p className="text-xs text-muted-foreground mt-2">
              Created {tag.createdAt ? new Date(tag.createdAt).toLocaleDateString() : 'N/A'}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function TagsPage() {
  const { user } = useAuth();
  
  const { data: clientTags = [], isLoading: clientTagsLoading } = useQuery<ClientTag[]>({
    queryKey: ["/api/client-tags"],
  });

  const { data: peopleTags = [], isLoading: peopleTagsLoading } = useQuery<PeopleTag[]>({
    queryKey: ["/api/people-tags"],
  });

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">Please log in to access tag management.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <TopNavigation user={user} />
      
      {/* Header */}
      <div className="border-b border-border bg-card">
        <div className="page-container py-6 md:py-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight flex items-center gap-2">
              <Tags className="w-6 h-6 md:w-7 md:h-7" />
              Tag Management
            </h1>
            <p className="text-meta mt-1">
              Create and manage tags for organizing clients and people
            </p>
          </div>
        </div>
      </div>

      <div className="page-container py-6 md:py-8 space-y-8">

        <Tabs defaultValue="client-tags" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="client-tags" data-testid="tab-client-tags">
              <Building2 className="w-4 h-4 mr-2" />
              Client Tags
            </TabsTrigger>
            <TabsTrigger value="people-tags" data-testid="tab-people-tags">
              <Users className="w-4 h-4 mr-2" />
              People Tags
            </TabsTrigger>
          </TabsList>

          <TabsContent value="client-tags" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="w-5 h-5" />
                    Client Tags
                  </CardTitle>
                  <CreateTagModal 
                    type="client" 
                    onSuccess={() => {}} 
                  />
                </div>
              </CardHeader>
              <CardContent>
                {clientTagsLoading ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">Loading client tags...</p>
                  </div>
                ) : (
                  <TagList 
                    type="client" 
                    tags={clientTags} 
                    onDelete={() => {}} 
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="people-tags" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    People Tags
                  </CardTitle>
                  <CreateTagModal 
                    type="people" 
                    onSuccess={() => {}} 
                  />
                </div>
              </CardHeader>
              <CardContent>
                {peopleTagsLoading ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">Loading people tags...</p>
                  </div>
                ) : (
                  <TagList 
                    type="people" 
                    tags={peopleTags} 
                    onDelete={() => {}} 
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}