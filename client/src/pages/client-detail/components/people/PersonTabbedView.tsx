import { useState, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link as RouterLink } from "wouter";
import { 
  User as UserIcon, MapPin, Settings, Phone, Building2, 
  ChevronLeft, ChevronRight, Plus, X, Link, Check, Calendar 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { apiRequest, queryClient, getQueryFn } from "@/lib/queryClient";
import { showFriendlyError } from "@/lib/friendlyErrors";
import AddressLookup from "@/components/address-lookup";
import type { Client, Person, Service, User, PeopleService } from "@shared/schema";
import { 
  ClientPersonWithPerson, 
  ClientPersonWithClient,
  UpdatePersonData, 
  updatePersonSchema,
  LinkPersonToCompanyData,
  linkPersonToCompanySchema,
  PeopleServiceWithRelations
} from "../../utils/types";
import { formatPersonName, formatBirthDate, formatDate } from "../../utils/formatters";

interface PersonTabbedViewProps {
  clientPerson: ClientPersonWithPerson;
  editingPersonId: string | null;
  setEditingPersonId: (id: string | null) => void;
  updatePersonMutation: any;
  revealedIdentifiers: Set<string>;
  setRevealedIdentifiers: (fn: (prev: Set<string>) => Set<string>) => void;
  peopleServices?: PeopleServiceWithRelations[];
  clientId: string;
}

export function PersonTabbedView({ 
  clientPerson, 
  editingPersonId, 
  setEditingPersonId, 
  updatePersonMutation, 
  revealedIdentifiers, 
  setRevealedIdentifiers, 
  peopleServices,
  clientId
}: PersonTabbedViewProps) {
  const [activeTab, setActiveTab] = useState("basic-info");
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const { toast } = useToast();
  const isMobile = useIsMobile();

  useEffect(() => {
    if (!isMobile) return;

    const tabs = ["basic-info", "contact-info", "personal-services", "related-companies"];
    let touchStartX = 0;
    let touchEndX = 0;

    const handleTouchStart = (e: TouchEvent) => {
      touchStartX = e.changedTouches[0].screenX;
    };

    const handleTouchEnd = (e: TouchEvent) => {
      touchEndX = e.changedTouches[0].screenX;
      handleSwipe();
    };

    const handleSwipe = () => {
      const swipeThreshold = 50;
      const currentIndex = tabs.indexOf(activeTab);
      
      if (touchStartX - touchEndX > swipeThreshold && currentIndex < tabs.length - 1) {
        setActiveTab(tabs[currentIndex + 1]);
      } else if (touchEndX - touchStartX > swipeThreshold && currentIndex > 0) {
        setActiveTab(tabs[currentIndex - 1]);
      }
    };

    const tabsContainer = document.querySelector(`[data-person-tabs="${clientPerson.person.id}"]`);
    if (tabsContainer) {
      tabsContainer.addEventListener('touchstart', handleTouchStart as any);
      tabsContainer.addEventListener('touchend', handleTouchEnd as any);

      return () => {
        tabsContainer.removeEventListener('touchstart', handleTouchStart as any);
        tabsContainer.removeEventListener('touchend', handleTouchEnd as any);
      };
    }
  }, [isMobile, activeTab, clientPerson.person.id]);

  useEffect(() => {
    if (!isMobile) return;
    
    const personTabsContainer = document.querySelector(`[data-person-tabs="${clientPerson.person.id}"]`);
    if (personTabsContainer) {
      const activeTabButton = personTabsContainer.querySelector(`[data-testid="tab-${activeTab}"]`);
      if (activeTabButton) {
        activeTabButton.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  }, [activeTab, isMobile, clientPerson.person.id]);

  const editForm = useForm<UpdatePersonData>({
    resolver: zodResolver(updatePersonSchema),
    shouldUnregister: false,
    defaultValues: {
      fullName: clientPerson.person.fullName || "",
      title: clientPerson.person.title || "",
      dateOfBirth: clientPerson.person.dateOfBirth || "",
      nationality: clientPerson.person.nationality || undefined,
      occupation: clientPerson.person.occupation || "",
      telephone: clientPerson.person.telephone || "",
      email: clientPerson.person.email || "",
      addressLine1: clientPerson.person.addressLine1 || "",
      addressLine2: clientPerson.person.addressLine2 || "",
      locality: clientPerson.person.locality || "",
      region: clientPerson.person.region || "",
      postalCode: clientPerson.person.postalCode || "",
      country: clientPerson.person.country || "",
      isMainContact: Boolean(clientPerson.person.isMainContact),
      niNumber: clientPerson.person.niNumber || "",
      personalUtrNumber: clientPerson.person.personalUtrNumber || "",
      photoIdVerified: Boolean(clientPerson.person.photoIdVerified),
      addressVerified: Boolean(clientPerson.person.addressVerified),
      telephone2: clientPerson.person.telephone2 || "",
      email2: clientPerson.person.email2 || "",
      primaryPhone: clientPerson.person.primaryPhone || "",
      primaryEmail: clientPerson.person.primaryEmail || "",
      linkedinUrl: clientPerson.person.linkedinUrl || "",
      instagramUrl: clientPerson.person.instagramUrl || "",
      twitterUrl: clientPerson.person.twitterUrl || "",
      facebookUrl: clientPerson.person.facebookUrl || "",
      tiktokUrl: clientPerson.person.tiktokUrl || "",
    },
  });

  const isEditing = editingPersonId === clientPerson.person.id;

  const getCurrentFormValues = (): UpdatePersonData => ({
    fullName: clientPerson.person.fullName || "",
    title: clientPerson.person.title || "",
    dateOfBirth: clientPerson.person.dateOfBirth || "",
    nationality: clientPerson.person.nationality || undefined,
    occupation: clientPerson.person.occupation || "",
    telephone: clientPerson.person.telephone || "",
    email: clientPerson.person.email || "",
    addressLine1: clientPerson.person.addressLine1 || "",
    addressLine2: clientPerson.person.addressLine2 || "",
    locality: clientPerson.person.locality || "",
    region: clientPerson.person.region || "",
    postalCode: clientPerson.person.postalCode || "",
    country: clientPerson.person.country || "",
    isMainContact: Boolean(clientPerson.person.isMainContact),
    niNumber: clientPerson.person.niNumber || "",
    personalUtrNumber: clientPerson.person.personalUtrNumber || "",
    photoIdVerified: Boolean(clientPerson.person.photoIdVerified),
    addressVerified: Boolean(clientPerson.person.addressVerified),
    telephone2: clientPerson.person.telephone2 || "",
    email2: clientPerson.person.email2 || "",
    primaryPhone: clientPerson.person.primaryPhone || "",
    primaryEmail: clientPerson.person.primaryEmail || "",
    linkedinUrl: clientPerson.person.linkedinUrl || "",
    instagramUrl: clientPerson.person.instagramUrl || "",
    twitterUrl: clientPerson.person.twitterUrl || "",
    facebookUrl: clientPerson.person.facebookUrl || "",
    tiktokUrl: clientPerson.person.tiktokUrl || "",
  });

  const startEditing = () => {
    setEditingPersonId(clientPerson.person.id);
    editForm.reset(getCurrentFormValues());
  };

  const cancelEditing = () => {
    setEditingPersonId(null);
    editForm.reset(getCurrentFormValues());
  };

  const saveChanges = async (data: UpdatePersonData) => {
    updatePersonMutation.mutate({ 
      personId: clientPerson.person.id, 
      data 
    }, {
      onSuccess: () => {
        setEditingPersonId(null);
        queryClient.invalidateQueries({ queryKey: [`/api/clients/${clientId}/people`] });
        queryClient.invalidateQueries({ queryKey: [`/api/clients/${clientId}`] });
      },
      onError: (error: any) => {
        const formErrors = editForm.formState.errors;
        if (Object.keys(formErrors).length > 0) {
          const firstErrorField = Object.keys(formErrors)[0];
          
          const basicInfoFields = ['fullName', 'title', 'dateOfBirth', 'nationality', 'occupation', 'isMainContact'];
          const contactInfoFields = ['addressLine1', 'addressLine2', 'locality', 'region', 'postalCode', 'country', 'email2', 'telephone2', 'linkedinUrl', 'twitterUrl', 'facebookUrl', 'instagramUrl', 'tiktokUrl'];
          
          if (basicInfoFields.includes(firstErrorField)) {
            setActiveTab('basic-info');
          } else if (contactInfoFields.includes(firstErrorField)) {
            setActiveTab('contact-info');
          }
          
          showFriendlyError({
            error: "Please check the form fields for errors."
          });
        }
      }
    });
  };

  const linkForm = useForm<LinkPersonToCompanyData>({
    resolver: zodResolver(linkPersonToCompanySchema),
    defaultValues: {
      officerRole: "",
      isPrimaryContact: false,
    },
  });

  const { data: personCompanies, isLoading: companiesLoading } = useQuery<ClientPersonWithClient[]>({
    queryKey: [`/api/people/${clientPerson.person.id}/companies`],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const { data: allClients, isLoading: availableCompaniesLoading } = useQuery<Client[]>({
    queryKey: ['/api/clients'],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: isLinkModalOpen,
  });

  const availableCompanies = useMemo(() => {
    if (!allClients || !personCompanies) return [];
    return allClients.filter(client => 
      client.clientType?.toLowerCase() === 'company' && 
      client.id !== clientId &&
      !personCompanies.some(pc => pc.client.id === client.id)
    );
  }, [allClients, personCompanies, clientId]);

  const linkToCompanyMutation = useMutation({
    mutationFn: async (data: LinkPersonToCompanyData) => {
      return await apiRequest("POST", `/api/people/${clientPerson.person.id}/companies`, data);
    },
    onSuccess: () => {
      toast({
        title: "Connection Added",
        description: "Person has been successfully connected to the company.",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/people/${clientPerson.person.id}/companies`] });
      linkForm.reset();
      setIsLinkModalOpen(false);
    },
    onError: (error: any) => {
      showFriendlyError({
        error,
        fallbackTitle: "Couldn't Add Connection",
        fallbackDescription: "Something went wrong while connecting this person to the company. Please try again."
      });
    },
  });

  const unlinkFromCompanyMutation = useMutation({
    mutationFn: async (companyClientId: string) => {
      await apiRequest("DELETE", `/api/people/${clientPerson.person.id}/companies/${companyClientId}`);
    },
    onSuccess: () => {
      toast({
        title: "Connection Removed",
        description: "Person has been disconnected from the company.",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/people/${clientPerson.person.id}/companies`] });
    },
    onError: (error: any) => {
      showFriendlyError({
        error,
        fallbackTitle: "Couldn't Remove Connection",
        fallbackDescription: "Something went wrong while removing the connection. The link may still be in use."
      });
    },
  });

  const handleLinkCompany = (data: LinkPersonToCompanyData) => {
    linkToCompanyMutation.mutate(data);
  };

  const handleUnlinkCompany = (companyClientId: string, companyName: string) => {
    if (confirm(`Are you sure you want to remove the connection between ${formatPersonName(clientPerson.person.fullName)} and ${companyName}?`)) {
      unlinkFromCompanyMutation.mutate(companyClientId);
    }
  };

  return (
    <div className="pt-4" data-person-tabs={clientPerson.person.id}>
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        {/* Desktop Tabs */}
        <div className="hidden md:block w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="basic-info" data-testid="tab-basic-info">Basic Info</TabsTrigger>
            <TabsTrigger value="contact-info" data-testid="tab-contact-info">Contact Info</TabsTrigger>
            <TabsTrigger value="personal-services" data-testid="tab-personal-services">Personal Services</TabsTrigger>
            <TabsTrigger value="related-companies" data-testid="tab-related-companies">Related Companies</TabsTrigger>
          </TabsList>
        </div>

        {/* Mobile Tabs */}
        <div className="md:hidden w-full relative">
          <Button
            variant="ghost"
            size="icon"
            className="absolute left-0 top-1/2 -translate-y-1/2 z-10 h-12 w-12 rounded-full bg-background/80 backdrop-blur-sm shadow-md"
            onClick={() => {
              const tabs = ["basic-info", "contact-info", "personal-services", "related-companies"];
              const currentIndex = tabs.indexOf(activeTab);
              if (currentIndex > 0) {
                setActiveTab(tabs[currentIndex - 1]);
              }
            }}
            disabled={activeTab === "basic-info"}
            data-testid="person-tab-nav-left"
          >
            <ChevronLeft className="h-6 w-6" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="absolute right-0 top-1/2 -translate-y-1/2 z-10 h-12 w-12 rounded-full bg-background/80 backdrop-blur-sm shadow-md"
            onClick={() => {
              const tabs = ["basic-info", "contact-info", "personal-services", "related-companies"];
              const currentIndex = tabs.indexOf(activeTab);
              if (currentIndex < tabs.length - 1) {
                setActiveTab(tabs[currentIndex + 1]);
              }
            }}
            disabled={activeTab === "related-companies"}
            data-testid="person-tab-nav-right"
          >
            <ChevronRight className="h-6 w-6" />
          </Button>

          <div className="w-full overflow-x-auto snap-x snap-mandatory scroll-smooth -mx-4 px-[10vw]" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            <TabsList className="inline-flex gap-2 h-auto">
              <TabsTrigger value="basic-info" data-testid="tab-basic-info" className="text-sm py-3 px-6 whitespace-nowrap snap-center flex-shrink-0" style={{ width: '80vw' }}>Basic Info</TabsTrigger>
              <TabsTrigger value="contact-info" data-testid="tab-contact-info" className="text-sm py-3 px-6 whitespace-nowrap snap-center flex-shrink-0" style={{ width: '80vw' }}>Contact Info</TabsTrigger>
              <TabsTrigger value="personal-services" data-testid="tab-personal-services" className="text-sm py-3 px-6 whitespace-nowrap snap-center flex-shrink-0" style={{ width: '80vw' }}>Personal Services</TabsTrigger>
              <TabsTrigger value="related-companies" data-testid="tab-related-companies" className="text-sm py-3 px-6 whitespace-nowrap snap-center flex-shrink-0" style={{ width: '80vw' }}>Related Companies</TabsTrigger>
            </TabsList>
          </div>
        </div>

        {/* Basic Info Tab */}
        <TabsContent value="basic-info" className="mt-4">
          <BasicInfoTab 
            clientPerson={clientPerson}
            isEditing={isEditing}
            editForm={editForm}
            startEditing={startEditing}
            cancelEditing={cancelEditing}
            saveChanges={saveChanges}
            updatePersonMutation={updatePersonMutation}
          />
        </TabsContent>

        {/* Contact Info Tab */}
        <TabsContent value="contact-info" className="mt-4">
          <ContactInfoTab
            clientPerson={clientPerson}
            isEditing={isEditing}
            editForm={editForm}
            startEditing={startEditing}
            cancelEditing={cancelEditing}
            saveChanges={saveChanges}
            updatePersonMutation={updatePersonMutation}
          />
        </TabsContent>

        {/* Personal Services Tab */}
        <TabsContent value="personal-services" className="mt-4">
          <PersonalServicesTab
            clientPerson={clientPerson}
            isEditing={isEditing}
            editForm={editForm}
            cancelEditing={cancelEditing}
            saveChanges={saveChanges}
            updatePersonMutation={updatePersonMutation}
            peopleServices={peopleServices}
          />
        </TabsContent>

        {/* Related Companies Tab */}
        <TabsContent value="related-companies" className="mt-4">
          <RelatedCompaniesTab
            clientPerson={clientPerson}
            personCompanies={personCompanies}
            companiesLoading={companiesLoading}
            onAddConnection={() => setIsLinkModalOpen(true)}
            onRemoveConnection={handleUnlinkCompany}
            unlinkPending={unlinkFromCompanyMutation.isPending}
          />
        </TabsContent>
      </Tabs>

      {/* Link to Company Modal */}
      <LinkCompanyDialog
        isOpen={isLinkModalOpen}
        onClose={() => setIsLinkModalOpen(false)}
        linkForm={linkForm}
        onSubmit={handleLinkCompany}
        availableCompanies={availableCompanies}
        availableCompaniesLoading={availableCompaniesLoading}
        isPending={linkToCompanyMutation.isPending}
      />
    </div>
  );
}

interface BasicInfoTabProps {
  clientPerson: ClientPersonWithPerson;
  isEditing: boolean;
  editForm: ReturnType<typeof useForm<UpdatePersonData>>;
  startEditing: () => void;
  cancelEditing: () => void;
  saveChanges: (data: UpdatePersonData) => void;
  updatePersonMutation: any;
}

function BasicInfoTab({ clientPerson, isEditing, editForm, startEditing, cancelEditing, saveChanges, updatePersonMutation }: BasicInfoTabProps) {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h5 className="font-medium text-sm flex items-center">
          <UserIcon className="h-4 w-4 mr-2 text-muted-foreground" />
          Basic Information
        </h5>
        {!isEditing ? (
          <Button 
            variant="outline" 
            size="sm"
            data-testid={`button-edit-basic-info-${clientPerson.id}`}
            onClick={startEditing}
          >
            Edit
          </Button>
        ) : (
          <div className="flex space-x-2">
            <Button variant="outline" size="sm" onClick={cancelEditing} disabled={updatePersonMutation.isPending} data-testid={`button-cancel-basic-info-${clientPerson.id}`}>Cancel</Button>
            <Button size="sm" onClick={editForm.handleSubmit(saveChanges)} disabled={updatePersonMutation.isPending} data-testid={`button-save-basic-info-${clientPerson.id}`}>
              {updatePersonMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </div>
        )}
      </div>

      {isEditing ? (
        <Form {...editForm}>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField control={editForm.control} name="fullName" render={({ field }) => (
                <FormItem>
                  <FormLabel>Full Name</FormLabel>
                  <FormControl><Input {...field} data-testid={`input-fullName-${clientPerson.id}`} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              
              <FormField control={editForm.control} name="title" render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl><Input {...field} value={field.value || ""} data-testid={`input-title-${clientPerson.id}`} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              
              <FormField control={editForm.control} name="dateOfBirth" render={({ field }) => (
                <FormItem>
                  <FormLabel>Date of Birth</FormLabel>
                  <FormControl><Input {...field} value={field.value || ""} type="date" data-testid={`input-dateOfBirth-${clientPerson.id}`} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              
              <FormField control={editForm.control} name="nationality" render={({ field }) => (
                <FormItem>
                  <FormLabel>Nationality</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value ?? undefined}>
                    <FormControl>
                      <SelectTrigger data-testid={`select-nationality-${clientPerson.id}`}>
                        <SelectValue placeholder="Select nationality" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="british">British</SelectItem>
                      <SelectItem value="american">American</SelectItem>
                      <SelectItem value="canadian">Canadian</SelectItem>
                      <SelectItem value="australian">Australian</SelectItem>
                      <SelectItem value="german">German</SelectItem>
                      <SelectItem value="french">French</SelectItem>
                      <SelectItem value="spanish">Spanish</SelectItem>
                      <SelectItem value="italian">Italian</SelectItem>
                      <SelectItem value="dutch">Dutch</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              
              <FormField control={editForm.control} name="occupation" render={({ field }) => (
                <FormItem>
                  <FormLabel>Occupation</FormLabel>
                  <FormControl><Input {...field} value={field.value || ""} data-testid={`input-occupation-${clientPerson.id}`} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={editForm.control} name="isMainContact" render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Main Contact</FormLabel>
                    <div className="text-sm text-muted-foreground">This person is the primary contact</div>
                  </div>
                  <FormControl>
                    <Switch checked={field.value || false} onCheckedChange={field.onChange} data-testid={`switch-isMainContact-${clientPerson.id}`} />
                  </FormControl>
                </FormItem>
              )} />
            </div>
          </div>
        </Form>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Full Name</label>
              <p className="text-sm mt-1" data-testid={`view-fullName-${clientPerson.id}`}>
                {formatPersonName(clientPerson.person.fullName) || 'Not provided'}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Title</label>
              <p className="text-sm mt-1" data-testid={`view-title-${clientPerson.id}`}>
                {clientPerson.person.title || 'Not provided'}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Date of Birth</label>
              <p className="text-sm mt-1" data-testid={`view-dateOfBirth-${clientPerson.id}`}>
                {formatBirthDate(clientPerson.person.dateOfBirth)}
              </p>
            </div>
          </div>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Nationality</label>
              <p className="text-sm mt-1" data-testid={`view-nationality-${clientPerson.id}`}>
                {clientPerson.person.nationality ? clientPerson.person.nationality.charAt(0).toUpperCase() + clientPerson.person.nationality.slice(1) : 'Not provided'}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Occupation</label>
              <p className="text-sm mt-1" data-testid={`view-occupation-${clientPerson.id}`}>
                {clientPerson.person.occupation || 'Not provided'}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Main Contact</label>
              <p className="text-sm mt-1" data-testid={`view-isMainContact-${clientPerson.id}`}>
                {clientPerson.person.isMainContact ? (
                  <Badge variant="default" className="text-xs">
                    <Check className="h-3 w-3 mr-1" />
                    Primary Contact
                  </Badge>
                ) : 'Not primary contact'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface ContactInfoTabProps {
  clientPerson: ClientPersonWithPerson;
  isEditing: boolean;
  editForm: ReturnType<typeof useForm<UpdatePersonData>>;
  startEditing: () => void;
  cancelEditing: () => void;
  saveChanges: (data: UpdatePersonData) => void;
  updatePersonMutation: any;
}

function ContactInfoTab({ clientPerson, isEditing, editForm, startEditing, cancelEditing, saveChanges, updatePersonMutation }: ContactInfoTabProps) {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h5 className="font-medium text-sm flex items-center">
          <Phone className="h-4 w-4 mr-2 text-muted-foreground" />
          Contact Information
        </h5>
        {!isEditing ? (
          <Button variant="outline" size="sm" data-testid={`button-edit-contact-info-${clientPerson.id}`} onClick={startEditing}>Edit</Button>
        ) : (
          <div className="flex space-x-2">
            <Button variant="outline" size="sm" onClick={cancelEditing} disabled={updatePersonMutation.isPending} data-testid={`button-cancel-contact-info-${clientPerson.id}`}>Cancel</Button>
            <Button size="sm" onClick={editForm.handleSubmit(saveChanges)} disabled={updatePersonMutation.isPending} data-testid={`button-save-contact-info-${clientPerson.id}`}>
              {updatePersonMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </div>
        )}
      </div>

      {isEditing ? (
        <Form {...editForm}>
          <div className="space-y-6">
            <div className="space-y-4">
              <h6 className="font-medium text-sm flex items-center">
                <MapPin className="h-4 w-4 mr-2 text-muted-foreground" />
                Address Information
              </h6>
              <div className="space-y-3">
                <AddressLookup
                  onAddressSelect={(address) => {
                    editForm.setValue("addressLine1", address.addressLine1);
                    editForm.setValue("addressLine2", address.addressLine2 || "");
                    editForm.setValue("locality", address.locality);
                    editForm.setValue("region", address.region);
                    editForm.setValue("postalCode", address.postalCode);
                    editForm.setValue("country", address.country);
                  }}
                  value={
                    clientPerson.person.addressLine1 ? {
                      addressLine1: clientPerson.person.addressLine1,
                      addressLine2: clientPerson.person.addressLine2 || "",
                      locality: clientPerson.person.locality || "",
                      region: clientPerson.person.region || "",
                      postalCode: clientPerson.person.postalCode || "",
                      country: clientPerson.person.country || ""
                    } : undefined
                  }
                  data-testid={`input-address-lookup-${clientPerson.id}`}
                />
              </div>
            </div>

            <div className="space-y-4">
              <h6 className="font-medium text-sm">Primary Contact Details (for SMS & Email)</h6>
              <div className="grid grid-cols-2 gap-4">
                <FormField control={editForm.control} name="primaryPhone" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Primary Mobile Phone</FormLabel>
                    <FormControl><Input {...field} type="tel" placeholder="07123456789" data-testid={`input-primaryPhone-${clientPerson.id}`} /></FormControl>
                    <div className="text-xs text-muted-foreground">UK mobile format (07xxxxxxxxx)</div>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={editForm.control} name="primaryEmail" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Primary Email Address</FormLabel>
                    <FormControl><Input {...field} type="email" placeholder="user@example.com" data-testid={`input-primaryEmail-${clientPerson.id}`} /></FormControl>
                    <div className="text-xs text-muted-foreground">Used for email communications</div>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
            </div>

            <div className="space-y-4">
              <h6 className="font-medium text-sm">Additional Contact Details</h6>
              <div className="grid grid-cols-2 gap-4">
                <FormField control={editForm.control} name="email2" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Secondary Email</FormLabel>
                    <FormControl><Input {...field} type="email" placeholder="secondary@example.com" data-testid={`input-email2-${clientPerson.id}`} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={editForm.control} name="telephone2" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Secondary Phone</FormLabel>
                    <FormControl><Input {...field} type="tel" placeholder="+44 1234 567890" data-testid={`input-telephone2-${clientPerson.id}`} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
            </div>

            <div className="space-y-4">
              <h6 className="font-medium text-sm">Social Media & Professional Profiles</h6>
              <div className="space-y-3">
                <FormField control={editForm.control} name="linkedinUrl" render={({ field }) => (
                  <FormItem>
                    <FormLabel>LinkedIn Profile</FormLabel>
                    <FormControl><Input {...field} placeholder="https://linkedin.com/in/username" data-testid={`input-linkedinUrl-${clientPerson.id}`} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={editForm.control} name="twitterUrl" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Twitter/X Profile</FormLabel>
                      <FormControl><Input {...field} placeholder="https://x.com/username" data-testid={`input-twitterUrl-${clientPerson.id}`} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={editForm.control} name="facebookUrl" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Facebook Profile</FormLabel>
                      <FormControl><Input {...field} placeholder="https://facebook.com/username" data-testid={`input-facebookUrl-${clientPerson.id}`} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={editForm.control} name="instagramUrl" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Instagram Profile</FormLabel>
                      <FormControl><Input {...field} placeholder="https://instagram.com/username" data-testid={`input-instagramUrl-${clientPerson.id}`} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={editForm.control} name="tiktokUrl" render={({ field }) => (
                    <FormItem>
                      <FormLabel>TikTok Profile</FormLabel>
                      <FormControl><Input {...field} placeholder="https://tiktok.com/@username" data-testid={`input-tiktokUrl-${clientPerson.id}`} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
              </div>
            </div>
          </div>
        </Form>
      ) : (
        <div className="space-y-4">
          <div className="bg-muted/30 rounded-lg p-4 space-y-3">
            <h6 className="text-sm font-medium text-muted-foreground">Primary Contact Details</h6>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="font-medium">Email:</span> {clientPerson.person.primaryEmail || clientPerson.person.email || "Not provided"}</div>
              <div><span className="font-medium">Phone:</span> {clientPerson.person.primaryPhone || clientPerson.person.telephone || "Not provided"}</div>
            </div>
          </div>
          {(clientPerson.person.email2 || clientPerson.person.telephone2) && (
            <div className="space-y-3">
              <h6 className="text-sm font-medium">Additional Contact Details</h6>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Secondary Email</label>
                  <p className="text-sm mt-1">{clientPerson.person.email2 || 'Not provided'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Secondary Phone</label>
                  <p className="text-sm mt-1">{clientPerson.person.telephone2 || 'Not provided'}</p>
                </div>
              </div>
            </div>
          )}
          <div className="space-y-3">
            <h6 className="text-sm font-medium">Social Media & Professional Profiles</h6>
            <div className="grid grid-cols-1 gap-3">
              {clientPerson.person.linkedinUrl && (
                <div className="flex items-center space-x-3 p-3 rounded-lg border bg-background">
                  <span className="text-sm text-muted-foreground">LinkedIn:</span>
                  <a href={clientPerson.person.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline">
                    {clientPerson.person.linkedinUrl}
                  </a>
                </div>
              )}
              {!clientPerson.person.linkedinUrl && !clientPerson.person.twitterUrl && 
               !clientPerson.person.facebookUrl && !clientPerson.person.instagramUrl && 
               !clientPerson.person.tiktokUrl && (
                <p className="text-sm text-muted-foreground italic p-4 border rounded-lg bg-muted/30">No social media profiles provided</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface PersonalServicesTabProps {
  clientPerson: ClientPersonWithPerson;
  isEditing: boolean;
  editForm: ReturnType<typeof useForm<UpdatePersonData>>;
  cancelEditing: () => void;
  saveChanges: (data: UpdatePersonData) => void;
  updatePersonMutation: any;
  peopleServices?: PeopleServiceWithRelations[];
}

function PersonalServicesTab({ clientPerson, isEditing, editForm, cancelEditing, saveChanges, updatePersonMutation, peopleServices }: PersonalServicesTabProps) {
  const personServices = peopleServices?.filter(ps => ps.personId === clientPerson.person.id) || [];

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h5 className="font-medium text-sm flex items-center">
          <Settings className="h-4 w-4 mr-2 text-muted-foreground" />
          Personal Services
        </h5>
        {isEditing && (
          <div className="flex space-x-2">
            <Button variant="outline" size="sm" onClick={cancelEditing} disabled={updatePersonMutation.isPending} data-testid={`button-cancel-personal-services-${clientPerson.id}`}>Cancel</Button>
            <Button size="sm" onClick={editForm.handleSubmit(saveChanges)} disabled={updatePersonMutation.isPending} data-testid={`button-save-personal-services-${clientPerson.id}`}>
              {updatePersonMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </div>
        )}
      </div>

      {personServices.length === 0 ? (
        <div className="p-4 rounded-lg border border-dashed bg-muted/30 text-center">
          <p className="text-sm text-muted-foreground italic">No personal services assigned to this person</p>
        </div>
      ) : (
        <div className="space-y-3">
          {personServices.map((peopleService) => (
            <div key={peopleService.id} className="p-4 rounded-lg border bg-background" data-testid={`personal-service-${peopleService.id}`}>
              <h5 className="font-medium text-sm mb-2">{peopleService.service.name}</h5>
              {peopleService.service.description && (
                <p className="text-sm text-muted-foreground mb-3">{peopleService.service.description}</p>
              )}
              <div className="flex items-center space-x-4 text-xs text-muted-foreground">
                {peopleService.serviceOwner && (
                  <div className="flex items-center space-x-1">
                    <UserIcon className="h-3 w-3" />
                    <span>Owner: {peopleService.serviceOwner.firstName} {peopleService.serviceOwner.lastName}</span>
                  </div>
                )}
                <div className="flex items-center space-x-1">
                  <Calendar className="h-3 w-3" />
                  <span>Assigned: {formatDate(peopleService.createdAt)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface RelatedCompaniesTabProps {
  clientPerson: ClientPersonWithPerson;
  personCompanies?: ClientPersonWithClient[];
  companiesLoading: boolean;
  onAddConnection: () => void;
  onRemoveConnection: (companyClientId: string, companyName: string) => void;
  unlinkPending: boolean;
}

function RelatedCompaniesTab({ clientPerson, personCompanies, companiesLoading, onAddConnection, onRemoveConnection, unlinkPending }: RelatedCompaniesTabProps) {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h5 className="font-medium text-sm flex items-center">
          <Building2 className="h-4 w-4 mr-2 text-muted-foreground" />
          Related Companies
        </h5>
        <Button variant="outline" size="sm" onClick={onAddConnection} data-testid={`button-add-company-connection-${clientPerson.id}`}>
          <Plus className="h-4 w-4 mr-2" />
          Add Connection
        </Button>
      </div>

      <div data-testid={`related-companies-${clientPerson.id}`}>
        {companiesLoading ? (
          <div className="space-y-3">{[1, 2].map(i => <Skeleton key={i} className="h-20 w-full" />)}</div>
        ) : !personCompanies || personCompanies.length === 0 ? (
          <div className="text-center py-8">
            <Building2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Company Connections</h3>
            <p className="text-gray-500 mb-4">This person is not connected to any companies yet.</p>
            <Button onClick={onAddConnection}><Plus className="h-4 w-4 mr-2" />Connect to Company</Button>
          </div>
        ) : (
          <div className="space-y-4">
            {personCompanies.map((connection) => (
              <div key={connection.id} className="border rounded-lg p-4 bg-white" data-testid={`company-connection-${connection.client.id}`}>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <Building2 className="h-5 w-5 text-blue-600" />
                      <h4 className="font-medium text-gray-900">
                        <RouterLink href={`/clients/${connection.client.id}`} className="text-blue-600 hover:text-blue-800 hover:underline transition-colors" data-testid={`link-company-${connection.client.id}`}>
                          {connection.client.name}
                        </RouterLink>
                      </h4>
                      {connection.officerRole && <Badge variant="outline">{connection.officerRole}</Badge>}
                      {connection.isPrimaryContact && <Badge className="bg-green-100 text-green-800">Primary Contact</Badge>}
                    </div>
                    <div className="text-sm text-gray-600 space-y-1">
                      {connection.client.companyNumber && <p><span className="font-medium">Company Number:</span> {connection.client.companyNumber}</p>}
                      {connection.client.companyStatus && <p><span className="font-medium">Status:</span> {connection.client.companyStatus}</p>}
                      {connection.createdAt && <p><span className="font-medium">Connected:</span> {new Date(connection.createdAt).toLocaleDateString()}</p>}
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => onRemoveConnection(connection.client.id, connection.client.name)} disabled={unlinkPending} data-testid={`button-remove-connection-${connection.client.id}`}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface LinkCompanyDialogProps {
  isOpen: boolean;
  onClose: () => void;
  linkForm: ReturnType<typeof useForm<LinkPersonToCompanyData>>;
  onSubmit: (data: LinkPersonToCompanyData) => void;
  availableCompanies: Client[];
  availableCompaniesLoading: boolean;
  isPending: boolean;
}

function LinkCompanyDialog({ isOpen, onClose, linkForm, onSubmit, availableCompanies, availableCompaniesLoading, isPending }: LinkCompanyDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Connect to Company</DialogTitle>
        </DialogHeader>
        
        <Form {...linkForm}>
          <form onSubmit={linkForm.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={linkForm.control} name="clientId" render={({ field }) => (
              <FormItem>
                <FormLabel>Company</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="select-company">
                      <SelectValue placeholder="Select a company" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {availableCompaniesLoading ? (
                      <div className="p-2 text-sm text-gray-500">Loading companies...</div>
                    ) : availableCompanies && availableCompanies.length > 0 ? (
                      availableCompanies.map((company) => (
                        <SelectItem key={company.id} value={company.id}>{company.name}</SelectItem>
                      ))
                    ) : (
                      <div className="p-2 text-sm text-gray-500">No available companies</div>
                    )}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={linkForm.control} name="officerRole" render={({ field }) => (
              <FormItem>
                <FormLabel>Role (Optional)</FormLabel>
                <FormControl><Input {...field} placeholder="e.g., Director, Secretary" data-testid="input-officer-role" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={linkForm.control} name="isPrimaryContact" render={({ field }) => (
              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} data-testid="checkbox-primary-contact" /></FormControl>
                <div className="space-y-1 leading-none">
                  <FormLabel>Primary Contact</FormLabel>
                  <p className="text-sm text-gray-600">Mark this person as the primary contact for the company</p>
                </div>
              </FormItem>
            )} />

            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={onClose} data-testid="button-cancel-link">Cancel</Button>
              <Button type="submit" disabled={isPending} data-testid="button-confirm-link">
                {isPending ? (
                  <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>Connecting...</>
                ) : (
                  <><Link className="h-4 w-4 mr-2" />Connect</>
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
