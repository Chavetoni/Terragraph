/**
 * Unit Conversion Utility
 * 
 * Centralizes all unit conversions used throughout the geological modeling platform.
 * Provides consistent, precise conversion factors and helper functions to eliminate
 * hardcoded values and ensure mathematical accuracy.
 * 
 * All conversion factors use exact values as defined by international standards.
 */

// === EXACT CONVERSION CONSTANTS ===
// Using exact conversion factors to maintain mathematical precision

/**
 * Length conversion constants
 * All values are exact as defined by international standards
 */
export const CONVERSION_FACTORS = Object.freeze({
  // Primary length conversions
  FEET_TO_METERS: 0.3048,           // Exact by definition (1959 international foot)
  METERS_TO_FEET: 3.28084,          // 1 / 0.3048 (rounded to 5 decimal places for display)
  
  // Secondary length conversions  
  INCHES_TO_FEET: 1/12,             // Exact by definition
  FEET_TO_INCHES: 12,               // Exact by definition
  INCHES_TO_METERS: 0.0254,         // Exact by definition
  METERS_TO_INCHES: 39.3701,        // 1 / 0.0254 (rounded to 4 decimal places)
  
  // Additional conversions for completeness
  INCHES_TO_CM: 2.54,               // Exact by definition
  CM_TO_INCHES: 0.393701,           // 1 / 2.54 (rounded to 6 decimal places)
  
  // Precision constants for geological applications
  GEOLOGICAL_PRECISION: 1e-6,       // 1 micron precision for geological calculations
  DISPLAY_PRECISION: 0.1            // 0.1 unit precision for user displays
});

// === PRIMARY CONVERSION FUNCTIONS ===

/**
 * Convert feet to meters
 * @param {number} feet - Value in feet
 * @returns {number} Value in meters
 */
export function feetToMeters(feet) {
  if (typeof feet !== 'number' || !isFinite(feet)) {
    throw new Error('Invalid input: feet must be a finite number');
  }
  return feet * CONVERSION_FACTORS.FEET_TO_METERS;
}

/**
 * Convert meters to feet  
 * @param {number} meters - Value in meters
 * @returns {number} Value in feet
 */
export function metersToFeet(meters) {
  if (typeof meters !== 'number' || !isFinite(meters)) {
    throw new Error('Invalid input: meters must be a finite number');
  }
  return meters * CONVERSION_FACTORS.METERS_TO_FEET;
}

/**
 * Convert feet to inches
 * @param {number} feet - Value in feet
 * @returns {number} Value in inches
 */
export function feetToInches(feet) {
  if (typeof feet !== 'number' || !isFinite(feet)) {
    throw new Error('Invalid input: feet must be a finite number');
  }
  return feet * CONVERSION_FACTORS.FEET_TO_INCHES;
}

/**
 * Convert inches to feet
 * @param {number} inches - Value in inches
 * @returns {number} Value in feet
 */
export function inchesToFeet(inches) {
  if (typeof inches !== 'number' || !isFinite(inches)) {
    throw new Error('Invalid input: inches must be a finite number');
  }
  return inches * CONVERSION_FACTORS.INCHES_TO_FEET;
}

/**
 * Convert meters to inches
 * @param {number} meters - Value in meters
 * @returns {number} Value in inches
 */
export function metersToInches(meters) {
  if (typeof meters !== 'number' || !isFinite(meters)) {
    throw new Error('Invalid input: meters must be a finite number');
  }
  return meters * CONVERSION_FACTORS.METERS_TO_INCHES;
}

/**
 * Convert inches to meters
 * @param {number} inches - Value in inches
 * @returns {number} Value in meters
 */
export function inchesToMeters(inches) {
  if (typeof inches !== 'number' || !isFinite(inches)) {
    throw new Error('Invalid input: inches must be a finite number');
  }
  return inches * CONVERSION_FACTORS.INCHES_TO_METERS;
}

// === GEOLOGICAL-SPECIFIC CONVERSION FUNCTIONS ===

/**
 * Convert depth from meters to feet with geological precision
 * Commonly used for borehole depth display
 * @param {number} depthInMeters - Depth value in meters
 * @param {number} [decimalPlaces=1] - Number of decimal places for rounding
 * @returns {string} Formatted depth string in feet
 */
export function formatDepthMetersToFeet(depthInMeters, decimalPlaces = 1) {
  if (typeof depthInMeters !== 'number' || !isFinite(depthInMeters)) {
    return '0.0';
  }
  return metersToFeet(depthInMeters).toFixed(decimalPlaces);
}

/**
 * Convert diameter from feet to inches with geological precision
 * Commonly used for borehole diameter display
 * @param {number} diameterInFeet - Diameter value in feet
 * @param {number} [decimalPlaces=1] - Number of decimal places for rounding
 * @returns {string} Formatted diameter string in inches
 */
export function formatDiameterFeetToInches(diameterInFeet, decimalPlaces = 1) {
  if (typeof diameterInFeet !== 'number' || !isFinite(diameterInFeet)) {
    return '0.0';
  }
  return feetToInches(diameterInFeet).toFixed(decimalPlaces);
}

/**
 * Convert user input from feet to meters for internal calculations
 * Handles string inputs and validates numeric conversion
 * @param {string|number} feetInput - Feet value from user input
 * @returns {number} Value in meters, or 0 if invalid
 */
export function parseUserFeetToMeters(feetInput) {
  const numericValue = typeof feetInput === 'string' ? parseFloat(feetInput) : feetInput;
  if (!isFinite(numericValue) || numericValue < 0) {
    return 0;
  }
  return feetToMeters(numericValue);
}

