import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ShieldCheck, Eye, CheckCircle2, XCircle, Calendar, Hash, Type, ListChecks } from "lucide-react";
import type { ProjectWithRelations, StageApprovalResponse, StageApprovalField, StageApproval } from "@shared/schema";
import { format } from "date-fns";

interface ApprovalResponseWithField extends StageApprovalResponse {
  field: StageApprovalField & {
    stageApproval?: StageApproval;
  };
}

interface ApprovalResponsesCardProps {
  projects: ProjectWithRelations[] | undefined;
}

interface GroupedApproval {
  projectId: string;
  projectName: string;
  approvalName: string;
  stageName: string;
  responses: ApprovalResponseWithField[];
}

export function ApprovalResponsesCard({ projects }: ApprovalResponsesCardProps) {
  const [selectedApproval, setSelectedApproval] = useState<GroupedApproval | null>(null);

  const groupedApprovals: GroupedApproval[] = [];

  projects?.forEach((project) => {
    if (!project.stageApprovalResponses || project.stageApprovalResponses.length === 0) {
      return;
    }

    const byApproval = new Map<string, ApprovalResponseWithField[]>();
    project.stageApprovalResponses.forEach((response) => {
      const approvalId = response.field.stageApprovalId;
      if (!byApproval.has(approvalId)) {
        byApproval.set(approvalId, []);
      }
      byApproval.get(approvalId)!.push(response as ApprovalResponseWithField);
    });

    byApproval.forEach((responses, approvalId) => {
      const firstResponse = responses[0];
      const approvalName = firstResponse.field.stageApproval?.name || "Approval";
      
      groupedApprovals.push({
        projectId: project.id,
        projectName: project.description,
        approvalName,
        stageName: project.currentStatus || "",
        responses,
      });
    });
  });

  if (groupedApprovals.length === 0) {
    return null;
  }

  const formatValue = (response: ApprovalResponseWithField): string => {
    const { field } = response;
    switch (field.fieldType) {
      case "boolean":
        return response.valueBoolean === true ? "Yes" : response.valueBoolean === false ? "No" : "-";
      case "number":
        return response.valueNumber !== null && response.valueNumber !== undefined 
          ? response.valueNumber.toString() 
          : "-";
      case "short_text":
        return response.valueShortText || "-";
      case "long_text":
        return response.valueLongText 
          ? (response.valueLongText.length > 50 
              ? response.valueLongText.substring(0, 50) + "..." 
              : response.valueLongText)
          : "-";
      case "single_select":
        return response.valueSingleSelect || "-";
      case "multi_select":
        return response.valueMultiSelect?.join(", ") || "-";
      case "date":
        return response.valueDate 
          ? format(new Date(response.valueDate), "dd MMM yyyy") 
          : "-";
      default:
        return "-";
    }
  };

  const getFieldIcon = (fieldType: string) => {
    switch (fieldType) {
      case "boolean":
        return <CheckCircle2 className="h-4 w-4" />;
      case "number":
        return <Hash className="h-4 w-4" />;
      case "short_text":
      case "long_text":
        return <Type className="h-4 w-4" />;
      case "single_select":
      case "multi_select":
        return <ListChecks className="h-4 w-4" />;
      case "date":
        return <Calendar className="h-4 w-4" />;
      default:
        return <Type className="h-4 w-4" />;
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5" />
            Stage Approval Responses
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Project</TableHead>
                  <TableHead>Approval</TableHead>
                  <TableHead>Fields</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groupedApprovals.map((approval, index) => (
                  <TableRow key={`${approval.projectId}-${index}`} data-testid={`row-approval-${approval.projectId}-${index}`}>
                    <TableCell className="font-medium">
                      <span data-testid={`text-project-name-${approval.projectId}`}>
                        {approval.projectName}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm" data-testid={`text-approval-name-${approval.projectId}-${index}`}>
                        {approval.approvalName}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-xs">
                        {approval.responses.length} field{approval.responses.length !== 1 ? "s" : ""}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => setSelectedApproval(approval)}
                        data-testid={`button-view-approval-${approval.projectId}-${index}`}
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!selectedApproval} onOpenChange={(open) => !open && setSelectedApproval(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5" />
              {selectedApproval?.approvalName}
            </DialogTitle>
            <p className="text-sm text-muted-foreground">
              Project: {selectedApproval?.projectName}
            </p>
          </DialogHeader>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
            {selectedApproval?.responses.map((response) => (
              <div 
                key={response.id} 
                className="p-4 border rounded-lg bg-muted/30"
                data-testid={`response-field-${response.id}`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-1.5 rounded-md bg-primary/10 text-primary">
                    {getFieldIcon(response.field.fieldType)}
                  </div>
                  <span className="font-medium text-sm">
                    {response.field.fieldName}
                  </span>
                </div>
                <div className="text-sm pl-8">
                  {response.field.fieldType === "boolean" ? (
                    <div className="flex items-center gap-2">
                      {response.valueBoolean === true ? (
                        <>
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                          <span className="text-green-700 dark:text-green-400">Yes</span>
                        </>
                      ) : response.valueBoolean === false ? (
                        <>
                          <XCircle className="h-4 w-4 text-red-600" />
                          <span className="text-red-700 dark:text-red-400">No</span>
                        </>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </div>
                  ) : response.field.fieldType === "multi_select" && response.valueMultiSelect ? (
                    <div className="flex flex-wrap gap-1">
                      {response.valueMultiSelect.map((val, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">
                          {val}
                        </Badge>
                      ))}
                    </div>
                  ) : response.field.fieldType === "long_text" && response.valueLongText ? (
                    <p className="text-muted-foreground whitespace-pre-wrap">
                      {response.valueLongText}
                    </p>
                  ) : (
                    <span className="text-muted-foreground">
                      {formatValue(response)}
                    </span>
                  )}
                </div>
                {response.field.description && (
                  <p className="text-xs text-muted-foreground mt-2 pl-8 italic">
                    {response.field.description}
                  </p>
                )}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
