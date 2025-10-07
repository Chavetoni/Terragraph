// src/components/panels/LayerEditorSection.js
import React, { useState } from 'react';
import CollapsibleSection from '../ui/CollapsibleSection';
import ViewModeControls from '../controls/ViewModeControls';
import LayerControls from '../controls/LayerControls';
import { useLayers } from '../../contexts/LayersContext';
import './LayerEditorSection.css';

const LayerEditorSection = ({ isOpen, onToggle }) => {
  const {
    layers,
    activeLayerIndex,
    setActiveLayerIndex,
    addLayer,
    removeLayer
  } = useLayers();
  
  const [isHoveringButton, setIsHoveringButton] = useState({
    add: false,
    remove: false
  });

  return (
    <CollapsibleSection
      title="Layer Properties"
      sectionKey="layerEditor"
      isOpen={isOpen}
      onToggle={onToggle}
    >
      {layers.length > 0 ? (
        <>
          <ViewModeControls />
          
          <div className="action-button-container">
            <button
              onClick={addLayer}
              className={`action-button add-button ${isHoveringButton.add ? 'add-button-hover' : ''}`}
              onMouseEnter={() => setIsHoveringButton(prev => ({ ...prev, add: true }))}
              onMouseLeave={() => setIsHoveringButton(prev => ({ ...prev, add: false }))}
            >
              Add Layer
            </button>
            
            <button
              onClick={() => removeLayer(activeLayerIndex)}
              className={`action-button ${layers.length <= 0 ? 'remove-button-disabled' : 'remove-button'} ${layers.length > 0 && isHoveringButton.remove ? 'remove-button-hover' : ''}`}
              disabled={layers.length <= 0}
              onMouseEnter={() => setIsHoveringButton(prev => ({ ...prev, remove: true }))}
              onMouseLeave={() => setIsHoveringButton(prev => ({ ...prev, remove: false }))}
            >
              Remove Layer
            </button>
          </div>
          
          <div style={{ marginBottom: '16px' }}>
            <label className="layer-selector-label">
              Select Layer: (Layer {activeLayerIndex + 1} selected)
            </label>
            
            <div className="layer-selector-grid" role="radiogroup" aria-label="Layer selector">
              {layers.map((layer, index) => (
                <div
                  role="radio"
                  tabIndex={0}
                  aria-checked={index === activeLayerIndex}
                  key={layer.id || index}
                  onClick={() => setActiveLayerIndex(index)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') setActiveLayerIndex(index);
                  }}
                  className={`layer-selector-item ${index === activeLayerIndex ? 'layer-selector-item-active' : ''}`}
                  style={{ backgroundColor: layer.color }}
                  title={`Layer ${index + 1}: ${layer.name}`}
                />
              ))}
            </div>
          </div>
          
          {layers[activeLayerIndex] && (
            <LayerControls
              layer={layers[activeLayerIndex]}
              index={activeLayerIndex}
              isActive={true}
            />
          )}
        </>
      ) : (
        <div className="action-button-container">
          <button
            onClick={addLayer}
            className={`action-button add-button ${isHoveringButton.add ? 'add-button-hover' : ''}`}
            style={{ width: '100%' }}
            onMouseEnter={() => setIsHoveringButton(prev => ({ ...prev, add: true }))}
            onMouseLeave={() => setIsHoveringButton(prev => ({ ...prev, add: false }))}
          >
            Initialize First Layer
          </button>
        </div>
      )}
    </CollapsibleSection>
  );
};

export default LayerEditorSection;