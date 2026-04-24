import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { AlertCircle, Calendar, Check, Loader2, Mail, Phone, Save, Settings, User, X } from 'lucide-react';
import { CountryCodeSelect } from './CountryCodeSelect';
import { EmailChangeDialog } from './EmailChangeDialog';
import { UserProfileModalProps } from './types';
import { useUserProfileModal } from './useUserProfileModal';

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function UserProfileModalView({ isOpen, onClose }: UserProfileModalProps) {
  const state = useUserProfileModal(isOpen);
  const {
    subscription, getStatusColor, getStatusIcon, profile, username, setUsername, firstName, setFirstName, lastName, setLastName,
    countryCode, setCountryCode, mobileNumber, setMobileNumber, loading, saveStatus, usernameError, changingEmail,
    showEmailChangeModal, setShowEmailChangeModal, newEmail, setNewEmail, emailChangeError, currentEmail,
    setEmailChangeError, setUsernameError, saveProfile, handleEmailChange, resetEmailDialog,
  } = state;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl bg-background border-border rounded-2xl p-0 [&>button]:hidden">
          <DialogHeader className="py-6 px-6 border-b border-border rounded-t-2xl">
            <div className="flex justify-between items-center">
              <DialogTitle className="text-2xl font-bold text-foreground flex items-center gap-2"><User className="w-6 h-6" />User Profile</DialogTitle>
              <Button variant="ghost" size="sm" onClick={onClose} className="text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted/50 transition-colors"><X className="w-5 h-5" /></Button>
            </div>
          </DialogHeader>

          <div className="p-6 space-y-6">
            {loading ? (
              <div className="flex items-center justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /><span className="ml-2 text-muted-foreground">Loading profile...</span></div>
            ) : (
              <>
                <div className="flex items-center gap-4">
                  <Avatar className="w-16 h-16"><AvatarFallback className="bg-primary text-primary-foreground text-lg">{profile?.email?.substring(0, 2).toUpperCase() || '??'}</AvatarFallback></Avatar>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold">{profile?.first_name ? `${profile.first_name} ${profile.last_name || ''}`.trim() : profile?.email?.split('@')[0] || 'User'}</h3>
                    <div className="flex items-center gap-3 mt-1">
                      <div className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${getStatusColor()}`}><span className="text-xs">{getStatusIcon()}</span>{subscription?.display_name || 'Free Plan'}</div>
                      <span className="text-xs text-muted-foreground">-</span>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Calendar className="w-3 h-3" />Member since {formatDate(profile?.created_at || '')}</div>
                    </div>
                  </div>
                </div>
                <Separator />
                <Card>
                  <CardHeader><CardTitle className="flex items-center gap-2"><Settings className="w-5 h-5" />Profile Information</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="username" className="flex items-center gap-2 mb-2"><User className="w-4 h-4" />Username</Label>
                      <Input id="username" type="text" value={username} onChange={(e) => { setUsername(e.target.value); setUsernameError(''); }} placeholder="Enter a unique username" className="rounded-lg" />
                      {usernameError && <p className="text-xs text-red-500 mt-1">{usernameError}</p>}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div><Label htmlFor="firstName" className="flex items-center gap-2 mb-2"><User className="w-4 h-4" />First Name</Label><Input id="firstName" type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Enter your first name" className="rounded-lg" /></div>
                      <div><Label htmlFor="lastName" className="mb-2 block">Last Name</Label><Input id="lastName" type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Enter your last name" className="rounded-lg" /></div>
                    </div>
                    <div>
                      <Label htmlFor="email" className="flex items-center gap-2 mb-2"><Mail className="w-4 h-4" />Email Address</Label>
                      <div className="flex gap-2"><Input id="email" type="email" value={currentEmail} disabled className="bg-muted rounded-lg flex-1" /><Button type="button" variant="outline" onClick={() => setShowEmailChangeModal(true)} className="rounded-lg whitespace-nowrap">Change Email</Button></div>
                    </div>
                    <div>
                      <Label htmlFor="mobileNumber" className="flex items-center gap-2 mb-2"><Phone className="w-4 h-4" />Mobile Number <span className="text-muted-foreground text-xs">(optional)</span></Label>
                      <div className="flex gap-2"><CountryCodeSelect value={countryCode} onValueChange={setCountryCode} /><Input id="mobileNumber" type="tel" value={mobileNumber} onChange={(e) => setMobileNumber(e.target.value)} placeholder="(555) 123-4567" className="flex-1 rounded-lg" /></div>
                    </div>
                    <div className="flex justify-end pt-4">
                      <Button onClick={saveProfile} disabled={saveStatus !== 'idle'} className={`group rounded-lg transition-all duration-300 ease-out hover:scale-[1.05] active:scale-95 disabled:scale-100 disabled:hover:scale-100 ${saveStatus === 'success' ? 'bg-green-600 hover:bg-green-600' : saveStatus === 'error' ? 'bg-red-600 hover:bg-red-600' : ''}`}>
                        {saveStatus === 'saving' && <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</>}
                        {saveStatus === 'success' && <><Check className="w-4 h-4 mr-2" />Saved!</>}
                        {saveStatus === 'error' && <><AlertCircle className="w-4 h-4 mr-2" />Error!</>}
                        {saveStatus === 'idle' && <><Save className="w-4 h-4 mr-2 transition-transform duration-300 group-hover:rotate-[15deg]" />Save Changes</>}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <EmailChangeDialog
        open={showEmailChangeModal}
        changingEmail={changingEmail}
        currentEmail={currentEmail}
        newEmail={newEmail}
        emailChangeError={emailChangeError}
        onOpenChange={(open) => {
          if (!open) {
            resetEmailDialog();
            return;
          }
          setShowEmailChangeModal(open);
        }}
        onNewEmailChange={setNewEmail}
        onClearError={() => setEmailChangeError('')}
        onSubmit={handleEmailChange}
      />
    </>
  );
}

