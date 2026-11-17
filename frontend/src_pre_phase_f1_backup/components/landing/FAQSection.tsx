import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Badge } from '../common/Badge.tsx';

interface FAQItem {
  question: string;
  answer: string;
}

export function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqs: FAQItem[] = [
    {
      question: 'How does AgriSphere AI ensure predictions are authentic and not hallucinated?',
      answer:
        'All seven AI models are stored as pre-trained binary artifacts (.keras and .joblib) on our backend. Every artifact is verified against canonical SHA-256 checksums defined in manifest.json. When you submit an image or soil parameters, the backend executes deterministic mathematical inference via TensorFlow 2.21 or Scikit-Learn 1.6.',
    },
    {
      question: 'Why does the system prioritize market price baselines over machine learning forecasts?',
      answer:
        'During historical research evaluation, the simple "last-observed weekly wholesale price" baseline achieved a Mean Absolute Error of 5.84 BDT/kg on tomatoes, beating the machine learning regressor (MAE 9.61 BDT/kg). Following strict scientific integrity, our system presents the baseline as the primary recommendation.',
    },
    {
      question: 'Can farmers and field workers use AgriSphere AI on mobile phones?',
      answer:
        'Yes. The user interface is completely responsive, lightweight, and optimized for mobile touchscreens. You can photograph leaf symptoms with your smartphone camera and upload JPEG, PNG, or WebP images up to 5 MiB directly.',
    },
    {
      question: 'What is included in this Phase D1 release versus the upcoming Phase D2?',
      answer:
        'Phase D1 delivers the public landing page, real FastAPI authentication (register, login, session validation), and the authenticated workspace entry. Phase D2 will deliver the full ChatGPT-style conversational workspace with interactive AI tools for all seven models and live prediction execution.',
    },
    {
      question: 'Is user data and prediction history kept secure?',
      answer:
        'Yes. User authentication uses argon2/PBKDF2 secure password hashing and stateless HS256 JWT tokens stored securely in browser session storage. Every prediction is linked to your user account and audited in the database.',
    },
  ];

  return (
    <section id="faq" className="py-24 bg-white border-t border-sage-200">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <Badge variant="sage" size="md" dot className="mb-4">
            Answers & Clarity
          </Badge>
          <h2 className="font-display font-bold text-3xl sm:text-4xl text-forest-950 tracking-tight mb-4">
            Frequently Asked Questions
          </h2>
          <p className="text-sm sm:text-base text-charcoal-700">
            Everything you need to know about AgriSphere AI's models, architecture, and scientific standards.
          </p>
        </div>

        {/* Accordion */}
        <div className="space-y-3">
          {faqs.map((faq, index) => {
            const isOpen = openIndex === index;
            return (
              <div
                key={faq.question}
                className="border border-sage-200 rounded-2xl overflow-hidden transition-colors bg-cream-50/50 hover:border-forest-400"
              >
                <button
                  type="button"
                  onClick={() => setOpenIndex(isOpen ? null : index)}
                  className="w-full text-left px-6 py-4.5 flex items-center justify-between gap-4 cursor-pointer focus:outline-none"
                  aria-expanded={isOpen}
                >
                  <span className="font-display font-semibold text-base sm:text-lg text-charcoal-900">
                    {faq.question}
                  </span>
                  <div
                    className={`w-8 h-8 rounded-full bg-sage-100 flex items-center justify-center text-forest-800 shrink-0 transition-transform duration-200 ${
                      isOpen ? 'rotate-180 bg-forest-100 text-forest-900' : ''
                    }`}
                  >
                    <ChevronDown className="w-4 h-4" />
                  </div>
                </button>

                {isOpen && (
                  <div className="px-6 pb-5 pt-1 text-sm text-charcoal-700 leading-relaxed border-t border-sage-200/60">
                    <p>{faq.answer}</p>
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
