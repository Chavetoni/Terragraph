/**
 * ExportMemoryManager Integration Example
 *
 * This file demonstrates how to integrate the ExportMemoryManager
 * with existing export services for comprehensive Three.js memory management
 * during geological model export operations.
 *
 * Integration patterns:
 * - ObjMtlExporter integration for OBJ+MTL exports
 * - RevitExportOrchestrator coordination
 * - VolumetricMeshGenerator memory management
 * - GeologicalMetadataGenerator resource tracking
 * - Custom export service integration
 *
 * @example
 */

import {
  ExportMemoryManager,
  ExportPhase,
  ResourceType,
  getExportMemoryManager
} from './exportMemoryManager.js';

import { ObjMtlExporter } from './ObjMtlExporter.js';
import { RevitExportOrchestrator } from './RevitExportOrchestrator.js';
import { VolumetricMeshGenerator } from '../VolumetricMeshGenerator.js';
import { exportLogger } from '../../utils/Logger.js';

/**
 * Enhanced ObjMtlExporter with integrated memory management
 */
export class MemoryManagedObjMtlExporter extends ObjMtlExporter {
  constructor() {
    super();
    this.memoryManager = null;
  }

  /**
   * Export with comprehensive memory management
   */
  async export(preparedData, options = {}) {
    const { onProgress, cancellationToken } = options;
    const exportId = `obj-mtl-${Date.now()}`;

    // Initialize memory manager for this export
    this.memoryManager = getExportMemoryManager({
      debugMode: process.env.NODE_ENV === 'development',
      warningThreshold: 0.70,
      criticalThreshold: 0.85,
      enablePerformanceTracking: true
    });

    try {
      // Start export operation tracking
      const session = this.memoryManager.startExportOperation(exportId, {
        format: 'obj-mtl',
        settings: preparedData.formatSpecificData
      });

      exportLogger.info('Starting memory-managed OBJ+MTL export', {
        exportId: session.exportId,
        initialMemory: session.initialMemory.usage
      });

      // Phase 1: Preparation
      this.memoryManager.setExportPhase(ExportPhase.PREPARING);
      onProgress?.(0, 'Preparing export with memory management...');

      // Create resource pools for efficient reuse
      const geometryPool = this.memoryManager.createResourcePool(
        'obj-geometry-pool',
        ResourceType.GEOMETRY,
        { maxSize: 100, enableReuse: true }
      );

      const materialPool = this.memoryManager.createResourcePool(
        'obj-material-pool',
        ResourceType.MATERIAL,
        { maxSize: 50, enableReuse: true }
      );

      // Phase 2: Processing geological objects
      this.memoryManager.setExportPhase(ExportPhase.PROCESSING);
      onProgress?.(10, 'Processing geological meshes with memory tracking...');

      const exportScene = await this.processGeologicalObjectsWithMemoryManagement(
        preparedData,
        geometryPool,
        materialPool,
        { onProgress: (progress) => onProgress?.(10 + (progress * 0.3)) }
      );

      // Phase 3: Material processing
      this.memoryManager.setExportPhase(ExportPhase.GENERATING);
      onProgress?.(40, 'Generating materials with memory optimization...');

      const materialResults = await this.processMaterialsWithMemoryManagement(
        preparedData,
        materialPool,
        { onProgress: (progress) => onProgress?.(40 + (progress * 0.2)) }
      );

      // Phase 4: Content generation
      onProgress?.(60, 'Generating OBJ content...');
      const objContent = await this.generateObjContentWithMemoryManagement(
        exportScene,
        preparedData,
        { onProgress: (progress) => onProgress?.(60 + (progress * 0.2)) }
      );

      // Phase 5: MTL generation
      onProgress?.(80, 'Generating MTL content...');
      let mtlContent = '';
      if (preparedData.formatSpecificData.generateMTL) {
        mtlContent = await this.generateMtlContentWithMemoryManagement(
          materialResults,
          preparedData,
          { onProgress: (progress) => onProgress?.(80 + (progress * 0.1)) }
        );
      }

      // Phase 6: Packaging
      this.memoryManager.setExportPhase(ExportPhase.PACKAGING);
      onProgress?.(90, 'Packaging export results...');

      const exportResult = await this.packageExportResults(
        objContent,
        mtlContent,
        materialResults,
        preparedData,
        { onProgress: (progress) => onProgress?.(90 + (progress * 0.1)) }
      );

      // Add memory statistics to export result
      const memoryStats = this.memoryManager.getExportMemoryStats();
      exportResult.memoryManagement = {
        peakUsage: memoryStats.memoryMonitoring.peakUsage,
        resourcesTracked: memoryStats.export.resourcesTracked,
        temporaryResourcesCleaned: memoryStats.export.temporaryResources,
        memoryWarnings: this.memoryManager.getMemoryWarnings().length,
        exportDuration: memoryStats.export.duration
      };

      onProgress?.(100, 'Memory-managed OBJ+MTL export completed');

      exportLogger.info('Memory-managed OBJ+MTL export completed successfully', {
        exportId,
        filesGenerated: exportResult.files.length,
        peakMemoryUsage: memoryStats.memoryMonitoring.peakUsage,
        resourcesTracked: memoryStats.export.resourcesTracked
      });

      return exportResult;

    } catch (error) {
      exportLogger.error('Memory-managed OBJ+MTL export failed:', error);

      // Handle cancellation
      if (cancellationToken?.isCancelled) {
        this.memoryManager.handleExportCancellation('User cancelled export');
        throw new Error('OBJ+MTL export cancelled by user');
      }

      // Set failed phase
      this.memoryManager.setExportPhase(ExportPhase.FAILED, { error: error.message });
      throw error;

    } finally {
      // Cleanup export operation
      if (this.memoryManager) {
        const cleanupResult = this.memoryManager.cleanupExportOperation();
        exportLogger.info('Export memory cleanup completed', {
          exportId,
          resourcesCleaned: cleanupResult.resourcesCleaned,
          cleanupDuration: cleanupResult.duration
        });
      }
    }
  }

