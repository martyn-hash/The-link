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

  app.use("/api/ai", router);
}
