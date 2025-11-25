import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { Menu, CheckSquare, MessageCircle, User, FileText, Building2, Check, Loader2 } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useQuery } from '@tanstack/react-query';
import { portalRequest } from '@/lib/portalApi';
import { usePortalAuth } from '@/contexts/PortalAuthContext';
import { useToast } from '@/hooks/use-toast';
import logoPath from '@assets/full_logo_transparent_600_1759469504917.png';

export default function PortalBottomNav() {
  const [location] = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const { availableCompanies, currentCompany, switchCompany, isLoadingCompanies } = usePortalAuth();
  const { toast } = useToast();
  const [isSwitching, setIsSwitching] = useState(false);

  // OPTIMIZED: Fetch incomplete task count with 60s polling interval (Issue #4 fix)
  const { data: taskCountData } = useQuery<{ count: number }>({
    queryKey: ['/api/portal/task-instances/count/incomplete'],
    queryFn: () => portalRequest('GET', '/api/portal/task-instances/count/incomplete'),
    refetchInterval: 60000, // 60s interval for background status polling
  });

  const isActive = (href: string) => {
    return location === href || location.startsWith(href + '/');
  };

  const navItems = [
    {
      href: '#menu',
      label: 'Menu',
      icon: Menu,
      testId: 'portal-bottom-nav-menu',
      onClick: (e: React.MouseEvent) => {
        e.preventDefault();
        setMenuOpen(true);
      }
    },
    {
      href: '/portal/tasks',
      label: 'Tasks',
      icon: CheckSquare,
      testId: 'portal-bottom-nav-tasks'
    },
    {
      href: '/portal/threads',
      label: 'Chats',
      icon: MessageCircle,
      testId: 'portal-bottom-nav-chats'
    },
    {
      href: '/portal/documents',
      label: 'Docs',
      icon: FileText,
      testId: 'portal-bottom-nav-documents'
    },
    {
      href: '/portal/profile',
      label: 'Profile',
      icon: User,
      testId: 'portal-bottom-nav-profile'
    },
  ];

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-gray-950 border-t border-gray-200 dark:border-gray-800 safe-area-bottom">
        <div className="flex items-center justify-around h-16 px-2 max-w-screen-xl mx-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = item.href !== '#menu' && item.href !== '#' && isActive(item.href);
            const showBadge = item.href === '/portal/tasks' && taskCountData && taskCountData.count > 0;
            
            const content = (
              <button
                className={`
                  flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-lg transition-colors min-w-[60px] relative
                  ${active ? 'text-primary' : 'text-gray-600 dark:text-gray-400'}
                  hover:text-primary
                `}
                data-testid={item.testId}
              >
                <div className="relative">
                  <Icon className={`h-5 w-5 ${active ? 'fill-current' : ''}`} />
                  {showBadge && (
                    <Badge 
                      variant="destructive" 
                      className="absolute -top-2 -right-2 h-4 min-w-4 px-1 flex items-center justify-center text-[10px] font-bold"
                      data-testid="portal-tasks-badge"
                    >
                      {taskCountData.count}
                    </Badge>
                  )}
                </div>
                <span className="text-xs font-medium">{item.label}</span>
              </button>
            );

            if (item.onClick) {
              return (
                <div key={item.href} onClick={item.onClick}>
                  {content}
                </div>
              );
            }

            return (
              <Link key={item.href} href={item.href}>
                {content}
              </Link>
            );
          })}
        </div>
      </nav>

      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="left" className="w-[300px]">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-3">
              <img src={logoPath} alt="The Link" className="h-8 w-auto" />
              <span>Menu</span>
            </SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            {/* Company Switcher */}
            {availableCompanies.length > 1 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground px-1">
                  <Building2 className="w-4 h-4" />
                  <span>Switch Company</span>
                </div>
                {isLoadingCompanies ? (
                  <div className="flex items-center justify-center p-4">
                    <Loader2 className="w-4 h-4 animate-spin" />
                  </div>
                ) : (
                  <div className="space-y-1">
                    {availableCompanies.map((company) => (
                      <button
                        key={company.id}
                        onClick={async () => {
                          if (company.isCurrent || isSwitching) return;
                          
                          setIsSwitching(true);
                          try {
                            await switchCompany(company.id);
                            toast({
                              title: 'Company switched',
                              description: `Now viewing ${company.name}`,
                            });
                            setMenuOpen(false);
                          } catch (error) {
                            toast({
                              title: 'Failed to switch company',
                              description: 'Please try again',
                              variant: 'destructive',
                            });
                          } finally {
                            setIsSwitching(false);
                          }
                        }}
                        disabled={company.isCurrent || isSwitching}
                        className={`
                          w-full flex items-center justify-between p-3 rounded-lg text-left transition-colors
                          ${company.isCurrent 
                            ? 'bg-primary text-primary-foreground' 
                            : 'bg-gray-50 dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-800'
                          }
                          ${isSwitching ? 'opacity-50 cursor-not-allowed' : ''}
                        `}
                        data-testid={`company-switch-${company.id}`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">
                            {company.name}
                          </div>
                          {company.isCurrent && (
                            <div className="text-xs opacity-90 mt-0.5">Current</div>
                          )}
                        </div>
                        {company.isCurrent && (
                          <Check className="w-4 h-4 flex-shrink-0 ml-2" />
                        )}
                        {isSwitching && !company.isCurrent && (
                          <Loader2 className="w-4 h-4 flex-shrink-0 ml-2 animate-spin" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
                <div className="h-px bg-border my-2" />
              </div>
            )}

            {/* Current Company Display (when only one company) */}
            {availableCompanies.length === 1 && currentCompany && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground px-1">
                  <Building2 className="w-4 h-4" />
                  <span>Company</span>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                  <div className="text-sm font-medium">{currentCompany.name}</div>
                </div>
                <div className="h-px bg-border my-2" />
              </div>
            )}

            {/* Coming Soon Section */}
            <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
              <p className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">Coming Soon</p>
              <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
                <li>• AI Insights & Reports</li>
                <li>• Letters Before Action</li>
                <li>• Credit Reports</li>
                <li>• Calendly Booking</li>
                <li>• Financing Applications</li>
              </ul>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
