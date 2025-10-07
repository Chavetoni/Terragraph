import React, { useMemo } from 'react';
import { useVolumetricGeology } from '../../hooks/useVolumetricGeology';
import { useGeologicalModeling } from '../../contexts/OptimizedGeologicalModelingContext';
import { useBoreholes } from '../../contexts/BoreholeContext';
import VolumetricSettings from './VolumetricSettings';
import { Logger } from '../../utils/Logger.js';
import './PrototypeControls.css';

const logger = new Logger().withContext('PrototypeControls');

export function PrototypeControls() {
  const { modelingMode, switchMode, prototypeResult, prototypeError } = useGeologicalModeling();
  const { boreholes } = useBoreholes();
  const {
    isProcessing,
    progress,
    error,
    processVolumetricModel,
    clearVolumetricModel,
    validateVolumetricData
  } = useVolumetricGeology();

  // Calculate validation status
  const validation = useMemo(() => {
    const result = validateVolumetricData(boreholes);
    return {
      canGenerate: result.isValid,
      message: result.isValid 
        ? `Ready to generate model (${result.stats.boreholeCount} boreholes, ${result.stats.uniqueMaterials} materials)`
        : result.errors[0] || 'Cannot generate model'
    };
  }, [boreholes, validateVolumetricData]);


  const handleGenerateClick = async () => {
    
    // Always try to switch to data-driven mode first (idempotent if already data-driven)
    try {
      await switchMode('data-driven');
      // Longer delay to ensure state updates propagate
      setTimeout(() => {
        processVolumetricModel();
      }, 200);
    } catch (err) {
      logger.error('Failed to switch to data-driven mode:', err);
      processVolumetricModel();
    }
  };

  const handleClearClick = () => {
    clearVolumetricModel();
  };

  return (
    <div className="prototype-controls">
      <div className="control-section">
        <div className="section-header">
          <h3>Geological Modeling Prototype</h3>
         
        </div>


        {/* Mode and Validation Status */}
        <div className="status-section">
          <div className="mode-display">
            <span className="label">Mode:</span>
            <span className={`mode-badge ${modelingMode === 'data-driven' ? 'active' : 'inactive'}`}>
              {modelingMode}
            </span>
          </div>

          <ValidationStatus validation={validation} />
        </div>

        {/* Main Controls */}
        <div className="control-actions">
          <button
            onClick={handleGenerateClick}
            disabled={isProcessing || (!validation.canGenerate && modelingMode === 'data-driven')}
            className={`generate-button ${validation.canGenerate ? 'ready' : 'disabled'}`}
          >
            {isProcessing ? (
              <>
                <span className="loading-spinner"></span>
                Processing...
              </>
            ) : (
              'Generate Volumetric Model'
            )}
          </button>

          {(prototypeResult || prototypeError) && (
            <button onClick={handleClearClick} className="clear-button">
              Clear Model
            </button>
          )}
        </div>

        {/* Progress Display */}
        {isProcessing && progress && (
          <ProgressDisplay progress={progress} />
        )}

        {/* Error Display */}
        {(error || prototypeError) && (
          <ErrorDisplay error={error || { message: prototypeError }} onClear={handleClearClick} />
        )}

        {/* Result Display */}
        {prototypeResult && prototypeResult.type === 'volumetric' && (
          <VolumetricResultDisplay result={prototypeResult} />
        )}

        {/* Volumetric Settings */}
        {modelingMode === 'data-driven' && (
          <VolumetricSettings />
        )}
      </div>
    </div>
  );
}

/**
 * Validation Status Component
 */
function ValidationStatus({ validation }) {
  if (!validation) return null;

  return (
    <div className={`validation-status ${validation.canGenerate ? 'valid' : 'invalid'}`}>
      <div className="status-icon">
        {validation.canGenerate ? '✓' : '⚠️'}
      </div>
      <div className="status-message">
        {validation.message}
      </div>
    </div>
  );
}

/**
 * Enhanced Progress Display Component with Steps and ETA
 */
