/**
 * Optimized Volumetric Mesh Generator for 3D Geological Modeling
 * Refactored version with improved performance, caching, and memory management
 */

import { BufferGeometry, Color, DoubleSide, Float32BufferAttribute, MeshStandardMaterial } from 'three';
import { SpatialInterpolationEngine } from './SpatialInterpolationEngine';
import { GeologicalSequenceEngine } from './GeologicalSequenceEngine';
import { AdvancedInterpolationEngine } from './AdvancedInterpolationEngine';
import { getMaterialProperties } from '../utils/materialStandardization';

const EPSILON = 1e-10;

// Cache for Three.js Color objects
const COLOR_CACHE = new Map();

// Performance optimization constants
const MAX_NEARBY_BOREHOLES = 10;
const SPATIAL_GRID_SIZE = 50;

// Geometry and material pools for reuse
const GEOMETRY_POOL = [];
const MATERIAL_POOL = new Map();

export class OptimizedVolumetricMeshGenerator {
  // Static cache for spatial indices
  static spatialIndexCache = new WeakMap();
  
  // Static cache for interpolation results
  static interpolationCache = new Map();
  
  static getMaterialColor(material) {
    if (!COLOR_CACHE.has(material)) {
      const materialProps = getMaterialProperties(material);
      COLOR_CACHE.set(material, new Color(materialProps.color));
    }
    return COLOR_CACHE.get(material);
  }

  static buildSpatialIndex(boreholes) {
    // Check cache first
    if (this.spatialIndexCache.has(boreholes)) {
      return this.spatialIndexCache.get(boreholes);
    }

    const index = new Map();
    const boreholeCount = boreholes.length;
    
    // Use typed arrays for better performance with large datasets
    const gridIndices = new Int32Array(boreholeCount * 2);
    
    for (let i = 0; i < boreholeCount; i++) {
      const bh = boreholes[i];
      const gridX = Math.floor((bh.x || 0) / SPATIAL_GRID_SIZE);
      const gridY = Math.floor((bh.y || 0) / SPATIAL_GRID_SIZE);
      
      gridIndices[i * 2] = gridX;
      gridIndices[i * 2 + 1] = gridY;
      
      const key = `${gridX},${gridY}`;
      
      if (!index.has(key)) {
        index.set(key, []);
      }
      index.get(key).push(bh);
    }
    
    // Cache the result
    this.spatialIndexCache.set(boreholes, index);
    return index;
  }

  static getNearbyBoreholes(x, y, radius, spatialIndex) {
    const radiusSq = radius * radius;
    const gridRadius = Math.ceil(radius / SPATIAL_GRID_SIZE);
    const centerGridX = Math.floor(x / SPATIAL_GRID_SIZE);
    const centerGridY = Math.floor(y / SPATIAL_GRID_SIZE);
    
    // Pre-allocate array with expected size
    const nearby = [];
    nearby.length = 0;
    
    // Use squared distances to avoid sqrt calculation
    const candidates = [];
    
    for (let dx = -gridRadius; dx <= gridRadius; dx++) {
      for (let dy = -gridRadius; dy <= gridRadius; dy++) {
        const key = `${centerGridX + dx},${centerGridY + dy}`;
        const boreholes = spatialIndex.get(key);
        if (boreholes) {
          for (const bh of boreholes) {
            const distSq = (bh.x - x) ** 2 + (bh.y - y) ** 2;
            if (distSq <= radiusSq) {
              candidates.push({ borehole: bh, distSq });
            }
          }
        }
      }
    }
    
    // Sort only if we have more than needed
    if (candidates.length > MAX_NEARBY_BOREHOLES) {
      candidates.sort((a, b) => a.distSq - b.distSq);
      return candidates.slice(0, MAX_NEARBY_BOREHOLES).map(item => item.borehole);
    }
    
    return candidates.map(item => item.borehole);
  }

  static getPooledGeometry(vertices, indices) {
    // Try to reuse existing geometry
    for (const geom of GEOMETRY_POOL) {
      if (!geom.inUse && 
          geom.attributes.position.count >= vertices.length / 3) {
        geom.inUse = true;
        
        // Update the geometry data
        const positions = geom.attributes.position.array;
        const indexArray = geom.index.array;
        
        for (let i = 0; i < vertices.length; i++) {
          positions[i] = vertices[i];
        }
        for (let i = 0; i < indices.length; i++) {
          indexArray[i] = indices[i];
        }
        
        geom.attributes.position.needsUpdate = true;
        geom.index.needsUpdate = true;
        geom.setDrawRange(0, indices.length);
        
        return geom;
      }
    }
    
    // Create new geometry if no suitable one found
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(vertices, 3));
    geometry.setIndex(indices);
    geometry.inUse = true;
    
