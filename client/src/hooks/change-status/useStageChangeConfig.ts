import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { StageChangeConfig } from "@/types/changeStatus";
import type {
  KanbanStage,
  ChangeReason,
  ReasonCustomField,
  StageApproval,
  StageApprovalField,
} from "@shared/schema";

interface UseStageChangeConfigParams {
  projectId: string;
  isOpen: boolean;
}

interface StageWithReasons extends KanbanStage {
  validReasonIds: string[];
}

interface ReasonWithCustomFields extends ChangeReason {
  customFields: ReasonCustomField[];
}

export interface UseStageChangeConfigResult {
  config: StageChangeConfig | undefined;
  isLoading: boolean;
  stages: StageWithReasons[];
  stageApprovals: StageApproval[];
  stageApprovalFields: StageApprovalField[];
  allReasons: ReasonWithCustomFields[];
  getFilteredReasons: (selectedStage: StageWithReasons | undefined) => ReasonWithCustomFields[];
  getSelectedStage: (newStatus: string) => StageWithReasons | undefined;
  getSelectedReason: (filteredReasons: ReasonWithCustomFields[], changeReason: string) => ReasonWithCustomFields | undefined;
  getCustomFields: (selectedReason: ReasonWithCustomFields | undefined) => ReasonCustomField[];
  getEffectiveApprovalId: (selectedReason: ReasonWithCustomFields | undefined, selectedStage: StageWithReasons | undefined) => string | null;
  getTargetStageApproval: (effectiveApprovalId: string | null) => StageApproval | null;
  getTargetStageApprovalFields: (targetStageApproval: StageApproval | null) => StageApprovalField[];
  refetch: () => void;
}

export function useStageChangeConfig({
  projectId,
  isOpen,
}: UseStageChangeConfigParams): UseStageChangeConfigResult {
  const { data: config, isLoading, refetch } = useQuery<StageChangeConfig>({
    queryKey: ["/api/projects", projectId, "stage-change-config"],
    enabled: !!projectId && isOpen,
    staleTime: 5 * 60 * 1000,
  });

  const stages = useMemo(() => config?.stages ?? [], [config?.stages]);
  const stageApprovals = useMemo(() => config?.stageApprovals ?? [], [config?.stageApprovals]);
  const stageApprovalFields = useMemo(() => config?.stageApprovalFields ?? [], [config?.stageApprovalFields]);
  const allReasons = useMemo(() => config?.reasons ?? [], [config?.reasons]);

  const getSelectedStage = (newStatus: string): StageWithReasons | undefined => {
    return stages.find((stage) => stage.name === newStatus);
  };

  const getFilteredReasons = (selectedStage: StageWithReasons | undefined): ReasonWithCustomFields[] => {
    if (!selectedStage) return [];
    const validIds = new Set(selectedStage.validReasonIds);
    return allReasons.filter((r) => validIds.has(r.id));
  };

  const getSelectedReason = (
    filteredReasons: ReasonWithCustomFields[],
    changeReason: string
  ): ReasonWithCustomFields | undefined => {
    return filteredReasons.find((reason) => reason.reason === changeReason);
  };

  const getCustomFields = (selectedReason: ReasonWithCustomFields | undefined): ReasonCustomField[] => {
    return selectedReason?.customFields ?? [];
  };

  const getEffectiveApprovalId = (
    selectedReason: ReasonWithCustomFields | undefined,
    selectedStage: StageWithReasons | undefined
  ): string | null => {
    // Prioritize stage's stageApprovalId (which may be client-overridden) over reason's
    // This matches the backend logic for client-specific approval overrides
    return selectedStage?.stageApprovalId || selectedReason?.stageApprovalId || null;
  };

  const getTargetStageApproval = (effectiveApprovalId: string | null): StageApproval | null => {
    if (!effectiveApprovalId) return null;
    return stageApprovals.find((a) => a.id === effectiveApprovalId) || null;
  };

  const getTargetStageApprovalFields = (targetStageApproval: StageApproval | null): StageApprovalField[] => {
    if (!targetStageApproval) return [];
    return stageApprovalFields
      .filter((field) => field.stageApprovalId === targetStageApproval.id)
      .sort((a, b) => a.order - b.order);
  };

  return {
    config,
    isLoading,
    stages,
    stageApprovals,
    stageApprovalFields,
    allReasons,
    getFilteredReasons,
    getSelectedStage,
    getSelectedReason,
    getCustomFields,
    getEffectiveApprovalId,
    getTargetStageApproval,
    getTargetStageApprovalFields,
    refetch,
  };
}
