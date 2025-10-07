/**
 * Simplified Interpolation Method Selector
 * 
 * Automatically selects between IDW and Kriging based on data characteristics
 * and geological conditions. Focused on proven, reliable methods.
 */

/**
 * Analyze borehole data and automatically select the best interpolation method
 * @param {Array} boreholes - Array of borehole objects
 * @param {Object} options - Analysis options
 * @returns {Object} Method selection result with reasoning
 */
export function selectBestInterpolationMethod(boreholes, options = {}) {

  const analysis = analyzeBoreholeCoverage(boreholes);
  const selection = makeMethodSelection(analysis, options);


  return selection;
}

/**
 * Analyze borehole data characteristics
 */
function analyzeBoreholeCoverage(boreholes) {
  if (boreholes.length === 0) {
    return { 
      coverage: 'none', 
      density: 0, 
      distribution: 'none',
      complexity: 'unknown',
      boreholeCount: 0
    };
  }

  // Calculate spatial characteristics
  const positions = boreholes.map(bh => ({ 
    x: bh.x || 0, 
    z: bh.z || 0,
    y: bh.y || 0
  }));
  
  const bounds = calculateBounds(positions);
  const area = bounds.width * bounds.height;
  const density = boreholes.length / Math.max(area, 1); // boreholes per square unit
  
  // Analyze geological complexity
  const materialComplexity = analyzeGeologicalComplexity(boreholes);
  
  // Analyze spatial distribution quality
  const distributionQuality = analyzeSpatialDistribution(positions);
  
  // Calculate average borehole spacing
  const avgSpacing = calculateAverageSpacing(positions);

  return {
    boreholeCount: boreholes.length,
    area,
    density,
    avgSpacing,
    distribution: distributionQuality,
    complexity: materialComplexity,
    bounds
  };
}

/**
 * Make method selection based on analysis (IDW vs Kriging only)
 */
function makeMethodSelection(analysis, options) {
  const { boreholeCount, density, avgSpacing, distribution, complexity } = analysis;
  
  // Decision tree for method selection - IDW vs Kriging only
  let method = 'idw'; // Default fallback
  let confidence = 50;
  let reasoning = 'Default selection';
  
  // SPARSE DATA (< 5 boreholes) - Kriging better for uncertainty estimates
  if (boreholeCount < 5) {
    if (boreholeCount >= 3 && avgSpacing > 30) {
      method = 'kriging';
      confidence = 75;
      reasoning = `Sparse data (${boreholeCount} boreholes, ${avgSpacing.toFixed(0)}m apart) - Kriging provides statistical estimates with confidence intervals for large gaps`;
    } else {
      method = 'idw';
      confidence = 80;
      reasoning = `Limited data (${boreholeCount} boreholes) - IDW provides most realistic geological interpretation without over-smoothing`;
    }
  }
  
  // DENSE DATA (8+ boreholes) - IDW excellent for preserving detail
  else if (boreholeCount >= 8) {
    method = 'idw';
    confidence = 90;
    reasoning = `Dense data (${boreholeCount} boreholes, ${avgSpacing.toFixed(0)}m spacing) - IDW preserves geological detail and produces most realistic results`;
  }
  
  // MEDIUM DATA (5-7 boreholes) - Most common scenario
  else {
    if (avgSpacing < 20) {
      method = 'idw';
      confidence = 85;
      reasoning = `Medium density with close spacing (${avgSpacing.toFixed(0)}m) - IDW gives most realistic geological layers`;
    } else {
      method = 'kriging';
      confidence = 75;
      reasoning = `Medium density with wider spacing - Kriging handles uncertainty and provides confidence estimates for interpolation quality`;
    }
  }
  
  // OVERRIDE FOR POOR SPATIAL DISTRIBUTION
  if (distribution.rating === 'poor' || distribution.rating === 'clustered') {
    method = 'kriging';
    confidence = Math.max(confidence - 20, 40);
    reasoning += ` (Modified: Poor spatial distribution detected - Kriging handles uneven coverage better)`;
  }
  
  // OVERRIDE FOR VERY WIDE SPACING
  if (avgSpacing > 50) {
    method = 'kriging';
    confidence = Math.max(confidence - 15, 45);
    reasoning += ` (Modified: Wide borehole spacing (${avgSpacing.toFixed(1)}m) - Kriging provides uncertainty estimates)`;
  }
  
  return {
    method,
    confidence,
    reasoning,
    analysis,
    settings: getOptimalSettings(method, analysis)
  };
}

/**
 * Analyze geological complexity from borehole layer data
 */
