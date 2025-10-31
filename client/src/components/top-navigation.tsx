import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { List, UserX, Calendar, Home, FolderOpen, ChevronDown, User as UserIcon, Settings, Building, MessageCircle, Users, ClipboardList } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useIsMobile } from "@/hooks/use-mobile";
import SuperSearch from "@/components/super-search";
import AdminDropdown from "@/components/admin-dropdown";
import ImpersonationPanel from "@/components/impersonation-panel";
import MobileMenu from "@/components/mobile-menu";
import type { User } from "@shared/schema";
import logoPath from "@assets/resized_logo_1758262615320.png";

interface TopNavigationProps {
  user?: User;
  onMobileSearchClick?: () => void;
}

export default function TopNavigation({ user, onMobileSearchClick }: TopNavigationProps) {
  const [location] = useLocation();
  const { isImpersonating } = useAuth();
  const isMobile = useIsMobile();

  // Fetch unread internal chat count
  const { data: internalChatThreads } = useQuery<Array<{ unreadCount: number }>>({
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

  const internalChatUnreadCount = internalChatThreads?.reduce((sum, thread) => sum + thread.unreadCount, 0) || 0;

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
    return user?.email || 'Loading...';
  };

  const isActive = (href: string) => {
    if (href === "/") {
      return location === "/";
    }
    return location === href;
  };

  const canAccess = (permissions: string[]) => {
    // Updated to use new boolean flags instead of role strings
    if (permissions.includes('admin') && user?.isAdmin) return true;
    if (permissions.includes('manager') && user?.canSeeAdminMenu) return true;
    return false;
  };

  const handleLogout = () => {
    window.location.href = "/api/auth/logout";
  };

  return (
    <div className="bg-card border-b border-border">
      {/* Impersonation Banner */}
      {isImpersonating && (
        <div className="bg-orange-50 dark:bg-orange-950 border-b border-orange-200 dark:border-orange-800 px-6 py-2">
          <div className="flex items-center justify-center">
            <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200" data-testid="impersonation-indicator">
              <UserX className="w-3 h-3 mr-1" />
              Testing Mode Active
            </Badge>
          </div>
        </div>
      )}
      
      {/* Main Navigation */}
      <div className="px-4 md:px-6 py-3 md:py-4">
        <div className="flex items-center justify-between">
          {/* Left Section: Mobile Menu + Logo */}
          <div className="flex items-center gap-2 md:gap-6">
            {/* Mobile Menu - Only on Mobile */}
            {isMobile && user && (
              <MobileMenu user={user} />
            )}

            {/* Logo Dropdown - Desktop Only */}
            {!isMobile && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <div className="flex items-center space-x-3 cursor-pointer hover:bg-accent/50 transition-colors px-3 py-2 rounded-md" data-testid="dropdown-logo-menu">
                    <img 
                      src={logoPath} 
                      alt="Growth Accountants Logo" 
                      className="h-8 w-auto"
                      data-testid="img-navigation-logo"
                    />
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  </div>
                </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-[700px] p-0">
                <div className="bg-card rounded-lg border border-border shadow-lg">
                  {/* Header */}
                  <div className="px-6 py-4 border-b border-border/20">
                    <div className="flex items-center gap-3">
                      <img 
                        src={logoPath} 
                        alt="Growth Accountants" 
                        className="h-6 w-auto"
                      />
                      <span className="text-base font-semibold text-foreground">Growth Accountants</span>
                    </div>
                  </div>
                  
                  {/* 3-Column Layout */}
                  <div className="grid grid-cols-3 gap-4 px-6 py-4">
                    {/* Column 1: Dashboard, Projects, Services */}
                    <div className="space-y-1">
                      <DropdownMenuItem asChild>
                        <Link href="/" className="w-full">
                          <div className="flex items-center gap-3 w-full px-3 py-2 rounded-md hover:bg-accent/50 transition-colors" data-testid="link-dashboard">
                            <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center shrink-0">
                              <Home className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-foreground text-sm">Dashboard</div>
                            </div>
                          </div>
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href="/projects" className="w-full">
                          <div className="flex items-center gap-3 w-full px-3 py-2 rounded-md hover:bg-accent/50 transition-colors" data-testid="link-projects-menu">
                            <div className="w-8 h-8 rounded-lg bg-violet-100 dark:bg-violet-900 flex items-center justify-center shrink-0">
                              <FolderOpen className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-foreground text-sm">Projects</div>
                            </div>
                          </div>
                        </Link>
                      </DropdownMenuItem>
                      {(user?.isAdmin || user?.canSeeAdminMenu) && (
                        <DropdownMenuItem asChild>
                          <Link href="/scheduled-services" className="w-full">
                            <div className="flex items-center gap-3 w-full px-3 py-2 rounded-md hover:bg-accent/50 transition-colors" data-testid="link-services-menu">
                              <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900 flex items-center justify-center shrink-0">
                                <Calendar className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-foreground text-sm">Services</div>
                              </div>
                            </div>
                          </Link>
                        </DropdownMenuItem>
                      )}
                    </div>

                    {/* Column 2: Messages, Internal Chat, Client Requests, Companies, People */}
                    <div className="space-y-1">
                      <DropdownMenuItem asChild>
                        <Link href="/messages" className="w-full">
                          <div className="flex items-center gap-3 w-full px-3 py-2 rounded-md hover:bg-accent/50 transition-colors" data-testid="link-messages-menu">
                            <div className="w-8 h-8 rounded-lg bg-pink-100 dark:bg-pink-900 flex items-center justify-center shrink-0">
                              <MessageCircle className="w-4 h-4 text-pink-600 dark:text-pink-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-foreground text-sm">Messages</div>
                            </div>
                          </div>
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href="/internal-chat" className="w-full">
                          <div className="flex items-center gap-3 w-full px-3 py-2 rounded-md hover:bg-accent/50 transition-colors" data-testid="link-internal-chat-menu">
                            <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-900 flex items-center justify-center shrink-0">
                              <Users className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-foreground text-sm">Internal Chat</div>
                              {internalChatUnreadCount > 0 && (
                                <Badge variant="default" className="ml-2 text-xs" data-testid="badge-internal-chat-unread">
                                  {internalChatUnreadCount}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href="/client-requests" className="w-full">
                          <div className="flex items-center gap-3 w-full px-3 py-2 rounded-md hover:bg-accent/50 transition-colors" data-testid="link-client-requests-menu">
                            <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900 flex items-center justify-center shrink-0">
                              <ClipboardList className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-foreground text-sm">Client Requests</div>
                            </div>
                          </div>
                        </Link>
                      </DropdownMenuItem>
                      {(user?.isAdmin || user?.canSeeAdminMenu) && (
                        <>
                          <DropdownMenuItem asChild>
                            <Link href="/companies" className="w-full">
                              <div className="flex items-center gap-3 w-full px-3 py-2 rounded-md hover:bg-accent/50 transition-colors" data-testid="link-companies-menu">
                                <div className="w-8 h-8 rounded-lg bg-cyan-100 dark:bg-cyan-900 flex items-center justify-center shrink-0">
                                  <Building className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium text-foreground text-sm">Companies</div>
                                </div>
                              </div>
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link href="/people" className="w-full">
                              <div className="flex items-center gap-3 w-full px-3 py-2 rounded-md hover:bg-accent/50 transition-colors" data-testid="link-people-menu">
                                <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center shrink-0">
                                  <Users className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium text-foreground text-sm">People</div>
                                </div>
                              </div>
                            </Link>
                          </DropdownMenuItem>
                        </>
                      )}
                    </div>

                    {/* Column 3: User Profile, Sign Out */}
                    <div className="space-y-1">
                      <DropdownMenuItem asChild>
                        <Link href="/profile" className="w-full">
                          <div className="flex items-center gap-3 w-full px-3 py-2 rounded-md hover:bg-accent/50 transition-colors" data-testid="link-user-profile">
                            <Avatar className="w-8 h-8 shrink-0">
                              <AvatarImage src={user?.profileImageUrl || ""} alt={getUserDisplayName()} />
                              <AvatarFallback className="bg-accent text-accent-foreground text-xs">
                                {getUserInitials()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-foreground text-sm truncate">
                                {getUserDisplayName()}
                                {isImpersonating && (
                                  <span className="text-orange-600 dark:text-orange-400 ml-1 text-xs">(Testing)</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <button 
                          onClick={handleLogout}
                          className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-accent/50 transition-colors text-left"
                          data-testid="button-logout"
                        >
                          <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center shrink-0">
                            <Settings className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-foreground text-sm">Sign Out</div>
                          </div>
                        </button>
                      </DropdownMenuItem>
                    </div>
                  </div>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
            )}

            {/* Logo Only - Mobile */}
            {isMobile && (
              <img 
                src={logoPath} 
                alt="Growth Accountants Logo" 
                className="h-7 w-auto"
                data-testid="img-navigation-logo-mobile"
              />
            )}
          </div>

          {/* Center Section: Search and Admin - Desktop Only */}
          {!isMobile && (
            <div className="flex items-center space-x-6">
              {/* Global Super Search */}
              <SuperSearch 
                placeholder="Search clients, people, projects..." 
                className="w-80"
              />

              {/* Admin Dropdown */}
              {user && <AdminDropdown user={user} />}
            </div>
          )}

          {/* Right Section: Empty for desktop, Profile icon for mobile */}
          <div className="flex items-center">
            {isMobile && user && (
              <Link href="/profile">
                <Button variant="ghost" size="icon" className="h-10 w-10" data-testid="button-mobile-profile">
                  <Avatar className="w-7 h-7">
                    <AvatarImage src={user?.profileImageUrl || ""} />
                    <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                      {getUserInitials()}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Impersonation Panel (positioned below navigation) */}
      {isImpersonating && (
        <div className="px-6 pb-4">
          <ImpersonationPanel />
        </div>
      )}
    </div>
  );
}