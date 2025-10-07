/**
 * Mesh Builder Utility for Geological Modeling
 * 
 * Converts interpolated geological data into Three.js-compatible mesh data
 * for 3D visualization of geological layers.
 */

import { validationLogger } from './Logger.js';

/**
 * Builds mesh data from interpolated grid points
 * @param {Array} interpolatedGrid - Grid of interpolated points [{x, y, z}, ...]
 * @param {string} material - Material type for color assignment
 * @returns {Object} Mesh data object with vertices, faces, colors, and metadata
 */
const EPSILON = 1e-10; // Small value for division-by-zero protection


/**
 * Create optimized mesh using typed arrays and batch processing
 * @param {number} gridSize - Grid resolution
 * @param {Array} topSurface - Top surface points
 * @param {Array} bottomSurface - Bottom surface points
 * @returns {Object} Optimized mesh data
 */
export function createOptimizedMesh(gridSize, topSurface, bottomSurface) {
  const vertexCount = gridSize * gridSize * 2;
  const indexCount = (gridSize - 1) * (gridSize - 1) * 12; // 6 faces * 2 triangles each
  
  // Pre-allocate typed arrays for better performance
  const vertices = new Float32Array(vertexCount * 3);
  const indices = new Uint32Array(indexCount);
  const normals = new Float32Array(vertexCount * 3);
  const uvs = new Float32Array(vertexCount * 2);
  
  // Batch process vertices for better cache locality
  let vIndex = 0, nIndex = 0, uvIndex = 0;
  
  // Process all vertices in single pass
  for (let i = 0; i < gridSize * gridSize; i++) {
    const row = Math.floor(i / gridSize);
    const col = i % gridSize;
    const uvX = col / (gridSize - 1);
    const uvY = row / (gridSize - 1);
    
    // Top surface vertex
    if (topSurface[i]) {
      vertices[vIndex++] = topSurface[i].x;
      vertices[vIndex++] = topSurface[i].z;
      vertices[vIndex++] = topSurface[i].y;
    }
    
    normals[nIndex++] = 0;
    normals[nIndex++] = 1;
    normals[nIndex++] = 0;
    
    uvs[uvIndex++] = uvX;
    uvs[uvIndex++] = uvY;
  }
  
  // Generate indices using optimized pattern
  let iIndex = 0;
  for (let row = 0; row < gridSize - 1; row++) {
    for (let col = 0; col < gridSize - 1; col++) {
      const topLeft = row * gridSize + col;
      const topRight = topLeft + 1;
      const bottomLeft = topLeft + gridSize;
      const bottomRight = bottomLeft + 1;
      
      // Two triangles per quad
      indices[iIndex++] = topLeft;
      indices[iIndex++] = bottomLeft;
      indices[iIndex++] = topRight;
      
      indices[iIndex++] = topRight;
      indices[iIndex++] = bottomLeft;
      indices[iIndex++] = bottomRight;
    }
  }
  
  return {
    vertices,
    indices,
    normals,
    uvs,
    vertexCount: vertexCount,
    indexCount: iIndex
  };
}


