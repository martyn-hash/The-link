import { Router, Request, Response } from "express";
import multer from "multer";
import { storage } from "../storage/index";
import { processAIMagicChat, fuzzyMatchClients, fuzzyMatchUsers, fuzzyMatchPeople, chatRequestSchema } from "../services/ai-magic-service";

const router = Router();

const audioUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB max (Whisper API limit)
  },
});

async function transcribeAudio(audioBuffer: Buffer, filename: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OpenAI API key not configured");
  }

  const formData = new FormData();
  const audioBlob = new Blob([audioBuffer], { type: "audio/webm" });
  formData.append("file", audioBlob, filename);
  formData.append("model", "whisper-1");
  formData.append("language", "en");

  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("[AI] Whisper API error:", error);
    throw new Error(`Transcription failed: ${response.status}`);
  }

  const result = await response.json();
  return result.text;
}

async function processWithGPT(
  transcription: string,
  systemPrompt: string,
  isEmail: boolean
): Promise<{ content: string; subject?: string }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OpenAI API key not configured");
  }

  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: transcription },
  ];

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages,
      temperature: 0.7,
      max_tokens: 2000,
      ...(isEmail && {
        response_format: { type: "json_object" },
      }),
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("[AI] GPT API error:", error);
    throw new Error(`AI processing failed: ${response.status}`);
  }

  const result = await response.json();
  const content = result.choices[0]?.message?.content || "";

  if (isEmail) {
    try {
      const parsed = JSON.parse(content);
      return {
        subject: parsed.subject || "",
        content: parsed.body || parsed.content || content,
      };
    } catch (e) {
      console.error("[AI] Failed to parse email JSON:", e);
      return { content };
    }
  }

  return { content };
}

