import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { User as UserIcon, MapPin, Settings, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
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
import AddressLookup from "@/components/address-lookup";
import { ClientPersonWithPerson, UpdatePersonData, updatePersonSchema } from "../../utils/types";

interface PersonEditFormProps {
  clientPerson: ClientPersonWithPerson;
  onSave: (data: UpdatePersonData) => void;
  onCancel: () => void;
  isSaving: boolean;
}

export function PersonEditForm({ 
  clientPerson, 
  onSave, 
  onCancel, 
  isSaving 
}: PersonEditFormProps) {
  const form = useForm<UpdatePersonData>({
    resolver: zodResolver(updatePersonSchema),
    defaultValues: {
      fullName: clientPerson.person.fullName || "",
      title: clientPerson.person.title || "",
      dateOfBirth: clientPerson.person.dateOfBirth || "",
      nationality: clientPerson.person.nationality || "",
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

  const handleSubmit = (data: UpdatePersonData) => {
    if (data.primaryPhone && data.primaryPhone.trim()) {
      let cleanPhone = data.primaryPhone.replace(/[^\d]/g, '');
      
      if (cleanPhone.startsWith('07') && cleanPhone.length === 11) {
        data.primaryPhone = `+447${cleanPhone.slice(2)}`;
      } else if (cleanPhone.startsWith('447') && cleanPhone.length === 12) {
        data.primaryPhone = `+${cleanPhone}`;
      }
    }
    
    onSave(data);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6 pt-4">
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
                  <FormLabel>Full Name</FormLabel>
                  <FormControl>
                    <Input {...field} data-testid={`input-fullName-${clientPerson.id}`} />
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
                    <Input {...field} value={field.value || ""} data-testid={`input-title-${clientPerson.id}`} />
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
                    <Input {...field} value={field.value || ""} type="date" data-testid={`input-dateOfBirth-${clientPerson.id}`} />
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
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
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
              )}
            />
            
            <FormField
              control={form.control}
              name="occupation"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Occupation</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value || ""} data-testid={`input-occupation-${clientPerson.id}`} />
                  </FormControl>
                  <FormMessage />
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
            
            <div className="space-y-3">
              <AddressLookup
                onAddressSelect={(address) => {
                  form.setValue("addressLine1", address.addressLine1);
                  form.setValue("addressLine2", address.addressLine2 || "");
                  form.setValue("locality", address.locality);
                  form.setValue("region", address.region);
                  form.setValue("postalCode", address.postalCode);
                  form.setValue("country", address.country);
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

          {/* Verification & Sensitive Information */}
          <div className="space-y-4">
            <h5 className="font-medium text-sm flex items-center">
              <Settings className="h-4 w-4 mr-2 text-muted-foreground" />
              Verification & Details
            </h5>
            
            <FormField
              control={form.control}
              name="isMainContact"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Main Contact</FormLabel>
                    <div className="text-sm text-muted-foreground">
                      This person is the primary contact
                    </div>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value || false}
                      onCheckedChange={field.onChange}
                      data-testid={`switch-isMainContact-${clientPerson.id}`}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="photoIdVerified"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={field.value || false}
                      onCheckedChange={field.onChange}
                      data-testid={`checkbox-photoIdVerified-${clientPerson.id}`}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Photo ID Verified</FormLabel>
                    <div className="text-sm text-muted-foreground">
                      Official photo identification has been verified
                    </div>
                  </div>
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="addressVerified"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={field.value || false}
                      onCheckedChange={field.onChange}
                      data-testid={`checkbox-addressVerified-${clientPerson.id}`}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Address Verified</FormLabel>
                    <div className="text-sm text-muted-foreground">
                      Address has been verified through official documents
                    </div>
                  </div>
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="niNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>NI Number</FormLabel>
                  <FormControl>
                    <Input 
                      {...field} 
                      placeholder="AB123456C"
                      data-testid={`input-niNumber-${clientPerson.id}`}
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
                  <FormLabel>Personal UTR</FormLabel>
                  <FormControl>
                    <Input 
                      {...field} 
                      placeholder="1234567890"
                      data-testid={`input-personalUtrNumber-${clientPerson.id}`}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* Extended Contact Information - New 1-column section */}
        <div className="space-y-4 border-t pt-6">
          <h5 className="font-medium text-sm flex items-center">
            <Phone className="h-4 w-4 mr-2 text-muted-foreground" />
            Contact Information
          </h5>
          
          <div className="grid grid-cols-1 gap-4">
            {/* Primary contact info - editable fields */}
            <div className="space-y-4">
              <h6 className="text-sm font-medium">Primary Contact Details (for SMS & Email)</h6>
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="primaryPhone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Primary Mobile Phone</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          type="tel" 
                          placeholder="07123456789"
                          data-testid={`input-primaryPhone-${clientPerson.id}`}
                        />
                      </FormControl>
                      <div className="text-xs text-muted-foreground">
                        UK mobile format (07xxxxxxxxx)
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="primaryEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Primary Email Address</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          type="email" 
                          placeholder="user@example.com"
                          data-testid={`input-primaryEmail-${clientPerson.id}`}
                        />
                      </FormControl>
                      <div className="text-xs text-muted-foreground">
                        Used for email communications
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Legacy contact info - read only display for reference */}
            {(clientPerson.person.email || clientPerson.person.telephone) && (
              <div className="bg-muted/30 rounded-lg p-4 space-y-3">
                <h6 className="text-sm font-medium text-muted-foreground">Legacy Contact Details</h6>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  {clientPerson.person.email && (
                    <div>
                      <span className="font-medium">Legacy Email:</span> {clientPerson.person.email}
                    </div>
                  )}
                  {clientPerson.person.telephone && (
                    <div>
                      <span className="font-medium">Legacy Phone:</span> {clientPerson.person.telephone}
                    </div>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  These are legacy fields. Use the Primary fields above for current contact information.
                </p>
              </div>
            )}

            {/* Secondary contact fields */}
            <div className="space-y-4">
              <h6 className="text-sm font-medium">Additional Contact Details</h6>
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="email2"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Secondary Email</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          type="email" 
                          placeholder="secondary@example.com"
                          data-testid={`input-email2-${clientPerson.id}`}
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
                          type="tel" 
                          placeholder="+44 1234 567890"
                          data-testid={`input-telephone2-${clientPerson.id}`}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Social media fields */}
            <div className="space-y-4">
              <h6 className="text-sm font-medium">Social Media & Professional Profiles</h6>
              
              <div className="space-y-3">
                <FormField
                  control={form.control}
                  name="linkedinUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>LinkedIn Profile</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          placeholder="https://linkedin.com/in/username"
                          data-testid={`input-linkedinUrl-${clientPerson.id}`}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="twitterUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Twitter/X Profile</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            placeholder="https://x.com/username"
                            data-testid={`input-twitterUrl-${clientPerson.id}`}
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
                        <FormLabel>Facebook Profile</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            placeholder="https://facebook.com/username"
                            data-testid={`input-facebookUrl-${clientPerson.id}`}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="instagramUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Instagram Profile</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            placeholder="https://instagram.com/username"
                            data-testid={`input-instagramUrl-${clientPerson.id}`}
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
                        <FormLabel>TikTok Profile</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            placeholder="https://tiktok.com/@username"
                            data-testid={`input-tiktokUrl-${clientPerson.id}`}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end space-x-2 pt-4 border-t">
          <Button 
            type="button" 
            variant="outline" 
            onClick={onCancel}
            disabled={isSaving}
            data-testid={`button-cancel-person-${clientPerson.id}`}
          >
            Cancel
          </Button>
          <Button 
            type="submit" 
            disabled={isSaving}
            data-testid={`button-save-person-${clientPerson.id}`}
          >
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
