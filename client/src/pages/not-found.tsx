import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, Home, RefreshCw, ArrowLeft } from "lucide-react";
import { Link } from "wouter";

export default function NotFound() {
  const handleRefresh = () => {
    window.location.reload();
  };

  const handleGoBack = () => {
    window.history.back();
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-[#0A7BBF]/5 via-white to-[#76CA23]/5 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Header */}
      <div className="border-b border-border bg-card">
        <div className="page-container py-6 md:py-8">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-6 h-6 md:w-7 md:h-7 text-destructive" />
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Page Not Found</h1>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center page-container py-6 md:py-8">
        <Card className="w-full max-w-2xl">
          <CardHeader>
            <CardTitle className="text-xl">We couldn't find that page</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-muted-foreground">
              The page you're looking for doesn't exist or may have been moved. If you think you should have access to this page, try one of the options below.
            </p>

            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  onClick={handleRefresh}
                  variant="outline"
                  className="flex-1"
                  data-testid="button-refresh"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Refresh Page
                </Button>
                <Button
                  onClick={handleGoBack}
                  variant="outline"
                  className="flex-1"
                  data-testid="button-go-back"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Go Back
                </Button>
              </div>

              <Link href="/">
                <Button
                  className="w-full"
                  data-testid="button-home"
                >
                  <Home className="w-4 h-4 mr-2" />
                  Return to Home
                </Button>
              </Link>
            </div>

            <div className="pt-4 border-t">
              <p className="text-sm text-muted-foreground">
                <strong>Quick Links:</strong>
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link href="/clients">
                  <Button variant="link" size="sm" className="h-auto p-0">
                    Clients
                  </Button>
                </Link>
                <span className="text-muted-foreground">•</span>
                <Link href="/projects">
                  <Button variant="link" size="sm" className="h-auto p-0">
                    Projects
                  </Button>
                </Link>
                <span className="text-muted-foreground">•</span>
                <Link href="/internal-tasks">
                  <Button variant="link" size="sm" className="h-auto p-0">
                    Tasks
                  </Button>
                </Link>
                <span className="text-muted-foreground">•</span>
                <Link href="/messages">
                  <Button variant="link" size="sm" className="h-auto p-0">
                    Messages
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
