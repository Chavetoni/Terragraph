import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { 
  STANDARD_MATERIALS, 
  MATERIAL_CATEGORIES,
  normalizeMaterialName, 
  getMaterialProperties, 
  validateMaterialSequence,
  getSuggestedMaterials,
  importCustomMaterials
} from '../utils/materialStandardization';

const StratigraphyContext = createContext();

export const useStratigraphy = () => {
  const context = useContext(StratigraphyContext);
  if (!context) {
    throw new Error('useStratigraphy must be used within StratigraphyProvider');
  }
  return context;
};

export const CORRELATION_METHODS = {
  DEPTH_BASED: 'depth_based',
  ELEVATION_BASED: 'elevation_based',
  LITHOLOGY_BASED: 'lithology_based',
  MANUAL: 'manual'
};

export const VISUALIZATION_STYLES = {
  SOLID: 'solid',
  PATTERN: 'pattern',
  GRADIENT: 'gradient',
  TEXTURED: 'textured'
};

const DEFAULT_SETTINGS = {
  correlationMethod: CORRELATION_METHODS.DEPTH_BASED,
  correlationTolerance: 0.5, // meters
  autoCorrelation: true,
  visualizationStyle: VISUALIZATION_STYLES.SOLID,
  showMaterialPatterns: true,
  showLayerLabels: true,
  colorScheme: 'standard',
  enableCustomMaterials: true,
  strictMaterialValidation: false
};

