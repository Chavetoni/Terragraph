// Simplified borehole types with associated colors
export const BOREHOLE_TYPES = {
  BUILDING: {
    name: 'Building Bore',
    color: '#F44336', // Red
    description: 'Building foundation investigation'
  },
  PAVEMENT: {
    name: 'Pavement Bore',
    color: '#2196F3', // Blue
    description: 'Pavement and roadway analysis'
  },
  OTHER: {
    name: 'Other',
    color: '#795548', // Brown (default for custom)
    description: 'Custom borehole type'
  }
};

export class Borehole {
  constructor(data, getSoilLayerById) {
    this.id = data.id || Date.now().toString();
    this.name = data.name || 'Untitled Borehole';
    this.x = data.x || 0;
    this.y = data.y || 0;
    this.z = data.z || 0;
    this.depth = data.depth || 32.8;
    this.totalDepth = data.totalDepth || data.depth || 32.8;
    this.surfaceElevation = data.surfaceElevation || this.y || 0; // NEW: Surface elevation for 3D modeling
    this.layers = this._initializeLayers(data.layers || [], this.surfaceElevation);
    this.type = data.type || 'OTHER';
    this.color = data.color || BOREHOLE_TYPES[this.type]?.color || BOREHOLE_TYPES.OTHER.color;
    this.diameter = data.diameter || 0.49; // 0.49ft default diameter (15cm)
    
    // Water Table Properties
    this.waterTableDepth = data.waterTableDepth || null; // Depth below surface (feet)
    this.waterTableElevation = data.waterTableElevation || null; // Absolute elevation
    this.waterTableEncountered = data.waterTableEncountered !== undefined ? data.waterTableEncountered : false;
    this.waterTableConfidence = data.waterTableConfidence || 1.0; // 0-1 confidence level
    this.seasonalVariation = data.seasonalVariation || null; // +/- feet seasonal change
    this.waterTableDate = data.waterTableDate ? new Date(data.waterTableDate) : null;
    this.permeabilityData = data.permeabilityData || null; // For hydrogeological analysis
    
    this.getSoilLayerById = getSoilLayerById;
    this.createdAt = data.createdAt ? new Date(data.createdAt) : new Date();
    this.updatedAt = new Date();
  }

  update(updatedData) {
    const updated = new Borehole({ ...this, ...updatedData }, this.getSoilLayerById);
    return updated;
  }

  getPosition() {
    return { x: this.x, y: this.y, z: this.z };
  }

  getTotalDepth() {
    return this.layers.reduce((total, layer) => total + (layer.thickness || 0), 0);
  }

  getLayerAtDepth(depth) {
    for (const layer of this.layers) {
      if (depth >= layer.from && depth < layer.to) {
        return layer;
      }
    }
    return null;
  }

  // NEW: Get absolute elevations for interpolation
  getAbsoluteLayerElevations() {
    return this.layers.map(layer => ({
      ...layer,
      topElevation: this.surfaceElevation - layer.from,
      bottomElevation: this.surfaceElevation - layer.to,
      centerElevation: this.surfaceElevation - (layer.from + layer.to) / 2
    }));
  }

  // NEW: Extract points for specific material for interpolation
  getLayerPointsForMaterial(material) {
    const matchingLayers = this.layers.filter(l => l.material === material);
    return matchingLayers.map(layer => ({
      x: this.x,        // East-West coordinate
      y: this.y,        // Surface Y coordinate (height)
      z: this.z,        // North-South coordinate
      // FIXED: Align with strata cylinder positioning (negative Y = below surface)
      topZ: -layer.from, // Negative depth from surface (feet)
      bottomZ: -layer.to, // Negative depth from surface (feet)
      thickness: layer.to - layer.from,
      material: layer.material,
      surfaceElevation: this.surfaceElevation || this.y || 0
    }));
  }

  // New method to get layers by material+color combination
  getLayerPointsForMaterialAndColor(material, color) {
    const matchingLayers = this.layers.filter(l => {
      const layerColor = l.customColor || l.color || 'default';
      const matches = l.material === material && layerColor === color;
      if (matches) {

      }
      return matches;
    });
    return matchingLayers.map(layer => ({
      x: this.x,        // East-West coordinate
      y: this.y,        // Surface Y coordinate (height)
      z: this.z,        // North-South coordinate
      topZ: -layer.from, // Negative depth from surface
      bottomZ: -layer.to, // Negative depth from surface
      thickness: layer.to - layer.from,
      material: layer.material,
      color: layer.customColor || layer.color || 'default',
      surfaceElevation: this.surfaceElevation || this.y || 0
    }));
  }

