import { Link } from 'react-router-dom';
import { Sprout, ArrowLeft } from 'lucide-react';
import { Button } from '../components/common/Button.tsx';

export function NotFoundPage() {
  return (
    <div className="min-h-screen bg-cream-100 flex flex-col items-center justify-center p-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-forest-900 flex items-center justify-center text-emerald-400 mb-6 shadow-md">
        <Sprout className="w-8 h-8" />
      </div>
      <h1 className="font-display font-extrabold text-4xl sm:text-5xl text-forest-950 mb-3 tracking-tight">
        404 — Page Not Found
      </h1>
      <p className="text-sm sm:text-base text-charcoal-700 max-w-md mb-8">
        The agricultural field or route you are looking for does not exist in the AgriSphere AI platform.
      </p>
      <Link to="/">
        <Button variant="primary" size="md" leftIcon={<ArrowLeft className="w-4 h-4" />}>
          Return to Home
        </Button>
      </Link>
    </div>
  );
}
