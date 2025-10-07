/**
 * Geological Sequence Engine
 * Handles variable depth strata, layer pinch-outs, and missing layers
 * for accurate geological modeling
 */

export class GeologicalSequenceEngine {
  /**
   * Build spatial index for efficient borehole lookups
   * @private
   */
  static buildSpatialIndex(boreholes) {
    const index = new Map();
    const GRID_SIZE = 10; // 10ft grid cells
    
    boreholes.forEach(bh => {
      const gridX = Math.floor(bh.x / GRID_SIZE);
      const gridY = Math.floor(bh.y / GRID_SIZE);
      const key = `${gridX},${gridY}`;
      
      if (!index.has(key)) {
        index.set(key, []);
      }
      index.get(key).push(bh);
    });
    
    return index;
  }
  
  /**
   * Get nearby boreholes using spatial index
   * @private
   */
  static getNearbyBoreholes(x, y, radius, spatialIndex) {
    const GRID_SIZE = 10;
    const gridRadius = Math.ceil(radius / GRID_SIZE);
    const centerGridX = Math.floor(x / GRID_SIZE);
    const centerGridY = Math.floor(y / GRID_SIZE);
    
    const nearby = [];
    for (let dx = -gridRadius; dx <= gridRadius; dx++) {
      for (let dy = -gridRadius; dy <= gridRadius; dy++) {
        const key = `${centerGridX + dx},${centerGridY + dy}`;
        const boreholes = spatialIndex.get(key) || [];
        nearby.push(...boreholes);
      }
    }
    
    // Filter by actual distance
    return nearby.filter(bh => {
      const dist = Math.sqrt((bh.x - x) ** 2 + (bh.y - y) ** 2);
      return dist <= radius;
    });
  }

  
  /**
   * Process geological sequence with variable depths and missing layers
   * @param {Array} boreholes - Borehole data
   * @param {Array} materials - Material types in stratigraphic order
   * @param {Object} options - Processing options
   * @returns {Object} Enhanced geological sequence data
   */
  static processVariableDepthSequence(boreholes, materials, options = {}) {
    const {
      minThickness = 0.1,         // Minimum layer thickness (10cm)
      pinchOutThreshold = 0.05,   // Threshold for layer pinch-out (5cm)
      correlationDistance = 50,   // Maximum correlation distance (50m)
      allowMissingLayers = true   // Allow layers to be missing in some boreholes
    } = options;

    const sequenceData = {
      materials: [],
      layerCorrelations: new Map(),
      pinchOutZones: new Map(),
      thicknessVariations: new Map()
    };

    // Process each material in stratigraphic order
    materials.forEach(material => {
      const materialData = this.processMaterialSequence(
        boreholes, 
        material, 
        {
          minThickness,
          pinchOutThreshold,
          correlationDistance,
          allowMissingLayers
        }
      );
      
      sequenceData.materials.push(materialData);
      sequenceData.layerCorrelations.set(material, materialData.correlations);
      sequenceData.pinchOutZones.set(material, materialData.pinchOuts);
      sequenceData.thicknessVariations.set(material, materialData.variations);
    });

    return sequenceData;
  }

