/**
 * Volumetric Model Settings Component
 * 
 * Provides UI controls for volumetric geological model settings
 * including grid resolution, interpolation parameters, and visual options.
 */

import React, { useState } from 'react';
import { useGeologicalModeling } from '../../contexts/OptimizedGeologicalModelingContext';
import { useDisplayOptions } from '../../contexts/DisplayOptionsContext';
import UnifiedAccordion from '../ui/UnifiedAccordion';
import StrataAlignmentControls from '../controls/StrataAlignmentControls';

export function VolumetricSettings() {
  const { modelingSettings, updateSettings, INTERPOLATION_METHODS } = useGeologicalModeling();
  const { textureSettings, updateTextureSettings } = useDisplayOptions();
  const [expandedSections, setExpandedSections] = useState({
    basic: true,
    interpolation: false,
    advanced: false,
    textures: false,
    isolatedMaterials: false
  });

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const handleGridResolutionChange = (event) => {
    const value = parseInt(event.target.value, 10);
    updateSettings({ gridResolution: value });
  };

  const handleOpacityChange = (event) => {
    const value = parseFloat(event.target.value);
    updateSettings({ layerOpacity: value });
  };

  const handleWireframeToggle = (event) => {
    updateSettings({ showWireframe: event.target.checked });
  };

  const handleInterpolationMethodChange = (event) => {
    updateSettings({ interpolationMethod: event.target.value });
  };

  const handleKrigingVariogramModelChange = (event) => {
    updateSettings({ krigingVariogramModel: event.target.value });
  };

  // Texture control handlers
  const handleTexturesToggle = (event) => {
    updateTextureSettings({ enabled: event.target.checked });
  };

  const handleGlobalIntensity = (event) => {
    updateTextureSettings({ globalIntensity: parseFloat(event.target.value) });
  };

  const handlePatternScale = (event) => {
    updateTextureSettings({ patternScale: parseFloat(event.target.value) });
  };

  const handleBlendToggle = (event) => {
    updateTextureSettings({ blendWithColor: event.target.checked });
  };

  const handleAdaptiveToggle = (event) => {
    updateTextureSettings({ adaptToZoom: event.target.checked });
  };

  // Isolated material handlers
  const handleIsolatedMaterialHandling = (event) => {
    updateSettings({ isolatedMaterialHandling: event.target.value });
  };

  const handlePocketRadius = (event) => {
    updateSettings({ pocketRadius: parseFloat(event.target.value) });
  };

  const handlePocketOpacity = (event) => {
    updateSettings({ pocketOpacity: parseFloat(event.target.value) });
  };

  const handlePocketDepthRatio = (event) => {
    updateSettings({ pocketDepthRatio: parseFloat(event.target.value) });
  };


  const getInterpolationMethodName = (method) => {
    const names = {
      [INTERPOLATION_METHODS.IDW]: 'IDW (Recommended)',
      [INTERPOLATION_METHODS.KRIGING]: 'Kriging (Statistical)'
    };
    return names[method] || method;
  };

  const getInterpolationDescription = (method) => {
    const descriptions = {
      [INTERPOLATION_METHODS.IDW]: 'Most realistic for typical sites - preserves geological detail without over-smoothing. Works best with adequate borehole coverage.',
      [INTERPOLATION_METHODS.KRIGING]: 'Best for sparse data (3-4 boreholes far apart) - provides statistical uncertainty estimates showing where more boreholes are needed.'
    };
    return descriptions[method] || 'Professional interpolation method';
  };

  const getQualityLabel = (resolution) => {
    if (!resolution || typeof resolution !== 'number') return 'Standard';
    if (resolution <= 15) return 'Standard (162 triangles)';
    if (resolution <= 25) return 'High Detail (1,152 triangles)';
    if (resolution <= 40) return 'Ultra Detail (3,042 triangles)';
    return 'Professional (7,442 triangles)';
  };

  return (
    <div className="volumetric-settings">
      <div className="settings-header">
        <h4 className="settings-title">
          Volumetric Model Settings
        </h4>
        <div className="settings-subtitle">
          Configure quality, display, and performance options
        </div>
      </div>

      {/* Basic Settings Section - Always Open */}
      <UnifiedAccordion
        title="Basic Settings"
        isOpen={expandedSections.basic}
        onToggle={() => toggleSection('basic')}
        badge="Required"
        badgeType="required"
      >
        <div className="settings-grid">
          <div className="setting-item">
            <label className="setting-label">
              <span className="label-text">Model Quality</span>
              <span className="setting-value">{getQualityLabel(modelingSettings.gridResolution)}</span>
            </label>
            <input
              type="range"
              min="10"
              max="50"
              step="5"
              value={typeof modelingSettings.gridResolution === 'number' ? modelingSettings.gridResolution : 10}
              onChange={handleGridResolutionChange}
              className="setting-slider"
            />
            <div className="setting-help">
              Higher quality increases processing time and model complexity
              {modelingSettings.gridResolution >= 50 && (
                <div className="warning-message">
                  Ultra-high quality: Model will be scaled down for visualization
                </div>
              )}
            </div>
          </div>

          <div className="setting-item">
            <label className="setting-label">
              <span className="label-text">Layer Transparency</span>
              <span className="setting-value">{Math.round((1 - (modelingSettings.layerOpacity || 0.3)) * 100)}%</span>
            </label>
            <input
              type="range"
              min="0.1"
              max="1.0"
              step="0.1"
              value={modelingSettings.layerOpacity || 0.3}
              onChange={handleOpacityChange}
              className="setting-slider"
            />
            <div className="setting-help">
              100% = Solid strata, Lower values reveal internal elevations and contours
            </div>
          </div>

          {/* Strata Alignment Controls */}
          <div className="setting-item-full">
            <StrataAlignmentControls className="mt-4" />
          </div>
        </div>
      </UnifiedAccordion>

      {/* Interpolation Methods Section */}
      <UnifiedAccordion
        title="Interpolation Methods"
        isOpen={expandedSections.interpolation}
        onToggle={() => toggleSection('interpolation')}
        badge="Professional"
        badgeType="professional"
      >
        <div className="settings-grid">
          <div className="setting-item">
            <label className="setting-label">
              <span className="label-text">Interpolation Method</span>
              <span className="setting-value">{getInterpolationMethodName(modelingSettings.interpolationMethod)}</span>
            </label>
            <select
              value={modelingSettings.interpolationMethod || INTERPOLATION_METHODS.IDW}
              onChange={handleInterpolationMethodChange}
              className="setting-select"
            >
              <option value={INTERPOLATION_METHODS.IDW}>
                IDW (Recommended)
              </option>
              <option value={INTERPOLATION_METHODS.KRIGING}>
                Kriging (For Sparse Data)
              </option>
            </select>
            <div className="setting-help">
              {getInterpolationDescription(modelingSettings.interpolationMethod)}
            </div>
          </div>


          {/* Advanced Method Settings */}
          {modelingSettings.interpolationMethod === INTERPOLATION_METHODS.KRIGING && (
            <div className="setting-item">
              <label className="setting-label">
                <span className="label-text">Kriging Variogram Model</span>
                <span className="setting-value">{modelingSettings.krigingVariogramModel}</span>
              </label>
              <select
                value={modelingSettings.krigingVariogramModel || 'spherical'}
                onChange={handleKrigingVariogramModelChange}
                className="setting-select"
              >
                <option value="exponential">Exponential (Recommended)</option>
                <option value="spherical">Spherical</option>
                <option value="gaussian">Gaussian</option>
              </select>
              <div className="setting-help">
                Exponential model provides sharper geological transitions, more realistic for most conditions
              </div>
            </div>
          )}

          {modelingSettings.interpolationMethod === INTERPOLATION_METHODS.KRIGING && (
            <div className="info-message">
              <strong>Kriging Benefits:</strong> Provides statistical confidence intervals showing interpolation reliability and identifies areas where additional boreholes would improve accuracy.
            </div>
          )}
        </div>
      </UnifiedAccordion>

      {/* Advanced Visualization Section */}
      <UnifiedAccordion
        title="Advanced Visualization"
        isOpen={expandedSections.advanced}
        onToggle={() => toggleSection('advanced')}
        badge="Optional"
        badgeType="optional"
      >
        <div className="settings-grid">
          <div className="setting-toggle-group">
            <label className="toggle-label">
              <input
                type="checkbox"
                checked={modelingSettings.showWireframe || false}
                onChange={handleWireframeToggle}
                className="toggle-input"
              />
              <span className="toggle-switch"></span>
              <span className="toggle-text">
                <span className="toggle-title">Internal Structure (Wireframe)</span>
                <span className="toggle-description">Shows wireframe to reveal internal elevation layers</span>
              </span>
            </label>
          </div>


        </div>
      </UnifiedAccordion>

      {/* Soil Texture Enhancement Section */}
      <UnifiedAccordion
        title="Soil Texture Enhancement"
        isOpen={expandedSections.textures}
        onToggle={() => toggleSection('textures')}
        badge="Visual"
        badgeType="visual"
      >
        <div className="settings-grid">
          {/* Global Texture Controls */}
          <div className="texture-global-controls">
            <div className="setting-toggle-group">
              <label className="toggle-label">
                <input
                  type="checkbox"
                  checked={textureSettings.enabled || false}
                  onChange={handleTexturesToggle}
                  className="toggle-input"
                />
                <span className="toggle-switch"></span>
                <span className="toggle-text">
                  <span className="toggle-title">Enable Soil Textures</span>
                  <span className="toggle-description">Show geological material patterns on 3D surfaces</span>
                </span>
              </label>
            </div>

            {textureSettings.enabled && (
              <>
                <div className="setting-item">
                  <label className="setting-label">
                    <span className="label-text">Global Intensity</span>
                    <span className="setting-value">{Math.round((textureSettings.globalIntensity || 0.7) * 100)}%</span>
                  </label>
                  <input
                    type="range"
                    min="0.1"
                    max="1.0"
                    step="0.1"
                    value={textureSettings.globalIntensity || 0.7}
                    onChange={handleGlobalIntensity}
                    className="setting-slider"
                  />
                  <div className="setting-help">
                    Controls overall visibility of texture patterns (10% = subtle, 100% = high contrast)
                  </div>
                </div>

                <div className="setting-item">
                  <label className="setting-label">
                    <span className="label-text">Pattern Scale</span>
                    <span className="setting-value">{(textureSettings.patternScale || 1.0).toFixed(1)}x</span>
                  </label>
                  <input
                    type="range"
                    min="0.5"
                    max="2.5"
                    step="0.1"
                    value={textureSettings.patternScale || 1.0}
                    onChange={handlePatternScale}
                    className="setting-slider"
                  />
                  <div className="setting-help">
                    Adjusts size of texture patterns (0.5x = fine detail, 2.5x = coarse patterns)
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Simplified: Global controls only - affects all materials uniformly */}
          {textureSettings.enabled && (
            <div className="simplified-texture-info">
              <div className="info-message">
                <strong>Simplified Textures:</strong> These settings apply to all geological materials uniformly for quick and easy editing.
              </div>
            </div>
          )}

          {/* Advanced Options */}
          {textureSettings.enabled && (
            <div className="texture-advanced-controls">
              <h5 className="controls-title">Advanced Options</h5>
              
              <div className="setting-toggle-group">
                <label className="toggle-label">
                  <input
                    type="checkbox"
                    checked={textureSettings.blendWithColor || true}
                    onChange={handleBlendToggle}
                    className="toggle-input"
                  />
                  <span className="toggle-switch"></span>
                  <span className="toggle-text">
                    <span className="toggle-title">Blend with Material Colors</span>
                    <span className="toggle-description">Mix texture patterns with base geological material colors</span>
                  </span>
                </label>
              </div>

              <div className="setting-toggle-group">
                <label className="toggle-label">
                  <input
                    type="checkbox"
                    checked={textureSettings.adaptToZoom || false}
                    onChange={handleAdaptiveToggle}
                    className="toggle-input"
                  />
                  <span className="toggle-switch"></span>
                  <span className="toggle-text">
                    <span className="toggle-title">Adaptive Zoom Scaling</span>
                    <span className="toggle-description">Automatically adjust pattern size based on camera distance</span>
                  </span>
                </label>
              </div>

            </div>
          )}
        </div>
      </UnifiedAccordion>

      {/* Isolated Material Handling Section */}
      <UnifiedAccordion
        title="Isolated Material Handling"
        isOpen={expandedSections.isolatedMaterials}
        onToggle={() => toggleSection('isolatedMaterials')}
        badge="Advanced"
        badgeType="advanced"
      >
        <div className="settings-grid">
          <div className="setting-item">
            <label className="setting-label">
              <span className="label-text">Isolated Material Handling</span>
              <span className="setting-value">{modelingSettings.isolatedMaterialHandling || 'interpolate'}</span>
            </label>
            <select
              value={modelingSettings.isolatedMaterialHandling || 'interpolate'}
              onChange={handleIsolatedMaterialHandling}
              className="setting-select"
            >
              <option value="interpolate">Full Interpolation</option>
              <option value="pockets">Show as Pockets</option>
              <option value="ignore">Hide</option>
            </select>
            <div className="setting-help">
              Materials appearing in less than 50% of boreholes are considered isolated
            </div>
          </div>

          {modelingSettings.isolatedMaterialHandling === 'pockets' && (
            <>
              <div className="setting-item">
                <label className="setting-label">
                  <span className="label-text">Pocket Size</span>
                  <span className="setting-value">{modelingSettings.pocketRadius || 0.8}ft</span>
                </label>
                <input
                  type="range"
                  min="0.4"
                  max="2.0"
                  step="0.1"
                  value={modelingSettings.pocketRadius || 0.8}
                  onChange={handlePocketRadius}
                  className="setting-slider"
                />
                <div className="setting-help">
                  Radius of vertical football-shaped zone around isolated borehole
                </div>
              </div>

              <div className="setting-item">
                <label className="setting-label">
                  <span className="label-text">Pocket Opacity</span>
                  <span className="setting-value">{Math.round((modelingSettings.pocketOpacity || 0.8) * 100)}%</span>
                </label>
                <input
                  type="range"
                  min="0.4"
                  max="1"
                  step="0.1"
                  value={modelingSettings.pocketOpacity || 0.8}
                  onChange={handlePocketOpacity}
                  className="setting-slider"
                />
                <div className="setting-help">
                  Visibility of isolated material zones
                </div>
              </div>

              <div className="setting-item">
                <label className="setting-label">
                  <span className="label-text">Depth Position</span>
                  <span className="setting-value">{Math.round((modelingSettings.pocketDepthRatio || 0.3) * 100)}%</span>
                </label>
                <input
                  type="range"
                  min="0.1"
                  max="0.9"
                  step="0.05"
                  value={modelingSettings.pocketDepthRatio || 0.3}
                  onChange={handlePocketDepthRatio}
                  className="setting-slider"
                />
                <div className="setting-help">
                  Vertical position within borehole depth (0% = surface, 100% = bottom)
                </div>
              </div>

              <div className="setting-item">
                <label className="setting-label">
                  <span className="label-text">Combined Pockets</span>
                  <input
                    type="checkbox"
                    checked={modelingSettings.combinedPockets !== false}
                    onChange={(e) => updateSettings({ combinedPockets: e.target.checked })}
                    className="setting-checkbox"
                  />
                </label>
                <div className="setting-help">
                  {modelingSettings.combinedPockets !== false 
                    ? "One pocket per borehole (cleaner)" 
                    : "Separate pockets per material (detailed)"}
                </div>
              </div>

              <div className="info-message">
                <strong>Isolated Materials:</strong> Materials in fewer than 50% of boreholes are shown as vertical football-shaped zones around each borehole instead of interpolating across the entire site.
              </div>
            </>
          )}

          {modelingSettings.isolatedMaterialHandling === 'interpolate' && (
            <div className="warning-message">
              <strong>Warning:</strong> Full interpolation of sparse materials may create unrealistic geological layers between boreholes.
            </div>
          )}
        </div>
      </UnifiedAccordion>

    </div>
  );
}

export default VolumetricSettings;