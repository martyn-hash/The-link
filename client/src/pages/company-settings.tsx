import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import TopNavigation from "@/components/top-navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Settings, Save } from "lucide-react";
import type { CompanySettings, UpdateCompanySettings } from "@shared/schema";

export default function CompanySettingsPage() {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [emailSenderName, setEmailSenderName] = useState("");

  // Redirect if not super admin
  useEffect(() => {
    if (!authLoading && (!user || !user.superAdmin)) {
      navigate("/");
    }
  }, [user, authLoading, navigate]);

  // Fetch company settings
  const { data: settings, isLoading: settingsLoading } = useQuery<CompanySettings>({
    queryKey: ["/api/super-admin/company-settings"],
    enabled: !!user?.superAdmin,
  });

  // Update form when settings are loaded
  useEffect(() => {
    if (settings) {
      setEmailSenderName(settings.emailSenderName || "The Link Team");
    }
  }, [settings]);

  // Update company settings mutation
  const updateSettingsMutation = useMutation({
    mutationFn: async (data: UpdateCompanySettings) => {
      return await apiRequest("PUT", "/api/super-admin/company-settings", data);
    },
    onSuccess: () => {
      toast({
        title: "Settings saved",
        description: "Company settings have been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/super-admin/company-settings"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save company settings. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    updateSettingsMutation.mutate({
      emailSenderName,
    });
  };

  // Show loading state while checking auth
  if (authLoading || !user?.superAdmin) {
    return null;
  }

  return (
    <>
      <TopNavigation user={user} />
      <div className="container mx-auto p-4 md:p-6 space-y-6">
        {/* Breadcrumbs */}
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/">Home</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Company Settings</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2" data-testid="text-page-title">
              <Settings className="w-8 h-8" />
              Company Settings
            </h1>
            <p className="text-muted-foreground mt-1">
              Configure global system settings for your organization
            </p>
          </div>
        </div>

        {/* Email Settings Card */}
        <Card>
          <CardHeader>
            <CardTitle>Email Settings</CardTitle>
            <CardDescription>
              Configure how emails are sent to clients from the system
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email-sender-name">Email Sender Name</Label>
              <Input
                id="email-sender-name"
                data-testid="input-email-sender-name"
                type="text"
                value={emailSenderName}
                onChange={(e) => setEmailSenderName(e.target.value)}
                placeholder="The Link Team"
                disabled={settingsLoading || updateSettingsMutation.isPending}
              />
              <p className="text-sm text-muted-foreground">
                This name will appear in the 'From' field of all email notifications sent to clients
              </p>
            </div>

            <div className="flex justify-end">
              <Button
                onClick={handleSave}
                disabled={settingsLoading || updateSettingsMutation.isPending || !emailSenderName.trim()}
                data-testid="button-save"
              >
                <Save className="w-4 h-4 mr-2" />
                {updateSettingsMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
