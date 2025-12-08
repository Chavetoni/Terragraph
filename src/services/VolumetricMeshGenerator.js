/**
 * Volumetric Mesh Generator for 3D Geological Modeling
 * Creates 3D volumetric meshes from interpolated geological surfaces
 */

import { BufferAttribute, BufferGeometry, Color, DoubleSide, EdgesGeometry, LineBasicMaterial, LineSegments, Mesh, MeshPhysicalMaterial, MeshStandardMaterial, NormalBlending, RepeatWrapping, SphereGeometry } from 'three';
import { SpatialInterpolationEngine } from './SpatialInterpolationEngine';
import { GeologicalSequenceEngine } from './GeologicalSequenceEngine';
import { AdvancedInterpolationEngine } from './AdvancedInterpolationEngine';
import { HorizonPreprocessor } from './HorizonPreprocessor';
import { getMaterialProperties } from '../utils/materialStandardization';
import { textureManager } from './TextureManager';
import { 
  geologicalLogger, 
  interpolationLogger, 
  validationLogger, 
  scene3dLogger 
} from '../utils/Logger.js';
import { GeometryUtils } from './geology/GeometryUtils.js';
import { CoordinateSystemConverter } from '../utils/coordinateSystemConverter.js';

const EPSILON = 1e-10;

export class VolumetricMeshGenerator {


  /**
   * Get color for material type using USCS standardized system
   * @param {string} material - Material type name
   * @returns {Color} Color for the material
   */
  static getMaterialColor(material) {
    try {
      const materialProps = getMaterialProperties(material);
      return new Color(materialProps.color);
    } catch (error) {
      validationLogger.warn(`Failed to get material color for '${material}':`, error);
      return new Color('#808080'); // Fallback gray
    }
  }

  /**
   * Create a volumetric mesh with internal elevation detail
   * @param {Array} topSurface - Top surface points [{x, y, z}]
   * @param {Array} bottomSurface - Bottom surface points [{x, y, z}]
   * @param {string} material - Material type
   * @param {Object} extent - Site extent
   * @param {number} resolution - Grid resolution
   * @param {Object} options - Options including contour settings
   * @returns {Object} Mesh data with vertices, indices, colors
   */
  static createLayerVolume(topSurface, bottomSurface, material, extent, resolution, options = {}) {
    const { opacity = 0.5, showConfidenceVisualization = false } = options;
    const vertices = [];
    const indices = [];
    const colors = [];
    const alphas = [];  // Per-vertex opacity based on confidence (for confidence visualization)
    const normals = [];
    const uvs = [];

    const materialColor = this.getMaterialColor(material);
    const gridSize = resolution;

    // Create vertices for top and bottom surfaces with enhanced elevation mapping
    // Store vertex indices for easy reference  
    const topIndices = [];
    const bottomIndices = [];

    // Calculate elevation range for color mapping
    const allElevations = [...topSurface, ...bottomSurface].map(p => p.z);
    const minElevation = Math.min(...allElevations);
    const maxElevation = Math.max(...allElevations);
    const elevationRange = maxElevation - minElevation;

    // Add top surface vertices with elevation-based coloring
    for (let i = 0; i < topSurface.length; i++) {
      const point = topSurface[i];
      // Three.js vertex mapping: [X=East-West, Y=Up-Down, Z=North-South]
      // Interpolated point: {x=East-West, y=North-South, z=Elevation}
      vertices.push(point.x, point.z, point.y); // x→X, z(elevation)→Y, y(N-S)→Z
      
      // Progressive elevation visualization based on transparency
      const elevationRatio = elevationRange > EPSILON ? (point.z - minElevation) / elevationRange : 0.5;
      
      // Transparency-based contour visibility: lower opacity = more contours visible
      const contourStrength = Math.max(0, (1 - opacity) * 1.5); // 0 at full opacity, 1.5 at 10% opacity
      const showContours = contourStrength > 0.2; // Show contours when transparency > 80%
      
      let finalBrightness, elevationColorShift;
      
      if (showContours) {
        // Create contour-like color banding that increases with transparency
        const contourBands = Math.floor(4 + contourStrength * 8); // 4-12 bands based on transparency
        const bandIndex = Math.floor(elevationRatio * contourBands);
        const bandRatio = (elevationRatio * contourBands) % 1;
        
        // Alternate between lighter and darker bands - intensity based on transparency
        const isHighBand = bandIndex % 2 === 0;
        const contrastRange = 0.3 + contourStrength * 0.4; // More contrast at higher transparency
        const baseBrightness = isHighBand ? (0.7 + contrastRange) : (0.7 - contrastRange);
        finalBrightness = baseBrightness + (bandRatio * 0.2);
        
        // Color shift intensity based on transparency
        elevationColorShift = elevationRatio * contourStrength * 0.3;
      } else {
        // Solid appearance at high opacity
        finalBrightness = 0.7 + (elevationRatio * 0.2); // Subtle variation
        elevationColorShift = 0; // No color shift when solid
      }
      
      colors.push(
        Math.min(1.0, materialColor.r * finalBrightness + elevationColorShift),
        Math.min(1.0, materialColor.g * finalBrightness),
        Math.min(1.0, materialColor.b * finalBrightness + (1 - elevationRatio) * contourStrength * 0.2)
      );

      // Calculate per-vertex alpha based on confidence (for confidence visualization)
      const pointConfidence = point.confidence !== undefined ? point.confidence : 1.0;
      const vertexAlpha = showConfidenceVisualization
        ? Math.max(0.15, opacity * pointConfidence)  // Min floor of 0.15 to keep visible
        : opacity;  // Use uniform opacity when confidence viz is off
      alphas.push(vertexAlpha);

      normals.push(0, 1, 0); // Normal pointing up
      uvs.push(
        (point.x - extent.minX) / (extent.maxX - extent.minX),
        (point.y - extent.minY) / (extent.maxY - extent.minY)
      );
      topIndices.push(vertices.length / 3 - 1);
    }

    // Add bottom surface vertices
    for (let i = 0; i < bottomSurface.length; i++) {
      const point = bottomSurface[i];
      // Three.js vertex mapping: [X=East-West, Y=Up-Down, Z=North-South]
      // Interpolated point: {x=East-West, y=North-South, z=Elevation}
      vertices.push(point.x, point.z, point.y); // x→X, z(elevation)→Y, y(N-S)→Z
      // Progressive elevation visualization for bottom surface
      const elevationRatio = elevationRange > EPSILON ? (point.z - minElevation) / elevationRange : 0.5;
      
      // Same transparency-based contour logic as top surface
      const contourStrength = Math.max(0, (1 - opacity) * 1.5);
      const showContours = contourStrength > 0.2;
      
      let finalBrightness, elevationColorShift;
      
      if (showContours) {
        // Create contour-like color banding (offset for bottom surface)
        const contourBands = Math.floor(4 + contourStrength * 8);
        const bandIndex = Math.floor(elevationRatio * contourBands);
        const bandRatio = (elevationRatio * contourBands) % 1;
        
        // Alternate bands but darker for bottom surface
        const isHighBand = (bandIndex + 1) % 2 === 0; // Offset pattern from top
        const contrastRange = 0.2 + contourStrength * 0.3; // Less contrast than top
        const baseBrightness = isHighBand ? (0.5 + contrastRange) : (0.5 - contrastRange);
        finalBrightness = baseBrightness + (bandRatio * 0.15);
        
        // Color shift intensity based on transparency
        elevationColorShift = elevationRatio * contourStrength * 0.2;
      } else {
        // Solid appearance at high opacity (darker for bottom)
        finalBrightness = 0.5 + (elevationRatio * 0.15);
        elevationColorShift = 0;
      }
      
      colors.push(
        Math.min(1.0, materialColor.r * finalBrightness + elevationColorShift),
        Math.min(1.0, materialColor.g * finalBrightness),
        Math.min(1.0, materialColor.b * finalBrightness + (1 - elevationRatio) * contourStrength * 0.15)
      );

      // Calculate per-vertex alpha based on confidence (for confidence visualization)
      const pointConfidence = point.confidence !== undefined ? point.confidence : 1.0;
      const vertexAlpha = showConfidenceVisualization
        ? Math.max(0.15, opacity * pointConfidence)  // Min floor of 0.15 to keep visible
        : opacity;  // Use uniform opacity when confidence viz is off
      alphas.push(vertexAlpha);

      normals.push(0, -1, 0); // Normal pointing down
      uvs.push(
        (point.x - extent.minX) / (extent.maxX - extent.minX),
        (point.y - extent.minY) / (extent.maxY - extent.minY)
      );
      bottomIndices.push(vertices.length / 3 - 1);
    }

    // Create faces for top surface
    for (let i = 0; i < gridSize - 1; i++) {
      for (let j = 0; j < gridSize - 1; j++) {
        const idx = i * gridSize + j;
        const idx1 = idx + 1;
        const idx2 = idx + gridSize;
        const idx3 = idx + gridSize + 1;

        // Top surface triangles (CCW when viewed from above)
        indices.push(
          topIndices[idx],
          topIndices[idx2],
          topIndices[idx1]
        );
        indices.push(
          topIndices[idx1],
          topIndices[idx2],
          topIndices[idx3]
        );
      }
    }

    // Create faces for bottom surface
    for (let i = 0; i < gridSize - 1; i++) {
      for (let j = 0; j < gridSize - 1; j++) {
        const idx = i * gridSize + j;
        const idx1 = idx + 1;
        const idx2 = idx + gridSize;
        const idx3 = idx + gridSize + 1;

        // Bottom surface triangles (CW when viewed from above)
        indices.push(
          bottomIndices[idx],
          bottomIndices[idx1],
          bottomIndices[idx2]
        );
        indices.push(
          bottomIndices[idx1],
          bottomIndices[idx3],
          bottomIndices[idx2]
        );
      }
    }

    // Create side walls with dynamic texture scaling
    this.addSideWalls(
      vertices, indices, colors, normals, uvs, alphas,
      topIndices, bottomIndices, gridSize, materialColor, material,
      { topSurface, bottomSurface, opacity, showConfidenceVisualization }
    );

    return {
      vertices: new Float32Array(vertices),
      indices: new Uint32Array(indices),
      colors: new Float32Array(colors),
      alphas: new Float32Array(alphas),  // Per-vertex opacity based on confidence
      normals: new Float32Array(normals),
      uvs: new Float32Array(uvs),
      material,
      vertexCount: vertices.length / 3,
      indexCount: indices.length,
      // CRITICAL: Store surface data for adjacency detection and overlap analysis
      topSurface,      // Keep reference to surface data
      bottomSurface,   // Keep reference to surface data
      // Store visualization option for regeneration
      showConfidenceVisualization,
      opacity
    };
  }


  /**
   * Add side walls to close the volume with dynamic texture scaling
   * @private
   */
  static addSideWalls(vertices, indices, colors, normals, uvs, alphas,
                     topIndices, bottomIndices, gridSize, materialColor, materialType = 'UNKNOWN',
                     confidenceOptions = {}) {
    const { topSurface = [], bottomSurface = [], opacity = 0.5, showConfidenceVisualization = false } = confidenceOptions;

    // Helper function to calculate alpha for side wall vertices
    const calculateSideAlpha = (surfaceIdx1, surfaceIdx2) => {
      if (!showConfidenceVisualization) return opacity;
      const topConf1 = topSurface[surfaceIdx1]?.confidence ?? 1.0;
      const topConf2 = topSurface[surfaceIdx2]?.confidence ?? 1.0;
      const bottomConf1 = bottomSurface[surfaceIdx1]?.confidence ?? 1.0;
      const bottomConf2 = bottomSurface[surfaceIdx2]?.confidence ?? 1.0;
      const avgConfidence = (topConf1 + topConf2 + bottomConf1 + bottomConf2) / 4;
      return Math.max(0.15, opacity * avgConfidence);
    };

    // North wall (j = 0) - ENHANCED with dynamic texture scaling
    for (let i = 0; i < gridSize - 1; i++) {
      const surfaceIdx1 = i * gridSize;
      const surfaceIdx2 = (i + 1) * gridSize;
      const sideAlpha = calculateSideAlpha(surfaceIdx1, surfaceIdx2);
      const t1Idx = topIndices[surfaceIdx1];
      const t2Idx = topIndices[surfaceIdx2];
      const b1Idx = bottomIndices[surfaceIdx1];
      const b2Idx = bottomIndices[surfaceIdx2];
      
      // Get original vertex positions
      const t1 = [vertices[t1Idx * 3], vertices[t1Idx * 3 + 1], vertices[t1Idx * 3 + 2]];
      const t2 = [vertices[t2Idx * 3], vertices[t2Idx * 3 + 1], vertices[t2Idx * 3 + 2]];
      const b1 = [vertices[b1Idx * 3], vertices[b1Idx * 3 + 1], vertices[b1Idx * 3 + 2]];
      const b2 = [vertices[b2Idx * 3], vertices[b2Idx * 3 + 1], vertices[b2Idx * 3 + 2]];
      
      // Wall bounds calculation removed - UV scaling now handled at material level
      
      // Create NEW vertices with DYNAMIC UV mapping
      const newVertexBase = vertices.length / 3;
      
      // Use simple normalized UV coordinates (0-1 range) - scaling handled at material level
      const segmentU1 = i / (gridSize - 1);
      const segmentU2 = (i + 1) / (gridSize - 1);
      
      // Top-left vertex
      vertices.push(...t1);
      colors.push(materialColor.r, materialColor.g, materialColor.b);
      alphas.push(sideAlpha);
      normals.push(0, 0, 1); // North-facing normal
      uvs.push(segmentU1, 1.0);

      // Top-right vertex
      vertices.push(...t2);
      colors.push(materialColor.r, materialColor.g, materialColor.b);
      alphas.push(sideAlpha);
      normals.push(0, 0, 1);
      uvs.push(segmentU2, 1.0);

      // Bottom-left vertex
      vertices.push(...b1);
      colors.push(materialColor.r, materialColor.g, materialColor.b);
      alphas.push(sideAlpha);
      normals.push(0, 0, 1);
      uvs.push(segmentU1, 0.0);

      // Bottom-right vertex
      vertices.push(...b2);
      colors.push(materialColor.r, materialColor.g, materialColor.b);
      alphas.push(sideAlpha);
      normals.push(0, 0, 1);
      uvs.push(segmentU2, 0.0);

      // Create triangles using the new vertices
      indices.push(newVertexBase, newVertexBase + 2, newVertexBase + 1); // Triangle 1
      indices.push(newVertexBase + 1, newVertexBase + 2, newVertexBase + 3); // Triangle 2
    }

    // South wall (j = gridSize - 1) - ENHANCED with dynamic texture scaling
    for (let i = 0; i < gridSize - 1; i++) {
      const j = gridSize - 1;
      const surfaceIdx1 = i * gridSize + j;
      const surfaceIdx2 = (i + 1) * gridSize + j;
      const sideAlpha = calculateSideAlpha(surfaceIdx1, surfaceIdx2);
      const t1Idx = topIndices[surfaceIdx1];
      const t2Idx = topIndices[surfaceIdx2];
      const b1Idx = bottomIndices[surfaceIdx1];
      const b2Idx = bottomIndices[surfaceIdx2];
      
      // Get original vertex positions
      const t1 = [vertices[t1Idx * 3], vertices[t1Idx * 3 + 1], vertices[t1Idx * 3 + 2]];
      const t2 = [vertices[t2Idx * 3], vertices[t2Idx * 3 + 1], vertices[t2Idx * 3 + 2]];
      const b1 = [vertices[b1Idx * 3], vertices[b1Idx * 3 + 1], vertices[b1Idx * 3 + 2]];
      const b2 = [vertices[b2Idx * 3], vertices[b2Idx * 3 + 1], vertices[b2Idx * 3 + 2]];
      
      // Wall bounds calculation removed - UV scaling now handled at material level
      
      // Create NEW vertices with DYNAMIC UV mapping
      const newVertexBase = vertices.length / 3;
      
      // Use simple normalized UV coordinates (0-1 range) - scaling handled at material level
      const segmentU1 = i / (gridSize - 1);
      const segmentU2 = (i + 1) / (gridSize - 1);
      
      // Top-left vertex
      vertices.push(...t1);
      colors.push(materialColor.r, materialColor.g, materialColor.b);
      alphas.push(sideAlpha);
      normals.push(0, 0, -1); // South-facing normal
      uvs.push(segmentU1, 1.0);

      // Top-right vertex
      vertices.push(...t2);
      colors.push(materialColor.r, materialColor.g, materialColor.b);
      alphas.push(sideAlpha);
      normals.push(0, 0, -1);
      uvs.push(segmentU2, 1.0);

      // Bottom-left vertex
      vertices.push(...b1);
      colors.push(materialColor.r, materialColor.g, materialColor.b);
      alphas.push(sideAlpha);
      normals.push(0, 0, -1);
      uvs.push(segmentU1, 0.0);

      // Bottom-right vertex
      vertices.push(...b2);
      colors.push(materialColor.r, materialColor.g, materialColor.b);
      alphas.push(sideAlpha);
      normals.push(0, 0, -1);
      uvs.push(segmentU2, 0.0);

      // Create triangles for South wall (reverse winding order)
      indices.push(newVertexBase, newVertexBase + 1, newVertexBase + 2); // Triangle 1
      indices.push(newVertexBase + 1, newVertexBase + 3, newVertexBase + 2); // Triangle 2
    }

    // West wall (i = 0) - ENHANCED with dynamic texture scaling
    for (let j = 0; j < gridSize - 1; j++) {
      const surfaceIdx1 = j;
      const surfaceIdx2 = j + 1;
      const sideAlpha = calculateSideAlpha(surfaceIdx1, surfaceIdx2);
      const t1Idx = topIndices[surfaceIdx1];
      const t2Idx = topIndices[surfaceIdx2];
      const b1Idx = bottomIndices[surfaceIdx1];
      const b2Idx = bottomIndices[surfaceIdx2];
      
      // Get original vertex positions
      const t1 = [vertices[t1Idx * 3], vertices[t1Idx * 3 + 1], vertices[t1Idx * 3 + 2]];
      const t2 = [vertices[t2Idx * 3], vertices[t2Idx * 3 + 1], vertices[t2Idx * 3 + 2]];
      const b1 = [vertices[b1Idx * 3], vertices[b1Idx * 3 + 1], vertices[b1Idx * 3 + 2]];
      const b2 = [vertices[b2Idx * 3], vertices[b2Idx * 3 + 1], vertices[b2Idx * 3 + 2]];
      
      // Wall bounds calculation removed - UV scaling now handled at material level
      
      // Create NEW vertices with DYNAMIC UV mapping
      const newVertexBase = vertices.length / 3;
      
      // Use simple normalized UV coordinates (0-1 range) - scaling handled at material level
      const segmentU1 = j / (gridSize - 1);
      const segmentU2 = (j + 1) / (gridSize - 1);
      
      // Top-left vertex
      vertices.push(...t1);
      colors.push(materialColor.r, materialColor.g, materialColor.b);
      alphas.push(sideAlpha);
      normals.push(-1, 0, 0); // West-facing normal
      uvs.push(segmentU1, 1.0);

      // Top-right vertex
      vertices.push(...t2);
      colors.push(materialColor.r, materialColor.g, materialColor.b);
      alphas.push(sideAlpha);
      normals.push(-1, 0, 0);
      uvs.push(segmentU2, 1.0);

      // Bottom-left vertex
      vertices.push(...b1);
      colors.push(materialColor.r, materialColor.g, materialColor.b);
      alphas.push(sideAlpha);
      normals.push(-1, 0, 0);
      uvs.push(segmentU1, 0.0);

      // Bottom-right vertex
      vertices.push(...b2);
      colors.push(materialColor.r, materialColor.g, materialColor.b);
      alphas.push(sideAlpha);
      normals.push(-1, 0, 0);
      uvs.push(segmentU2, 0.0);

      // Create triangles for West wall
      indices.push(newVertexBase, newVertexBase + 1, newVertexBase + 2); // Triangle 1
      indices.push(newVertexBase + 1, newVertexBase + 3, newVertexBase + 2); // Triangle 2
    }

    // East wall (i = gridSize - 1) - ENHANCED with dynamic texture scaling
    for (let j = 0; j < gridSize - 1; j++) {
      const i = gridSize - 1;
      const surfaceIdx1 = i * gridSize + j;
      const surfaceIdx2 = i * gridSize + j + 1;
      const sideAlpha = calculateSideAlpha(surfaceIdx1, surfaceIdx2);
      const t1Idx = topIndices[surfaceIdx1];
      const t2Idx = topIndices[surfaceIdx2];
      const b1Idx = bottomIndices[surfaceIdx1];
      const b2Idx = bottomIndices[surfaceIdx2];
      
      // Get original vertex positions
      const t1 = [vertices[t1Idx * 3], vertices[t1Idx * 3 + 1], vertices[t1Idx * 3 + 2]];
      const t2 = [vertices[t2Idx * 3], vertices[t2Idx * 3 + 1], vertices[t2Idx * 3 + 2]];
      const b1 = [vertices[b1Idx * 3], vertices[b1Idx * 3 + 1], vertices[b1Idx * 3 + 2]];
      const b2 = [vertices[b2Idx * 3], vertices[b2Idx * 3 + 1], vertices[b2Idx * 3 + 2]];
      
      // Wall bounds calculation removed - UV scaling now handled at material level
      
      // Create NEW vertices with DYNAMIC UV mapping
      const newVertexBase = vertices.length / 3;
      
      // Use simple normalized UV coordinates (0-1 range) - scaling handled at material level
      const segmentU1 = j / (gridSize - 1);
      const segmentU2 = (j + 1) / (gridSize - 1);
      
      // Top-left vertex
      vertices.push(...t1);
      colors.push(materialColor.r, materialColor.g, materialColor.b);
      alphas.push(sideAlpha);
      normals.push(1, 0, 0); // East-facing normal
      uvs.push(segmentU1, 1.0);

      // Top-right vertex
      vertices.push(...t2);
      colors.push(materialColor.r, materialColor.g, materialColor.b);
      alphas.push(sideAlpha);
      normals.push(1, 0, 0);
      uvs.push(segmentU2, 1.0);

      // Bottom-left vertex
      vertices.push(...b1);
      colors.push(materialColor.r, materialColor.g, materialColor.b);
      alphas.push(sideAlpha);
      normals.push(1, 0, 0);
      uvs.push(segmentU1, 0.0);

      // Bottom-right vertex
      vertices.push(...b2);
      colors.push(materialColor.r, materialColor.g, materialColor.b);
      alphas.push(sideAlpha);
      normals.push(1, 0, 0);
      uvs.push(segmentU2, 0.0);

      // Create triangles for East wall (reverse winding order)
      indices.push(newVertexBase, newVertexBase + 2, newVertexBase + 1); // Triangle 1
      indices.push(newVertexBase + 1, newVertexBase + 2, newVertexBase + 3); // Triangle 2
    }
  }

