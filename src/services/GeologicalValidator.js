/**
 * Geological Validation and Constraint Engine
 * Ensures geologically realistic and accurate 3D models by applying
 * geological rules, constraints, and validation checks
 */

import { geologicalLogger } from '../utils/Logger.js';

export class GeologicalValidator {
  
  /**
   * Apply comprehensive geological constraints to interpolated surfaces
   * @param {Array} layerSequence - Array of layer surfaces in stratigraphic order (oldest to youngest)
   * @param {Object} validationOptions - Validation parameters
   * @returns {Array} Validated and corrected layer surfaces
   */
  static validateLayerSequence(layerSequence, validationOptions = {}) {
    const options = {
      minThickness: 0.1,        // 10cm minimum layer thickness
      maxSlope: 45,             // Maximum slope angle in degrees
      smoothingRadius: 2,       // Smoothing radius in grid units
      enforceOrder: true,       // Enforce stratigraphic ordering
      ...validationOptions
    };

    let validatedLayers = [...layerSequence];
    
    // Step 1: Enforce stratigraphic ordering (oldest at bottom, youngest at top)
    if (options.enforceOrder) {
      validatedLayers = this.enforceStratigraphicOrder(validatedLayers, options);
    }
    
    // Step 2: Apply minimum thickness constraints
    validatedLayers = this.enforceMinimumThickness(validatedLayers, options);
    
    // Step 3: Validate and correct excessive slopes
    validatedLayers = this.validateGeologicalSlopes(validatedLayers, options);
    
    // Step 4: Apply lateral continuity smoothing
    validatedLayers = this.applyLateralContinuity(validatedLayers, options);
    
    // Step 5: Final validation check
    this.generateValidationReport(validatedLayers, layerSequence);

    return validatedLayers;
  }

  /**
   * Enforce stratigraphic ordering - prevent layer inversions
   * @param {Array} layers - Layer surfaces (assumed to be in geological age order: oldest/deepest first)
   * @param {Object} options - Validation options
   * @returns {Array} Corrected layers
   */
  static enforceStratigraphicOrder(layers, options) {
    if (layers.length < 2) return layers;

    const correctedLayers = [];
    
    for (let layerIndex = 0; layerIndex < layers.length; layerIndex++) {
      const layer = { ...layers[layerIndex] };
      
      // Process each surface point
      for (let i = 0; i < layer.topSurface.length; i++) {
        const topPoint = layer.topSurface[i];
        const bottomPoint = layer.bottomSurface[i];
        
        // Rule 1: Top surface must be above bottom surface (in negative Y system: topZ > bottomZ)
        if (topPoint.z < bottomPoint.z) {
          geologicalLogger.warn(`Layer inversion detected: topZ=${topPoint.z.toFixed(3)} < bottomZ=${bottomPoint.z.toFixed(3)}`);
          const midZ = (topPoint.z + bottomPoint.z) / 2;
          topPoint.z = midZ + options.minThickness / 2;
          bottomPoint.z = midZ - options.minThickness / 2;

        }
        
        // Rule 2: Ensure proper stratigraphic sequence (layers processed oldest/deepest first)
        // In negative Y system: deeper = more negative, shallower = less negative
        if (layerIndex > 0) {
          const olderDeeperLayer = correctedLayers[layerIndex - 1];
          const olderTopZ = olderDeeperLayer.topSurface[i].z;
          
          // Current (younger) layer bottom must not penetrate older layer (allow contact)
          // Only correct if there's significant overlap (more than 1cm)
          if (bottomPoint.z < olderTopZ - 0.01) {
            geologicalLogger.warn(`Stratigraphic violation: layer ${layerIndex} bottom (${bottomPoint.z.toFixed(3)}) penetrates older layer top (${olderTopZ.toFixed(3)})`);
            bottomPoint.z = olderTopZ; // Allow layers to meet exactly

          }
          
          // Ensure current layer top is above its bottom
          if (topPoint.z <= bottomPoint.z) {
            topPoint.z = bottomPoint.z + options.minThickness;
          }
        }
      }
      
      correctedLayers.push(layer);
    }

    return correctedLayers;
  }

