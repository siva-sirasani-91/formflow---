import { BarChart3, ClipboardList, Layers, UserPlus } from 'lucide-react';

const FEATURES = [
  {
    icon: Layers,
    title: 'Create Forms',
    description:
      'Create active or archived businesses and build custom forms with Short Text, Number, Select Dropdown, Date, Yes / No, and Repeating Table fields.',
  },
  {
    icon: UserPlus,
    title: 'Register Forms',
    description:
      'Select any business to automatically load its saved form fields, validate required inputs, and record Cash or Online payments.',
  },
  {
    icon: ClipboardList,
    title: 'Customer Records',
    description:
      'Filter records by business, search customer entries, view or edit submissions, download PDF invoices, and restore deleted entries from the Recycle Bin.',
  },
  {
    icon: BarChart3,
    title: 'Reports and Export',
    description:
      'Generate business-specific and date-filtered reports with Cash and Online payment breakdowns and form field totals, then export to PDF or Excel.',
  },
];

export default function FeaturesSection() {
  return (
    <section id="features" className="ff-landing-section bg-white">
      <div className="container">
        <div className="text-center mx-auto mb-5" style={{ maxWidth: '600px' }}>
          <span className="ff-lp-kicker">Key Features</span>
          <h2 className="h1 fw-bold mb-2">
            Focused tools for your daily business workflow.
          </h2>
          <p className="text-secondary mb-0">
            Four connected modules designed to keep forms, customer entries, and reporting consistent.
          </p>
        </div>

        <div className="row g-4 align-items-stretch">
          {FEATURES.map((feature) => {
            const Icon = feature.icon;
            return (
              <div key={feature.title} className="col-sm-6 col-lg-3">
                <div className="ff-card ff-card-hover p-4 h-100 d-flex flex-column">
                  <div className="ff-lp-icon-box mb-3">
                    <Icon size={21} />
                  </div>
                  <h3 className="h5 fw-bold mb-2">{feature.title}</h3>
                  <p className="text-secondary small mb-0 flex-grow-1">
                    {feature.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