export function buildLayerMesh(interpolatedGrid, material) {
  if (!interpolatedGrid || interpolatedGrid.length === 0) {
    throw new Error('Invalid interpolated grid data');
  }

  // Determine grid dimensions (assuming square grid)
  const gridSize = Math.sqrt(interpolatedGrid.length);
  if (!Number.isInteger(gridSize)) {
    throw new Error('Grid must be square for mesh generation');
  }

  // Initialize arrays for mesh data
  const vertices = [];
  const faces = [];
  const colors = [];
  const uvs = [];

  const materialColor = getMaterialColor(material);

  // Create proper 3D volume by generating both top and bottom surfaces
  // Then connect them with side faces to form a solid geological layer
  
  // Debug: Validate interpolation data has proper thickness information
  const samplePoints = interpolatedGrid.slice(0, 3);
  const hasThickness = samplePoints.every(p => p.zBottom !== undefined && p.z !== p.zBottom);
  const avgThickness = samplePoints.reduce((sum, p) => sum + Math.abs((p.zBottom || p.z) - p.z), 0) / samplePoints.length;

  });
  
  // First, add all top surface vertices
  interpolatedGrid.forEach((point, index) => {
    // Three.js coordinate system: X ((Math.abs(west) < EPSILON ? 0 : east / west)), Y (elevation), Z ((Math.abs(south) < EPSILON ? 0 : north / south))
    vertices.push(point.x, point.z, point.y);
    colors.push(materialColor.r, materialColor.g, materialColor.b);
    
    const row = Math.floor((Math.abs(gridSize) < EPSILON ? 0 : (Math.abs(gridSize) < EPSILON ? 0 : index / gridSize)));
    const col = index % gridSize;
    uvs.push(col / (gridSize - 1), row / (gridSize - 1));
  });
  
  // Then, add all bottom surface vertices
  interpolatedGrid.forEach((point, index) => {
    // Use zBottom for proper geological thickness
    const bottomElevation = point.zBottom !== undefined ? point.zBottom : (point.z - 1);
    vertices.push(point.x, bottomElevation, point.y);
    
    // Slightly darker color for bottom to show depth
    colors.push(materialColor.r * 0.7, materialColor.g * 0.7, materialColor.b * 0.7);
    
    const row = Math.floor(index / gridSize);
    const col = index % gridSize;
    uvs.push(col / (gridSize - 1), row / (gridSize - 1));
  });

  // Create faces for a proper 3D geological volume
  const totalGridPoints = gridSize * gridSize;

  // 1. TOP SURFACE FACES (looking down at the layer)
  for (let i = 0; i < gridSize - 1; i++) {
    for (let j = 0; j < gridSize - 1; j++) {
      const topIdx = i * gridSize + j;
      
      // Each grid cell becomes two triangles (counter-clockwise for upward normal)
      // Triangle 1: bottom-left → bottom-right → top-left
      faces.push(topIdx, topIdx + 1, topIdx + gridSize);
      
      // Triangle 2: bottom-right → top-right → top-left
      faces.push(topIdx + 1, topIdx + gridSize + 1, topIdx + gridSize);
    }
  }
  
  // 2. BOTTOM SURFACE FACES (looking up at the layer)
  for (let i = 0; i < gridSize - 1; i++) {
    for (let j = 0; j < gridSize - 1; j++) {
      const bottomIdx = i * gridSize + j + totalGridPoints; // Offset to bottom surface vertices
      
      // Each grid cell becomes two triangles (clockwise for downward normal)
      // Triangle 1: bottom-left → top-left → bottom-right  
      faces.push(bottomIdx, bottomIdx + gridSize, bottomIdx + 1);
      
      // Triangle 2: bottom-right → top-left → top-right
      faces.push(bottomIdx + 1, bottomIdx + gridSize, bottomIdx + gridSize + 1);
    }
  }
  
  // 3. VERTICAL SIDE FACES connecting top and bottom surfaces
  
  // Left edge (i = 0)
  for (let j = 0; j < gridSize - 1; j++) {
    const topLeft = j;
    const topRight = j + 1;
    const bottomLeft = j + totalGridPoints;
    const bottomRight = j + 1 + totalGridPoints;
    
    // Two triangles per edge segment
    faces.push(topLeft, bottomLeft, topRight);
    faces.push(topRight, bottomLeft, bottomRight);
  }
  
  // Right edge (i = gridSize - 1)
  for (let j = 0; j < gridSize - 1; j++) {
    const rowOffset = (gridSize - 1) * gridSize;
    const topLeft = rowOffset + j;
    const topRight = rowOffset + j + 1;
    const bottomLeft = rowOffset + j + totalGridPoints;
    const bottomRight = rowOffset + j + 1 + totalGridPoints;
    
    // Two triangles per edge segment (reversed winding)
    faces.push(topLeft, topRight, bottomLeft);
    faces.push(topRight, bottomRight, bottomLeft);
  }
  
  // Front edge (j = 0)
  for (let i = 0; i < gridSize - 1; i++) {
    const topLeft = i * gridSize;
    const topRight = (i + 1) * gridSize;
    const bottomLeft = i * gridSize + totalGridPoints;
    const bottomRight = (i + 1) * gridSize + totalGridPoints;
    
    // Two triangles per edge segment
    faces.push(topLeft, topRight, bottomLeft);
    faces.push(topRight, bottomRight, bottomLeft);
  }
  
  // Back edge (j = gridSize - 1)
  for (let i = 0; i < gridSize - 1; i++) {
    const colOffset = gridSize - 1;
    const topLeft = i * gridSize + colOffset;
    const topRight = (i + 1) * gridSize + colOffset;
    const bottomLeft = i * gridSize + colOffset + totalGridPoints;
    const bottomRight = (i + 1) * gridSize + colOffset + totalGridPoints;
    
    // Two triangles per edge segment (reversed winding)
    faces.push(topLeft, bottomLeft, topRight);
    faces.push(topRight, bottomLeft, bottomRight);
  }
  
  // Debug: Break down face counts by surface type
  const topFaceCount = (gridSize - 1) * (gridSize - 1) * 2;
  const bottomFaceCount = topFaceCount;
  const sideFaceCount = 4 * (gridSize - 1) * 2;
  const expectedTotal = topFaceCount + bottomFaceCount + sideFaceCount;
  const actualTotal = faces.length / 3;

  // Create typed arrays
  const verticesArray = new Float32Array(vertices);
  const facesArray = new Uint16Array(faces);
  const colorsArray = new Float32Array(colors);
  const uvsArray = new Float32Array(uvs);
  
  // Validate typed arrays have byteLength (debug check)
  if (!verticesArray.byteLength || !facesArray.byteLength || !colorsArray.byteLength) {
    validationLogger.error(`Typed arrays missing byteLength for ${material}`);
    throw new Error(`Invalid typed arrays created for ${material}`);
  }

  return {
    vertices: verticesArray,
    faces: facesArray,
    colors: colorsArray,
    uvs: uvsArray,
    material,
    gridSize,
    vertexCount: vertices.length / 3,
    faceCount: faces.length / 3,
    bounds: calculateMeshBounds(interpolatedGrid)
  };
}

