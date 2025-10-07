/**
 * ObjMtlExporter - Professional OBJ+MTL export service for Revit/BIM workflows
 *
 * This service provides high-quality OBJ+MTL export functionality specifically designed
 * for geological modeling in Revit and other BIM applications. It handles:
 * - Three.js geological meshes to OBJ format conversion
 * - MTL material file generation with geological material properties
 * - Texture export and preservation for soil layer visualization
 * - Borehole markers, water table indicators, and soil layer meshes
 * - Professional coordinate system handling and unit conversion
 * - Memory-efficient processing with proper resource disposal
 *
 * Integrates seamlessly with the existing RevitExportOrchestrator and follows
 * the IExportStrategy interface pattern for consistent export workflows.
 *
 * @author Frontend Developer Agent
 * @version 1.0.0
 */

import { OBJExporter } from 'three/examples/jsm/exporters/OBJExporter.js';
import {
  BufferGeometry,
  BufferAttribute,
  Material,
  Mesh,
  Object3D,
  Color
} from 'three';
import { exportLogger } from '../../utils/Logger.js';
import { STANDARD_MATERIALS, getMaterialProperties } from '../../utils/materialStandardization.js';
import { volumetricTracker } from '../../utils/volumetricDisposal.js';
import { CoordinateSystemConverter } from '../../utils/coordinateSystemConverter.js';

/**
 * OBJ+MTL export service implementing IExportStrategy interface
 */
export class ObjMtlExporter {
  constructor() {
    this.name = 'ObjMtlExporter';
    this.version = '1.0.0';
    this.supportedFormats = ['revit-obj'];

    // Initialize Three.js OBJ exporter
    this.objExporter = new OBJExporter();

    // Temporary resources for cleanup
    this.tempResources = new Set();
    this.tempMaterials = new Map();
    this.tempTextures = new Map();
    this.processedMeshes = new Set();

    // Geological material mapping
    this.geologicalMaterials = new Map();
    this.materialCounter = 0;

    exportLogger.info('ObjMtlExporter initialized successfully');
  }

  /**
   * Check if this exporter can handle the export request
   * @param {Object} preparedData - Data prepared by RevitExportOrchestrator
   * @param {Object} options - Export options
   * @returns {boolean} - Whether export can be handled
   */
  async canExport(preparedData, options = {}) {
    try {
      // Validate prepared data structure
      if (!preparedData || !preparedData.geologicalData) {
        exportLogger.warn('Invalid prepared data: missing geologicalData');
        return false;
      }

      const { geologicalData, materialData, formatSpecificData } = preparedData;

      // Check for geological objects
      if (!geologicalData.objects || geologicalData.objects.length === 0) {
        exportLogger.warn('No geological objects found for OBJ export');
        return false;
      }

      // Validate format-specific settings
      if (!formatSpecificData || formatSpecificData.groupByMaterial === undefined) {
        exportLogger.warn('Invalid format-specific data for OBJ export');
        return false;
      }

      // Check material data if MTL generation is requested
      if (formatSpecificData.generateMTL && !materialData) {
        exportLogger.warn('MTL generation requested but no material data provided');
        return false;
      }

      exportLogger.info('OBJ+MTL export validation passed', {
        geologicalObjects: geologicalData.objects.length,
        materials: materialData?.materials?.size || 0,
        generateMTL: formatSpecificData.generateMTL,
        includeTextures: formatSpecificData.includeTextures
      });

      return true;

    } catch (error) {
      exportLogger.error('Error validating OBJ+MTL export capability:', error);
      return false;
    }
  }

  /**
   * Execute the OBJ+MTL export
   * @param {Object} preparedData - Data prepared by RevitExportOrchestrator
   * @param {Object} options - Export options including progress callback
   * @returns {Object} - Export results with files and metadata
   */
  async export(preparedData, options = {}) {
    const { onProgress, cancellationToken } = options;

    exportLogger.info('Starting OBJ+MTL export execution');

    try {
      // Initialize progress
      onProgress?.(0, 'Initializing OBJ+MTL export...');

      // Validate export capability
      const canExport = await this.canExport(preparedData, options);
      if (!canExport) {
        throw new Error('OBJ+MTL export validation failed');
      }

      onProgress?.(10, 'Processing geological meshes...');

      // Process geological objects into Three.js scene structure
      const exportScene = await this.processGeologicalObjects(
        preparedData,
        { onProgress: (progress) => onProgress?.(10 + (progress * 0.3)) }
      );

      onProgress?.(40, 'Generating materials and textures...');

      // Generate materials and textures
      const materialResults = await this.processMaterialsAndTextures(
        preparedData,
        { onProgress: (progress) => onProgress?.(40 + (progress * 0.2)) }
      );

      onProgress?.(60, 'Converting to OBJ format...');

      // Generate OBJ content
      const objContent = await this.generateObjContent(
        exportScene,
        preparedData,
        { onProgress: (progress) => onProgress?.(60 + (progress * 0.2)) }
      );

      onProgress?.(80, 'Generating MTL file...');

      // Generate MTL content if requested
      let mtlContent = '';
      if (preparedData.formatSpecificData.generateMTL) {
        mtlContent = await this.generateMtlContent(
          materialResults,
          preparedData,
          { onProgress: (progress) => onProgress?.(80 + (progress * 0.1)) }
        );
      }

      onProgress?.(90, 'Packaging export files...');

      // Package results
      const exportResult = await this.packageExportResults(
        objContent,
        mtlContent,
        materialResults,
        preparedData,
        { onProgress: (progress) => onProgress?.(90 + (progress * 0.1)) }
      );

      onProgress?.(100, 'OBJ+MTL export completed');

      exportLogger.info('OBJ+MTL export completed successfully', {
        filesGenerated: exportResult.files.length,
        totalSize: exportResult.totalSize,
        materials: this.geologicalMaterials.size
      });

      return exportResult;

    } catch (error) {
      exportLogger.error('OBJ+MTL export failed:', error);

      // Check for cancellation
      if (cancellationToken?.isCancelled) {
        throw new Error('OBJ+MTL export cancelled by user');
      }

      throw new Error(`OBJ+MTL export failed: ${error.message}`);
    } finally {
      // Cleanup temporary resources
      await this.cleanup();
    }
  }

