// src/components/panels/ExportSection.js
import React, { useCallback, useState } from 'react';
import PanelSection from '../ui/PanelSection';
import { DownloadIcon } from '../ui/Icons';
import { useRevitExport } from '../../hooks/useRevitExport';
import './ExportSection.css';

/**
 * ExportSection Component
 *
 * Provides export functionality for the geological model.
 * Connects to the RevitExport system for OBJ/IFC exports.
 */
const ExportSection = ({ isOpen, onToggle }) => {
  const {
    exportToRevit,
    isExporting,
    progress,
    error,
    result,
    canExport,
    clearExport,
    cancelExport,
    exportCapabilities,
    EXPORT_FORMATS
  } = useRevitExport();

  const [showResult, setShowResult] = useState(false);

  /**
   * Handle OBJ export
   */
  const handleExportOBJ = useCallback(async () => {
    try {
      clearExport();
      setShowResult(false);

      const exportResult = await exportToRevit(EXPORT_FORMATS.REVIT_OBJ, {
        unitSystem: 'imperial',
        includeTextures: true,
        includeMaterials: true,
        includeMetadata: true,
        generateInstructions: true,
        detailLevel: 'high'
      });

      if (exportResult) {
        setShowResult(true);
        // Trigger file download if files are available
        if (exportResult.files && exportResult.files.length > 0) {
          downloadExportFiles(exportResult.files);
        }
      }
    } catch (err) {
      console.error('Export failed:', err);
    }
  }, [exportToRevit, clearExport, EXPORT_FORMATS]);

  /**
   * Handle IFC export (framework ready, exporter not yet implemented)
   */
  const handleExportIFC = useCallback(async () => {
    try {
      clearExport();
      setShowResult(false);

      const exportResult = await exportToRevit(EXPORT_FORMATS.REVIT_IFC, {
        unitSystem: 'imperial',
        ifcVersion: '4',
        includeGeologicalProperties: true,
        includeWaterTable: true,
        includeBoreholesAsColumns: true,
        spatialStructure: 'site-building'
      });

      if (exportResult) {
        setShowResult(true);
        if (exportResult.files && exportResult.files.length > 0) {
          downloadExportFiles(exportResult.files);
        }
      }
    } catch (err) {
      console.error('IFC Export failed:', err);
    }
  }, [exportToRevit, clearExport, EXPORT_FORMATS]);

  /**
   * Download export files
   */
  const downloadExportFiles = (files) => {
    files.forEach(file => {
      if (file.blob && file.filename) {
        const url = URL.createObjectURL(file.blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = file.filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } else if (file.url) {
        // Handle URL-based downloads
        const link = document.createElement('a');
        link.href = file.url;
        link.download = file.filename || 'export';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    });
  };

  /**
   * Handle cancel export
   */
  const handleCancel = useCallback(() => {
    cancelExport();
  }, [cancelExport]);

  /**
   * Dismiss result/error message
   */
  const handleDismiss = useCallback(() => {
    setShowResult(false);
    clearExport();
  }, [clearExport]);

  // Determine button disabled states
  const isDisabled = isExporting || !canExport;

  return (
    <PanelSection
      title="Export Scene"
      isOpen={isOpen}
      onToggle={onToggle}
    >
      <div className="export-options">
        {/* Export status indicator */}
        {isExporting && (
          <div className="export-status">
            <div className="export-progress-bar">
              <div
                className="export-progress-fill"
                style={{ width: `${progress.progress || 0}%` }}
              />
            </div>
            <div className="export-progress-text">
              <span>{progress.message || 'Preparing export...'}</span>
              <span className="export-progress-percent">{Math.round(progress.progress || 0)}%</span>
            </div>
            <button
              className="export-cancel-btn"
              onClick={handleCancel}
              type="button"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Error message */}
        {error && !isExporting && (
          <div className="export-message export-error">
            <span className="export-message-icon">⚠️</span>
            <span className="export-message-text">{error}</span>
            <button
              className="export-dismiss-btn"
              onClick={handleDismiss}
              type="button"
            >
              ×
            </button>
          </div>
        )}

        {/* Success message */}
        {showResult && result && !error && !isExporting && (
          <div className="export-message export-success">
            <span className="export-message-icon">✓</span>
            <span className="export-message-text">
              Export complete! {result.files?.length || 0} file(s) downloaded.
            </span>
            <button
              className="export-dismiss-btn"
              onClick={handleDismiss}
              type="button"
            >
              ×
            </button>
          </div>
        )}

        {/* Data availability indicator */}
        {!canExport && !isExporting && (
          <div className="export-message export-info">
            <span className="export-message-icon">ℹ️</span>
            <span className="export-message-text">
              {!exportCapabilities?.hasBoreholes
                ? 'Add boreholes to enable export'
                : 'Waiting for 3D scene to initialize...'}
            </span>
          </div>
        )}

        {/* Export buttons */}
        <button
          className={`export-card-btn ${isDisabled ? 'disabled' : ''}`}
          onClick={handleExportOBJ}
          disabled={isDisabled}
          type="button"
        >
          <div className="export-btn-content">
            <span className="export-label">Export as OBJ</span>
            <span className="export-sublabel">For Revit/BIM (requires plugin)</span>
          </div>
          <span className="export-icon">
            {isExporting ? <LoadingSpinner /> : <DownloadIcon />}
          </span>
        </button>

        <button
          className={`export-card-btn ${isDisabled ? 'disabled' : ''}`}
          onClick={handleExportIFC}
          disabled={isDisabled}
          type="button"
          title="IFC export - coming soon"
        >
          <div className="export-btn-content">
            <span className="export-label">Export as IFC</span>
            <span className="export-sublabel">Native BIM format (beta)</span>
          </div>
          <span className="export-icon">
            {isExporting ? <LoadingSpinner /> : <DownloadIcon />}
          </span>
        </button>

        {/* Capability summary when export is available */}
        {canExport && !isExporting && (
          <div className="export-capabilities">
            <div className="capability-item">
              <span className={exportCapabilities?.hasBoreholes ? 'available' : 'unavailable'}>
                {exportCapabilities?.hasBoreholes ? '✓' : '○'}
              </span>
              <span>Boreholes</span>
            </div>
            <div className="capability-item">
              <span className={exportCapabilities?.hasGeologicalModel ? 'available' : 'unavailable'}>
                {exportCapabilities?.hasGeologicalModel ? '✓' : '○'}
              </span>
              <span>Geological Model</span>
            </div>
            <div className="capability-item">
              <span className={exportCapabilities?.hasWaterTable ? 'available' : 'unavailable'}>
                {exportCapabilities?.hasWaterTable ? '✓' : '○'}
              </span>
              <span>Water Table</span>
            </div>
          </div>
        )}
      </div>
    </PanelSection>
  );
};

/**
 * Simple loading spinner component
 */
const LoadingSpinner = () => (
  <svg
    className="export-spinner"
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
  >
    <circle
      cx="8"
      cy="8"
      r="6"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeDasharray="28"
      strokeDashoffset="8"
    />
  </svg>
);

export default ExportSection;
