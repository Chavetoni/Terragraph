/**
 * RevitExportExample Component
 *
 * Example component demonstrating how to use the useRevitExport hook
 * for integrating Revit export functionality into UI components.
 *
 * This is a reference implementation showing best practices for:
 * - Export format selection and validation
 * - Progress tracking and user feedback
 * - Error handling and recovery
 * - Settings management
 *
 * @since 1.0.0
 * @author Frontend Developer Agent
 */

import React, { useState } from 'react';
import { useRevitExport } from '../../hooks/useRevitExport.js';

/**
 * Example component showing useRevitExport integration
 */
export function RevitExportExample() {
  const {
    exportToRevit,
    isExporting,
    progress,
    error,
    result,
    cancelExport,
    clearExport,
    availableFormats,
    exportSettings,
    updateSettings,
    canExport,
    exportCapabilities,
    EXPORT_FORMATS
  } = useRevitExport();

  // Local component state for UI controls
  const [selectedFormat, setSelectedFormat] = useState(EXPORT_FORMATS.REVIT_OBJ);
  const [unitSystem, setUnitSystem] = useState('imperial');
  const [includeTextures, setIncludeTextures] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Handle export button click
  const handleExport = async () => {
    try {
      const options = {
        unitSystem,
        includeTextures,
        includeMaterials: true,
        includeMetadata: true,
        generateInstructions: true,
        detailLevel: 'medium'
      };

      const exportResult = await exportToRevit(selectedFormat, options);

      // Handle download or further processing
      if (exportResult?.downloadUrl) {
        // Create download link
        const link = document.createElement('a');
        link.href = exportResult.downloadUrl;
        link.download = `geological_model_${selectedFormat}.zip`;
        link.click();
      }
    } catch (exportError) {
      // Error is automatically handled by the hook and displayed in UI
      // Error details available through the 'error' state from useRevitExport
    }
  };

  // Handle settings update
  const handleSettingsUpdate = (format, newSettings) => {
    updateSettings(format, newSettings);
  };

  // Render export capabilities info
  const renderCapabilities = () => (
    <div className="mb-4 p-3 bg-gray-50 rounded-lg text-sm">
      <h4 className="font-medium mb-2">Export Capabilities:</h4>
      <ul className="space-y-1">
        <li>Boreholes: {exportCapabilities.hasBoreholes ? '✓' : '✗'}</li>
        <li>Geological Model: {exportCapabilities.hasGeologicalModel ? '✓' : '✗'}</li>
        <li>Water Table: {exportCapabilities.hasWaterTable ? '✓' : '✗'}</li>
        <li>Site Map: {exportCapabilities.hasSiteMap ? '✓' : '✗'}</li>
        <li>Materials: {exportCapabilities.materialCount || 0}</li>
        {exportCapabilities.recommendedFormat && (
          <li>Recommended: {exportCapabilities.recommendedFormat.toUpperCase()}</li>
        )}
      </ul>
    </div>
  );

  // Render progress indicator
  const renderProgress = () => {
    if (!isExporting) return null;

    return (
      <div className="mb-4 p-3 bg-blue-50 rounded-lg">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">
            {progress.message || 'Processing...'}
          </span>
          <span className="text-sm text-gray-600">
            {progress.progress}%
          </span>
        </div>
        <div className="w-full bg-blue-200 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${progress.progress}%` }}
          />
        </div>
        {progress.canCancel && (
          <button
            onClick={cancelExport}
            className="mt-2 px-3 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600"
          >
            Cancel Export
          </button>
        )}
      </div>
    );
  };

  // Render results
  const renderResult = () => {
    if (!result) return null;

    return (
      <div className="mb-4 p-3 bg-green-50 rounded-lg">
        <h4 className="font-medium text-green-800 mb-2">Export Complete!</h4>
        <div className="text-sm space-y-1">
          <p>Format: {result.format?.toUpperCase()}</p>
          <p>Files: {result.files?.length || 0}</p>
          <p>Size: {(result.totalSize / 1024 / 1024).toFixed(2)} MB</p>
          {result.revitInstructions && (
            <details className="mt-2">
              <summary className="cursor-pointer font-medium">
                Import Instructions
              </summary>
              <div className="mt-1 pl-4 text-xs">
                <p>{result.revitInstructions.import_method}</p>
              </div>
            </details>
          )}
        </div>
        <button
          onClick={clearExport}
          className="mt-2 px-3 py-1 bg-gray-500 text-white rounded text-sm hover:bg-gray-600"
        >
          Clear Results
        </button>
      </div>
    );
  };

  // Render error message
  const renderError = () => {
    if (!error) return null;

    return (
      <div className="mb-4 p-3 bg-red-50 rounded-lg">
        <h4 className="font-medium text-red-800 mb-2">Export Error</h4>
        <p className="text-sm text-red-700">{error}</p>
        <button
          onClick={clearExport}
          className="mt-2 px-3 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600"
        >
          Clear Error
        </button>
      </div>
    );
  };

  return (
    <div className="max-w-md mx-auto p-4 border rounded-lg bg-white">
      <h3 className="text-lg font-semibold mb-4">Revit Export</h3>

      {renderCapabilities()}
      {renderProgress()}
      {renderError()}
      {renderResult()}

      <div className="space-y-4">
        {/* Format Selection */}
        <div>
          <label className="block text-sm font-medium mb-2">
            Export Format
          </label>
          <select
            value={selectedFormat}
            onChange={(e) => setSelectedFormat(e.target.value)}
            disabled={isExporting}
            className="w-full p-2 border rounded-md"
          >
            {availableFormats.map(format => (
              <option key={format} value={format}>
                {format.toUpperCase()} - {
                  format === EXPORT_FORMATS.REVIT_OBJ
                    ? 'OBJ + MTL (Geometry + Materials)'
                    : 'IFC JSON (BIM Standard)'
                }
              </option>
            ))}
          </select>
        </div>

        {/* Unit System */}
        <div>
          <label className="block text-sm font-medium mb-2">
            Unit System
          </label>
          <div className="flex space-x-4">
            <label className="flex items-center">
              <input
                type="radio"
                value="imperial"
                checked={unitSystem === 'imperial'}
                onChange={(e) => setUnitSystem(e.target.value)}
                disabled={isExporting}
                className="mr-2"
              />
              Imperial (feet)
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                value="metric"
                checked={unitSystem === 'metric'}
                onChange={(e) => setUnitSystem(e.target.value)}
                disabled={isExporting}
                className="mr-2"
              />
              Metric (meters)
            </label>
          </div>
        </div>

        {/* Include Textures */}
        <div>
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={includeTextures}
              onChange={(e) => setIncludeTextures(e.target.checked)}
              disabled={isExporting}
              className="mr-2"
            />
            Include Soil Textures
          </label>
        </div>

        {/* Advanced Settings Toggle */}
        <div>
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            {showAdvanced ? 'Hide' : 'Show'} Advanced Settings
          </button>
        </div>

        {/* Advanced Settings */}
        {showAdvanced && (
          <div className="p-3 bg-gray-50 rounded border">
            <h4 className="font-medium mb-2">Advanced Settings</h4>
            <div className="space-y-2 text-sm">
              <label className="flex items-center">
                <input type="checkbox" className="mr-2" defaultChecked />
                Include Metadata
              </label>
              <label className="flex items-center">
                <input type="checkbox" className="mr-2" defaultChecked />
                Generate Import Instructions
              </label>
              <div>
                <label className="block mb-1">Detail Level:</label>
                <select className="w-full p-1 border rounded text-sm">
                  <option value="low">Low</option>
                  <option value="medium" selected>Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Export Button */}
        <button
          onClick={handleExport}
          disabled={!canExport || isExporting}
          className={`w-full py-2 px-4 rounded-md font-medium ${
            canExport && !isExporting
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
        >
          {isExporting ? 'Exporting...' : 'Export to Revit'}
        </button>

        {!canExport && (
          <p className="text-sm text-gray-600 text-center">
            {exportCapabilities.hasBoreholes
              ? 'Initializing export system...'
              : 'Add geological data to enable export'}
          </p>
        )}
      </div>
    </div>
  );
}

export default RevitExportExample;