export function registerAIRoutes(
  app: any,
  isAuthenticated: any,
  resolveEffectiveUser: any
) {
  router.post(
    "/audio/notes",
    isAuthenticated,
    resolveEffectiveUser,
    audioUpload.single("audio"),
    async (req: Request, res: Response) => {
      try {
        if (!req.file) {
          return res.status(400).json({ error: "No audio file provided" });
        }

        console.log("[AI] Processing audio for notes, size:", req.file.size);

        // Get system prompt from company settings
        const settings = await storage.getCompanySettings();
        const systemPrompt =
          settings?.aiSystemPromptNotes ||
          "You are a professional assistant that converts spoken audio into clear, well-structured notes. Create a concise summary with bullet points for key information. Focus on action items, important details, and main points discussed.";

        // Transcribe audio
        const transcription = await transcribeAudio(
          req.file.buffer,
          req.file.originalname || "recording.webm"
        );
        console.log("[AI] Transcription complete, length:", transcription.length);

        // Process with GPT
        const result = await processWithGPT(transcription, systemPrompt, false);
        console.log("[AI] Notes processing complete");

        res.json({
          success: true,
          transcription,
          content: result.content,
        });
      } catch (error: any) {
        console.error("[AI] Error processing audio for notes:", error);
        res.status(500).json({
          error: error.message || "Failed to process audio",
        });
      }
    }
  );

  router.post(
    "/audio/email",
    isAuthenticated,
    resolveEffectiveUser,
    audioUpload.single("audio"),
    async (req: Request, res: Response) => {
      try {
        if (!req.file) {
          return res.status(400).json({ error: "No audio file provided" });
        }

        // Extract context from request body (passed as form data fields)
        const { recipientNames, senderName, clientCompany } = req.body;

        console.log("[AI] Processing audio for email, size:", req.file.size);
        if (recipientNames || senderName || clientCompany) {
          console.log("[AI] Context - Recipients:", recipientNames, "Sender:", senderName, "Company:", clientCompany);
        }

        // Get system prompt from company settings
        const settings = await storage.getCompanySettings();
        let systemPrompt =
          settings?.aiSystemPromptEmails ||
          `You are a professional assistant that helps draft client emails from spoken notes. 
Convert the audio transcription into a well-written, professional email.

FORMATTING REQUIREMENTS:
- Structure the email with clear paragraph breaks between distinct thoughts or topics
- Use HTML paragraph tags (<p>) to separate paragraphs naturally
- Avoid long run-on sentences - break content into digestible paragraphs of 2-3 sentences each
- Start with a greeting, then body paragraphs, then a professional sign-off

You must respond with valid JSON in this exact format:
{
  "subject": "A clear, concise email subject line",
  "body": "The full email body with proper HTML paragraph formatting (<p> tags)"
}
Do not include any text outside the JSON object.`;

        // Add personalization context if provided
        let contextSection = "";
        if (recipientNames || senderName || clientCompany) {
          contextSection = "\n\n--- PERSONALIZATION CONTEXT ---";
          if (recipientNames) {
            contextSection += `\nRecipient name(s): ${recipientNames} - Address them by name in the greeting`;
          }
          if (senderName) {
            contextSection += `\nSender's name: ${senderName} - Use this name in the sign-off`;
          }
          if (clientCompany) {
            contextSection += `\nClient company: ${clientCompany} - You may reference this if contextually appropriate`;
          }
          contextSection += "\n--- END OF CONTEXT ---";
          contextSection += "\n\nIMPORTANT: Use the actual names provided above. Do NOT use placeholders like [Name] or {name}.";
          systemPrompt += contextSection;
        }

        // Transcribe audio
        const transcription = await transcribeAudio(
          req.file.buffer,
          req.file.originalname || "recording.webm"
        );
        console.log("[AI] Transcription complete, length:", transcription.length);

        // Process with GPT (email mode)
        const result = await processWithGPT(transcription, systemPrompt, true);
        console.log("[AI] Email processing complete");

        res.json({
          success: true,
          transcription,
          subject: result.subject || "",
          content: result.content,
        });
      } catch (error: any) {
        console.error("[AI] Error processing audio for email:", error);
        res.status(500).json({
          error: error.message || "Failed to process audio",
        });
      }
    }
  );

  // Stage change notification AI processing with stage approval context
  router.post(
    "/audio/stage-notification",
    isAuthenticated,
    resolveEffectiveUser,
    audioUpload.single("audio"),
    async (req: Request, res: Response) => {
      try {
        if (!req.file) {
          return res.status(400).json({ error: "No audio file provided" });
        }

        const { projectId, existingSubject, existingBody, recipientNames, senderName, clientCompany } = req.body;
        if (!projectId) {
          return res.status(400).json({ error: "Project ID is required" });
        }

        console.log("[AI] Processing audio for stage notification, project:", projectId, "size:", req.file.size);
        if (recipientNames || senderName || clientCompany) {
          console.log("[AI] Context - Recipients:", recipientNames, "Sender:", senderName, "Company:", clientCompany);
        }

        // Fetch the most recent stage approval responses for context
        const stageApprovalContext = await getStageApprovalContext(projectId);
        console.log("[AI] Stage approval context:", stageApprovalContext);

        // Get system prompt from company settings
        const settings = await storage.getCompanySettings();
        const basePrompt = settings?.aiSystemPromptStageNotifications ||
          `You are a professional assistant drafting client notifications about project progress for an accounting/bookkeeping firm.
Your task is to convert the spoken audio into a professional email notification to send to the client about their project status.
When "Completed Work Items" are provided, naturally incorporate them into the message to highlight what has been accomplished.
Use a friendly but professional tone that celebrates progress and keeps clients informed.

FORMATTING REQUIREMENTS:
- Structure the email with clear paragraph breaks between distinct thoughts or topics
- Use HTML paragraph tags (<p>) to separate paragraphs naturally
- Avoid long run-on sentences - break content into digestible paragraphs of 2-3 sentences each
- Start with a greeting, then body paragraphs, then a professional sign-off

You must respond with valid JSON in this exact format:
{
  "subject": "A clear, concise email subject line about the project update",
  "body": "The full email body with proper HTML paragraph formatting (<p> tags)",
  "pushTitle": "Short push notification title (max 50 chars)",
  "pushBody": "Brief push notification message (max 150 chars)"
}
Do not include any text outside the JSON object.`;

        // Build the full prompt with stage approval context
        let fullSystemPrompt = basePrompt;
        
        // Add personalization context if provided
        if (recipientNames || senderName || clientCompany) {
          fullSystemPrompt += "\n\n--- PERSONALIZATION CONTEXT ---";
          if (recipientNames) {
            fullSystemPrompt += `\nRecipient name(s): ${recipientNames} - Address them by name in the greeting`;
          }
          if (senderName) {
            fullSystemPrompt += `\nSender's name: ${senderName} - Use this name in the sign-off`;
          }
          if (clientCompany) {
            fullSystemPrompt += `\nClient company: ${clientCompany} - You may reference this if contextually appropriate`;
          }
          fullSystemPrompt += "\n--- END OF CONTEXT ---";
          fullSystemPrompt += "\n\nIMPORTANT: Use the actual names provided above. Do NOT use placeholders like [Name] or {name}.";
        }
        
        if (stageApprovalContext) {
          fullSystemPrompt += `\n\n--- COMPLETED WORK ITEMS ---\n${stageApprovalContext}\n--- END OF COMPLETED WORK ITEMS ---`;
        }
        
        // Include existing email template with merge fields for context
        if (existingSubject || existingBody) {
          fullSystemPrompt += `\n\n--- EXISTING EMAIL TEMPLATE ---`;
          if (existingSubject) {
            fullSystemPrompt += `\nSubject: ${existingSubject}`;
          }
          if (existingBody) {
            fullSystemPrompt += `\nBody: ${existingBody}`;
          }
          fullSystemPrompt += `\n\nThe template above shows merge fields like {client_company_name}, {client_first_name}, {project_name}, {due_date}. 
You can use these merge fields in your response as they will be replaced with actual values. 
Incorporate elements from this template into your response if appropriate.`;
          fullSystemPrompt += `\n--- END OF EMAIL TEMPLATE ---`;
          console.log("[AI] Including existing email template for context");
        }

        // Transcribe audio
        const transcription = await transcribeAudio(
          req.file.buffer,
          req.file.originalname || "recording.webm"
        );
        console.log("[AI] Transcription complete, length:", transcription.length);

        // Process with GPT
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [
              { role: "system", content: fullSystemPrompt },
              { role: "user", content: transcription },
            ],
            temperature: 0.7,
            max_tokens: 2000,
            response_format: { type: "json_object" },
          }),
        });

        if (!response.ok) {
          const error = await response.text();
          console.error("[AI] GPT API error:", error);
          throw new Error(`AI processing failed: ${response.status}`);
        }

        const gptResult = await response.json();
        const content = gptResult.choices[0]?.message?.content || "";

        let parsed;
        try {
          parsed = JSON.parse(content);
        } catch (e) {
          console.error("[AI] Failed to parse stage notification JSON:", e);
          parsed = { subject: "", body: content, pushTitle: "", pushBody: "" };
        }

        console.log("[AI] Stage notification processing complete");

        res.json({
          success: true,
          transcription,
          subject: parsed.subject || "",
          body: parsed.body || "",
          pushTitle: parsed.pushTitle || "",
          pushBody: parsed.pushBody || "",
        });
      } catch (error: any) {
        console.error("[AI] Error processing audio for stage notification:", error);
        res.status(500).json({
          error: error.message || "Failed to process audio",
        });
      }
    }
  );

  // Text-based email generation/refinement for stage notifications
  // This allows users to generate new emails or refine existing content with a simple text prompt
  router.post(
    "/refine-email",
    isAuthenticated,
    resolveEffectiveUser,
    async (req: Request, res: Response) => {
      try {
        const { projectId, prompt, currentSubject, currentBody, recipientNames, senderName, clientCompany } = req.body;
        
        if (!prompt || !prompt.trim()) {
          return res.status(400).json({ error: "Prompt is required" });
        }

        // Determine if we're generating from scratch or refining existing content
        const isGenerating = !currentBody || !currentBody.trim();
        
        console.log("[AI] " + (isGenerating ? "Generating" : "Refining") + " email with text prompt for project:", projectId);
        console.log("[AI] Prompt:", prompt);
        if (recipientNames || senderName || clientCompany) {
          console.log("[AI] Context - Recipients:", recipientNames, "Sender:", senderName, "Company:", clientCompany);
        }

        // Fetch stage approval context if project ID provided
        let stageApprovalContext = null;
        if (projectId) {
          stageApprovalContext = await getStageApprovalContext(projectId);
        }

        // Get system prompt from company settings
        const settings = await storage.getCompanySettings();
        const basePrompt = settings?.aiSystemPromptStageNotifications ||
          `You are a professional assistant helping to compose client notification emails for an accounting/bookkeeping firm.`;

        // Build personalization context section
        let personalizationContext = "";
        if (recipientNames || senderName || clientCompany) {
          personalizationContext = "\n\n--- PERSONALIZATION CONTEXT ---";
          if (recipientNames) {
            personalizationContext += `\nRecipient name(s): ${recipientNames} - Address them by name in the greeting`;
          }
          if (senderName) {
            personalizationContext += `\nSender's name: ${senderName} - Use this name in the sign-off`;
          }
          if (clientCompany) {
            personalizationContext += `\nClient company: ${clientCompany} - You may reference this if contextually appropriate`;
          }
          personalizationContext += "\n--- END OF CONTEXT ---";
          personalizationContext += "\n\nIMPORTANT: Use the actual names provided above. Do NOT use placeholders like [Name] or {name}.";
        }

        // Build different prompts based on whether we're generating or refining
        let fullSystemPrompt: string;
        let userMessage: string;

        if (isGenerating) {
          // Generation mode: create new email from prompt
          fullSystemPrompt = `${basePrompt}

You are helping a staff member compose a new email to a client. They will provide instructions on what the email should say.

Create a professional, friendly email based on their instructions.

FORMATTING REQUIREMENTS:
- Structure the email with clear paragraph breaks between distinct thoughts or topics
- Use HTML paragraph tags (<p>) to separate paragraphs naturally
- Avoid long run-on sentences - break content into digestible paragraphs of 2-3 sentences each
- Start with a greeting, then body paragraphs, then a professional sign-off

You must respond with valid JSON in this exact format:
{
  "subject": "A clear, appropriate email subject line",
  "body": "The email body with proper HTML paragraph formatting (<p> tags)"
}
Do not include any text outside the JSON object.`;

          if (personalizationContext) {
            fullSystemPrompt += personalizationContext;
          }

          if (stageApprovalContext) {
            fullSystemPrompt += `\n\n--- COMPLETED WORK ITEMS (Available for context) ---\n${stageApprovalContext}\n--- END OF COMPLETED WORK ITEMS ---`;
          }

          userMessage = `--- EMAIL REQUEST ---
${prompt}
--- END OF REQUEST ---

Please compose an email based on the instructions above.`;
        } else {
          // Refinement mode: modify existing email
          fullSystemPrompt = `${basePrompt}

You are helping a staff member refine an existing email. They will provide:
1. The current email subject and body
2. Instructions on how to modify it

Apply their requested changes while maintaining a professional, friendly tone appropriate for client communications.

FORMATTING REQUIREMENTS:
- Structure the email with clear paragraph breaks between distinct thoughts or topics
- Use HTML paragraph tags (<p>) to separate paragraphs naturally
- Avoid long run-on sentences - break content into digestible paragraphs of 2-3 sentences each

You must respond with valid JSON in this exact format:
{
  "subject": "The refined email subject line",
  "body": "The refined email body with proper HTML paragraph formatting (<p> tags)"
}
Do not include any text outside the JSON object.`;

          if (personalizationContext) {
            fullSystemPrompt += personalizationContext;
          }

          if (stageApprovalContext) {
            fullSystemPrompt += `\n\n--- COMPLETED WORK ITEMS (Available for context) ---\n${stageApprovalContext}\n--- END OF COMPLETED WORK ITEMS ---`;
          }

          userMessage = `--- CURRENT EMAIL ---
Subject: ${currentSubject || "(No subject)"}
Body: ${currentBody}
--- END OF CURRENT EMAIL ---

--- REFINEMENT REQUEST ---
${prompt}
--- END OF REQUEST ---

Please refine the email according to the request above.`;
        }

        // Call GPT
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [
              { role: "system", content: fullSystemPrompt },
              { role: "user", content: userMessage },
            ],
            temperature: 0.7,
            max_tokens: 2000,
            response_format: { type: "json_object" },
          }),
        });

        if (!response.ok) {
          const error = await response.text();
          console.error("[AI] GPT API error:", error);
          throw new Error(`AI processing failed: ${response.status}`);
        }

        const gptResult = await response.json();
        const content = gptResult.choices[0]?.message?.content || "";

        let parsed;
        try {
          parsed = JSON.parse(content);
        } catch (e) {
          console.error("[AI] Failed to parse email JSON:", e);
          parsed = { subject: currentSubject || "", body: content };
        }

        console.log("[AI] Email " + (isGenerating ? "generation" : "refinement") + " complete");

        res.json({
          success: true,
          subject: parsed.subject || currentSubject || "",
          body: parsed.body || currentBody || "",
        });
      } catch (error: any) {
        console.error("[AI] Error processing email:", error);
        res.status(500).json({
          error: error.message || "Failed to process email",
        });
      }
    }
  );

  // AI Magic Chat endpoint - main interface for the AI Assistant
  router.post(
    "/chat",
    isAuthenticated,
    resolveEffectiveUser,
    async (req: any, res: Response) => {
      try {
        const userId = req.user?.effectiveUserId || req.user?.id;
        
        // Validate request body with Zod
        const parseResult = chatRequestSchema.safeParse(req.body);
        if (!parseResult.success) {
          return res.status(400).json({ 
            type: 'error',
            message: "Invalid request: " + parseResult.error.errors.map(e => e.message).join(', ')
          });
        }
        
        const { message, conversationHistory } = parseResult.data;

        // Get current user details
        const user = await storage.getUser(userId);
        if (!user) {
          return res.status(401).json({ 
            type: 'error',
            message: "User not found" 
          });
        }

        const userName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || 'User';

        console.log("[AI Magic] Processing chat for user:", userName, userId);

        // Process with OpenAI function calling
        const result = await processAIMagicChat(
          message,
          conversationHistory,
          {
            currentUserId: userId,
            currentUserName: userName
          }
        );

        res.json(result);
      } catch (error: any) {
        console.error("[AI Magic] Error:", error);
        // Always return structured error response
        res.status(500).json({
          type: 'error',
          message: error.message || "Something went wrong. Please try again."
        });
      }
    }
  );

  // Fuzzy match endpoints for entity resolution
  router.get(
    "/match/clients",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const searchTerm = req.query.q as string;
        if (!searchTerm) {
          return res.status(400).json({ error: "Search term is required" });
        }

        const matches = await fuzzyMatchClients(searchTerm);
        res.json(matches);
      } catch (error: any) {
        console.error("[AI Magic] Error matching clients:", error);
        res.status(500).json({ error: "Failed to match clients" });
      }
    }
  );

  router.get(
    "/match/users",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const searchTerm = req.query.q as string;
        if (!searchTerm) {
          return res.status(400).json({ error: "Search term is required" });
        }

        const matches = await fuzzyMatchUsers(searchTerm);
        res.json(matches);
      } catch (error: any) {
        console.error("[AI Magic] Error matching users:", error);
        res.status(500).json({ error: "Failed to match users" });
      }
    }
  );

  router.get(
    "/match/people",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const searchTerm = req.query.q as string;
        const clientId = req.query.clientId as string | undefined;
        
        if (!searchTerm) {
          return res.status(400).json({ error: "Search term is required" });
        }

        const matches = await fuzzyMatchPeople(searchTerm, clientId);
        res.json(matches);
      } catch (error: any) {
        console.error("[AI Magic] Error matching people:", error);
        res.status(500).json({ error: "Failed to match people" });
      }
    }
  );

  app.use("/api/ai", router);
}