  /**
   * Process geological objects with memory management
   */
  async processGeologicalObjectsWithMemoryManagement(
    preparedData,
    geometryPool,
    materialPool,
    options = {}
  ) {
    const { onProgress } = options;
    const { geologicalData } = preparedData;

    // Create export scene with memory tracking
    const exportScene = new Object3D();
    exportScene.name = 'GeologicalModel';

    this.memoryManager.trackExportResource(
      'export-scene',
      exportScene,
      ResourceType.GROUP,
      { temporary: false }
    );

    const totalObjects = geologicalData.objects.length;
    let processedCount = 0;

    for (const geoObject of geologicalData.objects) {
      try {
        // Clone geometry with memory tracking
        const originalGeometry = geoObject.geometry;
        const geometryKey = this.generateGeometryKey(originalGeometry);

        const clonedGeometry = geometryPool.getOrCreate(geometryKey, () => {
          return this.memoryManager.trackClonedResource(
            `cloned-geometry-${processedCount}`,
            originalGeometry,
            ResourceType.GEOMETRY,
            { temporary: true }
          );
        });

        if (!clonedGeometry) {
          exportLogger.warn(`Failed to clone geometry for object ${geoObject.name}`);
          continue;
        }

        // Clone material with memory tracking
        const originalMaterial = geoObject.material;
        const materialKey = this.generateMaterialKey(originalMaterial);

        const clonedMaterial = materialPool.getOrCreate(materialKey, () => {
          return this.memoryManager.trackClonedResource(
            `cloned-material-${processedCount}`,
            originalMaterial,
            ResourceType.MATERIAL,
            { temporary: true }
          );
        });

        // Create export mesh
        const exportMesh = new Mesh(clonedGeometry, clonedMaterial);
        exportMesh.name = this.sanitizeName(geoObject.name || 'GeologicalMesh');

        // Apply transforms
        if (geoObject.position) exportMesh.position.copy(geoObject.position);
        if (geoObject.rotation) exportMesh.rotation.copy(geoObject.rotation);
        if (geoObject.scale) exportMesh.scale.copy(geoObject.scale);

        // Track the mesh
        this.memoryManager.trackExportResource(
          `export-mesh-${processedCount}`,
          exportMesh,
          ResourceType.GEOLOGICAL_MESH,
          { temporary: true, geologicalType: this.extractMaterialType(geoObject) }
        );

        exportScene.add(exportMesh);

        processedCount++;
        onProgress?.((processedCount / totalObjects) * 100);

        // Check memory pressure periodically
        if (processedCount % 10 === 0) {
          const memoryStats = this.memoryManager.getExportMemoryStats();
          if (memoryStats.memoryMonitoring.currentPressure === 'critical') {
            exportLogger.warn('Critical memory pressure during object processing', {
              processedCount,
              totalObjects,
              memoryUsage: memoryStats.memoryMonitoring.lastSnapshot?.usage
            });
          }
        }

      } catch (error) {
        exportLogger.error(`Error processing geological object ${geoObject.name}:`, error);
        continue;
      }
    }

    exportLogger.info('Geological object processing completed with memory management', {
      processedObjects: processedCount,
      totalObjects,
      memoryStats: this.memoryManager.getExportMemoryStats().export
    });

    return exportScene;
  }

