import { Link, useLocation } from "wouter";
import { Home, FolderOpen, Search, MessageCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import type { MouseEvent } from "react";
import type { User as UserType } from "@shared/schema";

interface BottomNavProps {
  user?: UserType;
  onSearchClick: () => void;
}

interface ProjectMessageThread {
  unreadCount: number;
}

interface StaffMessageThread {
  unreadCount: number;
}

export default function BottomNav({ user, onSearchClick }: BottomNavProps) {
  const [location] = useLocation();

  // Fetch project message threads (Client Chat) unread count
  const { data: projectThreads } = useQuery<ProjectMessageThread[]>({
    queryKey: ['/api/project-messages/my-threads', { includeArchived: false }],
    queryFn: async () => {
      const response = await fetch('/api/project-messages/my-threads?includeArchived=false', {
        credentials: 'include'
      });
      if (!response.ok) return [];
      return response.json();
    },
    enabled: !!user,
    refetchInterval: 30000,
  });

  // Fetch staff message threads (Internal Chat) unread count
  const { data: staffThreads } = useQuery<StaffMessageThread[]>({
    queryKey: ['/api/staff-messages/my-threads', { includeArchived: false }],
    queryFn: async () => {
      const response = await fetch('/api/staff-messages/my-threads?includeArchived=false', {
        credentials: 'include'
      });
      if (!response.ok) return [];
      return response.json();
    },
    enabled: !!user,
    refetchInterval: 30000,
  });

  // Calculate total unread count
  const totalUnreadCount = 
    (projectThreads?.reduce((sum, thread) => sum + thread.unreadCount, 0) || 0) +
    (staffThreads?.reduce((sum, thread) => sum + thread.unreadCount, 0) || 0);

  const isActive = (href: string) => {
    if (href === "/") {
      return location === "/";
    }
    return location.startsWith(href);
  };

  const navItems = [
    { 
      href: "/", 
      label: "Home", 
      icon: Home,
      testId: "bottom-nav-home"
    },
    { 
      href: "/projects", 
      label: "Projects", 
      icon: FolderOpen,
      testId: "bottom-nav-projects"
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
                  <Icon className={`h-5 w-5 ${active ? 'fill-current' : ''}`} />
                  {item.badge && item.badge > 0 && (
                    <Badge 
                      className={`absolute h-4 min-w-4 px-1 text-[10px] flex items-center justify-center ${
                        item.label === 'Messages' 
                          ? '-top-1 -right-1' 
                          : '-top-2 -right-2'
                      }`}
                      variant="destructive"
                      data-testid={`badge-${item.testId}`}
                    >
                      {item.badge > 99 ? '99+' : item.badge}
                    </Badge>
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
