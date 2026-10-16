# VSR HMS — Design System

Elegant-minimal UI shared across every page. It lives in
[`src/index.css`](./src/index.css) — the **"Design System"** section holds the
shared tokens and primitives, and the **"Page-specific rules"** section at the
end of the same file holds the few per-page rules. The file is imported once
globally; there are **no separate per-page stylesheets**.

**Rules**

1. Reach for a `ui-*` class before writing a new rule. Never re-declare a `ui-*`
   class.
2. Colour comes from CSS variables (`var(--accent)`, `var(--text-muted)`, …).
   No hardcoded hex in JSX except genuinely dynamic semantic status colours.
3. No inline `style={{…}}` and no `onMouseOver`/`onMouseOut` hover hacks — CSS
   owns presentation and hover.
4. Never change behaviour: same state, handlers, conditions, API calls, routes,
   `data-testid`, `aria-*` and `id` attributes.
5. User-facing dates stay **dd/mm/yyyy** (use `src/utils/date.ts`).

## Tokens

| Token | Purpose |
| --- | --- |
| `--bg`, `--surface`, `--surface-muted`, `--surface-sunken` | Page & card surfaces |
| `--border`, `--border-strong` | Hairlines and input outlines |
| `--text-main`, `--text-heading`, `--text-muted` | Text hierarchy |
| `--accent`, `--accent-hover`, `--accent-soft`, `--accent-border` | Primary blue action colour |
| `--success*`, `--warning*`, `--danger*`, `--info*`, `--purple*` | Semantic status colours (`-soft` background, `-border` outline, `-strong` text) |
| `--radius-sm`, `--radius`, `--radius-lg`, `--radius-pill` | Corner radii |
| `--shadow-sm`, `--shadow`, `--shadow-lg` | Elevation |

Legacy tokens (`--sidebar-active`, `--card-bg`, `--border-color`, …) are still
supported; the new tokens alias to them where they overlap.

## Component classes

### Layout
- `.ui-page` — page shell (padding + background)
- `.ui-card`, `.ui-card-pad`, `.ui-card-header`, `.ui-card-title`
- `.ui-section` — vertical stack of cards

### Stats
- `.ui-stat-grid` — responsive grid of stat cards
- `.ui-stat`, `.ui-stat-icon` (+ `.is-accent|is-info|is-success|is-warning|is-danger|is-purple|is-neutral`), `.ui-stat-label`, `.ui-stat-value` (+ `.is-success|is-danger|is-warning|is-accent`), `.ui-stat-sub`

### Toolbar / filters
- `.ui-toolbar`, `.ui-toolbar-group`, `.ui-toolbar-label` (+ `.is-strong`), `.ui-toolbar-divider`, `.ui-toolbar-spacer`
- `.ui-input` / `.ui-select` (+ `.ui-input-sm` / `.ui-select-sm`)
- `.ui-search` — icon + input wrapper (icon is absolutely positioned)

### Buttons
- `.ui-btn` base + `.ui-btn-primary`, `.ui-btn-dark`, `.ui-btn-secondary`, `.ui-btn-danger`, `.ui-btn-ghost`
- `.ui-btn-icon` — compact square icon button (+ `.is-info`, `.ui-btn-danger`)

### Badges / pills
- `.ui-badge` base + `.ui-badge-success|danger|warning|info|accent|purple|neutral`
- `.ui-pill` — uppercase compact label
- `.ui-code`, `.ui-code-box` — identifiers

### Tables
- `.ui-table-wrap` — scroll container + card chrome
- `.ui-table` — header/row styling, hover, `.is-right` cell alignment
- `.ui-cell-title`, `.ui-cell-sub` — two-line table cells

### Pagination & empty states
- `.ui-pagination`, `.ui-page-info`, `.ui-page-controls`, `.ui-page-btn` (+ `.is-current`)
- `.ui-empty`, `.ui-empty-title`, `.ui-empty-text`

### Tabs
- `.ui-tabs`, `.ui-tab` (+ `.active`)

### Modals
- `.ui-modal-overlay`, `.ui-modal` (+ `.is-sm`, `.is-md`)
- `.ui-modal-header` (+ `.is-accent`), `.ui-modal-title`, `.ui-modal-subtitle`, `.ui-modal-close`
- `.ui-modal-body`, `.ui-modal-footer`

### Forms & detail blocks
- `.ui-form-group`, `.ui-form-label`, `.ui-form-row`, `.ui-form-control` (+ `.is-code`, `.is-strong`), `.ui-mt-sm`
- `.ui-detail-grid`, `.ui-detail-label`, `.ui-detail-value` (+ `.is-accent|is-muted|is-lg`)
- `.ui-profile`, `.ui-avatar`
- `.ui-note` (+ `.is-success`, `.is-info`)