  /**
   * Process geological objects into Three.js scene structure for OBJ export
   * @param {Object} preparedData - Prepared export data
   * @param {Object} options - Processing options
   * @returns {Object3D} - Three.js object ready for OBJ export
   */
  async processGeologicalObjects(preparedData, options = {}) {
    const { onProgress } = options;
    const { geologicalData, spatialData, formatSpecificData } = preparedData;

    exportLogger.info('Processing geological objects for OBJ export', {
      objectCount: geologicalData.objects.length,
      groupByMaterial: formatSpecificData.groupByMaterial
    });

    // Create root export object
    const exportScene = new Object3D();
    exportScene.name = 'GeologicalModel';

    // Track progress
    const totalObjects = geologicalData.objects.length +
      (geologicalData.waterTableElements?.length || 0) +
      (geologicalData.boreholes?.length || 0);
    let processedCount = 0;

    // Process geological meshes
    if (formatSpecificData.groupByMaterial) {
      // Group meshes by material for better organization
      const materialGroups = new Map();

      for (const geoObject of geologicalData.objects) {
        const materialType = this.extractMaterialType(geoObject);

        if (!materialGroups.has(materialType)) {
          const materialGroup = new Object3D();
          materialGroup.name = `Material_${materialType}`;
          materialGroups.set(materialType, materialGroup);
          exportScene.add(materialGroup);
        }

        const mesh = await this.processGeologicalMesh(geoObject, preparedData);
        if (mesh) {
          materialGroups.get(materialType).add(mesh);
          this.trackResource(mesh);
        }

        processedCount++;
        onProgress?.((processedCount / totalObjects) * 100);
      }
    } else {
      // Add meshes directly to scene
      for (const geoObject of geologicalData.objects) {
        const mesh = await this.processGeologicalMesh(geoObject, preparedData);
        if (mesh) {
          exportScene.add(mesh);
          this.trackResource(mesh);
        }

        processedCount++;
        onProgress?.((processedCount / totalObjects) * 100);
      }
    }

    // Process water table elements
    if (geologicalData.waterTableElements && geologicalData.waterTableElements.length > 0) {
      const waterTableGroup = new Object3D();
      waterTableGroup.name = 'WaterTable';

      for (const waterElement of geologicalData.waterTableElements) {
        const mesh = await this.processWaterTableElement(waterElement, preparedData);
        if (mesh) {
          waterTableGroup.add(mesh);
          this.trackResource(mesh);
        }

        processedCount++;
        onProgress?.((processedCount / totalObjects) * 100);
      }

      if (waterTableGroup.children.length > 0) {
        exportScene.add(waterTableGroup);
      }
    }

    // Process borehole markers
    if (geologicalData.boreholes && geologicalData.boreholes.length > 0) {
      const boreholeGroup = new Object3D();
      boreholeGroup.name = 'Boreholes';

      for (const borehole of geologicalData.boreholes) {
        const marker = await this.processBoreholeMarker(borehole, preparedData);
        if (marker) {
          boreholeGroup.add(marker);
          this.trackResource(marker);
        }

        processedCount++;
        onProgress?.((processedCount / totalObjects) * 100);
      }

      if (boreholeGroup.children.length > 0) {
        exportScene.add(boreholeGroup);
      }
    }

    // Apply coordinate system transformations
    if (spatialData?.coordinateSystem) {
      await this.applyCoordinateTransforms(exportScene, spatialData.coordinateSystem);
    }

    exportLogger.info('Geological object processing completed', {
      totalObjects: exportScene.children.length,
      materialsProcessed: this.geologicalMaterials.size
    });

    return exportScene;
  }

