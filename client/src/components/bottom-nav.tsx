import { Link, useLocation } from "wouter";
import { Home, Search, MessageCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import type { MouseEvent } from "react";
import type { User as UserType } from "@shared/schema";

interface BottomNavProps {
  user?: UserType;
  onSearchClick: () => void;
}

export default function BottomNav({ user, onSearchClick }: BottomNavProps) {
  const [location] = useLocation();

  // OPTIMIZED: Use the same optimized unread-count endpoint as top-navigation
  // This shares the same queryKey so React Query deduplicates requests (Issue #4 fix)
  const { data: unreadData } = useQuery<{ unreadCount: number }>({
    queryKey: ['/api/project-messages/unread-count'],
    enabled: !!user,
    refetchInterval: 60000, // 60s interval for background status polling
  });

  const totalUnreadCount = unreadData?.unreadCount || 0;

  const isActive = (href: string) => {
    if (href === "/") {
      return location === "/";
    }
    return location.startsWith(href);
  };

  const navItems = [
    { 
      href: "/", 
      label: "Dashboard", 
      icon: Home,
      testId: "bottom-nav-home"
    },
    { 
      href: "#search", 
      label: "Search", 
      icon: Search,
      testId: "bottom-nav-search",
      onClick: (e: MouseEvent) => {
        e.preventDefault();
        onSearchClick();
      }
    },
    { 
      href: "/messages", 
      label: "Messages", 
      icon: MessageCircle,
      testId: "bottom-nav-messages",
      badge: totalUnreadCount
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-card border-t border-border safe-area-bottom md:hidden">
      <div className="flex items-center justify-around h-16 px-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = item.href !== "#search" && isActive(item.href);
          
          return (
            <Link 
              key={item.href} 
              href={item.href}
              onClick={item.onClick}
            >
              <button
                className={`
                  relative flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-lg transition-colors min-w-[60px]
                  ${active 
                    ? 'text-primary' 
                    : 'text-muted-foreground hover:text-foreground'
                  }
                `}
                data-testid={item.testId}
              >
                <div className="relative">
                  {/* Show numeric badge instead of icon for Messages when there are unread */}
                  {item.label === 'Messages' && item.badge && item.badge > 0 ? (
                    <div className="h-5 w-5 flex items-center justify-center">
                      <span className={`text-sm font-bold ${active ? 'text-primary' : 'text-destructive'}`}>
                        {item.badge > 99 ? '99+' : item.badge}
                      </span>
                    </div>
                  ) : (
                    <Icon className={`h-5 w-5 ${active ? 'fill-current' : ''}`} />
                  )}
                </div>
                <span className="text-xs font-medium">{item.label}</span>
              </button>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
