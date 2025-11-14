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
import { Switch } from "@/components/ui/switch";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Settings, Save, Bell } from "lucide-react";
import type { CompanySettings, UpdateCompanySettings } from "@shared/schema";

export default function CompanySettingsPage() {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [emailSenderName, setEmailSenderName] = useState("");
  const [firmName, setFirmName] = useState("");
  const [pushNotificationsEnabled, setPushNotificationsEnabled] = useState(false);

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
      setFirmName(settings.firmName || "The Link");
      setPushNotificationsEnabled(settings.pushNotificationsEnabled || false);
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
      firmName,
      pushNotificationsEnabled,
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
              <Label htmlFor="firm-name">Firm Name</Label>
              <Input
                id="firm-name"
                data-testid="input-firm-name"
                type="text"
                value={firmName}
                onChange={(e) => setFirmName(e.target.value)}
                placeholder="The Link"
                disabled={settingsLoading || updateSettingsMutation.isPending}
              />
              <p className="text-sm text-muted-foreground">
                Your firm's name used in legal consent text and document signatures
              </p>
            </div>

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
                disabled={settingsLoading || updateSettingsMutation.isPending || !emailSenderName.trim() || !firmName.trim()}
                data-testid="button-save-company-settings"
              >
                <Save className="w-4 h-4 mr-2" />
                {updateSettingsMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Push Notifications Settings Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="w-5 h-5" />
              Push Notifications
            </CardTitle>
            <CardDescription>
              Control whether push notifications are sent to clients
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between space-x-4">
              <div className="flex-1 space-y-1">
                <Label htmlFor="push-notifications-enabled">Enable Push Notifications</Label>
                <p className="text-sm text-muted-foreground">
                  When enabled, the system will schedule and send push notifications to clients. Turn off until clients are using the portal to avoid unnecessary notifications.
                </p>
              </div>
              <Switch
                id="push-notifications-enabled"
                data-testid="switch-push-notifications-enabled"
                checked={pushNotificationsEnabled}
                onCheckedChange={setPushNotificationsEnabled}
                disabled={settingsLoading || updateSettingsMutation.isPending}
              />
            </div>

            <div className="flex justify-end">
              <Button
                onClick={handleSave}
                disabled={settingsLoading || updateSettingsMutation.isPending || !emailSenderName.trim()}
                data-testid="button-save-push-settings"
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
