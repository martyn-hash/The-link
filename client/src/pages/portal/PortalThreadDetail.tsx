import { useState, useEffect, useRef, memo } from 'react';
import { useParams, useLocation } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Send, User, Building, Paperclip, X, File, Image as ImageIcon, FileAudio, Download, Mic, Square, Trash2 } from 'lucide-react';
import { portalApi } from '@/lib/portalApi';
import { usePortalAuth } from '@/contexts/PortalAuthContext';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';
import PortalBottomNav from '@/components/portal-bottom-nav';

interface Attachment {
  fileName: string;
  fileType: string;
  fileSize: number;
  objectPath: string;
}

interface Message {
  id: string;
  threadId: string;
  content: string;
  userId: string | null;
  clientPortalUserId: string | null;
  isReadByStaff: boolean;
  isReadByClient: boolean;
  attachments?: Attachment[] | null;
  createdAt: string;
}

interface MessageThread {
  id: string;
  subject: string;
  status: 'open' | 'closed' | 'archived';
  clientId: string;
  lastMessageAt: string | null;
  createdAt: string;
}

const statusConfig = {
  open: { label: 'Open', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' },
  closed: { label: 'Closed', color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200' },
  archived: { label: 'Archived', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' },
};

export default function PortalThreadDetail() {
  console.log('[PortalThreadDetail] ===== COMPONENT LOADED - VERSION 3.0 (Direct URLs) =====');
  const params = useParams();
  const threadId = params.id as string;
  const [location, setLocation] = useLocation();
  const { user, token, isAuthenticated, isLoading } = usePortalAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newMessage, setNewMessage] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<Array<{ file: File; previewUrl?: string }>>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const previewUrlsRef = useRef<Set<string>>(new Set());

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);

  // Helper function to create authenticated media URLs with JWT token
  const getAuthenticatedUrl = (objectPath: string) => {
    return objectPath.replace('/objects/', '/api/portal/attachments/') + `?threadId=${threadId}&token=${token}`;
  };
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordedAudio, setRecordedAudio] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isCancelledRef = useRef(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      setLocation('/portal/login');
    }
  }, [isLoading, isAuthenticated, setLocation]);

  if (isLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  const { data: thread } = useQuery<MessageThread>({
    queryKey: ['/api/portal/threads', threadId],
    queryFn: () => portalApi.threads.get(threadId),
  });

  const { data: messages, isLoading: messagesLoading } = useQuery<Message[]>({
    queryKey: ['/api/portal/threads', threadId, 'messages'],
    queryFn: () => portalApi.messages.list(threadId),
    refetchInterval: 3000,
  });

  const sendMessageMutation = useMutation({
    mutationFn: async ({ content, attachments }: { content: string; attachments?: Attachment[] }) => {
      const response = await fetch(`/api/portal/threads/${threadId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ content, attachments }),
      });
      if (!response.ok) throw new Error('Failed to send message');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/portal/threads', threadId, 'messages'] });
      queryClient.invalidateQueries({ queryKey: ['/api/portal/threads'] });
      setNewMessage('');
      clearAllFiles();
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to send message',
        variant: 'destructive',
      });
    },
  });

  const markReadMutation = useMutation({
    mutationFn: () => portalApi.threads.markRead(threadId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/portal/unread-count'] });
    },
  });

  useEffect(() => {
    if (messages && messages.length > 0) {
      const hasUnread = messages.some(m => m.userId && !m.isReadByClient);
      if (hasUnread) {
        markReadMutation.mutate();
      }
    }
  }, [messages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Cleanup all preview URLs on unmount only
  useEffect(() => {
    return () => {
      previewUrlsRef.current.forEach(url => {
        URL.revokeObjectURL(url);
      });
      previewUrlsRef.current.clear();
    };
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    
    // Create file objects with preview URLs for images
    const newFileItems = files.map(file => {
      if (file.type.startsWith('image/')) {
        const previewUrl = URL.createObjectURL(file);
        previewUrlsRef.current.add(previewUrl);
        return {
          file,
          previewUrl
        };
      }
      return { file };
    });
    
    setSelectedFiles(prev => [...prev, ...newFileItems]);
  };

  const handleRemoveFile = (index: number) => {
    const fileItem = selectedFiles[index];
    
    // Revoke the preview URL if it exists
    if (fileItem.previewUrl) {
      URL.revokeObjectURL(fileItem.previewUrl);
      previewUrlsRef.current.delete(fileItem.previewUrl);
    }
    
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const clearAllFiles = () => {
    // Revoke all preview URLs
    selectedFiles.forEach(item => {
      if (item.previewUrl) {
        URL.revokeObjectURL(item.previewUrl);
        previewUrlsRef.current.delete(item.previewUrl);
      }
    });
    setSelectedFiles([]);
  };

  const startRecording = async () => {
    try {
      console.log('[Voice Note] Starting recording...');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log('[Voice Note] Got media stream:', stream.getTracks().map(t => ({
        kind: t.kind,
        enabled: t.enabled,
        muted: t.muted
      })));

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/mp4'
      });
      console.log('[Voice Note] MediaRecorder created with state:', mediaRecorder.state);

      audioChunksRef.current = [];
      isCancelledRef.current = false;

      mediaRecorder.ondataavailable = (event) => {
        console.log('[Voice Note] Data available, size:', event.data.size);
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
          console.log('[Voice Note] Total chunks collected:', audioChunksRef.current.length);
        }
      };

      mediaRecorder.onstop = () => {
        console.log('[Voice Note] Recording stopped. Cancelled:', isCancelledRef.current, 'Chunks:', audioChunksRef.current.length);

        // Only create audio blob if not cancelled
        if (!isCancelledRef.current && audioChunksRef.current.length > 0) {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/mp4' });
          console.log('[Voice Note] Created blob, size:', audioBlob.size, 'type:', audioBlob.type);
          setRecordedAudio(audioBlob);
          const url = URL.createObjectURL(audioBlob);
          console.log('[Voice Note] Created object URL:', url);
          setAudioUrl(url);
        } else {
          console.log('[Voice Note] Not creating blob - cancelled or no chunks');
        }

        // Stop all tracks
        stream.getTracks().forEach(track => {
          console.log('[Voice Note] Stopping track:', track.kind);
          track.stop();
        });
      };

      mediaRecorder.onerror = (event) => {
        console.error('[Voice Note] MediaRecorder error:', event);
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      console.log('[Voice Note] Recording started, state:', mediaRecorder.state);
      setIsRecording(true);
      setRecordingTime(0);

      // Start timer
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (error) {
      console.error('[Voice Note] Failed to start recording:', error);
      toast({
        title: 'Recording failed',
        description: 'Unable to access microphone. Please check permissions.',
        variant: 'destructive',
      });
    }
  };

  const stopRecording = () => {
    console.log('[Voice Note] Stop recording called. isRecording:', isRecording);
    if (mediaRecorderRef.current && isRecording) {
      console.log('[Voice Note] Stopping MediaRecorder, current state:', mediaRecorderRef.current.state);
      mediaRecorderRef.current.stop();
      setIsRecording(false);

      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
      console.log('[Voice Note] Recording stopped successfully');
    }
  };

  const cancelRecording = () => {
    console.log('[Voice Note] Cancel recording called');
    if (mediaRecorderRef.current && isRecording) {
      // Mark as cancelled BEFORE stopping
      isCancelledRef.current = true;
      console.log('[Voice Note] Marked as cancelled, stopping recording');

      mediaRecorderRef.current.stop();
      setIsRecording(false);

      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
    }

    // Clean up state
    console.log('[Voice Note] Cleaning up cancelled recording state');
    setRecordedAudio(null);
    setRecordingTime(0);
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }
    audioChunksRef.current = [];
  };

  const discardRecording = () => {
    console.log('[Voice Note] Discard recording called');
    setRecordedAudio(null);
    setRecordingTime(0);
    if (audioUrl) {
      console.log('[Voice Note] Revoking object URL:', audioUrl);
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }
  };

  const sendVoiceNote = async () => {
    console.log('[Voice Note] Send voice note called');
    console.log('[Voice Note] recordedAudio exists:', !!recordedAudio);
    console.log('[Voice Note] recordedAudio details:', recordedAudio ? {
      size: recordedAudio.size,
      type: recordedAudio.type
    } : null);

    if (!recordedAudio) {
      console.error('[Voice Note] No recorded audio to send!');
      return;
    }

    try {
      console.log('[Voice Note] Starting upload process...');
      setUploading(true);

      // Convert blob to file-like object for browser compatibility
      const fileName = `voice-note-${Date.now()}.mp4`;
      console.log('[Voice Note] Creating File-like object with name:', fileName);

      // Create a File-like object that works in all browsers
      // Some browsers don't support the File constructor, so we extend the Blob
      const audioFile = Object.assign(recordedAudio, {
        name: fileName,
        lastModified: Date.now()
      });

      // Verify file has size
      console.log('[Voice Note] File-like object created:', {
        name: (audioFile as any).name,
        size: audioFile.size,
        type: audioFile.type,
        lastModified: (audioFile as any).lastModified
      });

      if (!audioFile.size || audioFile.size === 0) {
        console.error('[Voice Note] File has no data!');
        throw new Error('Voice note has no audio data');
      }

      console.log('[Voice Note] Calling uploadFile...');
      // Upload the audio file
      const attachment = await uploadFile(audioFile);
      console.log('[Voice Note] Upload successful, attachment:', attachment);

      console.log('[Voice Note] Sending message with attachment...');
      // Send as message
      sendMessageMutation.mutate({
        content: '',
        attachments: [attachment]
      });

      console.log('[Voice Note] Message mutation called, cleaning up...');
      // Clean up
      discardRecording();
    } catch (error: any) {
      console.error('[Voice Note] Upload error:', error);
      console.error('[Voice Note] Error stack:', error.stack);
      toast({
        title: 'Failed to send voice note',
        description: error.message || 'Unable to upload audio. Please try again.',
        variant: 'destructive',
      });
    } finally {
      console.log('[Voice Note] Upload process finished, setUploading(false)');
      setUploading(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const uploadFile = async (file: File): Promise<Attachment> => {
    try {
      console.log('[Upload] ========== STARTING FILE UPLOAD ==========');
      console.log('[Upload] File details:', {
        name: file.name,
        type: file.type,
        size: file.size,
        lastModified: file.lastModified
      });

      console.log('[Upload] Step 1: Requesting upload URL from /api/portal/attachments/upload-url');
      const urlResponse = await fetch('/api/portal/attachments/upload-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ fileName: file.name, fileType: file.type }),
      });

      console.log('[Upload] Upload URL response status:', urlResponse.status, urlResponse.statusText);

      if (!urlResponse.ok) {
        const errorText = await urlResponse.text();
        console.error('[Upload] Failed to get upload URL:', {
          status: urlResponse.status,
          statusText: urlResponse.statusText,
          error: errorText
        });
        throw new Error(`Failed to get upload URL: ${urlResponse.status} - ${errorText}`);
      }

      const responseData = await urlResponse.json();
      console.log('[Upload] Got upload URL response:', responseData);
      const { url, objectPath } = responseData;

      console.log('[Upload] Step 2: Uploading file to GCS signed URL');
      console.log('[Upload] Signed URL length:', url?.length || 0);
      console.log('[Upload] Object path:', objectPath);

      const uploadResponse = await fetch(url, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type,
        },
      });

      console.log('[Upload] GCS upload response status:', uploadResponse.status, uploadResponse.statusText);

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        console.error('[Upload] GCS upload failed:', {
          status: uploadResponse.status,
          statusText: uploadResponse.statusText,
          error: errorText,
          fileType: file.type,
          fileName: file.name,
          fileSize: file.size
        });
        throw new Error(`GCS upload failed: ${uploadResponse.status} ${uploadResponse.statusText} - ${errorText}`);
      }

      console.log('[Upload] ✓ Upload successful!');
      console.log('[Upload] Returning attachment:', {
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        objectPath
      });

      return {
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        objectPath,
      };
    } catch (error: any) {
      console.error('[Upload] ✗ Upload error:', error);
      console.error('[Upload] Error message:', error.message);
      console.error('[Upload] Error stack:', error.stack);
      throw error;
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newMessage.trim() && selectedFiles.length === 0) return;
    
    try {
      let attachments: Attachment[] = [];
      
      if (selectedFiles.length > 0) {
        setUploading(true);
        attachments = await Promise.all(selectedFiles.map(item => uploadFile(item.file)));
      }
      
      sendMessageMutation.mutate({ 
        content: newMessage.trim(), 
        attachments: attachments.length > 0 ? attachments : undefined 
      });
    } catch (error) {
      toast({
        title: 'Upload failed',
        description: 'Failed to upload attachments',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  if (!thread) {
    return null;
  }

  const config = statusConfig[thread.status];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col pb-20">
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-3 mb-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setLocation('/portal/threads')}
              data-testid="button-back"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-bold text-gray-900 dark:text-white truncate">
                {thread.subject}
              </h1>
            </div>
          </div>
          <div className="ml-12">
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
              {config.label}
            </span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto p-4 space-y-4">
          {messagesLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className={i % 2 === 0 ? 'flex justify-end' : ''}>
                <div className="max-w-[80%]">
                  <Skeleton className="h-20 w-64" />
                </div>
              </div>
            ))
          ) : messages && messages.length > 0 ? (
            messages.map((message: Message) => {
              const isFromClient = !!message.clientPortalUserId;
              const isFromMe = message.clientPortalUserId === user?.id;

              return (
                <div
                  key={message.id}
                  className={`flex ${isFromMe ? 'justify-end' : 'justify-start'}`}
                  data-testid={`message-${message.id}`}
                >
                  <Card className={`max-w-[80%] ${isFromMe ? 'bg-blue-600 text-white' : ''}`}>
                    <CardContent className="p-3">
                      <div className="flex items-start gap-2 mb-2">
                        <div className={`p-1.5 rounded-full ${isFromClient ? 'bg-blue-100 dark:bg-blue-900' : 'bg-gray-100 dark:bg-gray-700'}`}>
                          {isFromClient ? (
                            <User className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                          ) : (
                            <Building className="h-3 w-3 text-gray-600 dark:text-gray-400" />
                          )}
                        </div>
                        <span className={`text-xs font-medium ${isFromMe ? 'text-blue-100' : 'text-gray-600 dark:text-gray-400'}`}>
                          {isFromClient ? 'You' : (message as any).staffUserName || 'Staff'}
                        </span>
                      </div>
                      {message.content && (
                        <p className={`text-sm ${isFromMe ? 'text-white' : 'text-gray-900 dark:text-white'} whitespace-pre-wrap break-words`}>
                          {message.content}
                        </p>
                      )}
                      {message.attachments && message.attachments.length > 0 && (
                        <div className="mt-2 space-y-2">
                          {message.attachments.map((attachment, idx) => {
                            const isImage = attachment.fileType.startsWith('image/');
                            const isAudio = attachment.fileType.startsWith('audio/');

                            if (isImage) {
                              const imageUrl = getAuthenticatedUrl(attachment.objectPath);
                              return (
                                <div key={idx} className="mt-2" data-testid={`image-attachment-${idx}`}>
                                  <a
                                    href={imageUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block rounded-lg overflow-hidden border border-gray-200 dark:border-gray-600 hover:opacity-90 transition-opacity"
                                  >
                                    <img
                                      src={imageUrl}
                                      alt={attachment.fileName}
                                      className="max-w-full h-auto max-h-64 object-contain bg-gray-100 dark:bg-gray-800"
                                      loading="lazy"
                                    />
                                  </a>
                                  <div className={`flex items-center gap-2 mt-1 text-xs ${isFromMe ? 'text-blue-100' : 'text-gray-500 dark:text-gray-400'}`}>
                                    <ImageIcon className="h-3 w-3" />
                                    <span className="truncate">{attachment.fileName}</span>
                                  </div>
                                </div>
                              );
                            }

                            if (isAudio) {
                              const audioUrl = getAuthenticatedUrl(attachment.objectPath);
                              return (
                                <div key={idx} className={`p-3 rounded-lg ${isFromMe ? 'bg-blue-700' : 'bg-gray-100 dark:bg-gray-700'}`} data-testid={`audio-attachment-${idx}`}>
                                  <div className="flex items-center gap-2 mb-2">
                                    <FileAudio className="h-4 w-4" />
                                    <span className="text-xs flex-1 truncate">{attachment.fileName}</span>
                                  </div>
                                  <audio
                                    src={audioUrl}
                                    controls
                                    className="w-full max-w-xs"
                                    preload="metadata"
                                  />
                                </div>
                              );
                            }

                            // Convert object path to authenticated API endpoint for download
                            const downloadUrl = getAuthenticatedUrl(attachment.objectPath);

                            return (
                              <div key={idx} className={`flex items-center gap-2 p-2 rounded ${isFromMe ? 'bg-blue-700' : 'bg-gray-100 dark:bg-gray-700'}`}>
                                <File className="h-4 w-4" />
                                <span className="text-xs flex-1 truncate">{attachment.fileName}</span>
                                <a
                                  href={downloadUrl}
                                  download={attachment.fileName}
                                  className={`text-xs ${isFromMe ? 'text-blue-100 hover:text-white' : 'text-blue-600 hover:text-blue-800'}`}
                                  data-testid={`download-attachment-${idx}`}
                                >
                                  <Download className="h-4 w-4" />
                                </a>
                              </div>
                            );
                          })}
                        </div>
                      )}
                      <p className={`text-xs mt-2 ${isFromMe ? 'text-blue-100' : 'text-gray-500 dark:text-gray-400'}`}>
                        {formatDistanceToNow(new Date(message.createdAt), { addSuffix: true })}
                      </p>
                    </CardContent>
                  </Card>
                </div>
              );
            })
          ) : (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              No messages yet. Start the conversation!
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-4">
        <div className="max-w-3xl mx-auto">
          {selectedFiles.length > 0 && (
            <div className="mb-3 space-y-2">
              {selectedFiles.map((fileItem, idx) => {
                const isImage = fileItem.file.type.startsWith('image/');
                
                return (
                  <div key={idx} className="flex items-center gap-2 p-2 bg-gray-100 dark:bg-gray-700 rounded">
                    {isImage && fileItem.previewUrl ? (
                      <img 
                        src={fileItem.previewUrl} 
                        alt={fileItem.file.name}
                        className="h-12 w-12 object-cover rounded"
                      />
                    ) : (
                      <File className="h-4 w-4" />
                    )}
                    <span className="text-sm flex-1 truncate">{fileItem.file.name}</span>
                    <span className="text-xs text-gray-500">{(fileItem.file.size / 1024).toFixed(1)}KB</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveFile(idx)}
                      data-testid={`remove-file-${idx}`}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
          
          {/* Recording indicator */}
          {isRecording && (
            <div className="mb-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="w-4 h-4 bg-red-500 rounded-full animate-pulse" />
                    <div className="absolute inset-0 w-4 h-4 bg-red-500 rounded-full animate-ping opacity-75" />
                  </div>
                  <span className="text-sm font-medium text-red-700 dark:text-red-300">
                    Recording... {formatTime(recordingTime)}
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={cancelRecording}
                    data-testid="button-cancel-recording"
                    className="text-red-600 hover:text-red-700 hover:bg-red-100 dark:hover:bg-red-900/40"
                  >
                    <X className="h-4 w-4 mr-1" />
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={stopRecording}
                    data-testid="button-stop-recording"
                    className="bg-red-600 hover:bg-red-700"
                  >
                    <Square className="h-4 w-4 mr-1" />
                    Stop
                  </Button>
                </div>
              </div>
            </div>
          )}
          
          {/* Recorded audio preview */}
          {recordedAudio && !isRecording && (
            <div className="mb-3 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <FileAudio className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-blue-900 dark:text-blue-100">Voice Note</p>
                    <p className="text-xs text-blue-600 dark:text-blue-400">{formatTime(recordingTime)}</p>
                    {audioUrl && (
                      <audio src={audioUrl} controls className="mt-2 w-full max-w-xs" data-testid="audio-preview" />
                    )}
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={discardRecording}
                    data-testid="button-discard-recording"
                    className="text-gray-600 hover:text-gray-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={sendVoiceNote}
                    disabled={uploading}
                    data-testid="button-send-voice-note"
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {uploading ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                    ) : (
                      <>
                        <Send className="h-4 w-4 mr-1" />
                        Send
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}
          
          <form onSubmit={handleSendMessage} className="flex gap-2">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileSelect}
              className="hidden"
              data-testid="input-file"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || sendMessageMutation.isPending || isRecording || !!recordedAudio}
              data-testid="button-attach-file"
              className="h-[60px] w-[60px]"
            >
              <Paperclip className="h-5 w-5" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={startRecording}
              disabled={uploading || sendMessageMutation.isPending || isRecording || !!recordedAudio}
              data-testid="button-start-recording"
              className="h-[60px] w-[60px]"
            >
              <Mic className="h-5 w-5" />
            </Button>
            <Textarea
              placeholder="Type your message..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage(e);
                }
              }}
              disabled={sendMessageMutation.isPending || uploading || isRecording || !!recordedAudio}
              data-testid="input-message"
              className="min-h-[60px] resize-none"
              rows={2}
            />
            <Button
              type="submit"
              size="icon"
              disabled={sendMessageMutation.isPending || uploading || (!newMessage.trim() && selectedFiles.length === 0) || isRecording || !!recordedAudio}
              data-testid="button-send-message"
              className="h-[60px] w-[60px]"
            >
              {uploading || sendMessageMutation.isPending ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
              ) : (
                <Send className="h-5 w-5" />
              )}
            </Button>
          </form>
        </div>
      </div>
      <PortalBottomNav />
    </div>
  );
}
