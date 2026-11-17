import { Navbar } from '../components/landing/Navbar.tsx';
import { HeroSection } from '../components/landing/HeroSection.tsx';
import { CapabilitiesSection } from '../components/landing/CapabilitiesSection.tsx';
import { ModelCardsSection } from '../components/landing/ModelCardsSection.tsx';
import { HowItWorksSection } from '../components/landing/HowItWorksSection.tsx';
import { AIAssistantPreview } from '../components/landing/AIAssistantPreview.tsx';
import { LimitationsSection } from '../components/landing/LimitationsSection.tsx';
import { FAQSection } from '../components/landing/FAQSection.tsx';
import { CTASection } from '../components/landing/CTASection.tsx';
import { Footer } from '../components/landing/Footer.tsx';

export function LandingPage() {
  return (
    <div className="min-h-screen bg-cream-100 flex flex-col">
      <Navbar />
      <main className="flex-1">
        <HeroSection />
        <CapabilitiesSection />
        <ModelCardsSection />
        <HowItWorksSection />
        <AIAssistantPreview />
        <LimitationsSection />
        <FAQSection />
        <CTASection />
      </main>
      <Footer />
    </div>
  );
}
