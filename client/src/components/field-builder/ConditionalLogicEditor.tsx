import { useState, useEffect } from "react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ConditionalLogic, ConditionalLogicCondition } from "./types";

export interface QuestionReference {
  id: string;
  label: string;
  questionType: string;
  options?: string[] | null;
}

export interface ConditionalLogicEditorProps {
  conditionalLogic: ConditionalLogic | null | undefined;
  onChange: (logic: ConditionalLogic | null) => void;
  previousQuestions: QuestionReference[];
  disabled?: boolean;
  className?: string;
}

const CONDITION_OPERATORS = [
  { value: "equals", label: "Equals" },
  { value: "not_equals", label: "Does not equal" },
  { value: "contains", label: "Contains" },
  { value: "is_empty", label: "Is empty" },
  { value: "is_not_empty", label: "Is not empty" },
] as const;

const QUESTION_TYPES_WITH_OPTIONS = [
  "single_choice", "single_select",
  "multi_choice", "multi_select",
  "dropdown",
  "yes_no", "boolean"
];

export function ConditionalLogicEditor({
  conditionalLogic,
  onChange,
  previousQuestions,
  disabled = false,
  className,
}: ConditionalLogicEditorProps) {
  const [enabled, setEnabled] = useState(!!conditionalLogic?.showIf);

  useEffect(() => {
    setEnabled(!!conditionalLogic?.showIf);
  }, [conditionalLogic]);

  if (previousQuestions.length === 0) {
    return null;
  }

  const handleToggle = (checked: boolean) => {
    setEnabled(checked);
    if (!checked) {
      onChange(null);
    } else if (!conditionalLogic?.showIf && previousQuestions.length > 0) {
      onChange({
        showIf: {
          questionId: previousQuestions[0].id,
          operator: "equals",
          value: "",
        },
      });
    }
  };

  const handleConditionChange = (
    field: keyof ConditionalLogicCondition,
    value: any
  ) => {
    onChange({
      ...conditionalLogic,
      showIf: {
        questionId: conditionalLogic?.showIf?.questionId || previousQuestions[0]?.id || "",
        operator: conditionalLogic?.showIf?.operator || "equals",
        ...conditionalLogic?.showIf,
        [field]: value,
      },
    });
  };

  const selectedSourceQuestion = previousQuestions.find(
    (q) => q.id === conditionalLogic?.showIf?.questionId
  );

  const sourceQuestionHasOptions =
    selectedSourceQuestion &&
    QUESTION_TYPES_WITH_OPTIONS.includes(selectedSourceQuestion.questionType);

  const showValueInput =
    conditionalLogic?.showIf?.operator &&
    !["is_empty", "is_not_empty"].includes(conditionalLogic.showIf.operator);

  return (
    <div className={className}>
      <div className="border-t pt-4 mt-4">
        <div className="flex items-center gap-2 mb-3">
          <Switch
            id="conditional-logic-toggle"
            checked={enabled}
            onCheckedChange={handleToggle}
            disabled={disabled}
            data-testid="switch-conditional-logic"
          />
          <Label
            htmlFor="conditional-logic-toggle"
            className="text-sm font-medium"
          >
            Show this question only if...
          </Label>
        </div>

        {enabled && conditionalLogic?.showIf && (
          <div className="space-y-3 pl-4 border-l-2 border-primary/20">
            <div>
              <Label className="text-xs text-muted-foreground">
                When this question
              </Label>
              <Select
                value={conditionalLogic.showIf.questionId}
                onValueChange={(value) =>
                  handleConditionChange("questionId", value)
                }
                disabled={disabled}
              >
                <SelectTrigger
                  className="mt-1"
                  data-testid="select-condition-question"
                >
                  <SelectValue placeholder="Select a question" />
                </SelectTrigger>
                <SelectContent>
                  {previousQuestions.map((q) => (
                    <SelectItem key={q.id} value={q.id}>
                      {q.label || "Untitled question"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">Condition</Label>
              <Select
                value={conditionalLogic.showIf.operator}
                onValueChange={(value) =>
                  handleConditionChange("operator", value)
                }
                disabled={disabled}
              >
                <SelectTrigger
                  className="mt-1"
                  data-testid="select-condition-operator"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONDITION_OPERATORS.map((op) => (
                    <SelectItem key={op.value} value={op.value}>
                      {op.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {showValueInput && (
              <div>
                <Label className="text-xs text-muted-foreground">Value</Label>
                {sourceQuestionHasOptions ? (
                  <Select
                    value={String(conditionalLogic.showIf.value || "")}
                    onValueChange={(value) =>
                      handleConditionChange("value", value)
                    }
                    disabled={disabled}
                  >
                    <SelectTrigger
                      className="mt-1"
                      data-testid="select-condition-value"
                    >
                      <SelectValue placeholder="Select value" />
                    </SelectTrigger>
                    <SelectContent>
                      {selectedSourceQuestion?.questionType === "yes_no" ||
                      selectedSourceQuestion?.questionType === "boolean" ? (
                        <>
                          <SelectItem value="yes">Yes</SelectItem>
                          <SelectItem value="no">No</SelectItem>
                        </>
                      ) : (
                        selectedSourceQuestion?.options?.map((opt, i) => (
                          <SelectItem key={i} value={opt}>
                            {opt}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    className="mt-1"
                    value={String(conditionalLogic.showIf.value || "")}
                    onChange={(e) =>
                      handleConditionChange("value", e.target.value)
                    }
                    placeholder="Enter value to match"
                    disabled={disabled}
                    data-testid="input-condition-value"
                  />
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default ConditionalLogicEditor;
