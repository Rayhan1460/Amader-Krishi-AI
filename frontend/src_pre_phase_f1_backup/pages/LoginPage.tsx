import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Sprout, Lock, User, Eye, EyeOff, AlertCircle, ArrowRight, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { getErrorMessage } from '../services/api.ts';
import { Button } from '../components/common/Button.tsx';
import { Input } from '../components/common/Input.tsx';

export function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/workspace';

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!username.trim()) {
      setError('Username is required.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
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
        <Link to="/" className="inline-flex items-center gap-2.5 group">
          <div className="w-10 h-10 rounded-xl bg-forest-900 flex items-center justify-center text-emerald-400 shadow-md group-hover:scale-105 transition-transform">
            <Sprout className="w-5 h-5" />
          </div>
          <span className="font-display font-bold text-2xl tracking-tight text-forest-950">
            AgriSphere<span className="text-forest-600">.AI</span>
          </span>
        </Link>
        <h2 className="mt-4 font-display font-bold text-2xl sm:text-3xl text-forest-950 tracking-tight">
          Sign In to Workspace
        </h2>
        <p className="mt-1 text-xs sm:text-sm text-sage-700">
          Access your research models, prediction logs, and agronomic insights
        </p>
      </div>

      {/* Main Form Card */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="glass-card rounded-3xl p-8 sm:p-10 shadow-xl border border-white/80 bg-white/90 backdrop-blur-xl">
          
          {/* New account banner */}
          <div className="mb-6 bg-forest-50 border border-forest-200/80 rounded-2xl p-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-forest-900">
              <Sparkles className="w-4 h-4 text-forest-600 shrink-0" />
              <span>Evaluating AgriSphere?</span>
            </div>
            <Link
              to="/register"
              className="text-xs font-semibold text-forest-700 hover:text-forest-900 bg-white px-2.5 py-1 rounded-lg border border-forest-300 shadow-2xs hover:bg-forest-50 transition-colors"
            >
              Create Account
            </Link>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3 text-xs text-red-800">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold">Authentication Failed</p>
                <p className="mt-0.5">{error}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Username Input */}
            <Input
              label="Username"
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. agronomist1 or research_user"
              required
              autoComplete="username"
              leftIcon={<User className="w-4 h-4" />}
            />

            {/* Password Input */}
            <Input
              label="Password"
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
              className="w-full font-semibold shadow-md shadow-forest-900/20"
              isLoading={isSubmitting}
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              Sign In
            </Button>
          </form>

          {/* Switch to Registration */}
          <div className="mt-8 pt-6 border-t border-sage-200 text-center">
            <p className="text-xs text-charcoal-700">
              Don't have an account yet?{' '}
              <Link
                to="/register"
                className="font-semibold text-forest-700 hover:text-forest-900 underline underline-offset-2"
              >
                Create an account
              </Link>
            </p>
          </div>

        </div>

        {/* Security Note */}
        <p className="mt-6 text-center text-[11px] text-sage-600">
          Secure authentication powered by Argon2 + Stateless JWT Session Tokens.
        </p>
      </div>
    </div>
  );
}
