// src/components/controls/MapUploader.js
import React, { useRef, useState, useCallback, useEffect } from 'react';
import { useSiteMap } from '../../contexts/SiteMapContext';
import StandardButton from '../ui/StandardButton';
import { StandardInput } from '../ui/StandardForm';
import { handleWholeUnitScroll, handleWholeUnitKeyboard } from '../../utils/numericInputHelpers';
import './MapUploader.css';


 // File validation constants
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const VALID_EXTENSIONS = ['.glb', '.gltf', '.png', '.jpg', '.jpeg'];
const LOADING_TIMEOUT = 30000; // 30 seconds

const MapUploader = () => {
  const fileInputRef = useRef(null);
  const { 
    mapFileName, 
    siteMapProps, 
    mapObject,
    error: contextError,
    isLoading: contextIsLoading,
    handleMapPropChange, 
    handleFileChange: hookHandleFileChange, 
    handleRemoveMap,
    handleQuickRotation
  } = useSiteMap();
  
  
  const [error, setError] = useState(null);
  const isLoading = contextIsLoading;
  const loadingTimeoutRef = useRef(null);

 

  // Clean up loading timeout on unmount
  useEffect(() => {
    return () => {
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }
    };
  }, []);

  const handleFileChange = useCallback((event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    setError(null);
    
    // Validate file extension
    const extension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    if (!VALID_EXTENSIONS.includes(extension)) {
      setError(`Invalid file type. Please upload a 3D model (.glb, .gltf) or image (.png, .jpg, .jpeg) file.`);
      if (fileInputRef.current) fileInputRef.current.value = null;
      return;
    }
    
    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      setError(`File too large (${(file.size / (1024 * 1024)).toFixed(1)}MB). Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB.`);
      if (fileInputRef.current) fileInputRef.current.value = null;
      return;
    }
    
    // Set loading timeout
    loadingTimeoutRef.current = setTimeout(() => {
      setError('File loading timed out. Try with a smaller file.');
      if (fileInputRef.current) fileInputRef.current.value = null;
    }, LOADING_TIMEOUT);
    
    // Call the original handler
    hookHandleFileChange(event, {
      onSuccess: () => {
        clearTimeout(loadingTimeoutRef.current);
        setError(null);
      },
      onError: (errorMsg) => {
        clearTimeout(loadingTimeoutRef.current);
        setError(errorMsg);
        if (fileInputRef.current) fileInputRef.current.value = null;
      }
    });
  }, [hookHandleFileChange]);

  const handleRemoveMapWithReset = useCallback(() => {
    setError(null);
    handleRemoveMap();
  }, [handleRemoveMap]);

  return (
    <div className="map-uploader-wrapper">
      <input
        id="file-upload-input"
        type="file"
        accept=".glb, .gltf, .png, .jpg, .jpeg"
        ref={fileInputRef}
        className="hidden"
        onChange={handleFileChange}
        key={mapFileName || `file-input-${Date.now()}`}
        disabled={isLoading}
      />

      <StandardButton
        variant="primary"
        onClick={() => !isLoading && fileInputRef.current && fileInputRef.current.click()}
        disabled={isLoading}
        loading={isLoading}
        fullWidth
      >
        {isLoading ? 'Loading Site Map...' : 'Load Site Map'}
      </StandardButton>

      {(error || contextError) && (
        <div className="form-error-message">
          <span>Error: {error || contextError}</span>
        </div>
      )}

      {mapFileName && !error && (
        <div className="form-success-message">
          <span>Loaded: {mapFileName}</span>
        </div>
      )}
      
    {(mapFileName || mapObject) && siteMapProps && (
        <>
          {/* Position Controls */}
          {siteMapProps?.position && (
            <div className="control-group">
              <h4 className="control-group-title">Position</h4>
              <div className="coordinate-inputs">
                {['x', 'y', 'z'].map((axis) => (
                  <div key={`pos-${axis}`} className="coordinate-field">
                    <label className="coordinate-label">{axis.toUpperCase()}</label>
                    <div className="input-wrapper">
                      <StandardInput
                        aria-label={`Map position ${axis.toUpperCase()}`}
                        type="number"
                        step="any"
                        value={siteMapProps.position[axis]}
                        onChange={(e) => handleMapPropChange('position', axis, e.target.value)}
                        onWheel={(e) => handleWholeUnitScroll(e, (val) => handleMapPropChange('position', axis, val), { step: 1, allowDecimals: false })}
                        onKeyDown={(e) => handleWholeUnitKeyboard(e, (val) => handleMapPropChange('position', axis, val), { step: 1, allowDecimals: false })}
                        placeholder="0"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quick Rotation Controls */}
          <div className="control-group">
            <h4 className="control-group-title">Quick Orientation</h4>
            <div className="button-row">
              <StandardButton
                variant="secondary"
                onClick={() => handleQuickRotation('makeFlat')}
                size="small"
              >
                Make Vertical
              </StandardButton>
              <StandardButton
                variant="secondary"
                onClick={() => handleQuickRotation('rotate90Y')}
                size="small"
              >
                Reset
              </StandardButton>
            </div>
          </div>

          {/* Scale Controls */}
          {siteMapProps?.scale && (
            <div className="control-group">
              <h4 className="control-group-title">Scale</h4>
              <div className="coordinate-inputs">
                {['x', 'y', 'z'].map((axis) => (
                  <div key={`scale-${axis}`} className="coordinate-field">
                    <label className="coordinate-label">{axis.toUpperCase()}</label>
                    <div className="input-wrapper">
                      <StandardInput
                        aria-label={`Map scale ${axis.toUpperCase()}`}
                        type="number"
                        step="0.1"
                        min="0.1"
                        value={siteMapProps.scale[axis]}
                        onChange={(e) => handleMapPropChange('scale', axis, e.target.value)}
                        onWheel={(e) => handleWholeUnitScroll(e, (val) => handleMapPropChange('scale', axis, val), { min: 0.1, step: 0.1, allowDecimals: true, precision: 1 })}
                        onKeyDown={(e) => handleWholeUnitKeyboard(e, (val) => handleMapPropChange('scale', axis, val), { min: 0.1, step: 0.1, allowDecimals: true, precision: 1 })}
                        placeholder="1.0"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Opacity Control */}
          <div className="control-group">
            <div className="opacity-header">
              <h4 className="control-group-title">Opacity</h4>
              <span className="opacity-value">{(siteMapProps.opacity * 100).toFixed(0)}%</span>
            </div>
            <input
              id="opacity-slider"
              type="range"
              min="0"
              max="1"
              step="0.01"
              className="w-full cursor-pointer opacity-slider"
              value={siteMapProps.opacity}
              onChange={(e) => handleMapPropChange('opacity', null, e.target.value)}
              aria-label="Map opacity slider"
            />
          </div>

          {/* Visibility Toggle */}
          <div className="visibility-control">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={siteMapProps.visible}
                onChange={(e) => handleMapPropChange('visible', null, e.target.checked)}
                className="checkbox"
                aria-label="Show site map checkbox"
              />
              <span className="text-sm">Show Site Map</span>
            </label>
          </div>

          {/* Remove Button */}
          <StandardButton
            variant="danger"
            onClick={handleRemoveMapWithReset}
            disabled={isLoading}
            fullWidth
          >
            Remove Site Map
          </StandardButton>
        </>
      )}

      <style jsx>{`
        .map-uploader-wrapper {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .control-group {
          background: var(--bg-card);
          border: 1px solid var(--border-subtle);
          border-radius: 12px;
          padding: 16px;
        }

        .control-group-title {
          font-size: 13px;
          font-weight: 600;
          color: var(--accent-primary);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 12px;
        }

        .coordinate-inputs {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .coordinate-field {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .coordinate-label {
          min-width: 24px;
          font-size: 14px;
          font-weight: 600;
          color: var(--text-primary);
          text-align: center;
          flex-shrink: 0;
        }

        .input-wrapper {
          flex: 1;
          min-width: 0;
          max-width: 180px;
        }

        .input-wrapper input {
          box-sizing: border-box;
        }

        .button-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }

        .opacity-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }

        .opacity-value {
          font-size: 14px;
          font-weight: 600;
          color: var(--accent-primary);
        }

        .opacity-slider {
          width: 100%;
        }

        .visibility-control {
          background: var(--bg-card);
          border: 1px solid var(--border-subtle);
          border-radius: 12px;
          padding: 14px 16px;
        }

        .checkbox-label {
          display: flex;
          align-items: center;
          gap: 10px;
          cursor: pointer;
          user-select: none;
        }

        .checkbox-label:hover {
          color: var(--text-primary);
        }

        .checkbox {
          width: 18px;
          height: 18px;
          cursor: pointer;
          accent-color: var(--accent-primary);
        }

        .text-sm {
          font-size: 14px;
          font-weight: 500;
          color: var(--text-primary);
        }
      `}</style>
    </div>
  );
};

export default MapUploader;