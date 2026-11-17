import { Coins, ArrowRight, ShieldCheck } from 'lucide-react';
import { useLanguage } from '../../../context/LanguageContext.tsx';
import type { WorkspaceTab } from '../WorkspaceSidebar.tsx';

interface MarketResearchPreviewCardProps {
  onNavigateToTab: (tab: WorkspaceTab, modelId?: string) => void;
  isLoading?: boolean;
}

export function MarketResearchPreviewCard({
  onNavigateToTab,
  isLoading = false,
}: MarketResearchPreviewCardProps) {
  const { lang } = useLanguage();

  // Validated commodities supported by our verified AI models
  const supportedCommodities = [
    {
      id: 'tomato_price',
      nameBn: 'টমেটো',
      nameEn: 'Tomato',
      benchmarkRange: '৳৩৫ – ৳৪৯ / কেজি',
      benchmarkRangeEn: '৳35 – ৳49 / kg',
      market: 'কাওরান বাজার ও বগুড়া',
      marketEn: 'Karwan Bazar & Bogra',
      source: 'মডেল বেঞ্চমার্ক',
      sourceEn: 'Research Benchmark',
      modelId: 'tomato_price',
    },
    {
      id: 'boro_rice_price',
      nameBn: 'বোরো ধান',
      nameEn: 'Boro Rice',
      benchmarkRange: '৳৪১ – ৳৫২ / কেজি',
      benchmarkRangeEn: '৳41 – ৳52 / kg',
      market: 'রংপুর ও নওগাঁ মোকাম',
      marketEn: 'Rangpur & Naogaon',
      source: 'মডেল বেঞ্চমার্ক',
      sourceEn: 'Research Benchmark',
      modelId: 'rice_price',
    },
  ];

  return (
    <div className="bg-[#082b1f] border border-[#1b4332] rounded-2xl p-5 sm:p-6 flex flex-col justify-between shadow-xl transition-all duration-300 hover:border-[#1b4332]/80">
      <div>
        {/* Header matching 02_dashboard_reference.png */}
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <Coins className="w-4 h-4 text-[#e9ad46]" />
            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
              {lang === 'bn' ? 'বাজার বিশ্লেষণ' : 'Market Intelligence'}
            </h2>
          </div>
          <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-[#153f2e] text-[#a7b9ae] border border-[#1b4332]">
            {lang === 'bn' ? 'গবেষণা বেঞ্চমার্ক' : 'Research Benchmark'}
          </span>
        </div>

        {/* Commodity items list */}
        {isLoading ? (
          <div className="space-y-3 py-2 animate-pulse">
            <div className="h-14 bg-[#062519] rounded-xl" />
            <div className="h-14 bg-[#062519] rounded-xl" />
          </div>
        ) : (
          <div className="space-y-3">
            {supportedCommodities.map((item) => (
              <div
                key={item.id}
                onClick={() => onNavigateToTab('tools', item.modelId)}
                className="p-3 rounded-xl bg-[#062519] hover:bg-[#0d3625] border border-transparent hover:border-[#e9ad46]/30 transition-all cursor-pointer flex items-center justify-between group"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs sm:text-sm font-bold text-white group-hover:text-[#e9ad46] transition-colors">
                      {lang === 'bn' ? item.nameBn : item.nameEn}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-[#153f2e] text-[#a7b9ae]">
                      {lang === 'bn' ? item.source : item.sourceEn}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#a7b9ae] mt-0.5">
                    {lang === 'bn' ? item.market : item.marketEn}
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-xs sm:text-sm font-bold text-white font-mono group-hover:text-amber-200 transition-colors">
                    {lang === 'bn' ? item.benchmarkRange : item.benchmarkRangeEn}
                  </p>
                  <p className="text-[10px] text-[#a7b9ae]/80">
                    {lang === 'bn' ? 'পাইকারি পরিসীমা' : 'Wholesale Band'}
                  </p>
                </div>
              </div>
            ))}

            {/* Scientific Transparency Disclaimer */}
            <div className="p-3 rounded-xl bg-[#062519]/70 border border-[#1b4332]/60 text-[11px] text-[#a7b9ae] space-y-1">
              <div className="flex items-center gap-1.5 text-cream-100 font-medium">
                <ShieldCheck className="w-3.5 h-3.5 text-[#e9ad46]" />
                <span>{lang === 'bn' ? 'স্বচ্ছ তথ্যসূত্র নীতি' : 'Transparent Data Policy'}</span>
              </div>
              <p className="leading-relaxed">
                {lang === 'bn'
                  ? 'উক্ত দর পাইকারি গবেষণা মডেলের ঐতিহাসিক নির্দেশক। এটি সরাসরি লাইভ বাজার দর নয়।'
                  : 'Derived from baseline research models. Not a real-time live ticker.'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Footer navigation */}
      <div className="mt-4 pt-3 border-t border-[#1b4332]/60 flex items-center justify-between text-xs text-[#a7b9ae]">
        <span>
          {lang === 'bn' ? 'মূল্য পূর্বাভাস মডেল চালান' : 'Run price models'}
        </span>
        <button
          onClick={() => onNavigateToTab('tools', 'tomato_price')}
          className="text-[#e9ad46] font-semibold hover:underline inline-flex items-center gap-1 cursor-pointer"
        >
          <span>{lang === 'bn' ? 'বাজার মডেল' : 'Price Models'}</span>
          <ArrowRight className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}
