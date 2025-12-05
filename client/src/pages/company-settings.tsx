import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { showFriendlyError } from "@/lib/friendlyErrors";
import TopNavigation from "@/components/top-navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Settings, Save, Bell, Link2, Plus, Trash2, ExternalLink, Upload, Image as ImageIcon, AlertTriangle, Lock, Eye, EyeOff, Phone, MessageSquare } from "lucide-react";
import type { CompanySettings, UpdateCompanySettings } from "@shared/schema";

interface RedirectUrl {
  name: string;
  url: string;
}

export default function CompanySettingsPage() {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [emailSenderName, setEmailSenderName] = useState("");
  const [firmName, setFirmName] = useState("");
  const [pushNotificationsEnabled, setPushNotificationsEnabled] = useState(false);
  
  // Maintenance mode
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState("");
  
  // NLAC password
  const [nlacPassword, setNlacPassword] = useState("");
  const [showNlacPassword, setShowNlacPassword] = useState(false);
  const [hasExistingNlacPassword, setHasExistingNlacPassword] = useState(false);
  
  // Feature flags
  const [ringCentralLive, setRingCentralLive] = useState(false);
  const [appIsLive, setAppIsLive] = useState(false);
  const [aiButtonEnabled, setAiButtonEnabled] = useState(false);
  
  // AI System Prompts
  const [aiSystemPromptNotes, setAiSystemPromptNotes] = useState("");
  const [aiSystemPromptEmails, setAiSystemPromptEmails] = useState("");
  const [aiSystemPromptStageNotifications, setAiSystemPromptStageNotifications] = useState("");
  
  // Post-signature redirect URLs
  const [redirectUrls, setRedirectUrls] = useState<RedirectUrl[]>([]);
  const [newRedirectName, setNewRedirectName] = useState("");
  const [newRedirectUrl, setNewRedirectUrl] = useState("");

  // Logo handling
  const [logoObjectPath, setLogoObjectPath] = useState<string | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      setMaintenanceMode(settings.maintenanceMode || false);
      setMaintenanceMessage(settings.maintenanceMessage || "");
      setNlacPassword("");
      setHasExistingNlacPassword(!!(settings as any).hasNlacPassword);
      setRedirectUrls((settings.postSignatureRedirectUrls as RedirectUrl[]) || []);
      setRingCentralLive(settings.ringCentralLive || false);
      setAppIsLive(settings.appIsLive || false);
      setAiButtonEnabled(settings.aiButtonEnabled || false);
      setAiSystemPromptNotes(settings.aiSystemPromptNotes || "");
      setAiSystemPromptEmails(settings.aiSystemPromptEmails || "");
      setAiSystemPromptStageNotifications(settings.aiSystemPromptStageNotifications || "");
      setLogoObjectPath(settings.logoObjectPath || null);
      
      // If logo exists, fetch preview URL
      if (settings.logoObjectPath) {
        // logoObjectPath already includes /objects/ prefix, so use it directly
        const logoUrl = settings.logoObjectPath.startsWith('/objects/') 
          ? settings.logoObjectPath 
          : `/objects/${settings.logoObjectPath}`;
        
        fetch(logoUrl, { credentials: 'include' })
          .then(res => res.blob())
          .then(blob => setLogoPreviewUrl(URL.createObjectURL(blob)))
          .catch(err => console.error("Failed to load logo preview:", err));
      } else {
        setLogoPreviewUrl(null);
      }
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
      showFriendlyError({ error });
    },
  });

  // Upload logo mutation
  const uploadLogoMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('logo', file);
      
      const response = await fetch('/api/super-admin/company-logo', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to upload logo');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Logo uploaded",
        description: "Company logo has been uploaded successfully.",
      });
      setLogoObjectPath(data.logoObjectPath);
      
      // Generate preview URL from uploaded file
      if (fileInputRef.current?.files?.[0]) {
        setLogoPreviewUrl(URL.createObjectURL(fileInputRef.current.files[0]));
      }
      
      queryClient.invalidateQueries({ queryKey: ["/api/super-admin/company-settings"] });
    },
    onError: (error: any) => {
      showFriendlyError({ error });
    },
  });

  // Delete logo mutation
  const deleteLogoMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/super-admin/company-logo', {
        method: 'DELETE',
        credentials: 'include',
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to delete logo');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Logo deleted",
        description: "Company logo has been removed.",
      });
      setLogoObjectPath(null);
      setLogoPreviewUrl(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      queryClient.invalidateQueries({ queryKey: ["/api/super-admin/company-settings"] });
    },
    onError: (error: any) => {
      showFriendlyError({ error });
    },
  });

  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
      showFriendlyError({ error: "Please upload an image file (PNG, JPG, etc.)" });
      return;
    }
    
    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      showFriendlyError({ error: "Please upload an image smaller than 5MB" });
      return;
    }
    
    uploadLogoMutation.mutate(file);
  };

  const handleDeleteLogo = () => {
    deleteLogoMutation.mutate();
  };

  const handleAddRedirectUrl = () => {
    if (!newRedirectName.trim() || !newRedirectUrl.trim()) {
      showFriendlyError({ error: "Please provide both a name and URL" });
      return;
    }

    // Basic URL validation
    try {
      new URL(newRedirectUrl);
    } catch {
      showFriendlyError({ error: "Please provide a valid URL (e.g., https://example.com)" });
      return;
    }

    setRedirectUrls([...redirectUrls, { name: newRedirectName.trim(), url: newRedirectUrl.trim() }]);
    setNewRedirectName("");
    setNewRedirectUrl("");
  };

  const handleDeleteRedirectUrl = (index: number) => {
    setRedirectUrls(redirectUrls.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    const data: UpdateCompanySettings = {
      emailSenderName,
      firmName,
      pushNotificationsEnabled,
      maintenanceMode,
      maintenanceMessage: maintenanceMessage || null,
      postSignatureRedirectUrls: redirectUrls,
      ringCentralLive,
      appIsLive,
      aiButtonEnabled,
      aiSystemPromptNotes: aiSystemPromptNotes || null,
      aiSystemPromptEmails: aiSystemPromptEmails || null,
      aiSystemPromptStageNotifications: aiSystemPromptStageNotifications || null,
    };
    
    // Only include nlacPassword if a new password was entered
    if (nlacPassword) {
      data.nlacPassword = nlacPassword;
    }
    
    updateSettingsMutation.mutate(data);
  };

  // Show loading state while checking auth
  if (authLoading || !user?.superAdmin) {
    return null;
  }

  return (
    <>
      <TopNavigation user={user} />
      
      {/* Header */}
      <div className="border-b border-border bg-card">
        <div className="page-container py-6 md:py-8">
          <Breadcrumb className="mb-4">
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

          <div>
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight flex items-center gap-2" data-testid="text-page-title">
              <Settings className="w-6 h-6 md:w-7 md:h-7" />
              Company Settings
            </h1>
            <p className="text-meta mt-1">
              Configure global system settings for your organization
            </p>
          </div>
        </div>
      </div>

      <div className="w-full py-6 md:py-8 space-y-8">

        {/* Centered Form Cards */}
        <div className="page-container space-y-8">
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

          {/* Company Logo Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ImageIcon className="w-5 h-5" />
                Company Logo
              </CardTitle>
              <CardDescription>
                Upload your company logo to display on e-signature certificates
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {logoPreviewUrl && (
                <div className="flex items-start gap-4 p-4 border rounded-lg bg-muted/30">
                  <div className="flex-shrink-0">
                    <img 
                      src={logoPreviewUrl} 
                      alt="Company logo" 
                      className="max-w-[200px] max-h-[120px] object-contain border border-border rounded"
                    />
                  </div>
                  <div className="flex-1 space-y-2">
                    <p className="text-sm font-medium">Current Logo</p>
                    <p className="text-sm text-muted-foreground">
                      This logo will appear at the top of all signature certificates
                    </p>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleDeleteLogo}
                      disabled={deleteLogoMutation.isPending}
                      data-testid="button-delete-logo"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      {deleteLogoMutation.isPending ? "Deleting..." : "Delete Logo"}
                    </Button>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="logo-upload">{logoPreviewUrl ? "Replace Logo" : "Upload Logo"}</Label>
                <div className="flex items-center gap-4">
                  <Input
                    id="logo-upload"
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleLogoFileChange}
                    disabled={uploadLogoMutation.isPending}
                    data-testid="input-logo-upload"
                    className="cursor-pointer"
                  />
                  {uploadLogoMutation.isPending && (
                    <span className="text-sm text-muted-foreground">Uploading...</span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  Upload a PNG or JPG image. Maximum file size: 5MB. Recommended size: 300x150px
                </p>
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

          {/* Feature Flags Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5" />
                Feature Flags
              </CardTitle>
              <CardDescription>
                Control which features are enabled for staff users in the system
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between space-x-4">
                <div className="flex-1 space-y-1">
                  <Label htmlFor="ring-central-live" className="flex items-center gap-2">
                    <Phone className="w-4 h-4" />
                    Ring Central Live
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    When enabled, the "Make Call" button will be visible in the communications timeline. Enable this once the Ring Central integration is fully configured.
                  </p>
                </div>
                <Switch
                  id="ring-central-live"
                  data-testid="switch-ring-central-live"
                  checked={ringCentralLive}
                  onCheckedChange={setRingCentralLive}
                  disabled={settingsLoading || updateSettingsMutation.isPending}
                />
              </div>

              <div className="flex items-center justify-between space-x-4">
                <div className="flex-1 space-y-1">
                  <Label htmlFor="app-is-live" className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4" />
                    App Is Live
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    When enabled, the "Instant Message" button will be visible in the communications timeline. Enable this once client users are actively using the app.
                  </p>
                </div>
                <Switch
                  id="app-is-live"
                  data-testid="switch-app-is-live"
                  checked={appIsLive}
                  onCheckedChange={setAppIsLive}
                  disabled={settingsLoading || updateSettingsMutation.isPending}
                />
              </div>

              <div className="flex items-center justify-between space-x-4">
                <div className="flex-1 space-y-1">
                  <Label htmlFor="ai-button-enabled" className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4" />
                    AI Magic Button
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    When enabled, the floating AI Magic Assistant button will be visible to all staff. When disabled, only Super Admins can see and test the AI button.
                  </p>
                </div>
                <Switch
                  id="ai-button-enabled"
                  data-testid="switch-ai-button-enabled"
                  checked={aiButtonEnabled}
                  onCheckedChange={setAiButtonEnabled}
                  disabled={settingsLoading || updateSettingsMutation.isPending}
                />
              </div>

              <div className="flex justify-end">
                <Button
                  onClick={handleSave}
                  disabled={settingsLoading || updateSettingsMutation.isPending || !emailSenderName.trim()}
                  data-testid="button-save-feature-flags"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {updateSettingsMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* AI System Prompts Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5" />
                AI System Prompts
              </CardTitle>
              <CardDescription>
                Configure the AI assistant's behavior for voice-to-note transcription and email drafting. These prompts tell the AI how to format and style its outputs.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="ai-system-prompt-notes">Notes System Prompt</Label>
                <Textarea
                  id="ai-system-prompt-notes"
                  data-testid="textarea-ai-system-prompt-notes"
                  value={aiSystemPromptNotes}
                  onChange={(e) => setAiSystemPromptNotes(e.target.value)}
                  placeholder="e.g., You are a professional assistant that converts spoken audio into clear, well-structured notes. Use bullet points for key information and summarize the main points concisely."
                  disabled={settingsLoading || updateSettingsMutation.isPending}
                  rows={5}
                  className="font-mono text-sm"
                />
                <p className="text-sm text-muted-foreground">
                  This prompt guides the AI when transcribing and summarizing voice recordings into notes.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="ai-system-prompt-emails">Email System Prompt</Label>
                <Textarea
                  id="ai-system-prompt-emails"
                  data-testid="textarea-ai-system-prompt-emails"
                  value={aiSystemPromptEmails}
                  onChange={(e) => setAiSystemPromptEmails(e.target.value)}
                  placeholder="e.g., You are a professional assistant that drafts emails on behalf of an accounting firm. Use a friendly but professional tone. Keep emails concise and actionable."
                  disabled={settingsLoading || updateSettingsMutation.isPending}
                  rows={5}
                  className="font-mono text-sm"
                />
                <p className="text-sm text-muted-foreground">
                  This prompt guides the AI when helping staff draft client emails.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="ai-system-prompt-stage-notifications">Stage Change Notification System Prompt</Label>
                <Textarea
                  id="ai-system-prompt-stage-notifications"
                  data-testid="textarea-ai-system-prompt-stage-notifications"
                  value={aiSystemPromptStageNotifications}
                  onChange={(e) => setAiSystemPromptStageNotifications(e.target.value)}
                  placeholder="e.g., You are a professional assistant drafting client notifications about project progress. Include a summary of completed work items when provided. Use a friendly, professional tone that celebrates progress."
                  disabled={settingsLoading || updateSettingsMutation.isPending}
                  rows={5}
                  className="font-mono text-sm"
                />
                <p className="text-sm text-muted-foreground">
                  This prompt guides the AI when drafting stage change notifications. The AI will also receive a list of completed quality control items to incorporate into the message.
                </p>
              </div>

              <div className="flex justify-end">
                <Button
                  onClick={handleSave}
                  disabled={settingsLoading || updateSettingsMutation.isPending || !emailSenderName.trim()}
                  data-testid="button-save-ai-settings"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {updateSettingsMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Maintenance Mode Card */}
          <Card className={maintenanceMode ? "border-amber-500 dark:border-amber-600" : ""}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className={`w-5 h-5 ${maintenanceMode ? "text-amber-500" : ""}`} />
                Maintenance Mode
              </CardTitle>
              <CardDescription>
                When enabled, only Super Admins can log in. All other users will see a maintenance message.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between space-x-4">
                <div className="flex-1 space-y-1">
                  <Label htmlFor="maintenance-mode-enabled">Enable Maintenance Mode</Label>
                  <p className="text-sm text-muted-foreground">
                    Prevent non-Super Admin users from logging in while you perform system maintenance.
                  </p>
                </div>
                <Switch
                  id="maintenance-mode-enabled"
                  data-testid="switch-maintenance-mode"
                  checked={maintenanceMode}
                  onCheckedChange={setMaintenanceMode}
                  disabled={settingsLoading || updateSettingsMutation.isPending}
                />
              </div>

              {maintenanceMode && (
                <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
                  <p className="text-sm text-amber-800 dark:text-amber-200 font-medium">
                    Maintenance mode is currently active. Only users with Super Admin access can log in.
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="maintenance-message">Maintenance Message</Label>
                <Textarea
                  id="maintenance-message"
                  data-testid="textarea-maintenance-message"
                  value={maintenanceMessage}
                  onChange={(e) => setMaintenanceMessage(e.target.value)}
                  placeholder="e.g., We're working on some important updates. We plan to be back online at 12:30."
                  disabled={settingsLoading || updateSettingsMutation.isPending}
                  rows={3}
                />
                <p className="text-sm text-muted-foreground">
                  This message will be displayed to users when they try to log in during maintenance.
                </p>
              </div>

              <div className="flex justify-end">
                <Button
                  onClick={handleSave}
                  disabled={settingsLoading || updateSettingsMutation.isPending || !emailSenderName.trim()}
                  data-testid="button-save-maintenance-settings"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {updateSettingsMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* NLAC Password Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="w-5 h-5" />
                NLAC Password
              </CardTitle>
              <CardDescription>
                Set a password required to mark clients as "No Longer a Client" (NLAC). This password protects against accidental client deactivation.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="nlac-password">
                  {hasExistingNlacPassword ? "Change NLAC Password" : "Set NLAC Password"}
                </Label>
                <div className="relative">
                  <Input
                    id="nlac-password"
                    data-testid="input-nlac-password"
                    type={showNlacPassword ? "text" : "password"}
                    value={nlacPassword}
                    onChange={(e) => setNlacPassword(e.target.value)}
                    placeholder={hasExistingNlacPassword ? "Enter new password to change" : "Enter password for NLAC protection"}
                    disabled={settingsLoading || updateSettingsMutation.isPending}
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                    onClick={() => setShowNlacPassword(!showNlacPassword)}
                    data-testid="button-toggle-nlac-password"
                  >
                    {showNlacPassword ? (
                      <EyeOff className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <Eye className="w-4 h-4 text-muted-foreground" />
                    )}
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  {hasExistingNlacPassword 
                    ? "A password is currently set. Enter a new password to change it, or leave blank to keep the existing password."
                    : "Users will be required to enter this password when marking a client as inactive."}
                </p>
              </div>

              {hasExistingNlacPassword ? (
                <div className="p-4 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg">
                  <p className="text-sm text-green-800 dark:text-green-200">
                    <Lock className="w-4 h-4 inline mr-2" />
                    NLAC password protection is active. Users must enter the password to mark clients as inactive.
                  </p>
                </div>
              ) : (
                <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
                  <p className="text-sm text-amber-800 dark:text-amber-200">
                    <AlertTriangle className="w-4 h-4 inline mr-2" />
                    No NLAC password is set. Users will not be able to mark clients as inactive until a password is configured.
                  </p>
                </div>
              )}

              <div className="flex justify-end">
                <Button
                  onClick={handleSave}
                  disabled={settingsLoading || updateSettingsMutation.isPending || !emailSenderName.trim()}
                  data-testid="button-save-nlac-settings"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {updateSettingsMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Full-Width Table Section */}
        <div className="px-4 md:px-6 lg:px-8">
          {/* Post-Signature Redirect URLs Card */}
          <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Link2 className="w-5 h-5" />
              Post-Signature Redirect URLs
            </CardTitle>
            <CardDescription>
              Configure redirect URLs for after clients sign documents. When creating a signature request, you can choose which URL to redirect signers to after completion.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Add New Redirect URL Form */}
            <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
              <h3 className="font-semibold text-sm">Add New Redirect URL</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="redirect-name">Name</Label>
                  <Input
                    id="redirect-name"
                    data-testid="input-redirect-name"
                    type="text"
                    value={newRedirectName}
                    onChange={(e) => setNewRedirectName(e.target.value)}
                    placeholder="e.g., Google Reviews, Company Website"
                    disabled={settingsLoading || updateSettingsMutation.isPending}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="redirect-url">URL</Label>
                  <Input
                    id="redirect-url"
                    data-testid="input-redirect-url"
                    type="url"
                    value={newRedirectUrl}
                    onChange={(e) => setNewRedirectUrl(e.target.value)}
                    placeholder="https://example.com"
                    disabled={settingsLoading || updateSettingsMutation.isPending}
                  />
                </div>
              </div>
              <Button
                onClick={handleAddRedirectUrl}
                disabled={settingsLoading || updateSettingsMutation.isPending || !newRedirectName.trim() || !newRedirectUrl.trim()}
                data-testid="button-add-redirect-url"
                size="sm"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Redirect URL
              </Button>
            </div>

            {/* Existing Redirect URLs Table */}
            {redirectUrls.length > 0 ? (
              <div className="space-y-2">
                <h3 className="font-semibold text-sm">Configured Redirect URLs</h3>
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>URL</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {redirectUrls.map((redirect, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-medium">{redirect.name}</TableCell>
                          <TableCell>
                            <a 
                              href={redirect.url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline flex items-center gap-1"
                            >
                              {redirect.url}
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteRedirectUrl(index)}
                              disabled={settingsLoading || updateSettingsMutation.isPending}
                              data-testid={`button-delete-redirect-${index}`}
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No redirect URLs configured. Add one above to get started.
              </p>
            )}

            <div className="flex justify-end">
              <Button
                onClick={handleSave}
                disabled={settingsLoading || updateSettingsMutation.isPending || !emailSenderName.trim()}
                data-testid="button-save-redirect-settings"
              >
                <Save className="w-4 h-4 mr-2" />
                {updateSettingsMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </CardContent>
        </Card>
        </div>
      </div>
    </>
  );
}
