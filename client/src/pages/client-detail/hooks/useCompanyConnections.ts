import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { getQueryFn, apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { showFriendlyError } from "@/lib/friendlyErrors";
import type { Client } from "@shared/schema";
import type { ClientServiceWithService } from "../utils/types";

export interface CompanyConnection {
  client: Client;
  officerRole?: string;
  isPrimaryContact?: boolean;
}

export interface UseCompanyConnectionsCallbacks {
  onCompanyLinked?: () => void;
  onCompanyUnlinked?: () => void;
  onCompanyCreated?: () => void;
}

export interface UseCompanyConnectionsResult {
  companyConnections: CompanyConnection[];
  connectionsLoading: boolean;
  
  companyServices: ClientServiceWithService[] | undefined;
  companyServicesLoading: boolean;
  companyServicesError: boolean;
  
  availableCompanies: Client[];
  
  showCompanySelection: boolean;
  setShowCompanySelection: (show: boolean) => void;
  showCompanyCreation: boolean;
  setShowCompanyCreation: (show: boolean) => void;
  
  linkToCompanyMutation: ReturnType<typeof useMutation<any, any, { companyClientId: string; officerRole?: string; isPrimaryContact?: boolean }>>;
  unlinkFromCompanyMutation: ReturnType<typeof useMutation<any, any, string>>;
  convertToCompanyMutation: ReturnType<typeof useMutation<any, any, { companyName: string; companyNumber?: string; officerRole?: string; isPrimaryContact?: boolean }>>;
}

export function useCompanyConnections(
  clientId: string | undefined,
  clientType: 'individual' | 'company' | undefined,
  callbacks: UseCompanyConnectionsCallbacks = {}
): UseCompanyConnectionsResult {
  const { toast } = useToast();
  const clientTypeLower = clientType?.toLowerCase();
  
  const [showCompanySelection, setShowCompanySelection] = useState(false);
  const [showCompanyCreation, setShowCompanyCreation] = useState(false);

  const { data: companyConnections = [], isLoading: connectionsLoading } = useQuery<CompanyConnection[]>({
    queryKey: [`/api/people/${clientId}/companies`],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: !!clientId && clientTypeLower === 'individual',
  });

  const companyServicesQueries = useQuery<ClientServiceWithService[]>({
    queryKey: ['connected-company-services', companyConnections.map(conn => conn.client.id)],
    queryFn: async () => {
      const connectedCompanyIds = companyConnections.map(conn => conn.client.id);
      if (clientTypeLower !== 'individual' || connectedCompanyIds.length === 0) {
        return [];
      }
      
      const servicesPromises = connectedCompanyIds.map(async (companyId) => {
        const response = await fetch(`/api/client-services/client/${companyId}`, {
          credentials: 'include'
        });
        if (!response.ok) {
          throw new Error(`Failed to fetch services for company ${companyId}`);
        }
        const services = await response.json();
        return services.map((service: any) => ({ 
          ...service, 
          companyId, 
          companyName: companyConnections.find(conn => conn.client.id === companyId)?.client.name 
        }));
      });
      
      const allServices = await Promise.all(servicesPromises);
      return allServices.flat();
    },
    enabled: clientTypeLower === 'individual' && companyConnections.length > 0,
  });

  const { data: companyClients } = useQuery<Client[]>({
    queryKey: ['/api/clients?search='],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: showCompanySelection,
  });

  const linkToCompanyMutation = useMutation({
    mutationFn: async (data: { companyClientId: string; officerRole?: string; isPrimaryContact?: boolean }) => {
      return await apiRequest("POST", `/api/people/${clientId}/companies`, {
        clientId: data.companyClientId,
        officerRole: data.officerRole,
        isPrimaryContact: data.isPrimaryContact
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/people/${clientId}/companies`] });
      setShowCompanySelection(false);
      callbacks.onCompanyLinked?.();
      toast({
        title: "Success",
        description: "Successfully linked to company",
      });
    },
    onError: (error: any) => {
      showFriendlyError({ error });
    },
  });

  const unlinkFromCompanyMutation = useMutation({
    mutationFn: async (companyClientId: string) => {
      return await apiRequest("DELETE", `/api/people/${clientId}/companies/${companyClientId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/people/${clientId}/companies`] });
      callbacks.onCompanyUnlinked?.();
      toast({
        title: "Success",
        description: "Successfully removed company connection",
      });
    },
    onError: (error: any) => {
      showFriendlyError({ error });
    },
  });

  const convertToCompanyMutation = useMutation({
    mutationFn: async (companyData: { 
      companyName: string; 
      companyNumber?: string; 
      officerRole?: string; 
      isPrimaryContact?: boolean;
    }) => {
      return await apiRequest("POST", `/api/people/${clientId}/convert-to-company-client`, companyData);
    },
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: [`/api/clients/${clientId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/people/${clientId}/companies`] });
      setShowCompanyCreation(false);
      callbacks.onCompanyCreated?.();
      toast({
        title: "Success",
        description: `Successfully created company "${result.companyClient.fullName}" and linked to this person`,
      });
    },
    onError: (error: any) => {
      showFriendlyError({ error });
    },
  });

  const connectedCompanyIds = companyConnections.map(conn => conn.client.id);
  const availableCompanies = companyClients?.filter(
    c => c.clientType?.toLowerCase() === 'company' && c.id !== clientId && !connectedCompanyIds.includes(c.id)
  ) || [];

  return {
    companyConnections,
    connectionsLoading,
    
    companyServices: companyServicesQueries.data,
    companyServicesLoading: companyServicesQueries.isLoading,
    companyServicesError: companyServicesQueries.isError,
    
    availableCompanies,
    
    showCompanySelection,
    setShowCompanySelection,
    showCompanyCreation,
    setShowCompanyCreation,
    
    linkToCompanyMutation,
    unlinkFromCompanyMutation,
    convertToCompanyMutation,
  };
}
