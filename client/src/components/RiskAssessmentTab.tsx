import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { AlertCircle, CheckCircle, Plus, Calendar, Eye, Trash2, Shield } from "lucide-react";
import { insertRiskAssessmentSchema } from "@shared/schema";
import type { RiskAssessment, RiskAssessmentResponse } from "@shared/schema";

type RiskAssessmentWithResponses = RiskAssessment & {
  responses?: RiskAssessmentResponse[];
};

const createRiskAssessmentFormSchema = insertRiskAssessmentSchema.omit({ clientId: true });

const riskQuestionsSections = [
  {
    id: "aml_preparation",
    title: "AML Preparation",
    questions: [
      { key: "aml_prep_1", text: "Has the client provided valid identification documents?" },
      { key: "aml_prep_2", text: "Has proof of address been verified?" },
      { key: "aml_prep_3", text: "Have beneficial owners been identified?" },
      { key: "aml_prep_4", text: "Has source of funds been verified?" },
      { key: "aml_prep_5", text: "Are there any PEP (Politically Exposed Persons) connections?" },
    ],
  },
  {
    id: "aml_review",
    title: "AML Review",
    questions: [
      { key: "aml_review_1", text: "Has the client's business activity been reviewed?" },
      { key: "aml_review_2", text: "Are there any unusual transaction patterns?" },
      { key: "aml_review_3", text: "Has the client's risk profile changed?" },
      { key: "aml_review_4", text: "Are all AML review requirements met?" },
    ],
  },
  {
    id: "individuals_checklist",
    title: "Individuals Checklist",
    questions: [
      { key: "ind_check_1", text: "Are all directors' details verified?" },
      { key: "ind_check_2", text: "Have background checks been completed for key individuals?" },
      { key: "ind_check_3", text: "Are there any concerns about individual credibility?" },
      { key: "ind_check_4", text: "Have all individual identification documents been collected?" },
      { key: "ind_check_5", text: "Are all individuals properly authorized?" },
    ],
  },
  {
    id: "business_checklist",
    title: "Business Checklist",
    questions: [
      { key: "bus_check_1", text: "Is the business structure clearly understood?" },
      { key: "bus_check_2", text: "Have financial statements been reviewed?" },
      { key: "bus_check_3", text: "Is the business operating in high-risk sectors?" },
      { key: "bus_check_4", text: "Are there any compliance concerns?" },
      { key: "bus_check_5", text: "Has the business registration been verified?" },
      { key: "bus_check_6", text: "Are all necessary business licenses in place?" },
    ],
  },
  {
    id: "risk_areas",
    title: "Risk Areas",
    questions: [
      { key: "risk_1", text: "Geographical risk (operations in high-risk jurisdictions)?" },
      { key: "risk_2", text: "Product/Service risk (complex or opaque products)?" },
      { key: "risk_3", text: "Are enhanced due diligence measures required?" },
      { key: "risk_4", text: "Are there any politically exposed persons (PEPs)?" },
      { key: "risk_5", text: "Is ongoing monitoring required?" },
    ],
  },
];

interface RiskAssessmentTabProps {
  clientId: string;
}

