import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Edit, Trash2, FolderOpen } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import TopNavigation from "@/components/top-navigation";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { getQueryFn, apiRequest, queryClient } from "@/lib/queryClient";
import type { ClientRequestTemplateCategory, InsertClientRequestTemplateCategory } from "@shared/schema";

const categorySchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name too long"),
  description: z.string().optional(),
});

type CategoryForm = z.infer<typeof categorySchema>;

function CategoryModal({ 
  category,
  onSuccess 
}: { 
  category?: ClientRequestTemplateCategory;
  onSuccess: () => void; 
}) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const isEditing = !!category;
  
  const form = useForm<CategoryForm>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: category?.name || "",
      description: category?.description || "",
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (data: CategoryForm) => {
      if (isEditing) {
        return apiRequest("PATCH", `/api/client-request-template-categories/${category.id}`, data);
      }
      return apiRequest("POST", "/api/client-request-template-categories", data);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: `Category ${isEditing ? 'updated' : 'created'} successfully`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/client-request-template-categories"] });
      onSuccess();
      setOpen(false);
      form.reset();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save category",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (data: CategoryForm) => {
    saveMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {isEditing ? (
          <Button variant="ghost" size="sm" data-testid={`button-edit-category-${category.id}`}>
            <Edit className="w-4 h-4" />
          </Button>
        ) : (
          <Button data-testid="button-create-category">
            <Plus className="w-4 h-4 mr-2" />
            Add Category
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit' : 'Create'} Category</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category Name</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="e.g. Onboarding, Tax Returns" data-testid="input-category-name" />
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
                      placeholder="Describe what this category is for"
                      data-testid="input-category-description"
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
                disabled={saveMutation.isPending}
                data-testid="button-save-category"
              >
                {saveMutation.isPending ? "Saving..." : (isEditing ? "Update" : "Create")}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteCategoryDialog({ 
  category,
  onSuccess 
}: { 
  category: ClientRequestTemplateCategory;
  onSuccess: () => void; 
}) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const deleteMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("DELETE", `/api/client-request-template-categories/${category.id}`);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Category deleted successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/client-request-template-categories"] });
      onSuccess();
      setOpen(false);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete category",
        variant: "destructive",
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" data-testid={`button-delete-category-${category.id}`}>
          <Trash2 className="w-4 h-4 text-red-500" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Category</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Are you sure you want to delete the category "{category.name}"? This cannot be undone.
        </p>
        <div className="flex justify-end space-x-2 mt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
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
  );
}

export default function TaskTemplateCategoriesPage() {
  const { user } = useAuth();

  const { data: categories, isLoading } = useQuery<ClientRequestTemplateCategory[]>({
    queryKey: ["/api/client-request-template-categories"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

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

  return (
    <div className="min-h-screen bg-background">
      <TopNavigation />
      
      {/* Header */}
      <div className="border-b border-border bg-card">
        <div className="page-container py-6 md:py-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl md:text-3xl font-semibold tracking-tight" data-testid="text-page-title">Client Request Template Categories</h1>
              <p className="text-meta mt-1">
                Organize your client request templates into categories for better management
              </p>
            </div>
            <CategoryModal onSuccess={() => {}} />
          </div>
        </div>
      </div>

      <div className="w-full px-4 md:px-6 lg:px-8 py-6 md:py-8 space-y-8">

        <Card>
          <CardHeader>
            <CardTitle>Categories</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <p className="text-muted-foreground">Loading categories...</p>
              </div>
            ) : !categories || categories.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <FolderOpen className="w-16 h-16 text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-2">No categories yet</p>
                <p className="text-sm text-muted-foreground mb-4">
                  Create your first category to start organizing client request templates
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {categories.map((category) => (
                  <div
                    key={category.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition"
                    data-testid={`card-category-${category.id}`}
                  >
                    <div className="flex-1">
                      <h3 className="font-medium" data-testid={`text-category-name-${category.id}`}>
                        {category.name}
                      </h3>
                      {category.description && (
                        <p className="text-sm text-muted-foreground mt-1" data-testid={`text-category-description-${category.id}`}>
                          {category.description}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center space-x-2">
                      <CategoryModal category={category} onSuccess={() => {}} />
                      <DeleteCategoryDialog category={category} onSuccess={() => {}} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
