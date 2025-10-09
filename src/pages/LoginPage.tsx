import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { X } from 'lucide-react';

function LoginPage() {
  const [step, setStep] = useState<'email' | 'password' | 'signup'>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [isExistingUser, setIsExistingUser] = useState<boolean | null>(null);
  const [checkingEmail, setCheckingEmail] = useState(false);
  const { signIn, signUp, error, clearError } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    clearError();
  }, [clearError]);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCheckingEmail(true);
    clearError();
    
    try {
      // Use signInWithOtp with shouldCreateUser: false to check if user exists
      // This won't create a user or send an OTP, just checks existence
      const { data, error: otpError } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: false,
        }
      });

      // If there's no error, the user exists (OTP was prepared but not sent in test mode)
      // If there's an error about user not found, user doesn't exist
      if (otpError) {
        // Check the error message to determine if user exists
        if (otpError.message.includes('User not found') || 
            otpError.message.includes('not found') ||
            otpError.message.includes('Signups not allowed')) {
          // User doesn't exist - go to signup
          setIsExistingUser(false);
          setStep('signup');
        } else {
          // Other error, but user might exist - default to login
          setIsExistingUser(true);
          setStep('password');
        }
      } else {
        // No error means user exists - go to login
        setIsExistingUser(true);
        setStep('password');
      }
    } catch (err: any) {
      console.error('Error checking email:', err);
      // Default to signup flow if we can't determine
      setIsExistingUser(false);
      setStep('signup');
    } finally {
      setCheckingEmail(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await signIn(email, password);
    } catch (err) {
      console.error('Sign in error:', err);
    }
  };

  const handleSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      // You might want to set a local error state here
      console.error('Passwords do not match');
      return;
    }
    
    try {
      await signUp(email, password, fullName);
      // After successful signup, user will be redirected by AuthContext
    } catch (err) {
      console.error('Sign up error:', err);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/`,
        }
      });
      if (error) throw error;
    } catch (err: any) {
      console.error('Google login error:', err);
    }
  };


  const handleClose = () => {
    navigate('/');
  };

  const handleBack = () => {
    setStep('email');
    setPassword('');
    setConfirmPassword('');
    setFullName('');
    setIsExistingUser(null);
    clearError();
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-[440px] bg-[#2C2C2C] rounded-2xl shadow-2xl p-8 relative">
        {/* Close Button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/5"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-[26px] font-semibold text-white mb-3">
            Log in or sign up
          </h1>
          <p className="text-[15px] text-gray-300 leading-relaxed px-2">
            You'll get smarter responses and can upload files, images, and more.
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 bg-red-500/10 border border-red-500/50 text-red-400 p-3 rounded-lg text-sm text-center">
            {error}
          </div>
        )}

        {step === 'email' ? (
          <>
            {/* Email Form */}
            <form onSubmit={handleEmailSubmit} className="space-y-4 mb-6">
              <div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full h-[52px] px-4 py-3.5 bg-[#3C3C3C] border border-gray-600 rounded-[26px] text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-transparent transition-all"
                  placeholder="Email address"
                />
              </div>

              {/* Continue Button */}
              <Button
                type="submit"
                disabled={checkingEmail}
                className="w-full h-[52px] bg-white hover:bg-gray-100 text-gray-900 font-medium py-3.5 rounded-[26px] transition-colors shadow-sm"
              >
                {checkingEmail ? 'Checking...' : 'Login or Sign up'}
              </Button>
            </form>

            {/* Divider */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-600"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-[#2C2C2C] text-gray-400">OR</span>
              </div>
            </div>

            {/* OAuth Buttons */}
            <div className="space-y-2">
              {/* Google Login */}
              <Button
                type="button"
                onClick={handleGoogleLogin}
                className="w-full bg-transparent hover:bg-white/5 text-white font-normal py-3.5 h-[52px] rounded-[26px] transition-colors border border-gray-600 flex items-center justify-center gap-3"
                variant="outline"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                Continue with Google
              </Button>
            </div>
          </>
        ) : step === 'password' ? (
          <>
            {/* Back to Email */}
            <button
              onClick={handleBack}
              className="mb-6 text-sm text-gray-400 hover:text-gray-300 flex items-center gap-2"
            >
              ← Back
            </button>

            {/* Password Form - Login */}
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div>
                <input
                  type="email"
                  disabled
                  value={email}
                  className="w-full h-[52px] px-4 py-3.5 bg-[#3C3C3C] border border-gray-600 rounded-[26px] text-gray-400 mb-3"
                />
              </div>
              <div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoFocus
                  className="w-full h-[52px] px-4 py-3.5 bg-[#3C3C3C] border border-gray-600 rounded-[26px] text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-transparent transition-all"
                  placeholder="Password"
                />
              </div>

              {/* Log in Button */}
              <Button
                type="submit"
                className="w-full h-[52px] bg-white hover:bg-gray-100 text-gray-900 font-medium py-3.5 rounded-[26px] transition-colors shadow-sm"
              >
                Log in
              </Button>
            </form>

            {/* Forgot password link */}
            <div className="text-center mt-4">
              <button
                type="button"
                className="text-sm text-gray-400 hover:text-gray-300 transition-colors"
              >
                Forgot password?
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Back to Email */}
            <button
              onClick={handleBack}
              className="mb-6 text-sm text-gray-400 hover:text-gray-300 flex items-center gap-2"
            >
              ← Back
            </button>

            {/* Sign Up Form */}
            <form onSubmit={handleSignupSubmit} className="space-y-4">
              <div>
                <input
                  type="email"
                  disabled
                  value={email}
                  className="w-full h-[52px] px-4 py-3.5 bg-[#3C3C3C] border border-gray-600 rounded-[26px] text-gray-400"
                />
              </div>
              <div>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  autoFocus
                  className="w-full h-[52px] px-4 py-3.5 bg-[#3C3C3C] border border-gray-600 rounded-[26px] text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-transparent transition-all"
                  placeholder="Full name"
                />
              </div>
              <div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-[52px] px-4 py-3.5 bg-[#3C3C3C] border border-gray-600 rounded-[26px] text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-transparent transition-all"
                  placeholder="Create password"
                />
              </div>
              <div>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full h-[52px] px-4 py-3.5 bg-[#3C3C3C] border border-gray-600 rounded-[26px] text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-transparent transition-all"
                  placeholder="Confirm password"
                />
              </div>

              {/* Sign up Button */}
              <Button
                type="submit"
                className="w-full h-[52px] bg-white hover:bg-gray-100 text-gray-900 font-medium py-3.5 rounded-[26px] transition-colors shadow-sm"
              >
                Create account
              </Button>
            </form>

            {/* Terms text */}
            <div className="text-center mt-4">
              <p className="text-xs text-gray-400">
                By signing up, you agree to our Terms of Service and Privacy Policy
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default LoginPage;
