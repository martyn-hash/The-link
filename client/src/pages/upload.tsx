import { useAuth } from "@/hooks/useAuth";
import TopNavigation from "@/components/top-navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import UploadModal from "@/components/upload-modal";
import { useState } from "react";
import { Upload, FileSpreadsheet, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function UploadProjects() {
  const { user, isLoading, isAuthenticated } = useAuth();
  const [showUploadModal, setShowUploadModal] = useState(false);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || user.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-muted-foreground mb-2">Access Denied</h1>
          <p className="text-muted-foreground">You need admin privileges to access this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <TopNavigation user={user} />
      
      <main className="flex-1 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold" data-testid="text-page-title">
                Upload Projects
              </h1>
              <p className="text-muted-foreground mt-2">
                Bulk import projects and client data using CSV files.
              </p>
            </div>
          </div>

          <div className="grid gap-6">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Ensure your CSV file includes the required columns: client name, project details, and any relevant metadata.
              </AlertDescription>
            </Alert>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5" />
                  CSV Upload Portal
                </CardTitle>
                <CardDescription>
                  Upload CSV files to bulk import projects. Supports project creation, client assignment, and initial status setup.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium mb-2">Supported Formats:</h4>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• CSV files with UTF-8 encoding</li>
                      <li>• Maximum file size: 10MB</li>
                      <li>• Headers required in first row</li>
                    </ul>
                  </div>
                  
                  <Button
                    onClick={() => setShowUploadModal(true)}
                    size="lg"
                    data-testid="button-open-upload"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Upload CSV File
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      <UploadModal 
        isOpen={showUploadModal} 
        onClose={() => setShowUploadModal(false)} 
      />
    </div>
  );
}