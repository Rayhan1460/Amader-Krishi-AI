import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Lock, User, Eye, EyeOff, AlertCircle, ArrowRight, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { getErrorMessage } from '../services/api.ts';
import { Button } from '../components/common/Button.tsx';
import { Input } from '../components/common/Input.tsx';
import { BrandLogo } from '../components/common/BrandLogo.tsx';
import { GoogleAuthButton } from '../components/common/GoogleAuthButton.tsx';
import { DemoLoginButton } from '../components/common/DemoLoginButton.tsx';

export function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const returnTo = (location.state as { from?: { pathname: string; search?: string } })?.from;
  const from = returnTo?.pathname?.startsWith('/') && !returnTo.pathname.startsWith('//')
    ? returnTo.pathname + (returnTo?.search ?? '') : '/workspace';

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!username.trim()) {
      setError('ইউজারনেম পূরণ আবশ্যক (Username is required).');
      return;
    }
    if (password.length < 6) {
      setError('পাসওয়ার্ড ন্যূনতম ৬ অক্ষরের হতে হবে (Minimum 6 characters).');
      return;
    }

    setIsSubmitting(true);
    try {
      await login(username.trim(), password);
      navigate(from, { replace: true });
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
          ওয়ার্কস্পেসে লগইন করুন
        </h2>
        <p className="mt-1 text-xs sm:text-sm text-sage-700 font-bengali">
          আপনার এআই মডেল, প্রেডিকশন অডিট এবং কৃষি গবেষণায় প্রবেশ করুন
        </p>
      </div>

      {/* Main Form Card */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="glass-card rounded-3xl p-6 sm:p-8 shadow-xl border border-white/80 bg-white/90 backdrop-blur-xl">
          
          {/* 1. Secure One-Click Demo Mode Entry */}
          <div className="mb-5">
            <DemoLoginButton onSuccess={() => navigate(from === '/buyer' ? '/workspace' : from, { replace: true })} />
          </div>

          {/* 2. Official Google Identity Services Auth */}
          <div className="mb-4">
            <GoogleAuthButton
              mode="signin"
              onSuccess={() => navigate(from, { replace: true })}
              onError={(err) => setError(err)}
            />
          </div>

          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-sage-200" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-white px-3 text-sage-500 font-bengali">
                অথবা ইউজারনেম দিয়ে লগইন
              </span>
            </div>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="mb-5 p-4 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3 text-xs text-red-800">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div className="flex-1 font-bengali">
                <p className="font-semibold">লগইন ব্যর্থ হয়েছে (Authentication Failed)</p>
                <p className="mt-0.5">{error}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username Input */}
            <Input
              label="ইউজারনেম (Username)"
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. farmer_user বা agronomist"
              required
              autoComplete="username"
              leftIcon={<User className="w-4 h-4" />}
            />

            {/* Password Input */}
            <Input
              label="পাসওয়ার্ড (Password)"
              type={showPassword ? 'text' : 'password'}
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
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

            {/* Submit Button */}
            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full font-bengali font-semibold shadow-md shadow-forest-900/20"
              isLoading={isSubmitting}
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              লগইন করুন (Sign In)
            </Button>
          </form>

          {/* New account banner / Register Link */}
          <div className="mt-6 pt-5 border-t border-sage-200 flex items-center justify-between text-xs font-bengali">
            <span className="text-charcoal-700">একাউন্ট নেই?</span>
            <Link
              to="/register"
              className="font-semibold text-forest-700 hover:text-forest-900 underline underline-offset-2 flex items-center gap-1"
            >
              <Sparkles className="w-3.5 h-3.5 text-forest-600" />
              <span>নতুন একাউন্ট খুলুন</span>
            </Link>
          </div>

        </div>

        {/* Security Note */}
        <p className="mt-5 text-center text-[11px] text-sage-600 font-bengali">
          Argon2 পাসওয়ার্ড হ্যাশিং, Google Identity Services ও স্টেটলেস JWT সেশন দ্বারা সুরক্ষিত।
        </p>
      </div>
    </div>
  );
}
