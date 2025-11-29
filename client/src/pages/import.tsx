import { useEffect } from "react";
import { useLocation, Link } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import TopNavigation from "@/components/top-navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, User, Briefcase, FileSpreadsheet, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Import() {
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
    }
  }, [isAuthenticated, authLoading, toast]);

  useEffect(() => {
    if (!authLoading && user && !user.superAdmin) {
      toast({
        title: "Access Denied",
        description: "You need super admin access for data imports.",
        variant: "destructive",
      });
      navigate("/");
    }
  }, [user, authLoading, navigate, toast]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user?.superAdmin) {
    return null;
  }

  const importTypes = [
    {
      title: "Clients Import",
      description: "Import client companies from a CSV file. Supports Companies House enrichment to automatically populate company details.",
      icon: Building2,
      href: "/clients-import",
      color: "text-blue-600 dark:text-blue-400",
      bgColor: "bg-blue-100 dark:bg-blue-900/30",
    },
    {
      title: "People Import",
      description: "Import contacts (people) from a CSV file and link them to existing clients. Supports matching by client name or ID.",
      icon: User,
      href: "/people-import",
      color: "text-green-600 dark:text-green-400",
      bgColor: "bg-green-100 dark:bg-green-900/30",
    },
    {
      title: "Service Import",
      description: "Import service assignments for clients or people. Configure scheduling, role assignments, and custom fields.",
      icon: Briefcase,
      href: "/service-import",
      color: "text-purple-600 dark:text-purple-400",
      bgColor: "bg-purple-100 dark:bg-purple-900/30",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <TopNavigation />
      <div className="container mx-auto p-4 md:p-6 max-w-4xl">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <FileSpreadsheet className="h-8 w-8 text-primary" />
            <h1 className="text-2xl font-bold">Data Import</h1>
          </div>
          <p className="text-muted-foreground">
            Import clients, people, and service assignments from CSV files. Select an import type below to get started.
          </p>
        </div>

        <div className="grid gap-4 md:gap-6">
          {importTypes.map((importType) => (
            <Link key={importType.href} href={importType.href}>
              <Card 
                className="cursor-pointer hover:border-primary/50 hover:shadow-md transition-all duration-200 group"
                data-testid={`card-${importType.href.replace('/', '')}`}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-3 rounded-lg ${importType.bgColor}`}>
                        <importType.icon className={`h-6 w-6 ${importType.color}`} />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{importType.title}</CardTitle>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" className="group-hover:bg-primary/10">
                      <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-sm">
                    {importType.description}
                  </CardDescription>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        <div className="mt-8 p-4 bg-muted/50 rounded-lg">
          <h3 className="font-medium mb-2">Import Order Recommendation</h3>
          <p className="text-sm text-muted-foreground">
            For the best results, import data in this order:
          </p>
          <ol className="text-sm text-muted-foreground mt-2 space-y-1 list-decimal list-inside">
            <li><strong>Clients first</strong> - Create the client companies that people and services will be linked to</li>
            <li><strong>People second</strong> - Import contacts and link them to the clients you created</li>
            <li><strong>Services last</strong> - Assign services to clients and people with scheduling details</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
