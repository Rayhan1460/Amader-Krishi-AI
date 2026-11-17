import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext.tsx';
import { Badge } from '../common/Badge.tsx';

interface FAQItem {
  question: string;
  questionBn: string;
  answer: string;
  answerBn: string;
}

export function FAQSection() {
  const { t } = useLanguage();
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqs: FAQItem[] = [
    {
      questionBn: 'আমাদের কৃষি AI কীভাবে কোনো কাল্পনিক তথ্য ছাড়া নির্ভুল ফলাফল প্রদান করে?',
      question: 'How does Amader Krishi AI ensure outputs are authentic without hallucinations?',
      answerBn:
        'আমাদের প্ল্যাটফর্মের ৭টি এআই মডেল সরাসরি বাইনারি আর্টিফ্যাক্ট (.keras এবং .joblib) হিসেবে ব্যাকএন্ডে সংরক্ষিত রয়েছে। প্রতিটি ফাইলের সত্যতা SHA-256 চেকসাম দিয়ে নিরীক্ষিত। কোনো প্রম্পট বা জেনারেটিভ অনুমানের পরিবর্তে এটি সরাসরি টেনসরফ্লো ২.২১ ও সাইকিট-লার্ন ১.৬ এর মাধ্যমে গাণিতিক ইনফারেন্স সম্পন্ন করে।',
      answer:
        'All seven AI models run from pre-trained binary artifacts (.keras and .joblib) verified against canonical SHA-256 checksums. Instead of probabilistic guesses, the backend runs deterministic mathematical inference via TensorFlow 2.21 and Scikit-Learn 1.6.',
    },
    {
      questionBn: 'কৃষক ও মাঠকর্মীরা কি মোবাইল ফোনে এই প্ল্যাটফর্ম ব্যবহার করতে পারবেন?',
      question: 'Can farmers and field workers use the platform on mobile smartphones?',
      answerBn:
        'হ্যাঁ। প্ল্যাটফর্মটি শতভাগ মোবাইল রেসপনসিভ ও টাচস্ক্রিন বান্ধব। যেকোনো স্মার্টফোনের ব্রাউজার দিয়ে সহজেই পাতার ছবি তুলে (৫ মেগাবাইট পর্যন্ত জেপিজি/পিএনজি/ওয়েবপি) রোগ নির্ণয় করা যায় এবং বাংলায় সরাসরি ফলাফল দেখা যায়।',
      answer:
        'Yes. The interface is 100% responsive and optimized for mobile devices. Users can photograph crop leaves directly with a smartphone camera and receive immediate Bangla/English diagnostic results.',
    },
    {
      questionBn: 'কেন বাজার দরের ক্ষেত্রে মেশিন লার্নিং অনুমানের চেয়ে বেসলাইন দরকে প্রাধান্য দেওয়া হয়?',
      question: 'Why does the system prioritize last-observed price baselines over ML forecasts?',
      answerBn:
        'আমাদের ঐতিহাসিক গবেষণা মূল্যায়নে প্রমাণিত হয়েছে যে টমেটো এবং বোরো ধানের ক্ষেত্রে পূর্ববর্তী সপ্তাহের পাইকারি দর (Last-observed baseline) মেশিন লার্নিং মডেলের চেয়ে কম ত্রুটিযুক্ত (টমেটোতে ৫.৮৪ বনাম ৯.৬২ টাকা/কেজি)। কৃষকের ক্ষতির ঝুঁকি কমাতে আমরা বৈজ্ঞানিক সততার সাথে বেসলাইন দরকেই প্রধান পরামর্শ হিসেবে তুলে ধরি।',
      answer:
        'Historical validation proved that the naive lag-1 last-observed wholesale price achieves lower Mean Absolute Error (5.84 vs 9.61 BDT/kg for tomato) than complex ML regressors. Prioritizing baseline pricing protects growers from misleading model fluctuations.',
    },
    {
      questionBn: 'ব্যবহারকারীর ডেটা ও ব্যক্তিগত তথ্যের নিরাপত্তা কীভাবে নিশ্চিত করা হয়?',
      question: 'How is user data and farm privacy safeguarded?',
      answerBn:
        'ব্যবহারকারীর পাসওয়ার্ড আধুনিক আর্গন২ (Argon2) অ্যালগরিদমে হ্যাশ করে সুরক্ষিত রাখা হয়। প্রতিটি ব্যবহারকারীর চ্যাট ও হিস্ট্রি সম্পূর্ণ আলাদা ও ডেটাবেজে সংরক্ষিত থাকে। কোনো তথ্য তৃতীয় পক্ষের সাথে বাণিজ্যিক উদ্দেশ্যে শেয়ার করা হয় না।',
      answer:
        'User authentication uses state-of-the-art Argon2 password hashing and stateless HS256 JWT tokens. Prediction histories and consultation sessions are strictly isolated per account in local SQLite database.',
    },
    {
      questionBn: 'প্ল্যাটফর্মটি কি অফলাইনে বা দুর্বল ইন্টারনেটে কাজ করতে সক্ষম?',
      question: 'Does Amader Krishi AI operate reliably on low-bandwidth connections?',
      answerBn:
        'হ্যাঁ। আমাদের স্থানীয় এগ্রোনমিক এডভাইজরি ইঞ্জিন (Rule-Based Chat Provider) কোনো বাহ্যিক ক্লাউড বা এপিআই কল ছাড়া সম্পূর্ণ স্থানীয়ভাবে অফলাইনে কাজ করতে পারে। ফলে প্রত্যন্ত অঞ্চলেও এটি দ্রুত পরামর্শ প্রদানে সক্ষম।',
      answer:
        'Yes. Our local Agronomic Advisory Engine functions 100% locally and offline without external API dependencies, ensuring rapid responses even in rural areas with fluctuating connectivity.',
    },
  ];

  return (
    <section id="faq" className="py-20 sm:py-24 bg-white dark:bg-forest-950/60 border-t border-sage-200 dark:border-forest-800">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <Badge variant="sage" size="md" dot className="mb-4">
            {t('সাধারণ জিজ্ঞাসা ও উত্তর', 'Frequently Asked Questions')}
          </Badge>
          <h2 className="font-bengali font-bold text-3xl sm:text-4xl text-forest-950 dark:text-cream-50 tracking-tight mb-4">
            {t('সচরাচর জিজ্ঞাসিত প্রশ্নাবলী', 'Frequently Asked Questions')}
          </h2>
          <p className="font-bengali text-sm sm:text-base text-charcoal-700 dark:text-sage-300">
            {t(
              'আমাদের কৃষি এআই প্ল্যাটফর্মের মডেল, প্রযুক্তি এবং বৈজ্ঞানিক মানদণ্ড সম্পর্কে বিস্তারিত তথ্য।',
              'Clear answers about models, scientific standards, data isolation, and agricultural advisory policies.'
            )}
          </p>
        </div>

        {/* Accordion */}
        <div className="space-y-3.5">
          {faqs.map((faq, index) => {
            const isOpen = openIndex === index;
            return (
              <div
                key={faq.questionBn}
                className="border border-sage-200 dark:border-forest-800 rounded-2xl overflow-hidden bg-cream-50/70 dark:bg-forest-900/60 transition-colors"
              >
                <button
                  type="button"
                  className="w-full px-6 py-4.5 text-left flex items-center justify-between gap-4 font-bengali font-bold text-base sm:text-lg text-forest-950 dark:text-cream-50 hover:text-forest-700 transition-colors cursor-pointer"
                  onClick={() => setOpenIndex(isOpen ? null : index)}
                  aria-expanded={isOpen}
                >
                  <span>{t(faq.questionBn, faq.question)}</span>
                  <ChevronDown
                    className={`w-5 h-5 text-forest-600 dark:text-gold-400 shrink-0 transition-transform duration-200 ${
                      isOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {isOpen && (
                  <div className="px-6 pb-5 pt-1 text-sm font-bengali text-charcoal-700 dark:text-sage-300 leading-relaxed border-t border-sage-200/60 dark:border-forest-800/60">
                    <p>{t(faq.answerBn, faq.answer)}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
}

export default FAQSection;
