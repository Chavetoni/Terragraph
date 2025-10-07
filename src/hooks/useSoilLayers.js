// src/hooks/useSoilLayers.js
import { useState, useCallback, useMemo } from 'react';
import { DEFAULT_SOIL_TYPES, MAX_LAYERS } from '../utils/constants';
import { createDefaultLayer, calculateTotalDepth } from '../utils/modelUtils';

export const useSoilLayers = () => {
  const [layers, setLayers] = useState([]);
  const [activeLayerIndex, setActiveLayerIndex] = useState(0);
  const [viewMode, setViewMode] = useState('normal');
  const [verticalSpacing, setVerticalSpacing] = useState(0.5);
  const [strataDimensions, setStrataDimensions] = useState({ width: 5, depth: 5 });

  const totalProfileDepth = useMemo(() => {
    return calculateTotalDepth(layers).toFixed(1);
  }, [layers]);

  const addLayer = useCallback(() => {
    if (layers.length >= MAX_LAYERS) {
      return;
    }

    setLayers(prevLayers => {
      const newLayer = createDefaultLayer(prevLayers.length);
      const updatedLayers = [...prevLayers, newLayer];
      setActiveLayerIndex(updatedLayers.length - 1);
      return updatedLayers;
    });
  }, [layers.length]);

  const removeLayer = useCallback((index) => {
    if (layers.length <= 0) return;

    setLayers(prevLayers => {
      const updatedLayers = prevLayers.filter((_, i) => i !== index);
      
      // Update active layer index if needed
      if (index === activeLayerIndex) {
        const newActiveIndex = Math.min(activeLayerIndex, updatedLayers.length - 1);
        setActiveLayerIndex(Math.max(0, newActiveIndex));
      } else if (index < activeLayerIndex) {
        // If removing a layer before the active one, adjust the active index
        setActiveLayerIndex(activeLayerIndex - 1);
      }
      
      return updatedLayers;
    });
  }, [layers.length, activeLayerIndex]);

  const updateLayer = useCallback((index, property, value) => {
    if (index < 0 || index >= layers.length) return;

    setLayers(prevLayers => {
      const updatedLayers = [...prevLayers];
      
      if (property === 'depth') {
        const numericValue = parseFloat(value);
        updatedLayers[index] = {
          ...updatedLayers[index],
          [property]: isNaN(numericValue) || numericValue < 0.1 ? 0.1 : numericValue
        };
      } else {
        updatedLayers[index] = {
          ...updatedLayers[index],
          [property]: value
        };
      }
      
      return updatedLayers;
    });
  }, [layers.length]);

  const updateLayerBatch = useCallback((index, properties) => {
    if (index < 0 || index >= layers.length) return;

    setLayers(prevLayers => {
      const updatedLayers = [...prevLayers];
      
      // Process depth separately to ensure valid values
      if ('depth' in properties) {
        const numericDepth = parseFloat(properties.depth);
        properties.depth = isNaN(numericDepth) || numericDepth < 0.1 ? 0.1 : numericDepth;
      }
      
      updatedLayers[index] = {
        ...updatedLayers[index],
        ...properties
      };
      
      return updatedLayers;
    });
  }, [layers.length]);

  const updateStrataDimensions = useCallback((dimension, value) => {
    const numValue = parseFloat(value);
    if (isNaN(numValue) || numValue <= 0) return;
    
    setStrataDimensions(prev => ({
      ...prev,
      [dimension]: numValue
    }));
  }, []);

  const getLayers = useCallback(() => {
    return layers;
  }, [layers]);

  const getLayerCount = useCallback(() => {
    return layers.length;
  }, [layers.length]);

  const setLayerCount = useCallback((count) => {
    const targetCount = Math.max(0, Math.min(MAX_LAYERS, count));
    const currentCount = layers.length;
    
    if (targetCount === currentCount) return;
    
    if (targetCount > currentCount) {
      // Add layers
      const layersToAdd = [];
      for (let i = 0; i < targetCount - currentCount; i++) {
        layersToAdd.push(createDefaultLayer(currentCount + i));
      }
      
      setLayers(prev => [...prev, ...layersToAdd]);
      setActiveLayerIndex(Math.min(activeLayerIndex, targetCount - 1));
    } else {
      // Remove layers from the end
      setLayers(prev => prev.slice(0, targetCount));
      setActiveLayerIndex(Math.min(activeLayerIndex, targetCount - 1 < 0 ? 0 : targetCount - 1));
    }
  }, [layers.length, activeLayerIndex]);

  return {
    layers,
    activeLayerIndex,
    setActiveLayerIndex,
    viewMode,
    setViewMode,
    verticalSpacing,
    setVerticalSpacing,
    strataDimensions,
    updateStrataDimensions,
    totalProfileDepth,
    addLayer,
    removeLayer,
    updateLayer,
    updateLayerBatch,
    getLayers,
    getLayerCount,
    setLayerCount,
    DEFAULT_SOIL_TYPES
  };
};

export default useSoilLayers;