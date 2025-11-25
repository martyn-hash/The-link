import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { FileText, FileSignature, PenLine } from "lucide-react";
import DocumentFolderView from "@/components/DocumentFolderView";
import { CreateFolderDialog } from "@/components/CreateFolderDialog";
import { DocumentUploadDialog } from "@/components/DocumentUploadDialog";
import { SignatureRequestsPanel } from "@/components/SignatureRequestsPanel";

interface DocumentsTabProps {
  clientId: string;
  onNavigateToSignatureRequest: () => void;
}

export function DocumentsTab({ clientId, onNavigateToSignatureRequest }: DocumentsTabProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="w-5 h-5" />
          Documents
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="client-docs" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="client-docs" data-testid="tab-client-docs">
              <FileText className="w-4 h-4 mr-2" />
              Client Docs
            </TabsTrigger>
            <TabsTrigger value="signed-docs" data-testid="tab-signed-docs">
              <FileSignature className="w-4 h-4 mr-2" />
              Signed Docs
            </TabsTrigger>
          </TabsList>

          <TabsContent value="client-docs" className="space-y-4">
            <DocumentFolderView 
              clientId={clientId}
              filterOutSignatureRequests={true}
              renderActions={(currentFolderId) => (
                <>
                  <CreateFolderDialog clientId={clientId} />
                  <DocumentUploadDialog clientId={clientId} source="direct upload" folderId={currentFolderId} />
                </>
              )}
            />
          </TabsContent>

          <TabsContent value="signed-docs" className="space-y-6">
            <div className="flex justify-end">
              <Button
                variant="default"
                size="sm"
                onClick={onNavigateToSignatureRequest}
                data-testid="button-create-signature-request"
              >
                <PenLine className="w-4 h-4 mr-2" />
                Create Signature Request
              </Button>
            </div>

            <div>
              <h3 className="text-sm font-medium mb-3 text-muted-foreground">E-Signature Requests</h3>
              <SignatureRequestsPanel clientId={clientId} />
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