  /**
   * Process a single material across all boreholes
   * @param {Array} boreholes - Borehole data  
   * @param {string} material - Material type or unique key (material_color)
   * @param {Object} options - Processing options
   * @returns {Object} Material sequence data
   */
  static processMaterialSequence(boreholes, material, options) {

    // Check if this is a unique key (format: MATERIAL_color)
    const isUniqueKey = material.includes('_');
    const baseMaterial = isUniqueKey ? material.split('_')[0] : material;
    const color = isUniqueKey ? material.split('_')[1] : 'default';

    const materialData = {
      material, // Keep the unique key as identifier
      presentInBoreholes: [],
      missingInBoreholes: [],
      correlations: [],
      pinchOuts: [],
      variations: {
        minThickness: Infinity,
        maxThickness: -Infinity,
        averageThickness: 0,
        thicknessStdDev: 0
      }
    };

    const thicknesses = [];
    const layerData = [];

    // Analyze each borehole for this material
    boreholes.forEach(borehole => {
      // Use appropriate method based on whether we have a unique key
      const layers = isUniqueKey ? 
        borehole.getLayerPointsForMaterialAndColor(baseMaterial, color) :
        borehole.getLayerPointsForMaterial(material);
      
      if (layers.length > 0) {
        materialData.presentInBoreholes.push(borehole.id);
        
        layers.forEach(layer => {
          const thickness = Math.abs(layer.topZ - layer.bottomZ);
          thicknesses.push(thickness);
          
          layerData.push({
            boreholeId: borehole.id,
            x: layer.x,
            y: layer.y,
            topZ: layer.topZ,
            bottomZ: layer.bottomZ,
            thickness,
            centerZ: (layer.topZ + layer.bottomZ) / 2
          });

          // Update thickness statistics
          materialData.variations.minThickness = Math.min(materialData.variations.minThickness, thickness);
          materialData.variations.maxThickness = Math.max(materialData.variations.maxThickness, thickness);
        });
      } else {
        materialData.missingInBoreholes.push(borehole.id);
      }
    });

    // Calculate thickness statistics
    if (thicknesses.length > 0) {
      materialData.variations.averageThickness = thicknesses.reduce((a, b) => a + b, 0) / thicknesses.length;
      
      const variance = thicknesses.reduce((sum, thickness) => {
        return sum + Math.pow(thickness - materialData.variations.averageThickness, 2);
      }, 0) / thicknesses.length;
      
      materialData.variations.thicknessStdDev = Math.sqrt(variance);
    }

    // Identify potential pinch-out zones
    materialData.pinchOuts = this.identifyPinchOutZones(layerData, options.pinchOutThreshold);

    // Generate layer correlations
    materialData.correlations = this.generateLayerCorrelations(layerData, options.correlationDistance);

    return materialData;
  }

  /**
   * Identify potential pinch-out zones where layers thin to zero
   * @param {Array} layerData - Layer data points
   * @param {number} threshold - Pinch-out thickness threshold
   * @returns {Array} Pinch-out zone locations
   */
  static identifyPinchOutZones(layerData, threshold) {
    const pinchOuts = [];

    layerData.forEach(layer => {
      if (layer.thickness <= threshold) {
        pinchOuts.push({
          x: layer.x,
          y: layer.y,
          thickness: layer.thickness,
          boreholeId: layer.boreholeId,
          type: 'pinch-out'
        });
      }
    });

    return pinchOuts;
  }

