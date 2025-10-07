/**
 * RevitExportOrchestrator - Main orchestration service for Revit/BIM exports
 *
 * This service implements the IExportStrategy interface and coordinates
 * all Revit-compatible export functionality including OBJ+MTL and IFC-JSON formats.
 *
 * Integrates with existing geological modeling contexts and Three.js scene data
 * while maintaining full backward compatibility with existing export functionality.
 */

import { exportLogger } from '../../utils/Logger.js';
import { EXPORT_FORMATS } from '../../contexts/ExportContext.js';
import { volumetricTracker } from '../../utils/volumetricDisposal.js';
import { ObjMtlExporter } from './ObjMtlExporter.js';

/**
 * RevitExportOrchestrator class implementing IExportStrategy interface
 */
export class RevitExportOrchestrator {
  constructor() {
    this.name = 'RevitExportOrchestrator';
    this.version = '1.0.0';
    this.supportedFormats = [EXPORT_FORMATS.REVIT_OBJ, EXPORT_FORMATS.REVIT_IFC];

    // Initialize sub-exporters
    this.objMtlExporter = new ObjMtlExporter();
    this.ifcJsonExporter = null; // Will be injected when IFC exporter is implemented

    // Temporary resources tracking for cleanup
    this.tempResources = new Set();

    exportLogger.info('RevitExportOrchestrator initialized with ObjMtlExporter');
  }

  /**
   * Set the OBJ+MTL exporter instance
   */
  setObjMtlExporter(exporter) {
    this.objMtlExporter = exporter;
    exportLogger.info('OBJ+MTL exporter registered with RevitExportOrchestrator');
  }

  /**
   * Set the IFC-JSON exporter instance
   */
  setIfcJsonExporter(exporter) {
    this.ifcJsonExporter = exporter;
    exportLogger.info('IFC-JSON exporter registered with RevitExportOrchestrator');
  }

  /**
   * Check if this orchestrator can handle the requested export
   * @param {Object} sceneData - Complete scene data
   * @param {Object} options - Export options including format
   * @returns {boolean} - Whether export can be handled
   */
  async canExport(sceneData, options = {}) {
    try {
      const { format } = options;

      // Check supported formats
      if (!this.supportedFormats.includes(format)) {
        exportLogger.warn(`Unsupported format requested: ${format}`);
        return false;
      }

      // Validate scene data structure
      if (!sceneData || !sceneData.scene) {
        exportLogger.warn('Invalid scene data: missing scene object');
        return false;
      }

      // Check format-specific requirements
      switch (format) {
        case EXPORT_FORMATS.REVIT_OBJ:
          if (!this.objMtlExporter) {
            exportLogger.warn('OBJ+MTL exporter not available');
            return false;
          }
          return this.validateGeologicalSceneData(sceneData);

        case EXPORT_FORMATS.REVIT_IFC:
          if (!this.ifcJsonExporter) {
            exportLogger.warn('IFC-JSON exporter not available');
            return false;
          }
          return this.validateGeologicalSceneData(sceneData);

        default:
          return false;
      }
    } catch (error) {
      exportLogger.error('Error checking export capability:', error);
      return false;
    }
  }

  /**
   * Validate geological scene data for Revit export
   */
  validateGeologicalSceneData(sceneData) {
    const { scene, boreholes = [], soilLayers = [], geologicalModel } = sceneData;

    // Check for valid Three.js scene
    if (!scene || typeof scene.traverse !== 'function') {
      exportLogger.warn('Invalid Three.js scene object');
      return false;
    }

    // Count geological objects in scene
    let geologicalObjectCount = 0;
    let materialCount = 0;
    const materials = new Set();

    scene.traverse((child) => {
      if (child.isMesh && child.userData?.type === 'geological') {
        geologicalObjectCount++;
        if (child.material) {
          const material = Array.isArray(child.material) ? child.material[0] : child.material;
          if (material.userData?.geologicalMaterial) {
            materials.add(material.userData.geologicalMaterial);
            materialCount++;
          }
        }
      }
    });

    // Log validation results
    exportLogger.info('Geological scene validation:', {
      geologicalObjects: geologicalObjectCount,
      uniqueMaterials: materials.size,
      totalMaterials: materialCount,
      boreholes: boreholes.length,
      soilLayers: soilLayers.length,
      hasGeologicalModel: !!geologicalModel
    });

    // Basic validation - need at least some geological data
    if (geologicalObjectCount === 0 && boreholes.length === 0 && soilLayers.length === 0) {
      exportLogger.warn('No geological data found for Revit export');
      return false;
    }

    return true;
  }

