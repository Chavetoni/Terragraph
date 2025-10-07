/**
 * Multi-Level Surface Generator for Enhanced Strata Visualization
 * Creates multiple internal elevation surfaces within each geological layer
 * for unprecedented accuracy in subsurface representation
 */

import { Color } from 'three';
import { AdvancedInterpolationEngine } from './AdvancedInterpolationEngine';
import { getMaterialProperties } from '../utils/materialStandardization';

export class MultiLevelSurfaceGenerator {

  /**
   * Generate multiple internal surfaces within a geological layer
   * @param {Array} topSurface - Top boundary surface
   * @param {Array} bottomSurface - Bottom boundary surface  
   * @param {Array} layerPoints - Original data points for this layer
   * @param {Object} options - Generation options
   * @returns {Object} Multi-level surface data
   */
  static generateInternalSurfaces(topSurface, bottomSurface, layerPoints, options = {}) {
    const {
      internalLevels = 3,           // Number of internal surfaces
      interpolationMethod = 'multi', // Use advanced multi-method interpolation
      adaptiveRefinement = true,    // Add more levels in complex areas
      qualityThreshold = 0.7,       // Minimum interpolation quality
      densityAnalysis = true        // Analyze data density for level placement
    } = options;

    const result = {
      allSurfaces: [],
      internalSurfaces: [],
      qualityMap: new Map(),
      complexityZones: [],
      metadata: {
        totalSurfaces: 0,
        avgQuality: 0,
        processingMethod: 'multi-level'
      }
    };

    // Add boundary surfaces
    result.allSurfaces.push({ type: 'top', surface: topSurface, level: 0 });
    result.allSurfaces.push({ type: 'bottom', surface: bottomSurface, level: 1 });

    // Analyze layer complexity for adaptive refinement
    const complexityAnalysis = this.analyzeLayerComplexity(topSurface, bottomSurface, layerPoints);
    
    // Determine optimal level placement
    const levelPositions = this.calculateOptimalLevels(
      internalLevels, 
      complexityAnalysis, 
      adaptiveRefinement
    );


    // Generate each internal level
    levelPositions.forEach((levelRatio, index) => {
      const internalSurface = this.generateInternalLevel(
        topSurface,
        bottomSurface,
        layerPoints,
        levelRatio,
        {
          interpolationMethod,
          qualityThreshold,
          complexityZones: complexityAnalysis.zones,
          levelIndex: index
        }
      );

      if (internalSurface) {
        result.internalSurfaces.push(internalSurface);
        result.allSurfaces.push({
          type: 'internal',
          surface: internalSurface.surface,
          level: levelRatio,
          quality: internalSurface.avgQuality
        });
        
        result.qualityMap.set(`level_${index}`, internalSurface.avgQuality);
      }
    });

    // Sort all surfaces by level
    result.allSurfaces.sort((a, b) => a.level - b.level);
    result.metadata.totalSurfaces = result.allSurfaces.length;
    result.metadata.avgQuality = this.calculateAverageQuality(result.qualityMap);
    result.complexityZones = complexityAnalysis.zones;

    return result;
  }

  /**
   * Analyze layer complexity to determine optimal internal level placement
   * @param {Array} topSurface - Top surface points
   * @param {Array} bottomSurface - Bottom surface points
   * @param {Array} layerPoints - Original data points
   * @returns {Object} Complexity analysis
   */
  static analyzeLayerComplexity(topSurface, bottomSurface, layerPoints) {
    const analysis = {
      zones: [],
      avgThickness: 0,
      thicknessVariation: 0,
      elevationGradient: 0,
      dataQuality: 0
    };

    // Calculate thickness variations
    const thicknesses = [];
    const elevationGradients = [];
    
    for (let i = 0; i < topSurface.length; i++) {
      const thickness = topSurface[i].z - bottomSurface[i].z;
      thicknesses.push(thickness);

      // Calculate local elevation gradient (if not at edge)
      if (i > 0 && i < topSurface.length - 1) {
        const dx = topSurface[i+1].x - topSurface[i-1].x;
        const dz = topSurface[i+1].z - topSurface[i-1].z;
        const gradient = dx !== 0 ? Math.abs(dz / dx) : 0;
        elevationGradients.push(gradient);
      }
    }

    analysis.avgThickness = thicknesses.reduce((a, b) => a + b, 0) / thicknesses.length;
    analysis.thicknessVariation = this.calculateStandardDeviation(thicknesses);
    analysis.elevationGradient = elevationGradients.length > 0 ? 
      elevationGradients.reduce((a, b) => a + b, 0) / elevationGradients.length : 0;

    // Identify complex zones (high variation areas)
    const complexityThreshold = analysis.thicknessVariation * 1.5;
    const gridResolution = Math.sqrt(topSurface.length);
    
    for (let i = 0; i < topSurface.length; i++) {
      const x = i % gridResolution;
      const y = Math.floor(i / gridResolution);
      
      // Calculate local complexity
      const localThickness = thicknesses[i];
      const thicknessDev = Math.abs(localThickness - analysis.avgThickness);
      
      if (thicknessDev > complexityThreshold) {
        analysis.zones.push({
          x: topSurface[i].x,
          y: topSurface[i].y,
          complexity: thicknessDev / analysis.avgThickness,
          thickness: localThickness,
          type: localThickness > analysis.avgThickness ? 'thick' : 'thin'
        });
      }
    }

    // Calculate data quality based on original data point density
    analysis.dataQuality = this.assessDataQuality(layerPoints, topSurface.length);

    return analysis;
  }