// Helper function to get stage approval context for a project
// Returns only the MOST RECENT submission per field, filtered for positive/completed items only
async function getStageApprovalContext(projectId: string): Promise<string | null> {
  try {
    // Get all stage approval responses for this project
    const responses = await storage.getStageApprovalResponsesByProjectId(projectId);
    
    if (!responses || responses.length === 0) {
      return null;
    }

    // Get all stage approval fields to map field IDs to their details
    const allFields = await storage.getAllStageApprovalFields();
    const fieldMap: Record<string, { fieldName: string; fieldType: string; expectedValueBoolean: boolean | null }> = {};
    for (const f of allFields) {
      fieldMap[f.id] = { 
        fieldName: f.fieldName, 
        fieldType: f.fieldType,
        expectedValueBoolean: f.expectedValueBoolean 
      };
    }

    // Sort responses by createdAt descending (most recent first)
    const sortedResponses = [...responses].sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateB - dateA;
    });

    // Process in single pass: keep only the first (most recent) response per field
    // and immediately format as completed items
    const completedItems: string[] = [];
    const seenFields: Record<string, boolean> = {};
    
    for (const response of sortedResponses) {
      // Skip if we've already processed this field (we want only the most recent)
      if (seenFields[response.fieldId]) continue;
      seenFields[response.fieldId] = true;
      
      const field = fieldMap[response.fieldId];
      if (!field) continue;

      // Only process supported field types that indicate completion
      // Skip unknown or unsupported field types (short_text, date, etc.)
      if (field.fieldType === "boolean") {
        // For boolean fields: only include if value matches expected "completed" state
        const expectedValue = field.expectedValueBoolean ?? true;
        if (response.valueBoolean === expectedValue) {
          completedItems.push(`✓ ${field.fieldName}: Complete`);
        }
      } 
      else if (field.fieldType === "number") {
        // For number fields: only include if there's a positive value
        if (response.valueNumber !== null && response.valueNumber > 0) {
          completedItems.push(`✓ ${field.fieldName}: ${response.valueNumber}`);
        }
      } 
      else if (field.fieldType === "multi_select") {
        // For multi_select: only include if selections were made
        if (response.valueMultiSelect && response.valueMultiSelect.length > 0) {
          completedItems.push(`✓ ${field.fieldName}: ${response.valueMultiSelect.join(", ")}`);
        }
      } 
      else if (field.fieldType === "long_text") {
        // For long_text: only include if there's meaningful content
        if (response.valueLongText) {
          const text = response.valueLongText.trim();
          if (text.length > 0 && text.length <= 200) {
            completedItems.push(`✓ ${field.fieldName}: ${text}`);
          } else if (text.length > 200) {
            completedItems.push(`✓ ${field.fieldName}: (detailed notes provided)`);
          }
        }
      }
      // Other field types (short_text, date, etc.) are explicitly skipped
    }

    if (completedItems.length === 0) {
      return null;
    }

    return completedItems.join("\n");
  } catch (error) {
    console.error("[AI] Error fetching stage approval context:", error);
    return null;
  }
}
