import React from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { AlertCircle, Calendar, Check, Loader2, Mail, Phone, Save, Settings, User } from 'lucide-react';
import { CountryFlag, countryCodes } from './countryOptions';
import { UserProfile } from './types';

interface ProfileFormProps {
  profile: UserProfile | null;
  loading: boolean;
  username: string;
  firstName: string;
  lastName: string;
  countryCode: string;
  mobileNumber: string;
  currentEmail: string;
  usernameError: string;
  saveStatus: 'idle' | 'saving' | 'success' | 'error';
  subscriptionName: string;
  statusColor: string;
  statusIcon: string;
  onUsernameChange: (value: string) => void;
  onFirstNameChange: (value: string) => void;
  onLastNameChange: (value: string) => void;
  onCountryCodeChange: (value: string) => void;
  onMobileNumberChange: (value: string) => void;
  onOpenEmailDialog: () => void;
  onSaveProfile: () => void;
  formatDate: (dateString: string) => string;
}

export function ProfileForm(props: ProfileFormProps) {
  const {
    profile,
    loading,
    username,
    firstName,
    lastName,
    countryCode,
    mobileNumber,
    currentEmail,
    usernameError,
    saveStatus,
    subscriptionName,
    statusColor,
    statusIcon,
    onUsernameChange,
    onFirstNameChange,
    onLastNameChange,
    onCountryCodeChange,
    onMobileNumberChange,
    onOpenEmailDialog,
    onSaveProfile,
    formatDate,
  } = props;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        <span className="ml-2 text-muted-foreground">Loading profile...</span>
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center gap-4">
        <Avatar className="w-16 h-16">
          <AvatarFallback className="bg-primary text-primary-foreground text-lg">{profile?.email?.substring(0, 2).toUpperCase() || '??'}</AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <h3 className="text-lg font-semibold">{profile?.first_name ? `${profile.first_name} ${profile.last_name || ''}`.trim() : profile?.email?.split('@')[0] || 'User'}</h3>
          <div className="flex items-center gap-3 mt-1">
            <div className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${statusColor}`}>
              <span className="text-xs">{statusIcon}</span>
              {subscriptionName}
            </div>
            <span className="text-xs text-muted-foreground">•</span>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Calendar className="w-3 h-3" />
              Member since {formatDate(profile?.created_at || '')}
            </div>
          </div>
        </div>
      </div>

      <Separator />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Profile Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="username" className="flex items-center gap-2 mb-2"><User className="w-4 h-4" />Username</Label>
            <Input id="username" type="text" value={username} onChange={(e) => onUsernameChange(e.target.value)} placeholder="Enter a unique username" className="rounded-lg" />
            {usernameError && <p className="text-xs text-red-500 mt-1">{usernameError}</p>}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><Label htmlFor="firstName" className="flex items-center gap-2 mb-2"><User className="w-4 h-4" />First Name</Label><Input id="firstName" type="text" value={firstName} onChange={(e) => onFirstNameChange(e.target.value)} placeholder="Enter your first name" className="rounded-lg" /></div>
            <div><Label htmlFor="lastName" className="mb-2 block">Last Name</Label><Input id="lastName" type="text" value={lastName} onChange={(e) => onLastNameChange(e.target.value)} placeholder="Enter your last name" className="rounded-lg" /></div>
          </div>
          <div>
            <Label htmlFor="email" className="flex items-center gap-2 mb-2"><Mail className="w-4 h-4" />Email Address</Label>
            <div className="flex gap-2">
              <Input id="email" type="email" value={currentEmail} disabled className="bg-muted rounded-lg flex-1" />
              <Button type="button" variant="outline" onClick={onOpenEmailDialog} className="rounded-lg whitespace-nowrap">Change Email</Button>
            </div>
          </div>
          <div>
            <Label htmlFor="mobileNumber" className="flex items-center gap-2 mb-2"><Phone className="w-4 h-4" />Mobile Number <span className="text-muted-foreground text-xs">(optional)</span></Label>
            <div className="flex gap-2">
              <Select value={countryCode} onValueChange={onCountryCodeChange}>
                <SelectTrigger className="w-[120px] rounded-lg">
                  <SelectValue>
                    <span className="flex items-center gap-2">
                      <CountryFlag country={countryCodes.find((c) => c.value === countryCode)?.country || 'US'} />
                      <span>{countryCodes.find((c) => c.value === countryCode)?.label?.split(' ')[1]}</span>
                    </span>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="rounded-lg">
                  {countryCodes.map((country) => (
                    <SelectItem key={country.value} value={country.value} className="rounded-md">
                      <div className="flex items-center gap-2">
                        <CountryFlag country={country.country} />
                        <span className="font-medium">{country.label.split(' ')[0]}</span>
                        <span className="text-muted-foreground">{country.label.split(' ')[1]}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input id="mobileNumber" type="tel" value={mobileNumber} onChange={(e) => onMobileNumberChange(e.target.value)} placeholder="(555) 123-4567" className="flex-1 rounded-lg" />
            </div>
          </div>
          <div className="flex justify-end pt-4">
            <Button onClick={onSaveProfile} disabled={saveStatus !== 'idle'} className={`group rounded-lg transition-all duration-300 ease-out hover:scale-[1.05] active:scale-95 disabled:scale-100 disabled:hover:scale-100 ${saveStatus === 'success' ? 'bg-green-600 hover:bg-green-600' : saveStatus === 'error' ? 'bg-red-600 hover:bg-red-600' : ''}`}>
              {saveStatus === 'saving' && <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</>}
              {saveStatus === 'success' && <><Check className="w-4 h-4 mr-2" />Saved!</>}
              {saveStatus === 'error' && <><AlertCircle className="w-4 h-4 mr-2" />Error!</>}
              {saveStatus === 'idle' && <><Save className="w-4 h-4 mr-2 transition-transform duration-300 group-hover:rotate-[15deg]" />Save Changes</>}
            </Button>
          </div>
        </CardContent>
      </Card>
    </>
  );
}

