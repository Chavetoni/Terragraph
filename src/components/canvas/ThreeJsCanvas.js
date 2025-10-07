import React, { useContext, useCallback } from 'react';
import { ThreeJsContext } from '../../contexts/ThreeJsContext';
import { useBoreholes } from '../../contexts/BoreholeContext';
import { useDisplayOptions } from '../../contexts/DisplayOptionsContext';
import { formatDepthMetersToFeet } from '../../utils/unitConverter.js';
import BoreholeCreationModal from '../ui/BoreholeCreationModal';
import VolumetricGeologicalModel from './VolumetricGeologicalModel';

/**
 * A simple component that provides the mount point for the Three.js canvas.
 * It gets the ref callback from the context and applies it to the div.
 */
const ThreeJsCanvas = () => {
  // Get the ref callback from the context
  const { canvasMountRef, renderer } = useContext(ThreeJsContext);
  const { 
    handleCanvasClick,
    handleCanvasMouseMove, 
    showCreationModal, 
    handleBoreholeCreationConfirm, 
    handleBoreholeCreationCancel,
    pendingBoreholeData,
    hoveredStrataLayer 
  } = useBoreholes();
  const { showBoreholeStrata } = useDisplayOptions();

  // Handle canvas clicks for borehole placement
  const handleClick = useCallback((event) => {
    if (renderer && renderer.domElement) {
      handleCanvasClick(event, renderer.domElement);
    }
  }, [handleCanvasClick, renderer]);

  // Handle mouse move for hover effects
  const handleMouseMove = useCallback((event) => {
    if (renderer && renderer.domElement) {
      handleCanvasMouseMove(event, renderer.domElement);
    }
  }, [handleCanvasMouseMove, renderer]);

  // The div will be passed to the canvasMountRef callback when it mounts,
  // triggering the Three.js initialization within the context.
  return (
    <>
      <div 
        ref={canvasMountRef} 
        style={{ width: '100%', height: '100%', position: 'relative' }}
        onClick={handleClick}
        onMouseMove={handleMouseMove}
      />
      
      {/* Strata layer tooltip - only show when strata is enabled */}
      {hoveredStrataLayer && showBoreholeStrata && (
        <div
          style={{
            position: 'absolute',
            bottom: '20px',
            left: '20px',
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            color: 'white',
            padding: '10px 15px',
            borderRadius: '8px',
            fontSize: '14px',
            pointerEvents: 'none',
            zIndex: 1000,
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)'
          }}
        >
          <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>
            {hoveredStrataLayer.layerName}
          </div>
          <div style={{ fontSize: '12px', color: '#ccc' }}>
            Thickness: {formatDepthMetersToFeet(hoveredStrataLayer.thickness)}'
          </div>
        </div>
      )}
      
      <BoreholeCreationModal
        isOpen={showCreationModal}
        onClose={handleBoreholeCreationCancel}
        onConfirm={handleBoreholeCreationConfirm}
        defaultName={pendingBoreholeData?.defaultName}
        pendingCoordinates={pendingBoreholeData}
      />
      
      {/* Volumetric geological model for 3D visualization */}
      <VolumetricGeologicalModel />
    </>
  );
};

export default ThreeJsCanvas;
