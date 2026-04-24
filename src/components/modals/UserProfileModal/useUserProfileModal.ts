import { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/hooks/useSubscription';
import { supabase } from '@/lib/supabase';
import { SaveStatus, UserProfile } from './types';

function getDisplayUsername(fullUsername: string | undefined) {
  if (!fullUsername) return '';
  const match = fullUsername.match(/^(.+)_\d+$/);
  return match ? match[1] : fullUsername;
}

async function generateUniqueUsername(baseUsername: string): Promise<string> {
  const sanitized = baseUsername.toLowerCase().trim().replace(/[^a-z0-9_]/g, '');
  if (!sanitized) throw new Error('Invalid username');

  const { data: existing } = await supabase
    .from('profiles')
    .select('username')
    .like('username', `${sanitized}%`)
    .order('username', { ascending: false });

  if (!existing || existing.length === 0) return `${sanitized}_1`;

  let maxNumber = 0;
  existing.forEach((profile) => {
    const match = profile.username?.match(/^.+_(\d+)$/);
    if (!match) return;
    const num = parseInt(match[1], 10);
    if (num > maxNumber) maxNumber = num;
  });

  return `${sanitized}_${maxNumber + 1}`;
}

export function useUserProfileModal(isOpen: boolean) {
  const { user } = useAuth();
  const { subscription, getStatusColor, getStatusIcon } = useSubscription();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [username, setUsername] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [countryCode, setCountryCode] = useState('+1');
  const [mobileNumber, setMobileNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [usernameError, setUsernameError] = useState('');
  const [changingEmail, setChangingEmail] = useState(false);
  const [showEmailChangeModal, setShowEmailChangeModal] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [emailChangeError, setEmailChangeError] = useState('');
  const [currentEmail, setCurrentEmail] = useState('');

  const loadUserProfile = async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const currentUser = sessionData.session?.user;
    if (!currentUser?.id) return;

    try {
      setLoading(true);
      const { data: profileData, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading profile:', error);
      }

      const userProfile: UserProfile = {
        id: currentUser.id,
        email: currentUser.email || '',
        username: profileData?.username || '',
        first_name: profileData?.first_name || '',
        last_name: profileData?.last_name || '',
        mobile_number: profileData?.mobile_number || '',
        avatar_url: profileData?.avatar_url || '',
        created_at: currentUser.created_at || '',
        updated_at: profileData?.updated_at || currentUser.created_at || '',
      };

      setProfile(userProfile);
      setCurrentEmail(userProfile.email);
      setUsername(getDisplayUsername(userProfile.username));
      setFirstName(userProfile.first_name || '');
      setLastName(userProfile.last_name || '');

      const fullMobile = userProfile.mobile_number || '';
      if (fullMobile.startsWith('+52')) {
        setCountryCode('+52');
        setMobileNumber(fullMobile.substring(3).trim());
      } else if (fullMobile.startsWith('+1')) {
        setCountryCode('+1');
        setMobileNumber(fullMobile.substring(2).trim());
      } else {
        setMobileNumber(fullMobile);
      }
    } catch (error) {
      console.error('Failed to load user profile:', error);
      toast.error('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && user) loadUserProfile();
  }, [isOpen, user]);

  useEffect(() => {
    if (!isOpen) return;
    const {
      data: { subscription: authSubscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'USER_UPDATED' && session?.user) {
        loadUserProfile();
      }
    });

    return () => authSubscription.unsubscribe();
  }, [isOpen]);

  const saveProfile = async () => {
    if (!user || !profile) return;

    const startTime = Date.now();
    const minLoadingTime = 1000;

    try {
      setSaveStatus('saving');
      setUsernameError('');

      let finalUsername = profile.username;
      if (username.trim() && getDisplayUsername(profile.username) !== username.trim()) {
        try {
          finalUsername = await generateUniqueUsername(username.trim());
        } catch {
          setUsernameError('Invalid username. Use only letters, numbers, and underscores.');
          await new Promise((resolve) => setTimeout(resolve, Math.max(0, minLoadingTime - (Date.now() - startTime))));
          setSaveStatus('error');
          setTimeout(() => setSaveStatus('idle'), 2000);
          return;
        }
      }

      const fullMobileNumber = mobileNumber.trim() ? `${countryCode} ${mobileNumber.trim()}` : null;
      const { error } = await supabase.from('profiles').upsert({
        id: user.id,
        username: finalUsername || null,
        first_name: firstName.trim() || null,
        last_name: lastName.trim() || null,
        mobile_number: fullMobileNumber,
        updated_at: new Date().toISOString(),
      });

      if (error) {
        if (error.code === '23505') {
          setUsernameError('Username already taken. Please try another.');
        } else {
          throw error;
        }

        await new Promise((resolve) => setTimeout(resolve, Math.max(0, minLoadingTime - (Date.now() - startTime))));
        setSaveStatus('error');
        setTimeout(() => setSaveStatus('idle'), 2000);
        return;
      }

      setProfile((prev) =>
        prev
          ? {
              ...prev,
              username: finalUsername,
              first_name: firstName.trim(),
              last_name: lastName.trim(),
              mobile_number: fullMobileNumber || undefined,
            }
          : null,
      );
      setUsername(getDisplayUsername(finalUsername));
      await new Promise((resolve) => setTimeout(resolve, Math.max(0, minLoadingTime - (Date.now() - startTime))));
      setSaveStatus('success');
      toast.success('Profile updated successfully');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (error) {
      console.error('Failed to save profile:', error);
      toast.error('Failed to save profile');
      await new Promise((resolve) => setTimeout(resolve, Math.max(0, minLoadingTime - (Date.now() - startTime))));
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 2000);
    }
  };

  const handleEmailChange = async () => {
    if (!user || !newEmail.trim()) {
      setEmailChangeError('Please enter a new email address');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
      setEmailChangeError('Please enter a valid email address');
      return;
    }

    if (newEmail.toLowerCase() === currentEmail.toLowerCase()) {
      setEmailChangeError('New email must be different from current email');
      return;
    }

    try {
      setChangingEmail(true);
      setEmailChangeError('');
      const { data, error } = await supabase.functions.invoke('change-email', {
        body: { newEmail: newEmail.trim() },
      });

      if (error) throw new Error(error.message || 'Failed to change email');
      if (!data?.success) throw new Error(data?.error || 'Failed to change email');

      setShowEmailChangeModal(false);
      setNewEmail('');
      setCurrentEmail(data.newEmail);
      toast.success(`Email updated successfully to ${data.newEmail}!`, { duration: 5000 });

      const { data: refreshData } = await supabase.auth.refreshSession();
      if (refreshData?.session?.user) {
        setProfile((prev) =>
          prev
            ? {
                ...prev,
                email: refreshData.session.user.email || prev.email,
              }
            : null,
        );
      }
    } catch (error: any) {
      setEmailChangeError(error.message || 'Failed to change email');
      toast.error(error.message || 'Failed to change email');
    } finally {
      setChangingEmail(false);
    }
  };

  const resetEmailDialog = () => {
    setShowEmailChangeModal(false);
    setNewEmail('');
    setEmailChangeError('');
  };

  return {
    user,
    subscription,
    getStatusColor,
    getStatusIcon,
    profile,
    username,
    setUsername,
    firstName,
    setFirstName,
    lastName,
    setLastName,
    countryCode,
    setCountryCode,
    mobileNumber,
    setMobileNumber,
    loading,
    saveStatus,
    usernameError,
    changingEmail,
    showEmailChangeModal,
    setShowEmailChangeModal,
    newEmail,
    setNewEmail,
    emailChangeError,
    currentEmail,
    setEmailChangeError,
    setUsernameError,
    saveProfile,
    handleEmailChange,
    resetEmailDialog,
  };
}