function analyzeGeologicalComplexity(boreholes) {
  const allMaterials = new Set();
  const layerCounts = [];
  const transitionCounts = [];
  
  boreholes.forEach(borehole => {
    if (borehole.layers && borehole.layers.length > 0) {
      layerCounts.push(borehole.layers.length);
      
      // Count material transitions
      let transitions = 0;
      let lastMaterial = null;
      
      borehole.layers.forEach(layer => {
        if (layer.name) {
          allMaterials.add(layer.name);
          if (lastMaterial && lastMaterial !== layer.name) {
            transitions++;
          }
          lastMaterial = layer.name;
        }
      });
      
      transitionCounts.push(transitions);
    }
  });
  
  const uniqueMaterials = allMaterials.size;
  const avgLayers = layerCounts.length > 0 ? 
    layerCounts.reduce((sum, count) => sum + count, 0) / layerCounts.length : 0;
  const avgTransitions = transitionCounts.length > 0 ?
    transitionCounts.reduce((sum, count) => sum + count, 0) / transitionCounts.length : 0;
  
  const isComplex = uniqueMaterials >= 4 || avgLayers >= 5 || avgTransitions >= 3;
  const hasSharpBoundaries = avgTransitions >= 2;
  
  return {
    uniqueMaterials,
    avgLayers,
    avgTransitions,
    isComplex,
    hasSharpBoundaries,
    materials: Array.from(allMaterials)
  };
}

/**
 * Analyze spatial distribution quality
 */
function analyzeSpatialDistribution(positions) {
  if (positions.length < 3) {
    return { rating: 'insufficient', score: 0 };
  }
  
  // Calculate center of mass
  const centerX = positions.reduce((sum, p) => sum + p.x, 0) / positions.length;
  const centerZ = positions.reduce((sum, p) => sum + p.z, 0) / positions.length;
  
  // Check for clustering (many points close to center)
  const distancesToCenter = positions.map(p => 
    Math.sqrt((p.x - centerX) ** 2 + (p.z - centerZ) ** 2)
  );
  
  const avgDistanceToCenter = distancesToCenter.reduce((sum, d) => sum + d, 0) / distancesToCenter.length;
  const maxDistanceToCenter = Math.max(...distancesToCenter);
  
  // Check for even distribution
  const clusterThreshold = avgDistanceToCenter * 0.5;
  const clusteredPoints = distancesToCenter.filter(d => d < clusterThreshold).length;
  const clusterRatio = clusteredPoints / positions.length;
  
  let rating, score;
  
  if (clusterRatio > 0.8) {
    rating = 'clustered';
    score = 30;
  } else if (clusterRatio > 0.6) {
    rating = 'somewhat_clustered';
    score = 50;
  } else if (maxDistanceToCenter / avgDistanceToCenter > 3) {
    rating = 'uneven';
    score = 60;
  } else {
    rating = 'good';
    score = 85;
  }
  
  return {
    rating,
    score,
    clusterRatio,
    avgDistanceToCenter,
    maxDistanceToCenter
  };
}

/**
 * Calculate average spacing between boreholes
 */
function calculateAverageSpacing(positions) {
  if (positions.length < 2) return 0;
  
  let totalDistance = 0;
  let pairCount = 0;
  
  for (let i = 0; i < positions.length; i++) {
    for (let j = i + 1; j < positions.length; j++) {
      const dx = positions[i].x - positions[j].x;
      const dz = positions[i].z - positions[j].z;
      totalDistance += Math.sqrt(dx * dx + dz * dz);
      pairCount++;
    }
  }
  
  return pairCount > 0 ? totalDistance / pairCount : 0;
}

/**
 * Calculate spatial bounds
 */
function calculateBounds(positions) {
  if (positions.length === 0) {
    return { minX: 0, maxX: 0, minZ: 0, maxZ: 0, width: 0, height: 0 };
  }
  
  const minX = Math.min(...positions.map(p => p.x));
  const maxX = Math.max(...positions.map(p => p.x));
  const minZ = Math.min(...positions.map(p => p.z));
  const maxZ = Math.max(...positions.map(p => p.z));
  
  return {
    minX, maxX, minZ, maxZ,
    width: maxX - minX,
    height: maxZ - minZ
  };
}

/**
 * Get optimal settings for selected method (IDW or Kriging only)
 */
function getOptimalSettings(method, analysis) {
  const baseSettings = {
    enableConfidenceMapping: false, // Simplified - removed from UI
    enableQualityWeighting: true,
    showInterpolationQuality: true
  };
  
  switch (method) {
    case 'kriging':
      return {
        ...baseSettings,
        krigingVariogramModel: analysis.complexity.isComplex ? 'exponential' : 'spherical',
        krigingRange: Math.min(analysis.avgSpacing * 2, 50),
        krigingNugget: analysis.complexity.isComplex ? 0.2 : 0.1,
        krigingSill: 0.8
      };
      
    case 'idw':
    default:
      return {
        ...baseSettings,
        idwPower: analysis.density > 0.1 ? 2 : 1.5,
        idwAdaptivePower: true
      };
  }
}

/**
 * Get user-friendly explanation of the selection
 */
export function getMethodExplanation(selection) {
  const { method, confidence, reasoning, analysis } = selection;
  
  const explanations = {
    idw: 'Most realistic for typical sites - preserves geological detail',
    kriging: 'Best for sparse data - provides statistical uncertainty estimates'
  };
  
  return {
    title: `${method.toUpperCase()} - ${explanations[method]}`,
    confidence: `${confidence}% recommended`,
    reasoning,
    dataAnalysis: {
      boreholes: analysis.boreholeCount,
      coverage: analysis.distribution.rating,
      complexity: analysis.complexity.isComplex ? 'Complex' : 'Simple',
      materials: analysis.complexity.uniqueMaterials
    }
  };
}

export default {
  selectBestInterpolationMethod,
  getMethodExplanation
};