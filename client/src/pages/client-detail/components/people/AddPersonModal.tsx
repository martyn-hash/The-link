import { useState } from "react";
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
  Check
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
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
import AddressLookup from "@/components/address-lookup";
import { InsertPersonData, addPersonSchema } from "../../utils/types";

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
  const [showSecondaryContacts, setShowSecondaryContacts] = useState(false);
  const [showSocialLinks, setShowSocialLinks] = useState(false);
  const [showComplianceFields, setShowComplianceFields] = useState(false);

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
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-xl">Add Related Person</DialogTitle>
          <DialogDescription>
            Add a new person to this client. Fill in the essential details first, then add more information as needed.
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col flex-1 overflow-hidden">
            <Tabs value={activeTab} onValueChange={handleTabChange} className="flex flex-col flex-1 overflow-hidden">
              <TabsList className="grid w-full grid-cols-3 mb-4">
                <TabsTrigger value="personal" className="flex items-center gap-2" data-testid="tab-personal">
                  <UserIcon className="h-4 w-4" />
                  <span className="hidden sm:inline">Personal</span>
                  {hasPersonalData && <Check className="h-3 w-3 text-green-600" />}
                </TabsTrigger>
                <TabsTrigger value="contact" className="flex items-center gap-2" data-testid="tab-contact">
                  <Phone className="h-4 w-4" />
                  <span className="hidden sm:inline">Contact</span>
                  {hasContactData && <Check className="h-3 w-3 text-green-600" />}
                </TabsTrigger>
                <TabsTrigger value="address" className="flex items-center gap-2" data-testid="tab-address">
                  <MapPin className="h-4 w-4" />
                  <span className="hidden sm:inline">Address</span>
                  {hasAddressData && <Check className="h-3 w-3 text-green-600" />}
                </TabsTrigger>
              </TabsList>

              <div className="flex-1 overflow-y-auto pr-2">
                {/* Personal Details Tab */}
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
                        <FormItem>
                          <FormLabel>Nationality</FormLabel>
                          <FormControl>
                            <Input 
                              {...field} 
                              placeholder="e.g. British"
                              data-testid="input-nationality" 
                            />
                          </FormControl>
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

                    {/* Secondary Contacts - Collapsible */}
                    <Collapsible open={showSecondaryContacts} onOpenChange={setShowSecondaryContacts}>
                      <CollapsibleTrigger asChild>
                        <Button 
                          type="button" 
                          variant="ghost" 
                          className="w-full justify-between p-0 h-auto hover:bg-transparent"
                          data-testid="toggle-secondary-contacts"
                        >
                          <span className="text-sm font-medium text-muted-foreground">
                            Additional Contact Details
                          </span>
                          {showSecondaryContacts ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="pt-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-muted/30 rounded-lg">
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

                    {/* Social Links - Collapsible */}
                    <Collapsible open={showSocialLinks} onOpenChange={setShowSocialLinks}>
                      <CollapsibleTrigger asChild>
                        <Button 
                          type="button" 
                          variant="ghost" 
                          className="w-full justify-between p-0 h-auto hover:bg-transparent"
                          data-testid="toggle-social-links"
                        >
                          <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                            <Globe className="h-4 w-4" />
                            Social & Professional Links
                          </span>
                          {showSocialLinks ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="pt-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg">
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

                {/* Address & Verification Tab */}
                <TabsContent value="address" className="mt-0 space-y-6">
                  <div className="space-y-6">
                    {/* Address Lookup */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Address Lookup</label>
                      <AddressLookup onAddressSelect={handleAddressSelect} />
                      <p className="text-xs text-muted-foreground">
                        Start typing a postcode or address to search, or enter manually below
                      </p>
                    </div>

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

                    {/* Compliance & Verification - Collapsible */}
                    <Collapsible open={showComplianceFields} onOpenChange={setShowComplianceFields}>
                      <CollapsibleTrigger asChild>
                        <Button 
                          type="button" 
                          variant="ghost" 
                          className="w-full justify-between p-0 h-auto hover:bg-transparent"
                          data-testid="toggle-compliance"
                        >
                          <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                            <ShieldCheck className="h-4 w-4" />
                            Compliance & Verification
                          </span>
                          {showComplianceFields ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="pt-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-muted/30 rounded-lg">
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
                      </CollapsibleContent>
                    </Collapsible>
                  </div>
                </TabsContent>
              </div>
            </Tabs>

            <div className="flex justify-between items-center pt-4 border-t mt-4">
              <div className="text-sm text-muted-foreground">
                {activeTab === "personal" && "Step 1 of 3"}
                {activeTab === "contact" && "Step 2 of 3"}
                {activeTab === "address" && "Step 3 of 3"}
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
                <Button 
                  type="submit" 
                  disabled={isSaving}
                  data-testid="button-save-add-person"
                >
                  {isSaving ? "Adding..." : "Add Person"}
                </Button>
              </div>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
