import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, UsersRound } from 'lucide-react';
import { BRAND_NAME } from '../utils/branding';

type PortalTopBarProps = {
  studentName?: string;
  studentRegNo?: string;
  onBack?: () => void;
  backTo?: string;
  flush?: boolean;
};

export default function PortalTopBar({
  studentName,
  studentRegNo,
  onBack,
  backTo,
  flush = false,
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
            .portal-topbar { padding: 12px 14px 18px !important; border-radius: 14px !important; }
            .portal-topbar--flush {
              margin-left: -14px !important;
              margin-right: -14px !important;
              margin-top: -14px !important;
              border-radius: 20px 20px 0 0 !important;
            }
            .portal-topbar-brand { font-size: 11px !important; }
            .portal-topbar-student { display: none !important; }
          }
          .portal-topbar {
            isolation: isolate;
          }
          .portal-topbar::before {
            content: '';
            position: absolute;
            left: 0;
            right: 0;
            bottom: calc(100% - 1px);
            height: 40px;
            background: #ffffff;
            pointer-events: none;
            z-index: 2;
          }
        `}
      </style>

      <header
        className={`portal-topbar${flush ? ' portal-topbar--flush' : ''}`}
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 100,
          marginBottom: '12px',
          marginLeft: flush ? '-22px' : undefined,
          marginRight: flush ? '-22px' : undefined,
          marginTop: flush ? '-22px' : undefined,
          // Solid blue fallback so the white title never disappears if the
          // decorative wave SVG fails to repaint while the header is sticky.
          background: 'linear-gradient(90deg, #1d4ed8 0%, #2563eb 72%, #3b82f6 100%)',
          border: 'none',
          borderRadius: flush ? '20px 20px 0 0' : '18px',
          padding: '12px 16px 14px',
          color: '#ffffff',
          boxShadow: '0 8px 20px -12px rgba(37, 99, 235, 0.6)',
          overflow: 'visible',
        }}
      >
        <svg
          aria-hidden="true"
          focusable="false"
          viewBox="0 0 1000 120"
          preserveAspectRatio="none"
          style={{ position: 'absolute', inset: 0, zIndex: 0, width: '100%', height: '100%', borderRadius: 'inherit', pointerEvents: 'none' }}
        >
          <defs>
            <linearGradient id="portal-header-gradient" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#1d4ed8" />
              <stop offset="72%" stopColor="#2563eb" />
              <stop offset="100%" stopColor="#3b82f6" />
            </linearGradient>
          </defs>
          {/* White area below the wave. Unlike a full white rect, this leaves
              the header's blue fallback visible behind the title text. */}
          <path d="M0 90C160 82 330 94 532 95C700 96 845 92 1000 85L1000 120L0 120Z" fill="#ffffff" />
          <path d="M18 0H982Q1000 0 1000 18V85C845 92 700 96 532 95C330 94 160 82 0 90V18Q0 0 18 0Z" fill="#93b4ff" />
          <path d="M18 0H982Q1000 0 1000 18V76C845 83 700 88 532 87C330 86 160 73 0 82V18Q0 0 18 0Z" fill="url(#portal-header-gradient)" />
          <path
            d="M18 0H982Q1000 0 1000 18V85C845 92 700 96 532 95C330 94 160 82 0 90V18Q0 0 18 0Z"
            fill="none"
            stroke="rgba(191,219,254,0.9)"
            strokeWidth="1.2"
            vectorEffect="non-scaling-stroke"
          />
        </svg>

        <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: '0' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
              <UsersRound size={24} strokeWidth={2.1} style={{ flexShrink: 0 }} />
              <div style={{ width: '1px', height: '26px', background: 'rgba(255, 255, 255, 0.45)', flexShrink: 0 }} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div
                  className="portal-topbar-brand"
                  style={{
                    color: '#ffffff',
                    fontSize: 'clamp(10px, 2vw, 15px)',
                    fontWeight: 800,
                    lineHeight: 1.1,
                    letterSpacing: '0.02em',
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
