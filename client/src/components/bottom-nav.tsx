import { Link, useLocation } from "wouter";
import { Home, FolderOpen, Search, User } from "lucide-react";
import type { User as UserType } from "@shared/schema";

interface BottomNavProps {
  user?: UserType;
  onSearchClick: () => void;
}

export default function BottomNav({ user, onSearchClick }: BottomNavProps) {
  const [location] = useLocation();

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
      onClick: (e: React.MouseEvent) => {
        e.preventDefault();
        onSearchClick();
      }
    },
    { 
      href: "/profile", 
      label: "Profile", 
      icon: User,
      testId: "bottom-nav-profile"
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
                  flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-lg transition-colors min-w-[60px]
                  ${active 
                    ? 'text-primary' 
                    : 'text-muted-foreground hover:text-foreground'
                  }
                `}
                data-testid={item.testId}
              >
                <Icon className={`h-5 w-5 ${active ? 'fill-current' : ''}`} />
                <span className="text-xs font-medium">{item.label}</span>
              </button>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