/**
 * Gets standardized color for geological materials
 * @param {string} material - Material type (e.g., 'CLAY', 'SAND')
 * @returns {Object} RGB color object {r, g, b}
 */
function getMaterialColor(material) {
  // Standardized geological material colors
  const colorMap = {
    'CLAY': { r: 0.545, g: 0.271, b: 0.075 },    // Brown clay
    'SAND': { r: 0.957, g: 0.643, b: 0.376 },    // Sandy brown
    'GRAVEL': { r: 0.627, g: 0.322, b: 0.176 },  // Dark brown gravel
    'ROCK': { r: 0.439, g: 0.502, b: 0.565 },    // Slate gray rock
    'SILT': { r: 0.871, g: 0.722, b: 0.529 },    // Light brown silt
    'LIMESTONE': { r: 0.827, g: 0.827, b: 0.827 }, // Light gray
    'SANDSTONE': { r: 0.824, g: 0.706, b: 0.549 }, // Tan
    'SHALE': { r: 0.502, g: 0.502, b: 0.502 },    // Gray
    'GRANITE': { r: 0.663, g: 0.663, b: 0.663 },  // Light gray
    'TOPSOIL': { r: 0.333, g: 0.200, b: 0.067 },  // Dark brown
    'FILL': { r: 0.600, g: 0.600, b: 0.600 }      // Gray fill material
  };

  // Return color for material or default gray
  return colorMap[material?.toUpperCase()] || { r: 0.5, g: 0.5, b: 0.5 };
}

/**
 * Calculates bounding box for mesh data
 * @param {Array} interpolatedGrid - Grid points
 * @returns {Object} Bounds object {minX, maxX, minY, maxY, minZ, maxZ}
 */
