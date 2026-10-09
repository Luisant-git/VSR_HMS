import React from 'react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
  onItemsPerPageChange?: (size: number) => void;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage,
  onPageChange
}) => {
  if (totalItems === 0) return null;

  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderTop: '1px solid #e2e8f0', background: '#f8fafc', borderBottomLeftRadius: '12px', borderBottomRightRadius: '12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
        <div style={{ fontSize: '13px', color: '#64748b', fontWeight: 500 }}>
          Showing {startItem} to {endItem} of {totalItems} entries
        </div>
      </div>
      <div style={{ display: 'flex', gap: '4px' }}>
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
          style={{
            padding: '6px 12px',
            borderRadius: '6px',
            border: '1px solid #cbd5e1',
            background: currentPage === 1 ? '#f1f5f9' : 'white',
            color: currentPage === 1 ? '#94a3b8' : '#334155',
            cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
            fontSize: '13px',
            fontWeight: 600
          }}
        >
          Previous
        </button>
        <button
          type="button"
          style={{
            padding: '6px 12px',
            borderRadius: '6px',
            border: '1px solid var(--sidebar-active, #0f172a)',
            background: 'var(--sidebar-active, #0f172a)',
            color: 'white',
            cursor: 'default',
            fontSize: '13px',
            fontWeight: 600
          }}
        >
          {currentPage}
        </button>
        <button
          type="button"
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages || totalPages === 0}
          style={{
            padding: '6px 12px',
            borderRadius: '6px',
            border: '1px solid #cbd5e1',
            background: (currentPage === totalPages || totalPages === 0) ? '#f1f5f9' : 'white',
            color: (currentPage === totalPages || totalPages === 0) ? '#94a3b8' : '#334155',
            cursor: (currentPage === totalPages || totalPages === 0) ? 'not-allowed' : 'pointer',
            fontSize: '13px',
            fontWeight: 600
          }}
        >
          Next
        </button>
      </div>
    </div>
  );
};