  /**
   * Prepare export data by processing scene and extracting geological information
   * @param {Object} sceneData - Complete scene data
   * @param {Object} options - Export options and settings
   * @returns {Object} - Prepared data for export
   */
  async prepareExport(sceneData, options = {}) {
    const { format, settings = {}, onProgress } = options;

    exportLogger.info(`Preparing Revit export for format: ${format}`, { settings });

    try {
      // Initialize progress
      onProgress?.(0, 'Analyzing geological scene...');

      // Extract geological data from scene
      const geologicalData = await this.extractGeologicalData(sceneData, {
        onProgress: (progress) => onProgress?.(progress * 0.4, 'Extracting geological data...')
      });

      // Process materials and textures
      onProgress?.(40, 'Processing materials and textures...');
      const materialData = await this.processMaterials(sceneData.scene, settings);

      // Extract spatial and metadata information
      onProgress?.(60, 'Processing spatial data...');
      const spatialData = await this.extractSpatialData(sceneData, settings);

      // Generate BIM-compatible metadata
      onProgress?.(80, 'Generating BIM metadata...');
      const metadata = await this.generateBIMMetadata(sceneData, settings);

      // Prepare format-specific data
      onProgress?.(90, 'Preparing format-specific data...');
      const formatSpecificData = await this.prepareFormatSpecificData(
        format,
        { geologicalData, materialData, spatialData, metadata },
        settings
      );

      onProgress?.(100, 'Export preparation complete');

      const preparedData = {
        format,
        geologicalData,
        materialData,
        spatialData,
        metadata,
        formatSpecificData,
        settings,
        timestamp: new Date().toISOString(),
        sceneInfo: this.getSceneInfo(sceneData.scene)
      };

      // Track prepared data for cleanup
      this.tempResources.add(preparedData);

      exportLogger.info('Export preparation completed successfully', {
        format,
        geologicalObjects: geologicalData.objects.length,
        materials: materialData.materials.size,
        dataSize: JSON.stringify(preparedData).length
      });

      return preparedData;

    } catch (error) {
      exportLogger.error('Export preparation failed:', error);
      throw new Error(`Export preparation failed: ${error.message}`);
    }
  }

  /**
   * Execute the actual export using appropriate exporter
   * @param {Object} preparedData - Data prepared by prepareExport
   * @param {Object} options - Execution options
   * @returns {Object} - Export results
   */
  async execute(preparedData, options = {}) {
    const { format } = preparedData;
    const { onProgress, cancellationToken } = options;

    exportLogger.info(`Executing Revit export for format: ${format}`);

    try {
      let exportResult;

      switch (format) {
        case EXPORT_FORMATS.REVIT_OBJ:
          exportResult = await this.executeObjMtlExport(preparedData, { onProgress, cancellationToken });
          break;

        case EXPORT_FORMATS.REVIT_IFC:
          exportResult = await this.executeIfcJsonExport(preparedData, { onProgress, cancellationToken });
          break;

        default:
          throw new Error(`Unsupported format: ${format}`);
      }

      // Add orchestrator metadata
      exportResult.orchestrator = {
        name: this.name,
        version: this.version,
        executedAt: new Date().toISOString(),
        format
      };

      exportLogger.info(`Revit export execution completed for format: ${format}`, {
        filesGenerated: exportResult.files?.length || 0,
        totalSize: exportResult.totalSize || 0
      });

      return exportResult;

    } catch (error) {
      exportLogger.error(`Export execution failed for format: ${format}`, error);

      // Check if cancellation was requested
      if (cancellationToken?.isCancelled) {
        throw new Error('Export cancelled by user');
      }

      throw new Error(`Export execution failed: ${error.message}`);
    }
  }

