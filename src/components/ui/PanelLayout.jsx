/**
 * Panel Layout Components
 *
 * Reusable layout primitives for consistent spacing and arrangement
 * within panel sections. Uses design system tokens for all spacing.
 */

import React from 'react';
import './PanelLayout.css';

/**
 * PanelStack - Vertical stacking with consistent spacing
 */
export function PanelStack({ children, spacing = 'md', className = '' }) {
  return (
    <div className={`panel-stack panel-stack--spacing-${spacing} ${className}`}>
      {children}
    </div>
  );
}

/**
 * PanelGrid - Responsive grid layout
 */
export function PanelGrid({
  children,
  columns = 2,
  gap = 'md',
  minColumnWidth = '200px',
  className = ''
}) {
  const style = {
    '--panel-grid-columns': columns,
    '--panel-grid-min-width': minColumnWidth
  };

  return (
    <div
      className={`panel-grid panel-grid--gap-${gap} ${className}`}
      style={style}
    >
      {children}
    </div>
  );
}

/**
 * PanelInline - Horizontal inline layout with alignment options
 */
export function PanelInline({
  children,
  align = 'start',
  gap = 'md',
  wrap = false,
  className = ''
}) {
  return (
    <div
      className={`panel-inline panel-inline--align-${align} panel-inline--gap-${gap} ${wrap ? 'panel-inline--wrap' : ''} ${className}`}
    >
      {children}
    </div>
  );
}

/**
 * PanelDivider - Visual separator
 */
export function PanelDivider({ spacing = 'md', text, className = '' }) {
  if (text) {
    return (
      <div className={`panel-divider panel-divider--spacing-${spacing} ${className}`}>
        <div className="panel-divider__line" />
        <span className="panel-divider__text">{text}</span>
        <div className="panel-divider__line" />
      </div>
    );
  }

  return <div className={`panel-divider-line panel-divider-line--spacing-${spacing} ${className}`} />;
}

/**
 * PanelFieldGroup - Form field grouping
 */
export function PanelFieldGroup({ label, hint, required, error, children, className = '' }) {
  return (
    <div className={`panel-field-group ${error ? 'panel-field-group--error' : ''} ${className}`}>
      {label && (
        <label className="panel-field-group__label">
          {label}
          {required && <span className="panel-field-group__required">*</span>}
        </label>
      )}
      {hint && <div className="panel-field-group__hint">{hint}</div>}
      <div className="panel-field-group__control">{children}</div>
      {error && <div className="panel-field-group__error">{error}</div>}
    </div>
  );
}

/**
 * PanelCard - Nested card within a panel
 */
export function PanelCard({ title, children, variant = 'default', className = '' }) {
  return (
    <div className={`panel-card panel-card--${variant} ${className}`}>
      {title && <div className="panel-card__title">{title}</div>}
      <div className="panel-card__content">{children}</div>
    </div>
  );
}

export default {
  Stack: PanelStack,
  Grid: PanelGrid,
  Inline: PanelInline,
  Divider: PanelDivider,
  FieldGroup: PanelFieldGroup,
  Card: PanelCard
};
