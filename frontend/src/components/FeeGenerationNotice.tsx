import type { CSSProperties } from 'react';
import { CalendarClock } from 'lucide-react';
import { getFeeCycleInfo } from '../utils/billingCycle';

interface FeeGenerationNoticeProps {
  /** Omit to show both PREPAID and POSTPAID schedules. */
  billingCycle?: string | null;
  showBothCycles?: boolean;
  compact?: boolean;
  style?: CSSProperties;
}

/**
 * Shows the current payable month and the next automatic rent & mess
 * generation date. PREPAID generates the new month's fees; POSTPAID generates
 * the previous month's fees.
 */
export const FeeGenerationNotice = ({
  billingCycle,
  showBothCycles = false,
  compact = false,
  style,
}: FeeGenerationNoticeProps) => {
  const both = showBothCycles || !billingCycle;

  const prepaid = getFeeCycleInfo('PREPAID');
  const postpaid = getFeeCycleInfo('POSTPAID');
  const single = billingCycle ? getFeeCycleInfo(billingCycle) : null;

  const bannerStyle: CSSProperties = {
    display: 'flex',
    gap: '10px',
    alignItems: 'flex-start',
    background: '#eff6ff',
    border: '1px solid #bfdbfe',
    borderRadius: '12px',
    padding: compact ? '10px 12px' : '12px 16px',
    marginBottom: '16px',
    color: '#1e3a8a',
    fontSize: compact ? '12px' : '13px',
    lineHeight: 1.55,
    ...style,
  };

  const labelStyle: CSSProperties = {
    display: 'inline-block',
    minWidth: '72px',
    marginRight: '6px',
    fontWeight: 800,
    letterSpacing: '0.02em',
  };

  return (
    <div style={bannerStyle} role="note">
      <CalendarClock size={compact ? 16 : 18} style={{ flexShrink: 0, marginTop: 1 }} />
      <div>
        <div style={{ fontWeight: 800, marginBottom: '2px' }}>Monthly fee generation</div>

        {both ? (
          <>
            <div>
              Next run: <strong>{prepaid.nextRunLabel}</strong> (1st of every month)
            </div>
            <div>
              <span style={labelStyle}>PREPAID</span>
              Payable {prepaid.currentPayableLabel} &middot; next run creates{' '}
              {prepaid.nextBillingMonthLabel} fees
            </div>
            <div>
              <span style={labelStyle}>POSTPAID</span>
              Payable {postpaid.currentPayableLabel} &middot; next run creates{' '}
              {postpaid.nextBillingMonthLabel} fees (previous month)
            </div>
          </>
        ) : (
          <>
            <div>
              Current payable month: <strong>{single?.currentPayableLabel}</strong>
              {' '}&middot; next run: <strong>{single?.nextRunLabel}</strong>
            </div>
            <div>
              {single?.billingCycle === 'POSTPAID'
                ? `${single?.nextBillingMonthLabel} rent & mess will be generated (previous month). Current-month fees become payable at that run.`
                : `${single?.nextBillingMonthLabel} rent & mess will be generated.`}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