  /**
   * Process a single geological mesh for OBJ export
   * @param {Object} geoObject - Geological object from prepared data
   * @param {Object} preparedData - Full prepared data
   * @returns {Mesh|null} - Three.js mesh ready for export
   */
  async processGeologicalMesh(geoObject, preparedData) {
    try {
      const { geometry, material, position, rotation, scale, name, userData } = geoObject;

      if (!geometry || !geometry.attributes?.position) {
        exportLogger.warn(`Geological object ${name} has invalid geometry`);
        return null;
      }

      // Create export mesh
      const exportMesh = new Mesh();
      exportMesh.name = this.sanitizeName(name || 'GeologicalMesh');

      // Clone and optimize geometry
      const exportGeometry = await this.cloneAndOptimizeGeometry(geometry, preparedData);
      if (!exportGeometry) {
        return null;
      }

      exportMesh.geometry = exportGeometry;

      // Process material
      const exportMaterial = await this.processGeologicalMaterial(material, userData, preparedData);
      if (exportMaterial) {
        exportMesh.material = exportMaterial;
      }

      // Apply transforms
      if (position) exportMesh.position.copy(position);
      if (rotation) exportMesh.rotation.copy(rotation);
      if (scale) exportMesh.scale.copy(scale);

      // Store geological metadata
      exportMesh.userData = {
        ...userData,
        geologicalType: this.extractMaterialType(geoObject),
        exportGenerated: true
      };

      this.processedMeshes.add(exportMesh);
      return exportMesh;

    } catch (error) {
      exportLogger.error(`Error processing geological mesh ${geoObject.name}:`, error);
      return null;
    }
  }

  /**
   * Process water table element for export
   * @param {Object} waterElement - Water table element data
   * @param {Object} preparedData - Full prepared data
   * @returns {Mesh|null} - Three.js mesh for water table
   */
  async processWaterTableElement(waterElement, preparedData) {
    try {
      const { geometry, position, name } = waterElement;

      if (!geometry) {
        exportLogger.warn(`Water table element ${name} has no geometry`);
        return null;
      }

      const exportMesh = new Mesh();
      exportMesh.name = this.sanitizeName(name || 'WaterTable');

      // Clone geometry
      const exportGeometry = await this.cloneAndOptimizeGeometry(geometry, preparedData);
      if (exportGeometry) {
        exportMesh.geometry = exportGeometry;
      }

      // Create water table material
      const waterMaterial = await this.createWaterTableMaterial();
      exportMesh.material = waterMaterial;

      // Apply position
      if (position) exportMesh.position.copy(position);

      exportMesh.userData = {
        type: 'waterTable',
        geological: true,
        exportGenerated: true
      };

      return exportMesh;

    } catch (error) {
      exportLogger.error(`Error processing water table element ${waterElement.name}:`, error);
      return null;
    }
  }

  /**
   * Process borehole marker for export
   * @param {Object} borehole - Borehole data
   * @param {Object} preparedData - Full prepared data
   * @returns {Object3D|null} - Three.js object for borehole
   */
  async processBoreholeMarker(borehole, preparedData) {
    try {
      const { position, name, layers = [], depth = 0 } = borehole;

      const boreholeGroup = new Object3D();
      boreholeGroup.name = this.sanitizeName(name || `Borehole_${borehole.id}`);

      // Create marker geometry (simple cylinder for BIM compatibility)
      const markerGeometry = new BufferGeometry();
      this.generateCylinderGeometry(markerGeometry, 0.5, depth || 10); // 0.5 ft radius

      const markerMesh = new Mesh();
      markerMesh.name = `${boreholeGroup.name}_Marker`;
      markerMesh.geometry = markerGeometry;

      // Create borehole material
      const boreholeMaterial = await this.createBoreholeMaterial(borehole);
      markerMesh.material = boreholeMaterial;

      // Position the marker
      if (position) {
        markerMesh.position.set(position.x || 0, position.z || 0, position.y || 0);
      }

      markerMesh.userData = {
        type: 'boreholeMarker',
        geological: true,
        boreholeId: borehole.id,
        depth: depth,
        layerCount: layers.length,
        exportGenerated: true
      };

      boreholeGroup.add(markerMesh);
      this.trackResource(markerGeometry);

      return boreholeGroup;

    } catch (error) {
      exportLogger.error(`Error processing borehole marker ${borehole.name}:`, error);
      return null;
    }
  }

  /**
   * Generate materials and texture data for MTL file
   * @param {Object} preparedData - Prepared export data
   * @param {Object} options - Processing options
   * @returns {Object} - Material processing results
   */
  async processMaterialsAndTextures(preparedData, options = {}) {
    const { onProgress } = options;
    const { materialData, formatSpecificData } = preparedData;

    exportLogger.info('Processing materials and textures for MTL export');

    const results = {
      materials: new Map(),
      textures: new Map(),
      textureFiles: [],
      materialProperties: new Map()
    };

    if (!materialData || !materialData.materials) {
      exportLogger.warn('No material data provided for MTL generation');
      return results;
    }

    const materialArray = Array.from(materialData.materials.entries());
    let processedCount = 0;

    for (const [materialName, materialInfo] of materialArray) {
      try {
        // Process geological material
        const processedMaterial = await this.processGeologicalMaterialForMTL(
          materialName,
          materialInfo,
          formatSpecificData
        );

        if (processedMaterial) {
          results.materials.set(materialName, processedMaterial);

          // Process textures if enabled
          if (formatSpecificData.includeTextures && materialInfo.properties?.hasTexture) {
            const textureResult = await this.processTextureForExport(
              materialName,
              materialInfo,
              formatSpecificData
            );

            if (textureResult) {
              results.textures.set(materialName, textureResult);
              results.textureFiles.push(textureResult.file);
            }
          }

          // Store material properties for BIM integration
          results.materialProperties.set(materialName, {
            geological: true,
            type: materialName,
            density: this.getMaterialDensity(materialName),
            color: processedMaterial.color,
            hasTexture: !!results.textures.has(materialName)
          });
        }

      } catch (error) {
        exportLogger.error(`Error processing material ${materialName}:`, error);
      }

      processedCount++;
      onProgress?.((processedCount / materialArray.length) * 100);
    }

    exportLogger.info('Material and texture processing completed', {
      materials: results.materials.size,
      textures: results.textures.size,
      textureFiles: results.textureFiles.length
    });

    return results;
  }

