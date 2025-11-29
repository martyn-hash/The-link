import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { showFriendlyError } from "@/lib/friendlyErrors";
import { apiRequest, queryClient, getQueryFn } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { EnhancedClientService, EditServiceData, editServiceSchema } from "../../utils/types";
import type { User, WorkRole } from "@shared/schema";

interface EditServiceModalProps {
  service: EnhancedClientService;
  isOpen: boolean;
  onClose: () => void;
}

export function EditServiceModal({ 
  service, 
  isOpen, 
  onClose 
}: EditServiceModalProps) {
  const { toast } = useToast();
  const form = useForm<EditServiceData>({
    resolver: zodResolver(editServiceSchema),
    defaultValues: {
      nextStartDate: service.nextStartDate ? new Date(service.nextStartDate).toISOString().split('T')[0] : '',
      nextDueDate: service.nextDueDate ? new Date(service.nextDueDate).toISOString().split('T')[0] : '',
      serviceOwnerId: service.serviceOwnerId || 'none',
      frequency: (service.frequency as "daily" | "weekly" | "monthly" | "quarterly" | "annually") || 'monthly',
      isActive: service.isActive ?? true,
    },
  });

  const [roleAssignments, setRoleAssignments] = useState(
    service.roleAssignments?.map(ra => ({
      workRoleId: ra.workRole.id,
      userId: ra.user.id,
    })) || []
  );

  // Check if this is a Companies House service
  const isCompaniesHouseService = service.service.isCompaniesHouseConnected;

  // Detect if this is a people service by checking if it has a personId property
  const isPeopleService = 'personId' in service;

  // Use the mutation for updating service
  const updateServiceMutation = useMutation({
    mutationFn: async (data: EditServiceData & { serviceId: string; roleAssignments: Array<{workRoleId: string; userId: string}> }) => {
      const serviceUpdateData = {
        nextStartDate: data.nextStartDate && data.nextStartDate.trim() !== '' ? 
          (data.nextStartDate.includes('T') ? data.nextStartDate : data.nextStartDate + 'T00:00:00.000Z') : 
          undefined,
        nextDueDate: data.nextDueDate && data.nextDueDate.trim() !== '' ? 
          (data.nextDueDate.includes('T') ? data.nextDueDate : data.nextDueDate + 'T00:00:00.000Z') : 
          undefined,
        serviceOwnerId: data.serviceOwnerId === "none" ? null : data.serviceOwnerId,
        frequency: isCompaniesHouseService ? "annually" : data.frequency,
        isActive: data.isActive,
      };
      
      // Call the appropriate API endpoint based on service type
      if (isPeopleService) {
        await apiRequest("PUT", `/api/people-services/${data.serviceId}`, serviceUpdateData);
      } else {
        await apiRequest("PUT", `/api/client-services/${data.serviceId}`, serviceUpdateData);
      }
      
      return { success: true };
    },
    onSuccess: () => {
      // Invalidate the appropriate cache based on service type
      if (isPeopleService) {
        queryClient.invalidateQueries({ queryKey: [`/api/people-services/client/${service.clientId}`] });
      } else {
        queryClient.invalidateQueries({ queryKey: [`/api/client-services/client/${service.clientId}`] });
      }
      
      // Also invalidate chronology to show service activation/deactivation events
      queryClient.invalidateQueries({ queryKey: ["/api/clients", service.clientId, "chronology"] });
      
      toast({
        title: "Success",
        description: "Service updated successfully",
      });
      onClose();
    },
    onError: (error: any) => {
      console.error('Failed to update service:', error);
      showFriendlyError({ error });
    },
  });

  // Query for work roles and users
  const { data: workRoles = [] } = useQuery<WorkRole[]>({
    queryKey: ['/api/work-roles'],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const { data: allUsers = [] } = useQuery<User[]>({
    queryKey: ['/api/users'],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const handleSubmit = (data: EditServiceData) => {
    updateServiceMutation.mutate({
      ...data,
      serviceId: service.id,
      roleAssignments,
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Service: {service.service.name}</DialogTitle>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            
            {/* Service Owner */}
            <FormField
              control={form.control}
              name="serviceOwnerId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Service Owner</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-service-owner">
                        <SelectValue placeholder="Select service owner" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">No owner assigned</SelectItem>
                      {allUsers.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.firstName} {user.lastName} ({user.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Active/Inactive Toggle */}
            <FormField
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Service Status</FormLabel>
                    <FormDescription>
                      Inactive services will not generate new projects when the scheduler runs.
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      data-testid="switch-service-active"
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            {/* Frequency field - disabled for Companies House services */}
            <FormField
              control={form.control}
              name="frequency"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Frequency</FormLabel>
                  <Select 
                    onValueChange={field.onChange} 
                    defaultValue={isCompaniesHouseService ? "annually" : field.value}
                    disabled={isCompaniesHouseService}
                  >
                    <FormControl>
                      <SelectTrigger data-testid="select-frequency">
                        <SelectValue placeholder="Select frequency" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="quarterly">Quarterly</SelectItem>
                      <SelectItem value="annually">Annually</SelectItem>
                    </SelectContent>
                  </Select>
                  {isCompaniesHouseService && (
                    <FormDescription className="text-blue-600 dark:text-blue-400">
                      Companies House services are automatically set to annual frequency.
                    </FormDescription>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Date fields - only show for non-Companies House services */}
            {!isCompaniesHouseService && (
              <>
                <FormField
                  control={form.control}
                  name="nextStartDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Next Start Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} data-testid="input-next-start-date" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="nextDueDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Next Due Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} data-testid="input-next-due-date" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}

            {/* Companies House notice */}
            {isCompaniesHouseService && (
              <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg border">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  <strong>Companies House Service:</strong> Start and due dates are automatically managed based on client data and cannot be edited manually.
                </p>
              </div>
            )}

            {/* Role Assignments */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <FormLabel>Role Assignments</FormLabel>
                <p className="text-xs text-muted-foreground">
                  Roles are defined in Admin. You can only change who fills each role here.
                </p>
              </div>

              {service.roleAssignments && service.roleAssignments.length > 0 ? (
                service.roleAssignments.map((assignment) => (
                  <div key={assignment.workRole.id} className="flex items-center space-x-2 p-3 border rounded-lg">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">{assignment.workRole.name}</div>
                      {assignment.workRole.description && (
                        <div className="text-xs text-muted-foreground">{assignment.workRole.description}</div>
                      )}
                    </div>
                    <div className="flex-1">
                      <Select
                        value={roleAssignments.find(ra => ra.workRoleId === assignment.workRole.id)?.userId || assignment.user.id}
                        onValueChange={(value) => {
                          const newAssignments = [...roleAssignments];
                          const existingIndex = newAssignments.findIndex(ra => ra.workRoleId === assignment.workRole.id);
                          if (existingIndex >= 0) {
                            newAssignments[existingIndex].userId = value;
                          } else {
                            newAssignments.push({ workRoleId: assignment.workRole.id, userId: value });
                          }
                          setRoleAssignments(newAssignments);
                        }}
                      >
                        <SelectTrigger data-testid={`select-user-${assignment.workRole.id}`}>
                          <SelectValue placeholder="Select assignee" />
                        </SelectTrigger>
                        <SelectContent>
                          {allUsers.map((user) => (
                            <SelectItem key={user.id} value={user.id}>
                              {user.firstName} {user.lastName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-4 text-muted-foreground">
                  No role assignments found for this service. Roles can be configured in the admin area.
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-2">
              <Button type="button" variant="outline" onClick={onClose} data-testid="button-cancel-edit">
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={updateServiceMutation.isPending}
                data-testid="button-save-service"
              >
                {updateServiceMutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
