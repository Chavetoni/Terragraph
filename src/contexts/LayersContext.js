// src/contexts/LayersContext.js
import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';

const LayersContext = createContext(null);

export const useLayers = () => {
  const context = useContext(LayersContext);
  if (!context) {
    throw new Error('useLayers must be used within a LayersProvider');
  }
  return context;
};

export const LayersProvider = ({ children }) => {
  const [layers, setLayers] = useState([]);
  const [activeLayerIndex, setActiveLayerIndex] = useState(0);
  const [viewMode, setViewMode] = useState('normal');
  const [verticalSpacing, setVerticalSpacing] = useState(0.5);
  const [strataDimensions, setStrataDimensions] = useState({ width: 16.4, depth: 16.4 });
  
  const defaultSoilTypes = useMemo(() => [
    { name: "Topsoil", color: "#3b2e1e", description: "Dark, fertile surface layer with organic matter" },
    { name: "Clay Layer", color: "#5e4b37", description: "Dense, water-retaining layer with fine particles" },
    { name: "Sandy Layer", color: "#9b8569", description: "Loose, granular texture with good drainage" },
    { name: "Bedrock", color: "#c4c4c4", description: "Solid rock layer beneath soil horizons" },
    { name: "Gravelly Soil", color: "#a1917e", description: "Contains many small stones and pebbles" },
  ], []);

  const addLayer = useCallback(() => {
    setLayers(prevLayers => {
      const layerIndex = prevLayers.length;
      const defaultLayer = defaultSoilTypes[layerIndex % defaultSoilTypes.length];
      
      const newLayer = {
        id: `layer-${Date.now()}-${layerIndex}-${Math.random().toString(36).substr(2, 9)}`,
        name: defaultLayer.name,
        color: defaultLayer.color,
        description: defaultLayer.description,
        depth: layerIndex === 0 ? 3.28 : 6.56
      };
      
      const updatedLayers = [...prevLayers, newLayer];
      setActiveLayerIndex(updatedLayers.length - 1);
      return updatedLayers;
    });
  }, [defaultSoilTypes]);

  const removeLayer = useCallback((index) => {
    setLayers(prevLayers => {
      const updatedLayers = prevLayers.filter((_, i) => i !== index);
      
      // Update active layer index
      if (activeLayerIndex >= updatedLayers.length) {
        setActiveLayerIndex(Math.max(0, updatedLayers.length - 1));
      }
      
      return updatedLayers;
    });
  }, [activeLayerIndex]);

  const updateLayer = useCallback((index, property, value) => {
    setLayers(prevLayers => {
      const updatedLayers = [...prevLayers];
      
      if (updatedLayers[index]) {
        if (property === 'depth') {
          const numericValue = parseFloat(value);
          updatedLayers[index] = { 
            ...updatedLayers[index], 
            [property]: isNaN(numericValue) || numericValue < 0.1 ? 0.1 : numericValue 
          };
        } else {
          updatedLayers[index] = { ...updatedLayers[index], [property]: value };
        }
      }
      
      return updatedLayers;
    });
  }, []);

  const updateStrataDimensions = useCallback((dimension, value) => {
    const numValue = parseFloat(value);
    if (isNaN(numValue) || numValue <= 0) return;
    
    setStrataDimensions(prev => ({
      ...prev,
      [dimension]: numValue
    }));
  }, []);

  const totalProfileDepth = useMemo(() => {
    return layers.length > 0 
      ? layers.reduce((total, layer) => total + (parseFloat(layer.depth) || 1), 0).toFixed(1)
      : 0;
  }, [layers]);

  const value = {
    layers,
    activeLayerIndex,
    setActiveLayerIndex,
    viewMode,
    setViewMode,
    verticalSpacing,
    setVerticalSpacing,
    strataDimensions,
    updateStrataDimensions,
    addLayer,
    removeLayer,
    updateLayer,
    totalProfileDepth,
    defaultSoilTypes
  };

  return (
    <LayersContext.Provider value={value}>
      {children}
    </LayersContext.Provider>
  );
};