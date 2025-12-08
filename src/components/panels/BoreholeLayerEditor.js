import React, { useState, useCallback, useEffect } from 'react';
import { useStratigraphy } from '../../contexts/StratigraphyContext';
import { validateLayerData } from '../../utils/geologicalValidation';
import { handleWholeUnitScroll, handleWholeUnitKeyboard } from '../../utils/numericInputHelpers';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  restrictToVerticalAxis,
  restrictToWindowEdges,
} from '@dnd-kit/modifiers';
import './BoreholeLayerEditor.css';

const MATERIAL_TYPES = {
  CLAY: { name: 'Clay', color: '#8B4513', description: 'Fine-grained cohesive soil' },
  SAND: { name: 'Sand', color: '#F4A460', description: 'Granular non-cohesive soil' },
  GRAVEL: { name: 'Gravel', color: '#A0522D', description: 'Coarse granular material' },
  ROCK: { name: 'Rock', color: '#708090', description: 'Solid rock formation' },
  SILT: { name: 'Silt', color: '#DEB887', description: 'Fine-grained intermediate soil' },
  ORGANIC: { name: 'Organic', color: '#654321', description: 'Organic rich soil' },
  FILL: { name: 'Fill', color: '#D2691E', description: 'Engineered fill material' }
};

const BoreholeLayerEditor = ({ 
  layers = [], 
  totalDepth = 10, 
  onLayersChange, 
  onValidationChange,
  readonly = false,
  className = '',
  validation = {},
  getAutoFromDepth 
}) => {
  const { 
    getMaterialSuggestions, 
    getMaterialProps, 
    normalizeMaterial,
    recordMaterialUsage,
    validateSequence 
  } = useStratigraphy();
  
  const [editingLayers, setEditingLayers] = useState(layers);
  const [errors, setErrors] = useState({});
  const [warnings, setWarnings] = useState({});

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Initialize layers with default if empty
  useEffect(() => {
    if (layers.length === 0 && !readonly) {
      const defaultLayer = {
        id: Date.now().toString(),
        from: 0,
        to: totalDepth,
        material: 'CLAY',
        thickness: totalDepth,
        // Support both naming conventions
        depthFrom: 0,
        depthTo: totalDepth
      };
      setEditingLayers([defaultLayer]);
      onLayersChange?.([defaultLayer]);
    } else {
      setEditingLayers(layers);
    }
  }, [layers, totalDepth, readonly, onLayersChange]);

  // Validate layers whenever they change
  useEffect(() => {
    const validation = validateSequence(editingLayers);
    const layerErrors = {};
    const layerWarnings = {};
    
    // Individual layer validation
    editingLayers.forEach((layer, index) => {
      const layerValidation = validateLayerData(layer);
      if (!layerValidation.isValid) {
        layerErrors[index] = layerValidation.errors;
      }
      if (layerValidation.warnings.length > 0) {
        layerWarnings[index] = layerValidation.warnings;
      }
    });
    
    setErrors(layerErrors);
    setWarnings(layerWarnings);
    
    onValidationChange?.({
      isValid: validation.isValid && Object.keys(layerErrors).length === 0,
      errors: validation.errors,
      warnings: validation.warnings,
      layerErrors,
      layerWarnings
    });
  }, [editingLayers, onValidationChange, validateSequence]);

  // Round to 1 decimal place (0.1 ft precision)
  const roundDepth = (value) => Math.round(value * 10) / 10;

  const handleLayerChange = useCallback((index, field, value) => {
    if (readonly) return;

    const updatedLayers = [...editingLayers];
    const layer = { ...updatedLayers[index] };

    if (field === 'material') {
      const normalizedMaterial = normalizeMaterial(value);
      layer.material = normalizedMaterial;
      recordMaterialUsage(normalizedMaterial);
    } else if (field === 'from' || field === 'to' || field === 'depthFrom' || field === 'depthTo') {
      let numValue = parseFloat(value);
      if (!isNaN(numValue)) {
        numValue = roundDepth(numValue); // Round to avoid floating point precision issues
        layer[field] = numValue;
        // Update both naming conventions
        if (field === 'from') {
          layer.depthFrom = numValue;
          layer.thickness = roundDepth(layer.to - numValue);
        } else if (field === 'to') {
          layer.depthTo = numValue;
          layer.thickness = roundDepth(numValue - layer.from);
        } else if (field === 'depthFrom') {
          layer.from = numValue;
          layer.thickness = roundDepth(layer.depthTo - numValue);
        } else if (field === 'depthTo') {
          layer.to = numValue;
          layer.thickness = roundDepth(numValue - layer.depthFrom);
        }
      }
    } else {
      layer[field] = value;
    }

    updatedLayers[index] = layer;
    setEditingLayers(updatedLayers);
    onLayersChange?.(updatedLayers);
  }, [editingLayers, readonly, normalizeMaterial, recordMaterialUsage, onLayersChange]);

  const addLayer = () => {
    if (readonly) return;

    const lastLayer = editingLayers[editingLayers.length - 1];
    let newFrom = roundDepth(lastLayer ? (lastLayer.to || lastLayer.depthTo || 0) : 0);
    let newTo = roundDepth(Math.min(newFrom + 1, totalDepth));

    // If we're at the total depth, adjust the last layer to make room
    if (newFrom >= totalDepth && editingLayers.length > 0) {
      const adjustedLayers = [...editingLayers];
      const lastLayerIndex = adjustedLayers.length - 1;
      const availableDepth = totalDepth - (adjustedLayers[lastLayerIndex].from || adjustedLayers[lastLayerIndex].depthFrom || 0);
      const layerDepth = roundDepth(Math.max(0.5, availableDepth / 2)); // At least 0.5 ft per layer

      const fromDepth = adjustedLayers[lastLayerIndex].from || adjustedLayers[lastLayerIndex].depthFrom || 0;
      const toDepth = roundDepth(fromDepth + layerDepth);

      adjustedLayers[lastLayerIndex] = {
        ...adjustedLayers[lastLayerIndex],
        to: toDepth,
        depthTo: toDepth,
        thickness: roundDepth(layerDepth)
      };

      newFrom = roundDepth(adjustedLayers[lastLayerIndex].to || adjustedLayers[lastLayerIndex].depthTo);
      newTo = roundDepth(totalDepth);
      setEditingLayers(adjustedLayers);
    }

    const newLayer = {
      id: Date.now().toString() + Math.random(),
      from: newFrom,
      to: newTo,
      depthFrom: newFrom,
      depthTo: newTo,
      material: 'SAND',
      thickness: roundDepth(newTo - newFrom),
      description: '',
      density: 1.8,
      porosity: 0.3
    };

    const updatedLayers = [...editingLayers, newLayer];
    setEditingLayers(updatedLayers);
    onLayersChange?.(updatedLayers);
  };

  const removeLayer = (index) => {
    if (readonly || editingLayers.length <= 1) return;
    
    const updatedLayers = editingLayers.filter((_, i) => i !== index);
    setEditingLayers(updatedLayers);
    onLayersChange?.(updatedLayers);
  };

  const getMaterialColor = useCallback((material) => {
    const props = getMaterialProps(material);
    return props.color || MATERIAL_TYPES[material]?.color || '#CCCCCC';
  }, [getMaterialProps]);

  const getLayerStatus = useCallback((index) => {
    const hasErrors = errors[index] && errors[index].length > 0;
    const hasWarnings = warnings[index] && warnings[index].length > 0;
    
    if (hasErrors) return 'error';
    if (hasWarnings) return 'warning';
    return 'valid';
  }, [errors, warnings]);

  return (
    <div className={`borehole-layer-editor ${className}`}>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={[restrictToVerticalAxis, restrictToWindowEdges]}
      >
        <SortableContext items={editingLayers.map(layer => layer.id)} strategy={verticalListSortingStrategy}>
          <div className="layer-cards-list">
            {editingLayers.map((layer, index) => {
              const materialColor = getMaterialColor(layer.material);
              const isAutoFrom = index > 0; // First layer always starts at 0, others auto-calculate
              
              const thickness = (layer.to || layer.depthTo || 0) - (layer.from || layer.depthFrom || 0);
              const depthPercentage = totalDepth > 0 ? (thickness / totalDepth) * 100 : 0;
              
              return (
                <div key={layer.id} className={`layer-card ${getLayerStatus(index)}`}>
                  <div className="layer-visual-indicator">
                    <div className="layer-number">{index + 1}</div>
                    <div className="layer-thickness-bar" style={{ height: `${Math.max(depthPercentage, 10)}%` }}>
                      <div className="layer-color-bar" style={{ backgroundColor: materialColor }} />
                    </div>
                  </div>
                  
                  <div className="layer-content-wrapper">
                    <div className="layer-header">
                      <div className="layer-header-left">
                        <div className="drag-handle-grip" title="Drag to reorder">
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                            <path d="M5 3a1 1 0 110-2 1 1 0 010 2zm0 4a1 1 0 110-2 1 1 0 010 2zm0 4a1 1 0 110-2 1 1 0 010 2zm4-8a1 1 0 110-2 1 1 0 010 2zm0 4a1 1 0 110-2 1 1 0 010 2zm0 4a1 1 0 110-2 1 1 0 010 2z"/>
                          </svg>
                        </div>
                        <h4 className="layer-title">
                          <span className="layer-name">Layer {index + 1}</span>
                          <span className="layer-thickness-info">{thickness.toFixed(1)} ft thick</span>
                        </h4>
                      </div>
                      {editingLayers.length > 1 && (
                        <button
                          onClick={() => removeLayer(index)}
                          className="layer-remove-btn"
                          title="Remove this layer"
                        >
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                            <path d="M4.646 4.646a.5.5 0 01.708 0L8 7.293l2.646-2.647a.5.5 0 01.708.708L8.707 8l2.647 2.646a.5.5 0 01-.708.708L8 8.707l-2.646 2.647a.5.5 0 01-.708-.708L7.293 8 4.646 5.354a.5.5 0 010-.708z"/>
                          </svg>
                        </button>
                      )}
                    </div>
                    
                    <div className="layer-controls">
                      <div className="control-group material-control">
                        <div className="control-header">
                          <label className="control-label">Material Type</label>
                          <span className="material-tooltip" title={MATERIAL_TYPES[layer.material]?.description}>ⓘ</span>
                        </div>
                        <div className="material-selector">
                          <div className="material-color-preview" style={{ backgroundColor: materialColor }} />
                          <select
                            value={layer.material}
                            onChange={(e) => handleLayerChange(index, 'material', e.target.value)}
                            className="material-dropdown"
                          >
                            {Object.entries(MATERIAL_TYPES).map(([key, materialType]) => (
                              <option key={key} value={key}>
                                {materialType.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                      
                      <div className="control-group depth-control">
                        <div className="control-header">
                          <label className="control-label">Depth Range</label>
                        </div>
                        <div className="depth-inputs-row">
                          <div className="depth-input-container">
                            <span className="depth-prefix">From</span>
                            <input
                              type="number"
                              value={layer.from || layer.depthFrom || 0}
                              onChange={(e) => handleLayerChange(index, 'from', e.target.value)}
                              onWheel={(e) => handleWholeUnitScroll(e, (val) => handleLayerChange(index, 'from', val), { min: 0, max: totalDepth })}
                              onKeyDown={(e) => handleWholeUnitKeyboard(e, (val) => handleLayerChange(index, 'from', val), { min: 0, max: totalDepth })}
                              className="depth-input-inline"
                              step="1"
                              min="0"
                              max={totalDepth}
                              disabled={isAutoFrom}
                              placeholder="0.0"
                            />
                            <span className="depth-suffix">ft</span>
                          </div>
                          
                          <div className="depth-arrow">
                            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor">
                              <path d="M4 10h12m0 0l-3-3m3 3l-3 3" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          </div>
                          
                          <div className="depth-input-container">
                            <span className="depth-prefix">To</span>
                            <input
                              type="number"
                              value={layer.to || layer.depthTo || 0}
                              onChange={(e) => handleLayerChange(index, 'to', e.target.value)}
                              onWheel={(e) => handleWholeUnitScroll(e, (val) => handleLayerChange(index, 'to', val), { min: 0, max: totalDepth })}
                              onKeyDown={(e) => handleWholeUnitKeyboard(e, (val) => handleLayerChange(index, 'to', val), { min: 0, max: totalDepth })}
                              className="depth-input-inline"
                              step="1"
                              min="0"
                              max={totalDepth}
                              placeholder="0.0"
                            />
                            <span className="depth-suffix">ft</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {(errors[index] || warnings[index]) && (
                      <div className="layer-messages">
                        {errors[index]?.map((error, i) => (
                          <div key={i} className="message error-message">
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                              <path d="M8 0a8 8 0 100 16A8 8 0 008 0zM7 3h2v5H7V3zm0 6h2v2H7V9z"/>
                            </svg>
                            <span>{error}</span>
                          </div>
                        ))}
                        {warnings[index]?.map((warning, i) => (
                          <div key={i} className="message warning-message">
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                              <path d="M8.982 1.566a1.13 1.13 0 00-1.96 0L.165 13.233c-.457.778.091 1.767.98 1.767h13.713c.889 0 1.438-.99.98-1.767L8.982 1.566zM8 5c.535 0 .954.462.9.995l-.35 3.507a.552.552 0 01-1.1 0L7.1 5.995A.905.905 0 018 5zm.002 6a1 1 0 110 2 1 1 0 010-2z"/>
                            </svg>
                            <span>{warning}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </SortableContext>
      </DndContext>

      <div className="add-layer-section">
        {!readonly && (
          <button
            onClick={addLayer}
            className="add-layer-button-new"
            type="button"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
              <path d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"/>
            </svg>
            <span>Add New Layer</span>
          </button>
        )}
      </div>
      
      {editingLayers.length === 0 && (
        <div className="empty-state">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="currentColor" opacity="0.3">
            <path d="M8 12h32v4H8zm0 8h32v4H8zm0 8h32v4H8zm0 8h32v4H8z"/>
          </svg>
          <p>No soil layers defined yet</p>
          <p className="empty-hint">Click "Add New Layer" to start defining the soil profile</p>
        </div>
      )}
    </div>
  );
};

export default BoreholeLayerEditor;