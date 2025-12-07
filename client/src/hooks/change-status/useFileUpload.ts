import { useState, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { showFriendlyError } from "@/lib/friendlyErrors";
import type { UploadedAttachment } from "@/types/changeStatus";

interface UseFileUploadParams {
  projectId: string;
}

interface UseFileUploadReturn {
  selectedFiles: File[];
  uploadedAttachments: UploadedAttachment[];
  isUploadingFiles: boolean;
  handleFilesSelected: (files: File[]) => Promise<void>;
  handleRemoveFile: (index: number) => void;
  resetFileUpload: () => void;
}

export function useFileUpload({
  projectId,
}: UseFileUploadParams): UseFileUploadReturn {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadedAttachments, setUploadedAttachments] = useState<UploadedAttachment[]>([]);
  const [isUploadingFiles, setIsUploadingFiles] = useState(false);

  const { toast } = useToast();

  const uploadFilesToObjectStorage = useCallback(async (files: File[]): Promise<UploadedAttachment[]> => {
    const uploadedFiles: UploadedAttachment[] = [];

    for (const file of files) {
      const urlResponse = await apiRequest(
        "POST",
        `/api/projects/${projectId}/stage-change-attachments/upload-url`,
        {
          fileName: file.name,
          fileType: file.type || 'application/octet-stream',
          fileSize: file.size,
        }
      );

      const { url: uploadUrl, objectPath } = urlResponse;

      const uploadResponse = await fetch(uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Type": file.type || 'application/octet-stream',
        },
        body: file,
      });

      if (!uploadResponse.ok) {
        throw new Error(`Failed to upload file: ${file.name}`);
      }

      uploadedFiles.push({
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type || 'application/octet-stream',
        objectPath,
      });
    }

    return uploadedFiles;
  }, [projectId]);

  const handleFilesSelected = useCallback(async (files: File[]) => {
    if (files.length === 0) return;

    setSelectedFiles((prev) => [...prev, ...files]);
    setIsUploadingFiles(true);

    try {
      const uploaded = await uploadFilesToObjectStorage(files);
      setUploadedAttachments((prev) => [...prev, ...uploaded]);
      toast({
        title: "Files Uploaded",
        description: `${files.length} file(s) uploaded successfully`,
      });
    } catch (error: any) {
      setSelectedFiles((prev) =>
        prev.filter((f) => !files.some((newFile) => newFile.name === f.name))
      );
      showFriendlyError({ error });
    } finally {
      setIsUploadingFiles(false);
    }
  }, [uploadFilesToObjectStorage, toast]);

  const handleRemoveFile = useCallback((index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
    setUploadedAttachments((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const resetFileUpload = useCallback(() => {
    setSelectedFiles([]);
    setUploadedAttachments([]);
    setIsUploadingFiles(false);
  }, []);

  return {
    selectedFiles,
    uploadedAttachments,
    isUploadingFiles,
    handleFilesSelected,
    handleRemoveFile,
    resetFileUpload,
  };
}