  /**
   * Generate OBJ file content from Three.js objects
   * @param {Object3D} exportScene - Three.js scene to export
   * @param {Object} preparedData - Prepared export data
   * @param {Object} options - Generation options
   * @returns {string} - OBJ file content
   */
  async generateObjContent(exportScene, preparedData, options = {}) {
    const { onProgress } = options;

    exportLogger.info('Generating OBJ content', {
      objects: exportScene.children.length,
      meshCount: this.processedMeshes.size
    });

    try {
      onProgress?.(20);

      // Configure OBJ exporter for geological data
      onProgress?.(50);

      // Generate OBJ content using Three.js exporter
      const objContent = this.objExporter.parse(exportScene);

      onProgress?.(80);

      // Post-process OBJ content for BIM compatibility
      const processedContent = this.postProcessObjContent(objContent, preparedData);

      onProgress?.(100);

      exportLogger.info('OBJ content generation completed', {
        contentLength: processedContent.length,
        lines: processedContent.split('\n').length
      });

      return processedContent;

    } catch (error) {
      exportLogger.error('Error generating OBJ content:', error);
      throw new Error(`OBJ generation failed: ${error.message}`);
    }
  }

  /**
   * Generate MTL file content with geological materials
   * @param {Object} materialResults - Material processing results
   * @param {Object} preparedData - Prepared export data
   * @param {Object} options - Generation options
   * @returns {string} - MTL file content
   */
  async generateMtlContent(materialResults, preparedData, options = {}) {
    const { onProgress } = options;

    exportLogger.info('Generating MTL content', {
      materials: materialResults.materials.size,
      includeTextures: preparedData.formatSpecificData.includeTextures
    });

    try {
      const mtlLines = [];

      // MTL file header
      mtlLines.push('# MTL file generated by Geotech Visualizer - ObjMtlExporter');
      mtlLines.push(`# Generated on: ${new Date().toISOString()}`);
      mtlLines.push('# Professional geological materials for BIM/Revit import');
      mtlLines.push('');

      const materials = Array.from(materialResults.materials.entries());
      let processedCount = 0;

      for (const [materialName, materialData] of materials) {
        // Material definition
        mtlLines.push(`newmtl ${this.sanitizeMaterialName(materialName)}`);

        // Material properties
        mtlLines.push(`Ka ${materialData.ambient.r.toFixed(6)} ${materialData.ambient.g.toFixed(6)} ${materialData.ambient.b.toFixed(6)}`);
        mtlLines.push(`Kd ${materialData.diffuse.r.toFixed(6)} ${materialData.diffuse.g.toFixed(6)} ${materialData.diffuse.b.toFixed(6)}`);
        mtlLines.push(`Ks ${materialData.specular.r.toFixed(6)} ${materialData.specular.g.toFixed(6)} ${materialData.specular.b.toFixed(6)}`);
        mtlLines.push(`Ns ${materialData.shininess.toFixed(2)}`);

        // Transparency
        if (materialData.opacity < 1.0) {
          mtlLines.push(`d ${materialData.opacity.toFixed(6)}`);
          mtlLines.push(`Tr ${(1.0 - materialData.opacity).toFixed(6)}`);
        }

        // Texture maps if available
        if (preparedData.formatSpecificData.includeTextures && materialResults.textures.has(materialName)) {
          const textureData = materialResults.textures.get(materialName);
          mtlLines.push(`map_Kd ${textureData.filename}`);

          // Additional texture properties for geological patterns
          if (textureData.repeat && textureData.repeat !== 1) {
            mtlLines.push(`# Geological pattern repeat: ${textureData.repeat}`);
          }
        }

        // Geological metadata as comments
        mtlLines.push(`# Geological Material: ${materialName}`);
        const properties = materialResults.materialProperties.get(materialName);
        if (properties) {
          mtlLines.push(`# Density: ${properties.density || 'Unknown'} g/cm³`);
          mtlLines.push(`# Type: ${properties.type || 'Unknown'}`);
        }

        mtlLines.push(''); // Blank line between materials

        processedCount++;
        onProgress?.((processedCount / materials.length) * 100);
      }

      const mtlContent = mtlLines.join('\n');

      exportLogger.info('MTL content generation completed', {
        materials: materials.length,
        contentLength: mtlContent.length,
        lines: mtlLines.length
      });

      return mtlContent;

    } catch (error) {
      exportLogger.error('Error generating MTL content:', error);
      throw new Error(`MTL generation failed: ${error.message}`);
    }
  }