  _initializeLayers(layers, surfaceElevation) {
    return layers.map(layer => ({
      id: layer.id || Date.now().toString() + Math.random(),
      from: layer.from || 0,
      to: layer.to || 0,
      material: layer.material || 'UNKNOWN',
      thickness: layer.thickness || (layer.to - layer.from),
      // Calculate absolute elevations for 3D modeling
      topElevation: surfaceElevation - (layer.from || 0),
      bottomElevation: surfaceElevation - (layer.to || 0),
      ...layer
    }));
  }

  addLayer(layer) {
    if (!layer.from || !layer.to || !layer.material) {
      throw new Error('Layer must have from, to, and material properties');
    }
    if (layer.from >= layer.to) {
      throw new Error('Layer "from" depth must be less than "to" depth');
    }
    
    const newLayer = {
      id: layer.id || Date.now().toString() + Math.random(),
      from: layer.from,
      to: layer.to,
      material: layer.material,
      thickness: layer.to - layer.from,
      topElevation: this.surfaceElevation - layer.from,
      bottomElevation: this.surfaceElevation - layer.to
    };

    this.layers = [...this.layers, newLayer].sort((a, b) => a.from - b.from);
    this.updatedAt = new Date();
    
    const validation = this.validateLayers();
    if (!validation.isValid) {
      this.layers = this.layers.filter(l => l.id !== newLayer.id);
      throw new Error(`Layer validation failed: ${validation.errors.join(', ')}`);
    }
    
    return newLayer;
  }

  removeLayer(layerId) {
    const initialLength = this.layers.length;
    this.layers = this.layers.filter(layer => layer.id !== layerId);
    this.updatedAt = new Date();
    return this.layers.length < initialLength;
  }

  updateLayer(layerId, updates) {
    const layerIndex = this.layers.findIndex(layer => layer.id === layerId);
    if (layerIndex === -1) {
      throw new Error('Layer not found');
    }

    const updatedLayer = {
      ...this.layers[layerIndex],
      ...updates,
      id: layerId,
      thickness: (updates.to || this.layers[layerIndex].to) - (updates.from || this.layers[layerIndex].from)
    };

    if (updatedLayer.from >= updatedLayer.to) {
      throw new Error('Layer "from" depth must be less than "to" depth');
    }

    const tempLayers = [...this.layers];
    tempLayers[layerIndex] = updatedLayer;
    tempLayers.sort((a, b) => a.from - b.from);

    const originalLayers = this.layers;
    this.layers = tempLayers;
    
    const validation = this.validateLayers();
    if (!validation.isValid) {
      this.layers = originalLayers;
      throw new Error(`Layer validation failed: ${validation.errors.join(', ')}`);
    }
    
    this.updatedAt = new Date();
    return updatedLayer;
  }

