/**
 * Export Utilities for Geological Modeling
 * 
 * Contains texture management, mesh utilities, and material export functions
 * for geological model export and visualization.
 */

import { validationLogger, scene3dLogger } from '../../utils/Logger.js';

const EPSILON = 1e-10; // Small value for division-by-zero protection

/**
 * Export and texture utility functions for geological models
 */
export class ExportUtilities {
  /**
   * Get material-specific texture scaling factors for realistic appearance
   * Maps geological materials to real-world texture repeat distances in feet
   * @param {string} materialType - Geological material type (CLAY, SAND, etc.)
   * @returns {Object} Scaling factors {horizontal, vertical} in feet
   */
  static getMaterialTextureScale(materialType) {
    // Real-world texture repeat distances in feet based on geological standards
    const textureScales = {
      'CLAY': { horizontal: 3.28, vertical: 0.98 },      // Fine horizontal layers
      'SAND': { horizontal: 1.64, vertical: 1.64 },      // Small granular patterns  
      'GRAVEL': { horizontal: 2.62, vertical: 2.62 },    // Medium-sized particles
      'ROCK': { horizontal: 6.56, vertical: 6.56 },      // Large rock patterns
      'SILT': { horizontal: 3.94, vertical: 2.62 },      // Medium diagonal patterns
      'ORGANIC': { horizontal: 4.92, vertical: 3.28 },   // Varied organic matter
      'FILL': { horizontal: 3.28, vertical: 3.28 },      // Standard construction fill
      'LIMESTONE': { horizontal: 8.2, vertical: 4.92 },  // Large sedimentary layers
      'SANDSTONE': { horizontal: 6.56, vertical: 3.94 }, // Layered rock structure
      'SHALE': { horizontal: 5.91, vertical: 1.31 },     // Thin horizontal layers
      'UNKNOWN': { horizontal: 3.28, vertical: 3.28 }    // Default scaling
    };
    
    return textureScales[materialType?.toUpperCase()] || textureScales['UNKNOWN'];
  }

  /**
   * Calculate dynamic UV coordinates based on real-world dimensions
   * Generates UV coordinates for realistic texture scaling on geological meshes
   * @param {Object} worldPos - World position data {position, height}
   * @param {string} materialType - Geological material type
   * @param {Object} wallBounds - Wall boundary data {minPos, maxPos, minHeight, maxHeight}
   * @returns {Object} UV coordinates {u, v} and repeat factors
   */
  static calculateDynamicUV(worldPos, materialType, wallBounds) {
    const textureScale = this.getMaterialTextureScale(materialType);
    
    // Calculate real-world dimensions
    const wallWidth = wallBounds.maxPos - wallBounds.minPos;
    const wallHeight = wallBounds.maxHeight - wallBounds.minHeight;
    
    // Prevent over-compression or over-stretching
    const minRepeats = 0.5;
    const maxRepeats = 8.0;
    
    // Calculate texture repeats based on real dimensions
    let uRepeats = Math.max(minRepeats, Math.min(maxRepeats, 
      Math.abs(textureScale.horizontal) < EPSILON ? 0 : wallWidth / textureScale.horizontal));
    let vRepeats = Math.max(minRepeats, Math.min(maxRepeats, 
      Math.abs(textureScale.vertical) < EPSILON ? 0 : wallHeight / textureScale.vertical));
    
    // Adjust for very thin or thick layers
    if (wallHeight < 1.64) { // Very thin layer (< 1.64ft)
      vRepeats = Math.max(0.3, vRepeats * 0.6); // Reduce vertical compression
    } else if (wallHeight > 16.4) { // Very thick layer (> 16.4ft)
      vRepeats = Math.min(6.0, vRepeats * 1.2); // Increase detail in thick layers
    }
    
    return {
      u: (Math.abs(wallWidth) < EPSILON ? 0 : (worldPos.position / wallWidth)) * uRepeats,
      v: (Math.abs(wallHeight) < EPSILON ? 0 : (worldPos.height / wallHeight)) * vRepeats,
      repeats: { u: uRepeats, v: vRepeats }
    };
  }

  /**
   * Update existing mesh textures with new settings
   * Applies texture updates to Three.js meshes for geological models
   * @param {Mesh} mesh - Three.js mesh to update
   * @param {Object} textureManager - SoilTextureManager instance
   * @param {Object} options - Update options including intensity and scale
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
   * Clears texture maps from Three.js meshes for geological models
   * @param {Mesh} mesh - Three.js mesh to update
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

  /**
   * Validate mesh export compatibility
   * Ensures mesh data is suitable for GLTF/GLB export
   * @param {Object} meshData - Mesh data to validate
   * @returns {Object} Validation result {isValid, issues, recommendations}
   */
  static validateMeshForExport(meshData) {
    const issues = [];
    const recommendations = [];

    if (!meshData) {
      issues.push('Mesh data is null or undefined');
      return { isValid: false, issues, recommendations };
    }

    // Check vertex count
    if (!meshData.vertices || meshData.vertices.length === 0) {
      issues.push('No vertices found in mesh data');
    } else if (meshData.vertices.length > 65535 * 3) {
      issues.push('Vertex count exceeds 65,535 limit for some exporters');
      recommendations.push('Consider mesh decimation or subdivision');
    }

    // Check indices
    if (!meshData.indices || meshData.indices.length === 0) {
      issues.push('No indices found in mesh data');
    } else if (meshData.indices.length % 3 !== 0) {
      issues.push('Index count is not divisible by 3 (invalid triangles)');
    }

    // Check normals
    if (!meshData.normals || meshData.normals.length !== meshData.vertices.length) {
      issues.push('Normals missing or incorrect count');
      recommendations.push('Generate normals before export');
    }

    // Check UV coordinates
    if (!meshData.uvs || meshData.uvs.length !== (meshData.vertices.length / 3) * 2) {
      issues.push('UV coordinates missing or incorrect count');
      recommendations.push('Generate UV coordinates for texture mapping');
    }

    // Check material
    if (!meshData.material) {
      issues.push('No material type specified');
      recommendations.push('Assign material type for proper export metadata');
    }

    const isValid = issues.length === 0;
    return { isValid, issues, recommendations };
  }

