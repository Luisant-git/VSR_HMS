import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  rightContent?: React.ReactNode;
}

export const PageHeader = ({ title, subtitle, showBack = true, rightContent }: PageHeaderProps) => {
  const navigate = useNavigate();

  return (
    <div className="card-header" style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', background: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 4px 15px rgba(0,0,0,0.02)' }}>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        {showBack && (
          <button 
            onClick={() => navigate(-1)} 
            style={{ padding: '8px 12px', borderRadius: '8px', fontSize: '14px', fontWeight: 600, background: 'white', border: '1px solid #cbd5e1', color: '#475569', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.02)', marginRight: '15px' }}
          >
            <ArrowLeft size={18} /> Back
          </button>
        )}
        <div>
          <h2 className="card-title" style={{ margin: 0 }}>{title}</h2>
          {subtitle && (
            <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
              {subtitle}
            </div>
          )}
        </div>
      </div>
      {rightContent && (
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {rightContent}
        </div>
      )}
    </div>
  );
};