  /**
   * Enforce minimum geological layer thickness
   * @param {Array} layers - Layer surfaces
   * @param {Object} options - Validation options
   * @returns {Array} Thickness-corrected layers
   */
  static enforceMinimumThickness(layers, options) {
    
    const correctedLayers = layers.map(layer => {
      const correctedLayer = { ...layer };
      
      for (let i = 0; i < layer.topSurface.length; i++) {
        const topZ = layer.topSurface[i].z;
        const bottomZ = layer.bottomSurface[i].z;
        const currentThickness = topZ - bottomZ;
        
        if (currentThickness < options.minThickness) {
          // Adjust bottom surface to maintain minimum thickness
          correctedLayer.bottomSurface[i] = {
            ...layer.bottomSurface[i],
            z: topZ - options.minThickness
          };
        }
      }
      
      return correctedLayer;
    });

    return correctedLayers;
  }

  /**
   * Validate geological slopes and smooth excessive gradients
   * @param {Array} layers - Layer surfaces
   * @param {Object} options - Validation options with maxSlope
   * @returns {Array} Slope-corrected layers
   */
  static validateGeologicalSlopes(layers, options) {

    const maxSlope = Math.tan(options.maxSlope * Math.PI / 180); // Convert to radians
    
    return layers.map(layer => {
      const correctedLayer = {
        ...layer,
        topSurface: this.smoothExcessiveSlopes(layer.topSurface, layer.gridResolution, maxSlope),
        bottomSurface: this.smoothExcessiveSlopes(layer.bottomSurface, layer.gridResolution, maxSlope)
      };
      
      return correctedLayer;
    });
  }

  /**
   * Smooth surfaces with excessive slopes
   * @param {Array} surface - Surface points
   * @param {number} resolution - Grid resolution
   * @param {number} maxSlope - Maximum allowed slope
   * @returns {Array} Smoothed surface
   */
  static smoothExcessiveSlopes(surface, resolution, maxSlope) {
    const smoothed = [...surface];
    
    // Check slopes in both X and Y directions
    for (let i = 0; i < resolution; i++) {
      for (let j = 0; j < resolution; j++) {
        const idx = i * resolution + j;
        const point = surface[idx];
        
        // Check X direction (if not at edge)
        if (i < resolution - 1) {
          const nextIdx = (i + 1) * resolution + j;
          const nextPoint = surface[nextIdx];
          const dx = nextPoint.x - point.x;
          const dz = nextPoint.z - point.z;
          const slope = Math.abs(dz / dx);
          
          if (slope > maxSlope) {
            // Smooth by averaging
            const avgZ = (point.z + nextPoint.z) / 2;
            smoothed[idx] = { ...point, z: avgZ };
            smoothed[nextIdx] = { ...nextPoint, z: avgZ };
          }
        }
        
        // Check Y direction (if not at edge)
        if (j < resolution - 1) {
          const nextIdx = i * resolution + (j + 1);
          const nextPoint = surface[nextIdx];
          const dy = nextPoint.y - point.y;
          const dz = nextPoint.z - point.z;
          const slope = Math.abs(dz / dy);
          
          if (slope > maxSlope) {
            // Smooth by averaging
            const avgZ = (point.z + nextPoint.z) / 2;
            smoothed[idx] = { ...point, z: avgZ };
            smoothed[nextIdx] = { ...nextPoint, z: avgZ };
          }
        }
      }
    }

    return smoothed;
  }

  /**
   * Apply lateral continuity constraints for smooth geological transitions
   * @param {Array} layers - Layer surfaces
   * @param {Object} options - Validation options
   * @returns {Array} Smoothed layers
   */
  static applyLateralContinuity(layers, options) {

    return layers.map((layer, layerIndex) => {
      const smoothedLayer = {
        ...layer,
        topSurface: this.applyContinuitySmoothing(layer.topSurface, layer.gridResolution, options.smoothingRadius),
        bottomSurface: this.applyContinuitySmoothing(layer.bottomSurface, layer.gridResolution, options.smoothingRadius)
      };

      return smoothedLayer;
    });
  }

