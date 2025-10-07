/**
 * Depth Scale Calculator Utility
 * 
 * Provides standardized depth interval calculations for consistent scale
 * markers across the entire application (both display and export).
 * 
 * Uses professional engineering standards for depth intervals:
 * - Shallow depths (< 10ft): 2ft intervals for detailed view
 * - Medium depths (10-30ft): 5ft intervals for balanced detail
 * - Deep depths (30-100ft): 10ft intervals for clarity
 * - Very deep (100ft+): 20ft intervals for large-scale models
 */

// Engineering standard depth thresholds and corresponding intervals
const DEPTH_INTERVALS = {
  SHALLOW: { threshold: 10, interval: 2 },
  MEDIUM: { threshold: 30, interval: 5 },
  DEEP: { threshold: 100, interval: 10 },
  VERY_DEEP: { interval: 20 }
};

// Floating point precision tolerance for depth calculations
const DEPTH_PRECISION_EPSILON = 1e-10;

/**
 * Calculate appropriate depth interval based on total depth
 * @param {number} totalDepth - Total depth in feet
 * @returns {number} Interval in feet for depth markers
 */
export function calculateDepthInterval(totalDepth) {
  if (totalDepth <= 0) return DEPTH_INTERVALS.SHALLOW.interval;
  
  if (totalDepth < DEPTH_INTERVALS.SHALLOW.threshold) {
    return DEPTH_INTERVALS.SHALLOW.interval;
  } else if (totalDepth <= DEPTH_INTERVALS.MEDIUM.threshold) {
    return DEPTH_INTERVALS.MEDIUM.interval;
  } else if (totalDepth < DEPTH_INTERVALS.DEEP.threshold) {
    return DEPTH_INTERVALS.DEEP.interval;
  } else {
    return DEPTH_INTERVALS.VERY_DEEP.interval;
  }
}

/**
 * Generate depth positions for scale markers
 * @param {Object} depthRange - Object containing depth range information
 * @param {number} depthRange.totalDepth - Total depth in feet
 * @param {number} depthRange.surfaceLevel - Y position of surface (usually 0)
 * @param {number} depthRange.bottomLevel - Y position of bottom (negative)
 * @returns {Array} Array of depth position objects with depth, yPosition, and label
 */
export function generateDepthPositions(depthRange) {
  const { totalDepth, surfaceLevel = 0, bottomLevel } = depthRange;
  
  if (totalDepth <= 0) return [];
  
  const positions = [];
  const interval = calculateDepthInterval(totalDepth);
  
  // Always include surface marker
  positions.push(createDepthMarker(0, surfaceLevel));
  
  // Generate intermediate depth markers
  let currentDepth = interval;
  while (currentDepth <= totalDepth + DEPTH_PRECISION_EPSILON) {
    const yPosition = surfaceLevel - currentDepth;
    
    // Only add if within bounds and not duplicate of final marker
    if (isWithinBounds(yPosition, bottomLevel) && !isNearTotalDepth(currentDepth, totalDepth)) {
      positions.push(createDepthMarker(currentDepth, yPosition));
    }
    currentDepth += interval;
  }
  
  // Always include final depth marker
  positions.push(createDepthMarker(totalDepth, bottomLevel));
  
  return positions;
}

/**
 * Creates a depth marker object with consistent formatting
 * @param {number} depth - Depth value in feet
 * @param {number} yPosition - Y coordinate position
 * @returns {Object} Depth marker object
 */
function createDepthMarker(depth, yPosition) {
  return {
    depth,
    yPosition,
    label: `${Math.round(depth)}'`
  };
}

/**
 * Checks if Y position is within acceptable bounds
 * @param {number} yPosition - Y coordinate to check
 * @param {number} bottomLevel - Minimum allowed Y position
 * @returns {boolean} True if position is within bounds
 */
function isWithinBounds(yPosition, bottomLevel) {
  return yPosition >= (bottomLevel - DEPTH_PRECISION_EPSILON);
}

/**
 * Checks if current depth is approximately equal to total depth
 * @param {number} currentDepth - Current depth being evaluated
 * @param {number} totalDepth - Total depth of the model
 * @returns {boolean} True if depths are nearly equal
 */
function isNearTotalDepth(currentDepth, totalDepth) {
  return Math.abs(currentDepth - totalDepth) < DEPTH_PRECISION_EPSILON;
}

/**
 * Debug helper to verify interval calculations
 * @param {number} depth - Depth to test
 * @returns {Object} Debug information about interval calculation
 */
export function debugDepthInterval(depth) {
  const interval = calculateDepthInterval(depth);
  const positions = generateDepthPositions({
    totalDepth: depth,
    surfaceLevel: 0,
    bottomLevel: -depth
  });
  
  return {
    depth,
    interval,
    markerCount: positions.length,
    markers: positions.map(p => p.depth),
    expectedBehavior: `${depth}ft depth uses ${interval}ft intervals`
  };
}