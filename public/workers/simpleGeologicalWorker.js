/**
 * Simple Geological Worker
 * 
 * Web Worker for processing geological interpolation in background thread
 * to prevent blocking the main UI during computation.
 */

// Import utilities (Note: In a real Web Worker, we'd need to use importScripts
// or module imports. For this prototype, we'll inline the necessary functions)

// Enhanced IDW implementation with proper thickness for Web Worker
function interpolateLayer(boreholes, layerMaterial, siteExtent, gridSize = 10) {
  const dataPoints = extractLayerPoints(boreholes, layerMaterial);
  
  if (dataPoints.length === 0) {
    throw new Error(`No data points found for material: ${layerMaterial}`);
  }
  
  // Log for debugging in worker
  console.log(`Worker: Interpolating ${layerMaterial} with ${dataPoints.length} points`);

  const grid = createInterpolationGrid(siteExtent, gridSize);

  // Apply IDW to both top and bottom surfaces for accurate thickness
  const interpolatedGrid = grid.map(point => {
    const topElevation = idwInterpolate(point, dataPoints, 2);
    const bottomElevation = idwInterpolateBottom(point, dataPoints, 2);
    
    return {
      x: point.x,
      y: point.y,
      z: topElevation,
      zBottom: bottomElevation,
      thickness: Math.abs(topElevation - bottomElevation)
    };
  });

  return interpolatedGrid;
}

function idwInterpolate(targetPoint, dataPoints, power) {
  let numerator = 0;
  let denominator = 0;

  for (const dataPoint of dataPoints) {
    const distance = calculateDistance(targetPoint, dataPoint);

    if (distance < 0.01) {
      return dataPoint.z;
    }

    const weight = 1 / Math.pow(distance, power);
    numerator += weight * dataPoint.z;
    denominator += weight;
  }

  if (denominator === 0) {
    return dataPoints.reduce((sum, point) => sum + point.z, 0) / dataPoints.length;
  }

  return numerator / denominator;
}

// IDW interpolation for bottom elevations
function idwInterpolateBottom(targetPoint, dataPoints, power) {
  let numerator = 0;
  let denominator = 0;

  for (const dataPoint of dataPoints) {
    const distance = calculateDistance(targetPoint, dataPoint);
    
    if (distance < 0.01) {
      return dataPoint.zBottom;
    }

    const weight = 1 / Math.pow(distance, power);
    numerator += weight * dataPoint.zBottom;
    denominator += weight;
  }

  if (denominator === 0) {
    return dataPoints.reduce((sum, point) => sum + point.zBottom, 0) / dataPoints.length;
  }

  return numerator / denominator;
}

function extractLayerPoints(boreholes, layerMaterial) {
  const points = [];

  boreholes.forEach(borehole => {
    if (!borehole.layers || borehole.layers.length === 0) {
      return;
    }

    // Sort layers by depth to maintain stratigraphic order
    const sortedLayers = [...borehole.layers].sort((a, b) => a.from - b.from);
    
    const targetLayer = sortedLayers.find(l => l.material === layerMaterial);
    if (!targetLayer) {
      return;
    }

    // Calculate elevations relative to borehole surface (Y coordinate)
    const boreholeTop = borehole.y || 0;
    const layerTopElevation = boreholeTop - targetLayer.from;
    const layerBottomElevation = boreholeTop - targetLayer.to;

    points.push({
      x: borehole.x || 0,
      y: borehole.z || 0,  // Use Z coordinate for north/south horizontal position
      z: layerTopElevation,
      zBottom: layerBottomElevation,
      material: layerMaterial,
      boreholeId: borehole.id,
      thickness: targetLayer.thickness || (targetLayer.to - targetLayer.from),
      depthFrom: targetLayer.from,
      depthTo: targetLayer.to
    });
  });

  return points;
}

function createInterpolationGrid(siteExtent, gridSize) {
  const grid = [];
  const stepX = siteExtent.width / (gridSize - 1);
  const stepY = siteExtent.height / (gridSize - 1);

  for (let i = 0; i < gridSize; i++) {
    for (let j = 0; j < gridSize; j++) {
      const x = siteExtent.minX + (i * stepX);
      const y = siteExtent.minY + (j * stepY);
      
      grid.push({ x, y });
    }
  }

  return grid;
}

function calculateDistance(point1, point2) {
  const dx = point1.x - point2.x;
  const dy = point1.y - point2.y;
  return Math.sqrt(dx * dx + dy * dy);
}

