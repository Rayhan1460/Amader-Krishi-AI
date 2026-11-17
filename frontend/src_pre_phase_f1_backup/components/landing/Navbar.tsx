import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Sprout, Menu, X, ArrowRight, UserCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';
import { Button } from '../common/Button.tsx';

export function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { label: 'Capabilities', href: '#capabilities' },
    { label: 'AI Models', href: '#models' },
    { label: 'How It Works', href: '#how-it-works' },
    { label: 'Research Caveats', href: '#limitations' },
    { label: 'FAQ', href: '#faq' },
  ];

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled
          ? 'bg-cream-100/90 backdrop-blur-md shadow-sm border-b border-sage-200/80 py-3.5'
          : 'bg-transparent py-5'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          {/* Brand Logo */}
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-forest-900 flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
              <Sprout className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="flex flex-col">
              <span className="font-display font-bold text-xl tracking-tight text-forest-950">
                AgriSphere<span className="text-forest-600">.AI</span>
              </span>
              <span className="text-[10px] tracking-wider uppercase font-semibold text-sage-600 -mt-1">
                From Soil to Market
              </span>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="text-sm font-medium text-charcoal-800 hover:text-forest-700 transition-colors"
              >
                {link.label}
              </a>
            ))}
          </nav>

          {/* Desktop Auth Actions */}
          <div className="hidden md:flex items-center gap-3">
            {isAuthenticated ? (
              <div className="flex items-center gap-3">
                <Link to="/workspace">
                  <Button variant="secondary" size="sm" leftIcon={<UserCircle className="w-4 h-4" />}>
                    Workspace ({user?.username})
                  </Button>
                </Link>
                <Button variant="ghost" size="sm" onClick={logout}>
                  Sign Out
                </Button>
              </div>
            ) : (
              <>
                <Link to="/login">
                  <Button variant="ghost" size="sm">
                    Sign In
                  </Button>
                </Link>
                <Link to="/register">
                  <Button
                    variant="primary"
                    size="sm"
                    rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
                  >
                    Get Started
                  </Button>
                </Link>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            type="button"
            className="md:hidden p-2 rounded-lg text-charcoal-700 hover:text-forest-800 hover:bg-sage-100 transition-colors"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-cream-100/98 backdrop-blur-xl border-b border-sage-200 px-4 pt-3 pb-6 shadow-xl">
          <nav className="flex flex-col gap-3">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="px-3 py-2 text-base font-medium text-charcoal-800 hover:text-forest-700 hover:bg-sage-100 rounded-lg transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                {link.label}
              </a>
            ))}
            <div className="pt-3 border-t border-sage-200 flex flex-col gap-2">
              {isAuthenticated ? (
                <>
                  <Button
                    variant="primary"
                    size="md"
                    className="w-full"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      navigate('/workspace');
                    }}
                  >
                    Enter Workspace ({user?.username})
                  </Button>
                  <Button
                    variant="ghost"
                    size="md"
                    className="w-full"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      logout();
                    }}
                  >
                    Sign Out
                  </Button>
                </>
              ) : (
                <>
                  <Link to="/login" onClick={() => setMobileMenuOpen(false)}>
                    <Button variant="secondary" size="md" className="w-full">
                      Sign In
                    </Button>
                  </Link>
                  <Link to="/register" onClick={() => setMobileMenuOpen(false)}>
                    <Button variant="primary" size="md" className="w-full">
                      Get Started Free
                    </Button>
                  </Link>
                </>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
