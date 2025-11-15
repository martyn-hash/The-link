import { useState, useEffect, useRef } from "react";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Settings, Save, Bell, Link2, Plus, Trash2, ExternalLink, Upload, Image as ImageIcon } from "lucide-react";
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
      setRedirectUrls((settings.postSignatureRedirectUrls as RedirectUrl[]) || []);
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
      toast({
        title: "Error",
        description: error.message || "Failed to save company settings. Please try again.",
        variant: "destructive",
      });
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
      toast({
        title: "Error",
        description: error.message || "Failed to upload logo. Please try again.",
        variant: "destructive",
      });
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
      toast({
        title: "Error",
        description: error.message || "Failed to delete logo. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid file type",
        description: "Please upload an image file (PNG, JPG, etc.)",
        variant: "destructive",
      });
      return;
    }
    
    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please upload an image smaller than 5MB",
        variant: "destructive",
      });
      return;
    }
    
    uploadLogoMutation.mutate(file);
  };

  const handleDeleteLogo = () => {
    deleteLogoMutation.mutate();
  };

  const handleAddRedirectUrl = () => {
    if (!newRedirectName.trim() || !newRedirectUrl.trim()) {
      toast({
        title: "Invalid input",
        description: "Please provide both a name and URL",
        variant: "destructive",
      });
      return;
    }

    // Basic URL validation
    try {
      new URL(newRedirectUrl);
    } catch {
      toast({
        title: "Invalid URL",
        description: "Please provide a valid URL (e.g., https://example.com)",
        variant: "destructive",
      });
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
    updateSettingsMutation.mutate({
      emailSenderName,
      firmName,
      pushNotificationsEnabled,
      postSignatureRedirectUrls: redirectUrls,
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
    </>
  );
}