  /**
   * Process materials with memory management
   */
  async processMaterialsWithMemoryManagement(preparedData, materialPool, options = {}) {
    const { onProgress } = options;
    const { materialData, formatSpecificData } = preparedData;

    const results = {
      materials: new Map(),
      textures: new Map(),
      textureFiles: [],
      materialProperties: new Map()
    };

    if (!materialData?.materials) {
      return results;
    }

    const materialArray = Array.from(materialData.materials.entries());
    let processedCount = 0;

    // Create texture atlas for optimization
    const textureAtlas = new Map();

    for (const [materialName, materialInfo] of materialArray) {
      try {
        // Process material with pooled resources
        const materialKey = this.generateMaterialKey(materialInfo);
        const processedMaterial = materialPool.getOrCreate(materialKey, () => {
          return this.processGeologicalMaterialForMTL(
            materialName,
            materialInfo,
            formatSpecificData
          );
        });

        if (processedMaterial) {
          results.materials.set(materialName, processedMaterial);

          // Process textures with memory management
          if (formatSpecificData.includeTextures && materialInfo.properties?.hasTexture) {
            const textureResult = await this.processTextureWithMemoryManagement(
              materialName,
              materialInfo,
              textureAtlas,
              formatSpecificData
            );

            if (textureResult) {
              results.textures.set(materialName, textureResult);
              results.textureFiles.push(textureResult.file);
            }
          }

          // Store material properties
          results.materialProperties.set(materialName, {
            geological: true,
            type: materialName,
            density: this.getMaterialDensity(materialName),
            color: processedMaterial.color,
            hasTexture: !!results.textures.has(materialName)
          });
        }

      } catch (error) {
        exportLogger.error(`Error processing material ${materialName} with memory management:`, error);
      }

      processedCount++;
      onProgress?.((processedCount / materialArray.length) * 100);
    }

    // Track texture atlas for cleanup
    if (textureAtlas.size > 0) {
      this.memoryManager.trackExportResource(
        'texture-atlas',
        textureAtlas,
        'texture-atlas',
        { temporary: true }
      );
    }

    exportLogger.info('Material processing completed with memory management', {
      materials: results.materials.size,
      textures: results.textures.size,
      textureAtlasSize: textureAtlas.size
    });

    return results;
  }

  /**
   * Process texture with memory management and atlas optimization
   */
  async processTextureWithMemoryManagement(materialName, materialInfo, textureAtlas, formatSpecificData) {
    try {
      const textureKey = `${materialName}_texture`;

      // Check if texture already exists in atlas
      if (textureAtlas.has(textureKey)) {
        const existingTexture = textureAtlas.get(textureKey);
        exportLogger.debug('Reusing texture from atlas', { materialName, textureKey });
        return existingTexture;
      }

      // Generate or load texture
      const textureResult = await this.processTextureForExport(
        materialName,
        materialInfo,
        formatSpecificData
      );

      if (textureResult) {
        // Track texture in memory manager
        if (textureResult.texture) {
          this.memoryManager.trackExportResource(
            `texture-${materialName}`,
            textureResult.texture,
            ResourceType.TEXTURE,
            { temporary: true, material: materialName }
          );
        }

        // Add to atlas
        textureAtlas.set(textureKey, textureResult);

        exportLogger.debug('Texture processed and added to atlas', {
          materialName,
          textureSize: textureResult.file?.size || 0
        });
      }

      return textureResult;

    } catch (error) {
      exportLogger.error(`Error processing texture for ${materialName}:`, error);
      return null;
    }
  }

