import { Button } from "@/components/ui/button";
import { 
  Loader2, 
  X,
  FileText,
  Paperclip,
} from "lucide-react";

interface AttachmentsSectionProps {
  selectedFiles: File[];
  isUploadingFiles: boolean;
  onFilesSelected: (files: File[]) => void;
  onRemoveFile: (index: number) => void;
}

export function AttachmentsSection({
  selectedFiles,
  isUploadingFiles,
  onFilesSelected,
  onRemoveFile,
}: AttachmentsSectionProps) {
  return (
    <>
      <div className="flex items-center gap-3">
        <input
          type="file"
          multiple
          accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
          onChange={(e) => {
            const files = Array.from(e.target.files || []);
            if (files.length > 0) {
              onFilesSelected(files);
            }
            e.target.value = '';
          }}
          style={{ display: 'none' }}
          id="stage-change-file-upload"
          data-testid="input-stage-change-file"
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={isUploadingFiles}
          onClick={() => document.getElementById('stage-change-file-upload')?.click()}
          data-testid="button-attach-file"
        >
          <Paperclip className="w-4 h-4 mr-2" />
          Attach
        </Button>
        {selectedFiles.length > 0 && (
          <span className="text-sm text-muted-foreground">
            {selectedFiles.length} file{selectedFiles.length !== 1 ? 's' : ''} selected
          </span>
        )}
        {isUploadingFiles && (
          <span className="text-sm text-muted-foreground flex items-center gap-1">
            <Loader2 className="w-3 h-3 animate-spin" />
            Uploading...
          </span>
        )}
      </div>
      {selectedFiles.length > 0 && (
        <div className="space-y-1 mt-2">
          {selectedFiles.map((file, index) => (
            <div
              key={`${file.name}-${index}`}
              className="flex items-center gap-2 px-3 py-2 bg-muted rounded-md text-sm"
              data-testid={`selected-file-${index}`}
            >
              <FileText className="w-4 h-4 text-muted-foreground" />
              <span className="flex-1 truncate max-w-[200px]">{file.name}</span>
              <span className="text-xs text-muted-foreground">
                {(file.size / 1024).toFixed(1)} KB
              </span>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-5 w-5 p-0"
                onClick={() => onRemoveFile(index)}
                data-testid={`btn-remove-file-${index}`}
              >
                <X className="w-3 h-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
