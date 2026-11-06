import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Building } from 'lucide-react';
import { BRAND_NAME } from '../utils/branding';

type PortalTopBarProps = {
  studentName?: string;
  studentRegNo?: string;
  onBack?: () => void;
  backTo?: string;
};

export default function PortalTopBar({
  studentName,
  studentRegNo,
  onBack,
  backTo,
}: PortalTopBarProps) {
  const showBack = Boolean(onBack || backTo);

  const backButtonStyle: CSSProperties = {
    width: '34px',
    height: '34px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    border: '1px solid rgba(255, 255, 255, 0.22)',
    borderRadius: '50%',
    background: 'rgba(255, 255, 255, 0.18)',
    color: '#ffffff',
    cursor: 'pointer',
    textDecoration: 'none',
    transition: 'background 0.2s ease',
  };

  return (
    <>
      <style>
        {`
          @media (max-width: 640px) {
            .portal-topbar { padding: 11px 13px !important; border-radius: 14px !important; }
            .portal-topbar-brand { font-size: 11px !important; }
            .portal-topbar-student { display: none !important; }
          }
        `}
      </style>

      <header
        className="portal-topbar"
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 30,
          marginBottom: '26px',
          background: 'transparent',
          border: 'none',
          borderRadius: '18px',
          padding: '12px 16px',
          color: '#ffffff',
          boxShadow: '0 8px 20px -10px rgba(37, 99, 235, 0.7)',
          overflow: 'hidden',
        }}
      >
        <svg
          aria-hidden="true"
          focusable="false"
          viewBox="0 0 1000 120"
          preserveAspectRatio="none"
          style={{ position: 'absolute', inset: 0, zIndex: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
        >
          <defs>
            <linearGradient id="portal-header-gradient" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#1d4ed8" />
              <stop offset="72%" stopColor="#2563eb" />
              <stop offset="100%" stopColor="#3b82f6" />
            </linearGradient>
          </defs>
          <path d="M18 0H982Q1000 0 1000 18V92C845 105 705 113 530 111C335 109 155 90 0 101V18Q0 0 18 0Z" fill="#93b4ff" />
          <path d="M18 0H982Q1000 0 1000 18V82C845 95 705 102 530 100C335 98 155 79 0 91V18Q0 0 18 0Z" fill="url(#portal-header-gradient)" />
        </svg>

        <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
              <Building size={25} strokeWidth={2.2} style={{ flexShrink: 0 }} />
              <div style={{ width: '1px', height: '32px', background: 'rgba(255, 255, 255, 0.45)', flexShrink: 0 }} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div
                  className="portal-topbar-brand"
                  style={{
                    color: '#ffffff',
                    fontSize: 'clamp(11px, 2.5vw, 16px)',
                    fontWeight: 800,
                    lineHeight: 1.2,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {BRAND_NAME}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
              {studentName && (
                <div className="portal-topbar-student" style={{ textAlign: 'right', lineHeight: 1.3 }}>
                  <div
                    style={{
                      color: '#ffffff',
                      fontSize: '12px',
                      fontWeight: 700,
                      maxWidth: '140px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {studentName}
                  </div>
                  {studentRegNo && (
                    <div style={{ color: '#dbeafe', fontSize: '10.5px', fontWeight: 500 }}>{studentRegNo}</div>
                  )}
                </div>
              )}

              {showBack && (
                backTo ? (
                  <Link to={backTo} aria-label="Back to student payment portal" style={backButtonStyle}>
                    <ArrowLeft size={17} />
                  </Link>
                ) : (
                  <button type="button" aria-label="Back to mobile number entry" onClick={onBack} style={backButtonStyle}>
                    <ArrowLeft size={17} />
                  </button>
                )
              )}
            </div>
          </div>
        </div>
      </header>
    </>
  );
}
