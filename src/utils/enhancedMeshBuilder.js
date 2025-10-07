/**
 * Enhanced Mesh Builder with Confidence Visualization
 * 
 * Creates visually different 3D meshes based on interpolation method and confidence data.
 * This makes the differences between interpolation methods actually visible!
 */

// No Three.js imports needed - this module only works with raw data arrays

/**
 * Build enhanced mesh that shows interpolation differences visually
 */
export function buildEnhancedLayerMesh(interpolatedGrid, material, options = {}) {
  if (!interpolatedGrid || interpolatedGrid.length === 0) {
    throw new Error('Invalid interpolated grid data');
  }

  const {
    showConfidence = false,
    confidenceVisualization = 'color', // 'color', 'height', 'opacity'
    enhanceDetailByConfidence = false,
    interpolationMethod = 'unknown'
  } = options;


  // Check if we have confidence data
  const hasConfidenceData = interpolatedGrid.some(p => p.confidence !== undefined);

  if (hasConfidenceData && showConfidence) {
    return buildConfidenceEnhancedMesh(interpolatedGrid, material, options);
  } else {
    return buildMethodSpecificMesh(interpolatedGrid, material, interpolationMethod);
  }
}

/**
 * Build mesh with confidence data visualization
 */
function buildConfidenceEnhancedMesh(interpolatedGrid, material, options) {
  const { confidenceVisualization } = options;
  const gridSize = Math.sqrt(interpolatedGrid.length);
  
  const vertices = [];
  const faces = [];
  const colors = [];
  const uvs = [];

  // Get base material color
  const baseMaterialColor = getMaterialColor(material);
  
  // Calculate confidence statistics
  const confidenceValues = interpolatedGrid
    .filter(p => p.confidence !== undefined)
    .map(p => p.confidence);
  
  const avgConfidence = confidenceValues.reduce((sum, val) => sum + val, 0) / confidenceValues.length;
  const minConfidence = Math.min(...confidenceValues);
  const maxConfidence = Math.max(...confidenceValues);

  // Create vertices with confidence-based modifications
  interpolatedGrid.forEach((point, index) => {
    const confidence = point.confidence || 0.5;
    
    let x = point.x;
    let y = point.topZ || point.z;
    let z = point.y;
    
    // Modify based on visualization mode
    switch (confidenceVisualization) {
      case 'height':
        // Low confidence areas get "rougher" (more height variation)
        const roughness = (1 - confidence) * 0.5; // Up to 0.5m variation
        y += (Math.random() - 0.5) * roughness;
        break;
        
      case 'opacity':
        // Will be handled in material settings
        break;
        
      case 'color':
      default:
        // Color mixing will be handled below
        break;
    }
    
    vertices.push(x, y, z);
    
    // Create confidence-based colors
    const confidenceColor = getConfidenceColor(confidence);
    const mixedColor = mixColors(baseMaterialColor, confidenceColor, 0.7); // 70% material, 30% confidence
    
    colors.push(mixedColor.r, mixedColor.g, mixedColor.b);
    
    const row = Math.floor(index / gridSize);
    const col = index % gridSize;
    uvs.push(col / (gridSize - 1), row / (gridSize - 1));
  });

  // Add bottom vertices (simplified for confidence mesh)
  interpolatedGrid.forEach((point, index) => {
    const bottomElevation = point.bottomZ || (point.topZ || point.z) - (point.thickness || 1);
    vertices.push(point.x, bottomElevation, point.y);
    
    const confidence = point.confidence || 0.5;
    const confidenceColor = getConfidenceColor(confidence);
    const mixedColor = mixColors(baseMaterialColor, confidenceColor, 0.7);
    
    // Darker for bottom
    colors.push(mixedColor.r * 0.7, mixedColor.g * 0.7, mixedColor.b * 0.7);
    
    const row = Math.floor(index / gridSize);
    const col = index % gridSize;
    uvs.push(col / (gridSize - 1), row / (gridSize - 1));
  });

  // Create faces (same as standard mesh)
  createStandardFaces(faces, gridSize);

  const verticesArray = new Float32Array(vertices);
  const facesArray = new Uint16Array(faces);
  const colorsArray = new Float32Array(colors);
  const uvsArray = new Float32Array(uvs);

  return {
    vertices: verticesArray,
    faces: facesArray,
    colors: colorsArray,
    uvs: uvsArray,
    material,
    gridSize,
    vertexCount: vertices.length / 3,
    faceCount: faces.length / 3,
    enhanced: true,
    confidenceVisualization,
    confidenceStats: {
      avg: avgConfidence,
      min: minConfidence,
      max: maxConfidence,
      hasConfidence: true
    }
  };
}

/**
 * Build mesh with method-specific characteristics
 */