// Mesh building functionality
function buildLayerMesh(interpolatedGrid, material) {
  if (!interpolatedGrid || interpolatedGrid.length === 0) {
    throw new Error('Invalid interpolated grid data');
  }

  const gridSize = Math.sqrt(interpolatedGrid.length);
  if (!Number.isInteger(gridSize)) {
    throw new Error('Grid must be square for mesh generation');
  }

  const vertices = [];
  const faces = [];
  const colors = [];
  const uvs = [];

  const materialColor = getMaterialColor(material);

  // Debug: Validate interpolation data has proper thickness information
  const samplePoints = interpolatedGrid.slice(0, 3);
  const hasThickness = samplePoints.every(p => p.zBottom !== undefined && p.z !== p.zBottom);
  const avgThickness = samplePoints.reduce((sum, p) => sum + Math.abs((p.zBottom || p.z) - p.z), 0) / samplePoints.length;
  
  console.log(`Worker: Building 3D volume for ${material}:`, {
    totalPoints: interpolatedGrid.length,
    hasProperThickness: hasThickness,
    avgThickness: avgThickness.toFixed(3),
    sampleElevations: samplePoints.map(p => ({ top: p.z.toFixed(2), bottom: (p.zBottom || 'undefined').toString().substring(0,6) }))
  });
  
  // First, add all top surface vertices
  interpolatedGrid.forEach((point, index) => {
    // Three.js coordinate system: X (east/west), Y (elevation), Z (north/south)
    vertices.push(point.x, point.z, point.y);
    colors.push(materialColor.r, materialColor.g, materialColor.b);
    
    const row = Math.floor(index / gridSize);
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
  
  console.log(`Worker: Created ${vertices.length / 3} vertices for ${material} volume`);

  // Create faces for a proper 3D geological volume
  const totalGridPoints = gridSize * gridSize;
  
  console.log(`Worker: Creating faces for ${material}: ${gridSize}x${gridSize} grid = ${totalGridPoints} points per surface`);
  
  // 1. TOP SURFACE FACES (looking down at the layer)
  for (let i = 0; i < gridSize - 1; i++) {
    for (let j = 0; j < gridSize - 1; j++) {
      const topIdx = i * gridSize + j;
      
      // Each grid cell becomes two triangles (counter-clockwise for upward normal)
      faces.push(topIdx, topIdx + 1, topIdx + gridSize);
      faces.push(topIdx + 1, topIdx + gridSize + 1, topIdx + gridSize);
    }
  }
  
  // 2. BOTTOM SURFACE FACES (looking up at the layer)
  for (let i = 0; i < gridSize - 1; i++) {
    for (let j = 0; j < gridSize - 1; j++) {
      const bottomIdx = i * gridSize + j + totalGridPoints;
      
      // Each grid cell becomes two triangles (clockwise for downward normal)
      faces.push(bottomIdx, bottomIdx + gridSize, bottomIdx + 1);
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
    
    faces.push(topLeft, topRight, bottomLeft);
    faces.push(topRight, bottomRight, bottomLeft);
  }
  
  // Front edge (j = 0)
  for (let i = 0; i < gridSize - 1; i++) {
    const topLeft = i * gridSize;
    const topRight = (i + 1) * gridSize;
    const bottomLeft = i * gridSize + totalGridPoints;
    const bottomRight = (i + 1) * gridSize + totalGridPoints;
    
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
    
    faces.push(topLeft, bottomLeft, topRight);
    faces.push(topRight, bottomLeft, bottomRight);
  }
  
  // Debug: Break down face counts by surface type
  const topFaceCount = (gridSize - 1) * (gridSize - 1) * 2;
  const bottomFaceCount = topFaceCount;
  const sideFaceCount = 4 * (gridSize - 1) * 2;
  const expectedTotal = topFaceCount + bottomFaceCount + sideFaceCount;
  const actualTotal = faces.length / 3;
  
  console.log(`Worker: ${material} face analysis:`, {
    expected: { top: topFaceCount, bottom: bottomFaceCount, sides: sideFaceCount, total: expectedTotal },
    actual: actualTotal,
    discrepancy: actualTotal - expectedTotal
  });

  const result = {
    vertices: new Float32Array(vertices),
    faces: new Uint16Array(faces),
    colors: new Float32Array(colors),
    uvs: new Float32Array(uvs),
    material,
    gridSize,
    vertexCount: vertices.length / 3,
    faceCount: faces.length / 3,
    bounds: calculateMeshBounds(interpolatedGrid),
    version: '3D_VOLUME_v1' // Version marker to ensure we're getting the right implementation
  };

  console.log(`Worker: Returning mesh data for ${material}:`, {
    hasVertices: !!result.vertices,
    hasFaces: !!result.faces,
    hasColors: !!result.colors,
    verticesLength: result.vertices.length,
    facesLength: result.faces.length,
    colorsLength: result.colors.length,
    version: result.version
  });

  return result;
}

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

function extractUniqueMaterials(boreholes) {
  const materials = new Set();

  boreholes.forEach(borehole => {
    if (borehole.layers) {
      borehole.layers.forEach(layer => {
        if (layer.material && layer.material.trim()) {
          materials.add(layer.material.toUpperCase());
        }
      });
    }
  });

  return Array.from(materials).sort();
}

// Main worker message handler
self.onmessage = function(e) {
  const { type, data } = e.data;

  if (type === 'PROCESS_GEOLOGICAL_MODEL') {
    processGeologicalModel(data);
  }
};

async function processGeologicalModel({ boreholes, siteExtent, options = {} }) {
  try {
    const startTime = performance.now();

    // Step 1: Extract unique materials
    postMessage({ 
      type: 'PROGRESS', 
      step: 'Analyzing geological layers...',
      progress: 0
    });

    const uniqueMaterials = extractUniqueMaterials(boreholes);

    if (uniqueMaterials.length === 0) {
      throw new Error('No geological layers found in borehole data');
    }

    postMessage({ 
      type: 'PROGRESS', 
      step: `Found ${uniqueMaterials.length} layer types: ${uniqueMaterials.join(', ')}`,
      progress: 10
    });

    // Validate minimum data requirements
    for (const material of uniqueMaterials) {
      const dataPoints = extractLayerPoints(boreholes, material);
      if (dataPoints.length < 3) {
        throw new Error(`Insufficient data for ${material}: need at least 3 points, found ${dataPoints.length}`);
      }
    }

    // Step 2: Interpolate each layer
    const processedLayers = [];
    const gridSize = options.gridSize || 10;

    for (let i = 0; i < uniqueMaterials.length; i++) {
      const material = uniqueMaterials[i];
      const progress = 10 + (i / uniqueMaterials.length) * 70;

      postMessage({
        type: 'PROGRESS',
        step: `Interpolating ${material} layer...`,
        progress: Math.round(progress)
      });

      try {
        const interpolatedGrid = interpolateLayer(boreholes, material, siteExtent, gridSize);
        const meshData = buildLayerMesh(interpolatedGrid, material);

        processedLayers.push({
          material,
          meshData,
          pointCount: interpolatedGrid.length,
          dataPointCount: extractLayerPoints(boreholes, material).length
        });

        // Yield to prevent blocking
        await new Promise(resolve => setTimeout(resolve, 10));

      } catch (layerError) {
        console.warn(`Failed to process layer ${material}:`, layerError.message);
        // Continue with other layers
      }
    }

    if (processedLayers.length === 0) {
      throw new Error('No geological layers could be processed successfully');
    }

    // Step 3: Finalize
    const processingTime = performance.now() - startTime;

    postMessage({
      type: 'PROGRESS',
      step: 'Finalizing geological model...',
      progress: 90
    });

    // Return completed model with proper transferable objects
    const transferableObjects = [];
    
    // Collect all typed arrays for transfer
    processedLayers.forEach(layer => {
      if (layer.meshData.vertices) transferableObjects.push(layer.meshData.vertices.buffer);
      if (layer.meshData.faces) transferableObjects.push(layer.meshData.faces.buffer);
      if (layer.meshData.colors) transferableObjects.push(layer.meshData.colors.buffer);
      if (layer.meshData.uvs) transferableObjects.push(layer.meshData.uvs.buffer);
    });

    console.log(`Worker: Transferring ${transferableObjects.length} buffers to main thread`);

    postMessage({
      type: 'MODEL_COMPLETE',
      result: {
        layers: processedLayers,
        processedAt: new Date().toISOString(),
        boreholeCount: boreholes.length,
        siteExtent,
        processingTime: Math.round(processingTime),
        gridSize,
        statistics: {
          totalLayers: processedLayers.length,
          totalVertices: processedLayers.reduce((sum, layer) => sum + layer.meshData.vertexCount, 0),
          totalFaces: processedLayers.reduce((sum, layer) => sum + layer.meshData.faceCount, 0)
        }
      }
    }, transferableObjects);

  } catch (error) {
    postMessage({
      type: 'MODEL_ERROR',
      error: {
        message: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      }
    });
  }
}

// Handle worker errors
self.onerror = function(error) {
  postMessage({
    type: 'MODEL_ERROR',
    error: {
      message: 'Worker error: ' + error.message,
      filename: error.filename,
      lineno: error.lineno,
      timestamp: new Date().toISOString()
    }
  });
};

// Signal that worker is ready
postMessage({
  type: 'WORKER_READY',
  message: 'Geological processing worker initialized'
});