  /**
   * Generate OBJ content with memory management
   */
  async generateObjContentWithMemoryManagement(exportScene, preparedData, options = {}) {
    const { onProgress } = options;

    exportLogger.info('Generating OBJ content with memory management', {
      objectCount: exportScene.children.length
    });

    try {
      // Monitor memory during OBJ generation
      const memoryBefore = this.memoryManager.takeMemorySnapshot('obj_generation_start');

      onProgress?.(20);

      // Configure OBJ exporter
      const objOptions = {
        materials: preparedData.formatSpecificData.generateMTL,
        objects: true,
        normals: true,
        uvs: preparedData.formatSpecificData.includeTextures
      };

      onProgress?.(50);

      // Generate OBJ content
      const objContent = this.objExporter.parse(exportScene);

      onProgress?.(80);

      // Monitor memory after generation
      const memoryAfter = this.memoryManager.takeMemorySnapshot('obj_generation_end');

      // Post-process content
      const processedContent = this.postProcessObjContent(objContent, preparedData);

      onProgress?.(100);

      exportLogger.info('OBJ content generation completed with memory monitoring', {
        contentSize: processedContent.length,
        memoryBefore: memoryBefore.usage,
        memoryAfter: memoryAfter.usage
      });

      return processedContent;

    } catch (error) {
      exportLogger.error('Error generating OBJ content with memory management:', error);
      throw error;
    }
  }

  /**
   * Generate MTL content with memory management
   */
  async generateMtlContentWithMemoryManagement(materialResults, preparedData, options = {}) {
    const { onProgress } = options;

    exportLogger.info('Generating MTL content with memory management');

    try {
      // Monitor memory during MTL generation
      const memoryBefore = this.memoryManager.takeMemorySnapshot('mtl_generation_start');

      // Generate MTL content (reuse parent method)
      const mtlContent = await this.generateMtlContent(materialResults, preparedData, options);

      // Monitor memory after generation
      const memoryAfter = this.memoryManager.takeMemorySnapshot('mtl_generation_end');

      exportLogger.info('MTL content generation completed with memory monitoring', {
        contentSize: mtlContent.length,
        memoryBefore: memoryBefore.usage,
        memoryAfter: memoryAfter.usage
      });

      return mtlContent;

    } catch (error) {
      exportLogger.error('Error generating MTL content with memory management:', error);
      throw error;
    }
  }

  /**
   * Generate geometry key for pooling
   */
  generateGeometryKey(geometry) {
    if (!geometry || !geometry.attributes?.position) {
      return 'invalid-geometry';
    }

    const positions = geometry.attributes.position.array;
    const vertexCount = positions.length / 3;

    // Simple hash based on vertex count and some position values
    const sample = positions.slice(0, Math.min(12, positions.length));
    const hash = sample.reduce((acc, val) => acc + val, 0);

    return `geometry_${vertexCount}_${hash.toFixed(2)}`;
  }

  /**
   * Generate material key for pooling
   */
  generateMaterialKey(material) {
    if (!material) {
      return 'invalid-material';
    }

    const geologicalType = material.userData?.geologicalMaterial || 'unknown';
    const color = material.color ? material.color.getHex().toString(16) : 'ffffff';
    const opacity = material.opacity || 1.0;

    return `material_${geologicalType}_${color}_${opacity.toFixed(2)}`;
  }

  /**
   * Cleanup method for memory-managed exporter
   */
  async cleanup() {
    // Call parent cleanup
    await super.cleanup();

    // Cleanup memory manager
    if (this.memoryManager) {
      this.memoryManager.cleanupExportOperation();
      this.memoryManager = null;
    }
  }
}

/**
 * Enhanced RevitExportOrchestrator with memory management
 */
export class MemoryManagedRevitExportOrchestrator extends RevitExportOrchestrator {
  constructor() {
    super();

    // Replace OBJ+MTL exporter with memory-managed version
    this.objMtlExporter = new MemoryManagedObjMtlExporter();
    this.memoryManager = null;
  }

