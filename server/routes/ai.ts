import { Router, Request, Response } from "express";
import multer from "multer";
import { storage } from "../storage/index";

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

        console.log("[AI] Processing audio for email, size:", req.file.size);

        // Get system prompt from company settings
        const settings = await storage.getCompanySettings();
        const systemPrompt =
          settings?.aiSystemPromptEmails ||
          `You are a professional assistant that helps draft client emails from spoken notes. 
Convert the audio transcription into a well-written, professional email.
You must respond with valid JSON in this exact format:
{
  "subject": "A clear, concise email subject line",
  "body": "The full email body with proper formatting, paragraphs, and professional tone"
}
Do not include any text outside the JSON object.`;

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

        const { projectId, existingSubject, existingBody } = req.body;
        if (!projectId) {
          return res.status(400).json({ error: "Project ID is required" });
        }

        console.log("[AI] Processing audio for stage notification, project:", projectId, "size:", req.file.size);

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

You must respond with valid JSON in this exact format:
{
  "subject": "A clear, concise email subject line about the project update",
  "body": "The full email body with proper formatting, paragraphs, and professional tone",
  "pushTitle": "Short push notification title (max 50 chars)",
  "pushBody": "Brief push notification message (max 150 chars)"
}
Do not include any text outside the JSON object.`;

        // Build the full prompt with stage approval context
        let fullSystemPrompt = basePrompt;
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
