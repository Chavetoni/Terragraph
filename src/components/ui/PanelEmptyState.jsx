/**
 * Panel Empty State Component
 *
 * Professional empty state UI for data-driven panels.
 * Includes illustration, message, and optional call-to-action.
 */

import React from 'react';
import './PanelEmptyState.css';

// Default SVG icons for different empty states
const EmptyIcons = {
  default: (
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
      <circle cx="32" cy="32" r="30" stroke="currentColor" strokeWidth="2" opacity="0.2" />
      <path
        d="M32 20v24M20 32h24"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.3"
      />
    </svg>
  ),
  layers: (
    <svg width="64" height="64" viewBox="0 0 64 64" fill="currentColor" opacity="0.25">
      <path d="M12 20h40v4H12zm0 10h40v4H12zm0 10h40v4H12zm0 10h40v4H12z" />
    </svg>
  ),
  boreholes: (
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
      <circle cx="32" cy="16" r="4" stroke="currentColor" strokeWidth="2" opacity="0.3" />
      <rect x="30" y="20" width="4" height="28" fill="currentColor" opacity="0.2" />
      <circle cx="32" cy="52" r="6" stroke="currentColor" strokeWidth="2" opacity="0.3" />
    </svg>
  ),
  map: (
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
      <path
        d="M8 16l16-8 16 8 16-8v40l-16 8-16-8-16 8V16z"
        stroke="currentColor"
        strokeWidth="2"
        opacity="0.25"
      />
      <path d="M24 8v40M40 16v40" stroke="currentColor" strokeWidth="2" opacity="0.2" />
    </svg>
  ),
  export: (
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
      <path
        d="M32 40V16m0 0l-8 8m8-8l8 8"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.3"
      />
      <path
        d="M48 40v8a4 4 0 01-4 4H20a4 4 0 01-4-4v-8"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.25"
      />
    </svg>
  ),
  search: (
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
      <circle cx="28" cy="28" r="12" stroke="currentColor" strokeWidth="2" opacity="0.3" />
      <path
        d="M37 37l10 10"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.3"
      />
    </svg>
  )
};

export function PanelEmptyState({
  icon = 'default',
  customIcon,
  title = 'No data available',
  description,
  action,
  actionLabel,
  onAction,
  variant = 'default',
  className = ''
}) {
  const iconElement = customIcon || EmptyIcons[icon] || EmptyIcons.default;

  return (
    <div className={`panel-empty-state panel-empty-state--${variant} ${className}`}>
      <div className="panel-empty-state__icon">{iconElement}</div>

      <div className="panel-empty-state__content">
        <h3 className="panel-empty-state__title">{title}</h3>
        {description && <p className="panel-empty-state__description">{description}</p>}
      </div>

      {(action || actionLabel) && (
        <div className="panel-empty-state__actions">
          {action || (
            <button className="panel-empty-state__button" onClick={onAction}>
              {actionLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default PanelEmptyState;
