import { useParams, useLocation } from "wouter";
import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useIsMobile } from "@/hooks/use-mobile";
import BottomNav from "@/components/bottom-nav";
import SuperSearch from "@/components/super-search";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, MapPin, Phone, Mail, User as UserIcon, Globe, Check, ArrowLeft, Shield, Edit, Eye, EyeOff, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getQueryFn, apiRequest, queryClient } from "@/lib/queryClient";
import { showFriendlyError } from "@/lib/friendlyErrors";
import TopNavigation from "@/components/top-navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import type { Person, Client, ClientPerson, ClientPortalUser, PeopleService } from "@shared/schema";
import { useActivityTracker } from "@/lib/activityTracker";
import { EditPersonModal, UpdatePersonData } from "@/components/EditPersonModal";

type PersonWithDetails = Person & {
  relatedCompanies: Array<ClientPerson & { client: Client }>;
  portalUser?: ClientPortalUser | null;
  personalServices?: Array<any>;
};

function formatPersonName(fullName: string): string {
  if (!fullName) return '';
  
  if (fullName.includes(',')) {
    const [lastName, firstName] = fullName.split(',').map(part => part.trim());
    const formattedFirstName = firstName.toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
    const formattedLastName = lastName.toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
    return `${formattedFirstName} ${formattedLastName}`;
  }
  
  return fullName;
}

function formatBirthDate(dateOfBirth: string | Date | null): string {
  if (!dateOfBirth) return 'Not provided';
  
  if (typeof dateOfBirth === 'string') {
    const partialDatePattern = /^(\d{4})-(\d{2})(?:-01(?:T00:00:00(?:\.\d+)?Z?)?)?$/;
    const match = dateOfBirth.match(partialDatePattern);
    
    if (match) {
      const [, year, month] = match;
      const date = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, 1));
      
      if (isNaN(date.getTime())) {
        return 'Invalid date';
      }
      
      return date.toLocaleDateString('en-GB', { 
        month: 'long', 
        year: 'numeric',
        timeZone: 'UTC'
      });
    }
  }
  
  const date = new Date(dateOfBirth);
  
  if (isNaN(date.getTime())) {
    return 'Invalid date';
  }
  
  return date.toLocaleDateString('en-GB', {
    timeZone: 'UTC'
  });
}

function maskIdentifier(value: string, visibleChars = 2): string {
  if (!value || value.length <= visibleChars) return value;
  const masked = '*'.repeat(Math.max(0, value.length - visibleChars));
  return masked + value.slice(-visibleChars);
}