  /**
   * Execute OBJ+MTL export
   */
  async executeObjMtlExport(preparedData, options = {}) {
    const { onProgress } = options;

    if (!this.objMtlExporter) {
      throw new Error('OBJ+MTL exporter not available');
    }

    onProgress?.(10, 'Initializing OBJ+MTL export...');

    // Execute OBJ+MTL export
    const result = await this.objMtlExporter.export(preparedData, {
      onProgress: (progress) => onProgress?.(10 + (progress * 0.8), 'Generating OBJ+MTL files...'),
      ...options
    });

    onProgress?.(90, 'Finalizing OBJ+MTL export...');

    // Add Revit-specific metadata
    result.revitInstructions = this.generateRevitImportInstructions('obj');
    result.formatInfo = {
      type: 'obj+mtl',
      description: 'Wavefront OBJ geometry with MTL materials',
      compatibility: 'Revit 2016+',
      importMethod: 'Insert > Import CAD or Import 3D plugin'
    };

    return result;
  }

  /**
   * Execute IFC-JSON export
   */
  async executeIfcJsonExport(preparedData, options = {}) {
    const { onProgress } = options;

    if (!this.ifcJsonExporter) {
      throw new Error('IFC-JSON exporter not available');
    }

    onProgress?.(10, 'Initializing IFC-JSON export...');

    // Execute IFC-JSON export
    const result = await this.ifcJsonExporter.export(preparedData, {
      onProgress: (progress) => onProgress?.(10 + (progress * 0.8), 'Generating IFC-JSON files...'),
      ...options
    });

    onProgress?.(90, 'Finalizing IFC-JSON export...');

    // Add Revit-specific metadata
    result.revitInstructions = this.generateRevitImportInstructions('ifc');
    result.formatInfo = {
      type: 'ifc-json',
      description: 'Industry Foundation Classes JSON format',
      compatibility: 'Revit 2018+ (with IFC import)',
      importMethod: 'Insert > Link IFC or Insert > Import CAD'
    };

    return result;
  }

  /**
   * Extract geological data from Three.js scene
   */
  async extractGeologicalData(sceneData, options = {}) {
    const { scene, boreholes = [], geologicalModel, waterTableData } = sceneData;
    const { onProgress } = options;

    const geologicalObjects = [];
    const materials = new Set();
    const waterTableElements = [];

    // Extract geological meshes from scene
    scene.traverse((child) => {
      if (child.isMesh) {
        const isGeological = child.userData?.type === 'geological' ||
          child.name?.includes('geological') ||
          child.name?.includes('Volumetric') ||
          child.name?.includes('Borehole');

        if (isGeological) {
          geologicalObjects.push({
            name: child.name || 'GeologicalObject',
            type: child.userData?.type || 'geological',
            geometry: child.geometry,
            material: child.material,
            position: child.position.clone(),
            rotation: child.rotation.clone(),
            scale: child.scale.clone(),
            userData: { ...child.userData }
          });

          // Extract material information
          const material = Array.isArray(child.material) ? child.material[0] : child.material;
          if (material?.userData?.geologicalMaterial) {
            materials.add(material.userData.geologicalMaterial);
          }
        }

        // Extract water table elements
        if (child.userData?.type === 'waterTable' || child.name?.includes('WaterTable')) {
          waterTableElements.push({
            name: child.name || 'WaterTable',
            position: child.position.clone(),
            geometry: child.geometry,
            material: child.material,
            userData: { ...child.userData }
          });
        }
      }
    });

    onProgress?.(100);

    return {
      objects: geologicalObjects,
      materials: Array.from(materials),
      waterTableElements,
      boreholes,
      geologicalModel,
      waterTableData,
      stats: {
        totalObjects: geologicalObjects.length,
        uniqueMaterials: materials.size,
        boreholeCount: boreholes.length,
        waterTableElements: waterTableElements.length
      }
    };
  }

  /**
   * Process materials for BIM compatibility
   */
  async processMaterials(scene, settings) {
    const materials = new Map();
    const textures = new Map();

    scene.traverse((child) => {
      if (child.isMesh && child.material) {
        const material = Array.isArray(child.material) ? child.material[0] : child.material;
        const geologicalType = material.userData?.geologicalMaterial || 'Unknown';

        if (!materials.has(geologicalType)) {
          materials.set(geologicalType, {
            name: geologicalType,
            color: material.color ? material.color.getHex() : 0xffffff,
            opacity: material.transparent ? material.opacity : 1.0,
            geological: true,
            properties: {
              type: geologicalType,
              hasTexture: !!material.map,
              emissive: material.emissive?.getHex() || 0x000000,
              roughness: material.roughness || 0.8,
              metalness: material.metalness || 0.0
            }
          });
        }

        // Track textures
        if (material.map) {
          textures.set(`${geologicalType}_diffuse`, {
            type: 'diffuse',
            material: geologicalType,
            texture: material.map,
            geological: true
          });
        }
      }
    });

    return {
      materials,
      textures,
      includeTextures: settings.includeTextures !== false,
      includeMaterials: settings.includeMaterials !== false
    };
  }

