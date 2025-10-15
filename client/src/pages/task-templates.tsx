import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Edit, Trash2, Copy, Eye, CheckCircle, XCircle, ClipboardList, Settings } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import TopNavigation from "@/components/top-navigation";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { getQueryFn, apiRequest, queryClient } from "@/lib/queryClient";
import type { TaskTemplate, TaskTemplateCategory } from "@shared/schema";

interface TemplateWithDetails extends TaskTemplate {
  category?: TaskTemplateCategory;
  questionCount: number;
}

const templateFormSchema = z.object({
  name: z.string().min(1, "Template name is required").max(200, "Name is too long"),
  description: z.string().optional(),
  categoryId: z.string().optional(),
  status: z.enum(["draft", "active"]),
});

type TemplateFormData = z.infer<typeof templateFormSchema>;

function TemplateCard({ template }: { template: TemplateWithDetails }) {
  const { toast } = useToast();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const deleteMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("DELETE", `/api/task-templates/${template.id}`);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Template deleted successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/task-templates"] });
      setDeleteDialogOpen(false);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete template",
        variant: "destructive",
      });
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async () => {
      const newStatus = template.status === "active" ? "draft" : "active";
      return apiRequest("PATCH", `/api/task-templates/${template.id}`, { status: newStatus });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: `Template ${template.status === "active" ? "deactivated" : "activated"} successfully`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/task-templates"] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update template",
        variant: "destructive",
      });
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: async () => {
      // Create a duplicate template
      return apiRequest("POST", "/api/task-templates", {
        name: `${template.name} (Copy)`,
        description: template.description,
        categoryId: template.categoryId,
        status: "draft",
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Template duplicated successfully. You can now edit the copy.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/task-templates"] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to duplicate template",
        variant: "destructive",
      });
    },
  });

  return (
    <>
      <Card className="hover:shadow-md transition" data-testid={`card-template-${template.id}`}>
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center space-x-2 mb-2">
                <h3 className="text-lg font-semibold" data-testid={`text-template-name-${template.id}`}>
                  {template.name}
                </h3>
                <Badge
                  variant={template.status === "active" ? "default" : "secondary"}
                  data-testid={`badge-template-status-${template.id}`}
                >
                  {template.status}
                </Badge>
              </div>
              {template.description && (
                <p className="text-sm text-muted-foreground mb-3" data-testid={`text-template-description-${template.id}`}>
                  {template.description}
                </p>
              )}
              <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                {template.category && (
                  <span data-testid={`text-template-category-${template.id}`}>
                    Category: {template.category.name}
                  </span>
                )}
                <span data-testid={`text-template-question-count-${template.id}`}>
                  {template.questionCount} {template.questionCount === 1 ? 'question' : 'questions'}
                </span>
              </div>
            </div>
            <div className="flex items-center space-x-1 ml-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => toggleStatusMutation.mutate()}
                disabled={toggleStatusMutation.isPending}
                data-testid={`button-toggle-status-${template.id}`}
                title={template.status === "active" ? "Deactivate" : "Activate"}
              >
                {template.status === "active" ? (
                  <XCircle className="w-4 h-4 text-orange-500" />
                ) : (
                  <CheckCircle className="w-4 h-4 text-green-500" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => duplicateMutation.mutate()}
                disabled={duplicateMutation.isPending}
                data-testid={`button-duplicate-${template.id}`}
                title="Duplicate"
              >
                <Copy className="w-4 h-4" />
              </Button>
              <Link href={`/task-templates/${template.id}/edit`}>
                <Button variant="ghost" size="sm" data-testid={`button-edit-${template.id}`} title="Edit">
                  <Edit className="w-4 h-4" />
                </Button>
              </Link>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setDeleteDialogOpen(true)}
                data-testid={`button-delete-${template.id}`}
                title="Delete"
              >
                <Trash2 className="w-4 h-4 text-red-500" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Template</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete "{template.name}"? This will also delete all sections and questions. This cannot be undone.
          </p>
          <div className="flex justify-end space-x-2 mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              data-testid="button-cancel-delete"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function TaskTemplatesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const { data: templates, isLoading: templatesLoading } = useQuery<TaskTemplate[]>({
    queryKey: ["/api/task-templates"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  const { data: categories } = useQuery<TaskTemplateCategory[]>({
    queryKey: ["/api/task-template-categories"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  const form = useForm<TemplateFormData>({
    resolver: zodResolver(templateFormSchema),
    defaultValues: {
      name: "",
      description: "",
      categoryId: "",
      status: "draft",
    },
  });

  // Get question counts for all templates
  const templateIds = templates?.map(t => t.id) || [];
  const questionCountQueries = useQuery({
    queryKey: ["/api/task-templates", "questions", templateIds],
    queryFn: async () => {
      if (templateIds.length === 0) return {};
      const counts: Record<string, number> = {};
      await Promise.all(
        templateIds.map(async (id) => {
          try {
            const response = await fetch(`/api/task-templates/${id}/questions`);
            if (response.ok) {
              const questions = await response.json();
              counts[id] = questions.length;
            } else {
              counts[id] = 0;
            }
          } catch {
            counts[id] = 0;
          }
        })
      );
      return counts;
    },
    enabled: templateIds.length > 0,
  });

  const createMutation = useMutation({
    mutationFn: async (data: TemplateFormData) => {
      return apiRequest("POST", "/api/task-templates", {
        name: data.name,
        description: data.description || "",
        categoryId: data.categoryId || undefined,
        status: data.status,
      });
    },
    onSuccess: async (data: any) => {
      toast({
        title: "Success",
        description: "Template created successfully",
      });
      await queryClient.invalidateQueries({ queryKey: ["/api/task-templates"] });
      setShowCreateDialog(false);
      form.reset();
      navigate(`/task-templates/${data.id}/edit`);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create template",
        variant: "destructive",
      });
    },
  });

  const handleCreateTemplate = (data: TemplateFormData) => {
    createMutation.mutate(data);
  };

  if (!user?.isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card>
          <CardContent className="p-6">
            <p className="text-muted-foreground">Access denied. Admin privileges required.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Group templates by category
  const templatesWithDetails: TemplateWithDetails[] = (templates || []).map(template => ({
    ...template,
    category: categories?.find(c => c.id === template.categoryId),
    questionCount: questionCountQueries.data?.[template.id] || 0,
  }));

  const templatesByCategory: Record<string, TemplateWithDetails[]> = {};
  const uncategorized: TemplateWithDetails[] = [];

  templatesWithDetails.forEach(template => {
    if (template.categoryId && template.category) {
      if (!templatesByCategory[template.categoryId]) {
        templatesByCategory[template.categoryId] = [];
      }
      templatesByCategory[template.categoryId].push(template);
    } else {
      uncategorized.push(template);
    }
  });

  return (
    <div className="min-h-screen bg-background">
      <TopNavigation />
      <div className="container mx-auto py-8">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold" data-testid="text-page-title">Task Templates</h1>
            <p className="text-muted-foreground mt-1">
              Create and manage reusable task templates for your clients
            </p>
          </div>
          <div className="flex space-x-2">
            <Link href="/task-template-categories">
              <Button variant="outline" data-testid="button-manage-categories">
                <Settings className="w-4 h-4 mr-2" />
                Manage Categories
              </Button>
            </Link>
            <Button onClick={() => setShowCreateDialog(true)} data-testid="button-create-template">
              <Plus className="w-4 h-4 mr-2" />
              New Template
            </Button>
          </div>
        </div>

        {templatesLoading ? (
          <div className="flex justify-center py-12">
            <p className="text-muted-foreground">Loading templates...</p>
          </div>
        ) : templatesWithDetails.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <ClipboardList className="w-16 h-16 text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-2">No templates yet</p>
              <p className="text-sm text-muted-foreground mb-4">
                Create your first template to get started
              </p>
              <Button onClick={() => setShowCreateDialog(true)} data-testid="button-create-first-template">
                <Plus className="w-4 h-4 mr-2" />
                Create Template
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-8">
            {/* Categorized templates */}
            {categories?.map(category => {
              const categoryTemplates = templatesByCategory[category.id];
              if (!categoryTemplates || categoryTemplates.length === 0) return null;

              return (
                <div key={category.id} data-testid={`section-category-${category.id}`}>
                  <h2 className="text-xl font-semibold mb-4" data-testid={`text-category-title-${category.id}`}>
                    {category.name}
                  </h2>
                  <div className="space-y-3">
                    {categoryTemplates.map(template => (
                      <TemplateCard key={template.id} template={template} />
                    ))}
                  </div>
                </div>
              );
            })}

            {/* Uncategorized templates */}
            {uncategorized.length > 0 && (
              <div data-testid="section-uncategorized">
                <h2 className="text-xl font-semibold mb-4">Uncategorized</h2>
                <div className="space-y-3">
                  {uncategorized.map(template => (
                    <TemplateCard key={template.id} template={template} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Create Template Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={(open) => {
        setShowCreateDialog(open);
        if (!open) {
          form.reset();
        }
      }}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Create New Template</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleCreateTemplate)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Template Name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g. New Client Onboarding"
                        data-testid="input-new-template-name"
                        {...field}
                      />
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
                        placeholder="Describe what this template is for..."
                        rows={3}
                        data-testid="input-new-template-description"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="categoryId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category (Optional)</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-new-template-category">
                          <SelectValue placeholder="Select a category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {categories?.map((category) => (
                          <SelectItem key={category.id} value={category.id}>
                            {category.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-new-template-status">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end space-x-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowCreateDialog(false);
                    form.reset();
                  }}
                  data-testid="button-cancel-create"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending}
                  data-testid="button-confirm-create"
                >
                  {createMutation.isPending ? "Creating..." : "Create & Edit"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
