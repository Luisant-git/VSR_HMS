import React from 'react';
import { Calendar, X } from 'lucide-react';

export const getOrdinalSuffix = (n: number): string => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
};

interface MonthlyDueDayPickerProps {
  value?: string | null;
  onChange: (dateStr: string) => void;
  label?: string;
  optionalTag?: string;
  required?: boolean;
  inline?: boolean;
}

export const MonthlyDueDayPicker: React.FC<MonthlyDueDayPickerProps> = ({
  value,
  onChange,
  label = 'Due Day',
  optionalTag,
  required = false,
}) => {
  // Extract day number (1 - 31) from date string (e.g. '2026-11-24' or numeric day)
  const selectedDay = React.useMemo(() => {
    if (!value) return null;
    const str = String(value).trim();
    const parts = str.split('T')[0].split('-');
    if (parts.length === 3) {
      const d = parseInt(parts[2], 10);
      return !isNaN(d) && d >= 1 && d <= 31 ? d : null;
    }
    const num = parseInt(str, 10);
    return !isNaN(num) && num >= 1 && num <= 31 ? num : null;
  }, [value]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digitsOnly = e.target.value.replace(/\D/g, '');
    if (digitsOnly === '') {
      onChange('');
      return;
    }
    const val = parseInt(digitsOnly, 10);
    if (val === 0) {
      onChange('');
      return;
    }
    if (val >= 1 && val <= 31) {
      onChange(String(val));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      const next = selectedDay ? Math.min(31, selectedDay + 1) : 1;
      onChange(String(next));
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!selectedDay || selectedDay <= 1) {
        onChange('');
      } else {
        onChange(String(selectedDay - 1));
      }
    }
  };

  return (
    <div className="mdp-field">
      <label className="ui-form-label mdp-field-label">
        {label} {optionalTag && <span className="fm-optional">({optionalTag})</span>}
        {required && <span className="mdp-req">*</span>}
      </label>

      <div className={`mdp-control-card ${selectedDay ? 'is-set' : ''}`}>
        <div className="mdp-control-main">
          <span className="mdp-control-icon" aria-hidden="true">
            <Calendar size={15} />
          </span>

          <div className="mdp-segmented-input">
            <span className="mdp-seg-addon">Day</span>
            <input
              type="text"
              inputMode="numeric"
              maxLength={2}
              value={selectedDay !== null ? String(selectedDay) : ''}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              onFocus={(e) => e.target.select()}
              placeholder="0"
              className="mdp-seg-field"
              aria-label="Due day of month (1 to 31)"
            />
            <span className="mdp-seg-addon mdp-seg-addon-right">of month</span>
          </div>
        </div>

        <div className="mdp-control-status">
          {selectedDay ? (
            <>
              <span className="mdp-status-pill is-active">
                Every {selectedDay}{getOrdinalSuffix(selectedDay)}
              </span>
              <button
                type="button"
                onClick={() => onChange('')}
                className="mdp-clear-btn"
                title="Clear due day"
                aria-label="Clear due day"
              >
                <X size={13} />
              </button>
            </>
          ) : (
            <span className="mdp-status-pill">Not set</span>
          )}
        </div>
      </div>

      <div className="mdp-helper-text">
        {selectedDay
          ? `Fees are due on day ${selectedDay} of each month. Late fine applies from day ${selectedDay === 31 ? 1 : selectedDay + 1}.`
          : 'Enter a day (1–31) for the monthly recurring fee due date.'}
      </div>
    </div>
  );
};