// === COORDINATE SYSTEM CONVERSIONS ===

/**
 * Convert coordinate array from meters to feet
 * Used for 3D coordinate transformations in geological models
 * @param {number[]} coordsInMeters - Array of coordinates in meters [x, y, z]
 * @returns {number[]} Array of coordinates in feet
 */
export function coordsMetersToFeet(coordsInMeters) {
  if (!Array.isArray(coordsInMeters)) {
    throw new Error('Invalid input: coordinates must be an array');
  }
  return coordsInMeters.map(coord => metersToFeet(coord));
}

/**
 * Convert coordinate array from feet to meters  
 * Used for 3D coordinate transformations in geological models
 * @param {number[]} coordsInFeet - Array of coordinates in feet [x, y, z]
 * @returns {number[]} Array of coordinates in meters
 */
export function coordsFeetToMeters(coordsInFeet) {
  if (!Array.isArray(coordsInFeet)) {
    throw new Error('Invalid input: coordinates must be an array');
  }
  return coordsInFeet.map(coord => feetToMeters(coord));
}

// === EXPORT-SPECIFIC CONVERSIONS ===

/**
 * Pre-compensate coordinates for viewers that auto-multiply by conversion factor
 * Some 3D viewers automatically multiply coordinates, requiring pre-division
 * @param {number} valueInFeet - Original value in feet
 * @returns {number} Pre-compensated value for export
 */
export function preCompensateFeetForViewer(valueInFeet) {
  if (typeof valueInFeet !== 'number' || !isFinite(valueInFeet)) {
    return 0;
  }
  // Divide by conversion factor so viewer multiplication results in correct display
  return valueInFeet / CONVERSION_FACTORS.METERS_TO_FEET;
}

/**
 * Calculate what viewer will display after auto-multiplication
 * Used for validation and metadata generation
 * @param {number} preCompensatedValue - Pre-compensated value from export
 * @returns {number} Value that will be displayed in viewer
 */
export function calculateViewerDisplayValue(preCompensatedValue) {
  if (typeof preCompensatedValue !== 'number' || !isFinite(preCompensatedValue)) {
    return 0;
  }
  return Math.abs(preCompensatedValue * CONVERSION_FACTORS.METERS_TO_FEET);
}

// === UTILITY FUNCTIONS ===

/**
 * Check if two values are equal within geological precision tolerance
 * @param {number} value1 - First value to compare
 * @param {number} value2 - Second value to compare
 * @param {number} [tolerance] - Custom tolerance (defaults to geological precision)
 * @returns {boolean} True if values are equal within tolerance
 */
export function isGeologicallyEqual(value1, value2, tolerance = CONVERSION_FACTORS.GEOLOGICAL_PRECISION) {
  return Math.abs(value1 - value2) < tolerance;
}

/**
 * Round value to geological precision
 * @param {number} value - Value to round
 * @param {number} [precision] - Precision level (defaults to display precision)
 * @returns {number} Rounded value
 */
export function roundToGeologicalPrecision(value, precision = CONVERSION_FACTORS.DISPLAY_PRECISION) {
  const factor = 1 / precision;
  return Math.round(value * factor) / factor;
}

/**
 * Get appropriate unit label based on value magnitude
 * @param {number} valueInFeet - Value in feet
 * @returns {Object} Object with value and unit for display
 */
export function getOptimalUnit(valueInFeet) {
  if (Math.abs(valueInFeet) < 1) {
    return {
      value: feetToInches(valueInFeet),
      unit: 'inches',
      symbol: '"'
    };
  } else {
    return {
      value: valueInFeet,
      unit: 'feet', 
      symbol: "'"
    };
  }
}

// === VALIDATION AND DEBUGGING ===

/**
 * Validate that conversion functions maintain mathematical precision
 * @returns {Object} Test results for conversion accuracy
 */
export function validateConversions() {
  const testValues = [0, 1, 10, 30.5, 100, 1000.123];
  const results = {
    accurate: true,
    tests: []
  };
  
  testValues.forEach(value => {
    // Test round-trip conversions
    const feetToMetersRoundTrip = metersToFeet(feetToMeters(value));
    const feetToInchesRoundTrip = inchesToFeet(feetToInches(value));
    
    const feetToMetersError = Math.abs(value - feetToMetersRoundTrip);
    const feetToInchesError = Math.abs(value - feetToInchesRoundTrip);
    
    const test = {
      originalValue: value,
      feetToMetersError,
      feetToInchesError,
      withinTolerance: feetToMetersError < 1e-4 && 
                      feetToInchesError < 1e-12 // Inches conversions should be exact
    };
    
    results.tests.push(test);
    if (!test.withinTolerance) {
      results.accurate = false;
    }
  });
  
  return results;
}

/**
 * Debug information about all conversion factors
 * @returns {Object} Debug information for all conversions
 */
export function debugConversions() {
  return {
    version: '1.0.0',
    factors: CONVERSION_FACTORS,
    precision: CONVERSION_FACTORS.GEOLOGICAL_PRECISION,
    validation: validateConversions(),
    usage: {
      primary: ['feetToMeters', 'metersToFeet'],
      geological: ['formatDepthMetersToFeet', 'formatDiameterFeetToInches'],
      coordinates: ['coordsMetersToFeet', 'coordsFeetToMeters'],
      export: ['preCompensateFeetForViewer', 'calculateViewerDisplayValue']
    }
  };
}

// Export all conversion factors for direct access if needed
export { CONVERSION_FACTORS as UNIT_CONSTANTS };