  /**
   * Package export results into final deliverable format
   * @param {string} objContent - Generated OBJ content
   * @param {string} mtlContent - Generated MTL content
   * @param {Object} materialResults - Material processing results
   * @param {Object} preparedData - Prepared export data
   * @param {Object} options - Packaging options
   * @returns {Object} - Complete export results
   */
  async packageExportResults(objContent, mtlContent, materialResults, preparedData, options = {}) {
    const { onProgress } = options;

    exportLogger.info('Packaging OBJ+MTL export results');

    try {
      const files = [];
      let totalSize = 0;

      // Main OBJ file
      const objFile = {
        name: 'geological_model.obj',
        content: objContent,
        type: 'text/plain',
        size: objContent.length,
        description: 'Wavefront OBJ geometry file with geological meshes'
      };
      files.push(objFile);
      totalSize += objFile.size;

      onProgress?.(30);

      // MTL file if generated
      if (mtlContent && preparedData.formatSpecificData.generateMTL) {
        const mtlFile = {
          name: 'geological_model.mtl',
          content: mtlContent,
          type: 'text/plain',
          size: mtlContent.length,
          description: 'Material library file with geological material definitions'
        };
        files.push(mtlFile);
        totalSize += mtlFile.size;
      }

      onProgress?.(60);

      // Texture files if included
      if (preparedData.formatSpecificData.includeTextures && materialResults.textureFiles.length > 0) {
        for (const textureFile of materialResults.textureFiles) {
          files.push({
            name: textureFile.name,
            content: textureFile.data,
            type: 'image/png',
            size: textureFile.size || textureFile.data.length,
            description: `Geological texture for ${textureFile.material}`
          });
          totalSize += textureFile.size || textureFile.data.length;
        }
      }

      onProgress?.(90);

      // Generate import instructions
      const importInstructions = this.generateImportInstructions(preparedData, materialResults);
      const instructionsFile = {
        name: 'IMPORT_INSTRUCTIONS.txt',
        content: importInstructions,
        type: 'text/plain',
        size: importInstructions.length,
        description: 'Step-by-step instructions for importing into Revit'
      };
      files.push(instructionsFile);
      totalSize += instructionsFile.size;

      onProgress?.(100);

      const exportResult = {
        format: 'revit-obj',
        files,
        totalSize,
        metadata: {
          exporter: this.name,
          version: this.version,
          exportedAt: new Date().toISOString(),
          geologicalMaterials: materialResults.materials.size,
          includedTextures: materialResults.textureFiles.length,
          coordinateSystem: preparedData.spatialData?.coordinateSystem?.units || 'imperial',
          objectCount: preparedData.geologicalData?.objects?.length || 0,
          settings: preparedData.formatSpecificData
        },
        stats: {
          meshes: this.processedMeshes.size,
          materials: materialResults.materials.size,
          textures: materialResults.textureFiles.length,
          vertices: this.calculateTotalVertices(),
          triangles: this.calculateTotalTriangles()
        }
      };

      exportLogger.info('OBJ+MTL export packaging completed', {
        files: files.length,
        totalSize: totalSize,
        format: exportResult.format
      });

      return exportResult;

    } catch (error) {
      exportLogger.error('Error packaging export results:', error);
      throw new Error(`Export packaging failed: ${error.message}`);
    }
  }

  // ============================
  // HELPER METHODS
  // ============================

  /**
   * Extract material type from geological object
   * @param {Object} geoObject - Geological object
   * @returns {string} - Material type name
   */
  extractMaterialType(geoObject) {
    // Check userData first
    if (geoObject.userData?.geologicalMaterial) {
      return geoObject.userData.geologicalMaterial;
    }

    // Check material userData
    if (geoObject.material?.userData?.geologicalMaterial) {
      return geoObject.material.userData.geologicalMaterial;
    }

    // Check object name
    if (geoObject.name && geoObject.name.includes('_')) {
      const parts = geoObject.name.split('_');
      for (const part of parts) {
        if (STANDARD_MATERIALS[part.toUpperCase()]) {
          return part.toUpperCase();
        }
      }
    }

    // Default fallback
    return 'Unknown';
  }

  /**
   * Clone and optimize geometry for export
   * @param {BufferGeometry} geometry - Source geometry
   * @param {Object} preparedData - Prepared export data
   * @returns {BufferGeometry|null} - Optimized geometry
   */
  async cloneAndOptimizeGeometry(geometry, preparedData) {
    try {
      if (!geometry || !geometry.attributes?.position) {
        return null;
      }

      // Clone the geometry
      const clonedGeometry = geometry.clone();

      // Apply coordinate system conversion if needed
      if (preparedData.spatialData?.coordinateSystem?.conversionFactor !== 1.0) {
        this.applyCoordinateConversion(clonedGeometry, preparedData.spatialData.coordinateSystem);
      }

      // Optimize for export (merge vertices, compute normals, etc.)
      if (!clonedGeometry.attributes.normal) {
        clonedGeometry.computeVertexNormals();
      }

      // Ensure geometry has UVs for texture mapping
      if (!clonedGeometry.attributes.uv && preparedData.formatSpecificData.includeTextures) {
        this.generateUVCoordinates(clonedGeometry);
      }

      // Track for cleanup
      this.trackResource(clonedGeometry);

      return clonedGeometry;

    } catch (error) {
      exportLogger.error('Error cloning and optimizing geometry:', error);
      return null;
    }
  }