export function RiskAssessmentTab({ clientId }: RiskAssessmentTabProps) {
  const { toast } = useToast();
  const [selectedAssessmentId, setSelectedAssessmentId] = useState<string | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);

  const { data: assessments, isLoading } = useQuery<RiskAssessmentWithResponses[]>({
    queryKey: ["/api/clients", clientId, "risk-assessments"],
  });

  const { data: selectedAssessment, isLoading: isLoadingAssessment } = useQuery<RiskAssessmentWithResponses>({
    queryKey: ["/api/risk-assessments", selectedAssessmentId],
    enabled: !!selectedAssessmentId,
  });

  const createForm = useForm({
    resolver: zodResolver(createRiskAssessmentFormSchema),
    defaultValues: {
      version: new Date().toISOString().split('T')[0],
      riskLevel: "medium" as const,
      initialDate: new Date(),
      generalInformation: null,
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: z.infer<typeof createRiskAssessmentFormSchema>) => {
      console.log("[RiskAssessment] Creating assessment with data:", data);
      console.log("[RiskAssessment] Client ID:", clientId);
      console.log("[RiskAssessment] API URL:", `/api/clients/${clientId}/risk-assessments`);
      const result = await apiRequest(`/api/clients/${clientId}/risk-assessments`, "POST", data);
      console.log("[RiskAssessment] API response:", result);
      return result;
    },
    onSuccess: (data) => {
      console.log("[RiskAssessment] Successfully created assessment:", data);
      queryClient.invalidateQueries({ queryKey: ["/api/clients", clientId, "risk-assessments"] });
      toast({ title: "Risk assessment created successfully" });
      setIsCreateDialogOpen(false);
      createForm.reset();
    },
    onError: (error) => {
      console.error("[RiskAssessment] Failed to create assessment:", error);
      toast({ title: "Failed to create risk assessment", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (assessmentId: string) => {
      return await apiRequest(`/api/risk-assessments/${assessmentId}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", clientId, "risk-assessments"] });
      toast({ title: "Risk assessment deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete risk assessment", variant: "destructive" });
    },
  });

  const saveResponsesMutation = useMutation({
    mutationFn: async ({ assessmentId, responses }: { assessmentId: string; responses: any[] }) => {
      return await apiRequest(`/api/risk-assessments/${assessmentId}/responses`, "POST", { responses });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/risk-assessments", selectedAssessmentId] });
      toast({ title: "Responses saved successfully" });
    },
    onError: () => {
      toast({ title: "Failed to save responses", variant: "destructive" });
    },
  });

  const [responses, setResponses] = useState<Record<string, string>>({});

  const handleResponseChange = (questionKey: string, value: string) => {
    setResponses((prev) => ({ ...prev, [questionKey]: value }));
  };

  const handleSaveResponses = () => {
    if (!selectedAssessmentId) return;

    const responsesArray = Object.entries(responses).map(([questionKey, response]) => ({
      questionKey,
      response: response as "yes" | "no" | "na",
    })).filter(r => r.response);

    saveResponsesMutation.mutate({ assessmentId: selectedAssessmentId, responses: responsesArray });
  };

  const getRiskLevelBadge = (level: string | null) => {
    if (!level) return null;
    const colors = {
      low: "bg-green-500",
      medium: "bg-yellow-500",
      high: "bg-red-500",
    };
    return (
      <Badge className={`${colors[level as keyof typeof colors]} text-white`} data-testid={`badge-risk-${level}`}>
        {level.toUpperCase()}
      </Badge>
    );
  };

  const renderQuestion = (question: typeof riskQuestionsSections[0]['questions'][0]) => {
    const existingResponse = selectedAssessment?.responses?.find(r => r.questionKey === question.key);
    const value = responses[question.key] || existingResponse?.response || "";

    return (
      <RadioGroup 
        value={value} 
        onValueChange={(val) => handleResponseChange(question.key, val)}
        data-testid={`radio-${question.key}`}
      >
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="yes" id={`${question.key}-yes`} data-testid={`radio-${question.key}-yes`} />
          <Label htmlFor={`${question.key}-yes`}>Yes</Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="no" id={`${question.key}-no`} data-testid={`radio-${question.key}-no`} />
          <Label htmlFor={`${question.key}-no`}>No</Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="na" id={`${question.key}-na`} data-testid={`radio-${question.key}-na`} />
          <Label htmlFor={`${question.key}-na`}>N/A</Label>
        </div>
      </RadioGroup>
    );
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              <CardTitle>Risk Assessments</CardTitle>
            </div>
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" data-testid="button-create-assessment">
                  <Plus className="w-4 h-4 mr-2" />
                  New Assessment
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New Risk Assessment</DialogTitle>
                  <DialogDescription>
                    Create a new risk assessment for this client. You can add detailed responses after creation.
                  </DialogDescription>
                </DialogHeader>
                <Form {...createForm}>
                  <form onSubmit={createForm.handleSubmit((data) => createMutation.mutate(data))} className="space-y-4">
                    <FormField
                      control={createForm.control}
                      name="version"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Version/Year</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="e.g., 2024/25" data-testid="input-version" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={createForm.control}
                      name="initialDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Initial Date</FormLabel>
                          <FormControl>
                            <Input 
                              type="date" 
                              value={field.value ? new Date(field.value).toISOString().split('T')[0] : ''}
                              onChange={(e) => field.onChange(new Date(e.target.value))}
                              data-testid="input-initial-date" 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={createForm.control}
                      name="riskLevel"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Overall Risk Level</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value || undefined}>
                            <FormControl>
                              <SelectTrigger data-testid="select-overall-risk">
                                <SelectValue placeholder="Select risk level" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="low">Low</SelectItem>
                              <SelectItem value="medium">Medium</SelectItem>
                              <SelectItem value="high">High</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={createForm.control}
                      name="generalInformation"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>General Information (Optional)</FormLabel>
                          <FormControl>
                            <Textarea {...field} value={field.value || ""} placeholder="Any additional information..." data-testid="textarea-general-info" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)} data-testid="button-cancel-create">
                        Cancel
                      </Button>
                      <Button type="submit" disabled={createMutation.isPending} data-testid="button-submit-create">
                        {createMutation.isPending ? "Creating..." : "Create Assessment"}
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>
          <CardDescription>
            Track and manage risk assessments for this client. Create annual reviews and maintain compliance records.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Loading assessments...</p>
          ) : assessments && assessments.length > 0 ? (
            <div className="space-y-3">
              {assessments.map((assessment) => (
                <Card key={assessment.id} className="p-4" data-testid={`card-assessment-${assessment.id}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <p className="font-medium" data-testid={`text-assessment-version-${assessment.id}`}>
                          Version: {assessment.version}
                        </p>
                        {getRiskLevelBadge(assessment.riskLevel)}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="w-4 h-4" />
                        <span data-testid={`text-assessment-date-${assessment.id}`}>
                          {assessment.initialDate ? new Date(assessment.initialDate).toLocaleDateString('en-GB', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric'
                          }) : 'No date'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedAssessmentId(assessment.id);
                          setResponses({});
                          setIsViewDialogOpen(true);
                        }}
                        data-testid={`button-view-${assessment.id}`}
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        View
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => deleteMutation.mutate(assessment.id)}
                        disabled={deleteMutation.isPending}
                        data-testid={`button-delete-${assessment.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Shield className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No risk assessments yet</p>
              <p className="text-sm mt-1">Create your first assessment to get started</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Risk Assessment Details</DialogTitle>
            <DialogDescription>
              Review and update risk assessment responses
            </DialogDescription>
          </DialogHeader>
          {isLoadingAssessment ? (
            <p>Loading assessment...</p>
          ) : selectedAssessment ? (
            <div className="space-y-6">
              <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                <div>
                  <p className="font-medium">Version: {selectedAssessment.version}</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedAssessment.initialDate ? new Date(selectedAssessment.initialDate).toLocaleDateString('en-GB') : 'No date'}
                  </p>
                </div>
                {getRiskLevelBadge(selectedAssessment.riskLevel)}
              </div>

              <Accordion type="single" collapsible className="w-full">
                {riskQuestionsSections.map((section) => (
                  <AccordionItem key={section.id} value={section.id}>
                    <AccordionTrigger data-testid={`accordion-${section.id}`}>
                      <span className="font-semibold">{section.title}</span>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-4 pt-2">
                        {section.questions.map((question) => (
                          <div key={question.key} className="space-y-2">
                            <Label className="text-sm font-medium">{question.text}</Label>
                            {renderQuestion(question)}
                          </div>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>

              {selectedAssessment.generalInformation && (
                <div className="p-4 bg-muted rounded-lg">
                  <Label className="text-sm font-medium">General Information</Label>
                  <p className="mt-2 text-sm">{selectedAssessment.generalInformation}</p>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => setIsViewDialogOpen(false)}
                  data-testid="button-close-view"
                >
                  Close
                </Button>
                <Button
                  onClick={handleSaveResponses}
                  disabled={saveResponsesMutation.isPending}
                  data-testid="button-save-responses"
                >
                  {saveResponsesMutation.isPending ? "Saving..." : "Save Responses"}
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
