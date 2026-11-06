import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { FileText, Mail, MapPin, Phone, RotateCcw, ShieldCheck } from 'lucide-react';
import { setDocumentTitle } from '../utils/documentTitle';
import { BRAND_NAME, CONTACT_ADDRESS, CONTACT_EMAIL, CONTACT_PHONE } from '../utils/branding';
import PortalTopBar from '../components/PortalTopBar';
import PortalFooter from '../components/PortalFooter';

const POLICIES = {
  privacy: {
    title: 'Privacy Policy',
    icon: ShieldCheck,
    intro:
      'This policy explains what information the hostel collects through the student payment portal and how it is used.',
    sections: [
      {
        heading: 'Information we collect',
        body: 'We collect only the information needed to identify the student and process fee payments, including the registered mobile number, student and room details, and payment records.',
      },
      {
        heading: 'How we use your information',
        body: 'Your information is used for fee collection, receipt generation, account reconciliation and communication relating to your stay at the hostel. It is not sold to third parties.',
      },
      {
        heading: 'Payment security',
        body: 'Payment details are handled through the payment provider used by the hostel. We do not store your card, UPI or net-banking credentials on this portal.',
      },
      {
        heading: 'Your choices',
        body: 'You may contact the hostel office to request correction of your details or for any clarification about how your information is used.',
      },
    ],
  },
  return: {
    title: 'Return Policy',
    icon: RotateCcw,
    intro:
      'This policy explains how incorrect, duplicate or failed fee payments are handled by the hostel.',
    sections: [
      {
        heading: 'Check before you pay',
        body: 'Fee payments are collected against the dues shown in your student account. Please check the student name, registration number, fee description and amount carefully before paying.',
      },
      {
        heading: 'Failed or duplicate payments',
        body: 'If a payment is deducted but the receipt is not generated, or if an incorrect amount is paid due to a portal or payment gateway error, contact the hostel office immediately with the transaction reference.',
      },
      {
        heading: 'Refunds and adjustments',
        body: 'Approved refunds or adjustments for duplicate or incorrect payments will be processed through the original payment method or adjusted against future dues, as decided by the hostel office.',
      },
      {
        heading: 'Non-refundable fees',
        body: 'Refunds are not available for fees that have already been consumed or for amounts that are non-refundable under the hostel admission terms.',
      },
    ],
  },
  terms: {
    title: 'Terms and Conditions',
    icon: FileText,
    intro:
      'These terms apply to every student using the hostel fee payment portal.',
    sections: [
      {
        heading: 'Authorised use',
        body: 'By using this payment portal, you confirm that the mobile number entered is registered against your student record and that you are authorised to make payments for the fees shown.',
      },
      {
        heading: 'Verify your details',
        body: 'Fee amounts, dues and receipts are generated from the hostel records. Please verify the student details and the amount before confirming any payment.',
      },
      {
        heading: 'Payment confirmation',
        body: 'Payments made through this portal are subject to verification by the hostel office. A payment is considered complete only after a receipt is generated successfully.',
      },
      {
        heading: 'Misuse',
        body: 'Any attempt to misuse the portal, provide false information or make unauthorised payments may result in access being withdrawn and further action being taken by the hostel.',
      },
    ],
  },
} as const;

type PolicyKey = keyof typeof POLICIES;

function getPolicyKey(pathname: string): PolicyKey {
  if (pathname.includes('return-policy')) return 'return';
  if (pathname.includes('terms')) return 'terms';
  return 'privacy';
}

export default function PolicyPage() {
  const { pathname } = useLocation();
  const policyKey = getPolicyKey(pathname);
  const policy = POLICIES[policyKey];
  const Icon = policy.icon;

  useEffect(() => {
    // Remember that the portal was reached from a policy page so the payment
    // modal is not forced open when the student goes back.
    sessionStorage.setItem('student_portal_return_from_policy', '1');
    setDocumentTitle(`${policy.title} | ${BRAND_NAME}`);
    window.scrollTo(0, 0);
  }, [policy.title]);

  return (
    <div className="policy-page" style={{ height: '100vh', overflowY: 'auto', WebkitOverflowScrolling: 'touch', boxSizing: 'border-box', background: '#f8fafc', fontFamily: '"Inter", sans-serif', padding: '32px 20px' }}>
      <style>
        {`
          @media (max-width: 640px) {
            .policy-page { padding: 20px 14px !important; }
            .policy-card { padding: 22px !important; border-radius: 16px !important; }
            .policy-title { font-size: 22px !important; }
          }
        `}
      </style>
      <div style={{ maxWidth: '850px', margin: '0 auto' }}>
        <PortalTopBar backTo="/student-portal?fromPolicy=1" />

        <div className="policy-card" style={{ background: 'white', borderRadius: '20px', padding: '36px', boxShadow: '0 10px 30px -15px rgba(0,0,0,0.1)', border: '1px solid #f1f5f9' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
            <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon size={22} />
            </div>
            <div>
              <div style={{ color: '#1e3a8a', fontSize: '13px', fontWeight: 800, letterSpacing: '0.3px' }}>{BRAND_NAME}</div>
              <h1 className="policy-title" style={{ margin: 0, color: '#0f172a', fontSize: '26px', fontWeight: 800, letterSpacing: '-0.4px' }}>{policy.title}</h1>
            </div>
          </div>

          <p style={{ color: '#64748b', fontSize: '14px', lineHeight: 1.65, margin: '18px 0 26px 0' }}>{policy.intro}</p>

          {policy.sections.map((section) => (
            <section key={section.heading} style={{ marginBottom: '22px' }}>
              <h2 style={{ margin: '0 0 6px 0', color: '#1e293b', fontSize: '15px', fontWeight: 700 }}>{section.heading}</h2>
              <p style={{ margin: 0, color: '#475569', fontSize: '14px', lineHeight: 1.7 }}>{section.body}</p>
            </section>
          ))}

          <div style={{ marginTop: '28px', paddingTop: '20px', borderTop: '1px solid #f1f5f9' }}>
            <div style={{ color: '#334155', fontSize: '13px', fontWeight: 700, marginBottom: '8px' }}>Contact Address</div>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', color: '#64748b', fontSize: '13px', lineHeight: 1.6 }}>
              <MapPin size={16} color="#94a3b8" style={{ flexShrink: 0, marginTop: '2px' }} />
              <span>{CONTACT_ADDRESS}</span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 20px', marginTop: '10px', fontSize: '13px' }}>
              <a href={`tel:${CONTACT_PHONE}`} style={{ color: '#475569', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <Phone size={14} color="#94a3b8" /> {CONTACT_PHONE}
              </a>
              <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: '#475569', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <Mail size={14} color="#94a3b8" /> {CONTACT_EMAIL}
              </a>
            </div>
          </div>
        </div>

        <div style={{ marginTop: '24px' }}>
          <PortalFooter />
        </div>
      </div>
    </div>
  );
}
