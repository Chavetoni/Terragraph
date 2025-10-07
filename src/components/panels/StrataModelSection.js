// src/components/panels/StrataModelSection.js
import React from 'react';
import CollapsibleSection from '../ui/CollapsibleSection';
import { useLayers } from '../../contexts/LayersContext';
import { StandardInput, StandardFormGroup } from '../ui/StandardForm';

const StrataModelSection = ({ isOpen, onToggle }) => {
  const { strataDimensions, updateStrataDimensions } = useLayers();

  return (
    <CollapsibleSection
      title="Strata Model Settings (Below Ground)"
      sectionKey="strataModel"
      isOpen={isOpen}
      onToggle={onToggle}
    >
      <div className="space-y-4">
        <StandardFormGroup>
          <StandardInput
            id="strata-width-input"
            label="Width (X-axis)"
            type="number"
            step="0.5"
            min="1"
            value={strataDimensions.width}
            onChange={(e) => updateStrataDimensions('width', e.target.value)}
          />
        </StandardFormGroup>
        
        <StandardFormGroup>
          <StandardInput
            id="strata-depth-input"
            label="Depth (Z-axis)"
            type="number"
            step="0.5"
            min="1"
            value={strataDimensions.depth}
            onChange={(e) => updateStrataDimensions('depth', e.target.value)}
          />
        </StandardFormGroup>
      </div>
    </CollapsibleSection>
  );
};

export default StrataModelSection;