  /**
   * Calculate optimal positions for internal levels
   * @param {number} numLevels - Number of internal levels to create
   * @param {Object} complexityAnalysis - Layer complexity analysis
   * @param {boolean} adaptive - Whether to use adaptive placement
   * @returns {Array} Array of level ratios (0-1)
   */
  static calculateOptimalLevels(numLevels, complexityAnalysis, adaptive = true) {
    if (!adaptive) {
      // Simple even distribution
      const levels = [];
      for (let i = 1; i <= numLevels; i++) {
        levels.push(i / (numLevels + 1));
      }
      return levels;
    }

    // Adaptive distribution based on complexity
    const levels = [];
    const { thicknessVariation, avgThickness, zones } = complexityAnalysis;

    if (zones.length === 0 || thicknessVariation < 0.1) {
      // Low complexity - even distribution
      for (let i = 1; i <= numLevels; i++) {
        levels.push(i / (numLevels + 1));
      }
    } else {
      // High complexity - concentrate levels in variable areas
      const baseDistribution = [];
      for (let i = 1; i <= numLevels; i++) {
        baseDistribution.push(i / (numLevels + 1));
      }

      // Adjust distribution based on thickness variations
      const adjustedLevels = baseDistribution.map(level => {
        // Add slight bias toward areas of high thickness variation
        const complexityFactor = Math.min(thicknessVariation / avgThickness, 0.3);
        
        if (level < 0.5) {
          // Upper levels - bias slightly toward surface in complex areas
          return level - complexityFactor * level * 0.2;
        } else {
          // Lower levels - bias slightly toward bottom in complex areas  
          return level + complexityFactor * (1 - level) * 0.2;
        }
      });

      levels.push(...adjustedLevels);
    }

    return levels.sort((a, b) => a - b);
  }