    GEOMETRY_POOL.push(geometry);
    return geometry;
  }

  static getCachedMaterial(material, opacity = 0.8) {
    const key = `${material}_${opacity}`;
    
    if (!MATERIAL_POOL.has(key)) {
      const color = this.getMaterialColor(material);
      const mat = new MeshStandardMaterial({
        color: color,
        transparent: opacity < 1,
        opacity: opacity,
        side: DoubleSide,
        roughness: 0.8,
        metalness: 0.2
      });
      MATERIAL_POOL.set(key, mat);
    }
    
    return MATERIAL_POOL.get(key);
  }

  static createLayerVolume(topSurface, bottomSurface, material, extent, resolution, options = {}) {
    const { opacity = 0.5 } = options;
    
    // Use typed arrays for better performance
    const vertexCount = topSurface.length * 2;
    const vertices = new Float32Array(vertexCount * 3);
    const colors = new Float32Array(vertexCount * 3);
    const normals = new Float32Array(vertexCount * 3);
    const uvs = new Float32Array(vertexCount * 2);
    
    const materialColor = this.getMaterialColor(material);
    const r = materialColor.r;
    const g = materialColor.g;
    const b = materialColor.b;
    
    // Calculate elevation range once
    let minElevation = Infinity;
    let maxElevation = -Infinity;
    
    for (let i = 0; i < topSurface.length; i++) {
      const topZ = topSurface[i].z;
      const bottomZ = bottomSurface[i].z;
      minElevation = Math.min(minElevation, topZ, bottomZ);
      maxElevation = Math.max(maxElevation, topZ, bottomZ);
    }
    
    const elevationRange = Math.max(maxElevation - minElevation, EPSILON);
    const elevationInv = 1 / elevationRange;
    
    // Process vertices in a single loop
    let vIndex = 0;
    let uvIndex = 0;
    let cIndex = 0;
    
    for (let i = 0; i < topSurface.length; i++) {
      const top = topSurface[i];
      const bottom = bottomSurface[i];
      
      // Top vertex
      vertices[vIndex] = top.x;
      vertices[vIndex + 1] = top.z;
      vertices[vIndex + 2] = top.y;
      
      // Bottom vertex
      vertices[vIndex + 3] = bottom.x;
      vertices[vIndex + 4] = bottom.z;
      vertices[vIndex + 5] = bottom.y;
      
      // Calculate elevation ratios
      const topRatio = (top.z - minElevation) * elevationInv;
      const bottomRatio = (bottom.z - minElevation) * elevationInv;
      
      // Apply color with elevation-based brightness
      const topBrightness = 0.7 + topRatio * 0.3;
      const bottomBrightness = 0.7 + bottomRatio * 0.3;
      
      colors[cIndex] = r * topBrightness;
      colors[cIndex + 1] = g * topBrightness;
      colors[cIndex + 2] = b * topBrightness;
      colors[cIndex + 3] = r * bottomBrightness;
      colors[cIndex + 4] = g * bottomBrightness;
      colors[cIndex + 5] = b * bottomBrightness;
      
      // UVs
      const u = (top.x - extent.minX) / (extent.maxX - extent.minX);
      const v = (top.y - extent.minY) / (extent.maxY - extent.minY);
      uvs[uvIndex] = u;
      uvs[uvIndex + 1] = v;
      uvs[uvIndex + 2] = u;
      uvs[uvIndex + 3] = v;
      
      vIndex += 6;
      cIndex += 6;
      uvIndex += 4;
    }
    
    // Generate indices for triangulation
    const indices = this.generateOptimizedIndices(resolution);
    
    return {
      vertices: vertices,
      indices: indices,
      colors: colors,
      normals: normals,
      uvs: uvs,
      material: material,
      bounds: { minElevation, maxElevation }
    };
  }

  static generateOptimizedIndices(resolution) {
    const cacheKey = `indices_${resolution}`;
    
    if (this.interpolationCache.has(cacheKey)) {
      return this.interpolationCache.get(cacheKey);
    }
    
    const indices = [];
    const gridSize = resolution;
    
    for (let i = 0; i < gridSize - 1; i++) {
      for (let j = 0; j < gridSize - 1; j++) {
        const topLeft = (i * gridSize + j) * 2;
        const topRight = ((i + 1) * gridSize + j) * 2;
        const bottomLeft = (i * gridSize + j + 1) * 2;
        const bottomRight = ((i + 1) * gridSize + j + 1) * 2;
        
        // Top surface triangles
        indices.push(topLeft, topRight, bottomRight);
        indices.push(topLeft, bottomRight, bottomLeft);
        
        // Bottom surface triangles
        indices.push(topLeft + 1, bottomRight + 1, topRight + 1);
        indices.push(topLeft + 1, bottomLeft + 1, bottomRight + 1);
        
        // Side faces
        if (i === 0) {
          indices.push(topLeft, bottomLeft, bottomLeft + 1);
          indices.push(topLeft, bottomLeft + 1, topLeft + 1);
        }
        if (i === gridSize - 2) {
          indices.push(topRight, topRight + 1, bottomRight + 1);
          indices.push(topRight, bottomRight + 1, bottomRight);
        }
        if (j === 0) {
          indices.push(topLeft, topLeft + 1, topRight + 1);
          indices.push(topLeft, topRight + 1, topRight);
        }
        if (j === gridSize - 2) {
          indices.push(bottomLeft, bottomRight, bottomRight + 1);
          indices.push(bottomLeft, bottomRight + 1, bottomLeft + 1);
        }
      }
    }
    
    const indexArray = new Uint32Array(indices);
    this.interpolationCache.set(cacheKey, indexArray);
    return indexArray;
  }

  static clearCaches() {
    this.spatialIndexCache = new WeakMap();
    this.interpolationCache.clear();
    COLOR_CACHE.clear();
    
    // Return geometries to pool
    for (const geom of GEOMETRY_POOL) {
      geom.inUse = false;
    }
    
    // Don't dispose materials as they can be reused
  }

  static dispose() {
    // Dispose geometries
    for (const geom of GEOMETRY_POOL) {
      geom.dispose();
    }
    GEOMETRY_POOL.length = 0;
    
    // Dispose materials
    for (const mat of MATERIAL_POOL.values()) {
      mat.dispose();
    }
    MATERIAL_POOL.clear();
    
    this.clearCaches();
  }
}

// Export as default for drop-in replacement
export default OptimizedVolumetricMeshGenerator;