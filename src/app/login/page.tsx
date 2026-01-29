'use client';

import { useState, useEffect, useRef } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, Loader2, AlertCircle, Mail, KeyRound, ArrowLeft, Clock, CheckCircle2 } from 'lucide-react';

type LoginStep = 'email' | 'otp';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/';
  const errorParam = searchParams.get('error');
  
  const [step, setStep] = useState<LoginStep>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [otpExpiresAt, setOtpExpiresAt] = useState<Date | null>(null);
  const [countdown, setCountdown] = useState<string>('');
  const [canResend, setCanResend] = useState(false);
  const [otpSent, setOtpSent] = useState(false);

  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Countdown timer for OTP expiry
  useEffect(() => {
    if (!otpExpiresAt) return;

    const updateCountdown = () => {
      const now = new Date();
      const remaining = otpExpiresAt.getTime() - now.getTime();
      
      if (remaining <= 0) {
        setCountdown('Expired');
        setCanResend(true);
        return;
      }

      const minutes = Math.floor(remaining / 60000);
      const seconds = Math.floor((remaining % 60000) / 1000);
      setCountdown(`${minutes}:${seconds.toString().padStart(2, '0')}`);

      // Allow resend after 30 seconds
      if (remaining < 9.5 * 60 * 1000) {
        setCanResend(true);
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [otpExpiresAt]);

  // Focus first OTP input when entering OTP step
  useEffect(() => {
    if (step === 'otp' && otpRefs.current[0]) {
      otpRefs.current[0].focus();
    }
  }, [step]);

  async function handleRequestOtp(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!data.success) {
        setError(data.error || 'Failed to send verification code');
        return;
      }

      setOtpExpiresAt(new Date(data.expiresAt));
      setStep('otp');
      setOtpSent(true);
      setCanResend(false);
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleResendOtp() {
    setIsLoading(true);
    setError(null);
    setOtp(['', '', '', '', '', '']);

    try {
      const response = await fetch('/api/auth/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!data.success) {
        setError(data.error || 'Failed to resend verification code');
        return;
      }

      setOtpExpiresAt(new Date(data.expiresAt));
      setCanResend(false);
      setOtpSent(true);
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleVerifyOtp() {
    const otpCode = otp.join('');
    
    if (otpCode.length !== 6) {
      setError('Please enter the complete 6-digit code');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await signIn('credentials', {
        email,
        otp: otpCode,
        redirect: false,
        callbackUrl,
      });

      if (result?.error) {
        // Map error messages to user-friendly text
        const errorMap: Record<string, string> = {
          'Invalid OTP': 'Invalid verification code. Please try again.',
          'OTP has expired. Please request a new code.': 'Your code has expired. Please request a new one.',
          'No valid OTP found. Please request a new code.': 'No valid code found. Please request a new one.',
          'Account pending approval': 'Your account is pending approval.',
          'Account suspended': 'Your account has been suspended.',
          'Account expired': 'Your account has expired.',
          'Account inactive': 'Your account is inactive.',
        };
        setError(errorMap[result.error] || result.error);
      } else if (result?.ok) {
        router.push(callbackUrl);
        router.refresh();
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }

  function handleOtpChange(index: number, value: string) {
    // Only allow digits
    if (value && !/^\d$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto-focus next input
    if (value && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all digits entered
    if (value && index === 5 && newOtp.every(d => d)) {
      setTimeout(() => handleVerifyOtp(), 100);
    }
  }

  function handleOtpKeyDown(index: number, e: React.KeyboardEvent) {
    // Handle backspace
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
    // Handle paste
    if (e.key === 'v' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      navigator.clipboard.readText().then((text) => {
        const digits = text.replace(/\D/g, '').slice(0, 6).split('');
        const newOtp = [...otp];
        digits.forEach((digit, i) => {
          if (i < 6) newOtp[i] = digit;
        });
        setOtp(newOtp);
        if (digits.length === 6) {
          setTimeout(() => handleVerifyOtp(), 100);
        }
      });
    }
  }

  function handleBack() {
    setStep('email');
    setOtp(['', '', '', '', '', '']);
    setError(null);
    setOtpExpiresAt(null);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4">
      {/* Background pattern */}
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiMyMDIwMjAiIGZpbGwtb3BhY2l0eT0iMC40Ij48cGF0aCBkPSJNMzYgMzRoLTJ2LTRoMnY0em0wLTZ2LTRoLTJ2NGgyek0zNCAzNmgtNHYyaDR2LTJ6bS02IDBoLTR2Mmg0di0yem0yLTZoLTJ2NGgydi00em0wLTZ2NGgtMnYtNGgyem0tNiA2aDR2LTRoLTR2NHptLTQgMHY0aDR2LTRoLTR6bTAtMTBoMnY0aC0ydi00em0wIDZoMnY0aC0ydi00em0xMiAxMnYtMmgtNHYyaDR6bTQgMHYtMmgtMnYyaDJ6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-20" />
      
      <div className="relative w-full max-w-md space-y-8">
        {/* Logo */}
        <div className="flex flex-col items-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-500/30">
            <Shield className="h-8 w-8 text-white" />
          </div>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-white">SyncEngine</h1>
          <p className="text-sm text-slate-400">Secure Data Provisioning Service</p>
        </div>

        {/* Login Card */}
        <Card className="border-slate-800 bg-slate-900/50 backdrop-blur-sm">
          <CardHeader className="text-center">
            <CardTitle className="text-white">
              {step === 'email' ? 'Sign In' : 'Enter Verification Code'}
            </CardTitle>
            <CardDescription className="text-slate-400">
              {step === 'email' 
                ? 'Enter your email to receive a verification code'
                : `We sent a code to ${email}`
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            {step === 'email' ? (
              <form onSubmit={handleRequestOtp} className="space-y-4">
                {(errorParam || error) && (
                  <Alert variant="destructive" className="border-red-900/50 bg-red-950/50">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      {error || 'Authentication failed. Please try again.'}
                    </AlertDescription>
                  </Alert>
                )}

                <div className="space-y-2">
                  <Label htmlFor="email" className="text-slate-300">Email Address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      autoComplete="email"
                      disabled={isLoading}
                      className="border-slate-700 bg-slate-800/50 pl-10 text-white placeholder:text-slate-500 focus:border-emerald-500 focus:ring-emerald-500/20"
                    />
                  </div>
                </div>

                <Button 
                  type="submit" 
                  className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700" 
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending code...
                    </>
                  ) : (
                    <>
                      <Mail className="mr-2 h-4 w-4" />
                      Send Verification Code
                    </>
                  )}
                </Button>
              </form>
            ) : (
              <div className="space-y-6">
                {error && (
                  <Alert variant="destructive" className="border-red-900/50 bg-red-950/50">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                {otpSent && !error && (
                  <Alert className="border-emerald-900/50 bg-emerald-950/30">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    <AlertDescription className="text-emerald-200">
                      Verification code sent! Check your email.
                    </AlertDescription>
                  </Alert>
                )}

                {/* OTP Input */}
                <div className="space-y-3">
                  <Label className="text-slate-300">Enter 6-digit code</Label>
                  <div className="flex justify-center gap-2">
                    {otp.map((digit, index) => (
                      <Input
                        key={index}
                        ref={(el) => { otpRefs.current[index] = el; }}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handleOtpChange(index, e.target.value)}
                        onKeyDown={(e) => handleOtpKeyDown(index, e)}
                        disabled={isLoading}
                        className="h-14 w-12 border-slate-700 bg-slate-800/50 text-center text-2xl font-bold text-white focus:border-emerald-500 focus:ring-emerald-500/20"
                      />
                    ))}
                  </div>
                </div>

                {/* Timer and Resend */}
                <div className="flex items-center justify-center gap-2 text-sm">
                  <Clock className="h-4 w-4 text-slate-500" />
                  <span className={countdown === 'Expired' ? 'text-red-400' : 'text-slate-400'}>
                    {countdown === 'Expired' ? 'Code expired' : `Expires in ${countdown}`}
                  </span>
                </div>

                <Button
                  onClick={handleVerifyOtp}
                  className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700"
                  disabled={isLoading || otp.some(d => !d)}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    <>
                      <KeyRound className="mr-2 h-4 w-4" />
                      Verify & Sign In
                    </>
                  )}
                </Button>

                <div className="flex items-center justify-between">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={handleBack}
                    disabled={isLoading}
                    className="text-slate-400 hover:text-white"
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    onClick={handleResendOtp}
                    disabled={isLoading || !canResend}
                    className="text-slate-400 hover:text-white disabled:opacity-50"
                  >
                    {isLoading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Mail className="mr-2 h-4 w-4" />
                    )}
                    Resend Code
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Footer */}
        <p className="text-center text-xs text-slate-500">
          Secure passwordless authentication
        </p>
      </div>
    </div>
  );
}