  /**
   * Generate export metadata for geological models
   * Creates comprehensive metadata for GLTF/GLB export including geological information
   * @param {Array} volumes - Array of geological volumes
   * @param {Object} exportOptions - Export options and settings
   * @returns {Object} Metadata object suitable for GLTF export
   */
  static generateExportMetadata(volumes, exportOptions = {}) {
    const metadata = {
      generator: 'Geotech-Visualizer',
      version: '1.0',
      exportDate: new Date().toISOString(),
      units: 'feet', // Geological models are in feet
      geologicalData: {
        totalVolumes: volumes.length,
        materials: [],
        statistics: {},
        interpolationMethods: exportOptions.interpolationMethod || 'unknown'
      }
    };

    // Analyze materials and collect statistics
    const materialStats = new Map();
    let totalVertices = 0;
    let totalTriangles = 0;

    volumes.forEach(volume => {
      if (volume.material) {
        if (!materialStats.has(volume.material)) {
          materialStats.set(volume.material, {
            material: volume.material,
            volumeCount: 0,
            totalVertices: 0,
            totalTriangles: 0,
            minThickness: Infinity,
            maxThickness: -Infinity,
            avgThickness: 0
          });
        }

        const stats = materialStats.get(volume.material);
        stats.volumeCount += 1;
        stats.totalVertices += volume.vertexCount || 0;
        stats.totalTriangles += volume.indexCount ? volume.indexCount / 3 : 0;

        totalVertices += volume.vertexCount || 0;
        totalTriangles += volume.indexCount ? volume.indexCount / 3 : 0;

        // Calculate thickness if available
        if (volume.topSurface && volume.bottomSurface) {
          const thickness = this.calculateLayerThickness(volume);
          stats.minThickness = Math.min(stats.minThickness, thickness.min);
          stats.maxThickness = Math.max(stats.maxThickness, thickness.max);
          stats.avgThickness = thickness.avg;
        }
      }
    });

    // Convert material stats to array
    metadata.geologicalData.materials = Array.from(materialStats.values());
    metadata.geologicalData.statistics = {
      totalVertices,
      totalTriangles,
      averageVerticesPerVolume: volumes.length > 0 ? totalVertices / volumes.length : 0,
      averageTrianglesPerVolume: volumes.length > 0 ? totalTriangles / volumes.length : 0
    };

    // Add export settings
    if (exportOptions.textureSettings) {
      metadata.textureSettings = {
        enabled: exportOptions.textureSettings.enabled,
        globalIntensity: exportOptions.textureSettings.globalIntensity,
        patternScale: exportOptions.textureSettings.patternScale
      };
    }

    return metadata;
  }

  /**
   * Calculate layer thickness statistics from volume data
   * @param {Object} volume - Volume data with topSurface and bottomSurface
   * @returns {Object} Thickness statistics {min, max, avg}
   * @private
   */
  static calculateLayerThickness(volume) {
    if (!volume.topSurface || !volume.bottomSurface) {
      return { min: 0, max: 0, avg: 0 };
    }

    const thicknesses = [];
    const minLength = Math.min(volume.topSurface.length, volume.bottomSurface.length);

    for (let i = 0; i < minLength; i++) {
      const thickness = volume.topSurface[i].z - volume.bottomSurface[i].z;
      thicknesses.push(Math.abs(thickness));
    }

    if (thicknesses.length === 0) {
      return { min: 0, max: 0, avg: 0 };
    }

    const min = Math.min(...thicknesses);
    const max = Math.max(...thicknesses);
    const avg = thicknesses.reduce((sum, t) => sum + t, 0) / thicknesses.length;

    return { min, max, avg };
  }

  /**
   * Optimize mesh data for export
   * Prepares mesh data for efficient GLTF/GLB export
   * @param {Object} meshData - Original mesh data
   * @param {Object} options - Optimization options
   * @returns {Object} Optimized mesh data
   */
  static optimizeMeshForExport(meshData, options = {}) {
    const {
      simplifyGeometry = false, // eslint-disable-line no-unused-vars
      mergeVertices = true, // eslint-disable-line no-unused-vars
      generateNormals = true, // eslint-disable-line no-unused-vars
      validateUVs = true // eslint-disable-line no-unused-vars
    } = options;

    const optimized = { ...meshData };

    // Add any optimization logic here
    // This is a placeholder for future mesh optimization features
    
    // Update metadata
    optimized.optimizationApplied = {
      timestamp: Date.now(),
      options: options
    };

    return optimized;
  }
}