  /**
   * Generate correlations between layer occurrences
   * @param {Array} layerData - Layer data points
   * @param {number} maxDistance - Maximum correlation distance
   * @returns {Array} Layer correlations
   */
  static generateLayerCorrelations(layerData, maxDistance) {
    const correlations = [];

    for (let i = 0; i < layerData.length; i++) {
      for (let j = i + 1; j < layerData.length; j++) {
        const layer1 = layerData[i];
        const layer2 = layerData[j];

        const distance = Math.sqrt(
          Math.pow(layer1.x - layer2.x, 2) + 
          Math.pow(layer1.y - layer2.y, 2)
        );

        if (distance <= maxDistance) {
          const elevationDiff = Math.abs(layer1.centerZ - layer2.centerZ);
          const thicknessDiff = Math.abs(layer1.thickness - layer2.thickness);

          correlations.push({
            borehole1: layer1.boreholeId,
            borehole2: layer2.boreholeId,
            distance,
            elevationDifference: elevationDiff,
            thicknessDifference: thicknessDiff,
            confidence: this.calculateCorrelationConfidence(distance, elevationDiff, thicknessDiff)
          });
        }
      }
    }

    return correlations.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Calculate correlation confidence between layer occurrences
   * @param {number} distance - Spatial distance
   * @param {number} elevationDiff - Elevation difference  
   * @param {number} thicknessDiff - Thickness difference
   * @returns {number} Confidence score (0-1)
   */
  static calculateCorrelationConfidence(distance, elevationDiff, thicknessDiff) {
    // Higher confidence for:
    // - Closer spatial distance
    // - Similar elevations  
    // - Similar thicknesses
    
    const distanceFactor = Math.exp(-distance / 25); // Exponential decay with distance
    const elevationFactor = Math.exp(-elevationDiff / 2); // Penalize elevation differences
    const thicknessFactor = Math.exp(-thicknessDiff / 1); // Penalize thickness differences

    return distanceFactor * elevationFactor * thicknessFactor;
  }

  /**
   * Generate enhanced interpolation points that handle variable depths
   * @param {Object} sequenceData - Processed sequence data
   * @param {Object} extent - Site extent
   * @param {number} resolution - Grid resolution
   * @returns {Array} Enhanced interpolation points
   */
  static generateVariableDepthPoints(sequenceData, extent, resolution) {
    const enhancedPoints = [];

    sequenceData.materials.forEach(materialData => {
      const material = materialData.material;
      
      // Generate interpolation grid with pinch-out handling
      const gridPoints = this.generateAdaptiveGrid(extent, resolution, materialData.pinchOuts);
      
      gridPoints.forEach(gridPoint => {
        // Check if point is in a known pinch-out zone
        const isPinchOut = this.isInPinchOutZone(gridPoint, materialData.pinchOuts);
        
        if (!isPinchOut || materialData.variations.minThickness > 0.01) {
          enhancedPoints.push({
            material,
            x: gridPoint.x,
            y: gridPoint.y,
            isPinchOut,
            expectedThickness: this.predictThickness(gridPoint, materialData),
            confidence: this.calculatePointConfidence(gridPoint, materialData)
          });
        }
      });
    });

    return enhancedPoints;
  }

  /**
   * Generate adaptive grid that accounts for geological complexity
   * @param {Object} extent - Site boundaries
   * @param {number} baseResolution - Base grid resolution
   * @param {Array} pinchOuts - Known pinch-out locations
   * @returns {Array} Adaptive grid points
   */
  static generateAdaptiveGrid(extent, baseResolution, pinchOuts) {
    const gridPoints = [];
    const stepX = (extent.maxX - extent.minX) / (baseResolution - 1);
    const stepY = (extent.maxY - extent.minY) / (baseResolution - 1);

    for (let i = 0; i < baseResolution; i++) {
      for (let j = 0; j < baseResolution; j++) {
        const x = extent.minX + stepX * i;
        const y = extent.minY + stepY * j;

        gridPoints.push({ x, y, i, j });

        // Add extra points near pinch-out zones for better resolution
        pinchOuts.forEach(pinchOut => {
          const distance = Math.sqrt(Math.pow(x - pinchOut.x, 2) + Math.pow(y - pinchOut.y, 2));
          if (distance < 5) { // Within 5m of pinch-out
            // Add intermediate points for higher resolution
            gridPoints.push(
              { x: x + stepX * 0.5, y: y + stepY * 0.5, i: i + 0.5, j: j + 0.5, type: 'pinch-out-detail' }
            );
          }
        });
      }
    }

    return gridPoints;
  }

  /**
   * Check if a point is in a known pinch-out zone
   * @param {Object} point - Grid point to check
   * @param {Array} pinchOuts - Known pinch-out locations
   * @returns {boolean} Whether point is in pinch-out zone
   */
  static isInPinchOutZone(point, pinchOuts) {
    return pinchOuts.some(pinchOut => {
      const distance = Math.sqrt(
        Math.pow(point.x - pinchOut.x, 2) + 
        Math.pow(point.y - pinchOut.y, 2)
      );
      return distance < 2; // Within 2m of known pinch-out
    });
  }

  /**
   * Predict layer thickness at a given point
   * @param {Object} point - Point to predict thickness for
   * @param {Object} materialData - Material sequence data
   * @returns {number} Predicted thickness
   */
  static predictThickness(point, materialData) {
    // Simple prediction based on distance-weighted average
    // Could be enhanced with geological trends, structural analysis, etc.
    
    if (materialData.variations.averageThickness === 0) return 0;
    
    // For now, return average thickness
    // In a more sophisticated system, this would consider:
    // - Structural trends
    // - Depositional environment
    // - Correlation quality
    
    return materialData.variations.averageThickness;
  }

  /**
   * Calculate confidence for interpolation at a point
   * @param {Object} point - Grid point
   * @param {Object} materialData - Material data
   * @returns {number} Confidence score (0-1)
   */
  static calculatePointConfidence(point, materialData) {
    // Higher confidence when:
    // - More boreholes nearby have this material
    // - Lower thickness variability
    // - Not near pinch-out zones
    
    const baseConfidence = materialData.presentInBoreholes.length / (materialData.presentInBoreholes.length + materialData.missingInBoreholes.length);
    const variabilityPenalty = Math.min(materialData.variations.thicknessStdDev / materialData.variations.averageThickness, 0.5);
    
    return Math.max(0.1, baseConfidence - variabilityPenalty);
  }
}

export default GeologicalSequenceEngine;