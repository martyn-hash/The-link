import { useState, useEffect } from "react";
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { TabsContent } from "@/components/ui/tabs";
import { Edit2, Save, X, Plus, Trash2, Phone, Webhook, ChevronDown, HelpCircle, Link2, Users } from "lucide-react";
import type { ProjectType, Service, DialoraSettings, DialoraOutboundWebhook, DialoraVariableMapping } from "@shared/schema";
import { DIALORA_AVAILABLE_FIELDS } from "@shared/schema";
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
  toggleVoiceAiMutation?: {
    mutate: (useVoiceAi: boolean) => void;
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
  toggleVoiceAiMutation,
  isEditingDialora,
  setIsEditingDialora,
}: SettingsTabProps) {
  const [dialoraSettings, setDialoraSettings] = useState<DialoraSettings>(() => 
    projectType?.dialoraSettings || { outboundWebhooks: [], inboundWebhookUrl: '' }
  );

  // Sync local dialoraSettings state when projectType changes (e.g., after refetch)
  // Only sync when NOT in editing mode to avoid overwriting user's edits
  useEffect(() => {
    if (!isEditingDialora && projectType?.dialoraSettings) {
      setDialoraSettings(projectType.dialoraSettings);
    }
  }, [projectType?.dialoraSettings, isEditingDialora]);

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
    <TabsContent value="settings" className="page-container py-6 md:py-8 space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Link2 className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h3 className="text-lg font-semibold">Project Type Settings</h3>
          <p className="text-sm text-muted-foreground">
            Configure assignment system and integrations
          </p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <Link2 className="w-4 h-4" />
            Service Linkage
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/20">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${projectType?.serviceId ? 'bg-primary/10' : 'bg-muted'}`}>
                {projectType?.serviceId ? (
                  <Link2 className="w-5 h-5 text-primary" />
                ) : (
                  <Users className="w-5 h-5 text-muted-foreground" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <Badge variant={projectType?.serviceId ? "default" : "secondary"}>
                    {projectType?.serviceId ? "Roles-Based" : "User-Based"}
                  </Badge>
                  {projectType?.serviceId && (
                    <span className="text-sm font-medium">
                      {allServices?.find(s => s.id === projectType.serviceId)?.name || "Unknown Service"}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {projectType?.serviceId 
                    ? "Stage assignments use work roles from the linked service"
                    : "Stage assignments use direct user selection"
                  }
                </p>
              </div>
            </div>
            {!isEditingServiceLinkage && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsEditingServiceLinkage(true);
                  setSelectedServiceId(projectType?.serviceId || null);
                }}
                data-testid="button-edit-service-linkage"
              >
                <Edit2 className="w-4 h-4 mr-1" />
                Change
              </Button>
            )}
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
          ) : null}
        </CardContent>
      </Card>

      <Collapsible>
        <Card className="overflow-hidden">
          <CollapsibleTrigger className="w-full">
            <CardHeader className="flex flex-row items-center justify-between py-4 hover:bg-muted/30 transition-colors cursor-pointer">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <HelpCircle className="w-4 h-4 text-blue-500" />
                </div>
                <CardTitle className="text-base">Assignment System Guide</CardTitle>
              </div>
              <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform duration-200 [&[data-state=open]]:rotate-180" />
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0 pb-4 space-y-4 border-t">
              <div className="grid md:grid-cols-2 gap-4 pt-4">
                <div className="p-4 rounded-lg bg-muted/30 border">
                  <div className="flex items-center gap-2 mb-2">
                    <Link2 className="w-4 h-4 text-primary" />
                    <h4 className="text-sm font-semibold">Roles-Based</h4>
                    <Badge variant="outline" className="text-xs">Service Linked</Badge>
                  </div>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    <li>• Stage assignments use work roles from the linked service</li>
                    <li>• Projects auto-assign users based on role mappings</li>
                    <li>• More flexible for different client needs</li>
                  </ul>
                </div>
                <div className="p-4 rounded-lg bg-muted/30 border">
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="w-4 h-4 text-primary" />
                    <h4 className="text-sm font-semibold">User-Based</h4>
                    <Badge variant="outline" className="text-xs">No Service</Badge>
                  </div>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    <li>• Each stage specifies a user directly</li>
                    <li>• All projects inherit the same assignments</li>
                    <li>• Simpler setup for single-team workflows</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <Phone className="w-4 h-4 text-purple-500" />
              </div>
              Voice AI Reminders
            </CardTitle>
            <div className="flex items-center gap-3">
              <Badge 
                variant={projectType?.useVoiceAiForQueries ? "default" : "secondary"}
                className="text-xs"
              >
                {projectType?.useVoiceAiForQueries ? "Enabled" : "Disabled"}
              </Badge>
              <Switch
                checked={projectType?.useVoiceAiForQueries ?? false}
                onCheckedChange={(checked) => toggleVoiceAiMutation?.mutate(checked)}
                disabled={toggleVoiceAiMutation?.isPending || !projectType?.dialoraSettings?.outboundWebhooks?.some(w => w.active)}
                data-testid="switch-voice-ai-enabled"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Automated voice call reminders for bookkeeping queries via Dialora
          </p>
          {!projectType?.dialoraSettings?.outboundWebhooks?.some(w => w.active) && (
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
              Configure at least one active webhook to enable voice reminders
            </p>
          )}
        </CardHeader>
        <CardContent className="space-y-4 pt-0">

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

                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <Label>Data Variables</Label>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  const newMapping: DialoraVariableMapping = { key: '', field: '' };
                                  handleUpdateWebhook(webhook.id, { 
                                    variableMappings: [...(webhook.variableMappings || []), newMapping]
                                  });
                                }}
                                data-testid={`button-add-variable-mapping-${webhook.id}`}
                              >
                                <Plus className="w-4 h-4 mr-1" />
                                Add Variable
                              </Button>
                            </div>
                            
                            {(webhook.variableMappings || []).length === 0 ? (
                              <p className="text-xs text-muted-foreground">
                                No variables configured. Add variables to send client/recipient data to Dialora.
                              </p>
                            ) : (
                              <div className="space-y-2">
                                {(webhook.variableMappings || []).map((mapping, mappingIndex) => (
                                  <div key={mappingIndex} className="flex items-center gap-2 p-2 border rounded-lg bg-muted/30">
                                    <div className="flex-1 space-y-1">
                                      <Input
                                        value={mapping.key}
                                        onChange={(e) => {
                                          const updated = [...(webhook.variableMappings || [])];
                                          updated[mappingIndex] = { ...mapping, key: e.target.value };
                                          handleUpdateWebhook(webhook.id, { variableMappings: updated });
                                        }}
                                        placeholder="Variable name for Dialora (e.g., name)"
                                        className="h-8 text-sm"
                                        data-testid={`input-mapping-key-${webhook.id}-${mappingIndex}`}
                                      />
                                    </div>
                                    <span className="text-muted-foreground">=</span>
                                    <div className="flex-1">
                                      <Select
                                        value={mapping.field}
                                        onValueChange={(value) => {
                                          const updated = [...(webhook.variableMappings || [])];
                                          updated[mappingIndex] = { ...mapping, field: value };
                                          handleUpdateWebhook(webhook.id, { variableMappings: updated });
                                        }}
                                      >
                                        <SelectTrigger className="h-8 text-sm" data-testid={`select-mapping-field-${webhook.id}-${mappingIndex}`}>
                                          <SelectValue placeholder="Select data field" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {DIALORA_AVAILABLE_FIELDS.map((field) => (
                                            <SelectItem key={field.value} value={field.value}>
                                              {field.label}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        const updated = (webhook.variableMappings || []).filter((_, i) => i !== mappingIndex);
                                        handleUpdateWebhook(webhook.id, { variableMappings: updated });
                                      }}
                                      className="h-8 w-8 p-0"
                                      data-testid={`button-remove-mapping-${webhook.id}-${mappingIndex}`}
                                    >
                                      <Trash2 className="w-4 h-4 text-destructive" />
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            )}
                            
                            {(webhook.variableMappings || []).some(m => m.key && m.field) && (
                              <div className="p-2 bg-muted/50 rounded text-xs">
                                <span className="text-muted-foreground font-medium">Preview: </span>
                                {(webhook.variableMappings || [])
                                  .filter(m => m.key && m.field)
                                  .map(m => {
                                    const fieldLabel = DIALORA_AVAILABLE_FIELDS.find(f => f.value === m.field)?.label || m.field;
                                    return `${m.key} = [${fieldLabel}]`;
                                  })
                                  .join(', ')}
                              </div>
                            )}
                            <p className="text-xs text-muted-foreground">
                              Map data fields to variable names that Dialora expects. For example, map "name" to "Recipient First Name" to send the client's first name.
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
