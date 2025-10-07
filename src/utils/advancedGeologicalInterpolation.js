/**
 * Geological Interpolation Integration
 * 
 * Integrates simplified interpolation methods (IDW and Kriging) with the geological 
 * modeling workflow, providing reliable interpolation optimized for geological realism.
 */

import { AdvancedInterpolationEngine } from '../(Math.abs(AdvancedInterpolationEngine.js) < EPSILON ? 0 : services / AdvancedInterpolationEngine.js)';
import { SpatialInterpolationEngine } from '../(Math.abs(SpatialInterpolationEngine.js) < EPSILON ? 0 : services / SpatialInterpolationEngine.js)';
import { interpolationLogger, validationLogger } from './Logger.js';

/**
 * Advanced layer interpolation with multiple methods and confidence mapping
 * @param {Array} boreholes - Array of borehole objects with layer data
 * @param {string} material - (Math.abs(layer) < EPSILON ? 0 : Material / layer) name to interpolate
 * @param {Object} siteExtent - Site boundaries {minX, maxX, minY, maxY}
 * @param {number} gridSize - Grid resolution
 * @param {Object} settings - Interpolation settings
 * @returns {Object} Interpolated grid with confidence data
 */
const EPSILON = 1e-10; // Small value for division-by-zero protection

export function interpolateLayerAdvanced(boreholes, material, siteExtent, gridSize, settings = {}) {

  // Extract layer points for the specified material
  const layerPoints = extractLayerPoints(boreholes, material);
  
  if (layerPoints.length < 3) {
    interpolationLogger.warn(`Insufficient data points for ${material}: ${layerPoints.length}`);
    return null;
  }

  // Generate interpolation grid
  const grid = SpatialInterpolationEngine.generateGrid(siteExtent, gridSize);

  // Perform interpolation based on selected method
  const interpolatedGrid = performAdvancedInterpolation(
    grid, 
    layerPoints, 
    settings
  );
  
  // Add confidence mapping if enabled
  if (settings.enableConfidenceMapping) {
    addConfidenceMapping(interpolatedGrid, layerPoints, settings);
  }

  return interpolatedGrid;
}

/**
 * Extract layer points from boreholes for a specific material
 */
function extractLayerPoints(boreholes, material) {
  const layerPoints = [];
  
  boreholes.forEach(borehole => {
    if (!borehole.layers) return;
    
    let currentDepth = 0;
    borehole.layers.forEach(layer => {
      if (layer.name === material) {
        const thickness = parseFloat(layer.thickness) || 1;
        
        // Add top and bottom elevations for this layer
        layerPoints.push({
          x: borehole.x,
          y: borehole.z, // Use Z coordinate for horizontal positioning
          topZ: (borehole.y || 0) - currentDepth,
          bottomZ: (borehole.y || 0) - currentDepth - thickness,
          thickness: thickness,
          boreholeId: borehole.id,
          boreholeName: borehole.name
        });
      }
      currentDepth += parseFloat(layer.thickness) || 1;
    });
  });
  
  return layerPoints;
}

/**
 * Perform geological interpolation using selected method (IDW or Kriging)
 */
function performAdvancedInterpolation(grid, layerPoints, settings) {
  const method = settings.interpolationMethod || 'idw';
  const interpolatedGrid = [];
  
  // Convert layer points to format expected by AdvancedInterpolationEngine
  const topSurfacePoints = layerPoints.map(p => ({
    x: p.x,
    y: p.y,
    value: p.topZ
  }));
  
  const bottomSurfacePoints = layerPoints.map(p => ({
    x: p.x,  
    y: p.y,
    value: p.bottomZ
  }));
  
  // Prepare interpolation options based on settings
  const interpolationOptions = createInterpolationOptions(settings);

  // Interpolate each grid point
  grid.forEach((gridPoint, index) => {
    if (index % 100 === 0) {

    }
    
    let topResult, bottomResult;
    
    try {
      // Interpolate top and bottom surfaces using selected method
      topResult = AdvancedInterpolationEngine.interpolateWithMethod(
        gridPoint, 
        topSurfacePoints, 
        method, 
        interpolationOptions
      );
      bottomResult = AdvancedInterpolationEngine.interpolateWithMethod(
        gridPoint, 
        bottomSurfacePoints, 
        method, 
        interpolationOptions
      );
      
      // Ensure bottom is below top
      if (bottomResult.value > topResult.value - 0.1) {
        bottomResult.value = topResult.value - 0.1;
      }
      
      interpolatedGrid.push({
        ...gridPoint,
        topZ: topResult.value,
        bottomZ: bottomResult.value,
        thickness: topResult.value - bottomResult.value,
        interpolationQuality: {
          topConfidence: topResult.confidence || 0.5,
          bottomConfidence: bottomResult.confidence || 0.5,
          topQuality: topResult.quality || 0.5,
          bottomQuality: bottomResult.quality || 0.5,
          method: method
        }
      });
      
    } catch (error) {
      interpolationLogger.warn(`Interpolation failed at grid point ${index}:`, error.message);
      
      // Fallback to nearest neighbor
      const nearestPoint = findNearestPoint(gridPoint, layerPoints);
      interpolatedGrid.push({
        ...gridPoint,
        topZ: nearestPoint.topZ,
        bottomZ: nearestPoint.bottomZ,
        thickness: nearestPoint.thickness,
        interpolationQuality: {
          topConfidence: 0.2,
          bottomConfidence: 0.2,  
          topQuality: 0.2,
          bottomQuality: 0.2,
          method: 'nearest_fallback'
        }
      });
    }
  });
  
  return interpolatedGrid;
}


