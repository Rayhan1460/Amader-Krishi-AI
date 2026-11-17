import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Sprout, Lock, User, Mail, Eye, EyeOff, AlertCircle, ArrowRight, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { getErrorMessage } from '../services/api.ts';
import { Button } from '../components/common/Button.tsx';
import { Input } from '../components/common/Input.tsx';

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
      setError('Username must be at least 3 characters long.');
      return;
    }
    if (trimmedUsername.length > 50) {
      setError('Username cannot exceed 50 characters.');
      return;
    }
    if (!/^[a-zA-Z0-9_.-]+$/.test(trimmedUsername)) {
      setError('Username may only contain letters, numbers, underscores, dots, and hyphens.');
      return;
    }
    const trimmedEmail = email.trim();
    if (trimmedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError('Please provide a valid email address or leave the field blank.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
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
        <Link to="/" className="inline-flex items-center gap-2.5 group">
          <div className="w-10 h-10 rounded-xl bg-forest-900 flex items-center justify-center text-emerald-400 shadow-md group-hover:scale-105 transition-transform">
            <Sprout className="w-5 h-5" />
          </div>
          <span className="font-display font-bold text-2xl tracking-tight text-forest-950">
            AgriSphere<span className="text-forest-600">.AI</span>
          </span>
        </Link>
        <h2 className="mt-4 font-display font-bold text-2xl sm:text-3xl text-forest-950 tracking-tight">
          Create Your Account
        </h2>
        <p className="mt-1 text-xs sm:text-sm text-sage-700">
          Join the agricultural intelligence platform from soil to market
        </p>
      </div>

      {/* Main Registration Form Card */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="glass-card rounded-3xl p-8 sm:p-10 shadow-xl border border-white/80 bg-white/90 backdrop-blur-xl">
          
          {/* Error Alert */}
          {error && (
            <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3 text-xs text-red-800">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold">Registration Issue</p>
                <p className="mt-0.5">{error}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username */}
            <Input
              label="Username *"
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. rajshahi_farmer"
              required
              autoComplete="username"
              leftIcon={<User className="w-4 h-4" />}
              helperText="3 to 50 characters, letters and numbers"
            />

            {/* Email (Optional) */}
            <Input
              label="Email Address (Optional)"
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. farmer@agrisphere.org"
              autoComplete="email"
              leftIcon={<Mail className="w-4 h-4" />}
              helperText="Optional for local development session"
            />

            {/* Password */}
            <Input
              label="Password *"
              type={showPassword ? 'text' : 'password'}
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimum 6 characters"
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
              label="Confirm Password *"
              type={showPassword ? 'text' : 'password'}
              id="confirm-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-type password"
              required
              autoComplete="new-password"
              leftIcon={<Lock className="w-4 h-4" />}
            />

            {/* Terms / Integrity acknowledgment */}
            <div className="pt-2">
              <div className="flex items-start gap-2 text-[11px] text-sage-700">
                <CheckCircle2 className="w-4 h-4 text-forest-600 shrink-0 mt-0.5" />
                <span>
                  I understand that AgriSphere AI model outputs provide research advisory support and require human agronomic verification.
                </span>
              </div>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full font-semibold shadow-md shadow-forest-900/20 mt-2"
              isLoading={isSubmitting}
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              Create Account & Enter
            </Button>
          </form>

          {/* Switch to Sign In */}
          <div className="mt-8 pt-6 border-t border-sage-200 text-center">
            <p className="text-xs text-charcoal-700">
              Already have an account?{' '}
              <Link
                to="/login"
                className="font-semibold text-forest-700 hover:text-forest-900 underline underline-offset-2"
              >
                Sign In
              </Link>
            </p>
          </div>

        </div>

        {/* Security Note */}
        <p className="mt-6 text-center text-[11px] text-sage-600">
          Account data is saved to local SQLite and verified via password hashing.
        </p>
      </div>
    </div>
  );
}
