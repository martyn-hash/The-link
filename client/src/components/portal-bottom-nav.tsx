import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { Menu, CheckSquare, MessageCircle, User, FileText } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import logoPath from '@assets/full_logo_transparent_600_1759469504917.png';

export default function PortalBottomNav() {
  const [location] = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

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
            const content = (
              <button
                className={`
                  flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-lg transition-colors min-w-[60px]
                  ${active ? 'text-primary' : 'text-gray-600 dark:text-gray-400'}
                  ${item.disabled ? 'opacity-40 cursor-not-allowed' : 'hover:text-primary'}
                `}
                data-testid={item.testId}
                disabled={item.disabled}
              >
                <Icon className={`h-5 w-5 ${active ? 'fill-current' : ''}`} />
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

            if (item.disabled) {
              return <div key={item.href}>{content}</div>;
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
          <div className="mt-6 space-y-2">
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
