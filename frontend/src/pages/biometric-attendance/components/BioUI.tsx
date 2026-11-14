import type { ReactNode } from 'react';
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  Inbox,
  Loader2,
  RefreshCw,
  Search,
  X,
  XCircle,
} from 'lucide-react';
import { LoadingSpinner } from '../../../components/LoadingSpinner';
import { initials } from '../utils';

export type StatTone = 'accent' | 'success' | 'danger' | 'warning' | 'info' | 'purple' | 'neutral';

export interface BioStatItem {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  icon: ReactNode;
  tone?: StatTone;
}

export const BioStatGrid = ({ items }: { items: BioStatItem[] }) => (
  <div className="bio-stat-grid">
    {items.map((item) => (
      <div className={`bio-stat bio-tone-${item.tone || 'accent'}`} key={item.label}>
        <div className="bio-stat-icon">{item.icon}</div>
        <div className="bio-stat-copy">
          <div className="bio-stat-label">{item.label}</div>
          <div className="bio-stat-value">{item.value}</div>
          {item.sub ? <div className="bio-stat-sub">{item.sub}</div> : null}
        </div>
      </div>
    ))}
  </div>
);

export const BioErrorNotice = ({ message, onRetry }: { message: string; onRetry?: () => void }) => (
  <div className="bio-notice bio-notice--danger" role="alert">
    <div className="bio-notice-icon">
      <AlertTriangle size={20} />
    </div>
    <div className="bio-notice-copy">
      <div className="bio-notice-title">Could not load biometric data</div>
      <div className="bio-notice-text">{message}</div>
    </div>
    {onRetry ? (
      <button className="ui-btn ui-btn-secondary ui-btn-sm" onClick={onRetry} type="button">
        <RefreshCw size={14} /> Retry
      </button>
    ) : null}
  </div>
);

export const BioEmpty = ({
  title = 'No records found',
  text,
  icon,
}: {
  title?: string;
  text?: string;
  icon?: ReactNode;
}) => (
  <div className="bio-empty">
    <div className="bio-empty-icon">{icon || <Inbox size={30} />}</div>
    <div className="bio-empty-title">{title}</div>
    {text ? <div className="bio-empty-text">{text}</div> : null}
  </div>
);

export const BioTableState = ({
  loading,
  error,
  empty,
  colSpan,
  emptyTitle,
  emptyText,
  onRetry,
}: {
  loading: boolean;
  error: string | null;
  empty: boolean;
  colSpan: number;
  emptyTitle?: string;
  emptyText?: string;
  onRetry?: () => void;
}) => {
  if (loading) {
    return (
      <tr>
        <td colSpan={colSpan} className="ui-table-state">
          <LoadingSpinner text="Loading biometric records..." />
        </td>
      </tr>
    );
  }
  if (error) {
    return (
      <tr>
        <td colSpan={colSpan} className="bio-table-message bio-table-message--danger">
          <XCircle size={20} />
          <span>{error}</span>
          {onRetry ? (
            <button className="ui-btn ui-btn-secondary ui-btn-sm" onClick={onRetry} type="button">
              Retry
            </button>
          ) : null}
        </td>
      </tr>
    );
  }
  if (empty) {
    return (
      <tr>
        <td colSpan={colSpan}>
          <BioEmpty title={emptyTitle} text={emptyText} />
        </td>
      </tr>
    );
  }
  return null;
};

export const DirectionBadge = ({ direction }: { direction: string }) => {
  const isIn = String(direction).toUpperCase().startsWith('IN');
  return (
    <span className={`bio-direction ${isIn ? 'is-in' : 'is-out'}`}>
      {isIn ? <ArrowDownLeft size={14} /> : <ArrowUpRight size={14} />}
      {isIn ? 'IN' : 'OUT'}
    </span>
  );
};

export const BioStatus = ({ status }: { status?: string | null }) => {
  const text = String(status || 'Unknown');
  const lower = text.toLowerCase();
  const tone =
    lower.includes('present') || lower.includes('inside') || lower.includes('online') || lower.includes('success')
      ? 'is-success'
      : lower.includes('absent') || lower.includes('error') || lower.includes('offline') || lower.includes('fail')
        ? 'is-danger'
        : lower.includes('late') || lower.includes('warning') || lower.includes('pending')
          ? 'is-warning'
          : 'is-neutral';
  return <span className={`bio-status ${tone}`}>{text.replace(/_/g, ' ')}</span>;
};

export const BioStudent = ({
  name,
  regNo,
  room,
  bed,
}: {
  name?: string | null;
  regNo?: string | null;
  room?: string | null;
  bed?: string | null;
}) => (
  <div className="bio-person">
    <div className="bio-avatar">{initials(name)}</div>
    <div>
      <div className="bio-person-name">{name || 'Unregistered'}</div>
      <div className="bio-person-meta">
        {regNo || 'No register no.'}
        {room ? ` · Room ${room}` : ''}
        {bed ? ` · ${bed}` : ''}
      </div>
    </div>
  </div>
);

