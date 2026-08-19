import { Link } from 'react-router-dom';

// Company registration details. Empty values are omitted from the footer
// rather than rendered as blank placeholders.
//
// ACTION REQUIRED BEFORE LAUNCH: fill in the real Companies House number,
// ICO registration number and registered office for Conryx Ltd. A UK
// compliance product with missing statutory details undermines buyer trust,
// and the ICO registration is a legal requirement for a data controller.
const COMPANY = {
  name: 'Conryx Ltd',
  companyNumber: '',
  icoRegistration: '',
  registeredOffice: '',
};

const LEGAL_LINKS = [
  { label: 'Privacy', to: '/privacy' },
  { label: 'Terms', to: '/terms' },
  { label: 'Cookies', to: '/cookies' },
  { label: 'Data Processing', to: '/dpa' },
];

export default function SiteFooter() {
  const registration = [
    COMPANY.companyNumber && `Company No: ${COMPANY.companyNumber}`,
    COMPANY.icoRegistration && `ICO Reg: ${COMPANY.icoRegistration}`,
  ].filter(Boolean).join(' · ');

  return (
    <footer className="border-t border-border bg-card mt-auto print:hidden">
      <div className="w-full px-4 lg:px-6 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} {COMPANY.name}
            {registration && <span className="hidden md:inline"> · {registration}</span>}
            {COMPANY.registeredOffice && <span className="hidden lg:inline"> · {COMPANY.registeredOffice}</span>}
          </p>

          <nav aria-label="Legal" className="flex flex-wrap gap-x-4 gap-y-1">
            {LEGAL_LINKS.map(({ label, to }) => (
              <Link
                key={to}
                to={to}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </footer>
  );
}
