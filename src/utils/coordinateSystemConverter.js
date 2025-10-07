/**
 * Coordinate System Converter
 *
 * Handles conversions between different coordinate systems used in the geological modeling platform:
 * - Interpolation Space: {x: East-West, y: North-South, z: Elevation}
 * - Display Space: [X: East-West, Y: Elevation, Z: North-South] (Three.js with Y=elevation)
 * - Export Space: [X: East-West, Y: Up (standard Y-up), Z: North-South] (Standard Three.js Y-up)
 */

import { Matrix4 } from 'three';
import { TransformCompositionService } from '../services/TransformCompositionService.js';
import { Logger } from './Logger.js';

const logger = new Logger().withContext('CoordinateSystemConverter');

export class CoordinateSystemConverter {
  /**
   * Convert from interpolation space to display space
   * @param {Object} point - Point in interpolation space {x: East-West, y: North-South, z: Elevation}
   * @returns {Object} Point in display space {x: East-West, y: Elevation, z: North-South}
   */
  static interpolationToDisplay(point) {
    return {
      x: point.x,        // East-West unchanged
      y: point.z,        // Elevation → Y
      z: point.y         // North-South → Z
    };
  }

  /**
   * Convert from display space to export space (standard Three.js Y-up)
   * @param {Object} point - Point in display space {x: East-West, y: Elevation, z: North-South}
   * @param {number} elevationOffset - Base elevation to subtract (makes Y=up instead of Y=elevation)
   * @returns {Object} Point in export space {x: East-West, y: Up, z: North-South}
   */
  static displayToExport(point, elevationOffset = 0) {
    // CRITICAL FIX: Validate elevationOffset BEFORE usage to prevent coordinate corruption
    if (isNaN(elevationOffset) || !isFinite(elevationOffset)) {
      elevationOffset = 0;
    }

    // CRITICAL FIX: Preserve the spatial relationship by converting correctly
    // The key insight: geological models have negative Y vertices (below ground)
    // Site maps typically have Y=0 or positive Y (at/above ground)
    // We need to ensure both maintain their relative positions after conversion

    // Convert to Y-up coordinate system: higher elevations = positive Y
    // The geological model's negative Y (below ground) should become positive Y (above ground in Y-up)
    const exportY = (elevationOffset - point.y);
    
    return {
      x: point.x,                          // East-West unchanged
      y: exportY,                          // Convert to Y-up: elevationOffset provides reference
      z: point.z                           // North-South unchanged
    };
  }

  /**
   * Convert from export space back to display space
   * @param {Object} point - Point in export space {x: East-West, y: Up, z: North-South}
   * @param {number} elevationOffset - Base elevation to add back
   * @returns {Object} Point in display space {x: East-West, y: Elevation, z: North-South}
   */
  static exportToDisplay(point, elevationOffset = 0) {
    return {
      x: point.x,                          // East-West unchanged
      y: -point.y + elevationOffset,       // Un-invert Y and add elevation offset
      z: point.z                           // North-South unchanged
    };
  }

  /**
   * Apply site map transformations in the correct coordinate space
   * @param {Object} siteTransform - Site transform with position, rotation, scale
   * @param {string} coordinateSpace - 'display' or 'export'
   * @param {number} elevationOffset - Base elevation for coordinate conversion
   * @returns {Matrix4} Transformation matrix in the specified coordinate space
   */
  static applySiteTransform(siteTransform, coordinateSpace = 'display', elevationOffset = 0) {
    if (!siteTransform) return new Matrix4();
    
    let transformToUse = siteTransform;
    
    if (coordinateSpace === 'export' && siteTransform.position) {
      // Convert site position from display space to export space
      const exportPosition = this.displayToExport(siteTransform.position, elevationOffset);
      transformToUse = {
        ...siteTransform,
        position: exportPosition
      };
    }
    
    return TransformCompositionService.composeTransformMatrix(transformToUse);
  }

