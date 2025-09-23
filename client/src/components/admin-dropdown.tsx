import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Settings, Settings2, Users, ChevronDown, FileCheck, Tags } from "lucide-react";
import type { User } from "@shared/schema";

interface AdminDropdownProps {
  user: User;
}

export default function AdminDropdown({ user }: AdminDropdownProps) {
  const [location] = useLocation();

  // Only show to admin users
  if (user?.role !== 'admin') {
    return null;
  }

  const adminItems = [
    {
      label: "Project Types",
      href: "/project-types",
      icon: Settings,
    },
    {
      label: "Services",
      href: "/services",
      icon: Settings2,
    },
    {
      label: "CH Changes",
      href: "/ch-changes", 
      icon: FileCheck,
    },
    {
      label: "Tags",
      href: "/tags",
      icon: Tags,
    },
    {
      label: "User Management",
      href: "/users",
      icon: Users,
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
          data-testid="button-admin-dropdown"
        >
          <span>Admin</span>
          <ChevronDown className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {adminItems.map((item) => (
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