export const StratigraphyProvider = ({ children }) => {
  const [materials] = useState(STANDARD_MATERIALS);
  const [customMaterials, setCustomMaterials] = useState({});
  const [materialHistory, setMaterialHistory] = useState([]);
  const [correlationData, setCorrelationData] = useState({});
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [isProcessing, setIsProcessing] = useState(false);

  // Initialize material history with standard materials
  useEffect(() => {
    if (materialHistory.length === 0) {
      const standardKeys = Object.keys(STANDARD_MATERIALS);
      setMaterialHistory(standardKeys.slice(0, 10)); // Keep last 10 used materials
    }
  }, [materialHistory.length]);

  // Get all available materials (standard + custom)
  const getAllMaterials = useCallback(() => {
    return { ...materials, ...customMaterials };
  }, [materials, customMaterials]);

  // Normalize material name with custom materials support
  const normalizeMaterial = useCallback((input) => {
    // First try with custom materials
    const cleanInput = input?.trim().toLowerCase();
    
    // Check custom materials first
    const customMatch = Object.keys(customMaterials).find(
      key => key.toLowerCase() === cleanInput
    );
    if (customMatch) {
      return customMatch;
    }
    
    // Fall back to standard normalization
    return normalizeMaterialName(input);
  }, [customMaterials]);

  // Get material properties with custom materials support
  const getMaterialProps = useCallback((material) => {
    const allMaterials = getAllMaterials();
    if (allMaterials[material]) {
      return { ...allMaterials[material] };
    }
    return getMaterialProperties(material);
  }, [getAllMaterials]);

  // Add material to usage history
  const recordMaterialUsage = useCallback((material) => {
    setMaterialHistory(prev => {
      const filtered = prev.filter(m => m !== material);
      return [material, ...filtered].slice(0, 20); // Keep last 20
    });
  }, []);

  // Get material suggestions with history preference
  const getMaterialSuggestions = useCallback((input = '') => {
    const standardSuggestions = getSuggestedMaterials(input);
    const allMaterials = getAllMaterials();
    
    // Include custom materials in suggestions
    const customSuggestions = Object.keys(customMaterials).filter(
      material => material.toLowerCase().includes(input.toLowerCase())
    );
    
    // Prioritize recently used materials
    const historySuggestions = materialHistory.filter(
      material => material.toLowerCase().includes(input.toLowerCase()) &&
                 allMaterials[material]
    );
    
    // Combine and deduplicate
    const combined = [...new Set([
      ...historySuggestions,
      ...customSuggestions,
      ...standardSuggestions
    ])];
    
    return combined.slice(0, 8);
  }, [getAllMaterials, customMaterials, materialHistory]);

  // Add custom material
  const addCustomMaterial = useCallback((name, properties) => {
    if (!name || typeof name !== 'string') {
      throw new Error('Material name must be a non-empty string');
    }
    
    const normalizedName = name.trim().toUpperCase();
    
    if (materials[normalizedName]) {
      throw new Error('Material name conflicts with standard material');
    }
    
    const requiredProps = ['color', 'density'];
    for (const prop of requiredProps) {
      if (!properties[prop]) {
        throw new Error(`Missing required property: ${prop}`);
      }
    }
    
    const newMaterial = {
      color: properties.color,
      density: properties.density,
      pattern: properties.pattern || 'solid',
      description: properties.description || 'Custom material',
      aliases: properties.aliases || [],
      custom: true,
      createdAt: new Date().toISOString()
    };
    
    setCustomMaterials(prev => ({
      ...prev,
      [normalizedName]: newMaterial
    }));
    
    return normalizedName;
  }, [materials]);

  // Remove custom material
  const removeCustomMaterial = useCallback((materialName) => {
    setCustomMaterials(prev => {
      const updated = { ...prev };
      delete updated[materialName];
      return updated;
    });
    
    // Remove from history
    setMaterialHistory(prev => prev.filter(m => m !== materialName));
    
    return true;
  }, []);

  // Update custom material
  const updateCustomMaterial = useCallback((name, updates) => {
    if (!customMaterials[name]) {
      throw new Error('Custom material not found');
    }
    
    setCustomMaterials(prev => ({
      ...prev,
      [name]: {
        ...prev[name],
        ...updates,
        updatedAt: new Date().toISOString()
      }
    }));
    
    return true;
  }, [customMaterials]);

  // Helper function: calculate layer similarity
  const calculateLayerSimilarity = useCallback((layer1, layer2) => {
    let similarity = 0;
    
    // Material match (most important)
    if (layer1.material === layer2.material) {
      similarity += 0.6;
    } else {
      // Check if materials are in same category
      const cat1 = Object.entries(MATERIAL_CATEGORIES).find(([, materials]) => 
        materials.includes(layer1.material)
      );
      const cat2 = Object.entries(MATERIAL_CATEGORIES).find(([, materials]) => 
        materials.includes(layer2.material)
      );
      
      if (cat1 && cat2 && cat1[0] === cat2[0]) {
        similarity += 0.3;
      }
    }
    
    // Thickness similarity
    const thicknessDiff = Math.abs((layer1.thickness || 0) - (layer2.thickness || 0));
    const avgThickness = ((layer1.thickness || 0) + (layer2.thickness || 0)) / 2;
    if (avgThickness > 0) {
      const thicknessSimilarity = Math.max(0, 1 - thicknessDiff / avgThickness);
      similarity += 0.4 * thicknessSimilarity;
    }
    
    return Math.min(1, similarity);
  }, []);

  // Helper function: correlate by depth
  const correlateByDepth = useCallback((boreholes, tolerance) => {
    const correlatedLayers = [];
    
    // Group layers by similar depth ranges
    boreholes.forEach((borehole, bhIndex) => {
      if (!borehole.layers) return;
      
      borehole.layers.forEach((layer, layerIndex) => {
        const correlation = {
          id: `${borehole.id}_${layer.id}`,
          boreholeId: borehole.id,
          boreholeName: borehole.name,
          layerIndex,
          from: layer.from,
          to: layer.to,
          material: layer.material,
          thickness: layer.thickness || (layer.to - layer.from),
          correlatedLayers: []
        };
        
        // Find correlating layers in other boreholes
        boreholes.forEach((otherBorehole, otherBhIndex) => {
          if (otherBhIndex === bhIndex || !otherBorehole.layers) return;
          
          otherBorehole.layers.forEach((otherLayer, otherLayerIndex) => {
            const depthOverlap = Math.min(layer.to, otherLayer.to) - Math.max(layer.from, otherLayer.from);
            const averageThickness = (layer.thickness + otherLayer.thickness) / 2;
            
            if (depthOverlap > 0 && depthOverlap >= averageThickness * 0.5) {
              const similarity = calculateLayerSimilarity(layer, otherLayer);
              
              if (similarity >= 0.5) {
                correlation.correlatedLayers.push({
                  boreholeId: otherBorehole.id,
                  boreholeName: otherBorehole.name,
                  layerIndex: otherLayerIndex,
                  similarity,
                  depthOverlap
                });
              }
            }
          });
        });
        
        correlatedLayers.push(correlation);
      });
    });
    
    return correlatedLayers;
  }, [calculateLayerSimilarity]);

  // Correlate by elevation (placeholder)
  const correlateByElevation = useCallback((boreholes, tolerance) => {
    // Implementation would require elevation data
    return [];
  }, []);

  // Correlate by lithology (placeholder)
  const correlateByLithology = useCallback((boreholes, tolerance) => {
    // Implementation would use material properties and geological rules
    return [];
  }, []);

  // Validate material sequence
  const validateSequence = useCallback((layers) => {
    const validation = validateMaterialSequence(layers);
    
    // Add custom validation rules if strict mode is enabled
    if (settings.strictMaterialValidation) {
      const allMaterials = getAllMaterials();
      layers.forEach((layer, index) => {
        if (!allMaterials[layer.material]) {
          validation.errors.push(`Layer ${index + 1}: Unknown material "${layer.material}"`);
          validation.isValid = false;
        }
      });
    }
    
    return validation;
  }, [settings.strictMaterialValidation, getAllMaterials]);

  // Correlate layers across boreholes
  const correlateBoreholes = useCallback(async (boreholes) => {
    setIsProcessing(true);
    
    try {
      const correlations = {};
      
      switch (settings.correlationMethod) {
        case CORRELATION_METHODS.DEPTH_BASED:
          correlations.method = 'depth_based';
          correlations.data = correlateByDepth(boreholes, settings.correlationTolerance);
          break;
          
        case CORRELATION_METHODS.ELEVATION_BASED:
          correlations.method = 'elevation_based';
          correlations.data = correlateByElevation(boreholes, settings.correlationTolerance);
          break;
          
        case CORRELATION_METHODS.LITHOLOGY_BASED:
          correlations.method = 'lithology_based';
          correlations.data = correlateByLithology(boreholes, settings.correlationTolerance);
          break;
          
        default:
          correlations.method = 'manual';
          correlations.data = {};
      }
      
      correlations.processedAt = new Date().toISOString();
      correlations.boreholeCount = boreholes.length;
      
      setCorrelationData(correlations);
      return correlations;
      
    } finally {
      setIsProcessing(false);
    }
  }, [settings.correlationMethod, settings.correlationTolerance, correlateByDepth, correlateByElevation, correlateByLithology]);

  // Update settings
  const updateSettings = useCallback((newSettings) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  }, []);

  // Export stratigraphy data
  const exportStratigraphyData = useCallback(() => {
    return {
      standardMaterials: materials,
      customMaterials,
      materialHistory,
      correlationData,
      settings,
      exportedAt: new Date().toISOString(),
      version: '1.0'
    };
  }, [materials, customMaterials, materialHistory, correlationData, settings]);

  // Import stratigraphy data
  const importStratigraphyData = useCallback((data) => {
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid stratigraphy data');
    }
    
    if (data.customMaterials) {
      const result = importCustomMaterials(data.customMaterials);
      if (result.success) {
        setCustomMaterials(result.materials);
      } else {
        throw new Error(`Import failed: ${result.errors.join(', ')}`);
      }
    }
    
    if (data.materialHistory && Array.isArray(data.materialHistory)) {
      setMaterialHistory(data.materialHistory);
    }
    
    if (data.settings) {
      setSettings(prev => ({ ...prev, ...data.settings }));
    }
    
    return true;
  }, []);

  // Reset to defaults
  const resetToDefaults = useCallback(() => {
    setCustomMaterials({});
    setMaterialHistory(Object.keys(STANDARD_MATERIALS).slice(0, 10));
    setCorrelationData({});
    setSettings(DEFAULT_SETTINGS);
  }, []);

  const contextValue = {
    // State
    materials: getAllMaterials(),
    customMaterials,
    materialHistory,
    correlationData,
    settings,
    isProcessing,
    
    // Material operations
    normalizeMaterial,
    getMaterialProps,
    recordMaterialUsage,
    getMaterialSuggestions,
    addCustomMaterial,
    removeCustomMaterial,
    updateCustomMaterial,
    
    // Validation and correlation
    validateSequence,
    correlateBoreholes,
    
    // Configuration
    updateSettings,
    resetToDefaults,
    
    // Import/Export
    exportStratigraphyData,
    importStratigraphyData,
    
    // Constants
    STANDARD_MATERIALS,
    MATERIAL_CATEGORIES,
    CORRELATION_METHODS,
    VISUALIZATION_STYLES
  };

  return (
    <StratigraphyContext.Provider value={contextValue}>
      {children}
    </StratigraphyContext.Provider>
  );
};