  /**
   * Extract spatial data and coordinate information
   */
  async extractSpatialData(sceneData, settings) {
    const { boreholes = [], strataDimensions = {}, siteMap } = sceneData;

    // Calculate scene bounds
    const sceneBounds = this.calculateSceneBounds(sceneData.scene);

    // Determine coordinate system
    const coordinateSystem = {
      units: settings.unitSystem || 'imperial',
      origin: { x: 0, y: 0, z: 0 },
      bounds: sceneBounds,
      conversionFactor: settings.unitSystem === 'metric' ? 0.3048 : 1.0 // feet to meters
    };

    // Extract borehole spatial data
    const spatialBoreholes = boreholes.map(borehole => ({
      id: borehole.id,
      name: borehole.name || `Borehole_${borehole.id}`,
      position: {
        x: borehole.x || 0,
        y: borehole.y || 0,
        z: borehole.z || 0
      },
      depth: borehole.totalDepth || borehole.depth || 0,
      layers: borehole.layers || [],
      waterTable: borehole.waterTable || null
    }));

    return {
      coordinateSystem,
      boreholes: spatialBoreholes,
      sceneBounds,
      siteMap: siteMap ? {
        position: siteMap.position || { x: 0, y: 0, z: 0 },
        scale: siteMap.scale || { x: 1, y: 1, z: 1 },
        rotation: siteMap.rotation || { x: 0, y: 0, z: 0 }
      } : null,
      strataDimensions
    };
  }

  /**
   * Generate BIM-compatible metadata
   */
  async generateBIMMetadata(sceneData, settings) {
    const { boreholes = [], geologicalModel, waterTableData } = sceneData;

    return {
      project: {
        name: 'Geological Model Export',
        description: 'Exported geological model from Geotech Visualizer',
        created: new Date().toISOString(),
        software: 'Geotech Visualizer',
        version: '1.0'
      },
      geological: {
        boreholeCount: boreholes.length,
        hasWaterTable: !!waterTableData,
        modelingMethod: geologicalModel?.settings?.interpolationMethod || 'unknown',
        confidence: geologicalModel?.confidence || null
      },
      bim: {
        format: settings.format,
        units: settings.unitSystem || 'imperial',
        compatibility: settings.format === EXPORT_FORMATS.REVIT_IFC ? 'IFC4' : 'OBJ+MTL',
        includeGeologicalProperties: settings.includeGeologicalProperties !== false
      },
      export: {
        timestamp: new Date().toISOString(),
        settings: { ...settings }
      }
    };
  }

  /**
   * Prepare format-specific data
   */
  async prepareFormatSpecificData(format, data, settings) {
    switch (format) {
      case EXPORT_FORMATS.REVIT_OBJ:
        return {
          generateMTL: settings.includeMaterials !== false,
          includeTextures: settings.includeTextures !== false,
          optimizeMeshes: settings.detailLevel !== 'high',
          groupByMaterial: true
        };

      case EXPORT_FORMATS.REVIT_IFC:
        return {
          ifcVersion: settings.ifcVersion || '4',
          spatialStructure: settings.spatialStructure || 'site-building',
          includeGeologicalProperties: settings.includeGeologicalProperties !== false,
          includeBoreholesAsColumns: settings.includeBoreholesAsColumns !== false
        };

      default:
        return {};
    }
  }

