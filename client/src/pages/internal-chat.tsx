import { useAuth } from '@/hooks/useAuth';
import { Skeleton } from '@/components/ui/skeleton';
import TopNavigation from '@/components/top-navigation';
import BottomNav from '@/components/bottom-nav';
import { InternalChatView } from '@/components/InternalChatView';

export default function InternalChat() {
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background">
        <TopNavigation />
        <div className="container mx-auto px-4 py-8">
          <Skeleton className="h-12 w-64 mb-4" />
          <Skeleton className="h-96 w-full" />
        </div>
        <BottomNav user={user} onSearchClick={() => {}} />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return <InternalChatView showNavigation />;
}
