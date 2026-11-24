import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

const FAQS = [
  {
    q: 'How do I create custom forms for each business?',
    a: 'Inside Create Forms, select or create a business and add Short Text, Number, Select Dropdown, Date, Yes / No, or Repeating Table fields. Each business keeps its own saved form.',
  },
  {
    q: 'How does Register Forms work with saved business forms?',
    a: 'On the Register Forms page, choosing a business automatically loads only that business’s saved form fields. Required fields and repeating table rows are checked along with Cash or Online payment details before saving.',
  },
  {
    q: 'How can I view, edit, or recover customer records?',
    a: 'In the Records page, you can filter by business, search customer entries, view full field and table details, or edit existing records. Deleted records move to the Recycle Bin in Settings and remain recoverable for 30 days.',
  },
  {
    q: 'How are reports calculated from saved records?',
    a: 'Reports calculate totals from saved customer records for the selected business and date range (Today, Yesterday, This Week, This Month, This Year, or Custom Range), separating Cash and Online payments and excluding phone numbers or IDs from totals.',
  },
  {
    q: 'What export formats are available?',
    a: 'You can download individual customer invoices as PDF files from Records, export full business summary reports as PDF or Excel (.xlsx) files from Reports, and download full workspace backups from Settings.',
  },
];

export default function FaqSection() {
  const [openIndex, setOpenIndex] = useState(0);

  function toggleIndex(idx) {
    setOpenIndex((prev) => (prev === idx ? -1 : idx));
  }

  return (
    <section id="faq" className="ff-landing-section ff-landing-lavender">
      <div className="container">
        <div className="row g-5 align-items-start">
          <div className="col-lg-5">
            <span className="ff-lp-kicker">FAQ</span>
            <h2 className="h1 fw-bold mb-3">
              Frequently Asked Questions
            </h2>
            <p className="text-secondary mb-0">
              Straightforward answers about creating business forms, registering customers, managing records, and exporting reports.
            </p>
          </div>

          <div className="col-lg-7">
            <div className="d-flex flex-column gap-3">
              {FAQS.map((item, idx) => {
                const isOpen = openIndex === idx;
                return (
                  <div key={item.q} className="ff-accordion-item">
                    <button
                      type="button"
                      className="ff-accordion-btn"
                      aria-expanded={isOpen}
                      onClick={() => toggleIndex(idx)}
                    >
                      <span>{item.q}</span>
                      <ChevronDown
                        size={18}
                        className="text-secondary flex-shrink-0"
                        style={{
                          transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                          transition: 'transform 200ms ease',
                        }}
                      />
                    </button>
                    {isOpen && (
                      <div className="px-4 pb-4 text-secondary border-top pt-3 small">
                        {item.a}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
