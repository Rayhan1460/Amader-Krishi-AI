import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Lock, User, Mail, Eye, EyeOff, AlertCircle, ArrowRight, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { getErrorMessage } from '../services/api.ts';
import { Button } from '../components/common/Button.tsx';
import { Input } from '../components/common/Input.tsx';
import { BrandLogo } from '../components/common/BrandLogo.tsx';
import { GoogleAuthButton } from '../components/common/GoogleAuthButton.tsx';
import { DemoLoginButton } from '../components/common/DemoLoginButton.tsx';

export function RegisterPage() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedUsername = username.trim();
    if (trimmedUsername.length < 3) {
      setError('ইউজারনেম ন্যূনতম ৩ অক্ষরের হতে হবে (Username must be at least 3 characters).');
      return;
    }
    if (trimmedUsername.length > 50) {
      setError('ইউজারনেম সর্বোচ্চ ৫০ অক্ষরের হতে পারে (Username cannot exceed 50 characters).');
      return;
    }
    if (!/^[a-zA-Z0-9_.-]+$/.test(trimmedUsername)) {
      setError('ইউজারনেমে শুধুমাত্র ইংরেজি অক্ষর, সংখ্যা, ডট, ড্যাশ ও আন্ডারস্কোর গ্রহণযোগ্য।');
      return;
    }
    const trimmedEmail = email.trim();
    if (trimmedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError('সঠিক ইমেইল ঠিকানা দিন অথবা ক্ষেত্রটি ফাঁকা রাখুন।');
      return;
    }
    if (password.length < 6) {
      setError('পাসওয়ার্ড ন্যূনতম ৬ অক্ষরের হতে হবে (Password must be at least 6 characters).');
      return;
    }
    if (password !== confirmPassword) {
      setError('পাসওয়ার্ড দুটি মেলেনি (Passwords do not match).');
      return;
    }

    setIsSubmitting(true);
    try {
      await register(trimmedUsername, password, trimmedEmail || undefined);
      navigate('/workspace', { replace: true });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-subtle-mesh flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      {/* Top Branding Link */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center mb-6">
        <Link to="/" className="inline-block hover:opacity-90 transition-opacity">
          <BrandLogo size="lg" variant="dark" withTagline={false} />
        </Link>
        <h2 className="mt-4 font-bengali font-bold text-2xl sm:text-3xl text-forest-950 tracking-tight">
          নতুন একাউন্ট খুলুন
        </h2>
        <p className="mt-1 text-xs sm:text-sm text-sage-700 font-bengali">
          মাটি থেকে বাজার—স্মার্ট কৃষি বুদ্ধিমত্তা প্ল্যাটফর্মে যুক্ত হোন
        </p>
      </div>

      {/* Main Registration Form Card */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="glass-card rounded-3xl p-6 sm:p-8 shadow-xl border border-white/80 bg-white/90 backdrop-blur-xl">
          
          {/* Official Google Identity Services Auth for Registration */}
          <div className="mb-4">
            <GoogleAuthButton
              mode="signup"
              onSuccess={() => navigate('/workspace', { replace: true })}
              onError={(err) => setError(err)}
            />
          </div>

          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-sage-200" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-white px-3 text-sage-500 font-bengali">
                অথবা ইউজারনেম দিয়ে নিবন্ধন
              </span>
            </div>
          </div>

          {/* Error Alert */}
          {error && (
            <div className="mb-5 p-4 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3 text-xs text-red-800">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div className="flex-1 font-bengali">
                <p className="font-semibold">নিবন্ধন সমস্যা (Registration Issue)</p>
                <p className="mt-0.5">{error}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username */}
            <Input
              label="ইউজারনেম (Username) *"
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. rajshahi_farmer বা agronomist_user"
              required
              autoComplete="username"
              leftIcon={<User className="w-4 h-4" />}
              helperText="৩ থেকে ৫০ অক্ষর, শুধুমাত্র ইংরেজি অক্ষর ও সংখ্যা"
            />

            {/* Email (Optional) */}
            <Input
              label="ইমেইল ঠিকানা (Email - ঐচ্ছিক)"
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. farmer@amaderkrishi.ai"
              autoComplete="email"
              leftIcon={<Mail className="w-4 h-4" />}
              helperText="পাসওয়ার্ড পুনরুদ্ধার ও আপডেটের জন্য (ঐচ্ছিক)"
            />

            {/* Password */}
            <Input
              label="পাসওয়ার্ড (Password) *"
              type={showPassword ? 'text' : 'password'}
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="ন্যূনতম ৬ অক্ষর"
              required
              autoComplete="new-password"
              leftIcon={<Lock className="w-4 h-4" />}
              rightIcon={
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="cursor-pointer hover:text-charcoal-900 transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              }
            />

            {/* Confirm Password */}
            <Input
              label="পাসওয়ার্ড নিশ্চিত করুন (Confirm Password) *"
              type={showPassword ? 'text' : 'password'}
              id="confirm-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="পাসওয়ার্ড পুনরায় লিখুন"
              required
              autoComplete="new-password"
              leftIcon={<Lock className="w-4 h-4" />}
            />

            {/* Terms / Integrity acknowledgment */}
            <div className="pt-2">
              <div className="flex items-start gap-2 text-[11px] text-sage-700 font-bengali">
                <CheckCircle2 className="w-4 h-4 text-forest-600 shrink-0 mt-0.5" />
                <span>
                  আমি অবগত যে আমাদের কৃষি AI মডেলসমূহের পরামর্শ গবেষণাভিত্তিক এবং মাঠপর্যায়ে সিদ্ধান্তের জন্য মানবীয় কৃষি বিশেষজ্ঞের মতামত সুপারিশকৃত।
                </span>
              </div>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full font-bengali font-semibold shadow-md shadow-forest-900/20 mt-2"
              isLoading={isSubmitting}
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              একাউন্ট তৈরি করুন (Create Account)
            </Button>
          </form>

          {/* Quick Demo Mode Link */}
          <div className="mt-5 p-3 rounded-xl bg-forest-50/70 border border-forest-200/80 flex items-center justify-between">
            <span className="text-xs text-forest-900 font-bengali">
              দ্রুত পরীক্ষা করতে চান?
            </span>
            <DemoLoginButton variant="compact" />
          </div>

          {/* Switch to Sign In */}
          <div className="mt-5 pt-4 border-t border-sage-200 text-center">
            <p className="text-xs text-charcoal-700 font-bengali">
              ইতিমধ্যে একাউন্ট আছে?{' '}
              <Link
                to="/login"
                className="font-semibold text-forest-700 hover:text-forest-900 underline underline-offset-2"
              >
                লগইন করুন (Sign In)
              </Link>
            </p>
          </div>

        </div>

        {/* Security Note */}
        <p className="mt-5 text-center text-[11px] text-sage-600 font-bengali">
          ডাটাবেজে সকল একাউন্ট Argon2 এনক্রিপশন ও সেশন টোকেন দিয়ে সুরক্ষিত।
        </p>
      </div>
    </div>
  );
}
