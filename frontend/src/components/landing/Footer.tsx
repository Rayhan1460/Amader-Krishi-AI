import { useLanguage } from '../../context/LanguageContext.tsx';
import { BRAND } from '../../styles/designTokens.ts';
import { BrandLogo } from '../common/BrandLogo.tsx';

export function Footer() {
  const { t } = useLanguage();

  return (
    <footer className="bg-charcoal-950 text-cream-200 border-t border-forest-900 py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-12">
          
          {/* Brand Column */}
          <div className="md:col-span-2">
            <div className="mb-3">
              <BrandLogo size="md" variant="dark" withTagline={true} />
            </div>
            <p className="font-bengali text-xs sm:text-sm text-sage-300 max-w-sm mb-4 leading-relaxed mt-3">
              {t(
                'আমাদের কৃষি AI — মাটি থেকে বাজার পর্যন্ত বাংলাদেশের সমন্বিত কৃষি বুদ্ধিমত্তা প্ল্যাটফর্ম। ৭টি গবেষণা-অনুমোদিত মেশিন লার্নিং মডেল ও নির্ভরযোগ্য কৃষি সহচর।',
                'Amader Krishi AI unifies seven original machine learning models to deliver precision agricultural intelligence from soil to market.'
              )}
            </p>
            <p className="text-[11px] text-sage-400 font-mono">
              Research Pipeline: TensorFlow 2.21 • Scikit-Learn 1.6 • FastAPI
            </p>
          </div>

          {/* Navigation Links */}
          <div>
            <h4 className="font-bengali font-bold text-xs uppercase tracking-wider text-gold-400 mb-4">
              {t('প্ল্যাটফর্ম লিঙ্ক', 'Platform Links')}
            </h4>
            <ul className="space-y-2.5 text-xs font-bengali text-sage-300">
              <li>
                <a href="#capabilities" className="hover:text-gold-300 transition-colors">
                  {t('সুবিধাসমূহ', 'Capabilities')}
                </a>
              </li>
              <li>
                <a href="#models" className="hover:text-gold-300 transition-colors">
                  {t('৭টি এআই মডেল', 'Research Models')}
                </a>
              </li>
              <li>
                <a href="#how-it-works" className="hover:text-gold-300 transition-colors">
                  {t('কার্যপ্রণালী', 'How It Works')}
                </a>
              </li>
              <li>
                <a href="#limitations" className="hover:text-gold-300 transition-colors">
                  {t('দায়িত্বশীল এআই নীতিমালা', 'Scientific Caveats')}
                </a>
              </li>
              <li>
                <a href="#faq" className="hover:text-gold-300 transition-colors">
                  {t('সাধারণ প্রশ্নোত্তর (FAQ)', 'FAQ')}
                </a>
              </li>
            </ul>
          </div>

          {/* Research & Compliance */}
          <div>
            <h4 className="font-bengali font-bold text-xs uppercase tracking-wider text-gold-400 mb-4">
              {t('গবেষণা ও মানদণ্ড', 'Scientific Standards')}
            </h4>
            <ul className="space-y-2.5 text-xs font-bengali text-sage-300">
              <li>{t('প্ল্যান্টভিলেজ / প্ল্যান্টডক ডুয়েল ভ্যালিডেশন', 'PlantVillage / PlantDoc Dual-Val')}</li>
              <li>{t('স্টেশন-হোল্ডআউট বন্যা বিভাজন', 'Station-Held-Out Flood Splits')}</li>
              <li>{t('বাস্তব পাইকারি বাজার বেসলাইন অগ্রাধিকার', 'Empirical Price Baselines Priority')}</li>
              <li>{t('ডিটারমিনিস্টিক SHA-256 ফাইল সিকিউরিটি', 'Deterministic SHA-256 Checksums')}</li>
              <li>{t('শূন্য কাল্পনিক বা অনুমাননির্ভর ডেটা', 'Zero Synthetic Hallucinations')}</li>
            </ul>
          </div>

        </div>

        {/* Disclaimer & Copyright */}
        <div className="pt-8 border-t border-forest-900/80 flex flex-col md:flex-row items-center justify-between gap-4 text-[11px] text-sage-400">
          <p className="font-bengali">
            &copy; {new Date().getFullYear()} {BRAND.name}. {t('সর্বস্বত্ব সংরক্ষিত। কৃষি গবেষণা ও সিদ্ধান্ত সহায়তার জন্য নিবেদিত।', 'All rights reserved. Dedicated to agricultural research and decision support.')}
          </p>
          <div className="flex items-center gap-6 font-mono text-[10px]">
            <span>{BRAND.version}</span>
            <span>FastAPI + SQLite Engine</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
