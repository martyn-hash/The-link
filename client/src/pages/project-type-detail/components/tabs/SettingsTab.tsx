import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TabsContent } from "@/components/ui/tabs";
import { Edit2, Save, X, Plus, Trash2, Phone, Webhook } from "lucide-react";
import type { ProjectType, Service, DialoraSettings, DialoraOutboundWebhook } from "@shared/schema";
import { nanoid } from "nanoid";

interface SettingsTabProps {
  projectType: ProjectType | undefined;
  allServices: Service[] | undefined;
  isEditingServiceLinkage: boolean;
  setIsEditingServiceLinkage: (value: boolean) => void;
  selectedServiceId: string | null;
  setSelectedServiceId: (value: string | null) => void;
  updateProjectTypeServiceLinkageMutation: {
    mutate: (serviceId: string | null) => void;
    isPending: boolean;
  };
  updateDialoraSettingsMutation?: {
    mutate: (settings: DialoraSettings) => void;
    isPending: boolean;
  };
  isEditingDialora: boolean;
  setIsEditingDialora: (value: boolean) => void;
}

export function SettingsTab({
  projectType,
  allServices,
  isEditingServiceLinkage,
  setIsEditingServiceLinkage,
  selectedServiceId,
  setSelectedServiceId,
  updateProjectTypeServiceLinkageMutation,
  updateDialoraSettingsMutation,
  isEditingDialora,
  setIsEditingDialora,
}: SettingsTabProps) {
  const [dialoraSettings, setDialoraSettings] = useState<DialoraSettings>(() => 
    projectType?.dialoraSettings || { outboundWebhooks: [], inboundWebhookUrl: '' }
  );

  const handleAddWebhook = () => {
    const newWebhook: DialoraOutboundWebhook = {
      id: nanoid(),
      name: `Webhook ${(dialoraSettings.outboundWebhooks?.length || 0) + 1}`,
      url: '',
      messageTemplate: 'We have some bookkeeping queries that need your attention.',
      active: true,
    };
    setDialoraSettings(prev => ({
      ...prev,
      outboundWebhooks: [...(prev.outboundWebhooks || []), newWebhook],
    }));
  };

  const handleUpdateWebhook = (id: string, updates: Partial<DialoraOutboundWebhook>) => {
    setDialoraSettings(prev => ({
      ...prev,
      outboundWebhooks: (prev.outboundWebhooks || []).map(w => 
        w.id === id ? { ...w, ...updates } : w
      ),
    }));
  };

  const handleRemoveWebhook = (id: string) => {
    setDialoraSettings(prev => ({
      ...prev,
      outboundWebhooks: (prev.outboundWebhooks || []).filter(w => w.id !== id),
    }));
  };

  const handleSaveDialoraSettings = () => {
    if (updateDialoraSettingsMutation) {
      updateDialoraSettingsMutation.mutate(dialoraSettings);
    }
  };

  const handleCancelDialoraEdit = () => {
    setDialoraSettings(projectType?.dialoraSettings || { outboundWebhooks: [], inboundWebhookUrl: '' });
    setIsEditingDialora(false);
  };

  return (
    <TabsContent value="settings" className="page-container py-6 md:py-8 space-y-8">
      <div>
        <h3 className="text-lg font-semibold mb-2">Project Type Settings</h3>
        <p className="text-sm text-muted-foreground mb-6">
          Configure the assignment system for this project type
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            Service Linkage
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>Current Assignment System</Label>
            <div className="p-4 bg-muted rounded-lg">
              {projectType?.serviceId ? (
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Badge variant="default">Roles-Based</Badge>
                    <span className="text-sm text-muted-foreground">
                      Linked to service: <strong>{allServices?.find(s => s.id === projectType.serviceId)?.name || "Unknown Service"}</strong>
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Stage assignments use work roles from the linked service. Users are assigned based on their role mappings in each client service.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Badge variant="secondary">User-Based</Badge>
                    <span className="text-sm text-muted-foreground">Not linked to any service</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Stage assignments use direct user selection. Each stage must be assigned to a specific user.
                  </p>
                </div>
              )}
            </div>
          </div>

          {isEditingServiceLinkage ? (
            <div className="space-y-4">
              <div className="p-4 bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                <h4 className="text-sm font-semibold text-yellow-900 dark:text-yellow-100 mb-2">
                  ⚠️ Important: Changing the Assignment System
                </h4>
                <ul className="text-xs text-yellow-800 dark:text-yellow-200 space-y-1 list-disc list-inside">
                  <li>All existing stage assignments will need to be reviewed and updated</li>
                  <li>Switching to roles-based requires configuring role assignments for each client service</li>
                  <li>Switching to user-based requires assigning specific users to each stage</li>
                  <li>Active projects using this project type may be affected</li>
                </ul>
              </div>

              <div className="space-y-2">
                <Label htmlFor="service-select">Link to Service (Optional)</Label>
                <Select
                  value={selectedServiceId || "none"}
                  onValueChange={(value) => setSelectedServiceId(value === "none" ? null : value)}
                >
                  <SelectTrigger data-testid="select-service-linkage">
                    <SelectValue placeholder="Select a service or choose none" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Service (User-Based Assignments)</SelectItem>
                    {allServices
                      ?.filter(s => !s.isStaticService && !s.isPersonalService)
                      .map((service) => (
                        <SelectItem key={service.id} value={service.id}>
                          {service.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {selectedServiceId ? (
                    <>Switching to <strong>roles-based</strong> assignment system using service roles</>
                  ) : (
                    <>Switching to <strong>user-based</strong> assignment system with direct user selection</>
                  )}
                </p>
              </div>

              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsEditingServiceLinkage(false);
                    setSelectedServiceId(null);
                  }}
                  data-testid="button-cancel-service-linkage"
                >
                  <X className="w-4 h-4 mr-2" />
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    updateProjectTypeServiceLinkageMutation.mutate(selectedServiceId);
                  }}
                  disabled={updateProjectTypeServiceLinkageMutation.isPending}
                  data-testid="button-save-service-linkage"
                >
                  <Save className="w-4 h-4 mr-2" />
                  Save Changes
                </Button>
              </div>
            </div>
          ) : (
            <div>
              <Button
                variant="outline"
                onClick={() => {
                  setIsEditingServiceLinkage(true);
                  setSelectedServiceId(projectType?.serviceId || null);
                }}
                data-testid="button-edit-service-linkage"
              >
                <Edit2 className="w-4 h-4 mr-2" />
                Change Assignment System
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Assignment System Guide</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="text-sm font-semibold mb-2">Roles-Based Assignments</h4>
            <p className="text-xs text-muted-foreground">
              When a project type is linked to a service, stage assignments use work roles. For each client service:
            </p>
            <ul className="text-xs text-muted-foreground list-disc list-inside mt-1 space-y-1 ml-2">
              <li>Configure which users fill each work role</li>
              <li>Projects automatically assign users based on role mappings</li>
              <li>Changes to role assignments affect all projects using that client service</li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold mb-2">User-Based Assignments</h4>
            <p className="text-xs text-muted-foreground">
              When a project type is not linked to a service, stage assignments use direct user selection:
            </p>
            <ul className="text-xs text-muted-foreground list-disc list-inside mt-1 space-y-1 ml-2">
              <li>Each stage template must specify a user directly</li>
              <li>All projects inherit the same user assignments from the template</li>
              <li>Simpler setup but less flexible for different client needs</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="w-5 h-5" />
            Voice AI Reminders (Dialora)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-sm text-muted-foreground">
            Configure automated voice call reminders for bookkeeping queries. Multiple webhooks can be defined to cycle through different messages.
          </p>

          {isEditingDialora ? (
            <div className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="inbound-webhook">Inbound Webhook URL (Call Status Updates)</Label>
                  <div className="flex items-center gap-2">
                    <Webhook className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <Input
                      id="inbound-webhook"
                      value={dialoraSettings.inboundWebhookUrl || ''}
                      onChange={(e) => setDialoraSettings(prev => ({ ...prev, inboundWebhookUrl: e.target.value }))}
                      placeholder="https://your-app.replit.app/api/webhooks/dialora/call-status"
                      data-testid="input-dialora-inbound-webhook"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Dialora will send call status updates to this URL when calls complete.
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Outbound Webhooks</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleAddWebhook}
                      data-testid="button-add-dialora-webhook"
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Add Webhook
                    </Button>
                  </div>

                  {(dialoraSettings.outboundWebhooks || []).length === 0 ? (
                    <div className="p-4 bg-muted rounded-lg text-center text-sm text-muted-foreground">
                      No webhooks configured. Add one to enable voice reminders.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {(dialoraSettings.outboundWebhooks || []).map((webhook, index) => (
                        <div
                          key={webhook.id}
                          className="p-4 border rounded-lg space-y-3"
                          data-testid={`dialora-webhook-${webhook.id}`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <Badge variant={webhook.active ? "default" : "secondary"}>
                                {index + 1}
                              </Badge>
                              <Input
                                value={webhook.name}
                                onChange={(e) => handleUpdateWebhook(webhook.id, { name: e.target.value })}
                                placeholder="Webhook name"
                                className="w-48"
                                data-testid={`input-webhook-name-${webhook.id}`}
                              />
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="flex items-center gap-2">
                                <Label htmlFor={`active-${webhook.id}`} className="text-xs">Active</Label>
                                <Switch
                                  id={`active-${webhook.id}`}
                                  checked={webhook.active}
                                  onCheckedChange={(checked) => handleUpdateWebhook(webhook.id, { active: checked })}
                                  data-testid={`switch-webhook-active-${webhook.id}`}
                                />
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemoveWebhook(webhook.id)}
                                className="text-destructive hover:text-destructive"
                                data-testid={`button-remove-webhook-${webhook.id}`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <Label>Webhook URL</Label>
                            <Input
                              value={webhook.url}
                              onChange={(e) => handleUpdateWebhook(webhook.id, { url: e.target.value })}
                              placeholder="https://api.dialora.ai/webhooks/agents/..."
                              data-testid={`input-webhook-url-${webhook.id}`}
                            />
                          </div>

                          <div className="space-y-2">
                            <Label>Message Template</Label>
                            <Textarea
                              value={webhook.messageTemplate}
                              onChange={(e) => handleUpdateWebhook(webhook.id, { messageTemplate: e.target.value })}
                              placeholder="The message the AI will convey during the call..."
                              rows={3}
                              data-testid={`textarea-webhook-message-${webhook.id}`}
                            />
                            <p className="text-xs text-muted-foreground">
                              This message will be sent to the AI agent to guide the conversation.
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <p className="text-xs text-muted-foreground">
                    When multiple webhooks are configured, the system will cycle through them for successive reminder calls.
                  </p>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={handleCancelDialoraEdit}
                  data-testid="button-cancel-dialora"
                >
                  <X className="w-4 h-4 mr-2" />
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveDialoraSettings}
                  disabled={updateDialoraSettingsMutation?.isPending}
                  data-testid="button-save-dialora"
                >
                  <Save className="w-4 h-4 mr-2" />
                  Save Dialora Settings
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {projectType?.dialoraSettings?.inboundWebhookUrl && (
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Inbound Webhook URL</Label>
                  <div className="text-sm font-mono bg-muted px-2 py-1 rounded truncate">
                    {projectType.dialoraSettings.inboundWebhookUrl}
                  </div>
                </div>
              )}
              
              {projectType?.dialoraSettings?.outboundWebhooks && projectType.dialoraSettings.outboundWebhooks.length > 0 ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Badge variant="default">{projectType.dialoraSettings.outboundWebhooks.length}</Badge>
                    <span className="text-sm">outbound webhook(s) configured</span>
                  </div>
                  <div className="space-y-2">
                    {projectType.dialoraSettings.outboundWebhooks.map((webhook, index) => (
                      <div key={webhook.id} className="flex items-center gap-2 text-sm">
                        <Badge variant={webhook.active ? "outline" : "secondary"} className="text-xs">
                          {index + 1}
                        </Badge>
                        <span className={webhook.active ? "" : "text-muted-foreground"}>
                          {webhook.name}
                        </span>
                        {!webhook.active && <span className="text-xs text-muted-foreground">(inactive)</span>}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-muted rounded-lg text-sm text-muted-foreground">
                  No outbound voice AI webhooks configured. Voice reminders will use default system settings.
                </div>
              )}

              <Button
                variant="outline"
                onClick={() => {
                  setDialoraSettings(projectType?.dialoraSettings || { outboundWebhooks: [], inboundWebhookUrl: '' });
                  setIsEditingDialora(true);
                }}
                data-testid="button-edit-dialora"
              >
                <Edit2 className="w-4 h-4 mr-2" />
                Configure Voice AI
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </TabsContent>
  );
}
