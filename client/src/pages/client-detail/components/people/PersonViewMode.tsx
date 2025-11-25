import { User as UserIcon, MapPin, Settings, Phone, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { 
  ClientPersonWithPerson, 
  PeopleServiceWithRelations 
} from "../../utils/types";
import { formatPersonName, formatBirthDate, maskIdentifier } from "../../utils/formatters";

interface PersonViewModeProps {
  clientPerson: ClientPersonWithPerson;
  revealedIdentifiers: Set<string>;
  setRevealedIdentifiers: (fn: (prev: Set<string>) => Set<string>) => void;
  onEdit: () => void;
  peopleServices?: PeopleServiceWithRelations[];
}

export function PersonViewMode({ 
  clientPerson, 
  revealedIdentifiers, 
  setRevealedIdentifiers, 
  onEdit,
  peopleServices 
}: PersonViewModeProps) {
  return (
    <div className="space-y-6 pt-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Basic Information */}
        <div className="space-y-4">
          <h5 className="font-medium text-sm flex items-center">
            <UserIcon className="h-4 w-4 mr-2 text-muted-foreground" />
            Basic Information
          </h5>
          
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
            
          </div>
        </div>

        {/* Address Information */}
        <div className="space-y-4">
          <h5 className="font-medium text-sm flex items-center">
            <MapPin className="h-4 w-4 mr-2 text-muted-foreground" />
            Address Information
          </h5>
          
          {(() => {
            const person = clientPerson.person;
            const hasAddress = !!(person.addressLine1 || person.addressLine2 || person.locality || person.region || person.postalCode || person.country);
            
            if (!hasAddress) {
              return (
                <p className="text-sm text-muted-foreground italic p-4 border rounded-lg bg-muted/30">
                  No address information available
                </p>
              );
            }

            const addressParts: string[] = [];
            const usedValues = new Set<string>();
            
            [person.addressLine1, person.addressLine2].forEach(line => {
              if (line && line.trim() && !usedValues.has(line.trim().toLowerCase())) {
                addressParts.push(line.trim());
                usedValues.add(line.trim().toLowerCase());
              }
            });
            
            const locationParts = [person.locality, person.region, person.postalCode]
              .filter(part => part && part.trim() && !usedValues.has(part.trim().toLowerCase()))
              .map(part => part!.trim());
            
            if (locationParts.length > 0) {
              addressParts.push(locationParts.join(", "));
            }
            
            if (person.country && person.country.trim() && !usedValues.has(person.country.trim().toLowerCase())) {
              addressParts.push(person.country.trim());
            }

            return (
              <div className="p-4 rounded-lg bg-background border">
                <div className="space-y-1 text-sm" data-testid={`text-person-address-${clientPerson.id}`}>
                  {addressParts.map((part, index) => (
                    <div key={index} className={index === 0 ? "font-medium" : ""}>
                      {part}
                    </div>
                  ))}
                </div>
                {person.addressVerified && (
                  <div className="flex items-center space-x-2 mt-3 pt-3 border-t">
                    <Check className="w-4 h-4 text-green-600" />
                    <span className="text-sm text-green-600 font-medium">Address Verified</span>
                  </div>
                )}
              </div>
            );
          })()}
        </div>

        {/* Verification & Sensitive Information */}
        <div className="space-y-4">
          <h5 className="font-medium text-sm flex items-center">
            <Settings className="h-4 w-4 mr-2 text-muted-foreground" />
            Verification & Details
          </h5>
          
          <div className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-lg border">
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium">Main Contact</span>
                </div>
                <div className="flex items-center space-x-2">
                  {clientPerson.person.isMainContact ? (
                    <>
                      <Check className="w-4 h-4 text-green-600" />
                      <span className="text-sm text-green-600 font-medium">Yes</span>
                    </>
                  ) : (
                    <span className="text-sm text-muted-foreground">No</span>
                  )}
                </div>
              </div>
              
              <div className="flex items-center justify-between p-3 rounded-lg border">
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium">Photo ID Verified</span>
                </div>
                <div className="flex items-center space-x-2">
                  {clientPerson.person.photoIdVerified ? (
                    <>
                      <Check className="w-4 h-4 text-green-600" />
                      <span className="text-sm text-green-600 font-medium">Verified</span>
                    </>
                  ) : (
                    <span className="text-sm text-muted-foreground">Not verified</span>
                  )}
                </div>
              </div>
              
              <div className="flex items-center justify-between p-3 rounded-lg border">
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium">Address Verified</span>
                </div>
                <div className="flex items-center space-x-2">
                  {clientPerson.person.addressVerified ? (
                    <>
                      <Check className="w-4 h-4 text-green-600" />
                      <span className="text-sm text-green-600 font-medium">Verified</span>
                    </>
                  ) : (
                    <span className="text-sm text-muted-foreground">Not verified</span>
                  )}
                </div>
              </div>
            </div>
            
            {(clientPerson.person.niNumber || clientPerson.person.personalUtrNumber) && (
              <div className="p-4 rounded-lg border border-dashed bg-muted/30">
                <h6 className="text-sm font-medium mb-3">Sensitive Information</h6>
                <div className="space-y-3">
                  {clientPerson.person.niNumber && (
                    <div>
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium text-muted-foreground">NI Number</label>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-2 text-xs"
                          data-testid={`button-reveal-ni-${clientPerson.id}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            const key = `ni-${clientPerson.person.id}`;
                            setRevealedIdentifiers(prev => {
                              const next = new Set(prev);
                              if (next.has(key)) {
                                next.delete(key);
                              } else {
                                next.add(key);
                              }
                              return next;
                            });
                          }}
                        >
                          {revealedIdentifiers.has(`ni-${clientPerson.person.id}`) ? 'Hide' : 'Show'}
                        </Button>
                      </div>
                      <p className="font-mono text-sm mt-1" data-testid={`text-ni-number-${clientPerson.id}`}>
                        {revealedIdentifiers.has(`ni-${clientPerson.person.id}`) 
                          ? clientPerson.person.niNumber 
                          : maskIdentifier(clientPerson.person.niNumber, 2)}
                      </p>
                    </div>
                  )}
                  {clientPerson.person.personalUtrNumber && (
                    <div>
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium text-muted-foreground">Personal UTR</label>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-2 text-xs"
                          data-testid={`button-reveal-utr-${clientPerson.id}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            const key = `utr-${clientPerson.person.id}`;
                            setRevealedIdentifiers(prev => {
                              const next = new Set(prev);
                              if (next.has(key)) {
                                next.delete(key);
                              } else {
                                next.add(key);
                              }
                              return next;
                            });
                          }}
                        >
                          {revealedIdentifiers.has(`utr-${clientPerson.person.id}`) ? 'Hide' : 'Show'}
                        </Button>
                      </div>
                      <p className="font-mono text-sm mt-1" data-testid={`text-utr-number-${clientPerson.id}`}>
                        {revealedIdentifiers.has(`utr-${clientPerson.person.id}`) 
                          ? clientPerson.person.personalUtrNumber 
                          : maskIdentifier(clientPerson.person.personalUtrNumber, 2)}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Extended Contact Information - New 1-column section */}
      <div className="space-y-4 border-t pt-6">
        <h4 className="font-bold text-base flex items-center border-b pb-2 mb-4">
          <Phone className="h-5 w-5 mr-2 text-primary" />
          Contact Information
        </h4>
        
        <div className="grid grid-cols-1 gap-4">
          {/* Primary contact info */}
          <div className="bg-muted/30 rounded-lg p-4 space-y-3">
            <h6 className="text-sm font-medium text-muted-foreground">Primary Contact Details</h6>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium">Email:</span> {clientPerson.person.primaryEmail || clientPerson.person.email || "Not provided"}
              </div>
              <div>
                <span className="font-medium">Phone:</span> {clientPerson.person.primaryPhone || clientPerson.person.telephone || "Not provided"}
              </div>
            </div>
          </div>

          {/* Secondary contact info */}
          {(clientPerson.person.email2 || clientPerson.person.telephone2) && (
            <div className="space-y-3">
              <h6 className="text-sm font-medium">Additional Contact Details</h6>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Secondary Email</label>
                  <p className="text-sm mt-1" data-testid={`view-email2-${clientPerson.id}`}>
                    {clientPerson.person.email2 || 'Not provided'}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Secondary Phone</label>
                  <p className="text-sm mt-1" data-testid={`view-telephone2-${clientPerson.id}`}>
                    {clientPerson.person.telephone2 || 'Not provided'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Social media profiles */}
          <div className="space-y-3">
            <h6 className="text-sm font-medium">Social Media & Professional Profiles</h6>
            {(clientPerson.person.linkedinUrl || 
              clientPerson.person.twitterUrl || 
              clientPerson.person.facebookUrl || 
              clientPerson.person.instagramUrl || 
              clientPerson.person.tiktokUrl) ? (
              <div className="grid grid-cols-1 gap-3">
                {clientPerson.person.linkedinUrl && (
                  <div className="flex items-center space-x-3 p-3 rounded-lg border bg-background">
                    <div className="text-blue-600">
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                      </svg>
                    </div>
                    <div className="flex-1">
                      <label className="text-sm font-medium text-muted-foreground">LinkedIn</label>
                      <a 
                        href={clientPerson.person.linkedinUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:underline block"
                        data-testid={`view-linkedinUrl-${clientPerson.id}`}
                      >
                        {clientPerson.person.linkedinUrl}
                      </a>
                    </div>
                  </div>
                )}

                {clientPerson.person.twitterUrl && (
                  <div className="flex items-center space-x-3 p-3 rounded-lg border bg-background">
                    <div className="text-black dark:text-white">
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                      </svg>
                    </div>
                    <div className="flex-1">
                      <label className="text-sm font-medium text-muted-foreground">Twitter/X</label>
                      <a 
                        href={clientPerson.person.twitterUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-sm text-black dark:text-white hover:underline block"
                        data-testid={`view-twitterUrl-${clientPerson.id}`}
                      >
                        {clientPerson.person.twitterUrl}
                      </a>
                    </div>
                  </div>
                )}

                {clientPerson.person.facebookUrl && (
                  <div className="flex items-center space-x-3 p-3 rounded-lg border bg-background">
                    <div className="text-blue-600">
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                      </svg>
                    </div>
                    <div className="flex-1">
                      <label className="text-sm font-medium text-muted-foreground">Facebook</label>
                      <a 
                        href={clientPerson.person.facebookUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:underline block"
                        data-testid={`view-facebookUrl-${clientPerson.id}`}
                      >
                        {clientPerson.person.facebookUrl}
                      </a>
                    </div>
                  </div>
                )}

                {clientPerson.person.instagramUrl && (
                  <div className="flex items-center space-x-3 p-3 rounded-lg border bg-background">
                    <div className="text-pink-600">
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 6.618 5.367 11.986 11.988 11.986C18.636 23.973 24 18.605 24 11.987 24 5.367 18.636.001 12.017.001zm5.568 16.855c-.778.778-1.697 1.139-2.773 1.139H9.188c-1.076 0-1.995-.361-2.773-1.139S5.276 15.158 5.276 14.082V9.917c0-1.076.361-1.995 1.139-2.773s1.697-1.139 2.773-1.139h5.624c1.076 0 1.995.361 2.773 1.139s1.139 1.697 1.139 2.773v4.165c0 1.076-.361 1.995-1.139 2.773zm-8.195-7.638a3.82 3.82 0 013.821-3.821c2.108 0 3.821 1.713 3.821 3.821s-1.713 3.821-3.821 3.821a3.82 3.82 0 01-3.821-3.821zm6.148-1.528a.905.905 0 11-1.81 0 .905.905 0 011.81 0z"/>
                      </svg>
                    </div>
                    <div className="flex-1">
                      <label className="text-sm font-medium text-muted-foreground">Instagram</label>
                      <a 
                        href={clientPerson.person.instagramUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-sm text-pink-600 hover:underline block"
                        data-testid={`view-instagramUrl-${clientPerson.id}`}
                      >
                        {clientPerson.person.instagramUrl}
                      </a>
                    </div>
                  </div>
                )}

                {clientPerson.person.tiktokUrl && (
                  <div className="flex items-center space-x-3 p-3 rounded-lg border bg-background">
                    <div className="text-black dark:text-white">
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/>
                      </svg>
                    </div>
                    <div className="flex-1">
                      <label className="text-sm font-medium text-muted-foreground">TikTok</label>
                      <a 
                        href={clientPerson.person.tiktokUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-sm text-black dark:text-white hover:underline block"
                        data-testid={`view-tiktokUrl-${clientPerson.id}`}
                      >
                        {clientPerson.person.tiktokUrl}
                      </a>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic p-4 border rounded-lg bg-muted/30" data-testid={`text-no-social-links-${clientPerson.id}`}>
                No social media profiles provided
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Personal Services section */}
      {peopleServices && (
        <div className="space-y-4 border-t pt-6">
          <h4 className="font-bold text-base flex items-center border-b pb-2 mb-4">
            <Settings className="h-5 w-5 mr-2 text-primary" />
            Personal Services
          </h4>

          {(() => {
            const personServices = peopleServices.filter(ps => ps.personId === clientPerson.person.id);
            
            if (personServices.length === 0) {
              return (
                <div className="p-4 rounded-lg border border-dashed bg-muted/30 text-center">
                  <p className="text-sm text-muted-foreground italic">
                    No personal services assigned to this person
                  </p>
                </div>
              );
            }

            return (
              <div className="space-y-3">
                {personServices.map((peopleService) => (
                  <div 
                    key={peopleService.id}
                    className="p-4 rounded-lg border bg-background"
                    data-testid={`personal-service-${peopleService.id}`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h6 className="font-medium">{peopleService.service?.name}</h6>
                        {peopleService.service?.description && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {peopleService.service.description}
                          </p>
                        )}
                      </div>
                      {peopleService.serviceOwner && (
                        <div className="text-sm text-muted-foreground">
                          Owner: {peopleService.serviceOwner.firstName} {peopleService.serviceOwner.lastName}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      )}

      <div className="flex justify-end pt-4 border-t">
        <Button 
          variant="outline" 
          size="sm"
          data-testid={`button-edit-person-${clientPerson.id}`}
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
        >
          Edit Details
        </Button>
      </div>
    </div>
  );
}