  /**
   * Group layer points into continuous geological sequences with enhanced edge case handling
   * Detects discontinuous layers and separates them into distinct volumes
   * @param {Array} layerPoints - All layer points for a material+color combination
   * @param {string} material - Material type
   * @param {string} color - Color identifier
   * @param {Object} settings - Configuration options
   * @returns {Array<Array>} Array of continuous layer sequences
   */
  
  /**
   * Spatially cluster material occurrences to separate regional formations from isolated pockets
   * @param {Array} layerPoints - Array of layer points with borehole positions
   * @param {string} material - Material type being processed
   * @param {Object} settings - Clustering settings
   * @returns {Object} Object with regional and isolated clusters
   */
  static spatiallyClusterMaterial(layerPoints, _material, settings = {}) {
    const {
      maxClusterDistance = 15, // Maximum distance (feet) between boreholes in same cluster
      minRegionalClusterSize = 3, // Minimum boreholes for a regional formation
      enableSpatialClustering = true
    } = settings;

    if (!enableSpatialClustering || layerPoints.length === 0) {
      return { regionalClusters: [layerPoints], isolatedPoints: [] };
    }

    // ADAPTIVE CLUSTERING: For small datasets, skip clustering entirely
    // Clustering is designed for large sites with distinct geological regions
    // For <= 8 boreholes, use all points together for unified interpolation
    const uniqueBoreholeIds = new Set(layerPoints.map(p => p.boreholeId));
    const boreholeCount = uniqueBoreholeIds.size;

    // For small datasets, skip clustering - use all points together for unified interpolation
    if (boreholeCount <= 8) {
      return { regionalClusters: [layerPoints], isolatedPoints: [] };
    }

    // Group points by borehole to get unique spatial locations
    const boreholeGroups = new Map();
    layerPoints.forEach(point => {
      if (!boreholeGroups.has(point.boreholeId)) {
        boreholeGroups.set(point.boreholeId, {
          boreholeId: point.boreholeId,
          position: point.boreholePosition,
          points: []
        });
      }
      boreholeGroups.get(point.boreholeId).points.push(point);
    });

    const boreholes = Array.from(boreholeGroups.values());

    // Adaptive min cluster size for small datasets
    const effectiveMinClusterSize = boreholes.length <= 5 ? 2 : minRegionalClusterSize;

    // Use Union-Find for O(n log n) clustering
    const clusters = this.optimizedSpatialClustering(boreholes, maxClusterDistance);

    // Classify clusters as regional vs isolated
    const regionalClusters = [];
    const isolatedPoints = [];

    clusters.forEach((cluster) => {
      const clusterPoints = cluster.flatMap(bh => bh.points);

      if (cluster.length >= effectiveMinClusterSize) {
        regionalClusters.push(clusterPoints);
      } else {
        isolatedPoints.push(...clusterPoints);
      }
    });

    return { regionalClusters, isolatedPoints };
  }

  /**
   * Optimized spatial clustering using Union-Find data structure
   * Reduces complexity from O(n²) to O(n log n) for better performance with many boreholes
   * @param {Array} boreholes - Array of borehole data with positions
   * @param {number} maxClusterDistance - Maximum distance for clustering
   * @returns {Array} Array of clusters
   */
  static optimizedSpatialClustering(boreholes, maxClusterDistance) {
    if (boreholes.length === 0) return [];
    
    // Union-Find data structure for efficient clustering
    const parent = new Map();
    const rank = new Map();
    
    // Initialize each borehole as its own cluster
    boreholes.forEach(bh => {
      parent.set(bh.boreholeId, bh.boreholeId);
      rank.set(bh.boreholeId, 0);
    });
    
    // Find with path compression
    const find = (id) => {
      if (parent.get(id) !== id) {
        parent.set(id, find(parent.get(id))); // Path compression
      }
      return parent.get(id);
    };
    
    // Union with rank optimization
    const union = (id1, id2) => {
      const root1 = find(id1);
      const root2 = find(id2);
      
      if (root1 === root2) return;
      
      // Union by rank to keep tree balanced
      if (rank.get(root1) < rank.get(root2)) {
        parent.set(root1, root2);
      } else if (rank.get(root1) > rank.get(root2)) {
        parent.set(root2, root1);
      } else {
        parent.set(root2, root1);
        rank.set(root1, rank.get(root1) + 1);
      }
    };
    
    // Build spatial index for faster neighbor finding
    // Sort boreholes by x-coordinate for sweep line algorithm
    const sortedByX = [...boreholes].sort((a, b) => a.position.x - b.position.x);
    
    // Use sweep line algorithm to find nearby pairs efficiently
    for (let i = 0; i < sortedByX.length; i++) {
      const current = sortedByX[i];
      
      // Only check boreholes within x-distance (early pruning)
      for (let j = i + 1; j < sortedByX.length; j++) {
        const other = sortedByX[j];
        
        // Early termination: if x-distance exceeds threshold, no need to check further
        if (other.position.x - current.position.x > maxClusterDistance) {
          break;
        }
        
        // Calculate full Euclidean distance only if x-distance is within range
        // CRITICAL FIX: Use position.z (N-S) not position.y (surface elevation)
        // position = {x: E-W, y: surface elevation, z: N-S}
        const distance = Math.sqrt(
          Math.pow(current.position.x - other.position.x, 2) +
          Math.pow(current.position.z - other.position.z, 2)
        );
        
        if (distance <= maxClusterDistance) {
          union(current.boreholeId, other.boreholeId);
        }
      }
    }
    
    // Group boreholes by their cluster root
    const clusterMap = new Map();
    boreholes.forEach(bh => {
      const root = find(bh.boreholeId);
      if (!clusterMap.has(root)) {
        clusterMap.set(root, []);
      }
      clusterMap.get(root).push(bh);
    });
    
    return Array.from(clusterMap.values());
  }

  static groupDiscontinuousLayers(layerPoints, material, color, settings = {}) {
    if (layerPoints.length === 0) return [];
    
    const {
      maxGapTolerance = 10, // Allow 10ft/3m gaps between same layers
      enableGapBridging = true
    } = settings;

    // Sort points by depth (topZ) to analyze stratigraphic order
    const sortedPoints = [...layerPoints].sort((a, b) => b.topZ - a.topZ); // Shallowest first
    
    // Group points by borehole to analyze continuity within each borehole
    const boreholeGroups = new Map();
    sortedPoints.forEach(point => {
      if (!boreholeGroups.has(point.boreholeId)) {
        boreholeGroups.set(point.boreholeId, []);
      }
      boreholeGroups.get(point.boreholeId).push(point);
    });
    
    // Analyze depth ranges across all boreholes to find natural layer boundaries
    const allDepthRanges = [];
    boreholeGroups.forEach((points, boreholeId) => {
      points.forEach(point => {
        allDepthRanges.push({
          boreholeId,
          topZ: point.topZ,
          bottomZ: point.bottomZ,
          point
        });
      });
    });
    
    // Sort by depth and identify potential layer boundaries
    allDepthRanges.sort((a, b) => b.topZ - a.topZ);
    
    // Enhanced grouping with geological continuity principles
    const continuousSequences = [];
    const processed = new Set();
    
    for (let i = 0; i < allDepthRanges.length; i++) {
      if (processed.has(i)) continue;
      
      const range = allDepthRanges[i];
      const sequence = [range];
      processed.add(i);
      
      // Find all ranges that should connect to this sequence
      for (let j = i + 1; j < allDepthRanges.length; j++) {
        if (processed.has(j)) continue;
        
        const otherRange = allDepthRanges[j];
        
        // Calculate depth gap between layers
        const depthGap = Math.min(
          Math.abs(range.topZ - otherRange.bottomZ),
          Math.abs(range.bottomZ - otherRange.topZ),
          Math.abs(range.topZ - otherRange.topZ),
          Math.abs(range.bottomZ - otherRange.bottomZ)
        );
        
        // Check for overlap or proximity
        const overlapTop = Math.min(range.topZ, otherRange.topZ);
        const overlapBottom = Math.max(range.bottomZ, otherRange.bottomZ);
        const overlap = overlapTop - overlapBottom;
        
        // Connect if overlapping, adjacent, or within gap tolerance
        if (enableGapBridging && (overlap > 0 || depthGap <= maxGapTolerance)) {
          sequence.push(otherRange);
          processed.add(j);
        }
      }
      
      continuousSequences.push(sequence);
    }
    
    // Merge sequences that should be connected (secondary pass)
    const mergedSequences = this.mergeCloseSequences(continuousSequences, maxGapTolerance);

    // Convert sequences back to layer point arrays with confidence tracking
    const result = mergedSequences.map((sequence, index) => {
      const sequencePoints = sequence.map(range => range.point);
      
      // Calculate confidence based on data point density
      // Adjusted for better handling of missing strata across boreholes
      // 1 point = 0.5 (medium confidence), 2 points = 0.75 (good), 3+ points = 1.0 (full)
      const confidence = Math.min(1.0, 0.5 + (sequencePoints.length - 1) * 0.25);

      // Add confidence metadata to the sequence
      sequencePoints.confidence = confidence;
      sequencePoints.gapsBridged = sequence.length > sequencePoints.length;
      
      return sequencePoints;
    });
    
    return result;
  }

  /**
   * Merge sequences that are close together (helper method)
   * @param {Array} sequences - Array of sequences to potentially merge
   * @param {number} maxGapTolerance - Maximum gap to allow merging
   * @returns {Array} Merged sequences
   */
  static mergeCloseSequences(sequences, maxGapTolerance) {
    if (sequences.length <= 1) return sequences;
    
    const merged = [];
    const processed = new Set();
    
    for (let i = 0; i < sequences.length; i++) {
      if (processed.has(i)) continue;
      
      let currentSequence = [...sequences[i]];
      processed.add(i);
      
      // Look for other sequences to merge with this one
      for (let j = i + 1; j < sequences.length; j++) {
        if (processed.has(j)) continue;
        
        const otherSequence = sequences[j];
        const canMerge = this.sequencesCanMerge(currentSequence, otherSequence, maxGapTolerance);
        
        if (canMerge) {
          currentSequence = currentSequence.concat(otherSequence);
          processed.add(j);
        }
      }
      
      merged.push(currentSequence);
    }
    
    return merged.length < sequences.length ? this.mergeCloseSequences(merged, maxGapTolerance) : merged;
  }

  /**
   * Check if two sequences can be merged based on proximity
   * @param {Array} seq1 - First sequence
   * @param {Array} seq2 - Second sequence
   * @param {number} maxGapTolerance - Maximum gap tolerance
   * @returns {boolean} Whether sequences can be merged
   */
  static sequencesCanMerge(seq1, seq2, maxGapTolerance) {
    // Find minimum gap between any points in the two sequences
    let minGap = Infinity;
    
    for (const range1 of seq1) {
      for (const range2 of seq2) {
        const gap = Math.min(
          Math.abs(range1.topZ - range2.bottomZ),
          Math.abs(range1.bottomZ - range2.topZ)
        );
        minGap = Math.min(minGap, gap);
      }
    }
    
    return minGap <= maxGapTolerance;
  }

  /**
   * Analyze material distribution across boreholes
   * @param {Array} boreholes - Array of boreholes with layer data
   * @returns {Array} Array of material data with presence information
   */
  static analyzeMaterialDistribution(boreholes) {
    const materialMap = new Map();
    const totalBoreholes = boreholes.length;

    // Count occurrences of each material
    boreholes.forEach((borehole, bhIndex) => {
      borehole.layers?.forEach(layer => {
        const key = `${layer.material}_${layer.customColor || layer.color || 'default'}`;

        if (!materialMap.has(key)) {
          materialMap.set(key, {
            material: layer.material,
            color: layer.customColor || layer.color || 'default',
            occurrences: [],
            boreholes: []
          });
        }

        materialMap.get(key).occurrences.push({
          boreholeId: borehole.id,
          boreholeIndex: bhIndex,
          x: borehole.x,
          y: borehole.y,
          z: borehole.z,
          depth: layer.depth,
          thickness: layer.thickness
        });
        
        // Track unique boreholes
        if (!materialMap.get(key).boreholes.includes(borehole.id)) {
          materialMap.get(key).boreholes.push(borehole.id);
        }
      });
    });

    // Calculate presence ratio
    const materials = [];
    materialMap.forEach((data, key) => {
      materials.push({
        key,
        ...data,
        presenceRatio: (Math.abs(totalBoreholes) < EPSILON ? 0 : (Math.abs(totalBoreholes) < EPSILON ? 0 : data.boreholes.length / totalBoreholes)),
        isIsolated: data.boreholes.length / totalBoreholes < 0.5
      });
    });

    return materials;
  }

  /**
   * Create combined pocket for multiple isolated materials in same borehole
   * @param {Array} materials - Array of material data from same borehole
   * @param {Object} settings - Pocket settings
   * @returns {Object} Volume object representing the combined pocket
   */
  static createCombinedBoreholesPocket(materials, settings = {}) {
    if (!materials || materials.length === 0) return null;
    
    const { 
      radius = 0.8, 
      opacity = 0.8, 
      depthRatio = 0.3, 
      boreholeTotalDepth = 32.8,
      boreholes = [],
      textureSettings = null
    } = settings;
    
    // Calculate overall depth range covering all materials
    let minTopZ = Infinity;
    let maxBottomZ = -Infinity;
    let firstPoint = materials[0].point;
    
    materials.forEach(({ point }) => {
      minTopZ = Math.min(minTopZ, point.topZ);
      maxBottomZ = Math.max(maxBottomZ, point.bottomZ);
    });
    
    const totalThickness = minTopZ - maxBottomZ; // Total height covering all materials
    const centerDepth = (minTopZ + maxBottomZ) / 2; // Center of overall range
    
    // Get dominant material for visual representation
    const materialCounts = {};
    materials.forEach(({ material }) => {
      materialCounts[material] = (materialCounts[material] || 0) + 1;
    });
    const dominantMaterial = Object.keys(materialCounts).reduce((a, b) => 
      materialCounts[a] > materialCounts[b] ? a : b
    );


    // Create the combined pocket mesh using dominant material
    const materialData = {
      key: `combined_${firstPoint.boreholeId}`,
      material: dominantMaterial,
      color: 'default',
      presenceRatio: materials[0].presenceRatio
    };
    
    // Get borehole total depth for positioning calculations
    const borehole = boreholes.find(bh => bh.id === firstPoint.boreholeId);
    const actualBoreholeTotalDepth = borehole ? borehole.totalDepth : boreholeTotalDepth;

    const combinedMesh = this.createLocalizedPocket(
      materialData,
      {
        boreholeId: firstPoint.boreholeId,
        x: firstPoint.x,
        y: firstPoint.y,
        z: firstPoint.z,
        depth: centerDepth,
        thickness: totalThickness
      },
      { 
        radius, 
        opacity, 
        depthRatio, 
        boreholeTotalDepth: actualBoreholeTotalDepth,
        textureSettings
      }
    );
    
    // Create volume structure for combined pocket
    const combinedVolume = {
      mesh: combinedMesh,
      material: `MIXED_${dominantMaterial}`, // Indicate it's a mixed pocket
      customColor: null,
      uniqueKey: `combined_${firstPoint.boreholeId}_pocket`,
      type: 'pocket',
      isIsolated: true,
      isCombined: true,
      presenceRatio: materials[0].presenceRatio,
      topSurface: [{ z: minTopZ }],
      bottomSurface: [{ z: maxBottomZ }],
      pocketData: {
        radius: radius,
        opacity: opacity,
        shape: 'football',
        location: { x: firstPoint.x, y: firstPoint.y, depth: centerDepth },
        combinedMaterials: materials.map(m => ({
          material: m.material,
          color: m.color,
          topZ: m.point.topZ,
          bottomZ: m.point.bottomZ,
          thickness: m.point.thickness
        }))
      }
    };
    
    return combinedVolume;
  }

