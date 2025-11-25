import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Building2 } from "lucide-react";

const companyCreationSchema = z.object({
  companyName: z.string().min(1, "Company name is required"),
  companyNumber: z.string().optional(),
  officerRole: z.string().optional(),
  isPrimaryContact: z.boolean().optional().default(false)
});

export type CompanyCreationData = z.infer<typeof companyCreationSchema>;

interface CompanyCreationFormProps {
  onSubmit: (data: { companyName: string; companyNumber?: string; officerRole?: string; isPrimaryContact?: boolean; }) => void;
  onCancel: () => void;
  isSubmitting: boolean;
}

export function CompanyCreationForm({ onSubmit, onCancel, isSubmitting }: CompanyCreationFormProps) {
  const form = useForm<CompanyCreationData>({
    resolver: zodResolver(companyCreationSchema),
    defaultValues: {
      companyName: "",
      companyNumber: "",
      officerRole: "",
      isPrimaryContact: false
    }
  });

  const handleSubmit = (data: CompanyCreationData) => {
    onSubmit({
      companyName: data.companyName,
      companyNumber: data.companyNumber || undefined,
      officerRole: data.officerRole || undefined,
      isPrimaryContact: data.isPrimaryContact || false
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="companyName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Company Name *</FormLabel>
              <FormControl>
                <Input placeholder="Enter company name" {...field} data-testid="input-company-name" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="companyNumber"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Company Number</FormLabel>
              <FormControl>
                <Input placeholder="Enter company number (optional)" {...field} data-testid="input-company-number" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="officerRole"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Officer Role</FormLabel>
              <FormControl>
                <Input placeholder="e.g., Director, Secretary" {...field} data-testid="input-officer-role" />
              </FormControl>
              <FormDescription>
                The role this person holds at this company
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="isPrimaryContact"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
              <div className="space-y-0.5">
                <FormLabel>Primary Contact</FormLabel>
                <div className="text-sm text-muted-foreground">
                  Mark this person as the main contact for the company
                </div>
              </div>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  data-testid="switch-primary-contact"
                />
              </FormControl>
            </FormItem>
          )}
        />

        <div className="flex justify-end space-x-2 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isSubmitting}
            data-testid="button-cancel-company-creation"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting}
            data-testid="button-submit-company-creation"
          >
            {isSubmitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Creating...
              </>
            ) : (
              <>
                <Building2 className="h-4 w-4 mr-2" />
                Create Company
              </>
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}