  /**
   * Convert a Three.js geometry from display coordinate system to export coordinate system
   * @param {BufferGeometry} geometry - Geometry to convert (modified in place)
   * @param {number} elevationOffset - Base elevation for conversion
   */
  static convertGeometryDisplayToExport(geometry, elevationOffset = 0) {
    if (!geometry || !geometry.attributes?.position) {
      return;
    }

    // CRITICAL FIX: Validate elevation offset to prevent NaN propagation
    if (isNaN(elevationOffset) || !isFinite(elevationOffset)) {
      elevationOffset = 0;
    }

    const positions = geometry.attributes.position.array;

    // Convert each vertex from display space to export space
    for (let i = 0; i < positions.length; i += 3) {
      const displayPoint = {
        x: positions[i],
        y: positions[i + 1], 
        z: positions[i + 2]
      };
      
      // Validate input coordinates before conversion
      const hasNaN = isNaN(displayPoint.x) || isNaN(displayPoint.y) || isNaN(displayPoint.z);
      const hasInfinite = !isFinite(displayPoint.x) || !isFinite(displayPoint.y) || !isFinite(displayPoint.z);

      if (hasNaN || hasInfinite) {
        // Skip conversion for invalid coordinates - leave them as is
        continue;
      }
      
      const exportPoint = this.displayToExport(displayPoint, elevationOffset);
      
      // Validate output coordinates
      if (isNaN(exportPoint.x) || isNaN(exportPoint.y) || isNaN(exportPoint.z) ||
          !isFinite(exportPoint.x) || !isFinite(exportPoint.y) || !isFinite(exportPoint.z)) {
        logger.error('Coordinate conversion produced invalid result:', {
          input: displayPoint,
          output: exportPoint,
          elevationOffset
        });
        continue; // Skip setting invalid coordinates
      }
      
      positions[i] = exportPoint.x;
      positions[i + 1] = exportPoint.y;
      positions[i + 2] = exportPoint.z;
    }
    
    
    geometry.attributes.position.needsUpdate = true;
    
    // Update normals if they exist (they also need coordinate system conversion)
    if (geometry.attributes.normal) {
      const normals = geometry.attributes.normal.array;

      for (let i = 0; i < normals.length; i += 3) {
        const displayNormal = {
          x: normals[i],
          y: normals[i + 1],
          z: normals[i + 2]
        };
        
        // Validate normal vectors before conversion
        if (isNaN(displayNormal.x) || isNaN(displayNormal.y) || isNaN(displayNormal.z) ||
            !isFinite(displayNormal.x) || !isFinite(displayNormal.y) || !isFinite(displayNormal.z)) {
          continue; // Skip invalid normals
        }
        
        // For normals, we need to flip Y direction for Y-up conversion
        normals[i] = displayNormal.x;      // X unchanged
        normals[i + 1] = -displayNormal.y; // Flip Y direction
        normals[i + 2] = displayNormal.z;  // Z unchanged
      }
      
      
      geometry.attributes.normal.needsUpdate = true;
    }
    
    // Recompute bounds after coordinate conversion
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
  }

  /**
   * Calculate the elevation offset for consistent Y-up conversion
   * @param {Array} boreholes - Array of borehole data
   * @param {Object} siteMap - Site map object with position information
   * @param {Object} geologicalModel - Geological model with position information
   * @returns {number} Base elevation offset (typically the highest point)
   */
  static calculateElevationOffset(boreholes, siteMap = null, geologicalModel = null) {
    let referenceElevations = [];
    
    // Method 1: Include borehole elevations
    if (boreholes && boreholes.length > 0) {
      boreholes.forEach(borehole => {
        // Calculate surface elevation (borehole Y position)
        const surfaceElevation = borehole.y || 0;
        if (typeof surfaceElevation === 'number' && !isNaN(surfaceElevation) && isFinite(surfaceElevation)) {
          referenceElevations.push(surfaceElevation);
        }
        
        // Also check layer elevations if available
        if (borehole.layers) {
          borehole.layers.forEach(layer => {
            const layerElevation = surfaceElevation - (layer.depthFrom || 0);
            if (typeof layerElevation === 'number' && !isNaN(layerElevation) && isFinite(layerElevation)) {
              referenceElevations.push(layerElevation);
            }
          });
        }
      });
    }
    
    // Method 2: Include site map Y position if available
    if (siteMap?.position?.y != null) {
      const siteMapY = siteMap.position.y;
      if (typeof siteMapY === 'number' && !isNaN(siteMapY) && isFinite(siteMapY)) {
        referenceElevations.push(siteMapY);
        // Site map Y position included in elevation calculation
      }
    }
    
    // Method 3: Include geological model base Y position if available
    if (geologicalModel?.position?.y != null) {
      const modelY = geologicalModel.position.y;
      if (typeof modelY === 'number' && !isNaN(modelY) && isFinite(modelY)) {
        referenceElevations.push(modelY);
        // Geological model Y position included in elevation calculation
      }
    }
    
    if (referenceElevations.length === 0) {
      // No valid elevations found, using 0 offset
      return 0;
    }
    
    // Use the maximum elevation as reference (surface level)
    const maxElevation = Math.max(...referenceElevations);
    
    // Calculated elevation offset with multiple reference sources
    
    return maxElevation;
  }

  /**
   * Validate coordinate system conversion
   * @param {Object} originalPoint - Point in original coordinate system
   * @param {Object} convertedPoint - Point in converted coordinate system  
   * @param {string} conversionType - Type of conversion performed
   * @returns {Object} Validation result
   */
  static validateConversion(originalPoint, convertedPoint, conversionType) {
    let isValid = true;
    const warnings = [];
    
    // Check for NaN or infinite values
    Object.values(convertedPoint).forEach((value, index) => {
      const axis = ['x', 'y', 'z'][index];
      if (isNaN(value) || !isFinite(value)) {
        isValid = false;
        warnings.push(`Invalid ${axis} coordinate after ${conversionType}: ${value}`);
      }
    });
    
    // Check for reasonable coordinate ranges (geological context)
    const maxReasonableCoord = 100000; // 100km seems reasonable for geological models
    Object.entries(convertedPoint).forEach(([axis, value]) => {
      if (Math.abs(value) > maxReasonableCoord) {
        warnings.push(`Potentially unreasonable ${axis} coordinate after ${conversionType}: ${value.toFixed(2)}`);
      }
    });
    
    return {
      isValid,
      warnings,
      originalPoint,
      convertedPoint,
      conversionType
    };
  }
}

export default CoordinateSystemConverter;