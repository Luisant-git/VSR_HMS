import React, { useState } from 'react';
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
  inline = false,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [tempDay, setTempDay] = useState<number | null>(null);

  // Extract day number (1 - 31) from date string (e.g. '2026-11-24' or ISO string or numeric day)
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

  const currentYear = new Date().getFullYear();

  // Active day to display in the calendar picker
  const activeDay = inline ? selectedDay : (isModalOpen ? tempDay : selectedDay);

  const handleSelectDay = (day: number) => {
    if (inline) {
      onChange(String(day));
    } else {
      setTempDay(day);
    }
  };

  const handleOpenModal = () => {
    setTempDay(selectedDay);
    setIsModalOpen(true);
  };

  const handleConfirmModal = () => {
    if (tempDay !== null) {
      onChange(String(tempDay));
    } else {
      onChange('');
    }
    setIsModalOpen(false);
  };

  const handleCancelModal = () => {
    setIsModalOpen(false);
  };

  const commonPresets = [5, 10, 15, 20, 25, 30];
  const allDays = Array.from({ length: 31 }, (_, i) => i + 1);

  // Calendar View Content
  const calendarView = (
    <div className="monthly-day-picker">
      {/* Top Header Row: Title on Left, Day: [ 6 ] of month on Right */}
      <div className="mdp-header">
        <h4 className="mdp-title">
          {label} {optionalTag && <span className="fm-optional">({optionalTag})</span>}
          {required && <span className="mdp-req">*</span>}
        </h4>
        <div className="mdp-day-input-group">
          <span className="mdp-day-label">Day:</span>
          <input
            type="number"
            min={1}
            max={31}
            value={activeDay ?? ''}
            onChange={(e) => {
              const val = parseInt(e.target.value, 10);
              if (!isNaN(val) && val >= 1 && val <= 31) {
                handleSelectDay(val);
              } else if (e.target.value === '') {
                if (inline) onChange('');
                else setTempDay(null);
              }
            }}
            placeholder=""
            className="mdp-day-input"
          />
          <span className="mdp-day-suffix">of month</span>
        </div>
      </div>

      {/* Quick Presets Row - Never wraps, flexes evenly across available width */}
      <div className="mdp-quick-row">
        <span className="mdp-quick-label">Quick:</span>
        <div className="mdp-quick-list">
          {commonPresets.map((d) => {
            const isSelected = activeDay === d;
            return (
              <button
                key={d}
                type="button"
                onClick={() => handleSelectDay(d)}
                className={`mdp-quick-btn ${isSelected ? 'is-active' : ''}`}
              >
                {d}{getOrdinalSuffix(d)}
              </button>
            );
          })}
        </div>
      </div>

      {/* 1-Month Common Calendar Day Grid (1 - 31) */}
      <div className="mdp-calendar-card">
        <div className="mdp-calendar-grid">
          {allDays.map((d) => {
            const isSelected = activeDay === d;
            return (
              <button
                key={d}
                type="button"
                onClick={() => handleSelectDay(d)}
                title={`Due on the ${d}${getOrdinalSuffix(d)} of every month`}
                className={`mdp-day-btn ${isSelected ? 'is-active' : ''}`}
              >
                {d}
              </button>
            );
          })}
        </div>
      </div>

      {/* Bottom Notification Banner */}
      {activeDay ? (
        <div className="mdp-banner">
          <Calendar size={16} className="mdp-banner-icon" />
          <div className="mdp-banner-body">
            <div className="mdp-banner-title">
              Due Day: {activeDay}{getOrdinalSuffix(activeDay)} of every month
            </div>
            <div className="mdp-banner-desc">
              Fees are due on day {activeDay} of each month. Late fine calculates automatically from day {activeDay === 31 ? 1 : activeDay + 1} if unpaid.
            </div>
          </div>
        </div>
      ) : (
        <div className="mdp-empty-hint">
          Please select a day (1 - 31) for the monthly recurring fee due date.
        </div>
      )}
    </div>
  );

  // If inline is true, return the calendar view directly without the summary card wrapper
  if (inline) {
    return calendarView;
  }

  // Default: Return the small, sleek compact box with Day, Year, and 'Update' button
  return (
    <div className="mdp-compact-wrapper">
      <div className="mdp-compact-label-row">
        <label className="ui-form-label mdp-compact-label">
          {label} {optionalTag && <span className="fm-optional">({optionalTag})</span>}
          {required && <span className="mdp-req">*</span>}
        </label>
      </div>

      <div className="mdp-compact-box">
        <div className="mdp-compact-left">
          <Calendar size={14} color="#2563eb" style={{ flexShrink: 0 }} />
          <span className="mdp-compact-date">
            {selectedDay ? `${selectedDay}${getOrdinalSuffix(selectedDay)}, ${currentYear}` : 'Not Set'}
          </span>
          {selectedDay ? (
            <span className="mdp-compact-badge">
              Every {selectedDay}{getOrdinalSuffix(selectedDay)}
            </span>
          ) : (
            <span className="mdp-compact-badge is-empty">Not set</span>
          )}
        </div>

        <button
          type="button"
          onClick={handleOpenModal}
          className="mdp-compact-btn"
          title="Click to update due day"
        >
          <Calendar size={12} /> Update
        </button>
      </div>

      {/* Popup Calendar Modal */}
      {isModalOpen && (
        <div className="ui-modal-overlay" style={{ zIndex: 1100 }}>
          <div className="ui-modal fm-dueday-modal">
            <div className="ui-modal-head fm-dueday-modal-head">
              <div>
                <h3 className="fm-modal-title fm-dueday-modal-title">
                  <Calendar size={15} color="#2563eb" /> Update Due Day
                </h3>
                <div className="fm-dueday-modal-sub">
                  Select recurring fee due day for every month
                </div>
              </div>
              <button
                type="button"
                onClick={handleCancelModal}
                className="ui-btn ui-btn-icon"
                style={{ width: '28px', height: '28px', padding: 0 }}
                title="Close"
              >
                <X size={15} />
              </button>
            </div>

            <div className="ui-modal-body fm-dueday-modal-body">
              {calendarView}
            </div>

            <div className="ui-modal-footer fm-dueday-modal-footer">
              <button
                type="button"
                onClick={handleCancelModal}
                className="ui-btn ui-btn-secondary ui-btn-xs"
                style={{ height: '28px', padding: '0 12px', fontSize: '12px' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmModal}
                className="ui-btn ui-btn-primary ui-btn-xs"
                style={{ height: '28px', padding: '0 12px', fontSize: '12px' }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
