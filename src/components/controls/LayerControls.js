// src/components/controls/LayerControls.js
import React from 'react';
import { useLayers } from '../../contexts/LayersContext';
import { StandardInput, StandardTextarea, StandardFormGroup } from '../ui/StandardForm';

const LayerControls = ({ layer, index, isActive }) => {
  const { updateLayer } = useLayers();

  const handlePropertyChange = (property, value) => {
    updateLayer(index, property, value);
  };

  return (
    <div className="space-y-4">
      <StandardFormGroup>
        <StandardInput
          id={`layer-name-input-${index}`}
          label="Layer Name"
          type="text"
          value={layer.name || ''}
          onChange={(e) => handlePropertyChange('name', e.target.value)}
        />
      </StandardFormGroup>
      
      <StandardFormGroup>
        <label className="form-label-new">Layer Color</label>
        <div className="flex items-center gap-3">
          <input
            aria-label="Layer color picker"
            type="color"
            value={layer.color || '#ffffff'}
            onChange={(e) => handlePropertyChange('color', e.target.value)}
            className="w-12 h-12 border border-gray-300 rounded-md cursor-pointer"
          />
          <StandardInput
            aria-label="Layer color hex input"
            type="text"
            value={layer.color || ''}
            onChange={(e) => handlePropertyChange('color', e.target.value)}
            placeholder="#rrggbb"
            className="flex-1"
          />
        </div>
      </StandardFormGroup>
      
      <StandardFormGroup>
        <StandardTextarea
          id={`layer-desc-${index}`}
          label="Description"
          value={layer.description || ''}
          onChange={(e) => handlePropertyChange('description', e.target.value)}
          rows={3}
        />
      </StandardFormGroup>
      
      <StandardFormGroup>
        <StandardInput
          id={`layer-depth-${index}`}
          label="Depth (feet)"
          type="number"
          min="0.1"
          step="0.1"
          value={layer.depth || 1}
          onChange={(e) => handlePropertyChange('depth', e.target.value)}
        />
      </StandardFormGroup>
    </div>
  );
};

export default LayerControls;