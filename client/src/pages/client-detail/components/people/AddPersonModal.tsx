import { useState, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { 
  User as UserIcon, 
  MapPin, 
  Phone, 
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Globe,
  Check,
  Circle,
  Plus,
  Mail,
  ChevronsUpDown
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import AddressLookup from "@/components/address-lookup";
import { InsertPersonData, addPersonSchema } from "../../utils/types";

const NATIONALITIES = [
  { value: "afghan", label: "Afghan" },
  { value: "albanian", label: "Albanian" },
  { value: "algerian", label: "Algerian" },
  { value: "american", label: "American" },
  { value: "andorran", label: "Andorran" },
  { value: "angolan", label: "Angolan" },
  { value: "antiguans", label: "Antiguans" },
  { value: "argentinean", label: "Argentinean" },
  { value: "armenian", label: "Armenian" },
  { value: "australian", label: "Australian" },
  { value: "austrian", label: "Austrian" },
  { value: "azerbaijani", label: "Azerbaijani" },
  { value: "bahamian", label: "Bahamian" },
  { value: "bahraini", label: "Bahraini" },
  { value: "bangladeshi", label: "Bangladeshi" },
  { value: "barbadian", label: "Barbadian" },
  { value: "barbudans", label: "Barbudans" },
  { value: "batswana", label: "Batswana" },
  { value: "belarusian", label: "Belarusian" },
  { value: "belgian", label: "Belgian" },
  { value: "belizean", label: "Belizean" },
  { value: "beninese", label: "Beninese" },
  { value: "bhutanese", label: "Bhutanese" },
  { value: "bolivian", label: "Bolivian" },
  { value: "bosnian", label: "Bosnian" },
  { value: "brazilian", label: "Brazilian" },
  { value: "british", label: "British" },
  { value: "bruneian", label: "Bruneian" },
  { value: "bulgarian", label: "Bulgarian" },
  { value: "burkinabe", label: "Burkinabe" },
  { value: "burmese", label: "Burmese" },
  { value: "burundian", label: "Burundian" },
  { value: "cambodian", label: "Cambodian" },
  { value: "cameroonian", label: "Cameroonian" },
  { value: "canadian", label: "Canadian" },
  { value: "cape_verdean", label: "Cape Verdean" },
  { value: "central_african", label: "Central African" },
  { value: "chadian", label: "Chadian" },
  { value: "chilean", label: "Chilean" },
  { value: "chinese", label: "Chinese" },
  { value: "colombian", label: "Colombian" },
  { value: "comoran", label: "Comoran" },
  { value: "congolese", label: "Congolese" },
  { value: "costa_rican", label: "Costa Rican" },
  { value: "croatian", label: "Croatian" },
  { value: "cuban", label: "Cuban" },
  { value: "cypriot", label: "Cypriot" },
  { value: "czech", label: "Czech" },
  { value: "danish", label: "Danish" },
  { value: "djibouti", label: "Djibouti" },
  { value: "dominican", label: "Dominican" },
  { value: "dutch", label: "Dutch" },
  { value: "east_timorese", label: "East Timorese" },
  { value: "ecuadorean", label: "Ecuadorean" },
  { value: "egyptian", label: "Egyptian" },
  { value: "emirian", label: "Emirian" },
  { value: "equatorial_guinean", label: "Equatorial Guinean" },
  { value: "eritrean", label: "Eritrean" },
  { value: "estonian", label: "Estonian" },
  { value: "ethiopian", label: "Ethiopian" },
  { value: "fijian", label: "Fijian" },
  { value: "filipino", label: "Filipino" },
  { value: "finnish", label: "Finnish" },
  { value: "french", label: "French" },
  { value: "gabonese", label: "Gabonese" },
  { value: "gambian", label: "Gambian" },
  { value: "georgian", label: "Georgian" },
  { value: "german", label: "German" },
  { value: "ghanaian", label: "Ghanaian" },
  { value: "greek", label: "Greek" },
  { value: "grenadian", label: "Grenadian" },
  { value: "guatemalan", label: "Guatemalan" },
  { value: "guinea_bissauan", label: "Guinea-Bissauan" },
  { value: "guinean", label: "Guinean" },
  { value: "guyanese", label: "Guyanese" },
  { value: "haitian", label: "Haitian" },
  { value: "herzegovinian", label: "Herzegovinian" },
  { value: "honduran", label: "Honduran" },
  { value: "hungarian", label: "Hungarian" },
  { value: "icelander", label: "Icelander" },
  { value: "indian", label: "Indian" },
  { value: "indonesian", label: "Indonesian" },
  { value: "iranian", label: "Iranian" },
  { value: "iraqi", label: "Iraqi" },
  { value: "irish", label: "Irish" },
  { value: "israeli", label: "Israeli" },
  { value: "italian", label: "Italian" },
  { value: "ivorian", label: "Ivorian" },
  { value: "jamaican", label: "Jamaican" },
  { value: "japanese", label: "Japanese" },
  { value: "jordanian", label: "Jordanian" },
  { value: "kazakhstani", label: "Kazakhstani" },
  { value: "kenyan", label: "Kenyan" },
  { value: "kittian_and_nevisian", label: "Kittian and Nevisian" },
  { value: "kuwaiti", label: "Kuwaiti" },
  { value: "kyrgyz", label: "Kyrgyz" },
  { value: "laotian", label: "Laotian" },
  { value: "latvian", label: "Latvian" },
  { value: "lebanese", label: "Lebanese" },
  { value: "liberian", label: "Liberian" },
  { value: "libyan", label: "Libyan" },
  { value: "liechtensteiner", label: "Liechtensteiner" },
  { value: "lithuanian", label: "Lithuanian" },
  { value: "luxembourger", label: "Luxembourger" },
  { value: "macedonian", label: "Macedonian" },
  { value: "malagasy", label: "Malagasy" },
  { value: "malawian", label: "Malawian" },
  { value: "malaysian", label: "Malaysian" },
  { value: "maldivan", label: "Maldivan" },
  { value: "malian", label: "Malian" },
  { value: "maltese", label: "Maltese" },
  { value: "marshallese", label: "Marshallese" },
  { value: "mauritanian", label: "Mauritanian" },
  { value: "mauritian", label: "Mauritian" },
  { value: "mexican", label: "Mexican" },
  { value: "micronesian", label: "Micronesian" },
  { value: "moldovan", label: "Moldovan" },
  { value: "monacan", label: "Monacan" },
  { value: "mongolian", label: "Mongolian" },
  { value: "moroccan", label: "Moroccan" },
  { value: "mosotho", label: "Mosotho" },
  { value: "motswana", label: "Motswana" },
  { value: "mozambican", label: "Mozambican" },
  { value: "namibian", label: "Namibian" },
  { value: "nauruan", label: "Nauruan" },
  { value: "nepalese", label: "Nepalese" },
  { value: "new_zealander", label: "New Zealander" },
  { value: "ni_vanuatu", label: "Ni-Vanuatu" },
  { value: "nicaraguan", label: "Nicaraguan" },
  { value: "nigerien", label: "Nigerien" },
  { value: "north_korean", label: "North Korean" },
  { value: "northern_irish", label: "Northern Irish" },
  { value: "norwegian", label: "Norwegian" },
  { value: "omani", label: "Omani" },
  { value: "pakistani", label: "Pakistani" },
  { value: "palauan", label: "Palauan" },
  { value: "panamanian", label: "Panamanian" },
  { value: "papua_new_guinean", label: "Papua New Guinean" },
  { value: "paraguayan", label: "Paraguayan" },
  { value: "peruvian", label: "Peruvian" },
  { value: "polish", label: "Polish" },
  { value: "portuguese", label: "Portuguese" },
  { value: "qatari", label: "Qatari" },
  { value: "romanian", label: "Romanian" },
  { value: "russian", label: "Russian" },
  { value: "rwandan", label: "Rwandan" },
  { value: "saint_lucian", label: "Saint Lucian" },
  { value: "salvadoran", label: "Salvadoran" },
  { value: "samoan", label: "Samoan" },
  { value: "san_marinese", label: "San Marinese" },
  { value: "sao_tomean", label: "Sao Tomean" },
  { value: "saudi", label: "Saudi" },
  { value: "scottish", label: "Scottish" },
  { value: "senegalese", label: "Senegalese" },
  { value: "serbian", label: "Serbian" },
  { value: "seychellois", label: "Seychellois" },
  { value: "sierra_leonean", label: "Sierra Leonean" },
  { value: "singaporean", label: "Singaporean" },
  { value: "slovakian", label: "Slovakian" },
  { value: "slovenian", label: "Slovenian" },
  { value: "solomon_islander", label: "Solomon Islander" },
  { value: "somali", label: "Somali" },
  { value: "south_african", label: "South African" },
  { value: "south_korean", label: "South Korean" },
  { value: "spanish", label: "Spanish" },
  { value: "sri_lankan", label: "Sri Lankan" },
  { value: "sudanese", label: "Sudanese" },
  { value: "surinamer", label: "Surinamer" },
  { value: "swazi", label: "Swazi" },
  { value: "swedish", label: "Swedish" },
  { value: "swiss", label: "Swiss" },
  { value: "syrian", label: "Syrian" },
  { value: "taiwanese", label: "Taiwanese" },
  { value: "tajik", label: "Tajik" },
  { value: "tanzanian", label: "Tanzanian" },
  { value: "thai", label: "Thai" },
  { value: "togolese", label: "Togolese" },
  { value: "tongan", label: "Tongan" },
  { value: "trinidadian_or_tobagonian", label: "Trinidadian or Tobagonian" },
  { value: "tunisian", label: "Tunisian" },
  { value: "turkish", label: "Turkish" },
  { value: "tuvaluan", label: "Tuvaluan" },
  { value: "ugandan", label: "Ugandan" },
  { value: "ukrainian", label: "Ukrainian" },
  { value: "uruguayan", label: "Uruguayan" },
  { value: "uzbekistani", label: "Uzbekistani" },
  { value: "venezuelan", label: "Venezuelan" },
  { value: "vietnamese", label: "Vietnamese" },
  { value: "welsh", label: "Welsh" },
  { value: "yemenite", label: "Yemenite" },
  { value: "zambian", label: "Zambian" },
  { value: "zimbabwean", label: "Zimbabwean" },
];

interface AddPersonModalProps {
  clientId: string;
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: InsertPersonData) => void;
  isSaving: boolean;
}

export function AddPersonModal({ 
  clientId, 
  isOpen, 
  onClose, 
  onSave, 
  isSaving 
}: AddPersonModalProps) {
  const [activeTab, setActiveTab] = useState("personal");
  const [visitedTabs, setVisitedTabs] = useState<Set<string>>(new Set(["personal"]));
  const [showSecondaryContacts, setShowSecondaryContacts] = useState(true);
  const [showSocialLinks, setShowSocialLinks] = useState(false);
  const [nationalityOpen, setNationalityOpen] = useState(false);

  const form = useForm<InsertPersonData>({
    resolver: zodResolver(addPersonSchema),
    defaultValues: {
      fullName: "",
      title: "",
      dateOfBirth: undefined,
      nationality: undefined,
      occupation: "",
      telephone: "",
      email: "",
      primaryPhone: "",
      primaryEmail: "",
      telephone2: "",
      email2: "",
      linkedinUrl: "",
      twitterUrl: "",
      facebookUrl: "",
      instagramUrl: "",
      tiktokUrl: "",
      addressLine1: "",
      postalCode: "",
      locality: "",
      region: "",
      country: "",
      addressVerified: false,
      niNumber: "",
      personalUtrNumber: "",
      photoIdVerified: false,
      isMainContact: false,
    },
  });

  useEffect(() => {
    if (isOpen) {
      setVisitedTabs(new Set(["personal"]));
      setActiveTab("personal");
      setShowSecondaryContacts(true);
      setShowSocialLinks(false);
      setNationalityOpen(false);
      form.reset();
    }
  }, [isOpen, form]);

  const handleSubmit = (data: InsertPersonData) => {
    if (data.primaryPhone) {
      if (data.primaryPhone.startsWith('07')) {
        data.primaryPhone = '+447' + data.primaryPhone.slice(2);
      }
      else if (data.primaryPhone.startsWith('447')) {
        data.primaryPhone = '+' + data.primaryPhone;
      }
      else if (!data.primaryPhone.startsWith('+447')) {
        const cleanPhone = data.primaryPhone.replace(/[^\d]/g, '');
        if (cleanPhone.startsWith('07') && cleanPhone.length === 11) {
          data.primaryPhone = '+447' + cleanPhone.slice(2);
        }
      }
    }
    onSave(data);
  };

  const handleAddressSelect = (addressData: any) => {
    form.setValue("addressLine1", addressData.addressLine1 || "");
    form.setValue("postalCode", addressData.postalCode || "");
    form.setValue("locality", addressData.locality || "");
    form.setValue("region", addressData.region || "");
    form.setValue("country", addressData.country || "United Kingdom");
  };

  const hasPersonalData = form.watch("fullName");
  const hasContactData = form.watch("primaryEmail") || form.watch("primaryPhone");
  const hasAddressData = form.watch("addressLine1") || form.watch("postalCode");

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    setVisitedTabs(prev => {
      const newSet = new Set(prev);
      newSet.add(value);
      return newSet;
    });
  };

  const allTabsVisited = visitedTabs.has("personal") && visitedTabs.has("contact") && visitedTabs.has("address");
  const unvisitedCount = 3 - visitedTabs.size;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-xl">Add Related Person</DialogTitle>
          <DialogDescription>
            Add a new person to this client. Please review each tab to ensure all relevant information is captured.
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col flex-1 overflow-hidden">
            <Tabs value={activeTab} onValueChange={handleTabChange} className="flex flex-col flex-1 overflow-hidden">
              <TabsList className="grid w-full grid-cols-3 mb-4">
                <TabsTrigger value="personal" className="flex items-center gap-2 relative" data-testid="tab-personal">
                  <UserIcon className="h-4 w-4" />
                  <span className="hidden sm:inline">Personal</span>
                  {visitedTabs.has("personal") ? (
                    hasPersonalData ? (
                      <Check className="h-3 w-3 text-green-600" />
                    ) : (
                      <Check className="h-3 w-3 text-muted-foreground" />
                    )
                  ) : (
                    <Circle className="h-2 w-2 fill-orange-500 text-orange-500" />
                  )}
                </TabsTrigger>
                <TabsTrigger value="contact" className="flex items-center gap-2 relative" data-testid="tab-contact">
                  <Phone className="h-4 w-4" />
                  <span className="hidden sm:inline">Contact</span>
                  {visitedTabs.has("contact") ? (
                    hasContactData ? (
                      <Check className="h-3 w-3 text-green-600" />
                    ) : (
                      <Check className="h-3 w-3 text-muted-foreground" />
                    )
                  ) : (
                    <Circle className="h-2 w-2 fill-orange-500 text-orange-500" />
                  )}
                </TabsTrigger>
                <TabsTrigger value="address" className="flex items-center gap-2 relative" data-testid="tab-address">
                  <MapPin className="h-4 w-4" />
                  <span className="hidden sm:inline">Address</span>
                  {visitedTabs.has("address") ? (
                    hasAddressData ? (
                      <Check className="h-3 w-3 text-green-600" />
                    ) : (
                      <Check className="h-3 w-3 text-muted-foreground" />
                    )
                  ) : (
                    <Circle className="h-2 w-2 fill-orange-500 text-orange-500" />
                  )}
                </TabsTrigger>
              </TabsList>

              <div className="flex-1 overflow-y-auto pr-2">
                {/* Personal Details Tab - Now includes compliance fields */}
                <TabsContent value="personal" className="mt-0 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="fullName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Full Name *</FormLabel>
                          <FormControl>
                            <Input 
                              {...field} 
                              placeholder="Enter full name"
                              data-testid="input-fullName" 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="title"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Title</FormLabel>
                          <FormControl>
                            <Input 
                              {...field} 
                              value={field.value || ""} 
                              placeholder="Mr, Mrs, Dr, etc."
                              data-testid="input-title" 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="dateOfBirth"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Date of Birth</FormLabel>
                          <FormControl>
                            <Input 
                              type="date" 
                              {...field} 
                              value={field.value || ""} 
                              data-testid="input-dateOfBirth" 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="nationality"
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel>Nationality</FormLabel>
                          <Popover open={nationalityOpen} onOpenChange={setNationalityOpen}>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant="outline"
                                  role="combobox"
                                  aria-expanded={nationalityOpen}
                                  className={cn(
                                    "w-full justify-between font-normal",
                                    !field.value && "text-muted-foreground"
                                  )}
                                  data-testid="input-nationality"
                                >
                                  {field.value
                                    ? NATIONALITIES.find((n) => n.value === field.value)?.label
                                    : "Select nationality..."}
                                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-[300px] p-0" align="start">
                              <Command>
                                <CommandInput placeholder="Search nationality..." />
                                <CommandList>
                                  <CommandEmpty>No nationality found.</CommandEmpty>
                                  <CommandGroup>
                                    {NATIONALITIES.map((nationality) => (
                                      <CommandItem
                                        key={nationality.value}
                                        value={nationality.label}
                                        onSelect={() => {
                                          field.onChange(nationality.value);
                                          setNationalityOpen(false);
                                        }}
                                      >
                                        <Check
                                          className={cn(
                                            "mr-2 h-4 w-4",
                                            field.value === nationality.value
                                              ? "opacity-100"
                                              : "opacity-0"
                                          )}
                                        />
                                        {nationality.label}
                                      </CommandItem>
                                    ))}
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="occupation"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Occupation</FormLabel>
                          <FormControl>
                            <Input 
                              {...field} 
                              value={field.value || ""} 
                              placeholder="e.g. Director"
                              data-testid="input-occupation" 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="isMainContact"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center space-x-3 space-y-0 pt-6">
                          <FormControl>
                            <Checkbox
                              checked={field.value || false}
                              onCheckedChange={field.onChange}
                              data-testid="input-isMainContact"
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel>Primary Contact</FormLabel>
                            <FormDescription>
                              Mark as the main contact for this client
                            </FormDescription>
                          </div>
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Compliance & Verification - Moved to Personal tab, no accordion */}
                  <div className="border-t pt-6 mt-6">
                    <div className="flex items-center gap-2 mb-4">
                      <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                      <h4 className="text-sm font-medium">Compliance & Verification</h4>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FormField
                        control={form.control}
                        name="niNumber"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>National Insurance Number</FormLabel>
                            <FormControl>
                              <Input 
                                {...field} 
                                value={field.value || ""} 
                                placeholder="e.g. QQ 12 34 56 C"
                                data-testid="input-niNumber" 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="personalUtrNumber"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Personal UTR Number</FormLabel>
                            <FormControl>
                              <Input 
                                {...field} 
                                value={field.value || ""} 
                                placeholder="10-digit number"
                                data-testid="input-personalUtrNumber" 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="photoIdVerified"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                            <FormControl>
                              <Checkbox
                                checked={field.value || false}
                                onCheckedChange={field.onChange}
                                data-testid="input-photoIdVerified"
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel>Photo ID Verified</FormLabel>
                              <FormDescription>
                                Passport or driving licence checked
                              </FormDescription>
                            </div>
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="addressVerified"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                            <FormControl>
                              <Checkbox
                                checked={field.value || false}
                                onCheckedChange={field.onChange}
                                data-testid="input-addressVerified"
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel>Address Verified</FormLabel>
                              <FormDescription>
                                Proof of address document checked
                              </FormDescription>
                            </div>
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                </TabsContent>

                {/* Contact Methods Tab */}
                <TabsContent value="contact" className="mt-0 space-y-6">
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FormField
                        control={form.control}
                        name="primaryEmail"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Primary Email</FormLabel>
                            <FormControl>
                              <Input 
                                type="email" 
                                {...field} 
                                value={field.value || ""} 
                                placeholder="email@example.com"
                                data-testid="input-primaryEmail" 
                              />
                            </FormControl>
                            <FormDescription>
                              Main email for communications
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="primaryPhone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Primary Mobile</FormLabel>
                            <FormControl>
                              <Input 
                                {...field} 
                                value={field.value || ""} 
                                placeholder="07123456789"
                                data-testid="input-primaryPhone" 
                              />
                            </FormControl>
                            <FormDescription>
                              UK mobile for SMS notifications
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* Secondary Contacts - Improved accordion styling */}
                    <Collapsible open={showSecondaryContacts} onOpenChange={setShowSecondaryContacts}>
                      <CollapsibleTrigger asChild>
                        <button
                          type="button"
                          className="w-full flex items-center justify-between p-3 rounded-lg border bg-muted/40 hover:bg-muted/60 transition-colors"
                          data-testid="toggle-secondary-contacts"
                        >
                          <div className="flex items-center gap-2">
                            <Plus className={`h-4 w-4 transition-transform ${showSecondaryContacts ? 'rotate-45' : ''}`} />
                            <Mail className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-medium">Additional Contact Details</span>
                          </div>
                          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${showSecondaryContacts ? 'rotate-180' : ''}`} />
                        </button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="pt-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 border rounded-lg bg-background">
                          <FormField
                            control={form.control}
                            name="email"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Additional Email</FormLabel>
                                <FormControl>
                                  <Input 
                                    type="email" 
                                    {...field} 
                                    value={field.value || ""} 
                                    placeholder="secondary@example.com"
                                    data-testid="input-email" 
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          <FormField
                            control={form.control}
                            name="telephone"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Additional Phone</FormLabel>
                                <FormControl>
                                  <Input 
                                    {...field} 
                                    value={field.value || ""} 
                                    placeholder="Landline or other"
                                    data-testid="input-telephone" 
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          <FormField
                            control={form.control}
                            name="email2"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Secondary Email</FormLabel>
                                <FormControl>
                                  <Input 
                                    type="email" 
                                    {...field} 
                                    value={field.value || ""} 
                                    data-testid="input-email2" 
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          <FormField
                            control={form.control}
                            name="telephone2"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Secondary Phone</FormLabel>
                                <FormControl>
                                  <Input 
                                    {...field} 
                                    value={field.value || ""} 
                                    data-testid="input-telephone2" 
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </CollapsibleContent>
                    </Collapsible>

                    {/* Social Links - Improved accordion styling */}
                    <Collapsible open={showSocialLinks} onOpenChange={setShowSocialLinks}>
                      <CollapsibleTrigger asChild>
                        <button
                          type="button"
                          className="w-full flex items-center justify-between p-3 rounded-lg border bg-muted/40 hover:bg-muted/60 transition-colors"
                          data-testid="toggle-social-links"
                        >
                          <div className="flex items-center gap-2">
                            <Plus className={`h-4 w-4 transition-transform ${showSocialLinks ? 'rotate-45' : ''}`} />
                            <Globe className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-medium">Social & Professional Links</span>
                          </div>
                          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${showSocialLinks ? 'rotate-180' : ''}`} />
                        </button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="pt-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 border rounded-lg bg-background">
                          <FormField
                            control={form.control}
                            name="linkedinUrl"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>LinkedIn</FormLabel>
                                <FormControl>
                                  <Input 
                                    {...field} 
                                    placeholder="https://linkedin.com/in/..." 
                                    data-testid="input-linkedinUrl" 
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          <FormField
                            control={form.control}
                            name="twitterUrl"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Twitter/X</FormLabel>
                                <FormControl>
                                  <Input 
                                    {...field} 
                                    placeholder="https://twitter.com/..." 
                                    data-testid="input-twitterUrl" 
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          <FormField
                            control={form.control}
                            name="facebookUrl"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Facebook</FormLabel>
                                <FormControl>
                                  <Input 
                                    {...field} 
                                    placeholder="https://facebook.com/..." 
                                    data-testid="input-facebookUrl" 
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          <FormField
                            control={form.control}
                            name="instagramUrl"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Instagram</FormLabel>
                                <FormControl>
                                  <Input 
                                    {...field} 
                                    placeholder="https://instagram.com/..." 
                                    data-testid="input-instagramUrl" 
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          <FormField
                            control={form.control}
                            name="tiktokUrl"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>TikTok</FormLabel>
                                <FormControl>
                                  <Input 
                                    {...field} 
                                    placeholder="https://tiktok.com/@..." 
                                    data-testid="input-tiktokUrl" 
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  </div>
                </TabsContent>

                {/* Address Tab - Now simpler without compliance accordion */}
                <TabsContent value="address" className="mt-0 space-y-6">
                  <div className="space-y-6">
                    {/* Address Lookup */}
                    <AddressLookup onAddressSelect={handleAddressSelect} />

                    {/* Manual Address Fields */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FormField
                        control={form.control}
                        name="addressLine1"
                        render={({ field }) => (
                          <FormItem className="md:col-span-2">
                            <FormLabel>Address Line 1</FormLabel>
                            <FormControl>
                              <Input 
                                {...field} 
                                value={field.value || ""} 
                                placeholder="Street address"
                                data-testid="input-addressLine1" 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="locality"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Town/City</FormLabel>
                            <FormControl>
                              <Input 
                                {...field} 
                                value={field.value || ""} 
                                data-testid="input-locality" 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="region"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>County/Region</FormLabel>
                            <FormControl>
                              <Input 
                                {...field} 
                                value={field.value || ""} 
                                data-testid="input-region" 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="postalCode"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Postcode</FormLabel>
                            <FormControl>
                              <Input 
                                {...field} 
                                value={field.value || ""} 
                                placeholder="e.g. SW1A 1AA"
                                data-testid="input-postalCode" 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="country"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Country</FormLabel>
                            <FormControl>
                              <Input 
                                {...field} 
                                value={field.value || ""} 
                                placeholder="United Kingdom"
                                data-testid="input-country" 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                </TabsContent>
              </div>
            </Tabs>

            <div className="flex justify-between items-center pt-4 border-t mt-4">
              <div className="text-sm text-muted-foreground">
                {activeTab === "personal" && "Step 1 of 3"}
                {activeTab === "contact" && "Step 2 of 3"}
                {activeTab === "address" && "Step 3 of 3"}
                {!allTabsVisited && (
                  <span className="ml-2 text-orange-600">
                    ({unvisitedCount} tab{unvisitedCount > 1 ? 's' : ''} not reviewed)
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={onClose}
                  data-testid="button-cancel-add-person"
                >
                  Cancel
                </Button>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      <Button 
                        type="submit" 
                        disabled={isSaving || !allTabsVisited}
                        data-testid="button-save-add-person"
                      >
                        {isSaving ? "Adding..." : "Add Person"}
                      </Button>
                    </span>
                  </TooltipTrigger>
                  {!allTabsVisited && (
                    <TooltipContent>
                      <p>Please review all tabs before adding</p>
                    </TooltipContent>
                  )}
                </Tooltip>
              </div>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