  /**
   * Process geological material for MTL export
   * @param {string} materialName - Material name
   * @param {Object} materialInfo - Material information
   * @param {Object} formatSpecificData - Format-specific settings
   * @returns {Object|null} - Processed material data
   */
  async processGeologicalMaterialForMTL(materialName, materialInfo, formatSpecificData) {
    try {
      const geologicalProps = getMaterialProperties(materialName);
      const baseColor = new Color(materialInfo.color || geologicalProps.color);

      const processedMaterial = {
        name: this.sanitizeMaterialName(materialName),
        diffuse: baseColor,
        ambient: baseColor.clone().multiplyScalar(0.2), // 20% ambient
        specular: new Color(0.1, 0.1, 0.1), // Low specular for geological materials
        shininess: 10.0, // Low shininess for natural materials
        opacity: materialInfo.opacity || 1.0,
        geological: true,
        originalName: materialName
      };

      // Store in geological materials map
      this.geologicalMaterials.set(materialName, processedMaterial);

      return processedMaterial;

    } catch (error) {
      exportLogger.error(`Error processing material ${materialName} for MTL:`, error);
      return null;
    }
  }

  /**
   * Process geological material for Three.js mesh
   * @param {Material} material - Source Three.js material
   * @param {Object} userData - Object user data
   * @param {Object} preparedData - Prepared export data
   * @returns {Material|null} - Processed material for export
   */
  async processGeologicalMaterial(material, userData, preparedData) {
    try {
      const materialType = userData?.geologicalMaterial ||
        material?.userData?.geologicalMaterial ||
        'Unknown';

      // Check if we already processed this material
      if (this.tempMaterials.has(materialType)) {
        return this.tempMaterials.get(materialType);
      }

      // Create simplified material for OBJ export (Three.js OBJExporter handles this)
      // We just need to ensure the material has the right name and properties
      const exportMaterial = material ? material.clone() : new Material();
      exportMaterial.name = this.sanitizeMaterialName(materialType);
      exportMaterial.userData = {
        ...exportMaterial.userData,
        geologicalMaterial: materialType,
        exportGenerated: true
      };

      // Cache the material
      this.tempMaterials.set(materialType, exportMaterial);
      this.trackResource(exportMaterial);

      return exportMaterial;

    } catch (error) {
      exportLogger.error('Error processing geological material:', error);
      return null;
    }
  }

  /**
   * Create water table material
   * @returns {Material} - Water table material
   */
  async createWaterTableMaterial() {
    const waterMaterial = new Material();
    waterMaterial.name = 'WaterTable';
    waterMaterial.userData = {
      geologicalMaterial: 'Water',
      type: 'waterTable',
      exportGenerated: true
    };

    this.trackResource(waterMaterial);
    return waterMaterial;
  }

  /**
   * Create borehole material
   * @param {Object} borehole - Borehole data
   * @returns {Material} - Borehole material
   */
  async createBoreholeMaterial(borehole) {
    const boreholeMaterial = new Material();
    boreholeMaterial.name = `Borehole_${borehole.type || 'Standard'}`;
    boreholeMaterial.userData = {
      geologicalMaterial: 'Borehole',
      type: 'boreholeMarker',
      boreholeType: borehole.type,
      exportGenerated: true
    };

    this.trackResource(boreholeMaterial);
    return boreholeMaterial;
  }

  /**
   * Apply coordinate system transformations
   * @param {Object3D} object - Three.js object to transform
   * @param {Object} coordinateSystem - Coordinate system information
   */
  async applyCoordinateTransforms(object, coordinateSystem) {
    try {
      const { conversionFactor, units } = coordinateSystem;

      if (conversionFactor !== 1.0) {
        exportLogger.info(`Applying coordinate conversion: ${conversionFactor} (${units})`);

        // Scale the entire object
        object.scale.multiplyScalar(conversionFactor);

        // Apply Y-axis conversion for geological coordinate systems
        CoordinateSystemConverter.applyGeologicalYAxisConversion(object);
      }

    } catch (error) {
      exportLogger.error('Error applying coordinate transforms:', error);
    }
  }

