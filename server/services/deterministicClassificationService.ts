interface DeterministicRule {
  id: string;
  name: string;
  description: string;
  pattern: RegExp | null;
  field: 'subject' | 'body' | 'attachments' | 'sender';
  sets: {
    requires_task_floor?: boolean;
    requires_reply_floor?: boolean;
  };
  priority: number;
}

interface TriggeredRule {
  ruleId: string;
  ruleName: string;
  matchedText?: string;
  explanation: string;
}

export interface DeterministicResult {
  requires_task_floor: boolean;
  requires_reply_floor: boolean;
  triggered_rules: TriggeredRule[];
  evaluated_at: Date;
}

interface EmailToClassify {
  subject: string;
  body: string;
  hasAttachments: boolean;
  senderEmail: string;
  senderName?: string;
}

const DETERMINISTIC_RULES: DeterministicRule[] = [
  {
    id: 'DEADLINE_ASAP',
    name: 'Deadline: ASAP',
    description: 'Contains urgent deadline language',
    pattern: /\b(asap|urgent|urgently|immediately|right away)\b/i,
    field: 'body',
    sets: { requires_reply_floor: true, requires_task_floor: true },
    priority: 30
  },
  {
    id: 'DEADLINE_DATE',
    name: 'Deadline: Specific Date',
    description: 'Contains date references',
    pattern: /\b(by|before|due|deadline)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow|next week|\d{1,2}\/\d{1,2}|\d{1,2}(st|nd|rd|th))\b/i,
    field: 'body',
    sets: { requires_reply_floor: true },
    priority: 25
  },
  {
    id: 'REQUEST_CAN_YOU',
    name: 'Request: Can you',
    description: 'Contains explicit request phrase',
    pattern: /\b(can you|could you|would you|will you)\b/i,
    field: 'body',
    sets: { requires_reply_floor: true, requires_task_floor: true },
    priority: 20
  },
  {
    id: 'REQUEST_PLEASE',
    name: 'Request: Please',
    description: 'Contains please + action verb',
    pattern: /\bplease\s+(advise|confirm|send|provide|let me know|update|review|check)\b/i,
    field: 'body',
    sets: { requires_reply_floor: true, requires_task_floor: true },
    priority: 20
  },
  {
    id: 'HAS_ATTACHMENTS',
    name: 'Has Attachments',
    description: 'Email includes file attachments',
    pattern: null,
    field: 'attachments',
    sets: { requires_task_floor: true },
    priority: 15
  },
  {
    id: 'QUESTION_MARK',
    name: 'Contains Question',
    description: 'Email body or subject contains question marks',
    pattern: /\?/,
    field: 'body',
    sets: { requires_reply_floor: true },
    priority: 10
  },
  {
    id: 'ACKNOWLEDGEMENT_ONLY',
    name: 'Acknowledgement Only',
    description: 'Email is a simple acknowledgement',
    pattern: /^[\s]*(thanks|thank you|noted|all good|got it|received|perfect|great|ok|okay|cheers|ta|thx)[\.\!\s]*$/i,
    field: 'body',
    sets: { requires_reply_floor: false, requires_task_floor: false },
    priority: 5
  }
];

function stripSignature(body: string): string {
  const signaturePatterns = [
    /^--\s*$/m,
    /^Regards,?\s*$/mi,
    /^Best regards,?\s*$/mi,
    /^Kind regards,?\s*$/mi,
    /^Thanks,?\s*$/mi,
    /^Cheers,?\s*$/mi,
    /^Sent from my (iPhone|iPad|Android|Samsung|phone)/mi,
    /^Get Outlook for/mi,
  ];
  
  let strippedBody = body;
  for (const pattern of signaturePatterns) {
    const match = strippedBody.search(pattern);
    if (match !== -1) {
      strippedBody = strippedBody.substring(0, match);
    }
  }
  
  return strippedBody.trim();
}

function evaluateRule(rule: DeterministicRule, email: EmailToClassify): { matched: boolean; matchedText?: string } {
  if (rule.field === 'attachments') {
    return { matched: email.hasAttachments };
  }

  if (!rule.pattern) {
    return { matched: false };
  }

  let textToCheck = '';
  if (rule.field === 'body') {
    textToCheck = stripSignature(email.body);
  } else if (rule.field === 'subject') {
    textToCheck = email.subject;
  } else if (rule.field === 'sender') {
    textToCheck = email.senderEmail;
  }

  const match = textToCheck.match(rule.pattern);
  if (match) {
    return { matched: true, matchedText: match[0] };
  }

  return { matched: false };
}

export function runDeterministicClassification(email: EmailToClassify): DeterministicResult {
  const sortedRules = [...DETERMINISTIC_RULES].sort((a, b) => b.priority - a.priority);
  
  let requires_task_floor = false;
  let requires_reply_floor = false;
  const triggered_rules: TriggeredRule[] = [];

  const bodyStripped = stripSignature(email.body);
  const isAcknowledgementOnly = DETERMINISTIC_RULES
    .find(r => r.id === 'ACKNOWLEDGEMENT_ONLY')
    ?.pattern?.test(bodyStripped) ?? false;

  for (const rule of sortedRules) {
    if (isAcknowledgementOnly && rule.id !== 'ACKNOWLEDGEMENT_ONLY') {
      continue;
    }

    const { matched, matchedText } = evaluateRule(rule, email);

    if (matched) {
      if (rule.sets.requires_task_floor === true) {
        requires_task_floor = true;
      }
      if (rule.sets.requires_reply_floor === true) {
        requires_reply_floor = true;
      }

      triggered_rules.push({
        ruleId: rule.id,
        ruleName: rule.name,
        matchedText,
        explanation: rule.description
      });
    }
  }

  if (isAcknowledgementOnly) {
    triggered_rules.push({
      ruleId: 'ACKNOWLEDGEMENT_ONLY',
      ruleName: 'Acknowledgement Only',
      explanation: 'Email is a simple acknowledgement - no action required'
    });
  }

  return {
    requires_task_floor,
    requires_reply_floor,
    triggered_rules,
    evaluated_at: new Date()
  };
}

export function getDeterministicRules(): DeterministicRule[] {
  return DETERMINISTIC_RULES;
}
