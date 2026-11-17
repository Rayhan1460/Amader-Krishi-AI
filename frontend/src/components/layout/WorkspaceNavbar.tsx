import { Link, useNavigate } from 'react-router-dom';
import { LogOut, UserCheck, Sparkles, UserPlus, Menu, Globe, Home } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';
import { useLanguage } from '../../context/LanguageContext.tsx';
import { BrandLogo } from '../common/BrandLogo.tsx';

interface WorkspaceNavbarProps {
  onOpenMobileDrawer?: () => void;
  activeTabTitle?: string;
}

export function WorkspaceNavbar({ onOpenMobileDrawer, activeTabTitle }: WorkspaceNavbarProps) {
  const { user, isDemo, logout } = useAuth();
  const { lang, toggleLang, t } = useLanguage();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="sticky top-0 z-40 bg-forest-950/95 backdrop-blur-md border-b border-forest-800/80 py-2.5 transition-colors">
      <div className="max-w-7xl mx-auto px-2.5 sm:px-6 lg:px-8 flex items-center justify-between gap-2 sm:gap-3">
        
        {/* Left Section: Mobile Menu Trigger + Brand + Breadcrumb */}
        <div className="flex items-center gap-1.5 sm:gap-3.5 min-w-0">
          
          {/* Mobile Drawer Trigger (visible on < lg) */}
          <button
            type="button"
            onClick={onOpenMobileDrawer}
            className="lg:hidden p-1.5 sm:p-2 rounded-xl text-sage-300 hover:text-cream-50 hover:bg-forest-900 border border-forest-800 transition-colors cursor-pointer shrink-0"
            aria-label="Open sidebar menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Brand Logo & Name */}
          <Link to="/workspace" className="flex items-center gap-2 group shrink-0">
            <BrandLogo size="sm" variant="light" showText={false} withTagline={false} />
            <span className="hidden sm:inline-block font-bengali font-black text-sm text-cream-100 tracking-tight">
              আমাদের কৃষি AI
            </span>
          </Link>

          {/* Contextual Active Tab Breadcrumb */}
          {activeTabTitle && (
            <div className="hidden md:flex items-center gap-1.5 pl-2.5 border-l border-forest-800 text-xs font-bengali text-sage-300 truncate">
              <span className="text-sage-500 font-normal">/</span>
              <span className="text-gold-300 font-semibold truncate">{activeTabTitle}</span>
            </div>
          )}
        </div>

        {/* Right Section: Language Switcher, User / Demo Badge & Actions */}
        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          
          {/* Demo Mode Notice Badge (Guaranteed #demo-mode-badge ID) */}
          {isDemo ? (
            <div
              id="demo-mode-badge"
              className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1 rounded-full bg-amber-400/15 border border-amber-400/40 text-[10px] sm:text-xs text-amber-300 font-bengali font-bold shadow-2xs animate-fade-in-up shrink-0"
            >
              <Sparkles className="w-3 h-3 text-amber-400 animate-pulse shrink-0" />
              <span className="hidden sm:inline">ডেমো মোড (Demo Guest)</span>
              <span className="sm:hidden">ডেমো মোড</span>
              {user?.id && (
                <span className="hidden md:inline font-mono text-[10px] text-amber-400/80">#{user.id}</span>
              )}
            </div>
          ) : (
            <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-forest-900/90 border border-forest-800 text-xs text-cream-100 font-bengali">
              <UserCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span className="font-semibold text-cream-50">{user?.username}</span>
              {user?.id && (
                <span className="text-sage-400 font-mono text-[10px]">• #{user.id}</span>
              )}
            </div>
          )}

          {/* Demo account signup CTA */}
          {isDemo && (
            <Link to="/register" className="hidden lg:inline-block">
              <button
                type="button"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-forest-850 hover:bg-forest-800 text-gold-300 border border-gold-400/40 text-xs font-bengali font-bold transition-colors cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>{t('স্থায়ী একাউন্ট খুলুন', 'Create Account')}</span>
              </button>
            </Link>
          )}

          {/* Language Switcher Button */}
          <button
            type="button"
            onClick={toggleLang}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-forest-900/80 hover:bg-forest-850 border border-forest-800 text-xs font-mono font-semibold text-gold-300 transition-colors cursor-pointer"
            title="Toggle Language (বাংলা / English)"
          >
            <Globe className="w-3.5 h-3.5 text-gold-400" />
            <span className="text-[11px] uppercase">{lang === 'bn' ? 'বাং' : 'EN'}</span>
          </button>

          {/* Link to Public Portal */}
          <Link
            to="/"
            className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl bg-forest-900/80 hover:bg-forest-850 border border-forest-800 text-sage-300 hover:text-cream-50 text-xs font-bengali transition-colors flex items-center gap-1.5"
            title={t('মূল হোমপেজে যান', 'Go to Main Landing Page')}
          >
            <Home className="w-3.5 h-3.5" />
            <span className="hidden md:inline">{t('মূল পোর্টাল', 'Portal')}</span>
          </Link>

          {/* Logout Button */}
          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl border border-red-500/30 bg-red-950/30 hover:bg-red-900/40 text-red-300 text-xs font-bengali font-medium transition-colors cursor-pointer"
            title={isDemo ? 'ডেমো শেষ করুন' : 'সাইন আউট'}
          >
            <LogOut className="w-3.5 h-3.5 text-red-400" />
            <span className="hidden sm:inline">{isDemo ? 'ডেমো সমাপ্ত' : 'লগআউট'}</span>
          </button>

        </div>

      </div>
    </header>
  );
}
