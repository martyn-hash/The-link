import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EditServiceModal } from "../services";
import { AddPersonModal } from "../people";
import { NewClientRequestDialog } from "../../dialogs/NewClientRequestDialog";
import { CompanyCreationForm } from "../../forms/CompanyCreationForm";
import type { EnhancedClientService, ClientPersonWithPerson } from "../../utils/types";
import type { Client } from "@shared/schema";
import type { UseMutationResult } from "@tanstack/react-query";

interface ServiceModalState {
  editingServiceId: string | null;
  setEditingServiceId: (id: string | null) => void;
  editingPersonalServiceId: string | null;
  setEditingPersonalServiceId: (id: string | null) => void;
  clientServices: EnhancedClientService[] | undefined;
  peopleServices: any[] | undefined;
}

interface PersonModalState {
  isAddPersonModalOpen: boolean;
  setIsAddPersonModalOpen: (open: boolean) => void;
  createPersonMutation: UseMutationResult<any, any, any, any>;
}

interface CompanyDialogState {
  showCompanySelection: boolean;
  setShowCompanySelection: (show: boolean) => void;
  showCompanyCreation: boolean;
  setShowCompanyCreation: (show: boolean) => void;
  selectedCompanyId: string;
  setSelectedCompanyId: (id: string) => void;
  availableCompanies: Client[];
  linkToCompanyMutation: UseMutationResult<any, any, any, any>;
  convertToCompanyMutation: UseMutationResult<any, any, any, any>;
}

interface ClientRequestDialogState {
  isNewRequestDialogOpen: boolean;
  setIsNewRequestDialogOpen: (open: boolean) => void;
  relatedPeople: ClientPersonWithPerson[] | undefined;
  onRequestSuccess: (tab?: string) => void;
}

interface ClientModalsContainerProps {
  clientId: string;
  serviceModals: ServiceModalState;
  personModals: PersonModalState;
  companyDialogs: CompanyDialogState;
  clientRequestDialog: ClientRequestDialogState;
}

export function ClientModalsContainer({
  clientId,
  serviceModals,
  personModals,
  companyDialogs,
  clientRequestDialog,
}: ClientModalsContainerProps) {
  const {
    editingServiceId,
    setEditingServiceId,
    editingPersonalServiceId,
    setEditingPersonalServiceId,
    clientServices,
    peopleServices,
  } = serviceModals;

  const {
    isAddPersonModalOpen,
    setIsAddPersonModalOpen,
    createPersonMutation,
  } = personModals;

  const {
    showCompanySelection,
    setShowCompanySelection,
    showCompanyCreation,
    setShowCompanyCreation,
    selectedCompanyId,
    setSelectedCompanyId,
    availableCompanies,
    linkToCompanyMutation,
    convertToCompanyMutation,
  } = companyDialogs;

  const {
    isNewRequestDialogOpen,
    setIsNewRequestDialogOpen,
    relatedPeople,
    onRequestSuccess,
  } = clientRequestDialog;

  return (
    <>
      {/* Edit Service Modal */}
      {editingServiceId && (() => {
        const currentService = clientServices?.find(cs => cs.id === editingServiceId);
        if (currentService) {
          return (
            <EditServiceModal
              service={currentService as EnhancedClientService}
              isOpen={!!editingServiceId}
              onClose={() => setEditingServiceId(null)}
            />
          );
        }
        return null;
      })()}

      {/* Edit Personal Service Modal */}
      {editingPersonalServiceId && (() => {
        const currentPersonalService = peopleServices?.find(ps => ps.id === editingPersonalServiceId);
        if (currentPersonalService) {
          return (
            <EditServiceModal
              service={currentPersonalService as any}
              isOpen={!!editingPersonalServiceId}
              onClose={() => setEditingPersonalServiceId(null)}
            />
          );
        }
        return null;
      })()}

      {/* Add Person Modal */}
      <AddPersonModal
        clientId={clientId}
        isOpen={isAddPersonModalOpen}
        onClose={() => setIsAddPersonModalOpen(false)}
        onSave={(data) => {
          createPersonMutation.mutate(data);
        }}
        isSaving={createPersonMutation.isPending}
      />

      {/* New Client Request Dialog */}
      <NewClientRequestDialog
        isOpen={isNewRequestDialogOpen}
        onOpenChange={setIsNewRequestDialogOpen}
        clientId={clientId}
        relatedPeople={relatedPeople}
        onSuccess={onRequestSuccess}
      />

      {/* Company Selection Dialog */}
      <Dialog open={showCompanySelection} onOpenChange={setShowCompanySelection}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Link to Company</DialogTitle>
            <DialogDescription>
              Select an existing company to connect this person to.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
              <SelectTrigger data-testid="select-company">
                <SelectValue placeholder="Select a company" />
              </SelectTrigger>
              <SelectContent>
                {availableCompanies.map((company) => (
                  <SelectItem key={company.id} value={company.id}>
                    {company.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex justify-end space-x-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowCompanySelection(false);
                  setSelectedCompanyId("");
                }}
                data-testid="button-cancel-company-selection"
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (selectedCompanyId) {
                    linkToCompanyMutation.mutate({ companyClientId: selectedCompanyId });
                    setSelectedCompanyId("");
                  }
                }}
                disabled={!selectedCompanyId || linkToCompanyMutation.isPending}
                data-testid="button-link-company"
              >
                {linkToCompanyMutation.isPending ? "Linking..." : "Link Company"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Company Creation Dialog */}
      <Dialog open={showCompanyCreation} onOpenChange={setShowCompanyCreation}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Company</DialogTitle>
            <DialogDescription>
              Create a new company and link it to this person.
            </DialogDescription>
          </DialogHeader>
          <CompanyCreationForm
            onSubmit={(data) => convertToCompanyMutation.mutate(data)}
            onCancel={() => setShowCompanyCreation(false)}
            isSubmitting={convertToCompanyMutation.isPending}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
