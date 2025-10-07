// src/components/panels/BoreholeSection.js
import React from 'react';
import CollapsibleSection from '../ui/CollapsibleSection';
import BoreholeControls from '../controls/BoreholeControls';

const BoreholeSection = ({ isOpen, onToggle }) => {
  return (
    <CollapsibleSection
      title="Borehole Markers"
      sectionKey="boreholes"
      isOpen={isOpen}
      onToggle={onToggle}
    >
      <BoreholeControls />
    </CollapsibleSection>
  );
};

export default BoreholeSection;