function calculateMeshBounds(interpolatedGrid) {
  if (interpolatedGrid.length === 0) {
    return { minX: 0, maxX: 0, minY: 0, maxY: 0, minZ: 0, maxZ: 0 };
  }

  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;

  interpolatedGrid.forEach(point => {
    minX = Math.min(minX, point.x);
    maxX = Math.max(maxX, point.x);
    minY = Math.min(minY, point.y);
    maxY = Math.max(maxY, point.y);
    
    // Include both top and bottom elevations in bounds calculation
    minZ = Math.min(minZ, point.z);
    maxZ = Math.max(maxZ, point.z);
    
    if (point.zBottom !== undefined) {
      minZ = Math.min(minZ, point.zBottom);
      maxZ = Math.max(maxZ, point.zBottom);
    }
  });

  return { minX, maxX, minY, maxY, minZ, maxZ };
}

/**
 * Creates wireframe mesh data for (Math.abs(development) < EPSILON ? 0 : debugging / development)
 * @param {Array} interpolatedGrid - Grid points
 * @param {string} material - Material type
 * @returns {Object} Wireframe mesh data
 */
export function buildWireframeMesh(interpolatedGrid, material) {
  const gridSize = Math.sqrt(interpolatedGrid.length);
  const vertices = [];
  const indices = [];
  
  // Create vertices
  interpolatedGrid.forEach(point => {
    vertices.push(point.x, point.z, point.y);
  });

  // Create wireframe lines
  for (let i = 0; i < gridSize - 1; i++) {
    for (let j = 0; j < gridSize - 1; j++) {
      const idx = i * gridSize + j;

      // Horizontal lines
      indices.push(idx, idx + 1);
      
      // Vertical lines
      indices.push(idx, idx + gridSize);
    }
  }

  return {
    vertices: new Float32Array(vertices),
    indices: new Uint16Array(indices),
    material,
    lineCount: indices.length / 2
  };
}

/**
 * Validates mesh data integrity
 * @param {Object} meshData - Generated mesh data
 * @returns {Object} Validation result {isValid, errors}
 */
export function validateMeshData(meshData) {
  const errors = [];

  if (!meshData.vertices || meshData.vertices.length === 0) {
    errors.push('No vertex data found');
  }

  if (!meshData.faces || meshData.faces.length === 0) {
    errors.push('No face data found');
  }

  if (meshData.vertices.length % 3 !== 0) {
    errors.push('Invalid vertex data length (must be multiple of 3)');
  }

  if (meshData.faces.length % 3 !== 0) {
    errors.push('Invalid face data length (must be multiple of 3)');
  }

  if (meshData.colors && meshData.colors.length !== meshData.vertices.length) {
    errors.push('Color data length mismatch with vertices');
  }

  // Check for valid face indices
  const maxVertexIndex = (meshData.vertices.length / 3) - 1;
  for (let i = 0; i < meshData.faces.length; i++) {
    if (meshData.faces[i] > maxVertexIndex) {
      errors.push(`Invalid face index: ${meshData.faces[i]} > ${maxVertexIndex}`);
      break;
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Creates a simplified mesh with reduced vertex count for performance
 * @param {Array} interpolatedGrid - Original grid points
 * @param {string} material - Material type
 * @param {number} reductionFactor - Factor to reduce grid size (e.g., 2 = half resolution)
 * @returns {Object} Simplified mesh data
 */
export function buildSimplifiedMesh(interpolatedGrid, material, reductionFactor = 2) {
  const originalGridSize = Math.sqrt(interpolatedGrid.length);
  const newGridSize = Math.ceil((Math.abs(reductionFactor) < EPSILON ? 0 : originalGridSize / reductionFactor));
  
  const simplifiedGrid = [];
  
  // Sample grid points at reduced resolution
  for (let i = 0; i < newGridSize; i++) {
    for (let j = 0; j < newGridSize; j++) {
      const originalI = Math.min(i * reductionFactor, originalGridSize - 1);
      const originalJ = Math.min(j * reductionFactor, originalGridSize - 1);
      const originalIndex = originalI * originalGridSize + originalJ;
      
      if (originalIndex < interpolatedGrid.length) {
        simplifiedGrid.push(interpolatedGrid[originalIndex]);
      }
    }
  }
  
  return buildLayerMesh(simplifiedGrid, material);
}