  /**
   * Create localized pocket for isolated material
   * @param {Object} material - Material data including occurrences
   * @param {Object} location - Location data for the pocket
   * @param {Object} settings - Pocket settings
   * @returns {Mesh} Three.js mesh representing the pocket
   */
  static createLocalizedPocket(material, location, settings = {}) {
    const {
      radius = 0.8,  // feet - matches borehole marker scale (0.4ft marker radius * 2 for visibility)
      opacity = 0.8,
      depthRatio = 0.3, // depth positioning as ratio (0.0=surface, 1.0=bottom of borehole)
      boreholeTotalDepth = 32.8, // total borehole depth for positioning calculations
      textureSettings = null // texture settings for pocket material
    } = settings;


    // Create vertical football shape (ellipsoid stretched vertically)
    // NOTE: Scene uses 1 Three.js unit = 1 foot, so no conversion needed
    const visualRadius = radius; // Radius in feet (scene units)
    
    // Use actual layer thickness for height instead of arbitrary 40ft
    const layerThickness = location.thickness || 10; // Use actual layer thickness
    const visualHeight = layerThickness; // Height matches actual geological layer thickness

    // Create ellipsoid and stretch it vertically to make football shape
    const geometry = new SphereGeometry(
      visualRadius,    // Base radius
      16,              // Width segments  
      12               // Height segments
    );
    
    // Stretch vertically to create football shape (taller than wide)
    // Calculate stretch to achieve desired height while maintaining base radius
    const desiredHalfHeight = visualHeight / 2; // Half the total desired height
    const footballStretch = (Math.abs(visualRadius) < EPSILON ? 0 : desiredHalfHeight / visualRadius); // Scale factor for Y dimension
    geometry.scale(1, footballStretch, 1);

    // Get material color
    const baseColor = this.getMaterialColor(material.material);
    
    // Create material properties with texture support
    const materialProps = {
      color: new Color(baseColor),
      transparent: true,
      opacity: opacity,
      roughness: 0.4,
      metalness: 0.0,
      side: DoubleSide,
      depthWrite: false, // Don't interfere with other geometry
      depthTest: true
    };

    // Apply texture if enabled and settings provided

    if (textureSettings && textureSettings.enabled && material.material) {
      try {
        // Use global texture settings but with material-specific patterns
        const materialTextureOptions = {
          enabled: true,
          intensity: textureSettings.globalIntensity || 0.7,
          scale: textureSettings.patternScale || 1.0,
          pattern: null // Use default pattern for material type
        };

        // Create texture for isolated pocket
        // Convert Color to hex string for TextureManager
        const colorHex = baseColor instanceof Color ? `#${baseColor.getHexString()}` : baseColor;
        const materialTexture = textureManager.createSoilTexture(material.material, colorHex, materialTextureOptions);
        
        if (materialTexture) {
          // Set texture wrap and filtering without repeat scaling (scale is handled in pattern generation)
          materialTexture.wrapS = RepeatWrapping;
          materialTexture.wrapT = RepeatWrapping;
          materialTexture.repeat.set(1, 1); // No repeat - scale is handled in pattern drawing
          materialTexture.needsUpdate = true;
          
          materialProps.map = materialTexture;

        }
        
      } catch (error) {
        scene3dLogger.warn(`Failed to apply texture to isolated pocket ${material.material}:`, error);
        // Continue without texture - material will use base color
      }
    } else {


    }

    // Create material for football zone with texture support
    const meshMaterial = new MeshPhysicalMaterial(materialProps);

    // Create mesh
    const mesh = new Mesh(geometry, meshMaterial);
    
    // Position football zone centered at borehole marker horizontally, covering actual layer depth
    // NOTE: Borehole markers use raw coordinates (borehole.x, borehole.y, borehole.z)
    // Scene coordinate system: 1 Three.js unit = 1 foot, so use coordinates directly
    const meshX = location.x;    // Borehole X position in feet (scene units)
    
    // Position pocket based on user-controlled depth ratio within borehole range
    // depthRatio: 0.0 = surface level, 1.0 = bottom of borehole  
    const targetDepth = depthRatio * boreholeTotalDepth; // Convert ratio to actual depth
    const naturalCenter = -targetDepth; // Negative Y = below surface
    const halfHeight = visualHeight / 2;
    const surfaceClampedY = Math.min(naturalCenter, -halfHeight); // Ensure top never goes above Y=0
    const meshY = surfaceClampedY;

    const meshZ = location.z;    // Borehole Z position in feet (scene units) - FIXED: was location.y
    
    mesh.position.set(meshX, meshY, meshZ);


    // Simple metadata
    mesh.userData = {
      type: 'isolated_football_zone',
      material: material.material,
      borehole: location.boreholeId,
      presenceRatio: material.presenceRatio,
      uniqueKey: material.key,
      zoneRadius: radius
    };

    return mesh;
  }