  /**
   * Execute export with comprehensive memory management
   */
  async execute(preparedData, options = {}) {
    const { format } = preparedData;
    const { onProgress, cancellationToken } = options;
    const orchestratorExportId = `orchestrator-${format}-${Date.now()}`;

    // Initialize orchestrator-level memory manager
    this.memoryManager = getExportMemoryManager({
      debugMode: process.env.NODE_ENV === 'development',
      warningThreshold: 0.65, // Lower threshold for orchestrator
      criticalThreshold: 0.80,
      enablePerformanceTracking: true,
      verboseLogging: false
    });

    try {
      // Start orchestrator export tracking
      const session = this.memoryManager.startExportOperation(orchestratorExportId, {
        format,
        orchestrated: true
      });

      exportLogger.info('Starting memory-managed orchestrated export', {
        format,
        exportId: session.exportId,
        initialMemory: session.initialMemory.usage
      });

      this.memoryManager.setExportPhase(ExportPhase.PREPARING);
      onProgress?.(5, 'Initializing orchestrated export with memory management...');

      // Execute format-specific export with memory coordination
      let exportResult;

      switch (format) {
        case 'REVIT_OBJ':
          exportResult = await this.executeMemoryManagedObjMtlExport(
            preparedData,
            { onProgress: (progress) => onProgress?.(5 + (progress * 0.9)), cancellationToken }
          );
          break;

        case 'REVIT_IFC':
          exportResult = await this.executeMemoryManagedIfcJsonExport(
            preparedData,
            { onProgress: (progress) => onProgress?.(5 + (progress * 0.9)), cancellationToken }
          );
          break;

        default:
          throw new Error(`Unsupported format: ${format}`);
      }

      // Add orchestrator memory statistics
      const orchestratorStats = this.memoryManager.getExportMemoryStats();
      exportResult.orchestratorMemoryManagement = {
        peakUsage: orchestratorStats.memoryMonitoring.peakUsage,
        totalDuration: orchestratorStats.export.duration,
        memoryWarnings: this.memoryManager.getMemoryWarnings().length,
        phaseMetrics: orchestratorStats.phaseMetrics
      };

      // Add orchestrator metadata
      exportResult.orchestrator = {
        name: this.name,
        version: this.version,
        executedAt: new Date().toISOString(),
        format,
        memoryManaged: true
      };

      onProgress?.(100, 'Memory-managed orchestrated export completed');

      exportLogger.info('Memory-managed orchestrated export completed successfully', {
        format,
        filesGenerated: exportResult.files?.length || 0,
        orchestratorPeakMemory: orchestratorStats.memoryMonitoring.peakUsage,
        totalDuration: orchestratorStats.export.duration
      });

      return exportResult;

    } catch (error) {
      exportLogger.error(`Memory-managed orchestrated export failed for format: ${format}`, error);

      if (cancellationToken?.isCancelled) {
        this.memoryManager.handleExportCancellation('Orchestrator export cancelled');
        throw new Error('Orchestrated export cancelled by user');
      }

      this.memoryManager.setExportPhase(ExportPhase.FAILED, { error: error.message });
      throw error;

    } finally {
      // Cleanup orchestrator memory management
      if (this.memoryManager) {
        const cleanupResult = this.memoryManager.cleanupExportOperation();
        exportLogger.info('Orchestrator memory cleanup completed', {
          format,
          resourcesCleaned: cleanupResult.resourcesCleaned,
          cleanupDuration: cleanupResult.duration
        });
      }
    }
  }

  /**
   * Execute memory-managed OBJ+MTL export
   */
  async executeMemoryManagedObjMtlExport(preparedData, options = {}) {
    const { onProgress } = options;

    if (!this.objMtlExporter) {
      throw new Error('Memory-managed OBJ+MTL exporter not available');
    }

    this.memoryManager.setExportPhase(ExportPhase.PROCESSING, { subFormat: 'obj-mtl' });
    onProgress?.(10, 'Initializing memory-managed OBJ+MTL export...');

    // Execute with memory coordination
    const result = await this.objMtlExporter.export(preparedData, {
      onProgress: (progress) => onProgress?.(10 + (progress * 0.8), 'Executing OBJ+MTL export...'),
      ...options
    });

    onProgress?.(90, 'Finalizing memory-managed OBJ+MTL export...');

    // Add Revit-specific metadata
    result.revitInstructions = this.generateRevitImportInstructions('obj');
    result.formatInfo = {
      type: 'obj+mtl',
      description: 'Memory-managed Wavefront OBJ geometry with MTL materials',
      compatibility: 'Revit 2016+',
      importMethod: 'Insert > Import CAD or Import 3D plugin',
      memoryManaged: true
    };

    return result;
  }

  /**
   * Execute memory-managed IFC-JSON export (placeholder)
   */
  async executeMemoryManagedIfcJsonExport(preparedData, options = {}) {
    // This would be implemented when IFC exporter is available
    throw new Error('Memory-managed IFC-JSON export not yet implemented');
  }
}

