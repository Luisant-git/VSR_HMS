import { RefreshCw } from 'lucide-react';

/**
 * The app-wide loading indicator: a spinning RefreshCw icon next to a label.
 * Keep every page's loading state on these three parts so they all look alike.
 */

interface LoadingSpinnerProps {
  /** Label shown beside the spinner. Defaults to "Loading..." */
  text?: string;
  /** Icon size in px. Defaults to 18. */
  size?: number;
}

/** The indicator itself, for anywhere that needs it inline. */
export const LoadingSpinner = ({ text = 'Loading...', size = 18 }: LoadingSpinnerProps) => (
  <span className="ui-loading">
    <RefreshCw size={size} className="ui-loading-icon" />
    {text}
  </span>
);

interface LoadingRowProps extends LoadingSpinnerProps {
  /** Number of table columns to span. */
  colSpan: number;
}

/** Loading state as a table row — drop it straight into a <tbody>. */
export const LoadingRow = ({ colSpan, text, size }: LoadingRowProps) => (
  <tr>
    <td colSpan={colSpan} className="ui-table-state">
      <LoadingSpinner text={text} size={size} />
    </td>
  </tr>
);

interface LoadingBlockProps extends LoadingSpinnerProps {
  /** Vertical padding around the indicator. Defaults to '40px'. */
  padding?: string;
}

/** Loading state for full-page, card or panel areas. */
export const LoadingBlock = ({ text, size, padding = '40px' }: LoadingBlockProps) => (
  <div className="ui-loading-block" style={{ padding }}>
    <LoadingSpinner text={text} size={size} />
  </div>
);

export default LoadingSpinner;
