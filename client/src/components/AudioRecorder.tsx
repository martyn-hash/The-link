import { useState, useRef, useCallback } from "react";
import { Mic, Square, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { showFriendlyError } from "@/lib/friendlyErrors";

interface EmailContext {
  recipientNames?: string;
  senderName?: string;
  clientCompany?: string;
}

interface AudioRecorderProps {
  onResult: (result: { content: string; subject?: string; transcription?: string }) => void;
  mode: "notes" | "email";
  disabled?: boolean;
  className?: string;
  context?: EmailContext;
}

export function AudioRecorder({ onResult, mode, disabled, className, context }: AudioRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: "audio/webm;codecs=opus",
      });
      
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        
        if (chunksRef.current.length === 0) {
          showFriendlyError({ error: "No audio was recorded. Please try recording again." });
          return;
        }

        const audioBlob = new Blob(chunksRef.current, { type: "audio/webm" });
        await processAudio(audioBlob);
      };

      mediaRecorder.start(1000);
      setIsRecording(true);
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);

    } catch (error: any) {
      console.error("Failed to start recording:", error);
      showFriendlyError({ error: "Microphone access denied. Please allow microphone access to use voice recording." });
    }
  }, [toast]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  }, [isRecording]);

  const processAudio = async (audioBlob: Blob) => {
    setIsProcessing(true);
    
    try {
      const formData = new FormData();
      formData.append("audio", audioBlob, "recording.webm");

      // Add personalization context for email mode
      if (mode === "email" && context) {
        if (context.recipientNames) {
          formData.append("recipientNames", context.recipientNames);
        }
        if (context.senderName) {
          formData.append("senderName", context.senderName);
        }
        if (context.clientCompany) {
          formData.append("clientCompany", context.clientCompany);
        }
      }

      const endpoint = mode === "email" ? "/api/ai/audio/email" : "/api/ai/audio/notes";
      
      const response = await fetch(endpoint, {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to process audio");
      }

      const result = await response.json();
      
      onResult({
        content: result.content,
        subject: result.subject,
        transcription: result.transcription,
      });

      toast({
        title: mode === "email" ? "Email drafted" : "Notes created",
        description: "Your recording has been processed successfully.",
      });

    } catch (error: any) {
      console.error("Failed to process audio:", error);
      showFriendlyError({ error: error.message || "Failed to process your recording. Please try again." });
    } finally {
      setIsProcessing(false);
      setRecordingTime(0);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleClick = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Button
        type="button"
        variant={isRecording ? "destructive" : "outline"}
        size="sm"
        onClick={handleClick}
        disabled={disabled || isProcessing}
        className={cn(
          "gap-2 transition-all",
          isRecording && "animate-pulse"
        )}
        data-testid={`button-audio-${mode}`}
      >
        {isProcessing ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Processing...
          </>
        ) : isRecording ? (
          <>
            <Square className="h-4 w-4" />
            Stop ({formatTime(recordingTime)})
          </>
        ) : (
          <>
            <Mic className="h-4 w-4" />
            {mode === "email" ? "Record Email" : "Record Note"}
          </>
        )}
      </Button>
      
      {isRecording && (
        <div className="flex items-center gap-1.5">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
          </span>
          <span className="text-xs text-muted-foreground">Recording...</span>
        </div>
      )}
    </div>
  );
}