  /**
   * Generate a single internal level surface
   * @param {Array} topSurface - Top boundary surface
   * @param {Array} bottomSurface - Bottom boundary surface
   * @param {Array} layerPoints - Original data points
   * @param {number} levelRatio - Position ratio (0=top, 1=bottom)
   * @param {Object} options - Generation options
   * @returns {Object} Internal surface data
   */
  static generateInternalLevel(topSurface, bottomSurface, layerPoints, levelRatio, options = {}) {
    const {
      interpolationMethod = 'multi',
      qualityThreshold = 0.7,
      complexityZones = [],
      levelIndex = 0
    } = options;

    const internalSurface = [];
    const qualityScores = [];
    const interpolationMethods = [];

    // Generate each point of the internal surface
    for (let i = 0; i < topSurface.length; i++) {
      const topPoint = topSurface[i];
      const bottomPoint = bottomSurface[i];

      // Create virtual data points for this internal level
      const virtualPoints = this.createVirtualDataPoints(
        layerPoints,
        topPoint,
        bottomPoint,
        levelRatio
      );

      // Use advanced interpolation for this point
      let interpolationResult;
      
      if (interpolationMethod === 'multi' && virtualPoints.length >= 3) {
        interpolationResult = AdvancedInterpolationEngine.multiMethodInterpolation(
          { x: topPoint.x, y: topPoint.y },
          virtualPoints,
          {
            methods: ['idw', 'kriging', 'rbf'],
            qualityWeighting: true,
            confidence: true
          }
        );
      } else {
        // Fallback to simple linear interpolation
        interpolationResult = {
          value: topPoint.z + (bottomPoint.z - topPoint.z) * levelRatio,
          confidence: 0.8,
          quality: 0.7,
          method: 'linear'
        };
      }

      // Check if we're in a complexity zone
      const inComplexZone = complexityZones.some(zone => {
        const distance = Math.sqrt(
          Math.pow(topPoint.x - zone.x, 2) + Math.pow(topPoint.y - zone.y, 2)
        );
        return distance < 5; // Within 5m of complex zone
      });

      // Apply quality threshold
      if (interpolationResult.quality < qualityThreshold && !inComplexZone) {
        // Use simple linear interpolation for low-quality areas
        interpolationResult.value = topPoint.z + (bottomPoint.z - topPoint.z) * levelRatio;
        interpolationResult.method = 'linear_fallback';
        interpolationResult.quality = 0.6;
      }

      internalSurface.push({
        x: topPoint.x,
        y: topPoint.y,
        z: interpolationResult.value,
        quality: interpolationResult.quality,
        confidence: interpolationResult.confidence,
        method: interpolationResult.method,
        inComplexZone
      });

      qualityScores.push(interpolationResult.quality);
      interpolationMethods.push(interpolationResult.method);
    }

    const avgQuality = qualityScores.reduce((a, b) => a + b, 0) / qualityScores.length;
    const methodCounts = this.countMethods(interpolationMethods);

    return {
      surface: internalSurface,
      levelRatio,
      avgQuality,
      qualityScores,
      methodCounts,
      complexZonePoints: internalSurface.filter(p => p.inComplexZone).length
    };
  }

  /**
   * Create virtual data points for internal level interpolation
   * @param {Array} originalPoints - Original layer data points
   * @param {Object} topPoint - Top surface point
   * @param {Object} bottomPoint - Bottom surface point
   * @param {number} levelRatio - Level position ratio
   * @returns {Array} Virtual data points
   */
  static createVirtualDataPoints(originalPoints, topPoint, bottomPoint, levelRatio) {
    const virtualPoints = [];
    const searchRadius = 20; // 20m search radius

    // Find nearby original data points
    const nearbyPoints = originalPoints.filter(point => {
      const distance = Math.sqrt(
        Math.pow(point.x - topPoint.x, 2) + Math.pow(point.y - topPoint.y, 2)
      );
      return distance <= searchRadius;
    });

    // Create virtual points at the internal level
    nearbyPoints.forEach(point => {
      // Calculate the elevation at this level ratio
      const virtualZ = point.topZ + (point.bottomZ - point.topZ) * levelRatio;
      
      virtualPoints.push({
        x: point.x,
        y: point.y,
        value: virtualZ,
        confidence: this.calculateVirtualPointConfidence(point, levelRatio),
        originalPoint: true
      });
    });

    // Add interpolated corner points for better coverage
    if (virtualPoints.length < 4) {
      const interpolatedZ = topPoint.z + (bottomPoint.z - topPoint.z) * levelRatio;
      virtualPoints.push({
        x: topPoint.x,
        y: topPoint.y,
        value: interpolatedZ,
        confidence: 0.5,
        originalPoint: false
      });
    }

    return virtualPoints;
  }

  /**
   * Calculate confidence for virtual data points
   * @param {Object} point - Original data point
   * @param {number} levelRatio - Level position ratio
   * @returns {number} Confidence score
   */
  static calculateVirtualPointConfidence(point, levelRatio) {
    // Higher confidence for points in the middle of the layer
    const distanceFromMiddle = Math.abs(levelRatio - 0.5);
    const positionConfidence = 1 - distanceFromMiddle * 0.6;
    
    // Consider layer thickness (thicker layers have more stable internal structure)
    const thickness = Math.abs(point.topZ - point.bottomZ);
    const thicknessConfidence = Math.min(thickness / 2, 1); // Normalize to 2m thickness
    
    return positionConfidence * 0.7 + thicknessConfidence * 0.3;
  }