  /**
   * Generate complete stratigraphy from borehole data
   * @param {Array} boreholes - Array of boreholes with layer data
   * @param {Object} settings - Generation settings
   * @returns {Array} Array of volumetric mesh data
   */
  static generateStratigraphy(boreholes, settings = {}) {
    const {
      gridResolution = 15,  // Unified default: balanced quality/performance
      interpolationPower = 2,
      smoothingFactor = 0,
      // NATURAL MODE DEFAULTS: Allow realistic geological variation
      // These can be overridden by passing interpolationStyleSettings from context
      minThickness = 0.05,        // feet - allows thinner layers (was 0.1)
      // NEW: Geological validation options
      enableGeologicalValidation = false,
      maxSlope = 45,              // degrees - allows steeper natural dips (was 30)
      smoothingRadius = 0,        // no smoothing by default (was 1)
      enforceStratigraphicOrder = true,
      applyLateralContinuity = false, // no averaging by default (was true)
      // NEW: Advanced accuracy options
      enableAdvancedInterpolation = false,
      adaptiveMeshRefinement = false,
      // NEW: Interpolation method selection
      interpolationMethod = 'idw',
      enableConfidenceMapping = false,
      // Method-specific settings
      krigingVariogramModel = 'spherical',
      krigingRange = 25,
      krigingNugget = 0.1,
      krigingSill = 1.0,
      rbfBasisFunction = 'multiquadric',
      rbfShapeParameter = 1.0,
      // ADAPTIVE INTERPOLATION DISTANCE
      maxDistance = 100, // Default, but will be overridden by adaptive calculation
      // NEW: Edge case handling options
      maxGapTolerance = 10,
      enableGapBridging = true,
      // Dynamic thresholds based on borehole count
      minPresenceThreshold = boreholes.length <= 3 ? 0.33 : 0.5, // Lower threshold for few boreholes
      minDataPoints = Math.min(2, boreholes.length), // Don't require more points than we have boreholes
      // SIMPLIFIED: Isolated material handling
      isolatedMaterialHandling = 'pockets', // 'pockets' | 'ignore' 
      combinedPockets = true, // true = one pocket per borehole, false = separate pockets per material
      pocketRadius = 0.8, // feet - matches borehole marker scale
      pocketOpacity = 0.8,
      pocketDepthRatio = 0.3, // depth positioning as ratio (0.0=surface, 1.0=bottom of borehole)
      // showIsolatedIndicators = true // Future enhancement
      
      // NEW: Texture settings for isolated pockets
      textureSettings = null,

      // NEW: Spatial clustering settings for mixed (Math.abs(isolated) < EPSILON ? 0 : regional / isolated) materials
      enableSpatialClustering = true, // Enable spatial clustering to separate regional from isolated occurrences
      maxClusterDistance = 15, // Maximum distance (feet) between boreholes in same cluster
      minRegionalClusterSize = 3, // Minimum boreholes for a regional formation

      // NEW: Horizon-based interpolation with anisotropic distance (Phase 4)
      // TEMPORARILY DISABLED: These features may cause flat surfaces - testing simpler IDW first
      useHorizonPreprocessing = false,    // DISABLED: pinch-out handling with zero-thickness markers
      useAnisotropicDistance = false,     // DISABLED: 3D ellipsoidal distance
      anisotropyLx = 1.0,                 // East-West scale factor
      anisotropyLy = 1.0,                 // North-South scale factor
      anisotropyLz = 0.1,                 // Vertical scale (10:1 ratio)
      horizonNeighborSearchRadius = null, // Auto-calculated from extent.avgSpacing if null
      horizonMinNeighbors = 2,            // Minimum neighbors for IDW fallback

      // NEW: Confidence visualization option
      showConfidenceVisualization = false
    } = settings;

    // Extract unique material+color combinations 
    // CRITICAL FIX: Treat each material+color combo as a separate layer
    const materialColorMap = new Map(); // Maps unique key to {material, color}
    const materials = new Set();

    boreholes.forEach(bh => {
      if (bh.layers) {
        bh.layers.forEach(layer => {
          if (layer.material) {
            // Create unique key for material+color combination
            const color = layer.customColor || layer.color || 'default';
            const uniqueKey = `${layer.material}_${color}`;

            if (!materialColorMap.has(uniqueKey)) {
              materialColorMap.set(uniqueKey, {
                material: layer.material,
                color: color,
                uniqueKey: uniqueKey
              });
              materials.add(uniqueKey); // Use unique key instead of just material

            }
          }
        });
      }
    });

    const volumes = [];
    
    // Collect isolated materials for combined pocket generation
    const isolatedMaterialsByBorehole = new Map(); // boreholeId -> [{material, color, points}]
    const extent = SpatialInterpolationEngine.calculateExtent(boreholes);

    // Sort materials by typical geological order (deepest first)
    const materialOrder = ['ROCK', 'SANDSTONE', 'LIMESTONE', 'SHALE', 
                          'GRAVEL', 'SAND', 'SILT', 'CLAY', 'ORGANIC', 'FILL'];
    const sortedMaterials = Array.from(materials).sort((a, b) => {
      // Extract base material from unique key (format: "MATERIAL_color")
      const aMaterial = materialColorMap.get(a)?.material || a.split('_')[0];
      const bMaterial = materialColorMap.get(b)?.material || b.split('_')[0];
      
      const aIndex = materialOrder.indexOf(aMaterial);
      const bIndex = materialOrder.indexOf(bMaterial);
      
      // Sort by material order first
      const orderDiff = (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
      if (orderDiff !== 0) return orderDiff;
      
      // If same material type, sort by color to ensure consistent ordering
      return a.localeCompare(b);
    });

    // Auto-enable advanced features for high-quality settings
    const useAdvancedFeatures = gridResolution >= 25 || enableAdvancedInterpolation;
    const useAdaptiveRefinement = gridResolution >= 30 || adaptiveMeshRefinement;

    if (useAdvancedFeatures) {

    }

    // NEW: Horizon preprocessing for pinch-out handling
    // Inserts zero-thickness markers at stratigraphic positions for missing layers
    let horizonMap = null;
    if (useHorizonPreprocessing && sortedMaterials.length > 0) {
      const effectiveSearchRadius = horizonNeighborSearchRadius || (extent.avgSpacing * 2);
      horizonMap = HorizonPreprocessor.preprocessHorizons(
        boreholes,
        sortedMaterials,
        {
          neighborSearchRadius: effectiveSearchRadius,
          minNeighborsForEstimate: horizonMinNeighbors,
          pinchOutThreshold: 0.05,
          confidenceDecayFactor: 0.7,
          useStratigraphicPosition: true
        }
      );

      // Log preprocessing statistics for debugging
      const stats = HorizonPreprocessor.getPreprocessingStats(horizonMap);
      geologicalLogger.info('Horizon preprocessing complete:', {
        totalMaterials: stats.totalMaterials,
        pinchOutsInserted: stats.materials.reduce((sum, m) => sum + m.stratigraphicPinchouts, 0)
      });
    }

    // Anisotropy scale factors for 3D distance calculation
    // Lz = 0.1 means vertical is 10x more expensive than horizontal
    const anisotropyScales = {
      Lx: anisotropyLx,
      Ly: anisotropyLy,
      Lz: anisotropyLz
    };

    // Enhanced geological sequence processing with variable depth handling
    if (enableGeologicalValidation && sortedMaterials.length > 1) {

      // Step 1: Process geological sequence for variable depths, pinch-outs, and missing layers
      const sequenceData = GeologicalSequenceEngine.processVariableDepthSequence(
        boreholes, 
        sortedMaterials,
        {
          minThickness,
          pinchOutThreshold: 0.05,        // 5cm pinch-out threshold
          correlationDistance: 50,        // 50m correlation distance
          allowMissingLayers: true        // Handle missing layers
        }
      );

      // Step 2: Process each material with enhanced geological understanding
      sequenceData.materials.forEach(materialData => {
        if (materialData.presentInBoreholes.length >= 1) { // FIXED: Allow single-borehole layers (reduced from 2)
          
          // Get material info from the map for unique key
          const materialInfo = materialColorMap.get(materialData.material);
          const material = materialInfo?.material || materialData.material.split('_')[0];
          const color = materialInfo?.color || 'default';
          
          // Prepare layer points with geological awareness
          // Use augmented points from HorizonPreprocessor if available (includes zero-thickness markers)
          let layerPoints;
          if (horizonMap && horizonMap.has(materialData.material)) {
            layerPoints = HorizonPreprocessor.getAugmentedLayerPoints(horizonMap, materialData.material);
          } else {
            layerPoints = [];
            boreholes.forEach(bh => {
              const points = bh.getLayerPointsForMaterialAndColor(material, color);
              // CRITICAL: Transform points to use z (N-S) as y for grid interpolation
              // Borehole returns {x, y: elevation, z: N-S, topZ, bottomZ}
              // Grid expects {x: E-W, y: N-S, topZ, bottomZ}
              const transformedPoints = points.map(p => ({
                ...p,
                y: p.z  // Use N-S coordinate (z) as grid Y coordinate
              }));
              layerPoints.push(...transformedPoints);
            });
          }

          if (layerPoints.length > 0) {
            // DEBUG: Comprehensive logging to diagnose flatness
            const topZValues = layerPoints.map(p => p.topZ);
            const bottomZValues = layerPoints.map(p => p.bottomZ);
            const topZRange = Math.max(...topZValues) - Math.min(...topZValues);
            const bottomZRange = Math.max(...bottomZValues) - Math.min(...bottomZValues);

            // Log grid coordinate spread (y = N-S for grid interpolation)
            const gridYValues = layerPoints.map(p => p.y);
            const gridYRange = gridYValues.length > 0 ? Math.max(...gridYValues) - Math.min(...gridYValues) : 0;

            console.warn(`
=== INTERPOLATION DIAGNOSTIC: ${materialData.material} ===
Layer Points (${layerPoints.length}):
${layerPoints.map(p => `  gridX=${p.x?.toFixed(1)}, gridY=${p.y?.toFixed(1)} (N-S) → topZ=${p.topZ?.toFixed(2)}, bottomZ=${p.bottomZ?.toFixed(2)}, conf=${p.confidence || 1}`).join('\n')}

Grid Coordinate Spread:
  Grid Y (N-S) range: ${gridYValues.length > 0 ? `${Math.min(...gridYValues).toFixed(1)} to ${Math.max(...gridYValues).toFixed(1)} (span: ${gridYRange.toFixed(1)})` : 'N/A'}
${gridYRange < 1 ? '⚠️ WARNING: All points at nearly same N-S position - IDW may produce flat surfaces!' : '✓ Points spread across N-S dimension'}

Layer Elevation Variation:
  Top Z range: ${Math.min(...topZValues).toFixed(2)} to ${Math.max(...topZValues).toFixed(2)} (variation: ${topZRange.toFixed(2)})
  Bottom Z range: ${Math.min(...bottomZValues).toFixed(2)} to ${Math.max(...bottomZValues).toFixed(2)} (variation: ${bottomZRange.toFixed(2)})

${topZRange < 0.1 ? '⚠️ TOP SURFACE IS FLAT - All topZ values are the same!' : '✓ Top surface has variation'}
${bottomZRange < 0.1 ? '⚠️ BOTTOM SURFACE IS FLAT - All bottomZ values are the same!' : '✓ Bottom surface has variation'}
===================================================
            `);

            // Use advanced interpolation if enabled
            let layerSurface;
            
            if (useAdvancedFeatures) {

              // Apply adaptive mesh refinement if enabled
              if (useAdaptiveRefinement) {
                // Analyze geological trends first
                const geologicalTrends = this.analyzeGeologicalTrends(layerPoints, extent);

                const adaptiveGrid = this.generateAdaptiveGrid(
                  layerPoints,
                  extent,
                  gridResolution,
                  {
                    complexityThreshold: 0.5,
                    refinementLevels: 2,
                    maxRefinementFactor: 2,
                    geologicalTrends
                  }
                );

                // Use adaptive grid for interpolation with geological trends
                layerSurface = this.advancedLayerInterpolationWithAdaptiveGrid(
                  layerPoints,
                  extent,
                  adaptiveGrid,
                  {
                    methods: ['idw', 'kriging', 'rbf'],
                    power: interpolationPower,
                    maxDistance: maxDistance, // Use adaptive maxDistance
                    qualityThreshold: 0.7,
                    geologicalTrends
                  }
                );
              } else {
                // Standard advanced interpolation without adaptive refinement
                // Still analyze trends for anisotropy even without adaptive refinement
                const geologicalTrends = this.analyzeGeologicalTrends(layerPoints, extent);

                layerSurface = this.advancedLayerInterpolation(
                  layerPoints,
                  extent,
                  gridResolution,
                  {
                    methods: this.applyGeologicalTrendsToInterpolation(geologicalTrends, ['idw', 'kriging', 'rbf']),
                    power: interpolationPower,
                    maxDistance: maxDistance, // Use adaptive maxDistance
                    qualityThreshold: 0.7,
                    geologicalTrends
                  }
                );
              }
            } else {
              // Standard interpolation with optional anisotropic distance
              layerSurface = SpatialInterpolationEngine.interpolateLayerSurface(
                layerPoints,
                extent,
                gridResolution,
                {
                  power: interpolationPower,
                  maxDistance: maxDistance, // Use adaptive maxDistance from settings
                  useAnisotropy: useAnisotropicDistance,
                  anisotropyScales: anisotropyScales
                }
              );
            }

            // Apply geological validation
            const validatedSurface = SpatialInterpolationEngine.applyGeologicalValidation(
              [{ ...layerSurface, material: materialData.material }],
              {
                minThickness,
                maxSlope,
                smoothingRadius,
                enforceOrder: enforceStratigraphicOrder,
                applyLateralContinuity
              }
            )[0];

            // Apply smoothing if requested
            let smoothedTop = validatedSurface.topSurface;
            let smoothedBottom = validatedSurface.bottomSurface;
            
            if (smoothingFactor > 0) {
              smoothedTop = SpatialInterpolationEngine.smoothSurface(
                validatedSurface.topSurface, gridResolution, smoothingFactor
              );
              smoothedBottom = SpatialInterpolationEngine.smoothSurface(
                validatedSurface.bottomSurface, gridResolution, smoothingFactor
              );
            }

            // Create standard volume (multi-level feature removed)
            const volume = this.createLayerVolume(
              smoothedTop, smoothedBottom, material, extent, gridResolution,
              { opacity: settings.layerOpacity || 0.3, showConfidenceVisualization }
            );
            
            // Add color info to volume data for proper rendering
            volume.customColor = color !== 'default' ? color : null;
            volume.uniqueKey = materialData.material; // This is the unique key

            // Add geological metadata for debugging and analysis
            volume.geologicalData = {
              presentInBoreholes: materialData.presentInBoreholes.length,
              totalBoreholes: boreholes.length,
              coverage: `${Math.round(100 * (Math.abs(boreholes.length) < EPSILON ? 0 : materialData.presentInBoreholes.length / boreholes.length))}%`,
              averageThickness: materialData.variations.averageThickness.toFixed(2) + 'm',
              thicknessRange: `${materialData.variations.minThickness.toFixed(2)}m - ${materialData.variations.maxThickness.toFixed(2)}m`,
              pinchOuts: materialData.pinchOuts.length,
              correlations: materialData.correlations.length
            };

            volumes.push(volume);
          }
        } else {
          geologicalLogger.warn(`Insufficient data for ${materialData.material}: only ${materialData.presentInBoreholes.length} boreholes`);
        }
      });

    } else {
      // Original processing for individual materials (backward compatibility)
      for (const uniqueKey of sortedMaterials) {
        const materialInfo = materialColorMap.get(uniqueKey);
        if (!materialInfo) continue;

        const { material, color } = materialInfo;

        // Collect layer points from all boreholes
        const allLayerPoints = [];
        boreholes.forEach(bh => {
          const points = bh.getLayerPointsForMaterialAndColor(material, color);
          if (points.length > 0) {
            // Transform points: use z (N-S) as y for grid interpolation
            points.forEach(p => {
              p.boreholeId = bh.id;
              p.boreholePosition = { x: bh.x, y: bh.y, z: bh.z };
              p.originalY = p.y;
              p.y = p.z;  // Use N-S coordinate for grid Y
            });
          }
          allLayerPoints.push(...points);
        });

        // Spatially cluster material occurrences
        const { regionalClusters, isolatedPoints } = this.spatiallyClusterMaterial(allLayerPoints, material, {
          maxClusterDistance,
          minRegionalClusterSize,
          enableSpatialClustering
        });

        // Process isolated points directly as pockets (skip interpolation)
        if (isolatedPoints.length > 0 && isolatedMaterialHandling === 'pockets') {

          isolatedPoints.forEach(point => {
            const materialData = {
              key: `${uniqueKey}_isolated_${point.boreholeId}`,
              material: material,
              color: color,
              presenceRatio: 0.1 // Mark as clearly isolated
            };
            
            // Get borehole total depth for positioning calculations
            const borehole = boreholes.find(bh => bh.id === point.boreholeId);
            const boreholeTotalDepth = borehole ? borehole.totalDepth : 32.8;

            const pocket = this.createLocalizedPocket(
              materialData,
              {
                boreholeId: point.boreholeId,
                x: point.x,
                y: point.y,
                z: point.z,
                depth: point.topZ,
                thickness: point.thickness
              },
              {
                radius: pocketRadius,
                opacity: pocketOpacity,
                depthRatio: pocketDepthRatio,
                boreholeTotalDepth: boreholeTotalDepth,
                textureSettings
              }
            );
            
            // Create compatible volume structure for isolated pocket
            const pocketVolume = {
              mesh: pocket,
              material: material,
              customColor: color !== 'default' ? color : null,
              uniqueKey: `${uniqueKey}_isolated_${point.boreholeId}_pocket`,
              type: 'pocket',
              isIsolated: true,
              isSpatiallyIsolated: true, // NEW: Mark as spatially isolated
              presenceRatio: 0.1,
              topSurface: [{ z: -point.topZ }],
              bottomSurface: [{ z: -(point.topZ + point.thickness) }],
              pocketData: {
                radius: pocketRadius,
                opacity: pocketOpacity,
                depthRatio: pocketDepthRatio
              }
            };

            volumes.push(pocketVolume);

          });
        }

        // Process each regional cluster separately using standard interpolation
        regionalClusters.forEach((clusterPoints, clusterIndex) => {
          if (clusterPoints.length === 0) return;

          // Group discontinuous layers within this cluster
          const layerSequences = this.groupDiscontinuousLayers(clusterPoints, material, color, {
            maxGapTolerance,
            enableGapBridging
          });
        
          // Create separate volumes for each continuous layer sequence within this cluster
          layerSequences.forEach((layerPoints, sequenceIndex) => {
            const clusterSuffix = regionalClusters.length > 1 ? `_cluster${clusterIndex + 1}` : '';
            const sequenceSuffix = layerSequences.length > 1 ? `_seq${sequenceIndex + 1}` : '';
            const volumeUniqueKey = `${uniqueKey}${clusterSuffix}${sequenceSuffix}`;

          // Calculate stratum presence percentage based on unique boreholes, not total layer count
          const uniqueBoreholes = new Set(layerPoints.map(p => p.boreholeId));
          const stratumPresenceRatio = (Math.abs(boreholes.length) < EPSILON ? 0 : uniqueBoreholes.size / boreholes.length);
          
          // Debug logging for presence calculation
          geologicalLogger.debug(`Material ${material} presence calculation:`, {
            uniqueBoreholes: uniqueBoreholes.size,
            totalBoreholes: boreholes.length,
            presenceRatio: stratumPresenceRatio,
            layerPoints: layerPoints.length,
            minPresenceThreshold,
            minDataPoints
          });
          
          // Skip creating volumes for sparse strata or insufficient data points to prevent phantom layers
          const hasInsufficientPresence = stratumPresenceRatio < minPresenceThreshold;
          const hasInsufficientDataPoints = layerPoints.length < minDataPoints;
          
          // If material is present in ALL boreholes (100% presence), always treat as continuous
          const isUniformAcrossAllBoreholes = stratumPresenceRatio >= 0.99;

          if ((hasInsufficientPresence || hasInsufficientDataPoints) && !isUniformAcrossAllBoreholes) {
            // Handle isolated materials based on settings
            if (isolatedMaterialHandling === 'pockets' && layerPoints.length > 0) {


              if (combinedPockets) {
                // Collect isolated materials for combined pocket generation
                layerPoints.forEach(point => {
                  if (!isolatedMaterialsByBorehole.has(point.boreholeId)) {
                    isolatedMaterialsByBorehole.set(point.boreholeId, []);
                  }
                  isolatedMaterialsByBorehole.get(point.boreholeId).push({
                    material: material,
                    color: color,
                    point: point,
                    volumeUniqueKey: volumeUniqueKey,
                    presenceRatio: stratumPresenceRatio
                  });
                });

              } else {
                // Create individual pockets per material (original behavior)
                const materialData = {
                  key: volumeUniqueKey,
                  material: material,
                  color: color,
                  presenceRatio: stratumPresenceRatio
                };
                
                layerPoints.forEach(point => {
                  // Get borehole total depth for positioning calculations
                  const borehole = boreholes.find(bh => bh.id === point.boreholeId);
                  const boreholeTotalDepth = borehole ? borehole.totalDepth : 32.8; // fallback to default

                  const pocket = this.createLocalizedPocket(
                    materialData,
                    {
                      boreholeId: point.boreholeId,
                      x: point.x,
                      y: point.y,
                      z: point.z,
                      depth: point.topZ,
                      thickness: point.thickness
                    },
                    {
                      radius: pocketRadius,
                      opacity: pocketOpacity,
                      depthRatio: pocketDepthRatio,
                      boreholeTotalDepth: boreholeTotalDepth,
                      textureSettings
                    }
                  );
                  
                  // Create compatible volume structure for pocket
                  const pocketVolume = {
                    mesh: pocket,
                    material: material,
                    customColor: color !== 'default' ? color : null,
                    uniqueKey: `${volumeUniqueKey}_pocket`,
                    type: 'pocket',
                    isIsolated: true,
                    presenceRatio: stratumPresenceRatio,
                    topSurface: [{ z: -point.topZ }],
                    bottomSurface: [{ z: -(point.topZ + point.thickness) }],
                    pocketData: {
                      radius: pocketRadius,
                      opacity: pocketOpacity,
                      shape: 'football',
                      location: { x: point.x, y: point.y, depth: point.topZ }
                    }
                  };
                  volumes.push(pocketVolume);
                });

              }
              return; // Skip normal interpolation
              
            } else if (isolatedMaterialHandling === 'interpolate') {
              // Force interpolation despite low presence

            } else {
              // Default behavior - skip entirely
              if (hasInsufficientPresence) {


              }
              if (hasInsufficientDataPoints) {


              }
              return; // Skip this stratum entirely
            }
          }

          if (layerPoints.length >= 1) {
          
          let topSurface, bottomSurface;
          
          // Use advanced interpolation methods if specified
          if (interpolationMethod !== 'idw') {
            try {
              const result = this.advancedLayerInterpolation(
                layerPoints, 
                extent, 
                gridResolution, 
                {
                  method: interpolationMethod,
                  enableConfidenceMapping,
                  // Kriging settings
                  variogramModel: krigingVariogramModel,
                  range: krigingRange,
                  nugget: krigingNugget,
                  sill: krigingSill,
                  // RBF settings
                  basisFunction: rbfBasisFunction,
                  shapeParameter: rbfShapeParameter,
                  // General settings
                  power: interpolationPower
                }
              );
              
              topSurface = result.topSurface;
              bottomSurface = result.bottomSurface;

            } catch (error) {
              interpolationLogger.warn(`Advanced interpolation failed for ${material}, falling back to IDW:`, error.message);
              
              // Fallback to basic IDW with anisotropic distance
              const result = SpatialInterpolationEngine
                .interpolateLayerSurface(layerPoints, extent, gridResolution, {
                  power: interpolationPower,
                  useAnisotropy: useAnisotropicDistance,
                  anisotropyScales: anisotropyScales
                });
              topSurface = result.topSurface;
              bottomSurface = result.bottomSurface;
            }
          } else {
            // Use basic IDW interpolation with optional anisotropic distance
            const result = SpatialInterpolationEngine
              .interpolateLayerSurface(layerPoints, extent, gridResolution, {
                power: interpolationPower,
                useAnisotropy: useAnisotropicDistance,
                anisotropyScales: anisotropyScales
              });
            topSurface = result.topSurface;
            bottomSurface = result.bottomSurface;
          }

          // Apply smoothing if requested
          let smoothedTop = topSurface;
          let smoothedBottom = bottomSurface;
          if (smoothingFactor > 0) {
            smoothedTop = SpatialInterpolationEngine.smoothSurface(
              topSurface, gridResolution, smoothingFactor
            );
            smoothedBottom = SpatialInterpolationEngine.smoothSurface(
              bottomSurface, gridResolution, smoothingFactor
            );
          }

          const volume = this.createLayerVolume(
            smoothedTop, smoothedBottom, material, extent, gridResolution,
            { opacity: settings.layerOpacity || 0.3, showConfidenceVisualization }
          );

          // Add color info to volume data for proper rendering
          volume.customColor = color !== 'default' ? color : null;
          volume.uniqueKey = volumeUniqueKey; // Use sequence-specific unique key

          // IMPORTANT: Mark as continuous volume (not a pocket)
          volume.type = 'continuous'; // Explicitly mark as continuous geological layer
          
          // Add confidence and geological metadata from layer sequence
          volume.confidence = layerPoints.confidence || 1.0;
          volume.gapsBridged = layerPoints.gapsBridged || false;
          
          // Store original surfaces for potential separation later
          volume.originalTopSurface = [...smoothedTop];
          volume.originalBottomSurface = [...smoothedBottom];

          volumes.push(volume);
            }
          }); // Close layerSequences.forEach within regional cluster
        }); // Close regionalClusters.forEach
      } // Close for (const uniqueKey of sortedMaterials)
    } // Close main else block

    // Generate combined pockets for isolated materials (if enabled)
    if (combinedPockets && isolatedMaterialsByBorehole.size > 0) {

      isolatedMaterialsByBorehole.forEach((materials, boreholeId) => {
        const combinedPocket = this.createCombinedBoreholesPocket(materials, {
          radius: pocketRadius,
          opacity: pocketOpacity,
          depthRatio: pocketDepthRatio,
          boreholes: boreholes,
          textureSettings
        });
        
        if (combinedPocket) {
          volumes.push(combinedPocket);

        }
      });
    }

    volumes.forEach((v, i) => {
      // Calculate depth range for debugging overlaps
      const topZ = v.topSurface ? Math.max(...v.topSurface.map(p => p.z)) : null;
      const bottomZ = v.bottomSurface ? Math.min(...v.bottomSurface.map(p => p.z)) : null;

      // CRITICAL: Better type checking for toFixed call
      if (topZ !== null && bottomZ !== null && typeof topZ === 'number' && typeof bottomZ === 'number' && !isNaN(topZ) && !isNaN(bottomZ)) {

      } else {

      }
    });
    
    // Check for overlapping AND adjacent volumes to apply separation

    for (let i = 0; i < volumes.length; i++) {
      for (let j = i + 1; j < volumes.length; j++) {
        const vol1 = volumes[i];
        const vol2 = volumes[j];
        
        // Only separate volumes of the same base material (different colors)
        // BUT exclude discontinuous sequences which are naturally separated
        const vol1BaseMaterial = vol1.uniqueKey.split('_')[0];
        const vol2BaseMaterial = vol2.uniqueKey.split('_')[0];
        
        // Check if both volumes are sequence-separated layers of the same material+color
        const vol1IsSequence = vol1.uniqueKey.includes('_seq');
        const vol2IsSequence = vol2.uniqueKey.includes('_seq');
        const vol1BaseKey = vol1.uniqueKey.replace(/_seq\d+$/, '');
        const vol2BaseKey = vol2.uniqueKey.replace(/_seq\d+$/, '');

        // Skip comparison for discontinuous sequences of the same material+color - they're naturally separated
        if (vol1IsSequence && vol2IsSequence && vol1BaseKey === vol2BaseKey) {

          continue;
        }
        
        if (vol1BaseMaterial !== vol2BaseMaterial) continue;
        
        if (vol1.topSurface && vol1.bottomSurface && vol2.topSurface && vol2.bottomSurface) {
          const vol1Top = Math.max(...vol1.topSurface.map(p => p.z));
          const vol1Bottom = Math.min(...vol1.bottomSurface.map(p => p.z));
          const vol2Top = Math.max(...vol2.topSurface.map(p => p.z));
          const vol2Bottom = Math.min(...vol2.bottomSurface.map(p => p.z));


          // Check for overlap OR adjacency (within 10cm)
          const overlap = Math.max(0, Math.min(vol1Top, vol2Top) - Math.max(vol1Bottom, vol2Bottom));
          
          // FIXED: Correct gap calculation - gap only exists when layers don't overlap
          let gap = 0;
          if (overlap <= 0.001) { // No significant overlap
            // Calculate actual gap between non-overlapping layers
            const gap1 = vol2Top - vol1Bottom; // Gap if vol1 is above vol2  
            const gap2 = vol1Top - vol2Bottom; // Gap if vol2 is above vol1

            // Use the positive gap (layers are separated), ignore negative (impossible)
            const validGaps = [gap1, gap2].filter(g => g > 0);
            gap = validGaps.length > 0 ? Math.min(...validGaps) : 0;
          }

          // Handle overlapping same-material layers with VISUAL techniques (preserve geological continuity)
          // SKIP visual distinction for spatially isolated pockets - they should remain separate
          const vol1IsSpatiallyIsolated = vol1.isSpatiallyIsolated || false;
          const vol2IsSpatiallyIsolated = vol2.isSpatiallyIsolated || false;
          
          // Apply visual distinction only if conditions are met and neither volume is spatially isolated
          if ((overlap > 0.01 || (overlap <= 0.001 && gap > 0 && gap < 0.1)) && 
              !vol1IsSpatiallyIsolated && !vol2IsSpatiallyIsolated) {
            if (overlap > 0.01) {

            } else if (gap < 0.1) {

            }
            
          } else if (vol1IsSpatiallyIsolated || vol2IsSpatiallyIsolated) {

          }
          
          // Apply visual enhancements only for continuous strata (not isolated pockets)
          if ((overlap > 0.01 || (overlap <= 0.001 && gap > 0 && gap < 0.1)) && 
              !vol1IsSpatiallyIsolated && !vol2IsSpatiallyIsolated) {
            // Use VISUAL-ONLY techniques to distinguish same-material layers without breaking geological continuity
            const vol1Center = (vol1Top + vol1Bottom) / 2;
            const vol2Center = (vol2Top + vol2Bottom) / 2;
            
            // Assign different render orders and visual properties for distinction
            if (vol1Center < vol2Center) {
              // vol1 is deeper - give it higher priority render order and enhanced visual distinction
              vol1.renderOrderOffset = -0.15; // Deeper layer renders first
              vol2.renderOrderOffset = -0.10; // Shallower layer renders on top
              vol1.visualEnhancement = { opacity: 0.9, outline: true }; // Enhanced solid visibility for deeper layer
              vol2.visualEnhancement = { opacity: 0.5, outline: false }; // Reduced visibility for upper layer

            } else {
              // vol2 is deeper - give it higher priority render order and enhanced visual distinction  
              vol2.renderOrderOffset = -0.15; // Deeper layer renders first
              vol1.renderOrderOffset = -0.10; // Shallower layer renders on top
              vol2.visualEnhancement = { opacity: 0.9, outline: true }; // Enhanced solid visibility for deeper layer
              vol1.visualEnhancement = { opacity: 0.5, outline: false }; // Reduced visibility for upper layer

            }
          } else {
            if (gap > 0.1) {

            } else {

            }
          }
        } else {

        }
      }
    }
    
    // CRITICAL: Assign depth-based render orders for proper layering

    // Sort volumes by average depth (deepest first)
    const volumesWithDepth = volumes.map(volume => {
      const topZ = volume.topSurface ? Math.max(...volume.topSurface.map(p => p.z)) : 0;
      const bottomZ = volume.bottomSurface ? Math.min(...volume.bottomSurface.map(p => p.z)) : 0;
      const avgDepth = (topZ + bottomZ) / 2;
      return { volume, avgDepth };
    });

    // Sort by depth (deepest/most negative first)
    volumesWithDepth.sort((a, b) => a.avgDepth - b.avgDepth);

    // CRITICAL FIX: Stitch adjacent layers to eliminate gaps
    // After sorting, volumesWithDepth[0] is deepest, volumesWithDepth[N-1] is shallowest
    // Each shallower layer's bottom should match the deeper layer's top
    this.stitchAdjacentLayers(volumesWithDepth);

    // Assign render orders: deepest = -1.4, shallowest = -1.1 (all below site map at 0)
    volumesWithDepth.forEach((item, index) => {
      const renderOrder = -1.4 + (index * 0.1); // -1.4, -1.3, -1.2, -1.1
      item.volume.renderOrderOffset = renderOrder + 1; // Convert to offset from base -1
    });

    return volumes;
  }


  /**
   * Apply physical surface separation to a volume to prevent visual merging
   * @param {Object} volume - Volume object with topSurface and bottomSurface
   * @param {number} offset - Vertical offset to apply (positive = up, negative = down)
   */
  static applySurfaceSeparation(volume, offset) {
    if (!volume.topSurface || !volume.bottomSurface) {
      validationLogger.warn('Cannot apply separation: volume missing surface data');
      return;
    }
    
    // Apply offset to all surface points
    volume.topSurface.forEach(point => {
      point.z += offset;
    });
    
    volume.bottomSurface.forEach(point => {
      point.z += offset;
    });

  }

  /**
   * Stitch adjacent layers to eliminate gaps between strata
   * Makes each shallower layer's bottom surface match the deeper layer's top surface
   *
   * @param {Array} volumesWithDepth - Array of {volume, avgDepth} sorted by depth (deepest first)
   */
  static stitchAdjacentLayers(volumesWithDepth) {
    if (volumesWithDepth.length < 2) return;

    // volumesWithDepth[0] is deepest, volumesWithDepth[N-1] is shallowest
    // We iterate from deepest to shallowest, stitching each pair
    for (let i = 0; i < volumesWithDepth.length - 1; i++) {
      const deeperVolume = volumesWithDepth[i].volume;
      const shallowerVolume = volumesWithDepth[i + 1].volume;

      // Skip if either volume is missing surface data or is a pocket/isolated
      if (!deeperVolume.topSurface || !shallowerVolume.bottomSurface) {
        continue;
      }
      if (deeperVolume.type === 'pocket' || shallowerVolume.type === 'pocket') {
        continue;
      }

      // Check if surfaces have matching grid points (same resolution)
      if (deeperVolume.topSurface.length !== shallowerVolume.bottomSurface.length) {
        geologicalLogger.warn(`Cannot stitch layers: mismatched surface sizes (${deeperVolume.topSurface.length} vs ${shallowerVolume.bottomSurface.length})`);
        continue;
      }

      // Calculate average gap to decide if stitching is needed
      let totalGap = 0;
      let gapCount = 0;
      for (let j = 0; j < deeperVolume.topSurface.length; j++) {
        const deeperTop = deeperVolume.topSurface[j].z;
        const shallowerBottom = shallowerVolume.bottomSurface[j].z;
        // Gap is positive if there's space between layers (shallowerBottom > deeperTop in negative coords)
        const gap = shallowerBottom - deeperTop;
        if (gap > 0) {
          totalGap += gap;
          gapCount++;
        }
      }

      // Only stitch if there's a meaningful gap (avg > 0.1 ft)
      const avgGap = gapCount > 0 ? totalGap / gapCount : 0;
      if (avgGap < 0.1) {
        continue; // Gap is negligible, no stitching needed
      }

      geologicalLogger.debug(`Stitching layers: ${deeperVolume.material} -> ${shallowerVolume.material}, avg gap: ${avgGap.toFixed(2)} ft`);

      // Stitch by adjusting the shallower layer's bottom to match the deeper layer's top
      // This preserves the deeper layer's interpolation and adjusts the shallower one
      for (let j = 0; j < shallowerVolume.bottomSurface.length; j++) {
        const deeperTopZ = deeperVolume.topSurface[j].z;
        const shallowerBottomZ = shallowerVolume.bottomSurface[j].z;
        const gap = shallowerBottomZ - deeperTopZ;

        if (gap > 0) {
          // === CONFIDENCE PENALTY: Larger gaps = more inference = lower confidence ===
          // Gap-proportional penalty: 0.1ft gap = 30% penalty, 2ft gap = 70% penalty
          const maxPenaltyGap = 2.0;  // 2ft gap = maximum penalty
          const normalizedGap = Math.min(1.0, gap / maxPenaltyGap);
          const confidencePenalty = 0.3 + (normalizedGap * 0.4);  // 30-70% range

          // Get existing confidence from interpolation (default to 1.0 if not present)
          const existingBottomConf = shallowerVolume.bottomSurface[j].confidence ?? 1.0;
          const existingTopConf = shallowerVolume.topSurface[j].confidence ?? 1.0;

          // === EXISTING: Distribute the gap correction ===
          shallowerVolume.bottomSurface[j].z = deeperTopZ;

          // === NEW: Apply confidence penalty to bottom surface ===
          shallowerVolume.bottomSurface[j].confidence = existingBottomConf * (1 - confidencePenalty);
          shallowerVolume.bottomSurface[j].isStitched = true;

          // Also adjust top surface proportionally to maintain layer thickness
          const originalThickness = shallowerVolume.topSurface[j].z - shallowerBottomZ;
          if (originalThickness > 0.1) { // Only preserve thickness if significant
            shallowerVolume.topSurface[j].z = deeperTopZ + originalThickness;

            // === NEW: Apply reduced penalty to top surface (half, since less affected) ===
            shallowerVolume.topSurface[j].confidence = existingTopConf * (1 - confidencePenalty * 0.5);
            shallowerVolume.topSurface[j].isStitched = true;
          }
        }
      }

      // Mark both volumes as stitched for debugging
      deeperVolume.stitchedAbove = shallowerVolume.material;
      shallowerVolume.stitchedBelow = deeperVolume.material;
    }
  }

  /**
   * Regenerate volume geometry after surface separation
   * @param {Object} volume - Volume object with modified surfaces
   * @param {Object} extent - Site extent bounds
   * @param {number} gridResolution - Grid resolution
   */
  static regenerateVolumeGeometry(volume, extent, gridResolution) {
    if (!volume.topSurface || !volume.bottomSurface || !volume.material) {
      validationLogger.warn('Cannot regenerate geometry: volume missing required data');
      return;
    }

    // Recreate the volume mesh with the modified surfaces
    // Use stored options from original volume creation
    const newVolumeData = this.createLayerVolume(
      volume.topSurface,
      volume.bottomSurface,
      volume.material,
      extent,
      gridResolution,
      {
        opacity: volume.opacity || 0.3,
        showConfidenceVisualization: volume.showConfidenceVisualization || false
      }
    );

    // Replace the old geometry data with the new separated geometry
    volume.vertices = newVolumeData.vertices;
    volume.indices = newVolumeData.indices;
    volume.colors = newVolumeData.colors;
    volume.alphas = newVolumeData.alphas;  // Include alphas for confidence visualization
    volume.normals = newVolumeData.normals;
    volume.uvs = newVolumeData.uvs;
    volume.vertexCount = newVolumeData.vertexCount;
    volume.indexCount = newVolumeData.indexCount;

  }

  /**
   * Advanced layer interpolation using multiple methods
   * @param {Array} layerPoints - Layer data points with (Math.abs(bottom) < EPSILON ? 0 : top / bottom) elevations
   * @param {Object} extent - Site extent bounds
   * @param {number} gridResolution - Grid resolution
   * @param {Object} options - Interpolation options
   * @returns {Object} Result with topSurface and bottomSurface arrays
   */
  static advancedLayerInterpolation(layerPoints, extent, gridResolution, options = {}) {
    const {
      method = 'kriging',
      enableConfidenceMapping = false,
      variogramModel = 'spherical',
      range = 25,
      nugget = 0.1,
      sill = 1.0,
      basisFunction = 'multiquadric',
      shapeParameter = 1.0,
      power = 2
    } = options;

    // Generate grid points
    const grid = SpatialInterpolationEngine.generateGrid(extent, gridResolution);

    // Prepare data points for advanced interpolation
    const topDataPoints = layerPoints.map(p => ({
      x: p.x || 0,
      y: p.y || 0,
      value: p.topZ || p.z || 0
    }));

    const bottomDataPoints = layerPoints.map(p => ({
      x: p.x || 0,
      y: p.y || 0,
      value: p.bottomZ || ((p.topZ || p.z || 0) - (p.thickness || 1))
    }));

    // Set up interpolation options for AdvancedInterpolationEngine
    const engineOptions = {
      methods: [method],
      qualityWeighting: true,
      confidence: enableConfidenceMapping,
      // Kriging options
      variogramModel,
      range,
      nugget,
      sill,
      // RBF options
      basisFunction,
      shapeParameter,
      // IDW options
      basePower: power,
      adaptivePower: method === 'idw'
    };

    const topSurface = [];
    const bottomSurface = [];

    // Interpolate each grid point
    grid.forEach((gridPoint, index) => {
      try {
        // Interpolate top surface
        const topResult = method === 'multi_method' 
          ? AdvancedInterpolationEngine.multiMethodInterpolation(gridPoint, topDataPoints, engineOptions)
          : this.interpolateWithAdvancedMethod(gridPoint, topDataPoints, method, engineOptions);

        // Interpolate bottom surface
        const bottomResult = method === 'multi_method'
          ? AdvancedInterpolationEngine.multiMethodInterpolation(gridPoint, bottomDataPoints, engineOptions)
          : this.interpolateWithAdvancedMethod(gridPoint, bottomDataPoints, method, engineOptions);

        // Ensure bottom is below top (geological constraint)
        let bottomZ = bottomResult.value;
        if (bottomZ >= topResult.value) {
          bottomZ = topResult.value - 0.1; // Minimum 10cm thickness
        }

        const topPoint = {
          x: gridPoint.x,
          y: gridPoint.y,
          z: topResult.value
        };

        const bottomPoint = {
          x: gridPoint.x,
          y: gridPoint.y,
          z: bottomZ
        };

        // Add confidence data if enabled
        if (enableConfidenceMapping) {
          topPoint.confidence = topResult.confidence || 0.5;
          topPoint.quality = topResult.quality || 0.5;
          bottomPoint.confidence = bottomResult.confidence || 0.5;
          bottomPoint.quality = bottomResult.quality || 0.5;
        }

        topSurface.push(topPoint);
        bottomSurface.push(bottomPoint);

      } catch (error) {
        // Fallback for individual point failures
        interpolationLogger.warn(`Advanced interpolation failed at point ${index}, using fallback`);
        
        const fallbackTop = this.fallbackInterpolation(gridPoint, topDataPoints);
        const fallbackBottom = this.fallbackInterpolation(gridPoint, bottomDataPoints);
        
        topSurface.push({
          x: gridPoint.x,
          y: gridPoint.y,
          z: fallbackTop,
          confidence: 0.3,
          quality: 0.3
        });

        bottomSurface.push({
          x: gridPoint.x,
          y: gridPoint.y,
          z: Math.min(fallbackBottom, fallbackTop - 0.1),
          confidence: 0.3,
          quality: 0.3
        });
      }
    });

    return {
      topSurface,
      bottomSurface
    };
  }

  /**
   * Helper method to call specific advanced interpolation methods
   */
  static interpolateWithAdvancedMethod(targetPoint, dataPoints, method, options) {
    switch (method) {
      case 'kriging':
        return AdvancedInterpolationEngine.simpleKriging(targetPoint, dataPoints, options);
      case 'rbf':
        return AdvancedInterpolationEngine.radialBasisFunction(targetPoint, dataPoints, options);
      case 'trend':
        return AdvancedInterpolationEngine.trendSurface(targetPoint, dataPoints, options);
      case 'idw':
        return AdvancedInterpolationEngine.enhancedIDW(targetPoint, dataPoints, options);
      default:
        return AdvancedInterpolationEngine.enhancedIDW(targetPoint, dataPoints, options);
    }
  }

  /**
   * Simple fallback interpolation (inverse distance weighting)
   */
  static fallbackInterpolation(targetPoint, dataPoints) {
    if (dataPoints.length === 0) return 0;
    if (dataPoints.length === 1) return dataPoints[0].value;

    let weightedSum = 0;
    let totalWeight = 0;

    dataPoints.forEach(dataPoint => {
      const dx = targetPoint.x - dataPoint.x;
      const dy = targetPoint.y - dataPoint.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < EPSILON) {
          // Point is at exact data location - skip this point
          return;
        }
      
      if (distance < 0.001) {
        // Very close to data point, return exact value
        return dataPoint.value;
      }
      
      const weight = 1 / (distance * distance);
      weightedSum += dataPoint.value * weight;
      totalWeight += weight;
    });

    return totalWeight > 0 ? (Math.abs(totalWeight) < EPSILON ? 0 : weightedSum / totalWeight) : 0;
  }

