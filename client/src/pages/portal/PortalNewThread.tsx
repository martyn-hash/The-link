import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Send } from 'lucide-react';
import { portalApi } from '@/lib/portalApi';
import { useToast } from '@/hooks/use-toast';
import { showFriendlyError } from '@/lib/friendlyErrors';
import { usePortalAuth } from '@/contexts/PortalAuthContext';
import PortalBottomNav from '@/components/portal-bottom-nav';

export default function PortalNewThread() {
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isAuthenticated, isLoading } = usePortalAuth();
  const [subject, setSubject] = useState('');

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

  const createThreadMutation = useMutation({
    mutationFn: (subject: string) => portalApi.threads.create(subject),
    onSuccess: (thread) => {
      queryClient.invalidateQueries({ queryKey: ['/api/portal/threads'] });
      toast({
        title: 'Thread created',
        description: 'Your conversation has been started',
      });
      setLocation(`/portal/threads/${thread.id}`);
    },
    onError: (error) => {
      showFriendlyError({ error });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim()) {
      showFriendlyError({ error: 'Please enter a subject for your message' });
      return;
    }
    createThreadMutation.mutate(subject.trim());
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-20">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setLocation('/portal/threads')}
              data-testid="button-back"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">New Message</h1>
          </div>
        </div>

        <div className="p-4">
          <Card>
            <CardHeader>
              <CardTitle>Start a conversation</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Subject
                  </label>
                  <Input
                    placeholder="What would you like to discuss?"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    disabled={createThreadMutation.isPending}
                    data-testid="input-subject"
                    autoFocus
                    className="text-base"
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={createThreadMutation.isPending}
                  data-testid="button-create-thread"
                >
                  <Send className="mr-2 h-4 w-4" />
                  {createThreadMutation.isPending ? 'Creating...' : 'Start Conversation'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
      <PortalBottomNav />
    </div>
  );
}