  /**
   * Assess data quality based on point density
   * @param {Array} dataPoints - Original data points
   * @param {number} surfacePointCount - Number of surface points
   * @returns {number} Data quality score (0-1)
   */
  static assessDataQuality(dataPoints, surfacePointCount) {
    if (dataPoints.length === 0) return 0;
    
    const pointsPerSurfacePoint = dataPoints.length / surfacePointCount;
    const densityScore = Math.min(pointsPerSurfacePoint * 10, 1); // Normalize to 0.1 points per surface point
    
    return densityScore;
  }

  /**
   * Calculate standard deviation
   * @param {Array} values - Array of numeric values
   * @returns {number} Standard deviation
   */
  static calculateStandardDeviation(values) {
    if (values.length < 2) return 0;
    
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const squaredDiffs = values.map(value => Math.pow(value - mean, 2));
    const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
    
    return Math.sqrt(avgSquaredDiff);
  }

  /**
   * Calculate average quality from quality map
   * @param {Map} qualityMap - Map of quality scores
   * @returns {number} Average quality
   */
  static calculateAverageQuality(qualityMap) {
    if (qualityMap.size === 0) return 0;
    
    const values = Array.from(qualityMap.values());
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  /**
   * Count interpolation methods used
   * @param {Array} methods - Array of method names
   * @returns {Object} Method counts
   */
  static countMethods(methods) {
    const counts = {};
    methods.forEach(method => {
      counts[method] = (counts[method] || 0) + 1;
    });
    return counts;
  }

  /**
   * Create enhanced mesh data with multiple surfaces
   * @param {Object} multiLevelData - Multi-level surface data
   * @param {string} material - Material type
   * @param {Object} extent - Site extent
   * @param {number} resolution - Grid resolution
   * @param {Object} options - Options including contour settings
   * @returns {Object} Enhanced mesh data
   */
  static createMultiLevelMesh(multiLevelData, material, extent, resolution, options = {}) {
    const { opacity = 0.5 } = options;

    const vertices = [];
    const indices = [];
    const colors = [];
    const normals = [];
    const uvs = [];

    // Enhanced color mapping based on elevation AND quality
    const allElevations = multiLevelData.allSurfaces.flatMap(s => s.surface.map(p => p.z));
    const minElevation = Math.min(...allElevations);
    const maxElevation = Math.max(...allElevations);
    const elevationRange = maxElevation - minElevation;

    // Base material color
    const materialColor = this.getMaterialColor(material);
    let vertexIndex = 0;

    // Create vertices for all surfaces
    multiLevelData.allSurfaces.forEach((surfaceData, surfaceIndex) => {
      const surface = surfaceData.surface;
      const isInternal = surfaceData.type === 'internal';
      
      surface.forEach((point, pointIndex) => {
        // Position
        vertices.push(point.x, point.z, point.y); // x→X, z(elevation)→Y, y(N-S)→Z

        // Progressive elevation visualization for internal surfaces based on transparency
        const elevationRatio = elevationRange > 0 ? (point.z - minElevation) / elevationRange : 0.5;
        const qualityFactor = isInternal && point.quality ? point.quality : 1.0;
        const surfaceFactor = surfaceIndex / (multiLevelData.allSurfaces.length - 1);
        
        // Transparency-based contour visibility
        const contourStrength = Math.max(0, (1 - opacity) * 1.5);
        const showContours = contourStrength > 0.2;
        
        let finalBrightness, elevationColorShift;
        
        if (showContours) {
          // Create topographic contour bands that increase with transparency
          const contourBands = Math.floor(6 + contourStrength * 10); // 6-16 bands based on transparency
          const bandIndex = Math.floor(elevationRatio * contourBands);
          const bandRatio = (elevationRatio * contourBands) % 1;
          
          // Alternate contour bands with surface-specific offset
          const surfaceOffset = surfaceIndex * 2;
          const isHighBand = (bandIndex + surfaceOffset) % 2 === 0;
          
          // Base brightness varies by surface level and contour band
          const contrastRange = 0.2 + contourStrength * 0.3;
          let baseBrightness = isHighBand ? (0.6 + contrastRange) : (0.6 - contrastRange);
          
          // Make internal surfaces more distinct
          if (isInternal) {
            baseBrightness += 0.1 + (surfaceIndex % 2) * 0.15;
          }
          
          const contourBrightness = baseBrightness + (bandRatio * 0.2);
          finalBrightness = contourBrightness * qualityFactor * (0.8 + surfaceFactor * 0.1);
          
          // Color shift intensity based on transparency
          elevationColorShift = elevationRatio * contourStrength * 0.25;
        } else {
          // Solid appearance at high opacity
          let baseBrightness = 0.6 + (elevationRatio * 0.2);
          
          // Make internal surfaces slightly distinct even when solid
          if (isInternal) {
            baseBrightness += 0.05 + (surfaceIndex % 2) * 0.05;
          }
          
          finalBrightness = baseBrightness * qualityFactor * (0.9 + surfaceFactor * 0.1);
          elevationColorShift = 0; // No color shift when solid
        }
        
        colors.push(
          Math.min(1.0, materialColor.r * finalBrightness + elevationColorShift),
          Math.min(1.0, materialColor.g * finalBrightness),
          Math.min(1.0, materialColor.b * finalBrightness + (1 - elevationRatio) * contourStrength * 0.15)
        );

        // Normal (simplified - pointing up)
        normals.push(0, 1, 0);

        // UV coordinates
        uvs.push(
          (point.x - extent.minX) / (extent.maxX - extent.minX),
          (point.y - extent.minY) / (extent.maxY - extent.minY)
        );

        vertexIndex++;
      });
    });

    // Create indices connecting all surfaces (optimized for different resolutions)
    const gridSize = resolution;
    const surfaceCount = multiLevelData.allSurfaces.length;
    
    // Adaptive face generation based on surface count to prevent excessive geometry
    const maxFacesPerLayer = Math.min(gridSize * gridSize * 2, 5000); // Cap at 5000 faces per layer
    const faceReduction = Math.max(1, Math.ceil((gridSize * gridSize * 2) / maxFacesPerLayer));

    // Connect adjacent surfaces with adaptive detail
    for (let s = 0; s < surfaceCount - 1; s++) {
      const topSurfaceOffset = s * gridSize * gridSize;
      const bottomSurfaceOffset = (s + 1) * gridSize * gridSize;

      // Create faces between surfaces (with optional reduction for high-res models)
      for (let i = 0; i < gridSize - 1; i += faceReduction) {
        for (let j = 0; j < gridSize - 1; j += faceReduction) {
          const idx = i * gridSize + j;
          
          // Ensure indices are within bounds
          if (idx + gridSize + 1 < gridSize * gridSize) {
            const t1 = topSurfaceOffset + idx;
            const t2 = topSurfaceOffset + Math.min(idx + faceReduction, idx + 1);
            const t3 = topSurfaceOffset + Math.min(idx + gridSize * faceReduction, idx + gridSize);
            const t4 = topSurfaceOffset + Math.min(idx + gridSize * faceReduction + faceReduction, idx + gridSize + 1);
            
            const b1 = bottomSurfaceOffset + idx;
            const b2 = bottomSurfaceOffset + Math.min(idx + faceReduction, idx + 1);
            const b3 = bottomSurfaceOffset + Math.min(idx + gridSize * faceReduction, idx + gridSize);
            const b4 = bottomSurfaceOffset + Math.min(idx + gridSize * faceReduction + faceReduction, idx + gridSize + 1);

            // Connect corresponding quads (simplified for performance)
            // Top face of current layer segment
            indices.push(t1, t3, t2);
            indices.push(t2, t3, t4);

            // Essential side faces only (reduced complexity)
            indices.push(t1, b1, t3);
            indices.push(t3, b1, b3);
            
            indices.push(t2, t4, b2);
            indices.push(b2, t4, b4);
          }
        }
      }
    }

    return {
      vertices: new Float32Array(vertices),
      indices: new Uint32Array(indices),
      colors: new Float32Array(colors),
      normals: new Float32Array(normals),
      uvs: new Float32Array(uvs),
      material,
      vertexCount: vertices.length / 3,
      indexCount: indices.length,
      surfaceCount: multiLevelData.allSurfaces.length,
      avgQuality: multiLevelData.metadata.avgQuality,
      complexityZones: multiLevelData.complexityZones.length
    };
  }

  /**
   * Get material color using USCS materials system
   * @param {string} material - Material type
   * @returns {Object} Color object with r, g, b properties
   */
  static getMaterialColor(material) {
    const materialProps = getMaterialProperties(material);
    const color = new Color(materialProps.color);
    return {
      r: color.r,
      g: color.g,
      b: color.b
    };
  }
}

export default MultiLevelSurfaceGenerator;