  validateLayers() {
    const errors = [];
    const sortedLayers = [...this.layers].sort((a, b) => a.from - b.from);

    for (let i = 0; i < sortedLayers.length; i++) {
      const layer = sortedLayers[i];
      
      if (layer.from < 0) {
        errors.push(`Layer ${i + 1}: "from" depth cannot be negative`);
      }
      
      if (layer.to > this.totalDepth) {
        errors.push(`Layer ${i + 1}: "to" depth (${layer.to}m) exceeds borehole total depth (${this.totalDepth}m)`);
      }

      if (i > 0) {
        const prevLayer = sortedLayers[i - 1];
        if (layer.from < prevLayer.to) {
          errors.push(`Layer ${i + 1}: overlaps with previous layer`);
        }
      }
    }

    const totalLayerDepth = sortedLayers.length > 0 ? Math.max(...sortedLayers.map(l => l.to)) : 0;
    if (Math.abs(totalLayerDepth - this.totalDepth) > 0.01) {
      errors.push(`Total layer depth (${totalLayerDepth}m) does not match borehole depth (${this.totalDepth}m)`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings: this._getLayerWarnings(sortedLayers)
    };
  }

  _getLayerWarnings(sortedLayers) {
    const warnings = [];
    
    for (let i = 1; i < sortedLayers.length; i++) {
      const prevLayer = sortedLayers[i - 1];
      const currentLayer = sortedLayers[i];
      
      if (currentLayer.from > prevLayer.to) {
        warnings.push(`Gap between layer ${i} and ${i + 1}: ${prevLayer.to}m to ${currentLayer.from}m`);
      }
    }
    
    return warnings;
  }

  exportLayerData() {
    return {
      boreholeId: this.id,
      name: this.name,
      totalDepth: this.totalDepth,
      layers: this.layers.map(layer => ({
        id: layer.id,
        from: layer.from,
        to: layer.to,
        material: layer.material,
        thickness: layer.thickness
      })),
      exportedAt: new Date().toISOString()
    };
  }

  importLayerData(layerData, options = { replace: false }) {
    if (options.replace) {
      this.layers = [];
    }

    const importedLayers = layerData.layers || [];
    const errors = [];

    for (const layerDef of importedLayers) {
      try {
        this.addLayer(layerDef);
      } catch (error) {
        errors.push(`Failed to import layer ${layerDef.material}: ${error.message}`);
      }
    }

    return {
      success: errors.length === 0,
      errors,
      importedCount: importedLayers.length - errors.length
    };
  }

  static fromLegacyFormat(oldBorehole) {
    const legacyData = {
      id: oldBorehole.id,
      name: oldBorehole.name,
      x: oldBorehole.x,
      y: oldBorehole.y,
      z: oldBorehole.z,
      depth: oldBorehole.depth,
      totalDepth: oldBorehole.depth,
      type: oldBorehole.type,
      color: oldBorehole.color,
      diameter: oldBorehole.diameter,
      createdAt: oldBorehole.createdAt,
      layers: []
    };

    if (oldBorehole.layers && Array.isArray(oldBorehole.layers)) {
      let currentDepth = 0;
      legacyData.layers = oldBorehole.layers.map((layer, index) => {
        const thickness = layer.thickness || 1;
        const layerData = {
          id: layer.id || `legacy_${index}`,
          from: currentDepth,
          to: currentDepth + thickness,
          material: layer.material || 'UNKNOWN',
          thickness
        };
        currentDepth += thickness;
        return layerData;
      });
    }

    return new Borehole(legacyData);
  }

  // Water Table Methods
  setWaterTableDepth(depth, confidence = 1.0, date = null) {
    this.waterTableDepth = depth;
    this.waterTableElevation = this.surfaceElevation - depth;
    this.waterTableEncountered = depth !== null;
    this.waterTableConfidence = confidence;
    this.waterTableDate = date || new Date();
    this.updatedAt = new Date();
    return this;
  }

  setWaterTableElevation(elevation, confidence = 1.0, date = null) {
    this.waterTableElevation = elevation;
    this.waterTableDepth = this.surfaceElevation - elevation;
    this.waterTableEncountered = elevation !== null;
    this.waterTableConfidence = confidence;
    this.waterTableDate = date || new Date();
    this.updatedAt = new Date();
    return this;
  }

  getWaterTablePoint() {
    if (!this.waterTableEncountered || this.waterTableDepth === null) {
      return null;
    }
    
    return {
      x: this.x,
      y: this.y, // Surface Y coordinate (height)
      z: this.z, // North-South coordinate
      elevation: this.waterTableElevation || (this.surfaceElevation - this.waterTableDepth),
      depth: this.waterTableDepth,
      confidence: this.waterTableConfidence,
      date: this.waterTableDate,
      boreholeId: this.id
    };
  }

  hasWaterTable() {
    return this.waterTableEncountered && this.waterTableDepth !== null;
  }

  getWaterTableLayerInfo() {
    if (!this.hasWaterTable()) {
      return null;
    }

    const waterTableLayer = this.getLayerAtDepth(this.waterTableDepth);
    return {
      depth: this.waterTableDepth,
      elevation: this.waterTableElevation,
      material: waterTableLayer?.material || 'UNKNOWN',
      confidence: this.waterTableConfidence,
      seasonalVariation: this.seasonalVariation,
      permeability: this.permeabilityData
    };
  }

  validateWaterTable() {
    const errors = [];
    
    if (this.waterTableDepth !== null) {
      if (this.waterTableDepth < 0) {
        errors.push('Water table depth cannot be negative');
      }
      if (this.waterTableDepth > this.totalDepth) {
        errors.push('Water table depth exceeds borehole total depth');
      }
    }
    
    if (this.waterTableConfidence < 0 || this.waterTableConfidence > 1) {
      errors.push('Water table confidence must be between 0 and 1');
    }
    
    if (this.seasonalVariation && this.seasonalVariation < 0) {
      errors.push('Seasonal variation cannot be negative');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  clone() {
    return new Borehole({
      ...this,
      id: Date.now().toString() + Math.random(),
      name: `${this.name} (Copy)`,
      layers: this.layers.map(layer => ({ ...layer, id: Date.now().toString() + Math.random() }))
    }, this.getSoilLayerById);
  }
}