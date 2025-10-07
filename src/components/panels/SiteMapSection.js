// src/components/panels/SiteMapSection.js
import React from 'react';
import CollapsibleSection from '../ui/CollapsibleSection';
import MapUploader from '../controls/MapUploader';

const SiteMapSection = ({ isOpen, onToggle }) => {
  return (
    <CollapsibleSection
      title="Site Map (on Ground)"
      sectionKey="siteMap"
      isOpen={isOpen}
      onToggle={onToggle}
    >
      <MapUploader />
    </CollapsibleSection>
  );
};

export default SiteMapSection;