/**
 * Material Texture Controls Component
 * 
 * Provides individual controls for each geological material's texture settings
 * including pattern selection, intensity, and scale adjustments.
 */

import React from 'react';
import { StandardSelect, StandardFormGroup } from './StandardForm';
import { STANDARD_MATERIALS, getMaterialProperties } from '../../utils/materialStandardization';

/**
 * Individual material texture control component
 */
function MaterialTextureControl({ material, config, onChange }) {
  const getPatternOptions = (materialType) => {
    const baseOptions = [
      { value: 'none', label: 'Solid Color' },
      
      // USCS Gravel Patterns
      { value: 'gravel_circles', label: 'Gravel Circles (GW/GP)' },
      { value: 'gravel_silt', label: 'Gravel with Silt (GM)' },
      { value: 'gravel_clay', label: 'Gravel with Clay (GC)' },
      
      // USCS Sand Patterns
      { value: 'sand_dots', label: 'Sand Dots (SW/SP)' },
      { value: 'sand_silt', label: 'Sand with Silt (SM)' },
      { value: 'sand_clay', label: 'Sand with Clay (SC)' },
      
      // USCS Fine-Grained Patterns
      { value: 'horizontal_lines', label: 'Horizontal Lines (ML)' },
      { value: 'horizontal_dashed', label: 'Dashed Lines (CL)' },
      { value: 'horizontal_lines_organic', label: 'Organic Silt (OL)' },
      { value: 'diagonal_lines', label: 'Diagonal Lines (MH)' },
      { value: 'diagonal_crosshatch', label: 'Crosshatch (CH)' },
      { value: 'diagonal_lines_organic', label: 'Organic Clay (OH)' },
      
      // Specialized Patterns
      { value: 'organic_irregular', label: 'Organic Irregular (PT)' },
      { value: 'rock_pattern', label: 'Rock Pattern' },
      { value: 'fill_pattern', label: 'Fill Pattern' },
      { value: 'topsoil_organic', label: 'Topsoil Organic' },
      
      // Legacy patterns (for compatibility)
      { value: 'horizontal-lines', label: 'Basic Horizontal Lines' },
      { value: 'dots', label: 'Basic Dots' },
      { value: 'circles', label: 'Basic Circles' },
      { value: 'cross-hatch', label: 'Basic Cross Hatch' },
      { value: 'diagonal-lines', label: 'Basic Diagonal Lines' }
    ];

    // Get recommended pattern for this material
    const materialProps = getMaterialProperties(materialType);
    const recommendedPattern = materialProps.pattern;

    return baseOptions.map(option => ({
      ...option,
      label: option.value === recommendedPattern ? 
        `${option.label} (Recommended)` : option.label
    }));
  };

  const formatMaterialName = (material) => {
    return material.charAt(0) + material.slice(1).toLowerCase();
  };

  const formatValue = (value, type) => {
    switch (type) {
      case 'intensity':
        return `${Math.round(value * 100)}%`;
      case 'scale':
        return `${value.toFixed(1)}x`;
      default:
        return value;
    }
  };

  return (
    <div className="border border-gray-200 rounded-md p-3 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{formatMaterialName(material)}</span>
        <label className="flex items-center">
          <input
            type="checkbox"
            checked={config.enabled}
            onChange={(e) => onChange({ ...config, enabled: e.target.checked })}
            className="checkbox"
          />
        </label>
      </div>

      {config.enabled && (
        <div className="space-y-3">
          <StandardFormGroup>
            <label className="form-label-new text-xs">
              Pattern: <span className="font-normal">{config.pattern || 'horizontal-lines'}</span>
            </label>
            <StandardSelect
              value={config.pattern || 'horizontal-lines'}
              onChange={(e) => onChange({ ...config, pattern: e.target.value })}
              options={getPatternOptions(material)}
            />
          </StandardFormGroup>

          <StandardFormGroup>
            <label className="form-label-new text-xs">
              Intensity: <span className="font-normal">{formatValue(config.intensity || 0.7, 'intensity')}</span>
            </label>
            <input
              type="range"
              min="0.1"
              max="1.0"
              step="0.1"
              value={config.intensity || 0.7}
              onChange={(e) => onChange({ ...config, intensity: parseFloat(e.target.value) })}
              className="w-full cursor-pointer"
            />
          </StandardFormGroup>

          <StandardFormGroup>
            <label className="form-label-new text-xs">
              Scale: <span className="font-normal">{formatValue(config.scale || 1.0, 'scale')}</span>
            </label>
            <input
              type="range"
              min="0.5"
              max="2.0"
              step="0.1"
              value={config.scale || 1.0}
              onChange={(e) => onChange({ ...config, scale: parseFloat(e.target.value) })}
              className="w-full cursor-pointer"
            />
          </StandardFormGroup>
        </div>
      )}
    </div>
  );
}

/**
 * Main material texture controls component
 */
function MaterialTextureControls({ materials, settings, onChange, title = "Material-Specific Settings" }) {
  return (
    <StandardFormGroup>
      <h5 className="form-label-new text-base font-semibold mb-3">{title}</h5>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {materials.map(material => (
          <MaterialTextureControl
            key={material}
            material={material}
            config={settings[material] || {
              pattern: 'horizontal-lines',
              intensity: 0.7,
              scale: 1.0,
              enabled: true
            }}
            onChange={(newConfig) => onChange(material, newConfig)}
          />
        ))}
      </div>
    </StandardFormGroup>
  );
}

export default MaterialTextureControls;