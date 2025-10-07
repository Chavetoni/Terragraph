// src/components/ui/CollapsibleSection.js
import React from 'react';

const CollapsibleSection = ({ title, sectionKey, children, isOpen, onToggle }) => (
  <div style={{ marginBottom: '1px' }}>
    <div
      className="collapsible-section-header"
      onClick={() => onToggle(sectionKey)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onToggle(sectionKey);
      }}
      aria-expanded={isOpen}
      aria-controls={`section-content-${sectionKey}`}
    >
      {title}
      <span className={`arrow-icon ${isOpen ? 'arrow-icon-open' : ''}`}>
        &#9654;
      </span>
    </div>
    <div
      id={`section-content-${sectionKey}`}
      className={`collapsible-section-content ${isOpen ? 'collapsible-section-content-open' : ''}`}
      role="region"
    >
      {/* Always render children to preserve state */}
      {children}
    </div>
  </div>
);

export default CollapsibleSection;