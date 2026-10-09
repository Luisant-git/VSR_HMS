import React from 'react';
import Select from 'react-select';

export interface SelectOption {
  value: string;
  label: string;
  sublabel?: string;
}

interface SearchableSelectProps {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  style?: React.CSSProperties;
  width?: string;
  isClearable?: boolean;
}

export const SearchableSelect: React.FC<SearchableSelectProps> = ({
  options,
  value,
  onChange,
  placeholder = '-- Select --',
  disabled = false,
  width = '100%',
  isClearable = true,
}) => {
  const selectedOption = options.find((o) => o.value === value) || (value ? { value, label: value } : null);

  const customStyles = {
    control: (base: any, state: any) => ({
      ...base,
      minHeight: '38px',
      borderRadius: '8px',
      borderColor: state.isFocused ? '#3B82F6' : '#CBD5E1',
      borderWidth: state.isFocused ? '2px' : '1px',
      boxShadow: state.isFocused ? '0 0 0 3px rgba(59, 130, 246, 0.2)' : 'none',
      '&:hover': { borderColor: '#3B82F6' },
      fontSize: '13px',
      background: disabled ? '#F1F5F9' : 'white',
      cursor: disabled ? 'not-allowed' : 'pointer',
      width: width,
    }),
    option: (base: any, state: any) => ({
      ...base,
      fontSize: '13px',
      padding: '8px 12px',
      backgroundColor: state.isSelected
        ? '#3B82F6'
        : state.isFocused
        ? '#EFF6FF'
        : 'white',
      color: state.isSelected ? 'white' : '#1E293B',
      fontWeight: state.isSelected ? 700 : 400,
      cursor: 'pointer',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
    }),
    menu: (base: any) => ({
      ...base,
      borderRadius: '8px',
      boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
      zIndex: 9999,
      overflow: 'hidden',
    }),
    menuPortal: (base: any) => ({ ...base, zIndex: 9999 }),
    singleValue: (base: any) => ({
      ...base,
      fontSize: '13px',
      fontWeight: 600,
      color: '#0F172A',
    }),
    placeholder: (base: any) => ({
      ...base,
      fontSize: '13px',
      color: '#94A3B8',
    }),
    indicatorSeparator: (base: any) => ({
      ...base,
      backgroundColor: '#CBD5E1',
      marginTop: '6px',
      marginBottom: '6px',
    }),
    dropdownIndicator: (base: any, state: any) => ({
      ...base,
      color: '#64748B',
      padding: '6px 8px',
      '&:hover': { color: '#3B82F6' },
      transform: state.selectProps.menuIsOpen ? 'rotate(180deg)' : 'none',
      transition: 'transform 0.15s ease',
    }),
  };

  const formatOptionLabel = (option: SelectOption) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
      <span>{option.label}</span>
      {option.sublabel && (
        <span style={{ fontSize: '11px', opacity: 0.85, marginLeft: '8px', fontWeight: 500 }}>
          {option.sublabel}
        </span>
      )}
    </div>
  );

  return (
    <Select
      options={options}
      value={selectedOption}
      onChange={(opt: any) => onChange(opt ? opt.value : '')}
      placeholder={placeholder}
      isDisabled={disabled}
      styles={customStyles}
      formatOptionLabel={formatOptionLabel}
      isClearable={isClearable}
      isSearchable={true}
      menuPortalTarget={document.body}
      menuPosition="fixed"
    />
  );
};