  /**
   * Generate Revit import instructions
   */
  generateRevitImportInstructions(format) {
    const baseInstructions = {
      version: 'Compatible with Revit 2016+',
      coordinate_system: 'Maintain coordinate system during import',
      units: 'Verify units match project settings'
    };

    switch (format) {
      case 'obj':
        return {
          ...baseInstructions,
          import_method: '⚠️ REQUIRES THIRD-PARTY PLUGIN - Revit does NOT natively support OBJ files',
          steps: [
            '1. ⚠️ CRITICAL: Purchase and install OBJ import plugin (e.g., ProtoTech OBJ Importer)',
            '2. Alternative: Convert OBJ to DWG/FBX using external software first',
            '3. Open Revit and navigate to Insert tab',
            '4. Use plugin-specific import command (NOT native Import CAD)',
            '5. Select the exported .obj file',
            '⚠️ WARNING: Materials (.mtl) may NOT be imported by most plugins',
            '6. Manually reassign geological materials in Revit Materials panel',
            '7. Verify model scale and positioning are correct'
          ],
          materials: '⚠️ WARNING: Material data will likely be lost - manual reassignment required',
          textures: '⚠️ WARNING: Textures typically not supported by OBJ plugins',
          compatibility: 'LOW - Requires paid plugins and manual material work'
        };

      case 'ifc':
        return {
          ...baseInstructions,
          import_method: 'Use Insert > Link IFC',
          steps: [
            '1. Open Revit and navigate to Insert tab',
            '2. Click Link IFC',
            '3. Select the exported .ifc file',
            '4. Configure import settings',
            '5. Link or import as needed',
            '6. Review geological properties in Properties panel'
          ],
          properties: 'Geological properties preserved as IFC parameters',
          spatial_structure: 'Site > Building > Geological elements'
        };

      default:
        return baseInstructions;
    }
  }

  /**
   * Calculate scene bounds for spatial reference
   */
  calculateSceneBounds(scene) {
    const bounds = {
      min: { x: Infinity, y: Infinity, z: Infinity },
      max: { x: -Infinity, y: -Infinity, z: -Infinity }
    };

    scene.traverse((child) => {
      if (child.isMesh && child.geometry) {
        child.geometry.computeBoundingBox();
        const box = child.geometry.boundingBox;

        if (box) {
          bounds.min.x = Math.min(bounds.min.x, box.min.x);
          bounds.min.y = Math.min(bounds.min.y, box.min.y);
          bounds.min.z = Math.min(bounds.min.z, box.min.z);
          bounds.max.x = Math.max(bounds.max.x, box.max.x);
          bounds.max.y = Math.max(bounds.max.y, box.max.y);
          bounds.max.z = Math.max(bounds.max.z, box.max.z);
        }
      }
    });

    return bounds;
  }

  /**
   * Get basic scene information
   */
  getSceneInfo(scene) {
    let meshCount = 0;
    let materialCount = 0;
    let vertexCount = 0;

    scene.traverse((child) => {
      if (child.isMesh) {
        meshCount++;
        if (child.geometry?.attributes?.position) {
          vertexCount += child.geometry.attributes.position.count;
        }
        if (child.material) {
          materialCount++;
        }
      }
    });

    return {
      meshes: meshCount,
      materials: materialCount,
      vertices: vertexCount,
      name: scene.name || 'GeologicalScene'
    };
  }

  /**
   * Cleanup temporary resources
   */
  async cleanup(preparedData = null, exportResult = null) {
    exportLogger.info('Cleaning up RevitExportOrchestrator resources');

    try {
      // Clean up temporary resources
      this.tempResources.forEach(resource => {
        // Clean up any temporary geometries or materials created during preparation
        if (resource.geologicalData?.objects) {
          resource.geologicalData.objects.forEach(obj => {
            // Only dispose if we created temporary copies
            if (obj.userData?.temporary) {
              obj.geometry?.dispose?.();
              if (Array.isArray(obj.material)) {
                obj.material.forEach(mat => mat?.dispose?.());
              } else {
                obj.material?.dispose?.();
              }
            }
          });
        }
      });

      this.tempResources.clear();

      // Let volumetric tracker handle any tracked resources
      if (volumetricTracker?.getStats?.()?.tracked > 0) {
        exportLogger.info('Disposing tracked volumetric resources');
        volumetricTracker.disposeAll();
      }

      exportLogger.info('RevitExportOrchestrator cleanup completed');

    } catch (error) {
      exportLogger.error('Error during RevitExportOrchestrator cleanup:', error);
    }
  }

  /**
   * Get orchestrator information
   */
  getInfo() {
    return {
      name: this.name,
      version: this.version,
      supportedFormats: this.supportedFormats,
      hasObjMtlExporter: !!this.objMtlExporter,
      hasIfcJsonExporter: !!this.ifcJsonExporter,
      status: 'ready'
    };
  }
}

export default RevitExportOrchestrator;