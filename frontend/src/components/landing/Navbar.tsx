import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Menu, X, ArrowRight, UserCircle, Globe } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';
import { useLanguage } from '../../context/LanguageContext.tsx';
import { BrandLogo } from '../common/BrandLogo.tsx';
import { Button } from '../common/Button.tsx';
import { DemoLoginButton } from '../common/DemoLoginButton.tsx';

export function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { isAuthenticated, user, logout } = useAuth();
  const { lang, toggleLang, t } = useLanguage();
  const navigate = useNavigate();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { label: t('হোম', 'Home'), href: '#' },
    { label: t('সুবিধাসমূহ', 'Features'), href: '#capabilities' },
    { label: t('এআই মডেল', 'AI Models'), href: '#models' },
    { label: t('কার্যপ্রণালী', 'How It Works'), href: '#how-it-works' },
    { label: t('নীতিমালা', 'Ethics & Caveats'), href: '#limitations' },
    { label: t('প্রশ্নোত্তর', 'FAQ'), href: '#faq' },
  ];

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-40 transition-all duration-300 ${
        isScrolled
          ? 'bg-cream-100/95 dark:bg-forest-950/95 backdrop-blur-md shadow-sm border-b border-sage-200/80 dark:border-forest-800/80 py-3'
          : 'bg-gradient-to-b from-forest-950/40 via-forest-950/20 to-transparent py-4 sm:py-5'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          
          {/* Brand Logo with our custom sprout & field emblem */}
          <Link to="/" className="group focus:outline-none focus:ring-2 focus:ring-gold-400 rounded-xl p-1">
            <BrandLogo size="md" variant="auto" animate={true} />
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden lg:flex items-center gap-7">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="text-sm font-bengali font-semibold text-charcoal-800 hover:text-forest-700 transition-colors"
              >
                {link.label}
              </a>
            ))}
          </nav>

          {/* Desktop Controls (Language + Auth) */}
          <div className="hidden md:flex items-center gap-3">
            {/* Language Switcher */}
            <button
              onClick={toggleLang}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-charcoal-700 hover:text-forest-900 hover:bg-forest-100/60 border border-sage-300/80 transition-colors cursor-pointer"
              title="Toggle Language / ভাষা পরিবর্তন"
            >
              <Globe className="w-3.5 h-3.5 text-forest-600" />
              <span>{lang === 'bn' ? 'English' : 'বাংলা'}</span>
            </button>

            {isAuthenticated ? (
              <div className="flex items-center gap-3">
                <Link to="/workspace">
                  <Button variant="secondary" size="sm" leftIcon={<UserCircle className="w-4 h-4" />}>
                    {t('কর্মক্ষেত্র', 'Workspace')} ({user?.username})
                  </Button>
                </Link>
                <Button variant="ghost" size="sm" onClick={logout}>
                  {t('প্রস্থান', 'Sign Out')}
                </Button>
              </div>
            ) : (
              <>
                <DemoLoginButton variant="compact" />
                <Link to="/login">
                  <Button variant="ghost" size="sm">
                    {t('লগইন', 'Sign In')}
                  </Button>
                </Link>
                <Link to="/register">
                  <Button
                    variant="primary"
                    size="sm"
                    className="shadow-sm shadow-forest-900/20 bg-forest-800 hover:bg-forest-900 text-gold-300 font-semibold"
                    rightIcon={<ArrowRight className="w-3.5 h-3.5 text-gold-400" />}
                  >
                    {t('শুরু করুন', 'Get Started')}
                  </Button>
                </Link>
              </>
            )}
          </div>

          {/* Mobile Menu & Language Button */}
          <div className="flex items-center gap-2 md:hidden">
            <button
              onClick={toggleLang}
              className="p-1.5 rounded-lg text-xs font-semibold text-charcoal-700 border border-sage-300 bg-white/80"
            >
              {lang === 'bn' ? 'EN' : 'বাং'}
            </button>
            <button
              type="button"
              className="p-2 rounded-xl text-charcoal-800 hover:text-forest-800 hover:bg-sage-100 transition-colors"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-cream-100/98 backdrop-blur-xl border-b border-sage-200 px-4 pt-3 pb-6 shadow-xl animate-fade-in-up">
          <nav className="flex flex-col gap-2.5">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="px-3 py-2.5 text-base font-bengali font-semibold text-charcoal-800 hover:text-forest-700 hover:bg-forest-50 rounded-xl transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                {link.label}
              </a>
            ))}
            <div className="pt-3 border-t border-sage-200 flex flex-col gap-2.5">
              {isAuthenticated ? (
                <>
                  <Button
                    variant="primary"
                    size="md"
                    className="w-full font-bengali font-semibold"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      navigate('/workspace');
                    }}
                  >
                    {t('কর্মক্ষেত্রে প্রবেশ করুন', 'Enter Workspace')} ({user?.username})
                  </Button>
                  <Button
                    variant="ghost"
                    size="md"
                    className="w-full font-bengali font-medium"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      logout();
                    }}
                  >
                    {t('প্রস্থান', 'Sign Out')}
                  </Button>
                </>
              ) : (
                <>
                  <Link to="/login" onClick={() => setMobileMenuOpen(false)}>
                    <Button variant="secondary" size="md" className="w-full font-bengali font-semibold">
                      {t('লগইন করুন', 'Sign In')}
                    </Button>
                  </Link>
                  <Link to="/register" onClick={() => setMobileMenuOpen(false)}>
                    <Button variant="primary" size="md" className="w-full font-bengali font-semibold bg-forest-800 text-gold-300">
                      {t('নিবন্ধন করুন', 'Create Account')}
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

export default Navbar;
