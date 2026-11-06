import { Link } from 'react-router-dom';
import { Mail, MapPin, Phone } from 'lucide-react';
import { BRAND_NAME, CONTACT_ADDRESS, CONTACT_EMAIL, CONTACT_PHONE } from '../utils/branding';

export default function PortalFooter() {
  return (
    <footer
      className="portal-footer"
      style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)',
        borderRadius: '20px',
        padding: '28px 30px',
        color: '#e2e8f0',
        boxShadow: '0 18px 35px -18px rgba(15, 23, 42, 0.65)',
      }}
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '24px' }}>
        <div>
          <div style={{ color: '#ffffff', fontSize: '16px', fontWeight: 800, lineHeight: 1.35, marginBottom: '6px' }}>{BRAND_NAME}</div>
          <div style={{ color: '#93c5fd', fontSize: '11px', fontWeight: 700, letterSpacing: '0.7px', textTransform: 'uppercase' }}>Student Payment Portal</div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '8px', marginTop: '16px' }}>
            <Link to="/privacy-policy" style={{ color: '#dbeafe', fontSize: '13px', fontWeight: 600, textDecoration: 'none' }}>Privacy Policy</Link>
            <Link to="/return-policy" style={{ color: '#dbeafe', fontSize: '13px', fontWeight: 600, textDecoration: 'none' }}>Return Policy</Link>
            <Link to="/terms-and-conditions" style={{ color: '#dbeafe', fontSize: '13px', fontWeight: 600, textDecoration: 'none' }}>Terms &amp; Conditions</Link>
          </div>
        </div>
        <div>
          <div style={{ color: '#bfdbfe', fontSize: '11px', fontWeight: 700, letterSpacing: '0.7px', textTransform: 'uppercase', marginBottom: '10px' }}>Contact Address</div>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', color: '#cbd5e1', fontSize: '13px', lineHeight: 1.6 }}>
            <MapPin size={15} color="#93c5fd" style={{ flexShrink: 0, marginTop: '2px' }} />
            <span>{CONTACT_ADDRESS}</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px 18px', marginTop: '10px', fontSize: '13px' }}>
            <a href={`tel:${CONTACT_PHONE}`} style={{ color: '#e2e8f0', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px' }}><Phone size={14} color="#93c5fd" /> {CONTACT_PHONE}</a>
            <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: '#e2e8f0', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px' }}><Mail size={14} color="#93c5fd" /> {CONTACT_EMAIL}</a>
          </div>
        </div>
      </div>
      <div style={{ marginTop: '22px', paddingTop: '14px', borderTop: '1px solid rgba(255, 255, 255, 0.12)', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '8px', color: '#94a3b8', fontSize: '12px' }}>
        <span>© {new Date().getFullYear()} {BRAND_NAME}. All rights reserved.</span>
        <span>Secure hostel fee payments.</span>
      </div>
    </footer>
  );
}