export const BioPager = ({
  page,
  totalPages,
  total,
  limit,
  onPage,
}: {
  page: number;
  totalPages: number;
  total: number;
  limit: number;
  onPage: (page: number) => void;
}) => {
  if (total === 0) return null;
  const start = (page - 1) * limit + 1;
  const end = Math.min(page * limit, total);
  const pages: number[] = [];
  const first = Math.max(1, Math.min(page - 2, totalPages - 4));
  for (let index = first; index <= Math.min(totalPages, first + 4); index += 1) pages.push(index);

  return (
    <div className="ui-pagination bio-pagination">
      <div className="ui-page-info">
        Showing <span className="ui-strong">{start}</span> to <span className="ui-strong">{end}</span> of{' '}
        <span className="ui-strong">{total}</span> entries
      </div>
      <div className="ui-page-controls">
        <button
          type="button"
          className="ui-page-btn"
          onClick={() => onPage(Math.max(1, page - 1))}
          disabled={page <= 1}
          aria-label="Previous page"
        >
          <ChevronLeft size={15} />
        </button>
        {pages.map((value) => (
          <button
            type="button"
            key={value}
            className={`ui-page-btn ${value === page ? 'is-current' : ''}`}
            onClick={() => onPage(value)}
          >
            {value}
          </button>
        ))}
        <button
          type="button"
          className="ui-page-btn"
          onClick={() => onPage(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages}
          aria-label="Next page"
        >
          <ChevronRight size={15} />
        </button>
      </div>
    </div>
  );
};

export const BioCardHead = ({
  title,
  subtitle,
  icon,
  action,
}: {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  action?: ReactNode;
}) => (
  <div className="bio-card-head">
    <div className="bio-card-head-main">
      {icon ? <div className="bio-card-head-icon">{icon}</div> : null}
      <div>
        <div className="bio-card-title">{title}</div>
        {subtitle ? <div className="bio-card-sub">{subtitle}</div> : null}
      </div>
    </div>
    {action}
  </div>
);

export const BioDateRange = ({
  fromDate,
  toDate,
  onFrom,
  onTo,
  labelFrom = 'From',
  labelTo = 'To',
}: {
  fromDate: string;
  toDate: string;
  onFrom: (value: string) => void;
  onTo: (value: string) => void;
  labelFrom?: string;
  labelTo?: string;
}) => (
  <>
    <label className="bio-field">
      <span>{labelFrom}</span>
      <input
        type="date"
        className="ui-input ui-input--inline"
        value={fromDate}
        onChange={(event) => onFrom(event.target.value)}
      />
    </label>
    <label className="bio-field">
      <span>{labelTo}</span>
      <input
        type="date"
        className="ui-input ui-input--inline"
        value={toDate}
        onChange={(event) => onTo(event.target.value)}
      />
    </label>
  </>
);

export const BioRefresh = ({ onClick, loading }: { onClick: () => void; loading?: boolean }) => (
  <button type="button" className="ui-btn ui-btn-secondary ui-btn-sm" onClick={onClick} disabled={loading}>
    {loading ? <Loader2 size={15} className="bio-spin" /> : <RefreshCw size={15} />}
    Refresh
  </button>
);

export const BioExportButton = ({
  onClick,
  disabled,
}: {
  onClick: () => void;
  disabled?: boolean;
}) => (
  <button type="button" className="ui-btn ui-btn-primary ui-btn-sm" onClick={onClick} disabled={disabled}>
    <FileSpreadsheet size={15} /> Export Excel
  </button>
);

export const BioSearchField = ({
  value,
  onChange,
  placeholder = 'Search student, register no. or room...',
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) => (
  <div className="ui-search bio-search">
    <Search size={15} />
    <input
      type="search"
      value={value}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
      aria-label={placeholder}
    />
    {value ? (
      <button type="button" className="ui-search-clear" onClick={() => onChange('')} aria-label="Clear search">
        <X size={14} />
      </button>
    ) : null}
  </div>
);

export const BioPageHead = ({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) => (
  <div className="bio-page-head">
    <div>
      <h2 className="bio-page-title">{title}</h2>
      {subtitle ? <p className="bio-page-sub">{subtitle}</p> : null}
    </div>
    {actions ? <div className="bio-page-actions">{actions}</div> : null}
  </div>
);

export const BioRate = ({ value, label }: { value: number; label?: string }) => {
  const safe = Math.max(0, Math.min(100, Number(value) || 0));
  const tone = safe >= 85 ? 'is-good' : safe >= 60 ? 'is-mid' : 'is-low';
  return (
    <div className={`bio-rate ${tone}`}>
      <div className="bio-rate-top">
        <span className="bio-rate-value">{Math.round(safe * 10) / 10}%</span>
        {label ? <span className="bio-rate-label">{label}</span> : null}
      </div>
      <div className="bio-rate-track">
        <span className="bio-rate-fill" style={{ width: `${safe}%` }} />
      </div>
    </div>
  );
};

export const BioField = ({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) => (
  <label className="bio-field">
    <span>{label}</span>
    {children}
  </label>
);
