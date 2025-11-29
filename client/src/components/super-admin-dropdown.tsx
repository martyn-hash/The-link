import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Users, ChevronDown, Bell, Activity, Eye, Settings, FileSpreadsheet, Share2, Calendar } from "lucide-react";
import type { User } from "@shared/schema";

interface SuperAdminDropdownProps {
  user: User;
}

export default function SuperAdminDropdown({ user }: SuperAdminDropdownProps) {
  const [location] = useLocation();

  // Only show to super admin users
  if (!user?.superAdmin) {
    return null;
  }

  const superAdminItems = [
    {
      label: "Company Settings",
      href: "/company-settings",
      icon: Settings,
    },
    {
      label: "Scheduled Notifications",
      href: "/scheduled-notifications",
      icon: Calendar,
    },
    {
      label: "Activity Logs",
      href: "/super-admin/activity-logs",
      icon: Activity,
    },
    {
      label: "User Activity Tracking",
      href: "/super-admin/user-activity-tracking",
      icon: Eye,
    },
    {
      label: "Push Notifications",
      href: "/admin/push-templates",
      icon: Bell,
    },
    {
      label: "Webhooks",
      href: "/super-admin/webhooks",
      icon: Share2,
    },
    {
      label: "User Management",
      href: "/users",
      icon: Users,
    },
    {
      label: "Data Import",
      href: "/import",
      icon: FileSpreadsheet,
    },
  ];

  const isActive = (href: string) => {
    if (href === "/") {
      return location === "/";
    }
    return location === href;
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          className="flex items-center space-x-2"
          data-testid="button-super-admin-dropdown"
        >
          <span>Super Admin</span>
          <ChevronDown className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {superAdminItems.map((item) => (
          <DropdownMenuItem key={item.href} asChild>
            <Link href={item.href} className="w-full">
              <div 
                className={`flex items-center space-x-2 w-full px-2 py-1 ${
                  isActive(item.href) ? 'bg-accent text-accent-foreground' : ''
                }`}
                data-testid={`link-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
              >
                <item.icon className="w-4 h-4" />
                <span>{item.label}</span>
              </div>
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
