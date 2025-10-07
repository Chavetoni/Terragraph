import React, { useState } from 'react';
import { useGeologicalModeling } from '../../contexts/OptimizedGeologicalModelingContext';
import './ModeSelector.css';

const ModeSelector = ({ className = '' }) => {
  const { 
    modelingMode, 
    switchMode, 
    capabilities, 
    getModeInfo,
    MODELING_MODES 
  } = useGeologicalModeling();
  
  const [showTooltip, setShowTooltip] = useState(null);
  const [error, setError] = useState('');

  const handleModeChange = async (newMode) => {
    try {
      setError('');
      switchMode(newMode);
    } catch (err) {
      setError(err.message);
    }
  };

  const conceptualInfo = getModeInfo(MODELING_MODES.CONCEPTUAL);
  const dataDriverInfo = getModeInfo(MODELING_MODES.DATA_DRIVEN);

  const getStatusIcon = (mode) => {
    if (mode === MODELING_MODES.CONCEPTUAL) {
      return (
        <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
      );
    } else {
      return capabilities.canUseDataDriven ? (
        <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ) : (
        <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 24 24">
          <path d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
      );
    }
  };

  const getCapabilityBadge = () => {
    if (!capabilities.canUseDataDriven) {
      const missing = [];
      if (capabilities.boreholeCount < 3) missing.push('boreholes');
      if (!capabilities.hasLayerData) missing.push('layer data');
      if (!capabilities.hasSpatialData) missing.push('coordinates');
      
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
          Missing: {missing.join(', ')}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
        Ready ({capabilities.boreholeCount} boreholes)
      </span>
    );
  };

  return (
    <div className={`mode-selector ${className}`}>
      <div className="mode-header">
        <h3 className="mode-title">Geological Modeling Mode</h3>
        <p className="mode-description">Choose your modeling approach</p>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md mb-4">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      <div className="mode-toggle">
        <button
          className={`mode-option ${modelingMode === MODELING_MODES.CONCEPTUAL ? 'active' : 'inactive'}`}
          onClick={() => handleModeChange(MODELING_MODES.CONCEPTUAL)}
          type="button"
          aria-pressed={modelingMode === MODELING_MODES.CONCEPTUAL}
          onMouseEnter={() => setShowTooltip('conceptual')}
          onMouseLeave={() => setShowTooltip(null)}
        >
          <div className="mode-icon">
            {getStatusIcon(MODELING_MODES.CONCEPTUAL)}
          </div>
          <div className="mode-content">
            <span className="mode-label">{conceptualInfo.name}</span>
            <span className="mode-subtitle">Quick layers</span>
          </div>
          
          {showTooltip === 'conceptual' && (
            <div className="mode-tooltip">
              <h5 className="font-medium text-gray-900 mb-2">Features:</h5>
              <ul className="text-sm text-gray-600 space-y-1">
                {conceptualInfo.capabilities.map((cap, index) => (
                  <li key={index} className="flex items-center">
                    <span className="w-2 h-2 bg-blue-400 rounded-full mr-2"></span>
                    {cap}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </button>
        
        <button
          className={`mode-option ${modelingMode === MODELING_MODES.DATA_DRIVEN ? 'active' : 'inactive'} ${!capabilities.canUseDataDriven ? 'disabled' : ''}`}
          onClick={() => capabilities.canUseDataDriven && handleModeChange(MODELING_MODES.DATA_DRIVEN)}
          type="button"
          aria-pressed={modelingMode === MODELING_MODES.DATA_DRIVEN}
          disabled={!capabilities.canUseDataDriven}
          onMouseEnter={() => setShowTooltip('data-driven')}
          onMouseLeave={() => setShowTooltip(null)}
        >
          <div className="mode-icon">
            {getStatusIcon(MODELING_MODES.DATA_DRIVEN)}
          </div>
          <div className="mode-content">
            <span className="mode-label">{dataDriverInfo.name}</span>
            <span className="mode-subtitle">Advanced modeling</span>
          </div>
          
          {showTooltip === 'data-driven' && (
            <div className="mode-tooltip">
              <h5 className="font-medium text-gray-900 mb-2">Requirements:</h5>
              <ul className="text-sm text-gray-600 space-y-1">
                {dataDriverInfo.requirements.map((req, index) => {
                  let ismet = true;
                  if (req.includes('Minimum')) ismet = capabilities.boreholeCount >= 3;
                  if (req.includes('coordinates')) ismet = capabilities.hasSpatialData;
                  if (req.includes('layer data')) ismet = capabilities.hasLayerData;
                  
                  return (
                    <li key={index} className="flex items-center">
                      <span className={`w-2 h-2 rounded-full mr-2 ${
                        ismet ? 'bg-green-400' : 'bg-red-400'
                      }`}></span>
                      <span className={ismet ? 'text-gray-600' : 'text-red-600'}>
                        {req}
                      </span>
                    </li>
                  );
                })}
              </ul>
              <div className="mt-2">
                {getCapabilityBadge()}
              </div>
            </div>
          )}
        </button>
      </div>
      
      <div className="mode-info">
        {modelingMode === MODELING_MODES.CONCEPTUAL && (
          <div className="mode-info-content">
            <p>{conceptualInfo.description}</p>
            <div className="capability-tags">
              {conceptualInfo.capabilities.slice(0, 3).map((cap, index) => (
                <span key={index} className="capability-tag conceptual">
                  {cap}
                </span>
              ))}
            </div>
          </div>
        )}
        {modelingMode === MODELING_MODES.DATA_DRIVEN && (
          <div className="mode-info-content">
            <p>{dataDriverInfo.description}</p>
            <div className="capability-tags">
              {dataDriverInfo.capabilities.slice(0, 3).map((cap, index) => (
                <span key={index} className="capability-tag data-driven">
                  {cap}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Status Summary */}
      <div className="data-summary">
        <h4 className="summary-title">Data Summary</h4>
        <div className="summary-grid">
          <div className="summary-item">
            <div className="summary-value">
              {capabilities.boreholeCount}
            </div>
            <div className="summary-label">Boreholes</div>
          </div>
          <div className="summary-item">
            <div className="summary-value">
              {capabilities.hasLayerData ? '✓' : '✗'}
            </div>
            <div className="summary-label">Layer Data</div>
          </div>
          <div className="summary-item">
            <div className="summary-value">
              {capabilities.hasSpatialData ? '✓' : '✗'}
            </div>
            <div className="summary-label">Coordinates</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ModeSelector;