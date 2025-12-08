import { AIFunctionCall } from '../types';

export interface ActionCardProps {
  functionCall: AIFunctionCall;
  onComplete: (success: boolean, message: string) => void;
  onDismiss: () => void;
}