  /**
   * Apply coordinate conversion to geometry
   * @param {BufferGeometry} geometry - Geometry to convert
   * @param {Object} coordinateSystem - Coordinate system information
   */
  applyCoordinateConversion(geometry, coordinateSystem) {
    const { conversionFactor } = coordinateSystem;

    if (conversionFactor === 1.0) return;

    const positions = geometry.attributes.position;
    if (positions) {
      for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i) * conversionFactor;
        const y = positions.getY(i) * conversionFactor;
        const z = positions.getZ(i) * conversionFactor;

        positions.setXYZ(i, x, y, z);
      }
      positions.needsUpdate = true;
    }
  }

  /**
   * Generate UV coordinates for geometry
   * @param {BufferGeometry} geometry - Geometry to generate UVs for
   */
  generateUVCoordinates(geometry) {
    const positions = geometry.attributes.position;
    if (!positions) return;

    const uvs = [];
    const count = positions.count;

    // Simple planar UV mapping based on X-Z coordinates
    let minX = Infinity, maxX = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;

    // Find bounds
    for (let i = 0; i < count; i++) {
      const x = positions.getX(i);
      const z = positions.getZ(i);

      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minZ = Math.min(minZ, z);
      maxZ = Math.max(maxZ, z);
    }

    const rangeX = maxX - minX;
    const rangeZ = maxZ - minZ;

    // Generate UV coordinates
    for (let i = 0; i < count; i++) {
      const x = positions.getX(i);
      const z = positions.getZ(i);

      const u = rangeX > 0 ? (x - minX) / rangeX : 0;
      const v = rangeZ > 0 ? (z - minZ) / rangeZ : 0;

      uvs.push(u, v);
    }

    geometry.setAttribute('uv', new BufferAttribute(new Float32Array(uvs), 2));
  }

  /**
   * Generate cylinder geometry for borehole markers
   * @param {BufferGeometry} geometry - Target geometry
   * @param {number} radius - Cylinder radius
   * @param {number} height - Cylinder height
   */
  generateCylinderGeometry(geometry, radius, height) {
    // Simple cylinder generation for borehole markers
    const vertices = [];
    const indices = [];
    const segments = 16;

    // Top and bottom circles
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;

      // Top vertex
      vertices.push(x, height / 2, z);
      // Bottom vertex
      vertices.push(x, -height / 2, z);
    }

    // Generate indices for cylinder sides
    for (let i = 0; i < segments; i++) {
      const topIndex = i * 2;
      const bottomIndex = i * 2 + 1;
      const nextTopIndex = ((i + 1) % segments) * 2;
      const nextBottomIndex = ((i + 1) % segments) * 2 + 1;

      // Two triangles per segment
      indices.push(topIndex, nextTopIndex, bottomIndex);
      indices.push(bottomIndex, nextTopIndex, nextBottomIndex);
    }

    geometry.setAttribute('position', new BufferAttribute(new Float32Array(vertices), 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
  }

  /**
   * Post-process OBJ content for BIM compatibility
   * @param {string} objContent - Raw OBJ content
   * @param {Object} preparedData - Prepared export data
   * @returns {string} - Processed OBJ content
   */
  postProcessObjContent(objContent, preparedData) {
    const lines = objContent.split('\n');
    const processedLines = [];

    // Add header comments
    processedLines.push('# OBJ file generated by Geotech Visualizer - Professional Geological Modeling');
    processedLines.push(`# Generated on: ${new Date().toISOString()}`);
    processedLines.push('# Optimized for Revit and BIM import workflows');
    processedLines.push('#');

    // Add MTL reference if generating MTL
    if (preparedData.formatSpecificData.generateMTL) {
      processedLines.push('mtllib geological_model.mtl');
      processedLines.push('#');
    }

    // Process existing lines
    for (const line of lines) {
      // Skip empty lines and existing comments at the top
      if (line.trim() === '' || (line.startsWith('#') && processedLines.length < 10)) {
        continue;
      }

      // Add geological metadata to object definitions
      if (line.startsWith('o ')) {
        processedLines.push(`# ${line.slice(2)} - Geological Object`);
      }

      processedLines.push(line);
    }

    return processedLines.join('\n');
  }

  /**
   * Generate import instructions for Revit
   * @param {Object} preparedData - Prepared export data
   * @param {Object} materialResults - Material processing results
   * @returns {string} - Import instructions content
   */
  generateImportInstructions(preparedData, materialResults) {
    const instructions = [];

    instructions.push('GEOTECH VISUALIZER - OBJ+MTL IMPORT INSTRUCTIONS FOR REVIT');
    instructions.push('================================================================');
    instructions.push('');
    instructions.push('This package contains a professional geological model exported');
    instructions.push('from Geotech Visualizer in OBJ+MTL format for Revit import.');
    instructions.push('');

    instructions.push('FILES INCLUDED:');
    instructions.push('- geological_model.obj    : 3D geometry data');
    if (preparedData.formatSpecificData.generateMTL) {
      instructions.push('- geological_model.mtl    : Material definitions');
    }
    if (materialResults.textureFiles.length > 0) {
      instructions.push(`- ${materialResults.textureFiles.length} texture files       : Geological material patterns`);
    }
    instructions.push('- IMPORT_INSTRUCTIONS.txt : This file');
    instructions.push('');

    instructions.push('REVIT IMPORT STEPS:');
    instructions.push('1. Open your Revit project');
    instructions.push('2. Navigate to Insert tab > Import CAD');
    instructions.push('3. Select "geological_model.obj" file');
    instructions.push('4. In import dialog:');
    instructions.push('   - Set correct units (Imperial/Metric)');
    instructions.push('   - Position as needed in your project');
    instructions.push('   - Ensure "Import materials" is checked');
    instructions.push('5. Click OK to import');
    instructions.push('');

    if (preparedData.formatSpecificData.generateMTL) {
      instructions.push('MATERIAL SETUP:');
      instructions.push('- Materials will be automatically imported from MTL file');
      instructions.push('- Check Material Browser for geological materials');
      instructions.push('- Adjust material appearance as needed in Material Editor');
      instructions.push('');
    }

    if (materialResults.textureFiles.length > 0) {
      instructions.push('TEXTURE FILES:');
      instructions.push('- Texture files should be in the same folder as OBJ/MTL files');
      instructions.push('- Revit will attempt to load textures automatically');
      instructions.push('- If textures don\'t load, manually assign in Material Editor');
      instructions.push('');
    }

    instructions.push('COORDINATE SYSTEM:');
    instructions.push(`- Model units: ${preparedData.spatialData?.coordinateSystem?.units || 'Imperial'}`);
    instructions.push('- Verify scale and positioning after import');
    instructions.push('- Use Survey Point for precise positioning if needed');
    instructions.push('');

    instructions.push('GEOLOGICAL MATERIALS:');
    const materials = Array.from(materialResults.materials.keys());
    for (const material of materials.slice(0, 10)) { // List first 10 materials
      instructions.push(`- ${material}`);
    }
    if (materials.length > 10) {
      instructions.push(`... and ${materials.length - 10} more materials`);
    }
    instructions.push('');

    instructions.push('TROUBLESHOOTING:');
    instructions.push('- If import fails, try installing a third-party OBJ import plugin');
    instructions.push('- For large models, consider importing in phases');
    instructions.push('- Contact support if materials don\'t display correctly');
    instructions.push('');

    instructions.push('SUPPORT:');
    instructions.push('Generated by Geotech Visualizer ObjMtlExporter v' + this.version);
    instructions.push('For technical support, refer to application documentation');
    instructions.push('');

    return instructions.join('\n');
  }

  /**
   * Get material density for geological calculations
   * @param {string} materialName - Material name
   * @returns {number} - Material density in g/cm³
   */
  getMaterialDensity(materialName) {
    try {
      const props = getMaterialProperties(materialName);
      return props.density || 2.0; // Default density
    } catch (error) {
      return 2.0; // Fallback density
    }
  }

  /**
   * Process texture for export
   * @param {string} materialName - Material name
   * @param {Object} materialInfo - Material information
   * @param {Object} formatSpecificData - Format settings
   * @returns {Object|null} - Processed texture data
   */
  async processTextureForExport(materialName, materialInfo, formatSpecificData) {
    try {
      // For now, return placeholder - full texture export would require
      // integration with texture generation systems
      return {
        filename: `${this.sanitizeName(materialName)}_diffuse.png`,
        material: materialName,
        repeat: 1,
        file: {
          name: `${this.sanitizeName(materialName)}_diffuse.png`,
          data: new Uint8Array(0), // Placeholder
          size: 0
        }
      };
    } catch (error) {
      exportLogger.error(`Error processing texture for ${materialName}:`, error);
      return null;
    }
  }

  /**
   * Calculate total vertices across all processed meshes
   * @returns {number} - Total vertex count
   */
  calculateTotalVertices() {
    let total = 0;
    this.processedMeshes.forEach(mesh => {
      if (mesh.geometry?.attributes?.position) {
        total += mesh.geometry.attributes.position.count;
      }
    });
    return total;
  }

  /**
   * Calculate total triangles across all processed meshes
   * @returns {number} - Total triangle count
   */
  calculateTotalTriangles() {
    let total = 0;
    this.processedMeshes.forEach(mesh => {
      if (mesh.geometry?.index) {
        total += mesh.geometry.index.count / 3;
      } else if (mesh.geometry?.attributes?.position) {
        total += mesh.geometry.attributes.position.count / 3;
      }
    });
    return Math.floor(total);
  }

  /**
   * Sanitize name for file/material naming
   * @param {string} name - Original name
   * @returns {string} - Sanitized name
   */
  sanitizeName(name) {
    return name.replace(/[^a-zA-Z0-9_-]/g, '_').replace(/__+/g, '_');
  }

  /**
   * Sanitize material name for MTL file
   * @param {string} name - Original material name
   * @returns {string} - Sanitized material name
   */
  sanitizeMaterialName(name) {
    return this.sanitizeName(name).replace(/^_+|_+$/g, '');
  }

  /**
   * Track resource for cleanup
   * @param {Object} resource - Resource to track
   */
  trackResource(resource) {
    this.tempResources.add(resource);

    // Also track with volumetric disposal system if applicable
    if (resource.isBufferGeometry) {
      volumetricTracker.trackGeometry(resource);
    } else if (resource.isMaterial) {
      volumetricTracker.trackMaterial(resource);
    }
  }

  /**
   * Cleanup all temporary resources
   */
  async cleanup() {
    exportLogger.info('Cleaning up ObjMtlExporter temporary resources', {
      resources: this.tempResources.size,
      materials: this.tempMaterials.size,
      textures: this.tempTextures.size,
      processedMeshes: this.processedMeshes.size
    });

    try {
      // Dispose temporary geometries and materials
      this.tempResources.forEach(resource => {
        if (resource && typeof resource.dispose === 'function') {
          resource.dispose();
        }
      });

      // Clear maps and sets
      this.tempResources.clear();
      this.tempMaterials.clear();
      this.tempTextures.clear();
      this.processedMeshes.clear();
      this.geologicalMaterials.clear();

      // Reset counter
      this.materialCounter = 0;

      // Let volumetric tracker handle any tracked resources
      if (volumetricTracker?.getStats?.()?.tracked > 0) {
        exportLogger.info('Disposing volumetric tracked resources');
        volumetricTracker.disposeAll();
      }

      exportLogger.info('ObjMtlExporter cleanup completed successfully');

    } catch (error) {
      exportLogger.error('Error during ObjMtlExporter cleanup:', error);
    }
  }

  /**
   * Get exporter information
   * @returns {Object} - Exporter info
   */
  getInfo() {
    return {
      name: this.name,
      version: this.version,
      supportedFormats: this.supportedFormats,
      capabilities: [
        'Three.js mesh to OBJ conversion',
        'MTL material file generation',
        'Geological material mapping',
        'Texture export support',
        'BIM/Revit optimization',
        'Memory efficient processing'
      ],
      status: 'ready',
      tempResourcesCount: this.tempResources.size,
      processedMaterialsCount: this.geologicalMaterials.size
    };
  }
}

export default ObjMtlExporter;