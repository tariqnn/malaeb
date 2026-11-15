# Component notes

- **Primary action**: semantic button, dark club-green fill, white label, 44px minimum touch target on mobile, focus-visible ring, disabled/loading states in production.
- **Secondary action**: white surface, visible border and clear verb label; never icon-only for important actions.
- **Navigation item**: text and icon; active state uses tint plus weight and background, not color alone. Mobile becomes a dismissible side sheet.
- **Season chip**: season name and status dot plus text. Production adds an explicit season switcher with keyboard and touch support.
- **Metric card**: label, value, context/trend. Status changes include a word, not just color.
- **Data table**: labeled columns, search, filter and pagination; mobile allows horizontal table scrolling only inside the table region so the page itself does not overflow.
- **Status pill**: explicit status text and decorative dot; pending, active and overdue states have distinct text and tint.
- **Modal form**: dialog title, close/cancel escape route, persistent field labels, required markers, inline validation, async pending state and success confirmation.
- **Toast**: short action result with live announcement; high-value records still need a durable saved state and receipt/audit link.
- **Calendar event**: event type label and team/facility text; event identity is not conveyed by color alone.
- **Arabic/RTL**: document `lang` and `dir` update together; check forms, mixed Latin phone numbers, tables, date controls and reading order with Arabic-speaking users.

Prototype gaps: focus trap and focus restore, robust screen-reader announcements, true loading/errors, mobile table row-card alternative, and native Arabic date/number conventions need implementation before release.