  // ===============================================================================
  // TEXTURE SYSTEM OPTIMIZATION NOTE:
  // All texture creation methods have been moved to TextureManager for:
  // - Better performance through intelligent caching
  // - Consistent scaling logic across all material types  
  // - Reduced code duplication and improved maintainability
  // - Memory optimization with automatic cleanup
  // 
  // Use textureManager.createSoilTexture() instead of VolumetricMeshGenerator texture methods
  // ===============================================================================

  /**
   * Get the default pattern for a material type with comprehensive fallbacks
   * @deprecated Use TextureManager for all texture operations
   * @param {string} materialType - Material type
   * @returns {string} Default pattern name
   */
  static getDefaultPattern(materialType) {
    // Input validation
    if (!materialType || typeof materialType !== 'string') {
      validationLogger.warn('Invalid material type for pattern selection:', materialType);
      return 'horizontal_lines';
    }
    
    const patterns = new Map([
      // USCS Gravel Materials
      ['gw', 'gravel_circles'],
      ['gp', 'gravel_circles'], 
      ['gm', 'gravel_silt'],
      ['gc', 'gravel_clay'],
      
      // USCS Sand Materials
      ['sw', 'sand_dots'],
      ['sp', 'sand_dots'],
      ['sm', 'sand_silt'],
      ['sc', 'sand_clay'],
      
      // USCS Fine-Grained Materials (Low plasticity)
      ['ml', 'horizontal_lines'],
      ['cl', 'horizontal_dashed'],
      ['ol', 'horizontal_lines_organic'],
      
      // USCS Fine-Grained Materials (High plasticity) 
      ['mh', 'diagonal_lines'],
      ['ch', 'diagonal_crosshatch'],
      ['oh', 'diagonal_lines_organic'],
      
      // USCS Highly Organic
      ['pt', 'organic_irregular'],
      
      // Legacy Materials (backward compatibility)
      ['clay', 'horizontal_dashed'],
      ['sand', 'sand_dots'], 
      ['gravel', 'gravel_circles'],
      ['rock', 'rock_pattern'],
      ['stone', 'rock_pattern'],
      ['silt', 'horizontal_lines'],
      ['fill', 'fill_pattern'],
      ['topsoil', 'topsoil_organic'],
      ['peat', 'organic_irregular'],
      
      // Additional fallbacks
      ['unknown', 'horizontal_lines'],
      ['default', 'horizontal_lines']
    ]);
    
    const normalizedType = materialType.toLowerCase().trim();
    const selectedPattern = patterns.get(normalizedType);
    
    if (!selectedPattern) {
      validationLogger.debug(`No specific pattern found for material '${materialType}', using default`);
      return 'horizontal_lines';
    }
    
    return selectedPattern;
  }

  /**
   * Render texture pattern based on type and settings with comprehensive error handling
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {string} pattern - Pattern type
   * @param {Object} options - Rendering options
   */
  static renderTexturePattern(ctx, pattern, options) {
    // Input validation
    if (!ctx || typeof ctx.beginPath !== 'function') {
      validationLogger.error('Invalid canvas context provided to renderTexturePattern');
      return;
    }
    
    if (!pattern || typeof pattern !== 'string') {
      validationLogger.warn('Invalid pattern type, using default:', pattern);
      pattern = 'horizontal_lines';
    }
    
    if (!options || typeof options !== 'object') {
      validationLogger.error('Invalid options provided to renderTexturePattern');
      return;
    }
    
    const { patternColor, strokeColor, adjustedSpacing, scale, materialType } = options;
    
    // Validate required options
    if (!patternColor || scale <= 0) {
      validationLogger.warn('Invalid rendering options:', { patternColor, scale });
      return;
    }
    
    try {
      switch (pattern) {
      // Legacy patterns (backward compatibility)
      case 'horizontal-lines':
        this.renderHorizontalLines(ctx, { patternColor, strokeColor, adjustedSpacing, scale });
        break;
      case 'dots':
        this.renderDots(ctx, { patternColor, strokeColor, adjustedSpacing, scale });
        break;
      case 'circles':
        this.renderCircles(ctx, { patternColor, strokeColor, adjustedSpacing, scale });
        break;
      case 'cross-hatch':
        this.renderCrossHatch(ctx, { patternColor, strokeColor, adjustedSpacing, scale });
        break;
      case 'diagonal-lines':
        this.renderDiagonalLines(ctx, { patternColor, strokeColor, adjustedSpacing, scale });
        break;
        
      // USCS Gravel Patterns
      case 'gravel_circles':
        this.renderGravelCircles(ctx, { patternColor, strokeColor, adjustedSpacing, scale });
        break;
      case 'gravel_silt':
        this.renderGravelSilt(ctx, { patternColor, strokeColor, adjustedSpacing, scale });
        break;
      case 'gravel_clay':
        this.renderGravelClay(ctx, { patternColor, strokeColor, adjustedSpacing, scale });
        break;
        
      // USCS Sand Patterns
      case 'sand_dots':
        this.renderSandDots(ctx, { patternColor, strokeColor, adjustedSpacing, scale });
        break;
      case 'sand_silt':
        this.renderSandSilt(ctx, { patternColor, strokeColor, adjustedSpacing, scale });
        break;
      case 'sand_clay':
        this.renderSandClay(ctx, { patternColor, strokeColor, adjustedSpacing, scale });
        break;
        
      // USCS Fine-Grained Patterns
      case 'horizontal_dashed':
        this.renderHorizontalDashed(ctx, { patternColor, strokeColor, adjustedSpacing, scale });
        break;
      case 'horizontal_lines_organic':
        this.renderHorizontalLinesOrganic(ctx, { patternColor, strokeColor, adjustedSpacing, scale });
        break;
      case 'diagonal_crosshatch':
        this.renderDiagonalCrosshatch(ctx, { patternColor, strokeColor, adjustedSpacing, scale });
        break;
      case 'diagonal_lines_organic':
        this.renderDiagonalLinesOrganic(ctx, { patternColor, strokeColor, adjustedSpacing, scale });
        break;
        
      // Organic and Specialized Patterns
      case 'organic_irregular':
        this.renderOrganicIrregular(ctx, { patternColor, strokeColor, adjustedSpacing, scale });
        break;
      case 'rock_pattern':
        this.renderRockPattern(ctx, { patternColor, strokeColor, adjustedSpacing, scale });
        break;
      case 'fill_pattern':
        this.renderFillPattern(ctx, { patternColor, strokeColor, adjustedSpacing, scale });
        break;
      case 'topsoil_organic':
        this.renderTopsoilOrganic(ctx, { patternColor, strokeColor, adjustedSpacing, scale });
        break;
        
      case 'none':
      case 'solid':
        // No pattern - just solid color
        break;
        
      // Additional fallback patterns
      case 'basic_lines':
        this.renderHorizontalLines(ctx, options);
        break;
      case 'basic_dots':
        this.renderDots(ctx, options);
        break;
      case 'basic_crosshatch':
        this.renderCrossHatch(ctx, options);
        break;
        
      default:
        validationLogger.debug(`Unknown pattern type '${pattern}', attempting fallback`);
        // Try to use material-specific pattern as fallback
        if (materialType && materialType !== 'unknown') {
          this.renderMaterialSpecificPattern(ctx, materialType, options);
        } else {
          // Ultimate fallback - basic horizontal lines
          validationLogger.warn(`Using ultimate fallback pattern for '${pattern}'`);
          this.renderHorizontalLines(ctx, options);
        }
        break;
      }
    } catch (error) {
      validationLogger.error('Error rendering texture pattern:', error, { pattern, materialType });
      // Emergency fallback - render basic horizontal lines
      try {
        this.renderHorizontalLines(ctx, options);
      } catch (fallbackError) {
        validationLogger.error('Even fallback pattern failed:', fallbackError);
        // At this point, we just leave the solid color
      }
    }
  }

