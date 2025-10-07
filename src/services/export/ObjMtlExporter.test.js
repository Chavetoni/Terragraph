/**
 * ObjMtlExporter Integration Test
 *
 * This test verifies the basic functionality and integration patterns
 * of the ObjMtlExporter with the existing geological modeling system.
 */

import { ObjMtlExporter } from './ObjMtlExporter.js';
import { RevitExportOrchestrator } from './RevitExportOrchestrator.js';
import {
  BufferGeometry,
  BufferAttribute,
  MeshStandardMaterial,
  Mesh,
  Scene,
  Color
} from 'three';

// Mock test data
const createMockGeologicalData = () => {
  // Create simple test geometry
  const geometry = new BufferGeometry();
  const vertices = new Float32Array([
    0, 0, 0,   1, 0, 0,   0.5, 1, 0,
    1, 0, 0,   2, 0, 0,   1.5, 1, 0
  ]);
  geometry.setAttribute('position', new BufferAttribute(vertices, 3));
  geometry.computeVertexNormals();

  // Create test material
  const material = new MeshStandardMaterial({
    color: new Color('#D2691E')
  });
  material.userData = { geologicalMaterial: 'SW' };

  // Create test mesh
  const mesh = new Mesh(geometry, material);
  mesh.name = 'TestGeologicalLayer_SW';
  mesh.userData = {
    type: 'geological',
    geologicalMaterial: 'SW'
  };

  return {
    objects: [{
      name: 'TestGeologicalLayer_SW',
      type: 'geological',
      geometry: geometry,
      material: material,
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
      userData: {
        type: 'geological',
        geologicalMaterial: 'SW'
      }
    }],
    materials: ['SW'],
    waterTableElements: [],
    boreholes: [],
    stats: {
      totalObjects: 1,
      uniqueMaterials: 1,
      boreholeCount: 0,
      waterTableElements: 0
    }
  };
};

const createMockPreparedData = () => {
  const geologicalData = createMockGeologicalData();

  return {
    format: 'revit-obj',
    geologicalData,
    materialData: {
      materials: new Map([
        ['SW', {
          name: 'SW',
          color: 0xF4A460,
          opacity: 1.0,
          geological: true,
          properties: {
            type: 'SW',
            hasTexture: false,
            emissive: 0x000000,
            roughness: 0.8,
            metalness: 0.0
          }
        }]
      ]),
      textures: new Map(),
      includeTextures: false,
      includeMaterials: true
    },
    spatialData: {
      coordinateSystem: {
        units: 'imperial',
        origin: { x: 0, y: 0, z: 0 },
        conversionFactor: 1.0
      },
      boreholes: [],
      sceneBounds: {
        min: { x: -10, y: -10, z: -10 },
        max: { x: 10, y: 10, z: 10 }
      }
    },
    formatSpecificData: {
      generateMTL: true,
      includeTextures: false,
      optimizeMeshes: false,
      groupByMaterial: true
    },
    metadata: {
      project: {
        name: 'Test Geological Model',
        created: new Date().toISOString()
      }
    },
    settings: {},
    timestamp: new Date().toISOString()
  };
};

/**
 * Basic functionality test
 */
async function testBasicFunctionality() {
  console.log('Testing ObjMtlExporter basic functionality...');

  const exporter = new ObjMtlExporter();
  const mockData = createMockPreparedData();

  // Test canExport
  const canExport = await exporter.canExport(mockData);
  console.log('Can export:', canExport);

  if (!canExport) {
    throw new Error('Exporter should be able to handle mock data');
  }

  // Test export execution
  let progressCalls = 0;
  const result = await exporter.export(mockData, {
    onProgress: (progress, message) => {
      progressCalls++;
      console.log(`Progress: ${progress}% - ${message}`);
    }
  });

  console.log('Export result:', {
    format: result.format,
    filesCount: result.files?.length || 0,
    totalSize: result.totalSize || 0,
    progressCalls
  });

  // Validate results
  if (!result.files || result.files.length === 0) {
    throw new Error('Export should generate files');
  }

  const objFile = result.files.find(f => f.name.endsWith('.obj'));
  const mtlFile = result.files.find(f => f.name.endsWith('.mtl'));

  if (!objFile) {
    throw new Error('Export should generate OBJ file');
  }

  if (!mtlFile) {
    throw new Error('Export should generate MTL file when requested');
  }

  console.log('✓ Basic functionality test passed');
  return result;
}

/**
 * Integration test with RevitExportOrchestrator
 */
async function testRevitIntegration() {
  console.log('Testing RevitExportOrchestrator integration...');

  const orchestrator = new RevitExportOrchestrator();
  const exporter = new ObjMtlExporter();

  // Register exporter with orchestrator
  orchestrator.setObjMtlExporter(exporter);

  const mockScene = new Scene();
  const sceneData = {
    scene: mockScene,
    boreholes: [],
    soilLayers: [],
    geologicalModel: {}
  };

  // Test capability check
  const canExport = await orchestrator.canExport(sceneData, {
    format: 'revit-obj'
  });

  console.log('Orchestrator can export:', canExport);

  if (canExport) {
    console.log('✓ RevitExportOrchestrator integration test passed');
  } else {
    console.log('⚠ RevitExportOrchestrator integration needs scene data');
  }

  return { canExport };
}

/**
 * Material processing test
 */
async function testMaterialProcessing() {
  console.log('Testing material processing...');

  const exporter = new ObjMtlExporter();
  const mockData = createMockPreparedData();

  // Add more materials for testing
  mockData.materialData.materials.set('CL', {
    name: 'CL',
    color: 0x8FBC8F,
    opacity: 0.8,
    geological: true,
    properties: {
      type: 'CL',
      hasTexture: true,
      emissive: 0x000000
    }
  });

  mockData.geologicalData.materials.push('CL');

  const result = await exporter.export(mockData);

  // Check MTL content for both materials
  const mtlFile = result.files.find(f => f.name.endsWith('.mtl'));
  if (mtlFile && mtlFile.content) {
    const materialCount = (mtlFile.content.match(/newmtl/g) || []).length;
    console.log('Materials in MTL file:', materialCount);

    if (materialCount < 2) {
      throw new Error('MTL should contain multiple materials');
    }
  }

  console.log('✓ Material processing test passed');
  return result;
}

/**
 * Run all tests
 */
async function runTests() {
  try {
    console.log('=== ObjMtlExporter Test Suite ===\n');

    await testBasicFunctionality();
    console.log('');

    await testRevitIntegration();
    console.log('');

    await testMaterialProcessing();
    console.log('');

    console.log('=== All Tests Passed ===');

  } catch (error) {
    console.error('Test failed:', error);
    throw error;
  }
}

// Export for manual testing
export {
  runTests,
  testBasicFunctionality,
  testRevitIntegration,
  testMaterialProcessing,
  createMockGeologicalData,
  createMockPreparedData
};