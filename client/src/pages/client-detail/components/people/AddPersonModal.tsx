import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { User as UserIcon, MapPin, Phone, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import AddressLookup from "@/components/address-lookup";
import { InsertPersonData, insertPersonSchema } from "../../utils/types";

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
  const form = useForm<InsertPersonData>({
    resolver: zodResolver(insertPersonSchema),
    defaultValues: {
      fullName: "",
      title: "",
      dateOfBirth: "",
      nationality: "",
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

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Person</DialogTitle>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Basic Information */}
              <div className="space-y-4">
                <h5 className="font-medium text-sm flex items-center">
                  <UserIcon className="h-4 w-4 mr-2 text-muted-foreground" />
                  Basic Information
                </h5>
                
                <FormField
                  control={form.control}
                  name="fullName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Name *</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-fullName" />
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
                        <Input {...field} value={field.value || ""} data-testid="input-title" />
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
                        <Input type="date" {...field} value={field.value || ""} data-testid="input-dateOfBirth" />
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
                        <Input {...field} data-testid="input-nationality" />
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
                        <Input {...field} value={field.value || ""} data-testid="input-occupation" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="isMainContact"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                      <FormControl>
                        <input
                          type="checkbox"
                          checked={field.value || false}
                          onChange={field.onChange}
                          data-testid="input-isMainContact"
                        />
                      </FormControl>
                      <FormLabel>Main Contact</FormLabel>
                    </FormItem>
                  )}
                />
              </div>

              {/* Address Information */}
              <div className="space-y-4">
                <h5 className="font-medium text-sm flex items-center">
                  <MapPin className="h-4 w-4 mr-2 text-muted-foreground" />
                  Address Information
                </h5>
                
                <div>
                  <label className="text-sm font-medium">Address Lookup</label>
                  <AddressLookup 
                    onAddressSelect={handleAddressSelect}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Start typing to search for addresses
                  </p>
                </div>
                
                <FormField
                  control={form.control}
                  name="addressLine1"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Address Line 1</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value || ""} data-testid="input-addressLine1" />
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
                      <FormLabel>Postal Code</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value || ""} data-testid="input-postalCode" />
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
                      <FormLabel>Locality</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value || ""} data-testid="input-locality" />
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
                      <FormLabel>Region</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value || ""} data-testid="input-region" />
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
                        <Input {...field} value={field.value || ""} data-testid="input-country" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Verification & Other */}
              <div className="space-y-4">
                <h5 className="font-medium text-sm flex items-center">
                  <ShieldCheck className="h-4 w-4 mr-2 text-muted-foreground" />
                  Verification & Other
                </h5>
                
                <FormField
                  control={form.control}
                  name="niNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>NI Number</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value || ""} data-testid="input-niNumber" />
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
                      <FormLabel>Personal UTR</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value || ""} data-testid="input-personalUtrNumber" />
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
                        <input
                          type="checkbox"
                          checked={field.value || false}
                          onChange={field.onChange}
                          data-testid="input-photoIdVerified"
                        />
                      </FormControl>
                      <FormLabel>Photo ID Verified</FormLabel>
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="addressVerified"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                      <FormControl>
                        <input
                          type="checkbox"
                          checked={field.value || false}
                          onChange={field.onChange}
                          data-testid="input-addressVerified"
                        />
                      </FormControl>
                      <FormLabel>Address Verified</FormLabel>
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Contact Information - New 1-column section */}
            <div className="space-y-4 border-t pt-6">
              <h5 className="font-medium text-sm flex items-center">
                <Phone className="h-4 w-4 mr-2 text-muted-foreground" />
                Contact Information
              </h5>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Primary Contact */}
                <div className="space-y-4">
                  <h6 className="text-sm font-medium">Primary Contact Details</h6>
                  
                  <FormField
                    control={form.control}
                    name="primaryEmail"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Primary Email</FormLabel>
                        <FormControl>
                          <Input type="email" {...field} value={field.value || ""} data-testid="input-primaryEmail" />
                        </FormControl>
                        <FormDescription>
                          Main email address for SMS/Email communications
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
                        <FormLabel>Primary Mobile Phone</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            value={field.value || ""} 
                            placeholder="07123456789"
                            data-testid="input-primaryPhone" 
                          />
                        </FormControl>
                        <FormDescription>
                          UK mobile number for SMS (format: 07xxxxxxxxx)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Additional Email</FormLabel>
                        <FormControl>
                          <Input type="email" {...field} value={field.value || ""} data-testid="input-email" />
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
                          <Input {...field} value={field.value || ""} data-testid="input-telephone" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Secondary Contact */}
                <div className="space-y-4">
                  <h6 className="text-sm font-medium">Secondary Contact Details</h6>
                  
                  <FormField
                    control={form.control}
                    name="email2"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Secondary Email</FormLabel>
                        <FormControl>
                          <Input type="email" {...field} value={field.value || ""} data-testid="input-email2" />
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
                          <Input {...field} value={field.value || ""} data-testid="input-telephone2" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Social Media */}
              <div className="space-y-4">
                <h6 className="text-sm font-medium">Social Media & Professional Profiles</h6>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="linkedinUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>LinkedIn URL</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="https://linkedin.com/in/..." data-testid="input-linkedinUrl" />
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
                        <FormLabel>Twitter/X URL</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="https://twitter.com/..." data-testid="input-twitterUrl" />
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
                        <FormLabel>Facebook URL</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="https://facebook.com/..." data-testid="input-facebookUrl" />
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
                        <FormLabel>Instagram URL</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="https://instagram.com/..." data-testid="input-instagramUrl" />
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
                        <FormLabel>TikTok URL</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="https://tiktok.com/@..." data-testid="input-tiktokUrl" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-4 border-t">
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
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