function buildMethodSpecificMesh(interpolatedGrid, material, method) {

  const gridSize = Math.sqrt(interpolatedGrid.length);
  const vertices = [];
  const faces = [];
  const colors = [];
  const uvs = [];

  const baseMaterialColor = getMaterialColor(material);
  
  // Method-specific modifications
  let methodColor = baseMaterialColor;
  let heightModification = 0;
  
  switch (method) {
    case 'kriging':
      // Kriging: Slightly cooler (more blue) to indicate statistical approach
      methodColor = {
        r: baseMaterialColor.r * 0.9,
        g: baseMaterialColor.g * 0.95,
        b: Math.min(1.0, baseMaterialColor.b * 1.1)
      };

      break;
      
    case 'rbf':
      // RBF: Slightly warmer (more red) to indicate basis functions
      methodColor = {
        r: Math.min(1.0, baseMaterialColor.r * 1.1),
        g: baseMaterialColor.g * 0.95,
        b: baseMaterialColor.b * 0.9
      };

      break;
      
    case 'multi_method':
      // Multi-method: Enhanced saturation to show "best of all"
      const saturationBoost = 1.2;
      methodColor = {
        r: Math.min(1.0, baseMaterialColor.r * saturationBoost),
        g: Math.min(1.0, baseMaterialColor.g * saturationBoost),
        b: Math.min(1.0, baseMaterialColor.b * saturationBoost)
      };

      break;
      
    case 'idw':
    default:
      // IDW: Keep base colors but add slight desaturation to show "basic" method
      methodColor = {
        r: baseMaterialColor.r * 0.95,
        g: baseMaterialColor.g * 0.95,
        b: baseMaterialColor.b * 0.95
      };

      break;
  }

  // Create vertices
  interpolatedGrid.forEach((point, index) => {
    vertices.push(point.x, (point.topZ || point.z) + heightModification, point.y);
    colors.push(methodColor.r, methodColor.g, methodColor.b);
    
    const row = Math.floor(index / gridSize);
    const col = index % gridSize;
    uvs.push(col / (gridSize - 1), row / (gridSize - 1));
  });

  // Add bottom vertices
  interpolatedGrid.forEach((point, index) => {
    const bottomElevation = point.bottomZ || (point.topZ || point.z) - (point.thickness || 1);
    vertices.push(point.x, bottomElevation + heightModification, point.y);
    colors.push(methodColor.r * 0.7, methodColor.g * 0.7, methodColor.b * 0.7);
    
    const row = Math.floor(index / gridSize);
    const col = index % gridSize;
    uvs.push(col / (gridSize - 1), row / (gridSize - 1));
  });

  // Create faces
  createStandardFaces(faces, gridSize);

  const verticesArray = new Float32Array(vertices);
  const facesArray = new Uint16Array(faces);
  const colorsArray = new Float32Array(colors);
  const uvsArray = new Float32Array(uvs);

  return {
    vertices: verticesArray,
    faces: facesArray,
    colors: colorsArray,
    uvs: uvsArray,
    material,
    gridSize,
    vertexCount: vertices.length / 3,
    faceCount: faces.length / 3,
    enhanced: true,
    interpolationMethod: method,
    methodSignature: true
  };
}

/**
 * Get confidence-based color
 */
function getConfidenceColor(confidence) {
  // Green for high confidence, red for low confidence
  if (confidence >= 0.8) return { r: 0.2, g: 0.8, b: 0.2 }; // Bright green
  if (confidence >= 0.6) return { r: 0.6, g: 0.8, b: 0.2 }; // Yellow-green
  if (confidence >= 0.4) return { r: 0.8, g: 0.8, b: 0.2 }; // Yellow
  if (confidence >= 0.2) return { r: 0.8, g: 0.6, b: 0.2 }; // Orange
  return { r: 0.8, g: 0.2, b: 0.2 }; // Red
}

/**
 * Mix two colors
 */
function mixColors(color1, color2, ratio1) {
  const ratio2 = 1 - ratio1;
  return {
    r: color1.r * ratio1 + color2.r * ratio2,
    g: color1.g * ratio1 + color2.g * ratio2,
    b: color1.b * ratio1 + color2.b * ratio2
  };
}

/**
 * Create standard face indices
 */
function createStandardFaces(faces, gridSize) {
  const totalGridPoints = gridSize * gridSize;
  
  // Top surface faces
  for (let i = 0; i < gridSize - 1; i++) {
    for (let j = 0; j < gridSize - 1; j++) {
      const topIdx = i * gridSize + j;
      faces.push(topIdx, topIdx + 1, topIdx + gridSize);
      faces.push(topIdx + 1, topIdx + gridSize + 1, topIdx + gridSize);
    }
  }
  
  // Bottom surface faces
  for (let i = 0; i < gridSize - 1; i++) {
    for (let j = 0; j < gridSize - 1; j++) {
      const bottomIdx = i * gridSize + j + totalGridPoints;
      faces.push(bottomIdx, bottomIdx + gridSize, bottomIdx + 1);
      faces.push(bottomIdx + 1, bottomIdx + gridSize, bottomIdx + gridSize + 1);
    }
  }
  
  // Side faces (simplified)
  for (let j = 0; j < gridSize - 1; j++) {
    const topLeft = j;
    const topRight = j + 1;
    const bottomLeft = j + totalGridPoints;
    const bottomRight = j + 1 + totalGridPoints;
    
    faces.push(topLeft, bottomLeft, topRight);
    faces.push(topRight, bottomLeft, bottomRight);
  }
}

/**
 * Standard material colors (same as original)
 */
function getMaterialColor(material) {
  const colorMap = {
    'CLAY': { r: 0.545, g: 0.271, b: 0.075 },
    'SAND': { r: 0.957, g: 0.643, b: 0.376 },
    'GRAVEL': { r: 0.627, g: 0.322, b: 0.176 },
    'ROCK': { r: 0.439, g: 0.502, b: 0.565 },
    'SILT': { r: 0.871, g: 0.722, b: 0.529 },
    'LIMESTONE': { r: 0.827, g: 0.827, b: 0.827 },
    'SANDSTONE': { r: 0.824, g: 0.706, b: 0.549 },
    'SHALE': { r: 0.502, g: 0.502, b: 0.502 },
    'GRANITE': { r: 0.663, g: 0.663, b: 0.663 },
    'TOPSOIL': { r: 0.333, g: 0.200, b: 0.067 },
    'FILL': { r: 0.600, g: 0.600, b: 0.600 }
  };

  return colorMap[material?.toUpperCase()] || { r: 0.5, g: 0.5, b: 0.5 };
}

export default {
  buildEnhancedLayerMesh
};