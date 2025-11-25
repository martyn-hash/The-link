import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocation } from "wouter";
import { FileText, Plus } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatPersonName } from "../utils/formatters";
import type { ClientPersonWithPerson } from "../utils/types";

const customRequestSchema = z.object({
  name: z.string().min(1, "Request name is required"),
  description: z.string().optional(),
});

type CustomRequestData = z.infer<typeof customRequestSchema>;

interface NewClientRequestDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  relatedPeople: ClientPersonWithPerson[] | undefined;
  onSuccess?: (tab?: string) => void;
}

export function NewClientRequestDialog({
  isOpen,
  onOpenChange,
  clientId,
  relatedPeople,
  onSuccess,
}: NewClientRequestDialogProps) {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  
  const [requestType, setRequestType] = useState<'template' | 'custom' | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [selectedPersonId, setSelectedPersonId] = useState<string>("");

  const customRequestForm = useForm<CustomRequestData>({
    resolver: zodResolver(customRequestSchema),
    defaultValues: {
      name: "",
      description: "",
    },
  });

  const { data: taskCategories } = useQuery<any[]>({
    queryKey: ['/api/client-request-template-categories'],
    enabled: isOpen,
  });

  const { data: clientRequestTemplates } = useQuery<any[]>({
    queryKey: ['/api/client-request-templates', { categoryId: selectedCategoryId }],
    enabled: isOpen && !!selectedCategoryId,
  });

  const createTaskInstanceMutation = useMutation({
    mutationFn: async (data: { templateId: string; personId: string }) => {
      return await apiRequest("POST", "/api/task-instances", {
        templateId: data.templateId,
        customRequestId: null,
        clientId: clientId,
        personId: data.personId,
        status: "not_started",
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Client request created successfully",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/task-instances/client/${clientId}`] });
      handleClose();
      onSuccess?.("tasks");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to create client request",
        variant: "destructive",
      });
    },
  });

  const createCustomRequestMutation = useMutation({
    mutationFn: async (data: { name: string; description?: string }) => {
      const customRequest = await apiRequest("POST", `/api/clients/${clientId}/custom-requests`, {
        clientId: clientId,
        name: data.name,
        description: data.description || "",
      });
      return customRequest;
    },
    onSuccess: (data) => {
      toast({
        title: "Success",
        description: "Custom request created. Add sections and questions to complete it.",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/clients/${clientId}/custom-requests`] });
      handleClose();
      navigate(`/custom-requests/${data.id}/edit`);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to create custom request",
        variant: "destructive",
      });
    },
  });

  const resetState = () => {
    setRequestType(null);
    setSelectedCategoryId("");
    setSelectedTemplateId("");
    setSelectedPersonId("");
    customRequestForm.reset();
  };

  const handleClose = () => {
    resetState();
    onOpenChange(false);
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      resetState();
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New Client Request</DialogTitle>
          <DialogDescription>
            {!requestType ? "Choose how to create the request" : requestType === 'template' ? "Select a template and assign it to a related person" : "Create a custom one-time request"}
          </DialogDescription>
        </DialogHeader>
        
        {!requestType ? (
          <div className="grid grid-cols-2 gap-4 py-4">
            <Card 
              className="cursor-pointer hover:bg-accent transition-colors p-6"
              onClick={() => setRequestType('template')}
              data-testid="card-use-template"
            >
              <div className="flex flex-col items-center text-center gap-3">
                <FileText className="w-12 h-12 text-primary" />
                <div>
                  <h3 className="font-semibold">Use Template</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Select from reusable templates
                  </p>
                </div>
              </div>
            </Card>
            
            <Card 
              className="cursor-pointer hover:bg-accent transition-colors p-6"
              onClick={() => setRequestType('custom')}
              data-testid="card-create-custom"
            >
              <div className="flex flex-col items-center text-center gap-3">
                <Plus className="w-12 h-12 text-primary" />
                <div>
                  <h3 className="font-semibold">Create Custom</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Build a one-time request
                  </p>
                </div>
              </div>
            </Card>
          </div>
        ) : requestType === 'template' ? (
          <>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Category</label>
                <Select 
                  value={selectedCategoryId} 
                  onValueChange={(value) => {
                    setSelectedCategoryId(value);
                    setSelectedTemplateId("");
                  }}
                >
                  <SelectTrigger data-testid="select-category">
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {(taskCategories || []).map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedCategoryId && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Template</label>
                  <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                    <SelectTrigger data-testid="select-template">
                      <SelectValue placeholder="Select a template" />
                    </SelectTrigger>
                    <SelectContent>
                      {(clientRequestTemplates || []).map((template) => (
                        <SelectItem key={template.id} value={template.id}>
                          {template.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {selectedTemplateId && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Assign to Related Person</label>
                  <Select value={selectedPersonId} onValueChange={setSelectedPersonId}>
                    <SelectTrigger data-testid="select-person">
                      <SelectValue placeholder="Select a person" />
                    </SelectTrigger>
                    <SelectContent>
                      {(relatedPeople || []).map((cp: any) => (
                        <SelectItem key={cp.person.id} value={cp.person.id}>
                          {formatPersonName(cp.person.fullName)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <Button
                variant="outline"
                onClick={() => {
                  setRequestType(null);
                  setSelectedCategoryId("");
                  setSelectedTemplateId("");
                  setSelectedPersonId("");
                }}
              >
                Back
              </Button>
              <Button
                onClick={() => {
                  if (selectedTemplateId && selectedPersonId) {
                    createTaskInstanceMutation.mutate({
                      templateId: selectedTemplateId,
                      personId: selectedPersonId,
                    });
                  }
                }}
                disabled={!selectedTemplateId || !selectedPersonId || createTaskInstanceMutation.isPending}
                data-testid="button-create-request"
              >
                {createTaskInstanceMutation.isPending ? "Creating..." : "Create Request"}
              </Button>
            </div>
          </>
        ) : (
          <Form {...customRequestForm}>
            <form onSubmit={customRequestForm.handleSubmit((data) => createCustomRequestMutation.mutate(data))} className="space-y-4">
              <FormField
                control={customRequestForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Request Name</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="e.g., Quarterly Business Review Documents"
                        data-testid="input-custom-request-name"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={customRequestForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description (Optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="Describe what information you need from the client..."
                        rows={4}
                        data-testid="input-custom-request-description"
                      />
                    </FormControl>
                    <FormDescription>
                      Provide details about what this request is for
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="bg-muted/30 border border-dashed rounded-lg p-4">
                <p className="text-sm text-muted-foreground">
                  After creating the custom request, you'll be able to add sections and questions in the builder.
                </p>
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setRequestType(null);
                    customRequestForm.reset();
                  }}
                >
                  Back
                </Button>
                <Button
                  type="submit"
                  disabled={createCustomRequestMutation.isPending}
                  data-testid="button-create-custom-request"
                >
                  {createCustomRequestMutation.isPending ? "Creating..." : "Create Custom Request"}
                </Button>
              </div>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}
