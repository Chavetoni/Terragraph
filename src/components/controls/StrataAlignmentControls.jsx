/**
 * Strata Alignment Controls Component
 * Provides manual controls for adjusting 3D strata model positioning, rotation, and scale
 */

import React from 'react';
import { useDisplayOptions } from '../../contexts/DisplayOptionsContext';
import StandardButton from '../ui/StandardButton';
import { StandardInput, StandardFormGroup } from '../ui/StandardForm';

const StrataAlignmentControls = ({ className = '' }) => {
  const {
    alignmentSettings,
    updateAlignmentSettings,
    updateAlignmentPosition,
    updateAlignmentRotation,
    updateAlignmentScale,
    resetAlignmentSettings
  } = useDisplayOptions();

  const handleToggleAlignment = (enabled) => {
    updateAlignmentSettings({ enabled });
  };

  const handlePositionChange = (axis, value) => {
    updateAlignmentPosition({ [axis]: parseFloat(value) });
  };

  const handleRotationChange = (axis, value) => {
    // Convert degrees to radians
    const radians = (parseFloat(value) * Math.PI) / 180;
    updateAlignmentRotation({ [axis]: radians });
  };

  const handleScaleChange = (axis, value) => {
    updateAlignmentScale({ [axis]: parseFloat(value) });
  };

  const handleAutoAlign = () => {
    resetAlignmentSettings();
    updateAlignmentSettings({ autoAlign: true });
  };

  // Convert radians to degrees for display
  const rotationDegrees = {
    x: (alignmentSettings.rotation.x * 180) / Math.PI,
    y: (alignmentSettings.rotation.y * 180) / Math.PI,
    z: (alignmentSettings.rotation.z * 180) / Math.PI
  };

  return (
    <div className={`panel-new ${className}`}>
      <div className="panel-header-new">
        <h3 className="panel-title-new">3D Strata Alignment</h3>
        <div className="flex gap-2">
          <StandardButton
            variant="secondary"
            size="small"
            onClick={handleAutoAlign}
            title="Reset to automatic alignment"
          >
            Auto
          </StandardButton>
          <StandardButton
            variant="secondary"
            size="small"
            onClick={resetAlignmentSettings}
            title="Reset all alignment settings"
          >
            Reset
          </StandardButton>
        </div>
      </div>

      <div className="panel-content-new">
        <StandardFormGroup>
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={alignmentSettings.enabled}
              onChange={(e) => handleToggleAlignment(e.target.checked)}
              className="checkbox"
            />
            <span className="form-label-new">
              Enable Manual Alignment
            </span>
          </label>
        </StandardFormGroup>

        {alignmentSettings.enabled && (
          <div className="space-y-6">
            {/* Position Controls */}
            <StandardFormGroup>
              <h4 className="form-label-new text-base font-semibold mb-3">Position (feet)</h4>
              <div className="grid grid-cols-3 gap-3">
                {['x', 'y', 'z'].map((axis) => (
                  <StandardInput
                    key={axis}
                    label={`${axis.toUpperCase()} ${axis === 'x' ? '' : axis === 'y' ? '' : ''}`}
                    type="number"
                    value={alignmentSettings.position[axis].toFixed(2)}
                    onChange={(e) => handlePositionChange(axis, e.target.value)}
                    step="0.5"
                    className="text-sm"
                  />
                ))}
              </div>
            </StandardFormGroup>

            {/* Rotation Controls */}
            <StandardFormGroup>
              <h4 className="form-label-new text-base font-semibold mb-3">Rotation (degrees)</h4>
              <div className="grid grid-cols-3 gap-3">
                {['x', 'y', 'z'].map((axis) => (
                  <StandardInput
                    key={axis}
                    label={`${axis.toUpperCase()} ${axis === 'x' ? '' : axis === 'y' ? '' : ''}`}
                    type="number"
                    value={rotationDegrees[axis].toFixed(1)}
                    onChange={(e) => handleRotationChange(axis, e.target.value)}
                    step="5"
                    min="-180"
                    max="180"
                    className="text-sm"
                  />
                ))}
              </div>
            </StandardFormGroup>

            {/* Scale Controls */}
            <StandardFormGroup>
              <h4 className="form-label-new text-base font-semibold mb-3">Scale</h4>
              <div className="grid grid-cols-3 gap-3">
                {['x', 'y', 'z'].map((axis) => (
                  <StandardInput
                    key={axis}
                    label={`${axis.toUpperCase()} ${axis === 'x' ? '' : axis === 'y' ? '' : ''}`}
                    type="number"
                    value={alignmentSettings.scale[axis].toFixed(2)}
                    onChange={(e) => handleScaleChange(axis, e.target.value)}
                    step="0.1"
                    min="0.1"
                    max="5.0"
                    className="text-sm"
                  />
                ))}
              </div>
            </StandardFormGroup>

          </div>
        )}
      </div>
    </div>
  );
};

export default StrataAlignmentControls;