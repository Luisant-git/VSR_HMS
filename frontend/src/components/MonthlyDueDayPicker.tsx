import React from 'react';
import { Calendar } from 'lucide-react';

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
}

export const MonthlyDueDayPicker: React.FC<MonthlyDueDayPickerProps> = ({
  value,
  onChange,
  label = 'Due Day (Every Month)',
  optionalTag,
  required = false,
}) => {
  // Extract day number (1 - 31) from date string (e.g. '2026-11-24' or ISO string)
  const selectedDay = React.useMemo(() => {
    if (!value) return null;
    const parts = value.split('T')[0].split('-');
    if (parts.length === 3) {
      const d = parseInt(parts[2], 10);
      return !isNaN(d) && d >= 1 && d <= 31 ? d : null;
    }
    const num = parseInt(value, 10);
    return !isNaN(num) && num >= 1 && num <= 31 ? num : null;
  }, [value]);

  const handleSelectDay = (day: number) => {
    onChange(String(day));
  };

  const commonPresets = [5, 10, 15, 20, 25, 30];
  const allDays = Array.from({ length: 31 }, (_, i) => i + 1);

  return (
    <div className="monthly-day-picker" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <label className="ui-form-label" style={{ margin: 0, fontWeight: 600, color: '#334155' }}>
          {label} {optionalTag && <span className="fm-optional" style={{ fontWeight: 400, color: '#64748b' }}>({optionalTag})</span>}
          {required && <span style={{ color: '#ef4444', marginLeft: '3px' }}>*</span>}
        </label>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 500 }}>Day:</span>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            border: '1px solid #cbd5e1',
            borderRadius: '6px',
            background: '#ffffff',
            padding: '2px 6px',
          }}>
            <input
              type="number"
              min={1}
              max={31}
              value={selectedDay ?? ''}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                if (!isNaN(val) && val >= 1 && val <= 31) {
                  handleSelectDay(val);
                } else if (e.target.value === '') {
                  onChange('');
                }
              }}
              placeholder="1-31"
              style={{
                width: '42px',
                border: 'none',
                outline: 'none',
                fontSize: '13px',
                fontWeight: 700,
                textAlign: 'center',
                color: '#0f172a',
                padding: '2px 0',
              }}
            />
            <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>of month</span>
          </div>
        </div>
      </div>

      {/* Quick Presets */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 500, marginRight: '2px' }}>Quick:</span>
        {commonPresets.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => handleSelectDay(d)}
            style={{
              padding: '2px 8px',
              fontSize: '11.5px',
              fontWeight: selectedDay === d ? 700 : 500,
              borderRadius: '4px',
              border: selectedDay === d ? '1px solid #2563eb' : '1px solid #e2e8f0',
              background: selectedDay === d ? '#eff6ff' : '#ffffff',
              color: selectedDay === d ? '#1d4ed8' : '#475569',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            {d}{getOrdinalSuffix(d)}
          </button>
        ))}
      </div>

      {/* 1-Month Common Calendar Day Grid (1 - 31) */}
      <div style={{
        border: '1px solid #e2e8f0',
        borderRadius: '8px',
        padding: '10px',
        background: '#f8fafc',
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: '5px',
        }}>
          {allDays.map((d) => {
            const isSelected = selectedDay === d;
            return (
              <button
                key={d}
                type="button"
                onClick={() => handleSelectDay(d)}
                title={`Due on the ${d}${getOrdinalSuffix(d)} of every month`}
                style={{
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '6px',
                  border: isSelected ? '1.5px solid #1d4ed8' : '1px solid #e2e8f0',
                  background: isSelected ? '#2563eb' : '#ffffff',
                  color: isSelected ? '#ffffff' : '#1e293b',
                  fontSize: '13px',
                  fontWeight: isSelected ? 700 : 500,
                  cursor: 'pointer',
                  boxShadow: isSelected ? '0 1px 3px rgba(37,99,235,0.35)' : 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                {d}
              </button>
            );
          })}
        </div>
      </div>

      {/* Small neat wording underneath (no specific month name) */}
      {selectedDay ? (
        <div style={{
          padding: '8px 12px',
          background: '#f0fdf4',
          border: '1px solid #bbf7d0',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '12.5px',
          color: '#166534',
        }}>
          <Calendar size={16} color="#16a34a" style={{ flexShrink: 0 }} />
          <div>
            <strong>Due Day: {selectedDay}{getOrdinalSuffix(selectedDay)} of every month</strong>
            <div style={{ fontSize: '11px', color: '#15803d', marginTop: '1px', lineHeight: 1.35 }}>
              Fees are due on day {selectedDay} of each month. Late fine calculates automatically from day {selectedDay === 31 ? 1 : selectedDay + 1} if unpaid.
            </div>
          </div>
        </div>
      ) : (
        <div style={{ fontSize: '12px', color: '#64748b', fontStyle: 'italic', padding: '2px 4px' }}>
          Please select a day (1 - 31) for the monthly recurring fee due date.
        </div>
      )}
    </div>
  );
};
