import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Trash2, Upload, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { showFriendlyError } from "@/lib/friendlyErrors";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface NotificationIcon {
  id: string;
  fileName: string;
  storagePath: string;
  fileSize: number;
  mimeType: string;
  width: number | null;
  height: number | null;
  uploadedBy: string | null;
  createdAt: string;
}

interface MediaLibraryProps {
  mode?: "gallery" | "picker";
  selectedIconId?: string | null;
  onSelectIcon?: (iconId: string, downloadUrl: string) => void;
}

export function MediaLibrary({ mode = "gallery", selectedIconId, onSelectIcon }: MediaLibraryProps) {
  const { toast } = useToast();
  const [uploadingFile, setUploadingFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [deleteIconId, setDeleteIconId] = useState<string | null>(null);
  const [iconUrls, setIconUrls] = useState<Record<string, string>>({});

  // Fetch all notification icons
  const { data: icons, isLoading } = useQuery<NotificationIcon[]>({
    queryKey: ["/api/notification-icons"],
  });

  // Fetch signed URLs for all icons
  const fetchIconUrl = async (iconId: string) => {
    if (iconUrls[iconId]) return iconUrls[iconId];
    
    try {
      const response = await fetch(`/api/notification-icons/${iconId}/download`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch icon URL");
      const data = await response.json();
      setIconUrls(prev => ({ ...prev, [iconId]: data.url }));
      return data.url;
    } catch (error) {
      console.error("Error fetching icon URL:", error);
      return null;
    }
  };

  // Load URLs when icons change
  useEffect(() => {
    const loadIconUrls = async () => {
      if (!icons || icons.length === 0) return;
      for (const icon of icons) {
        if (!iconUrls[icon.id]) {
          await fetchIconUrl(icon.id);
        }
      }
    };

    loadIconUrls();
  }, [icons]);

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("icon", file);

      const response = await fetch("/api/notification-icons", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to upload icon");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notification-icons"] });
      setUploadingFile(null);
      setPreviewUrl(null);
      toast({
        title: "Success",
        description: "Icon uploaded successfully",
      });
    },
    onError: (error: Error) => {
      showFriendlyError({ error });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (iconId: string) => {
      return apiRequest("DELETE", `/api/notification-icons/${iconId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notification-icons"] });
      setDeleteIconId(null);
      toast({
        title: "Success",
        description: "Icon deleted successfully",
      });
    },
    onError: (error: Error) => {
      showFriendlyError({ error });
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      showFriendlyError({ error: "Please select an image file" });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      showFriendlyError({ error: "Please select an image smaller than 5MB" });
      return;
    }

    setUploadingFile(file);
    
    // Create preview URL
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleUpload = () => {
    if (!uploadingFile) return;
    uploadMutation.mutate(uploadingFile);
  };

  const handleCancelUpload = () => {
    setUploadingFile(null);
    setPreviewUrl(null);
  };

  const handleDelete = (iconId: string) => {
    setDeleteIconId(iconId);
  };

  const confirmDelete = () => {
    if (deleteIconId) {
      deleteMutation.mutate(deleteIconId);
    }
  };

  const handleSelectIcon = async (iconId: string) => {
    if (mode === "picker" && onSelectIcon) {
      const url = await fetchIconUrl(iconId);
      if (url) {
        onSelectIcon(iconId, url);
      }
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-muted-foreground">Loading icons...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Upload Section */}
      {!uploadingFile ? (
        <div className="border-2 border-dashed rounded-lg p-6">
          <div className="flex flex-col items-center gap-2">
            <Upload className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Upload a new notification icon</p>
            <p className="text-xs text-muted-foreground">PNG, JPG, or GIF (max 5MB)</p>
            <Input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="max-w-xs"
              data-testid="input-icon-upload"
            />
          </div>
        </div>
      ) : (
        <Card className="p-4">
          <div className="flex items-start gap-4">
            {previewUrl && (
              <img
                src={previewUrl}
                alt="Preview"
                className="w-24 h-24 object-contain rounded border"
              />
            )}
            <div className="flex-1">
              <p className="font-medium">{uploadingFile.name}</p>
              <p className="text-sm text-muted-foreground">
                {(uploadingFile.size / 1024).toFixed(1)} KB
              </p>
              <div className="flex gap-2 mt-3">
                <Button
                  onClick={handleUpload}
                  disabled={uploadMutation.isPending}
                  size="sm"
                  data-testid="button-confirm-upload"
                >
                  {uploadMutation.isPending ? "Uploading..." : "Upload"}
                </Button>
                <Button
                  onClick={handleCancelUpload}
                  variant="outline"
                  size="sm"
                  disabled={uploadMutation.isPending}
                  data-testid="button-cancel-upload"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Gallery Section */}
      <div>
        <h3 className="text-sm font-medium mb-3">
          {mode === "picker" ? "Select an icon" : "Uploaded Icons"} ({icons?.length || 0})
        </h3>
        {!icons || icons.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            No icons uploaded yet
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {icons.map((icon) => (
              <Card
                key={icon.id}
                className={`relative group p-3 cursor-pointer transition-all ${
                  mode === "picker" && selectedIconId === icon.id
                    ? "ring-2 ring-primary"
                    : "hover:shadow-md"
                }`}
                onClick={() => handleSelectIcon(icon.id)}
                data-testid={`icon-card-${icon.id}`}
              >
                <div className="aspect-square flex items-center justify-center bg-muted rounded mb-2">
                  {iconUrls[icon.id] ? (
                    <img
                      src={iconUrls[icon.id]}
                      alt={icon.fileName}
                      className="max-w-full max-h-full object-contain"
                    />
                  ) : (
                    <div className="text-xs text-muted-foreground">Loading...</div>
                  )}
                </div>
                <p className="text-xs truncate" title={icon.fileName}>
                  {icon.fileName}
                </p>
                <p className="text-xs text-muted-foreground">
                  {icon.width}x{icon.height}
                </p>
                
                {/* Selected indicator */}
                {mode === "picker" && selectedIconId === icon.id && (
                  <div className="absolute top-2 right-2 bg-primary text-primary-foreground rounded-full p-1">
                    <Check className="h-3 w-3" />
                  </div>
                )}
                
                {/* Delete button */}
                {mode === "gallery" && (
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity h-7 w-7"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(icon.id);
                    }}
                    data-testid={`button-delete-icon-${icon.id}`}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteIconId} onOpenChange={() => setDeleteIconId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Icon</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this icon? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