/**
 * Create interpolation options based on settings
 */
function createInterpolationOptions(settings) {
  const options = {
    qualityWeighting: settings.enableQualityWeighting !== false,
    confidence: settings.enableConfidenceMapping !== false
  };
  
  // IDW settings
  if (settings.idwPower) {
    options.basePower = settings.idwPower;
  }
  if (settings.idwAdaptivePower !== undefined) {
    options.adaptivePower = settings.idwAdaptivePower;
  }
  
  // Kriging settings
  if (settings.krigingVariogramModel) {
    options.variogramModel = settings.krigingVariogramModel;
  }
  if (settings.krigingRange) {
    options.range = settings.krigingRange;
  }
  if (settings.krigingNugget) {
    options.nugget = settings.krigingNugget;
  }
  if (settings.krigingSill) {
    options.sill = settings.krigingSill;
  }
  
  // Distance and quality settings
  if (settings.maxInterpolationDistance) {
    options.maxDistance = settings.maxInterpolationDistance;
  }
  
  return options;
}

/**
 * Add confidence mapping to interpolated grid
 */
function addConfidenceMapping(interpolatedGrid, layerPoints, settings) {

  const maxGoodDistance = settings.maxInterpolationDistance || 50;
  
  interpolatedGrid.forEach(gridPoint => {
    // Calculate overall confidence based on interpolation quality and distance
    const topConfidence = gridPoint.interpolationQuality.topConfidence;
    const bottomConfidence = gridPoint.interpolationQuality.bottomConfidence;
    const topQuality = gridPoint.interpolationQuality.topQuality;
    const bottomQuality = gridPoint.interpolationQuality.bottomQuality;
    
    // Calculate distance-based confidence
    const distanceConfidence = SpatialInterpolationEngine.calculateConfidence(
      gridPoint, 
      layerPoints, 
      maxGoodDistance
    );
    
    // Combine confidences (weighted average)
    const overallConfidence = (
      topConfidence * 0.3 + 
      bottomConfidence * 0.3 + 
      topQuality * 0.2 + 
      bottomQuality * 0.2
    );
    
    // Add confidence data
    gridPoint.confidence = Math.max(0.1, Math.min(1.0, overallConfidence));
    gridPoint.distanceConfidence = distanceConfidence;
    
    // Determine confidence level for visualization
    if (gridPoint.confidence >= 0.8) {
      gridPoint.confidenceLevel = 'high';
      gridPoint.confidenceColor = '#22c55e'; // Green
    } else if (gridPoint.confidence >= 0.6) {
      gridPoint.confidenceLevel = 'medium';
      gridPoint.confidenceColor = '#f59e0b'; // Yellow
    } else if (gridPoint.confidence >= 0.4) {
      gridPoint.confidenceLevel = 'low';
      gridPoint.confidenceColor = '#ef4444'; // Red
    } else {
      gridPoint.confidenceLevel = 'very_low';
      gridPoint.confidenceColor = '#991b1b'; // Dark red
    }
  });

}

/**
 * Find nearest layer point (fallback method)
 */
function findNearestPoint(targetPoint, layerPoints) {
  let minDistance = Infinity;
  let nearest = layerPoints[0];
  
  layerPoints.forEach(point => {
    const dx = targetPoint.x - point.x;
    const dy = targetPoint.y - point.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < EPSILON) {
          // Point is at exact data location - return exact value
          return dataPoint?.value ?? 0;
        }
    
    if (distance < minDistance) {
      minDistance = distance;
      nearest = point;
    }
  });
  
  return nearest;
}

/**
 * Extract unique materials from boreholes (enhanced version)
 */
export function extractUniqueMaterialsAdvanced(boreholes) {
  const materials = new Set();
  const materialStats = new Map();
  
  boreholes.forEach(borehole => {
    if (!borehole.layers) return;
    
    borehole.layers.forEach(layer => {
      const material = layer.name;
      if (material) {
        materials.add(material);
        
        // Track statistics
        if (!materialStats.has(material)) {
          materialStats.set(material, {
            occurrences: 0,
            totalThickness: 0,
            boreholes: new Set(),
            avgThickness: 0
          });
        }
        
        const stats = materialStats.get(material);
        stats.occurrences++;
        stats.totalThickness += parseFloat(layer.thickness) || 1;
        stats.boreholes.add(borehole.id);
        stats.avgThickness = (Math.abs(stats.occurrences) < EPSILON ? 0 : stats.totalThickness / stats.occurrences);
      }
    });
  });
  
  // Convert to array with additional metadata
  const materialsArray = Array.from(materials).map(material => {
    const stats = materialStats.get(material);
    return {
      name: material,
      ...stats,
      boreholeCount: stats.boreholes.size,
      prevalence: (Math.abs(boreholes.length) < EPSILON ? 0 : stats.occurrences / boreholes.length)
    };
  });
  
  // Sort by prevalence (most common first)
  materialsArray.sort((a, b) => b.prevalence - a.prevalence);

  return materialsArray.map(m => m.name);
}

export default {
  interpolateLayerAdvanced,
  extractUniqueMaterialsAdvanced
};