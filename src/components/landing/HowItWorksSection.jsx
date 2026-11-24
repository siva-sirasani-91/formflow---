const WORKFLOW_STEPS = [
  {
    step: '01',
    title: 'Create Forms',
    description: 'Add your business profile and organize active or archived workspaces.',
  },
  {
    step: '02',
    title: 'Add Form Fields',
    description: 'Set up required or optional fields, dropdown lists, and repeating tables.',
  },
  {
    step: '03',
    title: 'Register Forms',
    description: 'Load the saved business form automatically and record customer and payment details.',
  },
  {
    step: '04',
    title: 'Manage Customer Records',
    description: 'Search, view, edit submissions, or download individual customer invoice PDFs.',
  },
  {
    step: '05',
    title: 'View Reports',
    description: 'Filter records by date range and export business summaries to PDF or Excel.',
  },
];

export default function HowItWorksSection() {
  return (
    <section id="how-it-works" className="ff-landing-section ff-landing-lavender">
      <div className="container">
        <div className="text-center mx-auto mb-5" style={{ maxWidth: '620px' }}>
          <span className="ff-lp-kicker">How It Works</span>
          <h2 className="h1 fw-bold mb-2">
            Five simple steps from setup to reporting.
          </h2>
          <p className="text-secondary mb-0">
            Follow a single connected flow from configuring your business form to exporting verified reports.
          </p>
        </div>

        <div className="row g-3 g-lg-4 justify-content-center align-items-stretch">
          {WORKFLOW_STEPS.map((item) => (
            <div key={item.step} className="col-sm-6 col-lg-4 col-xl">
              <div className="ff-card p-4 h-100 d-flex flex-column">
                <div className="ff-lp-step-badge mb-3">{item.step}</div>
                <h3 className="h6 fw-bold mb-2">{item.title}</h3>
                <p className="text-secondary small mb-0 flex-grow-1">
                  {item.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
