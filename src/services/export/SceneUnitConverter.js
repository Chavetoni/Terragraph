/**
 * Scene Unit Conversion Utilities
 * 
 * Handles coordinate system conversions for geological model export,
 * with special pre-compensation logic for GLTF viewers that auto-convert meters to feet.
 */

import { CONVERSION_FACTORS } from '../../utils/unitConverter.js';

// Legacy unit conversion constants for backward compatibility
const UNIT_CONVERSION = {
  FEET_TO_METERS: CONVERSION_FACTORS.FEET_TO_METERS,
  METERS_TO_FEET: CONVERSION_FACTORS.METERS_TO_FEET,
  INCHES_PER_FOOT: CONVERSION_FACTORS.FEET_TO_INCHES
};

/**
 * Unit conversion utilities for consistent handling across geological exporters
 */
export class SceneUnitConverter {
  /**
   * Convert feet to meters
   * @param {number} feet - Value in feet
   * @returns {number} Value in meters
   */
  static feetToMeters(feet) {
    return feet * UNIT_CONVERSION.FEET_TO_METERS;
  }

  /**
   * Convert meters to feet
   * @param {number} meters - Value in meters
   * @returns {number} Value in feet
   */
  static metersToFeet(meters) {
    return meters * UNIT_CONVERSION.METERS_TO_FEET;
  }

  /**
   * Get conversion factor based on export options
   * Used for pre-compensation in GLTF export to counteract viewer auto-conversion
   * @param {boolean} convertToMeters - Whether to convert feet to meters
   * @returns {number} Conversion factor (1.0 for no conversion, 0.3048 for feet to meters)
   */
  static getConversionFactor(convertToMeters) {
    return convertToMeters ? UNIT_CONVERSION.FEET_TO_METERS : 1.0;
  }

  /**
   * Apply coordinate conversion to Y positions in Three.js geometry
   * Modifies geometry in-place for efficient export processing
   * @param {BufferGeometry} geometry - Three.js geometry to modify
   * @param {number} conversionFactor - Factor to multiply Y coordinates by
   * @deprecated Use convertGeometryUniformCoordinates for proper uniform scaling
   */
  static convertGeometryYCoordinates(geometry, conversionFactor) {
    // Deprecated method - use convertGeometryUniformCoordinates instead
    if (!geometry.attributes?.position) return;

    const positions = geometry.attributes.position.array;
    for (let i = 1; i < positions.length; i += 3) {
      positions[i] *= conversionFactor;
    }
    geometry.attributes.position.needsUpdate = true;
  }

  /**
   * Apply uniform coordinate conversion to all axes in Three.js geometry
   * Modifies geometry in-place for efficient export processing
   * @param {BufferGeometry} geometry - Three.js geometry to modify
   * @param {number} conversionFactor - Factor to multiply all coordinates by
   */
  static convertGeometryUniformCoordinates(geometry, conversionFactor) {
    if (!geometry.attributes?.position) return;
    
    const positions = geometry.attributes.position.array;
    // Apply conversion factor to all coordinates (X, Y, Z)
    for (let i = 0; i < positions.length; i++) {
      positions[i] *= conversionFactor;
    }
    geometry.attributes.position.needsUpdate = true;
    
    // Recompute bounds after coordinate transformation
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
  }

  /**
   * Create comprehensive unit metadata for GLTF export
   * Documents the coordinate system and conversion strategy for geological models
   * @param {boolean} convertToMeters - Whether conversion was applied
   * @returns {Object} Unit metadata object with viewer instructions
   */
  static createUnitMetadata(convertToMeters) {
    return {
      coordinate_system: convertToMeters ? 'GLTF meters (pre-compensated for viewer conversion)' : 'feet (raw)',
      original_app_units: 'feet',
      display_units: 'feet',
      conversion_applied: convertToMeters ? 'Pre-compensation: feet ÷ 3.28084 (so viewer × 3.28084 = correct feet)' : 'None (raw feet values)',
      viewer_instructions: convertToMeters 
        ? 'Coordinates pre-scaled so viewer automatic meter→feet conversion displays correctly'
        : 'Raw feet values - viewer may display incorrectly if it applies conversion',
      unit_scale_factor: convertToMeters ? UNIT_CONVERSION.FEET_TO_METERS : 1.0,
      coordinate_interpretation: convertToMeters ? 'pre_compensated_for_viewer_conversion' : 'raw_feet',
      expected_viewer_behavior: 'Viewer will multiply coordinates by ~3.28 and display as feet'
    };
  }

  /**
   * Convert depth values for geological scale consistency
   * @param {number} depthInFeet - Depth value in feet
   * @param {boolean} convertToMeters - Whether to apply conversion
   * @returns {number} Converted depth value
   */
  static convertDepthValue(depthInFeet, convertToMeters) {
    return convertToMeters ? this.feetToMeters(depthInFeet) : depthInFeet;
  }

  /**
   * Convert coordinate arrays (e.g., for geological positions)
   * @param {Array} coordinates - Array of [x, y, z] coordinates in feet
   * @param {boolean} convertToMeters - Whether to apply conversion
   * @returns {Array} Converted coordinate array
   */
  static convertCoordinateArray(coordinates, convertToMeters) {
    if (!convertToMeters) return coordinates;
    
    const conversionFactor = this.getConversionFactor(true);
    return coordinates.map(coord => coord * conversionFactor);
  }

  /**
   * Get unit labels for display in geological exports
   * @param {boolean} convertToMeters - Whether conversion is applied
   * @returns {Object} Unit labels for different coordinate types
   */
  static getUnitLabels(convertToMeters) {
    return {
      depth: convertToMeters ? 'm (pre-compensated)' : 'ft',
      distance: convertToMeters ? 'm (pre-compensated)' : 'ft',
      elevation: convertToMeters ? 'm (pre-compensated)' : 'ft',
      coordinates: convertToMeters ? 'meters (pre-compensated for feet display)' : 'feet (raw)'
    };
  }

  /**
   * Validate coordinate values for geological reasonableness
   * @param {Array} coordinates - Coordinate array to validate
   * @param {boolean} isConverted - Whether coordinates are in converted units
   * @returns {Object} Validation result with warnings if any
   */
  static validateGeologicalCoordinates(coordinates, isConverted) {
    const warnings = [];
    const maxReasonableDepth = isConverted ? 305 : 1000; // 1000ft = ~305m
    const maxReasonableSpan = isConverted ? 1609 : 5280; // 1 mile in respective units
    
    for (const coord of coordinates) {
      if (Array.isArray(coord) && coord.length >= 3) {
        // Check for unreasonable depths (Y coordinates in geological models)
        if (Math.abs(coord[1]) > maxReasonableDepth) {
          warnings.push(`Unusually large depth detected: ${coord[1].toFixed(1)}${isConverted ? 'm' : 'ft'}`);
        }
        
        // Check for unreasonable horizontal spans
        if (Math.abs(coord[0]) > maxReasonableSpan || Math.abs(coord[2]) > maxReasonableSpan) {
          warnings.push(`Large horizontal coordinate detected: [${coord[0].toFixed(1)}, ${coord[2].toFixed(1)}]${isConverted ? 'm' : 'ft'}`);
        }
      }
    }
    
    return {
      isValid: warnings.length === 0,
      warnings,
      recommendedAction: warnings.length > 0 ? 'Review coordinate system and units' : 'Coordinates appear reasonable'
    };
  }
}

// Export legacy constants for backward compatibility
export { UNIT_CONVERSION };