export default function PersonDetail() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const { trackPersonView } = useActivityTracker();
  
  const [revealedNI, setRevealedNI] = useState(false);
  const [revealedUTR, setRevealedUTR] = useState(false);
  const [showQRCode, setShowQRCode] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);

  // Track person view activity when component mounts
  useEffect(() => {
    if (id) {
      trackPersonView(id);
    }
  }, [id, trackPersonView]);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

  const { data: person, isLoading, error } = useQuery<PersonWithDetails>({
    queryKey: [`/api/people/${id}`],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: !!id,
  });

  // Update person mutation
  const updatePersonMutation = useMutation({
    mutationFn: async (data: UpdatePersonData) => {
      return await apiRequest("PATCH", `/api/people/${id}`, data);
    },
    onSuccess: () => {
      toast({
        title: "Person Updated",
        description: "Person details have been updated successfully",
      });
      setShowEditDialog(false);
      queryClient.invalidateQueries({ queryKey: [`/api/people/${id}`] });
    },
    onError: (error: any) => {
      showFriendlyError({ error: error?.message || error || "Failed to update person" });
    },
  });

  const handleShowQRCode = async () => {
    try {
      const validConnections = person?.relatedCompanies?.filter(conn => conn.client) || [];
      
      if (validConnections.length === 0) {
        showFriendlyError({ error: "No client connections found for this person" });
        return;
      }
      
      const firstConnection = validConnections[0];
      const email = person?.primaryEmail || person?.email;
      
      if (!email || !person) {
        showFriendlyError({ error: "No email address found for this person" });
        return;
      }
      
      const response = await apiRequest("POST", "/api/portal-user/generate-qr-code", {
        personId: id,
        clientId: firstConnection.client.id,
        email: email,
        name: formatPersonName(person.fullName),
      });
      
      setQrCodeDataUrl(response.qrCodeDataUrl);
      setShowQRCode(true);
    } catch (error: any) {
      showFriendlyError({ error: error?.message || error || "Failed to generate QR code" });
    }
  };

  const sendInviteMutation = useMutation({
    mutationFn: async () => {
      const validConnections = person?.relatedCompanies?.filter(conn => conn.client) || [];
      
      if (validConnections.length === 0) {
        throw new Error('No client connections found');
      }
      
      const firstConnection = validConnections[0];
      if (!person) throw new Error('Person not found');
      return await apiRequest("POST", "/api/portal-user/send-invitation", {
        personId: id,
        clientId: firstConnection.client.id,
        email: person.primaryEmail || person.email,
        name: formatPersonName(person.fullName),
        clientName: firstConnection.client.name,
      });
    },
    onSuccess: () => {
      toast({
        title: "Invitation Sent",
        description: `Portal invitation sent to ${person?.primaryEmail || person?.email}`,
      });
      queryClient.invalidateQueries({ queryKey: [`/api/people/${id}`] });
    },
    onError: (error: any) => {
      showFriendlyError({ error: error?.message || error || "Failed to send invitation" });
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <TopNavigation user={user} />
        <main className="container mx-auto py-6 space-y-6">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </main>
        <BottomNav onSearchClick={() => setMobileSearchOpen(true)} />
      </div>
    );
  }

  if (error || !person) {
    return (
      <div className="min-h-screen bg-background">
        <TopNavigation user={user} />
        <main className="container mx-auto py-6">
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-destructive mb-2">Failed to load person details</p>
              <Button onClick={() => setLocation('/people')} data-testid="button-back-to-people">
                Back to People
              </Button>
            </CardContent>
          </Card>
        </main>
        <BottomNav onSearchClick={() => setMobileSearchOpen(true)} />
      </div>
    );
  }

  const hasEmail = Boolean(person.primaryEmail || person.email);

  return (
    <div className="min-h-screen bg-background">
      <TopNavigation user={user} />

      <main className="page-container py-6 md:py-8 space-y-8">
        {/* Header Section */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.history.back()}
              data-testid="button-back"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="text-2xl md:text-3xl font-semibold tracking-tight" data-testid="text-person-name">
                {formatPersonName(person.fullName)}
              </h1>
              {person.title && (
                <p className="text-meta mt-1" data-testid="text-person-title">{person.title}</p>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="default"
              onClick={() => setShowEditDialog(true)}
              data-testid="button-edit-person"
            >
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
            {hasEmail && (
              <>
                <Button
                  variant="outline"
                  onClick={() => sendInviteMutation.mutate()}
                  disabled={sendInviteMutation.isPending}
                  data-testid="button-send-invite"
                >
                  <Mail className="h-4 w-4 mr-2" />
                  Send App Invite
                </Button>
                <Button
                  variant="outline"
                  onClick={handleShowQRCode}
                  data-testid="button-show-qr"
                >
                  <QrCode className="h-4 w-4 mr-2" />
                  Show QR Code
                </Button>
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Contact Information Card */}
          <Card data-testid="card-contact-info">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Phone className="h-5 w-5" />
                Contact Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm text-muted-foreground">Primary Email</label>
                <p className="font-medium" data-testid="text-primary-email">
                  {person.primaryEmail || person.email || '-'}
                </p>
              </div>
              {person.email2 && (
                <div>
                  <label className="text-sm text-muted-foreground">Secondary Email</label>
                  <p className="font-medium" data-testid="text-secondary-email">{person.email2}</p>
                </div>
              )}
              <div>
                <label className="text-sm text-muted-foreground">Primary Phone</label>
                <p className="font-medium" data-testid="text-primary-phone">
                  {person.primaryPhone || person.telephone || '-'}
                </p>
              </div>
              {person.telephone2 && (
                <div>
                  <label className="text-sm text-muted-foreground">Secondary Phone</label>
                  <p className="font-medium" data-testid="text-secondary-phone">{person.telephone2}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Personal Details Card */}
          <Card data-testid="card-personal-details">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserIcon className="h-5 w-5" />
                Personal Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {person.dateOfBirth && (
                <div>
                  <label className="text-sm text-muted-foreground">Date of Birth</label>
                  <p className="font-medium" data-testid="text-date-of-birth">
                    {formatBirthDate(person.dateOfBirth)}
                  </p>
                </div>
              )}
              {person.nationality && (
                <div>
                  <label className="text-sm text-muted-foreground">Nationality</label>
                  <p className="font-medium" data-testid="text-nationality">{person.nationality}</p>
                </div>
              )}
              {person.occupation && (
                <div>
                  <label className="text-sm text-muted-foreground">Occupation</label>
                  <p className="font-medium" data-testid="text-occupation">{person.occupation}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Address Card */}
          <Card data-testid="card-address">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Address
              </CardTitle>
            </CardHeader>
            <CardContent>
              {person.addressLine1 || person.addressLine2 || person.locality || person.region || person.postalCode || person.country ? (
                <div className="space-y-1" data-testid="text-address">
                  {person.addressLine1 && <p className="font-medium">{person.addressLine1}</p>}
                  {person.addressLine2 && <p>{person.addressLine2}</p>}
                  {person.locality && <p>{person.locality}</p>}
                  {person.region && <p>{person.region}</p>}
                  {person.postalCode && <p className="font-medium">{person.postalCode}</p>}
                  {person.country && <p className="text-muted-foreground">{person.country}</p>}
                </div>
              ) : (
                <p className="text-muted-foreground">No address information available</p>
              )}
            </CardContent>
          </Card>

          {/* Verification Status Card */}
          <Card data-testid="card-verification">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Verification Status
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">Photo ID Verified</span>
                {person.photoIdVerified ? (
                  <Badge variant="default" className="flex items-center gap-1" data-testid="badge-photo-verified">
                    <Check className="h-3 w-3" />
                    Verified
                  </Badge>
                ) : (
                  <Badge variant="secondary" data-testid="badge-photo-unverified">Not Verified</Badge>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Address Verified</span>
                {person.addressVerified ? (
                  <Badge variant="default" className="flex items-center gap-1" data-testid="badge-address-verified">
                    <Check className="h-3 w-3" />
                    Verified
                  </Badge>
                ) : (
                  <Badge variant="secondary" data-testid="badge-address-unverified">Not Verified</Badge>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Tax Identifiers Card */}
          {(person.niNumber || person.personalUtrNumber) && (
            <Card data-testid="card-tax-identifiers">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Tax Identifiers
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {person.niNumber && (
                  <div>
                    <label className="text-sm text-muted-foreground">National Insurance Number</label>
                    <div className="flex items-center gap-2">
                      <p className="font-medium font-mono" data-testid="text-ni-number">
                        {revealedNI ? person.niNumber : maskIdentifier(person.niNumber)}
                      </p>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setRevealedNI(!revealedNI)}
                        data-testid="button-toggle-ni"
                      >
                        {revealedNI ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                )}
                {person.personalUtrNumber && (
                  <div>
                    <label className="text-sm text-muted-foreground">Personal UTR Number</label>
                    <div className="flex items-center gap-2">
                      <p className="font-medium font-mono" data-testid="text-utr-number">
                        {revealedUTR ? person.personalUtrNumber : maskIdentifier(person.personalUtrNumber)}
                      </p>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setRevealedUTR(!revealedUTR)}
                        data-testid="button-toggle-utr"
                      >
                        {revealedUTR ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Social Media Card */}
          {(person.linkedinUrl || person.twitterUrl || person.facebookUrl || person.instagramUrl || person.tiktokUrl) && (
            <Card data-testid="card-social-media">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="h-5 w-5" />
                  Social Media
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {person.linkedinUrl && (
                  <div>
                    <label className="text-sm text-muted-foreground">LinkedIn</label>
                    <a 
                      href={person.linkedinUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-primary hover:underline block"
                      data-testid="link-linkedin"
                    >
                      {person.linkedinUrl}
                    </a>
                  </div>
                )}
                {person.twitterUrl && (
                  <div>
                    <label className="text-sm text-muted-foreground">Twitter</label>
                    <a 
                      href={person.twitterUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-primary hover:underline block"
                      data-testid="link-twitter"
                    >
                      {person.twitterUrl}
                    </a>
                  </div>
                )}
                {person.facebookUrl && (
                  <div>
                    <label className="text-sm text-muted-foreground">Facebook</label>
                    <a 
                      href={person.facebookUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-primary hover:underline block"
                      data-testid="link-facebook"
                    >
                      {person.facebookUrl}
                    </a>
                  </div>
                )}
                {person.instagramUrl && (
                  <div>
                    <label className="text-sm text-muted-foreground">Instagram</label>
                    <a 
                      href={person.instagramUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-primary hover:underline block"
                      data-testid="link-instagram"
                    >
                      {person.instagramUrl}
                    </a>
                  </div>
                )}
                {person.tiktokUrl && (
                  <div>
                    <label className="text-sm text-muted-foreground">TikTok</label>
                    <a 
                      href={person.tiktokUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-primary hover:underline block"
                      data-testid="link-tiktok"
                    >
                      {person.tiktokUrl}
                    </a>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Portal Access Card */}
          <Card data-testid="card-portal-access">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserIcon className="h-5 w-5" />
                Portal Access
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">Has Accessed App</span>
                {person.portalUser?.lastLogin ? (
                  <Badge variant="default" className="flex items-center gap-1" data-testid="badge-has-accessed">
                    <Check className="h-3 w-3" />
                    Yes
                  </Badge>
                ) : (
                  <Badge variant="secondary" data-testid="badge-not-accessed">No</Badge>
                )}
              </div>
              {person.portalUser?.lastLogin && (
                <div>
                  <label className="text-sm text-muted-foreground">Last Login</label>
                  <p className="font-medium" data-testid="text-last-login">
                    {new Date(person.portalUser.lastLogin).toLocaleString()}
                  </p>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-sm">Push Notifications</span>
                {person.portalUser?.pushNotificationsEnabled ? (
                  <Badge variant="default" className="flex items-center gap-1" data-testid="badge-push-enabled">
                    <Check className="h-3 w-3" />
                    Enabled
                  </Badge>
                ) : (
                  <Badge variant="secondary" data-testid="badge-push-disabled">Disabled</Badge>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Related Companies Card */}
          {person.relatedCompanies && person.relatedCompanies.length > 0 && (
            <Card data-testid="card-related-companies" className="md:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Related Companies
                  <Badge variant="secondary">{person.relatedCompanies.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {person.relatedCompanies.map((connection) => (
                    <div
                      key={connection.client.id}
                      className="p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer"
                      onClick={() => setLocation(`/clients/${connection.client.id}`)}
                      data-testid={`company-${connection.client.id}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
                            <Building2 className="h-6 w-6 text-primary" />
                          </div>
                          <div>
                            <h4 className="font-medium" data-testid={`text-company-name-${connection.client.id}`}>
                              {connection.client.name}
                            </h4>
                            {connection.officerRole && (
                              <p className="text-sm text-muted-foreground" data-testid={`text-role-${connection.client.id}`}>
                                {connection.officerRole}
                              </p>
                            )}
                          </div>
                        </div>
                        <Badge variant={connection.isPrimaryContact ? "default" : "secondary"}>
                          {connection.isPrimaryContact ? "Primary Contact" : "Contact"}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </main>

      {/* Edit Person Modal */}
      {person && (
        <EditPersonModal
          person={person}
          isOpen={showEditDialog}
          onClose={() => setShowEditDialog(false)}
          onSave={(data) => updatePersonMutation.mutate(data)}
          isSaving={updatePersonMutation.isPending}
        />
      )}

      {/* QR Code Dialog */}
      <Dialog open={showQRCode} onOpenChange={setShowQRCode}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Portal Access QR Code</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center space-y-4 py-4">
            {qrCodeDataUrl && (
              <img 
                src={qrCodeDataUrl} 
                alt="Portal QR Code" 
                className="w-64 h-64"
                data-testid="qr-code-image"
              />
            )}
            <p className="text-sm text-muted-foreground text-center">
              Scan this QR code to access the client portal
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Mobile Search Modal */}
      <SuperSearch 
        isOpen={mobileSearchOpen} 
        onOpenChange={setMobileSearchOpen}
      />

      <BottomNav onSearchClick={() => setMobileSearchOpen(true)} />
    </div>
  );
}
