/**
 * Unified Panel Section Component
 *
 * Professional accordion component with consistent styling, smooth animations,
 * and proper state management. Replaces both CollapsibleSection and UnifiedAccordion.
 *
 * Features:
 * - Smooth height animations with CSS transitions
 * - Badge support with multiple variants
 * - Icon support in header
 * - Preserves children state when collapsed
 * - Full accessibility support (ARIA, keyboard nav)
 * - Glass morphism styling
 */

import { useRef, useEffect, useState } from 'react';
import './PanelSection.css';

export const BADGE_VARIANTS = {
  required: 'required',
  optional: 'optional',
  advanced: 'advanced',
  professional: 'professional',
  visual: 'visual',
  success: 'success',
  warning: 'warning',
  error: 'error',
  info: 'info'
};

// Maximum height for content measurement
// Set high to allow full expansion - CSS can still constrain if needed
const DEFAULT_MAX_CONTENT_HEIGHT = 2000;

export function PanelSection({
  title,
  isOpen,
  onToggle,
  badge,
  badgeVariant = BADGE_VARIANTS.optional,
  icon,
  children,
  className = '',
  defaultOpen = false,
  collapsible = true,
  headerActions,
  subtitle,
  maxContentHeight = DEFAULT_MAX_CONTENT_HEIGHT
}) {
  const contentRef = useRef(null);
  const [contentHeight, setContentHeight] = useState(0);
  const [isControlled] = useState(isOpen !== undefined);

  // Internal state for uncontrolled mode
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const open = isControlled ? isOpen : internalOpen;

  // Measure content height for smooth animations
  // Cap at maxContentHeight to enable scrolling for tall content
  useEffect(() => {
    if (contentRef.current) {
      const resizeObserver = new ResizeObserver((entries) => {
        for (let entry of entries) {
          // Cap the height at maxContentHeight for scrollable behavior
          const measuredHeight = entry.contentRect.height;
          setContentHeight(Math.min(measuredHeight, maxContentHeight));
        }
      });

      resizeObserver.observe(contentRef.current);

      return () => {
        resizeObserver.disconnect();
      };
    }
  }, [children, maxContentHeight]);

  const handleToggle = () => {
    if (!collapsible) return;

    if (isControlled) {
      onToggle?.();
    } else {
      setInternalOpen(!internalOpen);
      onToggle?.(!internalOpen);
    }
  };

  const handleKeyDown = (e) => {
    if (!collapsible) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleToggle();
    }
  };

  return (
    <div className={`panel-section ${className} ${open ? 'panel-section--open' : ''}`}>
      <button
        className={`panel-section__header ${open ? 'panel-section__header--expanded' : ''} ${!collapsible ? 'panel-section__header--static' : ''}`}
        onClick={handleToggle}
        onKeyDown={handleKeyDown}
        disabled={!collapsible}
        aria-expanded={open}
        aria-controls={`panel-content-${title.replace(/\s+/g, '-').toLowerCase()}`}
        type="button"
      >
        <div className="panel-section__header-left">
          {icon && <span className="panel-section__icon">{icon}</span>}
          <div className="panel-section__title-group">
            <span className="panel-section__title">{title}</span>
            {subtitle && <span className="panel-section__subtitle">{subtitle}</span>}
          </div>
          {badge && (
            <span className={`panel-section__badge panel-section__badge--${badgeVariant}`}>
              {badge}
            </span>
          )}
        </div>

        <div className="panel-section__header-right">
          {headerActions && <div className="panel-section__header-actions">{headerActions}</div>}
          {collapsible && (
            <svg
              className={`panel-section__chevron ${open ? 'panel-section__chevron--expanded' : ''}`}
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          )}
        </div>
      </button>

      <div
        className={`panel-section__content-wrapper ${open ? 'panel-section__content-wrapper--open' : ''}`}
        style={{
          maxHeight: open ? `${contentHeight}px` : '0px'
        }}
        id={`panel-content-${title.replace(/\s+/g, '-').toLowerCase()}`}
        role="region"
        aria-labelledby={title}
      >
        <div
          ref={contentRef}
          className="panel-section__content"
        >
          {children}
        </div>
      </div>
    </div>
  );
}

export default PanelSection;