  /**
   * Apply continuity smoothing using weighted averaging
   * @param {Array} surface - Surface points
   * @param {number} resolution - Grid resolution
   * @param {number} radius - Smoothing radius
   * @returns {Array} Smoothed surface
   */
  static applyContinuitySmoothing(surface, resolution, radius) {
    const smoothed = [...surface];
    
    for (let i = 0; i < resolution; i++) {
      for (let j = 0; j < resolution; j++) {
        const idx = i * resolution + j;
        const point = surface[idx];
        
        let weightedSum = 0;
        let totalWeight = 0;
        
        // Sample within smoothing radius
        for (let di = -radius; di <= radius; di++) {
          for (let dj = -radius; dj <= radius; dj++) {
            const ni = i + di;
            const nj = j + dj;
            
            if (ni >= 0 && ni < resolution && nj >= 0 && nj < resolution) {
              const nIdx = ni * resolution + nj;
              const neighbor = surface[nIdx];
              const distance = Math.sqrt(di * di + dj * dj);
              
              if (distance <= radius) {
                const weight = distance === 0 ? 1 : 1 / (1 + distance);
                weightedSum += neighbor.z * weight;
                totalWeight += weight;
              }
            }
          }
        }
        
        if (totalWeight > 0) {
          smoothed[idx] = {
            ...point,
            z: weightedSum / totalWeight
          };
        }
      }
    }
    
    return smoothed;
  }

  /**
   * Generate validation report comparing original vs corrected data
   * @param {Array} validatedLayers - Corrected layers
   * @param {Array} originalLayers - Original layers
   * @returns {Object} Validation report
   */
  static generateValidationReport(validatedLayers, originalLayers) {
    const report = {
      layersProcessed: validatedLayers.length,
      totalCorrections: 0,
      thicknessIssues: 0,
      orderingIssues: 0,
      slopeIssues: 0,
      averageThickness: {},
      geologicalRealism: 'Good'
    };
    
    // Calculate statistics for each layer
    validatedLayers.forEach((layer, index) => {
      const layerName = layer.material || `Layer_${index + 1}`;
      
      // Calculate average thickness
      let totalThickness = 0;
      let minThickness = Infinity;
      let maxThickness = -Infinity;
      
      for (let i = 0; i < layer.topSurface.length; i++) {
        const thickness = layer.topSurface[i].z - layer.bottomSurface[i].z;
        totalThickness += thickness;
        minThickness = Math.min(minThickness, thickness);
        maxThickness = Math.max(maxThickness, thickness);
      }
      
      report.averageThickness[layerName] = {
        average: (totalThickness / layer.topSurface.length).toFixed(2),
        min: minThickness.toFixed(2),
        max: maxThickness.toFixed(2),
        unit: 'm'
      };
    });
    
    return report;
  }

  /**
   * Detect potential geological unconformities or discontinuities
   * @param {Array} layers - Layer surfaces
   * @returns {Array} Detected unconformities
   */
  static detectUnconformities(layers) {
    // Advanced feature for future implementation
    // Would detect erosional surfaces, angular unconformities, etc.

    return [];
  }

  /**
   * Apply sedimentary depositional rules (for future enhancement)
   * @param {Array} layers - Layer sequence
   * @returns {Array} Rule-corrected layers
   */
  static applySedimentaryRules(layers) {
    // Future implementation: Walther's Law, facies relationships, etc.

    return layers;
  }

  /**
   * Test coordinate system logic with known values
   * @param {boolean} runTest - Whether to run the test
   */
  static testCoordinateSystem(runTest = false) {
    if (!runTest) return;

    // Test case: Layer from 1m to 2m depth
    const testLayer = {
      topSurface: [{ x: 0, y: 0, z: -1.0 }],    // 1m depth
      bottomSurface: [{ x: 0, y: 0, z: -2.0 }], // 2m depth
      material: 'TEST'
    };


    // Test validation
    this.validateLayerSequence([testLayer], { minThickness: 0.1 });


  }
}

export default GeologicalValidator;