  /**
   * Render horizontal lines pattern
   */
  static renderHorizontalLines(ctx, options) {
    const { patternColor, strokeColor, adjustedSpacing, scale } = options;
    const spacing = Math.max(6, adjustedSpacing);
    
    // Primary horizontal lines
    ctx.strokeStyle = patternColor;
    ctx.lineWidth = 4 * scale;
    for (let y = 8; y < 128; y += spacing) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(128, y);
      ctx.stroke();
    }
    
    // Fill gaps with thinner lines
    ctx.lineWidth = 2 * scale;
    for (let y = 2; y < 128; y += spacing) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(128, y);
      ctx.stroke();
    }
    
    // Add definition with subtle outlines
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 1 * scale;
    for (let y = 8; y < 128; y += spacing * 2) {
      ctx.beginPath();
      ctx.moveTo(0, y - 2);
      ctx.lineTo(128, y - 2);
      ctx.stroke();
    }
  }

  /**
   * Render dots pattern
   */
  static renderDots(ctx, options) {
    const { patternColor, strokeColor, adjustedSpacing, scale } = options;
    const spacing = Math.max(8, adjustedSpacing);
    const dotSize = 5 * scale;
    
    // Primary grid of dots
    ctx.fillStyle = patternColor;
    for (let x = 8; x < 128; x += spacing) {
      for (let y = 8; y < 128; y += spacing) {
        ctx.beginPath();
        ctx.arc(x, y, dotSize, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    
    // Secondary offset grid to fill gaps
    const offsetSize = 3 * scale;
    for (let x = 15; x < 128; x += spacing) {
      for (let y = 15; y < 128; y += spacing) {
        ctx.beginPath();
        ctx.arc(x, y, offsetSize, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    
    // Subtle outlines for definition
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 1 * scale;
    for (let x = 8; x < 128; x += spacing * 2) {
      for (let y = 8; y < 128; y += spacing * 2) {
        ctx.beginPath();
        ctx.arc(x, y, dotSize, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }

  /**
   * Render circles pattern  
   */
  static renderCircles(ctx, options) {
    const { patternColor, strokeColor, adjustedSpacing, scale } = options;
    const spacing = Math.max(12, adjustedSpacing * 1.5);
    
    // Primary gravel particles (regular grid)
    ctx.fillStyle = patternColor;
    for (let x = 10; x < 128; x += spacing) {
      for (let y = 10; y < 128; y += spacing) {
        const size = (6 + (Math.sin(x * 0.1) + Math.cos(y * 0.1)) * 2) * scale; // Deterministic variation
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    
    // Secondary offset particles to fill gaps
    for (let x = 19; x < 128; x += spacing) {
      for (let y = 19; y < 128; y += spacing) {
        const size = (4 + (Math.sin(x * 0.15) + Math.cos(y * 0.15)) * 1.5) * scale;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    
    // Subtle outlines for definition
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 1 * scale;
    for (let x = 10; x < 128; x += spacing * 2) {
      for (let y = 10; y < 128; y += spacing * 2) {
        ctx.beginPath();
        ctx.arc(x, y, 8 * scale, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }

  /**
   * Render cross-hatch pattern
   */
  static renderCrossHatch(ctx, options) {
    const { patternColor, strokeColor, adjustedSpacing, scale } = options;
    const spacing = Math.max(6, adjustedSpacing * 0.8);
    
    // Primary horizontal and vertical lines
    ctx.strokeStyle = patternColor;
    ctx.lineWidth = 3 * scale;
    for (let i = 4; i < 128; i += spacing) {
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(128, i);
      ctx.moveTo(i, 0);
      ctx.lineTo(i, 128);
      ctx.stroke();
    }
    
    // Secondary offset lines to fill gaps
    ctx.lineWidth = 2 * scale;
    for (let i = 9; i < 128; i += spacing) {
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(128, i);
      ctx.moveTo(i, 0);
      ctx.lineTo(i, 128);
      ctx.stroke();
    }
    
    // Subtle outline grid for definition
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 1 * scale;
    for (let i = 4; i < 128; i += spacing * 2) {
      ctx.beginPath();
      ctx.moveTo(i - 1, 0);
      ctx.lineTo(i - 1, 128);
      ctx.moveTo(0, i - 1);
      ctx.lineTo(128, i - 1);
      ctx.stroke();
    }
  }

  /**
   * Render diagonal lines pattern
   */
  static renderDiagonalLines(ctx, options) {
    const { patternColor, strokeColor, adjustedSpacing, scale } = options;
    const spacing = Math.max(10, adjustedSpacing * 1.3);
    
    // Primary diagonal lines
    ctx.strokeStyle = patternColor;
    ctx.lineWidth = 4 * scale;
    for (let i = -64; i < 192; i += spacing) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + 128, 128);
      ctx.stroke();
    }
    
    // Secondary offset diagonal lines to fill gaps
    ctx.lineWidth = 2 * scale;
    for (let i = -56; i < 192; i += spacing) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + 128, 128);
      ctx.stroke();
    }
    
    // Subtle cross-diagonals for texture richness
    ctx.lineWidth = 1 * scale;
    for (let i = -32; i < 160; i += spacing * 2) {
      ctx.beginPath();
      ctx.moveTo(i + 128, 0);
      ctx.lineTo(i, 128);
      ctx.stroke();
    }
    
    // Minimal outlines for definition
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 1 * scale;
    for (let i = -64; i < 192; i += spacing * 3) {
      ctx.beginPath();
      ctx.moveTo(i - 1, 0);
      ctx.lineTo(i + 127, 128);
      ctx.stroke();
    }
  }

  /**
   * Render material-specific pattern with robust fallbacks
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {string} materialType - Material type identifier
   * @param {Object} options - Rendering options
   */
  static renderMaterialSpecificPattern(ctx, materialType, options) {
    try {
      // Use default pattern for the material type
      const defaultPattern = this.getDefaultPattern(materialType);
      
      // Avoid infinite recursion by checking if we're already using a fallback
      if (defaultPattern === 'horizontal_lines' && materialType !== 'unknown') {
        this.renderHorizontalLines(ctx, options);
      } else {
        this.renderTexturePattern(ctx, defaultPattern, options);
      }
    } catch (error) {
      validationLogger.warn('Error rendering material-specific pattern:', error);
      // Ultimate fallback - render basic horizontal lines
      this.renderHorizontalLines(ctx, options);
    }
  }

  // ========== USCS-SPECIFIC PATTERN RENDERING METHODS ==========

  /**
   * Render USCS gravel pattern - large circles for GW/GP
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {Object} options - Rendering options
   * @param {string} options.patternColor - Primary pattern color
   * @param {number} options.adjustedSpacing - Spacing between elements
   * @param {number} options.scale - Scale factor for pattern elements
   */
  static renderGravelCircles(ctx, options) {
    const { patternColor, adjustedSpacing, scale } = options;
    const spacing = Math.max(16, adjustedSpacing * 2);
    
    // Validate inputs
    if (!ctx || !patternColor || scale <= 0) {
      validationLogger.warn('Invalid parameters for renderGravelCircles');
      return;
    }
    
    // Large gravel particles
    ctx.fillStyle = patternColor;
    const PI2 = Math.PI * 2; // Cache for performance
    
    for (let x = 12; x < 128; x += spacing) {
      for (let y = 12; y < 128; y += spacing) {
        const size = (8 + (Math.sin(x * 0.08) + Math.cos(y * 0.08)) * 3) * scale;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, PI2);
        ctx.fill();
      }
    }
    
    // Offset particles for natural distribution
    for (let x = 24; x < 128; x += spacing) {
      for (let y = 24; y < 128; y += spacing) {
        const size = (6 + (Math.sin(x * 0.12) + Math.cos(y * 0.12)) * 2) * scale;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, PI2);
        ctx.fill();
      }
    }
  }

  /**
   * Render USCS silty gravel pattern - circles with horizontal lines for GM
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {Object} options - Rendering options
   */
  static renderGravelSilt(ctx, options) {
    // First render gravel circles
    this.renderGravelCircles(ctx, options);
    
    // Add horizontal silt lines
    const { strokeColor, adjustedSpacing, scale } = options;
    
    if (!strokeColor) {
      validationLogger.warn('Missing strokeColor for renderGravelSilt');
      return;
    }
    
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 2 * scale;
    const spacing = Math.max(12, adjustedSpacing * 1.5);
    
    ctx.beginPath();
    for (let y = 6; y < 128; y += spacing) {
      ctx.moveTo(0, y);
      ctx.lineTo(128, y);
    }
    ctx.stroke();
  }

  /**
   * Render USCS clayey gravel pattern - circles with clay indication for GC
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {Object} options - Rendering options
   */
  static renderGravelClay(ctx, options) {
    // First render gravel circles
    this.renderGravelCircles(ctx, options);
    
    // Add subtle clay binding indication
    const { strokeColor, scale } = options;
    
    if (!strokeColor) {
      validationLogger.warn('Missing strokeColor for renderGravelClay');
      return;
    }
    
    const originalAlpha = ctx.globalAlpha;
    ctx.fillStyle = strokeColor;
    ctx.globalAlpha = 0.3;
    
    // Small clay patches between gravel
    const claySize = 4 * scale;
    for (let x = 8; x < 128; x += 24) {
      for (let y = 8; y < 128; y += 24) {
        ctx.fillRect(x, y, claySize, claySize);
      }
    }
    ctx.globalAlpha = originalAlpha;
  }

  /**
   * Render USCS sand pattern - small dots for SW/SP
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {Object} options - Rendering options
   */
  static renderSandDots(ctx, options) {
    const { patternColor, adjustedSpacing, scale } = options;
    const spacing = Math.max(6, adjustedSpacing * 0.8);
    const dotSize = 2.5 * scale;
    const offsetSize = 1.5 * scale;
    
    if (!patternColor || scale <= 0) {
      validationLogger.warn('Invalid parameters for renderSandDots');
      return;
    }
    
    // Fine sand grain pattern
    ctx.fillStyle = patternColor;
    const PI2 = Math.PI * 2;
    
    // Primary grid
    for (let x = 4; x < 128; x += spacing) {
      for (let y = 4; y < 128; y += spacing) {
        ctx.beginPath();
        ctx.arc(x, y, dotSize, 0, PI2);
        ctx.fill();
      }
    }
    
    // Offset grid for density
    for (let x = 7; x < 128; x += spacing) {
      for (let y = 7; y < 128; y += spacing) {
        ctx.beginPath();
        ctx.arc(x, y, offsetSize, 0, PI2);
        ctx.fill();
      }
    }
  }

  /**
   * Render USCS silty sand pattern - dots with horizontal lines for SM
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {Object} options - Rendering options
   */
  static renderSandSilt(ctx, options) {
    // First render sand dots
    this.renderSandDots(ctx, options);
    
    // Add horizontal silt lines
    const { strokeColor, adjustedSpacing, scale } = options;
    
    if (!strokeColor) {
      validationLogger.warn('Missing strokeColor for renderSandSilt');
      return;
    }
    
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 1 * scale;
    const spacing = Math.max(10, adjustedSpacing * 1.2);
    
    ctx.beginPath();
    for (let y = 5; y < 128; y += spacing) {
      ctx.moveTo(0, y);
      ctx.lineTo(128, y);
    }
    ctx.stroke();
  }

  /**
   * Render USCS clayey sand pattern - dots with clay indication for SC
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {Object} options - Rendering options
   */
  static renderSandClay(ctx, options) {
    // First render sand dots
    this.renderSandDots(ctx, options);
    
    // Add clay binding indication
    const { strokeColor, scale } = options;
    
    if (!strokeColor) {
      validationLogger.warn('Missing strokeColor for renderSandClay');
      return;
    }
    
    const originalAlpha = ctx.globalAlpha;
    ctx.fillStyle = strokeColor;
    ctx.globalAlpha = 0.2;
    
    // Small clay patches
    const claySize = 3 * scale;
    for (let x = 6; x < 128; x += 16) {
      for (let y = 6; y < 128; y += 16) {
        ctx.fillRect(x, y, claySize, claySize);
      }
    }
    ctx.globalAlpha = originalAlpha;
  }

  /**
   * Render USCS dashed horizontal lines for CL (lean clay)
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {Object} options - Rendering options
   */
  static renderHorizontalDashed(ctx, options) {
    const { patternColor, adjustedSpacing, scale } = options;
    const spacing = Math.max(8, adjustedSpacing);
    
    if (!patternColor || scale <= 0) {
      validationLogger.warn('Invalid parameters for renderHorizontalDashed');
      return;
    }
    
    ctx.strokeStyle = patternColor;
    ctx.lineWidth = 3 * scale;
    ctx.setLineDash([8 * scale, 4 * scale]);
    
    ctx.beginPath();
    for (let y = 6; y < 128; y += spacing) {
      ctx.moveTo(0, y);
      ctx.lineTo(128, y);
    }
    ctx.stroke();
    
    // Reset line dash
    ctx.setLineDash([]);
  }

  /**
   * Render horizontal lines with organic indication for OL
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {Object} options - Rendering options
   */
  static renderHorizontalLinesOrganic(ctx, options) {
    // First render regular horizontal lines
    this.renderHorizontalLines(ctx, options);
    
    // Add organic matter indication
    const { strokeColor, scale } = options;
    
    if (!strokeColor) {
      validationLogger.warn('Missing strokeColor for renderHorizontalLinesOrganic');
      return;
    }
    
    const originalAlpha = ctx.globalAlpha;
    ctx.fillStyle = strokeColor;
    ctx.globalAlpha = 0.4;
    
    // Organic patches
    const organicSize = 3 * scale;
    const PI2 = Math.PI * 2;
    for (let x = 10; x < 128; x += 20) {
      for (let y = 10; y < 128; y += 20) {
        // Irregular organic shapes
        ctx.beginPath();
        ctx.arc(x, y, organicSize, 0, PI2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = originalAlpha;
  }

  /**
   * Render diagonal crosshatch pattern for CH (fat clay)
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {Object} options - Rendering options
   */
  static renderDiagonalCrosshatch(ctx, options) {
    const { patternColor, adjustedSpacing, scale } = options;
    const spacing = Math.max(8, adjustedSpacing);
    
    if (!patternColor || scale <= 0) {
      validationLogger.warn('Invalid parameters for renderDiagonalCrosshatch');
      return;
    }
    
    ctx.strokeStyle = patternColor;
    ctx.lineWidth = 2 * scale;
    
    // Primary diagonal lines (/)
    ctx.beginPath();
    for (let i = -64; i < 192; i += spacing) {
      ctx.moveTo(i, 0);
      ctx.lineTo(i + 128, 128);
    }
    ctx.stroke();
    
    // Secondary diagonal lines (\)
    ctx.beginPath();
    for (let i = -64; i < 192; i += spacing) {
      ctx.moveTo(i + 128, 0);
      ctx.lineTo(i, 128);
    }
    ctx.stroke();
  }

  /**
   * Render diagonal lines with organic indication for OH
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {Object} options - Rendering options
   */
  static renderDiagonalLinesOrganic(ctx, options) {
    // First render regular diagonal lines
    this.renderDiagonalLines(ctx, options);
    
    // Add organic matter indication
    const { strokeColor, scale } = options;
    
    if (!strokeColor) {
      validationLogger.warn('Missing strokeColor for renderDiagonalLinesOrganic');
      return;
    }
    
    const originalAlpha = ctx.globalAlpha;
    ctx.fillStyle = strokeColor;
    ctx.globalAlpha = 0.3;
    
    // Organic patches
    const organicSize = 4 * scale;
    const PI2 = Math.PI * 2;
    for (let x = 15; x < 128; x += 25) {
      for (let y = 15; y < 128; y += 25) {
        ctx.beginPath();
        ctx.arc(x, y, organicSize, 0, PI2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = originalAlpha;
  }

  /**
   * Render irregular organic pattern for PT (peat)
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {Object} options - Rendering options
   */
  static renderOrganicIrregular(ctx, options) {
    const { patternColor, strokeColor, scale } = options;
    
    if (!patternColor || !strokeColor || scale <= 0) {
      validationLogger.warn('Invalid parameters for renderOrganicIrregular');
      return;
    }
    
    ctx.fillStyle = patternColor;
    const PI2 = Math.PI * 2;
    
    // Pre-calculate random values for consistent pattern
    const randomSeed = 0.5; // Fixed seed for reproducible patterns
    let randIndex = 0;
    const getNextRandom = () => {
      randIndex = (randIndex * 1103515245 + 12345) & 0x7fffffff;
      return randIndex / 0x7fffffff;
    };
    
    // Irregular organic shapes with varying sizes
    for (let x = 8; x < 128; x += 12) {
      for (let y = 8; y < 128; y += 12) {
        const size = (4 + Math.sin(x * 0.2) * 3) * scale;
        const offsetX = Math.sin(y * 0.15) * 4;
        const offsetY = Math.cos(x * 0.15) * 4;
        
        ctx.beginPath();
        // Create organic irregular shape
        ctx.arc(x + offsetX, y + offsetY, size, 0, PI2);
        ctx.fill();
        
        // Add fibrous texture (deterministic)
        if (getNextRandom() > randomSeed) {
          ctx.strokeStyle = strokeColor;
          ctx.lineWidth = 1 * scale;
          ctx.beginPath();
          ctx.moveTo(x + offsetX - size, y + offsetY);
          ctx.lineTo(x + offsetX + size, y + offsetY);
          ctx.stroke();
        }
      }
    }
  }

  /**
   * Render rock pattern with irregular fractures
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {Object} options - Rendering options
   */
  static renderRockPattern(ctx, options) {
    const { strokeColor, scale } = options;
    
    if (!strokeColor || scale <= 0) {
      validationLogger.warn('Invalid parameters for renderRockPattern');
      return;
    }
    
    // Base crosshatch pattern
    this.renderCrossHatch(ctx, options);
    
    // Add rock fracture lines
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 2 * scale;
    
    // Irregular fractures - optimized path drawing
    ctx.beginPath();
    ctx.moveTo(0, 20);
    ctx.lineTo(40, 35);
    ctx.lineTo(80, 25);
    ctx.lineTo(128, 40);
    ctx.moveTo(0, 80);
    ctx.lineTo(50, 90);
    ctx.lineTo(100, 85);
    ctx.lineTo(128, 95);
    ctx.stroke();
  }

  /**
   * Render fill pattern with mixed materials indication
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {Object} options - Rendering options
   */
  static renderFillPattern(ctx, options) {
    const { patternColor, scale } = options;
    
    if (!patternColor || scale <= 0) {
      validationLogger.warn('Invalid parameters for renderFillPattern');
      return;
    }
    
    // Base pattern - random mixed
    ctx.fillStyle = patternColor;
    const PI2 = Math.PI * 2;
    const debrisSize = 2 * scale;
    const rectSize = 4 * scale;
    
    // Random mixed material pattern
    for (let x = 5; x < 128; x += 15) {
      for (let y = 5; y < 128; y += 15) {
        const patternType = Math.floor((x + y) / 10) % 3;
        
        switch (patternType) {
          case 0: // Dots (sand-like)
            ctx.beginPath();
            ctx.arc(x, y, debrisSize, 0, PI2);
            ctx.fill();
            break;
          case 1: // Small circles (gravel-like)
            ctx.beginPath();
            ctx.arc(x, y, rectSize, 0, PI2);
            ctx.fill();
            break;
          case 2: // Small rectangles (debris)
            ctx.fillRect(x - debrisSize, y - debrisSize, rectSize, rectSize);
            break;
          default:
            // Fallback for unexpected pattern types
            ctx.beginPath();
            ctx.arc(x, y, debrisSize, 0, PI2);
            ctx.fill();
            break;
        }
      }
    }
  }

  /**
   * Render topsoil organic pattern
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {Object} options - Rendering options
   */
  static renderTopsoilOrganic(ctx, options) {
    // Base horizontal lines for soil structure
    this.renderHorizontalLines(ctx, options);
    
    // Add organic matter
    const { strokeColor, scale } = options;
    
    if (!strokeColor || scale <= 0) {
      validationLogger.warn('Invalid parameters for renderTopsoilOrganic');
      return;
    }
    
    const originalAlpha = ctx.globalAlpha;
    ctx.fillStyle = strokeColor;
    ctx.globalAlpha = 0.6;
    
    const rootSize = 2 * scale;
    const rootExtent = 5 * scale;
    const PI2 = Math.PI * 2;
    
    // Organic root and matter patterns
    for (let x = 12; x < 128; x += 18) {
      for (let y = 12; y < 128; y += 18) {
        // Root-like organic shapes
        ctx.beginPath();
        ctx.arc(x, y, rootSize, 0, PI2);
        ctx.fill();
        
        // Root extensions
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 1 * scale;
        ctx.beginPath();
        ctx.moveTo(x - rootExtent, y);
        ctx.lineTo(x + rootExtent, y);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = originalAlpha;
  }

  /**
   * Create a Three.js mesh from volume data
   * @param {Object} volumeData - Volume data from createLayerVolume
   * @param {Object} settings - Rendering settings
   * @param {Object} textureManager - Optional SoilTextureManager instance for texture support (deprecated)
   * @returns {Mesh} Three.js mesh object
   */
  static createThreeJsMesh(volumeData, settings = {}, textureManager = null, textureSettings = null, customColor = null, exportMode = false) {
    const {
      opacity = 0.8,
      wireframe = false,
      showConfidenceVisualization = false  // Per-vertex alpha based on confidence
      // Texture settings handled by textureSettings parameter
      // enableTextures = true, // Always enable textures by default
      // textureOptions = {}
    } = settings;

    // Create buffer geometry
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(volumeData.vertices, 3));
    geometry.setAttribute('color', new BufferAttribute(volumeData.colors, 3));
    geometry.setAttribute('normal', new BufferAttribute(volumeData.normals, 3));
    geometry.setAttribute('uv', new BufferAttribute(volumeData.uvs, 2));

    // Add per-vertex alpha attribute if confidence visualization is enabled
    const useConfidenceViz = showConfidenceVisualization && volumeData.alphas;
    if (useConfidenceViz) {
      geometry.setAttribute('alpha', new BufferAttribute(volumeData.alphas, 1));
    }

    // CRITICAL FIX: Create BufferAttribute for indices
    geometry.setIndex(new BufferAttribute(volumeData.indices, 1));

    // COORDINATE SYSTEM CONVERSION: Apply coordinate conversion for export mode
    if (exportMode) {
      scene3dLogger.debug('Converting geometry from display space to export space for export mode');
      
      // Calculate elevation offset from volume data if available
      let elevationOffset = 0;
      if (volumeData.elevationRange) {
        elevationOffset = volumeData.elevationRange.max || 0;
      } else {
        // Fallback: calculate from vertex positions
        const positions = geometry.attributes.position.array;
        let maxY = -Infinity;
        for (let i = 1; i < positions.length; i += 3) {
          maxY = Math.max(maxY, positions[i]);
        }
        elevationOffset = maxY > -Infinity ? maxY : 0;
      }
      
      // Convert geometry from display space (Y=elevation) to export space (Y=up)
      CoordinateSystemConverter.convertGeometryDisplayToExport(geometry, elevationOffset);
      
      scene3dLogger.debug('Coordinate system conversion completed', {
        elevationOffset,
        vertexCount: geometry.attributes.position.count
      });
    }

    // Compute normals for proper lighting
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();

    // Create material with strata-colored wireframes and progressive transparency
    // Use custom color if provided, otherwise fallback to default material color
    const materialColor = customColor ? new Color(customColor) : this.getMaterialColor(volumeData.material);
    
    // DEBUG: Log color application for troubleshooting

    // Apply visual enhancement properties for same-material layer distinction
    let finalOpacity = opacity;
    let enhancedProperties = {};
    
    if (volumeData.visualEnhancement) {
      finalOpacity = volumeData.visualEnhancement.opacity || opacity;
      
      if (volumeData.visualEnhancement.outline) {
        // Enhanced visibility for deeper layers using emissive properties and opacity
        enhancedProperties.emissiveIntensity = 0.35; // Stronger self-illumination for enhanced visibility
        enhancedProperties.emissiveBoost = 0.15; // Additional emissive color boost
        // Keep as solid volume - NO wireframe mode
      }

    }

    // Enhanced emissive color calculation for better visual distinction
    const baseEmissive = 0.1;
    const emissiveBoost = enhancedProperties.emissiveBoost || 0;
    const finalEmissiveIntensity = enhancedProperties.emissiveIntensity || 0.15;
    
    // Base material properties with visual enhancements applied
    const materialProps = {
      color: materialColor,
      side: DoubleSide,
      transparent: true,
      opacity: finalOpacity,
      wireframe: wireframe, // Keep original wireframe setting, no enhancement override
      wireframeLinewidth: wireframe ? 1.5 : 1,
      // Enhanced transparency settings for proper alpha blending
      // depthWrite = false prevents semi-transparent layers from blocking layers behind
      // Combined with manual render order sorting in ThreeJsContext, this prevents striping
      alphaTest: 0.01,
      depthWrite: finalOpacity > 0.9, // Only write depth when nearly opaque (striping fix)
      depthTest: true, // Always test against depth buffer
      blending: NormalBlending,
      // Enhanced self-illumination for visual distinction
      emissive: new Color().setRGB(
        Math.min(1.0, materialColor.r * (baseEmissive + emissiveBoost)), 
        Math.min(1.0, materialColor.g * (baseEmissive + emissiveBoost)), 
        Math.min(1.0, materialColor.b * (baseEmissive + emissiveBoost))
      ),
      emissiveIntensity: finalEmissiveIntensity
    };

    // Apply simple soil texture based on material type - ENHANCED for side walls
    if (volumeData.material) {
      try {
        // Use global texture settings but with material-specific patterns
        const materialTextureOptions = textureSettings && textureSettings.enabled ? {
          enabled: true,
          intensity: textureSettings.globalIntensity || 0.7,
          scale: textureSettings.patternScale || 1.0,
          pattern: null // Use default pattern for material type
        } : { enabled: false };

        // Create enhanced texture with dynamic settings
        // Convert Color to hex string for TextureManager
        const colorHex = materialColor instanceof Color ? `#${materialColor.getHexString()}` : materialColor;
        const materialTexture = textureManager.createSoilTexture(volumeData.material, colorHex, materialTextureOptions);
        
        if (materialTexture) {
          // Set texture wrap and filtering without repeat scaling (scale is handled in pattern generation)
          materialTexture.wrapS = RepeatWrapping;
          materialTexture.wrapT = RepeatWrapping;
          materialTexture.repeat.set(1, 1); // No repeat - scale is handled in pattern drawing
          materialTexture.needsUpdate = true;
          
          materialProps.map = materialTexture;

        }
        
      } catch (error) {
        scene3dLogger.warn(`Failed to apply texture to ${volumeData.material}:`, error);
        // Continue without texture - material will use base color
      }
    }

    // Create material with all properties (including enhanced texture if applied)
    // Use MeshStandardMaterial for better GLTF export compatibility
    const material = new MeshStandardMaterial({
      ...materialProps,
      roughness: 0.8,  // Add realistic roughness for geological materials
      metalness: 0.0   // Geological materials are non-metallic
    });

    // Apply per-vertex alpha via shader modification for confidence visualization
    if (useConfidenceViz) {
      material.onBeforeCompile = (shader) => {
        // === VERTEX SHADER: Pass alpha attribute to fragment shader ===
        shader.vertexShader = shader.vertexShader.replace(
          '#include <common>',
          `#include <common>
           attribute float alpha;
           varying float vAlpha;`
        );
        shader.vertexShader = shader.vertexShader.replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
           vAlpha = alpha;`
        );

        // === FRAGMENT SHADER: Apply per-vertex alpha to final color ===
        shader.fragmentShader = shader.fragmentShader.replace(
          '#include <common>',
          `#include <common>
           varying float vAlpha;`
        );
        shader.fragmentShader = shader.fragmentShader.replace(
          '#include <dithering_fragment>',
          `#include <dithering_fragment>
           gl_FragColor.a *= vAlpha;`
        );
      };
      material.needsUpdate = true;
    }

    // CRITICAL: Ensure proper texture orientation for vertical walls
    if (material.map) {
      // Force texture to update and optimize for vertical display
      material.needsUpdate = true;
    }

    // Create mesh
    const mesh = new Mesh(geometry, material);
    mesh.userData = {
      type: 'VolumetricGeologicalLayer',
      material: volumeData.material,
      isVolumetricModel: true,
      vertexCount: volumeData.vertexCount,
      indexCount: volumeData.indexCount
    };

    // Add confidence-based visual indicators
    const averageConfidence = volumeData.confidence || 1.0;
    
    // Adjust opacity based on confidence (but maintain minimum visibility)
    if (averageConfidence < 1.0) {
      // Ensure minimum opacity of 0.4 for visibility even with low confidence
      material.opacity *= Math.max(0.4, averageConfidence);
      mesh.userData.confidence = averageConfidence;

    }
    
    // Add visual warning indicators only for VERY low confidence areas
    // Lowered threshold to 0.3 to avoid yellow lines for common missing strata scenarios
    if (averageConfidence < 0.3) {
      // Create subtle edge highlighting for very low confidence
      try {
        const edges = new EdgesGeometry(geometry);
        const edgeMaterial = new LineBasicMaterial({
          color: 0xffaa00, // Softer orange-yellow warning color
          linewidth: 1,     // Thinner lines
          transparent: true,
          opacity: 0.3      // More transparent
        });
        const edgeLines = new LineSegments(edges, edgeMaterial);
        edgeLines.userData = {
          type: 'ConfidenceWarning',
          confidence: averageConfidence
        };
        mesh.add(edgeLines);

      } catch (error) {
        scene3dLogger.warn(`Failed to create confidence warning edges:`, error);
      }
    }

    // Add geological interpolation metadata to userData
    if (volumeData.gapsBridged) {
      mesh.userData.gapsBridged = true;
      mesh.userData.interpolationMethod = 'geological-bridging';
    }

    // Disable shadows for better internal visibility
    mesh.castShadow = false;
    mesh.receiveShadow = false;

    return mesh;
  }

  /**
   * Advanced layer interpolation using multiple methods for maximum accuracy
   * @param {Array} layerPoints - Layer data points
   * @param {Object} extent - Site extent
   * @param {number} resolution - Grid resolution
   * @param {Object} options - Interpolation options
   * @returns {Object} Enhanced layer surface data
   */
  static advancedLayerInterpolationLegacy(layerPoints, extent, resolution, options = {}) {
    const {
      methods = ['idw', 'kriging', 'rbf']
    } = options;

    const gridSize = resolution;
    const stepX = (extent.maxX - extent.minX) / (gridSize - 1);
    const stepY = (extent.maxY - extent.minY) / (gridSize - 1);
    
    const topSurface = [];
    const bottomSurface = [];
    const qualityMap = [];

    // Generate high-accuracy interpolated surfaces
    for (let i = 0; i < gridSize; i++) {
      for (let j = 0; j < gridSize; j++) {
        const x = extent.minX + stepX * i;
        const y = extent.minY + stepY * j;
        const targetPoint = { x, y };

        // Use advanced multi-method interpolation with geological trends
        const interpolationOptions = { 
          methods, 
          qualityWeighting: true, 
          confidence: true 
        };
        
        // Apply geological trends if available
        if (options.geologicalTrends && options.geologicalTrends.strength > 0.2) {
          interpolationOptions.anisotropy = options.geologicalTrends.anisotropy;
          interpolationOptions.geologicalTrend = options.geologicalTrends.structuralTrend;
        }

        const topResult = AdvancedInterpolationEngine.multiMethodInterpolation(
          targetPoint,
          layerPoints.map(p => ({ x: p.x, y: p.y, value: p.topZ })),
          interpolationOptions
        );

        const bottomResult = AdvancedInterpolationEngine.multiMethodInterpolation(
          targetPoint,
          layerPoints.map(p => ({ x: p.x, y: p.y, value: p.bottomZ })),
          interpolationOptions
        );

        // Quality assessment
        const avgQuality = (topResult.quality + bottomResult.quality) / 2;
        const avgConfidence = (topResult.confidence + bottomResult.confidence) / 2;

        topSurface.push({
          x,
          y: y, // North-South coordinate
          z: topResult.value, // Elevation
          quality: topResult.quality,
          confidence: topResult.confidence,
          method: topResult.method
        });

        bottomSurface.push({
          x,
          y: y, // North-South coordinate  
          z: bottomResult.value, // Elevation
          quality: bottomResult.quality,
          confidence: bottomResult.confidence,
          method: bottomResult.method
        });

        qualityMap.push({
          x, y,
          topQuality: topResult.quality,
          bottomQuality: bottomResult.quality,
          avgQuality,
          avgConfidence,
          thickness: topResult.value - bottomResult.value
        });
      }
    }

    const avgQuality = qualityMap.reduce((sum, q) => sum + q.avgQuality, 0) / qualityMap.length;
    const avgConfidence = qualityMap.reduce((sum, q) => sum + q.avgConfidence, 0) / qualityMap.length;

    return {
      topSurface,
      bottomSurface,
      qualityMap,
      metadata: {
        avgQuality,
        avgConfidence,
        methodsUsed: methods,
        interpolationPoints: layerPoints.length,
        gridResolution: resolution
      }
    };
  }

  /**
   * Generate adaptive grid with higher resolution in complex areas
   * @param {Array} layerPoints - Layer data points
   * @param {Object} extent - Site extent
   * @param {number} baseResolution - Base grid resolution
   * @param {Object} options - Adaptive grid options
   * @returns {Object} Adaptive grid data
   */
  static generateAdaptiveGrid(layerPoints, extent, baseResolution, options = {}) {
    const {
      complexityThreshold = 0.5,
      maxRefinementFactor = 2
    } = options;

    // Base grid generation
    const baseStepX = (extent.maxX - extent.minX) / (baseResolution - 1);
    const baseStepY = (extent.maxY - extent.minY) / (baseResolution - 1);
    
    const gridPoints = [];
    const complexityMap = [];
    let refinedZones = 0;

    // Analyze complexity for each base grid cell
    for (let i = 0; i < baseResolution - 1; i++) {
      for (let j = 0; j < baseResolution - 1; j++) {
        const cellX = extent.minX + baseStepX * i;
        const cellY = extent.minY + baseStepY * j;
        const cellCenterX = cellX + baseStepX * 0.5;
        const cellCenterY = cellY + baseStepY * 0.5;

        // Calculate local complexity metrics
        const complexity = this.calculateLocalComplexity(
          { x: cellCenterX, y: cellCenterY },
          layerPoints,
          Math.max(baseStepX, baseStepY) * 1.5
        );

        complexityMap.push({
          i, j,
          x: cellCenterX,
          y: cellCenterY,
          complexity,
          needsRefinement: complexity > complexityThreshold
        });

        // Generate base grid points
        const basePoints = [
          { x: cellX, y: cellY, level: 0 },
          { x: cellX + baseStepX, y: cellY, level: 0 },
          { x: cellX, y: cellY + baseStepY, level: 0 },
          { x: cellX + baseStepX, y: cellY + baseStepY, level: 0 }
        ];

        // Add refinement if needed
        if (complexity > complexityThreshold) {
          refinedZones++;
          const refinementFactor = Math.min(
            Math.ceil(complexity * maxRefinementFactor),
            maxRefinementFactor
          );

          // Add refined grid points within this cell
          const refinedStepX = (Math.abs(refinementFactor) < EPSILON ? 0 : baseStepX / refinementFactor);
          const refinedStepY = (Math.abs(refinementFactor) < EPSILON ? 0 : baseStepY / refinementFactor);

          for (let ri = 0; ri < refinementFactor; ri++) {
            for (let rj = 0; rj < refinementFactor; rj++) {
              const refinedX = cellX + refinedStepX * ri;
              const refinedY = cellY + refinedStepY * rj;
              
              basePoints.push({
                x: refinedX,
                y: refinedY,
                level: 1,
                complexity,
                refinementFactor
              });
            }
          }
        }

        gridPoints.push(...basePoints);
      }
    }

    // Remove duplicate points and sort by complexity
    const uniquePoints = GeometryUtils.removeDuplicateGridPoints(gridPoints);

    return {
      points: uniquePoints,
      totalPoints: uniquePoints.length,
      basePoints: uniquePoints.filter(p => p.level === 0).length,
      refinedPoints: uniquePoints.filter(p => p.level === 1).length,
      refinedZones,
      complexityMap,
      baseResolution,
      extent
    };
  }

  /**
   * Advanced interpolation with adaptive grid
   * @param {Array} layerPoints - Layer data points
   * @param {Object} extent - Site extent
   * @param {Object} adaptiveGrid - Adaptive grid data
   * @param {Object} options - Interpolation options
   * @returns {Object} Enhanced layer surface data
   */
  static advancedLayerInterpolationWithAdaptiveGrid(layerPoints, extent, adaptiveGrid, options = {}) {
    const {
      methods = ['idw', 'kriging', 'rbf']
    } = options;

    const topSurface = [];
    const bottomSurface = [];
    const qualityMap = [];

    // Interpolate at each adaptive grid point
    for (const gridPoint of adaptiveGrid.points) {
      const targetPoint = { x: gridPoint.x, y: gridPoint.y };

      // Use enhanced interpolation methods for high-complexity areas
      let interpolationMethods = gridPoint.level === 1 ? 
        ['idw', 'kriging', 'rbf', 'trend'] : // Enhanced methods for refined areas
        methods; // Standard methods for base grid

      // Apply geological trends if available
      if (options.geologicalTrends && options.geologicalTrends.strength > 0.2) {
        interpolationMethods = this.applyGeologicalTrendsToInterpolation(
          options.geologicalTrends, 
          interpolationMethods
        );
      }

      const interpolationOptions = { 
        methods: interpolationMethods, 
        qualityWeighting: true, 
        confidence: true 
      };

      // Enhanced anisotropy for refined grid points in trending areas
      if (options.geologicalTrends && options.geologicalTrends.strength > 0.2) {
        interpolationOptions.anisotropy = options.geologicalTrends.anisotropy;
        interpolationOptions.geologicalTrend = options.geologicalTrends.structuralTrend;
        
        // Boost anisotropy ratio for refined points in complex areas
        if (gridPoint.level === 1 && gridPoint.complexity > 0.5) {
          interpolationOptions.anisotropy = {
            ...interpolationOptions.anisotropy,
            ratio: Math.min(interpolationOptions.anisotropy.ratio * 1.5, 4)
          };
        }
      }

      // Top surface interpolation
      const topResult = AdvancedInterpolationEngine.multiMethodInterpolation(
        targetPoint,
        layerPoints.map(p => ({ x: p.x, y: p.y, value: p.topZ })),
        interpolationOptions
      );

      // Bottom surface interpolation
      const bottomResult = AdvancedInterpolationEngine.multiMethodInterpolation(
        targetPoint,
        layerPoints.map(p => ({ x: p.x, y: p.y, value: p.bottomZ })),
        interpolationOptions
      );

      // Enhanced quality assessment for refined points
      const qualityBonus = gridPoint.level === 1 ? 0.1 : 0;
      const adjustedTopQuality = Math.min(1.0, topResult.quality + qualityBonus);
      const adjustedBottomQuality = Math.min(1.0, bottomResult.quality + qualityBonus);

      topSurface.push({
        x: gridPoint.x,
        y: gridPoint.y,
        z: topResult.value,
        quality: adjustedTopQuality,
        confidence: topResult.confidence,
        method: topResult.method,
        level: gridPoint.level,
        complexity: gridPoint.complexity || 0
      });

      bottomSurface.push({
        x: gridPoint.x,
        y: gridPoint.y,
        z: bottomResult.value,
        quality: adjustedBottomQuality,
        confidence: bottomResult.confidence,
        method: bottomResult.method,
        level: gridPoint.level,
        complexity: gridPoint.complexity || 0
      });

      qualityMap.push({
        x: gridPoint.x,
        y: gridPoint.y,
        topQuality: adjustedTopQuality,
        bottomQuality: adjustedBottomQuality,
        avgQuality: (adjustedTopQuality + adjustedBottomQuality) / 2,
        level: gridPoint.level,
        complexity: gridPoint.complexity || 0
      });
    }

    const avgQuality = qualityMap.reduce((sum, q) => sum + q.avgQuality, 0) / qualityMap.length;
    const refinedPointsQuality = qualityMap.filter(q => q.level === 1).reduce((sum, q) => sum + q.avgQuality, 0) / 
                                Math.max(1, qualityMap.filter(q => q.level === 1).length);

    return {
      topSurface,
      bottomSurface,
      qualityMap,
      metadata: {
        avgQuality,
        refinedPointsQuality,
        totalPoints: adaptiveGrid.totalPoints,
        refinedZones: adaptiveGrid.refinedZones,
        methodsUsed: methods,
        adaptiveRefinement: true
      }
    };
  }

  /**
   * Calculate local geological complexity
   * @param {Object} centerPoint - Center point to analyze
   * @param {Array} layerPoints - Layer data points
   * @param {number} searchRadius - Search radius for analysis
   * @returns {number} Complexity score (0-1)
   */
  static calculateLocalComplexity(centerPoint, layerPoints, searchRadius) {
    // Find nearby points
    const nearbyPoints = layerPoints.filter(point => {
      const distance = Math.sqrt(
        Math.pow(point.x - centerPoint.x, 2) + 
        Math.pow(point.y - centerPoint.y, 2)
      );
      return distance <= searchRadius;
    });

    if (nearbyPoints.length < 2) return 0;

    // Calculate elevation variations
    const topElevations = nearbyPoints.map(p => p.topZ);
    const bottomElevations = nearbyPoints.map(p => p.bottomZ);
    const thicknesses = nearbyPoints.map(p => Math.abs(p.topZ - p.bottomZ));

    const topVariation = GeometryUtils.calculateVariation(topElevations);
    const bottomVariation = GeometryUtils.calculateVariation(bottomElevations);
    const thicknessVariation = GeometryUtils.calculateVariation(thicknesses);

    // Calculate gradients
    let maxGradient = 0;
    for (let i = 0; i < nearbyPoints.length; i++) {
      for (let j = i + 1; j < nearbyPoints.length; j++) {
        const p1 = nearbyPoints[i];
        const p2 = nearbyPoints[j];
        const distance = Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
        
        if (distance > 0) {
          const elevationDiff = Math.abs(p1.topZ - p2.topZ);
          const gradient = (Math.abs(distance) < EPSILON ? 0 : elevationDiff / distance);
          maxGradient = Math.max(maxGradient, gradient);
        }
      }
    }

    // Combine complexity factors
    const elevationComplexity = (topVariation + bottomVariation) / 2;
    const thicknessComplexity = thicknessVariation;
    const gradientComplexity = Math.min(maxGradient / 0.5, 1); // Normalize to 0.5 gradient = 1.0 complexity

    const overallComplexity = (elevationComplexity * 0.4 + thicknessComplexity * 0.3 + gradientComplexity * 0.3);
    
    return Math.min(1.0, overallComplexity);
  }


  /**
   * Analyze geological trends and directional patterns in the data
   * @param {Array} layerPoints - Layer data points  
   * @param {Object} extent - Site extent
   * @returns {Object} Geological trend analysis
   */
  static analyzeGeologicalTrends(layerPoints, extent) {

    if (layerPoints.length < 4) {
      return {
        primaryDirection: 0,
        secondaryDirection: 90,
        strength: 0,
        anisotropy: { angle: 0, ratio: 1 },
        structuralTrend: null
      };
    }

    // Calculate directional gradients
    const gradients = [];
    const elevationGradients = [];

    for (let i = 0; i < layerPoints.length; i++) {
      for (let j = i + 1; j < layerPoints.length; j++) {
        const p1 = layerPoints[i];
        const p2 = layerPoints[j];

        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < EPSILON) {
          // Points are at same location - continue processing
          continue;
        }

        if (distance > 1) { // Minimum 1m distance
          const angle = Math.atan2(dy, dx) * 180 / Math.PI;
          const normalizedAngle = angle < 0 ? angle + 360 : angle;

          const topElevationDiff = p2.topZ - p1.topZ;
          const bottomElevationDiff = p2.bottomZ - p1.bottomZ;
          const avgElevationDiff = (topElevationDiff + bottomElevationDiff) / 2;

          const gradient = Math.abs(avgElevationDiff / distance);

          gradients.push({
            angle: normalizedAngle,
            gradient,
            distance,
            elevationChange: avgElevationDiff
          });

          elevationGradients.push({
            angle: normalizedAngle,
            topGradient: Math.abs(topElevationDiff / distance),
            bottomGradient: Math.abs(bottomElevationDiff / distance),
            avgGradient: gradient
          });
        }
      }
    }

    // Analyze directional patterns using rose diagram approach
    const anglesBins = 36; // 10-degree bins
    const binSize = 360 / anglesBins;
    const directionalStrength = new Array(anglesBins).fill(0);
    const directionalCount = new Array(anglesBins).fill(0);

    gradients.forEach(grad => {
      const binIndex = Math.floor((Math.abs(binSize) < EPSILON ? 0 : grad.angle / binSize)) % anglesBins;
      directionalStrength[binIndex] += grad.gradient;
      directionalCount[binIndex]++;
    });

    // Calculate average strength per direction
    const avgDirectionalStrength = directionalStrength.map((strength, i) => 
      directionalCount[i] > 0 ? (Math.abs(directionalCount) < EPSILON ? 0 : strength / directionalCount)[i] : 0
    );

    // Find primary and secondary trend directions
    let maxStrength = 0;
    let primaryDirection = 0;
    let secondaryDirection = 90;

    avgDirectionalStrength.forEach((strength, i) => {
      if (strength > maxStrength) {
        maxStrength = strength;
        primaryDirection = i * binSize;
      }
    });

    // Find secondary direction (perpendicular or 90° offset patterns)
    const perpendicularBin1 = Math.floor((primaryDirection + 90) / binSize) % anglesBins;
    const perpendicularBin2 = Math.floor((primaryDirection + 270) / binSize) % anglesBins;
    const perpStrength = Math.max(
      avgDirectionalStrength[perpendicularBin1],
      avgDirectionalStrength[perpendicularBin2]
    );

    secondaryDirection = perpStrength > maxStrength * 0.5 ? 
      (primaryDirection + 90) % 360 : 
      (primaryDirection + 180) % 360;

    // Calculate anisotropy ratio
    const primaryStrength = maxStrength;
    const minStrength = Math.min(...avgDirectionalStrength.filter(s => s > 0));
    const anisotropyRatio = minStrength > 0 ? (Math.abs(minStrength) < EPSILON ? 0 : primaryStrength / minStrength) : 1;

    // Analyze structural trends (dip direction analysis)
    const structuralTrend = this.analyzeStructuralTrends(layerPoints, primaryDirection);

    // Calculate overall trend strength
    const totalVariation = avgDirectionalStrength.reduce((sum, strength) => sum + strength, 0);
    const avgVariation = (Math.abs(anglesBins) < EPSILON ? 0 : totalVariation / anglesBins);
    const trendStrength = avgVariation > 0 ? (Math.abs(avgVariation) < EPSILON ? 0 : maxStrength / avgVariation) : 0;

    const trends = {
      primaryDirection,
      secondaryDirection,
      strength: Math.min(trendStrength / 2, 1), // Normalize to 0-1
      anisotropy: {
        angle: primaryDirection,
        ratio: Math.min(anisotropyRatio, 3) // Cap at 3:1
      },
      structuralTrend,
      directionalData: {
        bins: avgDirectionalStrength,
        binSize,
        maxStrength,
        avgVariation
      }
    };

    return trends;
  }

  /**
   * Analyze structural geological trends (dip analysis)
   * @param {Array} layerPoints - Layer data points
   * @param {number} primaryDirection - Primary trend direction
   * @returns {Object} Structural trend analysis
   */
  static analyzeStructuralTrends(layerPoints, primaryDirection) {
    // Create profile along primary trend direction
    const trendRadians = primaryDirection * Math.PI / 180;

    // Project points onto trend line
    const projectedPoints = layerPoints.map(point => {
      // Distance along trend direction from origin
      const trendDistance = point.x * Math.cos(trendRadians) + point.y * Math.sin(trendRadians);
      
      // Distance perpendicular to trend
      const perpDistance = -point.x * Math.sin(trendRadians) + point.y * Math.cos(trendRadians);

      return {
        ...point,
        trendDistance,
        perpDistance,
        avgElevation: (point.topZ + point.bottomZ) / 2
      };
    });

    // Sort by trend distance
    projectedPoints.sort((a, b) => a.trendDistance - b.trendDistance);

    // Calculate dip along trend
    let totalDip = 0;
    let dipCount = 0;

    for (let i = 0; i < projectedPoints.length - 1; i++) {
      const p1 = projectedPoints[i];
      const p2 = projectedPoints[i + 1];
      
      const distanceAlongTrend = p2.trendDistance - p1.trendDistance;
      const elevationChange = p2.avgElevation - p1.avgElevation;
      
      if (distanceAlongTrend > 1) { // Minimum 1m
        const dip = Math.atan((Math.abs(distanceAlongTrend) < EPSILON ? 0 : elevationChange / distanceAlongTrend)) * 180 / Math.PI;
        totalDip += dip;
        dipCount++;
      }
    }

    const avgDip = dipCount > 0 ? (Math.abs(dipCount) < EPSILON ? 0 : totalDip / dipCount) : 0;

    return {
      dipDirection: primaryDirection,
      dipAngle: Math.abs(avgDip),
      dipMagnitude: avgDip, // Positive = dipping down-trend, negative = up-trend
      confidence: Math.min(dipCount / 5, 1) // Confidence based on number of measurements
    };
  }

  /**
   * Apply geological trends to interpolation methods
   * @param {Object} trends - Geological trend analysis
   * @param {Array} methods - Interpolation methods to enhance
   * @returns {Array} Enhanced interpolation methods with trend data
   */
  static applyGeologicalTrendsToInterpolation(trends, methods = []) {
    const enhancedMethods = [...methods];

    // Add trend-aware methods if strong trends detected
    if (trends.strength > 0.3) {
      // Add anisotropic IDW
      if (!enhancedMethods.includes('anisotropic_idw')) {
        enhancedMethods.push('anisotropic_idw');
      }

      // Add directional kriging for strong trends
      if (trends.strength > 0.5 && !enhancedMethods.includes('directional_kriging')) {
        enhancedMethods.push('directional_kriging');
      }
    }

    return enhancedMethods;
  }

  /**
   * Calculate volume statistics for a mesh
   * @param {Object} volumeData - Volume data
   * @returns {Object} Statistics including volume, surface area, etc.
   */
  static calculateVolumeStatistics(volumeData) {
    // This is a simplified calculation
    // For accurate volume, we'd need to properly integrate
    let minThickness = Infinity;
    let maxThickness = -Infinity;
    let avgThickness = 0;

    // Approximate by sampling grid points
    const numVertices = volumeData.vertexCount / 2; // Half top, half bottom
    for (let i = 0; i < numVertices; i++) {
      const topY = volumeData.vertices[i * 3 + 1];
      const bottomY = volumeData.vertices[(numVertices + i) * 3 + 1];
      const thickness = topY - bottomY;
      
      minThickness = Math.min(minThickness, thickness);
      maxThickness = Math.max(maxThickness, thickness);
      avgThickness += thickness;
    }

    avgThickness /= numVertices;

    return {
      material: volumeData.material,
      minThickness: minThickness.toFixed(2),
      maxThickness: maxThickness.toFixed(2),
      avgThickness: avgThickness.toFixed(2),
      vertexCount: volumeData.vertexCount,
      triangleCount: volumeData.indexCount / 3
    };
  }

  /**
   * Generate volumetric stratigraphy with texture support
   * @param {Array} boreholes - Array of Borehole instances
   * @param {Object} extent - Site extent bounds
   * @param {Object} options - Generation options including texture settings
   * @returns {Array} Array of textured volumetric meshes
   */
  static async generateTexturedStratigraphy(boreholes, extent, options = {}) {
    const {
      gridResolution = 15,  // Unified default: balanced quality/performance
      interpolationMethod = 'idw',
      textureManager = null,
      textureOptions = {},
      enableTextures = false,
      meshSettings = {}
    } = options;

    try {
      // Generate base stratigraphy using existing method
      const baseVolumes = this.generateStratigraphy(
        boreholes,
        extent,
        { gridResolution, interpolationMethod }
      );

      if (baseVolumes.length === 0) {
        geologicalLogger.warn('No volumes generated from stratigraphy');
        return [];
      }

      // Convert volumes to textured meshes
      const texturedMeshes = [];
      
      for (const volume of baseVolumes) {
        try {
          // Enhanced mesh settings with texture support
          const enhancedSettings = {
            ...meshSettings,
            enableTextures,
            textureOptions: {
              useAtlas: textureManager?.hasAtlas(),
              ...textureOptions
            }
          };

          // Create mesh with texture support
          const mesh = this.createThreeJsMesh(
            volume,
            enhancedSettings,
            textureManager
          );

          // Add enhanced metadata
          mesh.userData = {
            ...mesh.userData,
            textureEnabled: enableTextures,
            hasTexture: enableTextures && mesh.material.map !== null,
            textureManager: textureManager !== null,
            materialType: volume.material
          };

          texturedMeshes.push(mesh);

        } catch (error) {
          scene3dLogger.error(`Failed to create textured mesh for ${volume.material}:`, error);
          
          // Create fallback mesh without texture
          const fallbackMesh = this.createThreeJsMesh(volume, meshSettings);
          fallbackMesh.userData.textureError = error.message;
          texturedMeshes.push(fallbackMesh);
        }
      }

      return texturedMeshes;

    } catch (error) {
      scene3dLogger.error('Failed to generate textured stratigraphy:', error);
      throw error;
    }
  }

  /**
   * Update existing mesh textures
   * @param {Mesh} mesh - Mesh to update
   * @param {Object} textureManager - SoilTextureManager instance
   * @param {Object} options - Update options
   * @returns {boolean} Success status
   */
  static updateMeshTextures(mesh, textureManager, options = {}) {
    if (!mesh || !mesh.material || !textureManager) {
      validationLogger.warn('Invalid parameters for mesh texture update');
      return false;
    }

    try {
      const materialType = mesh.userData?.material || mesh.userData?.materialType;
      if (!materialType) {
        validationLogger.warn('No material type found in mesh userData');
        return false;
      }

      // Apply updated texture
      textureManager.applyTextureToMaterial(
        mesh.material,
        materialType,
        {
          useAtlas: textureManager.hasAtlas(),
          ...options
        }
      );

      // Update mesh metadata
      mesh.userData.hasTexture = mesh.material.map !== null;
      mesh.userData.lastTextureUpdate = Date.now();

      // Ensure material updates
      mesh.material.needsUpdate = true;

      return true;

    } catch (error) {
      scene3dLogger.error('Failed to update mesh texture:', error);
      return false;
    }
  }

  /**
   * Remove textures from mesh (revert to base color)
   * @param {Mesh} mesh - Mesh to update
   * @returns {boolean} Success status
   */
  static removeMeshTextures(mesh) {
    if (!mesh || !mesh.material) {
      return false;
    }

    try {
      // Remove texture map
      if (mesh.material.map) {
        mesh.material.map = null;
        mesh.material.needsUpdate = true;
      }

      // Update metadata
      mesh.userData.hasTexture = false;
      mesh.userData.textureRemoved = Date.now();

      return true;

    } catch (error) {
      scene3dLogger.error('Failed to remove mesh texture:', error);
      return false;
    }
  }
}