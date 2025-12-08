// src/components/panels/StrataModelSection.js
import React from 'react';
import CollapsibleSection from '../ui/CollapsibleSection';
import { useLayers } from '../../contexts/LayersContext';
import { StandardInput, StandardFormGroup } from '../ui/StandardForm';
import { handleWholeUnitScroll, handleWholeUnitKeyboard } from '../../utils/numericInputHelpers';

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
            step="any"
            min="1"
            value={strataDimensions.width}
            onChange={(e) => updateStrataDimensions('width', e.target.value)}
            onWheel={(e) => handleWholeUnitScroll(e, (val) => updateStrataDimensions('width', val), { min: 1 })}
            onKeyDown={(e) => handleWholeUnitKeyboard(e, (val) => updateStrataDimensions('width', val), { min: 1 })}
          />
        </StandardFormGroup>

        <StandardFormGroup>
          <StandardInput
            id="strata-depth-input"
            label="Depth (Z-axis)"
            type="number"
            step="any"
            min="1"
            value={strataDimensions.depth}
            onChange={(e) => updateStrataDimensions('depth', e.target.value)}
            onWheel={(e) => handleWholeUnitScroll(e, (val) => updateStrataDimensions('depth', val), { min: 1 })}
            onKeyDown={(e) => handleWholeUnitKeyboard(e, (val) => updateStrataDimensions('depth', val), { min: 1 })}
          />
        </StandardFormGroup>
      </div>
    </CollapsibleSection>
  );
};

export default StrataModelSection;