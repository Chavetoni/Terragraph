// src/components/panels/DisplayOptionsSection.js
import React from 'react';
import CollapsibleSection from '../ui/CollapsibleSection';
import DisplayOptions from '../controls/DisplayOptions';

const DisplayOptionsSection = ({ isOpen, onToggle }) => {
  return (
    <CollapsibleSection
      title="Display Options"
      sectionKey="displayOptions"
      isOpen={isOpen}
      onToggle={onToggle}
    >
      <DisplayOptions />
    </CollapsibleSection>
  );
};

export default DisplayOptionsSection;