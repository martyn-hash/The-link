import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Sheet, SheetContent, SheetHeader, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { 
  Menu, 
  Home, 
  FolderOpen, 
  Calendar, 
  User as UserIcon, 
  LogOut,
  X,
  MessageCircle,
  Building,
  Users
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import type { User } from "@shared/schema";
import logoPath from "@assets/resized_logo_1758262615320.png";

interface MobileMenuProps {
  user?: User;
}

export default function MobileMenu({ user }: MobileMenuProps) {
  const [open, setOpen] = useState(false);
  const [location] = useLocation();
  const { isImpersonating } = useAuth();

  const getUserInitials = () => {
    if (!user) return "U";
    const firstName = user.firstName || "";
    const lastName = user.lastName || "";
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() || user.email?.charAt(0).toUpperCase() || "U";
  };

  const getUserDisplayName = () => {
    if (user?.firstName && user?.lastName) {
      return `${user.firstName} ${user.lastName}`;
    }
    return user?.email || 'User';
  };

  const handleLogout = () => {
    window.location.href = "/api/auth/logout";
  };

  const isActive = (href: string) => {
    if (href === "/") {
      return location === "/";
    }
    return location === href;
  };

  const navItems = [
    { href: "/", label: "Dashboard", icon: Home, show: true },
    { href: "/projects", label: "Projects", icon: FolderOpen, show: true },
    { href: "/messages", label: "Messages", icon: MessageCircle, show: true },
    { href: "/companies", label: "Clients", icon: Building, show: true },
  ];

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon"
          className="h-10 w-10"
          data-testid="button-mobile-menu"
        >
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[300px] p-0">
        <div className="flex flex-col h-full">
          {/* Header */}
          <SheetHeader className="px-6 py-4 border-b">
            <div className="flex items-center justify-between">
              <img 
                src={logoPath} 
                alt="Logo" 
                className="h-8 w-auto"
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setOpen(false)}
                className="h-8 w-8"
                data-testid="button-mobile-menu-close"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </SheetHeader>

          {/* User Profile */}
          <div className="px-6 py-4 border-b">
            <Link href="/profile" onClick={() => setOpen(false)}>
              <div className="flex items-center gap-3 cursor-pointer hover:bg-accent/50 -mx-2 px-2 py-2 rounded-md transition-colors" data-testid="link-mobile-profile">
                <Avatar className="w-10 h-10">
                  <AvatarImage src={user?.profileImageUrl || ""} alt={getUserDisplayName()} />
                  <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                    {getUserInitials()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">
                    {getUserDisplayName()}
                    {isImpersonating && (
                      <Badge variant="outline" className="ml-2 text-xs bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-200">
                        Testing
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {user?.email}
                  </div>
                </div>
              </div>
            </Link>
          </div>

          {/* Navigation Links */}
          <nav className="flex-1 px-4 py-4 overflow-y-auto">
            <div className="space-y-1">
              {navItems.filter(item => item.show).map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                
                return (
                  <Link 
                    key={item.href} 
                    href={item.href}
                    onClick={() => setOpen(false)}
                  >
                    <div 
                      className={`
                        flex items-center gap-3 px-4 py-3 rounded-lg transition-colors
                        ${active 
                          ? 'bg-primary text-primary-foreground' 
                          : 'hover:bg-accent text-foreground'
                        }
                      `}
                      data-testid={`mobile-nav-${item.label.toLowerCase()}`}
                    >
                      <Icon className="h-5 w-5 flex-shrink-0" />
                      <span className="font-medium">{item.label}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </nav>

          {/* Footer - Sign Out */}
          <div className="px-4 py-4 border-t">
            <Button
              variant="ghost"
              onClick={handleLogout}
              className="w-full justify-start gap-3 h-12"
              data-testid="button-mobile-logout"
            >
              <LogOut className="h-5 w-5" />
              <span className="font-medium">Sign Out</span>
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
