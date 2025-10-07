// src/components/controls/ViewModeControls.js
import React from 'react';
import { useLayers } from '../../contexts/LayersContext';
import { useDisplayOptions } from '../../contexts/DisplayOptionsContext';
import StandardButton from '../ui/StandardButton';
import { StandardFormGroup } from '../ui/StandardForm';

const ViewModeControls = () => {
  const { viewMode, setViewMode, verticalSpacing, setVerticalSpacing } = useLayers();
  const { showConnectors, setShowConnectors } = useDisplayOptions();

  return (
    <div className="mb-5">
      <h4 className="editor-sub-section-title">View Mode</h4>
      <div className="flex gap-2 mb-4">
        <StandardButton
          variant={viewMode === 'normal' ? 'primary' : 'secondary'}
          onClick={() => setViewMode('normal')}
          aria-pressed={viewMode === 'normal'}
          size="small"
        >
          Normal
        </StandardButton>
        <StandardButton
          variant={viewMode === 'exploded' ? 'primary' : 'secondary'}
          onClick={() => setViewMode('exploded')}
          aria-pressed={viewMode === 'exploded'}
          size="small"
        >
          Exploded
        </StandardButton>
      </div>
      
      {viewMode === 'exploded' && (
        <div className="mt-3">
          <StandardFormGroup>
            <label htmlFor="vertical-spacing-slider" className="form-label-new">
              Vertical Spacing: {verticalSpacing.toFixed(1)}
            </label>
            <input
              id="vertical-spacing-slider"
              type="range"
              min="0.1"
              max="2"
              step="0.1"
              value={verticalSpacing}
              onChange={(e) => setVerticalSpacing(parseFloat(e.target.value))}
              className="w-full cursor-pointer"
              aria-label="Vertical spacing slider"
            />
          </StandardFormGroup>
          <StandardFormGroup>
            <label className="checkbox-label flex items-center gap-2">
              <input
                type="checkbox"
                checked={showConnectors}
                onChange={(e) => setShowConnectors(e.target.checked)}
                className="checkbox"
                aria-label="Show layer connectors checkbox"
              />
              <span className="text-sm">Show Layer Connectors</span>
            </label>
          </StandardFormGroup>
        </div>
      )}
    </div>
  );
};

export default ViewModeControls;