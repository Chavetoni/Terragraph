// src/components/controls/MapUploader.js
import React, { useRef, useState, useCallback, useEffect } from 'react';
import { useSiteMap } from '../../contexts/SiteMapContext';
import StandardButton from '../ui/StandardButton';
import { StandardInput, StandardFormGroup } from '../ui/StandardForm';


 // File validation constants
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const VALID_EXTENSIONS = ['.glb', '.gltf'];
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
      setError(`Invalid file type. Please upload a GLTF (.glb or .gltf) file.`);
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
    <div className="space-y-4">
      <input
        id="file-upload-input"
        type="file"
        accept=".glb, .gltf"
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
        {isLoading ? 'Loading Site Map...' : 'Load Site Map (.glb/.gltf)'}
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
            <StandardFormGroup>
              <label className="form-label-new">Position (X, Y above ground, Z):</label>
              <div className="grid grid-cols-3 gap-2">
                {['x', 'y', 'z'].map((axis, index) => (
                  <StandardInput
                    key={`pos-${axis}`}
                    aria-label={`Map position ${axis.toUpperCase()}`}
                    type="number"
                    step="0.1"
                    value={siteMapProps.position[axis]}
                    onChange={(e) => handleMapPropChange('position', axis, e.target.value)}
                    placeholder={axis.toUpperCase()}
                  />
                ))}
              </div>
            </StandardFormGroup>
          )}

          { (mapFileName || mapObject) && siteMapProps &&  (
            <StandardFormGroup>
              <label className="form-label-new">Quick Orientation Fix:</label>
              <div className="grid grid-cols-2 gap-2">
                <StandardButton
                  variant="secondary"
                  onClick={() => handleQuickRotation('makeFlat')}
                  size="small"
                >
                  Make Vertical (X-Y)
                </StandardButton>

                <StandardButton
                  variant="secondary"
                  onClick={() => handleQuickRotation('rotate90Y')}
                  size="small"
                >
                  Reset
                </StandardButton>
              </div>
            </StandardFormGroup>
          )}

          {/* Scale Controls */}
          {siteMapProps?.scale && (
            <StandardFormGroup>
              <label className="form-label-new">Scale (X, Y, Z):</label>
              <div className="grid grid-cols-3 gap-2">
                {['x', 'y', 'z'].map((axis, index) => (
                  <StandardInput
                    key={`scale-${axis}`}
                    aria-label={`Map scale ${axis.toUpperCase()}`}
                    type="number"
                    step="0.1"
                    min="0.01"
                    value={siteMapProps.scale[axis]}
                    onChange={(e) => handleMapPropChange('scale', axis, e.target.value)}
                    placeholder={axis.toUpperCase()}
                  />
                ))}
              </div>
            </StandardFormGroup>
          )}
          
          {/* Opacity and Visibility Controls */}
          <StandardFormGroup>
            <label htmlFor="opacity-slider" className="form-label-new">
              Opacity: {(siteMapProps.opacity * 100).toFixed(0)}%
            </label>
            <input
              id="opacity-slider"
              type="range"
              min="0"
              max="1"
              step="0.01"
              className="w-full cursor-pointer"
              value={siteMapProps.opacity}
              onChange={(e) => handleMapPropChange('opacity', null, e.target.value)}
              aria-label="Map opacity slider"
            />
          </StandardFormGroup>
          
          <StandardFormGroup>
            <label className="checkbox-label flex items-center gap-2">
              <input
                type="checkbox"
                checked={siteMapProps.visible}
                onChange={(e) => handleMapPropChange('visible', null, e.target.checked)}
                className="checkbox"
                aria-label="Show site map checkbox"
              />
              <span className="text-sm">Show Site Map</span>
            </label>
          </StandardFormGroup>
          
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
    </div>
  );
};

export default MapUploader;