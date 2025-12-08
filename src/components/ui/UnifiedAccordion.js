/**
 * Unified Accordion Component
 * 
 * Professional accordion component with consistent styling across all panels.
 * Supports badges, icons, and proper accessibility features.
 */

import React from 'react';
import './UnifiedAccordion.css';

export function UnifiedAccordion({
  title,
  isOpen,
  onToggle,
  badge,
  badgeType = 'optional',
  children,
  className = ''
}) {
  return (
    <div className={`unified-accordion ${className}`}>
      <button
        className={`accordion-header ${isOpen ? 'expanded' : ''}`}
        onClick={onToggle}
        aria-expanded={isOpen}
      >
        <div className="accordion-header-left">
          <span className="accordion-title">{title}</span>
          {badge && <span className={`accordion-badge ${badgeType}`}>{badge}</span>}
        </div>
        <svg
          className={`accordion-chevron ${isOpen ? 'expanded' : ''}`}
          width="20"
          height="20"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      </button>

      {isOpen && (
        <div className="accordion-content">
          {children}
        </div>
      )}
    </div>
  );
}

export default UnifiedAccordion;