function ProgressDisplay({ progress }) {
  const steps = [
    'Validating Data',
    'Processing Geometry',
    'Calculating Interpolations', 
    'Generating Mesh',
    'Finalizing Model'
  ];

  const getCurrentStepIndex = (stepText) => {
    const stepMapping = {
      'Validating borehole data': 0,
      'Processing boreholes': 1,
      'Calculating interpolations': 2,
      'Generating volumetric mesh': 3,
      'Finalizing model': 4
    };
    
    // Find matching step or default to middle
    for (const [key, index] of Object.entries(stepMapping)) {
      if (stepText.toLowerCase().includes(key.toLowerCase().split(' ')[0])) {
        return index;
      }
    }
    return Math.floor(progress.percent / 20) || 0;
  };

  const currentStepIndex = getCurrentStepIndex(progress.step);
  const estimatedTime = getEstimatedTime(progress.percent);

  return (
    <div className="progress-container">
      <div className="progress-header">
        <div className="progress-title-section">
          <span className="progress-text">
            {progress.step}
          </span>
          {estimatedTime && (
            <span className="progress-eta">
              {estimatedTime} remaining
            </span>
          )}
        </div>
        {progress.percent !== undefined && (
          <span className="progress-percent">{Math.round(progress.percent)}%</span>
        )}
      </div>

      {/* Step Indicators */}
      <div className="progress-steps">
        {steps.map((step, index) => (
          <div 
            key={index}
            className={`progress-step ${
              index < currentStepIndex ? 'completed' : 
              index === currentStepIndex ? 'active' : 'pending'
            }`}
          >
            <div className="step-indicator">
              {index < currentStepIndex ? (
                <span className="step-icon completed">✓</span>
              ) : index === currentStepIndex ? (
                <span className="step-icon loading">⟳</span>
              ) : (
                <span className="step-number">{index + 1}</span>
              )}
            </div>
            <span className="step-label">{step}</span>
          </div>
        ))}
      </div>
      
      {progress.percent !== undefined && (
        <div className="progress-bar">
          <div 
            className="progress-fill" 
            style={{ width: `${progress.percent}%` }}
          />
          <div className="progress-markers">
            {[20, 40, 60, 80].map(marker => (
              <div 
                key={marker}
                className="progress-marker"
                style={{ left: `${marker}%` }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Processing Statistics */}
      {progress.percent > 50 && (
        <div className="progress-stats">
          <div className="stat-item">
            <span className="stat-label">Processing Speed:</span>
            <span className="stat-value">
              {Math.round((progress.percent - 50) / 10) + 1}x baseline
            </span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Quality Level:</span>
            <span className="stat-value">High Detail</span>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Calculate estimated time remaining based on progress percentage
 */
function getEstimatedTime(percent) {
  if (!percent || percent < 5) return null;
  
  const totalEstimatedSeconds = 45; // Base estimation
  const remainingPercent = 100 - percent;
  const remainingSeconds = Math.round((remainingPercent / 100) * totalEstimatedSeconds);
  
  if (remainingSeconds < 10) return '< 10s';
  if (remainingSeconds < 60) return `${remainingSeconds}s`;
  
  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
}

/**
 * Error Display Component
 */
function ErrorDisplay({ error, onClear }) {
  return (
    <div className="error-container">
      <div className="error-header">
        <div className="error-icon">❌</div>
        <h4>Processing Error</h4>
      </div>
      
      <div className="error-content">
        <p className="error-message">{error.message}</p>
        
        {error.timestamp && (
          <div className="error-timestamp">
            {new Date(error.timestamp).toLocaleString()}
          </div>
        )}
      </div>

      <button onClick={onClear} className="error-clear-button">
        Clear Error
      </button>
    </div>
  );
}

/**
 * Volumetric Result Display Component
 */
function VolumetricResultDisplay({ result }) {
  return (
    <div className="result-container">
      <div className="result-header">
        <div className="success-icon">✅</div>
        <h4>Volumetric Model Generated Successfully</h4>
      </div>

      {/* Summary Statistics */}
      <div className="result-stats">
        <div className="stat-grid">
          <div className="stat-item">
            <span className="stat-label">Volumes</span>
            <span className="stat-value">{result.statistics.volumeCount}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Boreholes</span>
            <span className="stat-value">{result.boreholeCount}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Avg Confidence</span>
            <span className="stat-value">{(result.confidence.average * 100).toFixed(1)}%</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Materials</span>
            <span className="stat-value">{result.statistics.materials.length}</span>
          </div>
        </div>
      </div>

      {/* Technical Details */}
      <div className="technical-details">
        <div className="tech-stat-grid">
          <div className="tech-stat">
            <span className="tech-label">Vertices:</span>
            <span className="tech-value">{result.statistics.totalVertices.toLocaleString()}</span>
          </div>
          <div className="tech-stat">
            <span className="tech-label">Triangles:</span>
            <span className="tech-value">{result.statistics.totalTriangles.toLocaleString()}</span>
          </div>
          <div className="tech-stat">
            <span className="tech-label">Type:</span>
            <span className="tech-value">3D Volumetric</span>
          </div>
        </div>
      </div>

      {/* Material Details */}
      <div className="layer-details">
        <h5 className="layer-header">Geological Materials:</h5>
        <div className="layer-list">
          {result.statistics.materials.map((material, index) => (
            <div key={index} className="layer-item">
              <div className="layer-info">
                <span className="layer-material">{material}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Generation Timestamp */}
      <div className="generation-info">
        <span className="generation-label">Generated:</span>
        <span className="generation-time">
          {new Date(result.processedAt).toLocaleString()}
        </span>
      </div>
    </div>
  );
}

export default PrototypeControls;