/**
 * Utility functions for memory management integration
 */

/**
 * Create memory-managed VolumetricMeshGenerator
 */
export function createMemoryManagedVolumetricMeshGenerator(options = {}) {
  const memoryManager = getExportMemoryManager({
    debugMode: false,
    warningThreshold: 0.75,
    ...options.memoryOptions
  });

  return {
    /**
     * Generate geological meshes with memory management
     */
    async generateStratigraphy(boreholes, extent, settings = {}, progressCallback) {
      const operationId = `volumetric-mesh-${Date.now()}`;

      try {
        memoryManager.startExportOperation(operationId, { operation: 'volumetric-mesh' });
        memoryManager.setExportPhase(ExportPhase.PROCESSING);

        // Use original VolumetricMeshGenerator with memory tracking
        const volumes = await VolumetricMeshGenerator.generateStratigraphy(
          boreholes,
          extent,
          settings,
          (progress) => {
            progressCallback?.(progress);

            // Monitor memory pressure during generation
            if (progress % 20 === 0) {
              const stats = memoryManager.getExportMemoryStats();
              if (stats.memoryMonitoring.currentPressure === 'critical') {
                exportLogger.warn('Critical memory pressure during volumetric mesh generation', {
                  progress,
                  memoryUsage: stats.memoryMonitoring.lastSnapshot?.usage
                });
              }
            }
          }
        );

        // Track generated volumes
        volumes.forEach((volume, index) => {
          memoryManager.trackExportResource(
            `volumetric-volume-${index}`,
            volume,
            ResourceType.GEOLOGICAL_MESH,
            { temporary: false, geological: true }
          );
        });

        memoryManager.setExportPhase(ExportPhase.COMPLETED);

        exportLogger.info('Memory-managed volumetric mesh generation completed', {
          volumeCount: volumes.length,
          memoryStats: memoryManager.getExportMemoryStats().export
        });

        return volumes;

      } catch (error) {
        memoryManager.setExportPhase(ExportPhase.FAILED, { error: error.message });
        exportLogger.error('Memory-managed volumetric mesh generation failed:', error);
        throw error;

      } finally {
        memoryManager.cleanupExportOperation();
      }
    }
  };
}

/**
 * Export service factory with memory management
 */
export function createMemoryManagedExportService(format, options = {}) {
  switch (format.toLowerCase()) {
    case 'obj-mtl':
    case 'revit-obj':
      return new MemoryManagedObjMtlExporter();

    case 'revit':
    case 'revit-orchestrated':
      return new MemoryManagedRevitExportOrchestrator();

    default:
      throw new Error(`Unsupported export format for memory management: ${format}`);
  }
}

/**
 * Global memory management utilities
 */
export const ExportMemoryUtils = {
  /**
   * Monitor memory during export operations
   */
  async monitorExportMemory(exportOperation, options = {}) {
    const memoryManager = getExportMemoryManager();
    const monitoringId = `memory-monitor-${Date.now()}`;

    memoryManager.startExportOperation(monitoringId, { monitoring: true });

    try {
      const result = await exportOperation();

      const finalStats = memoryManager.getExportMemoryStats();
      exportLogger.info('Export memory monitoring completed', {
        peakUsage: finalStats.memoryMonitoring.peakUsage,
        warnings: finalStats.memoryMonitoring.warningsCount,
        duration: finalStats.export.duration
      });

      return {
        result,
        memoryStats: finalStats
      };

    } finally {
      memoryManager.cleanupExportOperation();
    }
  },

  /**
   * Get global memory statistics
   */
  getGlobalMemoryStats() {
    const memoryManager = getExportMemoryManager();
    return memoryManager.getExportMemoryStats();
  },

  /**
   * Force cleanup of all export memory resources
   */
  forceGlobalCleanup() {
    const memoryManager = getExportMemoryManager();
    memoryManager.cleanupExportOperation(true);

    // Force garbage collection if available
    if (window.gc) {
      try {
        window.gc();
        exportLogger.info('Forced garbage collection completed');
      } catch (e) {
        exportLogger.warn('Garbage collection not available');
      }
    }
  }
};

export default {
  MemoryManagedObjMtlExporter,
  MemoryManagedRevitExportOrchestrator,
  createMemoryManagedVolumetricMeshGenerator,
  createMemoryManagedExportService,
  ExportMemoryUtils
};