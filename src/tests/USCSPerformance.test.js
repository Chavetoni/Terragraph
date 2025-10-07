/**
 * Performance Test Suite for USCS Materials Integration
 * 
 * This test suite validates that the USCS materials integration does not
 * degrade system performance and maintains the target interaction latency
 * of <200ms for responsive geological model interactions.
 * 
 * Performance Testing Focus:
 * 1. USCS material color resolution performance (<5ms per lookup)
 * 2. Borehole visualization creation with USCS materials (<50ms per borehole)
 * 3. Volumetric mesh generation performance with USCS materials
 * 4. Memory usage optimization with USCS material caching
 * 5. Large dataset handling (100+ boreholes with USCS materials)
 * 6. Spatial indexing performance with USCS material data
 * 7. Overall system responsiveness targets
 */

import * as THREE from 'three';
import BoreholeVisualizer from '../services/BoreholeVisualizer';
import { VolumetricMeshGenerator } from '../services/VolumetricMeshGenerator';
import { OptimizedVolumetricMeshGenerator } from '../services/OptimizedVolumetricMeshGenerator';
import { MultiLevelSurfaceGenerator } from '../services/MultiLevelSurfaceGenerator';
import { getMaterialProperties, USCS_CLASSIFICATIONS } from '../utils/materialStandardization';

// Performance testing constants
const PERFORMANCE_THRESHOLDS = {
  MATERIAL_COLOR_LOOKUP: 5,      // 5ms per color lookup
  BOREHOLE_CREATION: 50,         // 50ms per borehole visualization
  SPATIAL_INDEX_BUILD: 100,      // 100ms for 100 boreholes
  VOLUMETRIC_MESH_SMALL: 200,    // 200ms for small mesh (4x4 grid)
  VOLUMETRIC_MESH_LARGE: 1000,   // 1000ms for large mesh (20x20 grid)
  MEMORY_INCREASE_LIMIT: 10 * 1024 * 1024, // 10MB memory increase limit
  TOTAL_INTERACTION_LATENCY: 200  // Target <200ms for user interactions
};

// Mock Three.js for performance testing
jest.mock('three', () => ({
  Color: jest.fn((color) => {
    const hex = typeof color === 'string' && color.startsWith('#') ? 
      parseInt(color.slice(1), 16) : 0x808080;
    const mockColor = {
      r: ((hex >> 16) & 255) / 255,
      g: ((hex >> 8) & 255) / 255,
      b: (hex & 255) / 255,
      getHex: () => hex,
      clone: () => mockColor,
      multiplyScalar: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis()
    };
    return mockColor;
  }),
  
  Group: jest.fn(() => ({
    name: '', userData: {}, children: [],
    add: jest.fn(), position: { set: jest.fn() },
    layers: { enable: jest.fn() }, updateMatrixWorld: jest.fn(),
    traverse: jest.fn()
  })),
  
  CylinderGeometry: jest.fn(() => ({
    dispose: jest.fn(),
    setAttribute: jest.fn(),
    computeBoundingSphere: jest.fn()
  })),
  
  SphereGeometry: jest.fn(() => ({ dispose: jest.fn() })),
  CircleGeometry: jest.fn(() => ({ dispose: jest.fn() })),
  BufferGeometry: jest.fn(() => ({
    dispose: jest.fn(), setAttribute: jest.fn(),
    setIndex: jest.fn(), computeVertexNormals: jest.fn(),
    computeBoundingSphere: jest.fn()
  })),
  
  MeshStandardMaterial: jest.fn(() => ({ dispose: jest.fn() })),
  MeshLambertMaterial: jest.fn(() => ({ dispose: jest.fn() })),
  
  Mesh: jest.fn(() => ({
    position: { set: jest.fn() }, layers: { enable: jest.fn() },
    userData: {}, geometry: { computeBoundingSphere: jest.fn() }
  })),
  
  CanvasTexture: jest.fn(() => ({
    wrapS: 0, wrapT: 0, repeat: { set: jest.fn() },
    needsUpdate: true, dispose: jest.fn()
  })),
  
  Float32BufferAttribute: jest.fn(),
  Uint32BufferAttribute: jest.fn(),
  DoubleSide: 2
}));

// Mock utilities for performance testing
jest.mock('../utils/scaleConstants', () => ({
  getBoreholeDimensions: () => ({ markerRadius: 1.0, markerHeight: 2.0 })
}));

jest.mock('../utils/threeJsHelpers', () => ({
  createGlassmorphismLabel: jest.fn(() => ({ position: { set: jest.fn() } }))
}));

// Mock interpolation engines for performance testing
jest.mock('../services/SpatialInterpolationEngine', () => ({
  SpatialInterpolationEngine: {
    interpolateGrid: jest.fn(() => {
      // Simulate processing time
      const start = performance.now();
      while (performance.now() - start < 1) {} // 1ms processing simulation
      return [
        { x: 0, y: 0, z: 10, material: 'CL', confidence: 0.8 }
      ];
    })
  }
}));

jest.mock('../services/AdvancedInterpolationEngine', () => ({
  AdvancedInterpolationEngine: {
    interpolateMultiMethod: jest.fn(() => {
      // Simulate processing time
      const start = performance.now();
      while (performance.now() - start < 2) {} // 2ms processing simulation
      return {
        surface: [{ x: 0, y: 0, z: 10 }],
        quality: 0.8,
        method: 'idw'
      };
    })
  }
}));

describe('USCS Materials Performance Testing', () => {
  let mockScene, mockCamera, mockSceneManager, boreholeVisualizer;

  beforeEach(() => {
    mockScene = { add: jest.fn(), remove: jest.fn(), traverse: jest.fn() };
    mockCamera = { position: { x: 0, y: 10, z: 10 } };
    mockSceneManager = { addCSS3D: jest.fn(), removeCSS3D: jest.fn() };
    
    boreholeVisualizer = new BoreholeVisualizer(mockScene, mockCamera, mockSceneManager);
    jest.clearAllMocks();
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
  });

  afterEach(() => {
    if (boreholeVisualizer) {
      boreholeVisualizer.dispose();
    }
  });

  describe('USCS Material Color Resolution Performance', () => {
    test('should resolve USCS material colors within performance threshold', () => {
      const allUSCSMaterials = Object.keys(USCS_CLASSIFICATIONS);
      const performanceResults = [];

      allUSCSMaterials.forEach(material => {
        const start = performance.now();
        const color = BoreholeVisualizer.getMaterialColor(material);
        const end = performance.now();
        
        const duration = end - start;
        performanceResults.push({ material, duration });
        
        expect(color).toBeInstanceOf(THREE.Color);
        expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.MATERIAL_COLOR_LOOKUP);
      });

      // Calculate average performance
      const avgDuration = performanceResults.reduce((sum, result) => 
        sum + result.duration, 0) / performanceResults.length;
      
      expect(avgDuration).toBeLessThan(PERFORMANCE_THRESHOLDS.MATERIAL_COLOR_LOOKUP);
      
      // Log performance results for analysis
      console.log(`USCS Material Color Resolution - Average: ${avgDuration.toFixed(2)}ms`);
    });

    test('should maintain consistent performance with repeated color lookups', () => {
      const testMaterials = ['CL', 'SW', 'GW', 'CH', 'ML'];
      const iterations = 1000;
      
      const start = performance.now();
      
      for (let i = 0; i < iterations; i++) {
        const material = testMaterials[i % testMaterials.length];
        VolumetricMeshGenerator.getMaterialColor(material);
      }
      
      const end = performance.now();
      const totalDuration = end - start;
      const avgPerLookup = totalDuration / iterations;
      
      expect(avgPerLookup).toBeLessThan(PERFORMANCE_THRESHOLDS.MATERIAL_COLOR_LOOKUP);
      console.log(`Repeated Color Lookups - Average: ${avgPerLookup.toFixed(3)}ms per lookup`);
    });

    test('should demonstrate performance improvement with caching', () => {
      const testMaterial = 'CL';
      
      // First lookup (should create and cache)
      const start1 = performance.now();
      const color1 = OptimizedVolumetricMeshGenerator.getMaterialColor(testMaterial);
      const end1 = performance.now();
      const firstLookupTime = end1 - start1;
      
      // Second lookup (should use cache)
      const start2 = performance.now();
      const color2 = OptimizedVolumetricMeshGenerator.getMaterialColor(testMaterial);
      const end2 = performance.now();
      const cachedLookupTime = end2 - start2;
      
      expect(color1).toBe(color2); // Should be same cached object
      expect(cachedLookupTime).toBeLessThan(firstLookupTime); // Cache should be faster
      expect(cachedLookupTime).toBeLessThan(1); // Cached lookup should be very fast
      
      console.log(`Caching Performance - First: ${firstLookupTime.toFixed(2)}ms, Cached: ${cachedLookupTime.toFixed(2)}ms`);
    });
  });

  describe('Borehole Visualization Performance', () => {
    test('should create USCS borehole visualizations within performance threshold', () => {
      const testMaterials = ['GW', 'SW', 'CL', 'CH', 'ML', 'SM', 'PT'];
      
      testMaterials.forEach(material => {
        const borehole = {
          id: `perf-test-${material}`,
          x: 100, y: 50, z: 0,
          diameter: 0.2, depth: 15,
          layers: [
            { id: 1, material: material, from: 0, to: 15 }
          ]
        };

        const start = performance.now();
        const boreholeGroup = boreholeVisualizer.createEnhancedBoreholeMarker(borehole);
        const end = performance.now();
        
        const duration = end - start;
        
        expect(boreholeGroup).toBeTruthy();
        expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.BOREHOLE_CREATION);
        
        console.log(`Borehole Creation (${material}): ${duration.toFixed(2)}ms`);
      });
    });

    test('should handle multiple USCS layers efficiently in single borehole', () => {
      const complexBorehole = {
        id: 'complex-perf-test',
        x: 100, y: 50, z: 0,
        diameter: 0.2, depth: 20,
        layers: [
          { id: 1, material: 'CL', from: 0, to: 5 },
          { id: 2, material: 'SW', from: 5, to: 10 },
          { id: 3, material: 'GW', from: 10, to: 15 },
          { id: 4, material: 'CH', from: 15, to: 20 }
        ]
      };

      const start = performance.now();
      const boreholeGroup = boreholeVisualizer.createEnhancedBoreholeMarker(complexBorehole);
      const strataGroup = boreholeVisualizer.createBoreholeStrata(complexBorehole, { layers: [] });
      const end = performance.now();
      
      const duration = end - start;
      
      expect(boreholeGroup).toBeTruthy();
      expect(strataGroup).toBeTruthy();
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.BOREHOLE_CREATION * 2); // Allow extra time for complexity
      
      console.log(`Complex Borehole (4 USCS layers): ${duration.toFixed(2)}ms`);
    });

    test('should create texture patterns efficiently for all USCS materials', () => {
      const allUSCSMaterials = Object.keys(USCS_CLASSIFICATIONS);
      const texturePerformance = [];
      
      allUSCSMaterials.forEach(material => {
        // Mock canvas for texture creation
        global.document = {
          createElement: jest.fn(() => ({
            width: 128, height: 128,
            getContext: jest.fn(() => ({
              fillStyle: '', strokeStyle: '', lineWidth: 0,
              fillRect: jest.fn(), strokeRect: jest.fn(),
              beginPath: jest.fn(), moveTo: jest.fn(), lineTo: jest.fn(),
              stroke: jest.fn(), fill: jest.fn(), arc: jest.fn(),
              font: '', textAlign: '', fillText: jest.fn()
            }))
          }))
        };
        
        const materialProps = getMaterialProperties(material);
        
        const start = performance.now();
        const texture = boreholeVisualizer.createHighContrastSoilTexture(material, materialProps.color);
        const end = performance.now();
        
        const duration = end - start;
        texturePerformance.push({ material, duration });
        
        expect(texture).toBeTruthy();
        expect(duration).toBeLessThan(20); // Texture creation should be fast
      });

      const avgTextureDuration = texturePerformance.reduce((sum, result) => 
        sum + result.duration, 0) / texturePerformance.length;
      
      expect(avgTextureDuration).toBeLessThan(10);
      console.log(`Texture Creation - Average: ${avgTextureDuration.toFixed(2)}ms`);
    });
  });

  describe('Spatial Indexing Performance', () => {
    test('should build spatial index efficiently with USCS materials', () => {
      const boreholeCount = 100;
      const largeDataset = [];
      const allUSCSMaterials = Object.keys(USCS_CLASSIFICATIONS);
      
      for (let i = 0; i < boreholeCount; i++) {
        const material = allUSCSMaterials[i % allUSCSMaterials.length];
        largeDataset.push({
          id: `spatial-perf-${i}`,
          x: (i % 10) * 50,
          y: Math.floor(i / 10) * 50,
          z: 0,
          depth: 10,
          layers: [
            { id: 1, material: material, from: 0, to: 10 }
          ]
        });
      }

      const start = performance.now();
      const spatialIndex = VolumetricMeshGenerator.buildSpatialIndex(largeDataset);
      const end = performance.now();
      
      const duration = end - start;
      
      expect(spatialIndex).toBeInstanceOf(Map);
      expect(spatialIndex.size).toBeGreaterThan(0);
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.SPATIAL_INDEX_BUILD);
      
      console.log(`Spatial Index Build (${boreholeCount} boreholes): ${duration.toFixed(2)}ms`);
    });

    test('should perform optimized spatial index operations efficiently', () => {
      const boreholeCount = 200;
      const optimizedDataset = [];
      const testMaterials = ['CL', 'SW', 'GW', 'CH', 'ML', 'SM'];
      
      for (let i = 0; i < boreholeCount; i++) {
        optimizedDataset.push({
          id: `opt-spatial-${i}`,
          x: (i % 15) * 30,
          y: Math.floor(i / 15) * 30,
          z: 0,
          depth: 12,
          layers: [
            { id: 1, material: testMaterials[i % testMaterials.length], from: 0, to: 12 }
          ]
        });
      }

      const start = performance.now();
      const spatialIndex = OptimizedVolumetricMeshGenerator.buildSpatialIndex(optimizedDataset);
      const end = performance.now();
      
      const indexDuration = end - start;
      
      // Test multiple nearby searches
      const searchStart = performance.now();
      for (let i = 0; i < 50; i++) {
        OptimizedVolumetricMeshGenerator.getNearbyBoreholes(
          i * 10, i * 8, 100, spatialIndex
        );
      }
      const searchEnd = performance.now();
      
      const searchDuration = searchEnd - searchStart;
      const avgSearchTime = searchDuration / 50;
      
      expect(indexDuration).toBeLessThan(PERFORMANCE_THRESHOLDS.SPATIAL_INDEX_BUILD * 2);
      expect(avgSearchTime).toBeLessThan(5); // Each search should be very fast
      
      console.log(`Optimized Spatial Operations - Index: ${indexDuration.toFixed(2)}ms, Avg Search: ${avgSearchTime.toFixed(2)}ms`);
    });
  });

  describe('Volumetric Mesh Generation Performance', () => {
    test('should generate small volumetric meshes with USCS materials efficiently', () => {
      const topSurface = [
        { x: 0, y: 0, z: 10 }, { x: 20, y: 0, z: 9 },
        { x: 0, y: 20, z: 11 }, { x: 20, y: 20, z: 8 }
      ];

      const bottomSurface = [
        { x: 0, y: 0, z: 5 }, { x: 20, y: 0, z: 4 },
        { x: 0, y: 20, z: 6 }, { x: 20, y: 20, z: 3 }
      ];

      const extent = { minX: -1, maxX: 21, minY: -1, maxY: 21 };
      const testMaterials = ['CL', 'SW', 'GW', 'CH', 'ML'];
      
      testMaterials.forEach(material => {
        const start = performance.now();
        const layerVolume = VolumetricMeshGenerator.createLayerVolume(
          topSurface, bottomSurface, material, extent, 4, { opacity: 0.7 }
        );
        const end = performance.now();
        
        const duration = end - start;
        
        expect(layerVolume).toBeTruthy();
        expect(layerVolume.vertices.length).toBeGreaterThan(0);
        expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.VOLUMETRIC_MESH_SMALL);
        
        console.log(`Small Volumetric Mesh (${material}): ${duration.toFixed(2)}ms`);
      });
    });

    test('should handle large volumetric mesh generation within acceptable time', () => {
      // Create larger surface for performance testing
      const gridSize = 20; // 20x20 grid
      const topSurface = [];
      const bottomSurface = [];
      
      for (let x = 0; x < gridSize; x++) {
        for (let y = 0; y < gridSize; y++) {
          topSurface.push({
            x: x * 10,
            y: y * 10,
            z: 15 + Math.random() * 5
          });
          
          bottomSurface.push({
            x: x * 10,
            y: y * 10,
            z: 5 + Math.random() * 2
          });
        }
      }

      const extent = { minX: -5, maxX: (gridSize - 1) * 10 + 5, minY: -5, maxY: (gridSize - 1) * 10 + 5 };
      
      const start = performance.now();
      const layerVolume = VolumetricMeshGenerator.createLayerVolume(
        topSurface, bottomSurface, 'CL', extent, gridSize, { opacity: 0.7 }
      );
      const end = performance.now();
      
      const duration = end - start;
      
      expect(layerVolume).toBeTruthy();
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.VOLUMETRIC_MESH_LARGE);
      
      console.log(`Large Volumetric Mesh (${gridSize}x${gridSize}): ${duration.toFixed(2)}ms`);
    });
  });

  describe('Multi-Level Surface Generation Performance', () => {
    test('should generate multi-level surfaces with USCS materials efficiently', () => {
      const surfaceSize = 9; // 3x3 grid
      const topSurface = [];
      const bottomSurface = [];
      const layerPoints = [];
      
      for (let i = 0; i < surfaceSize; i++) {
        const x = (i % 3) * 25;
        const y = Math.floor(i / 3) * 25;
        
        topSurface.push({ x, y, z: 12 + Math.random() * 3, material: 'CL' });
        bottomSurface.push({ x, y, z: 5 + Math.random() * 2 });
        
        if (i % 2 === 0) { // Sparse layer points
          layerPoints.push({ x: x + 12, y: y + 12, z: 8.5 + Math.random() * 2, material: 'CL' });
        }
      }

      const options = {
        internalLevels: 4,
        interpolationMethod: 'multi',
        adaptiveRefinement: true
      };

      const start = performance.now();
      const result = MultiLevelSurfaceGenerator.generateInternalSurfaces(
        topSurface, bottomSurface, layerPoints, options
      );
      const end = performance.now();
      
      const duration = end - start;
      
      expect(result).toBeTruthy();
      expect(result.allSurfaces.length).toBeGreaterThan(2);
      expect(duration).toBeLessThan(500); // Multi-level generation should be reasonable
      
      console.log(`Multi-Level Surface Generation: ${duration.toFixed(2)}ms`);
    });
  });

  describe('Memory Usage Performance', () => {
    test('should maintain memory efficiency with USCS materials', () => {
      if (!global.gc) {
        console.warn('Garbage collection not available - skipping memory test');
        return;
      }

      // Force garbage collection
      global.gc();
      const memoryStart = process.memoryUsage().heapUsed;
      
      // Create moderate dataset
      const boreholeCount = 50;
      const testDataset = [];
      const allUSCSMaterials = Object.keys(USCS_CLASSIFICATIONS);
      
      for (let i = 0; i < boreholeCount; i++) {
        const material = allUSCSMaterials[i % allUSCSMaterials.length];
        testDataset.push({
          id: `memory-test-${i}`,
          x: (i % 8) * 25,
          y: Math.floor(i / 8) * 25,
          z: 0,
          depth: 12,
          layers: [
            { id: 1, material: material, from: 0, to: 6 },
            { id: 2, material: allUSCSMaterials[(i + 1) % allUSCSMaterials.length], from: 6, to: 12 }
          ]
        });
      }

      // Process all boreholes
      testDataset.forEach(borehole => {
        const group = boreholeVisualizer.createEnhancedBoreholeMarker(borehole);
        expect(group).toBeTruthy();
      });

      // Build spatial index
      const spatialIndex = OptimizedVolumetricMeshGenerator.buildSpatialIndex(testDataset);
      expect(spatialIndex.size).toBeGreaterThan(0);

      // Access materials many times (test caching efficiency)
      for (let i = 0; i < 1000; i++) {
        const material = allUSCSMaterials[i % allUSCSMaterials.length];
        OptimizedVolumetricMeshGenerator.getMaterialColor(material);
      }

      // Force garbage collection again
      global.gc();
      const memoryEnd = process.memoryUsage().heapUsed;
      const memoryIncrease = memoryEnd - memoryStart;
      
      expect(memoryIncrease).toBeLessThan(PERFORMANCE_THRESHOLDS.MEMORY_INCREASE_LIMIT);
      
      console.log(`Memory Usage Test - Increase: ${(memoryIncrease / (1024 * 1024)).toFixed(2)}MB`);
    });

    test('should demonstrate memory efficiency of caching system', () => {
      const memoryStart = process.memoryUsage().heapUsed;
      
      // Access same materials repeatedly
      const commonMaterials = ['CL', 'SW', 'GW', 'CH', 'ML'];
      
      for (let i = 0; i < 5000; i++) {
        const material = commonMaterials[i % commonMaterials.length];
        OptimizedVolumetricMeshGenerator.getMaterialColor(material);
      }
      
      const memoryEnd = process.memoryUsage().heapUsed;
      const memoryIncrease = memoryEnd - memoryStart;
      
      // With caching, memory increase should be minimal
      expect(memoryIncrease).toBeLessThan(1024 * 1024); // Less than 1MB
      
      console.log(`Caching Memory Efficiency - Increase: ${(memoryIncrease / 1024).toFixed(2)}KB for 5000 lookups`);
    });
  });

  describe('Overall System Performance Integration', () => {
    test('should maintain target interaction latency with USCS materials', () => {
      // Simulate typical user interaction: create borehole -> visualize -> generate model
      const interactionBorehole = {
        id: 'interaction-test',
        x: 100, y: 50, z: 0,
        diameter: 0.2, depth: 15,
        layers: [
          { id: 1, material: 'CL', from: 0, to: 8 },
          { id: 2, material: 'SW', from: 8, to: 15 }
        ]
      };

      const start = performance.now();
      
      // Step 1: Create borehole visualization
      const boreholeGroup = boreholeVisualizer.createEnhancedBoreholeMarker(interactionBorehole);
      
      // Step 2: Create strata visualization
      const strataGroup = boreholeVisualizer.createBoreholeStrata(interactionBorehole, { layers: [] });
      
      // Step 3: Get material colors for UI consistency
      interactionBorehole.layers.forEach(layer => {
        VolumetricMeshGenerator.getMaterialColor(layer.material);
      });
      
      // Step 4: Build spatial index (for site context)
      const spatialIndex = OptimizedVolumetricMeshGenerator.buildSpatialIndex([interactionBorehole]);
      
      const end = performance.now();
      const totalInteractionTime = end - start;
      
      expect(boreholeGroup).toBeTruthy();
      expect(strataGroup).toBeTruthy();
      expect(spatialIndex.size).toBeGreaterThan(0);
      expect(totalInteractionTime).toBeLessThan(PERFORMANCE_THRESHOLDS.TOTAL_INTERACTION_LATENCY);
      
      console.log(`Complete User Interaction Latency: ${totalInteractionTime.toFixed(2)}ms`);
    });

    test('should handle concurrent operations without performance degradation', async () => {
      const concurrentMaterials = ['CL', 'SW', 'GW', 'CH', 'ML', 'SM', 'GP', 'SC'];
      
      const start = performance.now();
      
      // Simulate concurrent material processing
      const promises = concurrentMaterials.map(async (material, index) => {
        // Stagger operations slightly
        await new Promise(resolve => setTimeout(resolve, index));
        
        const borehole = {
          id: `concurrent-${material}`,
          x: index * 30, y: index * 20, z: 0,
          diameter: 0.2, depth: 10,
          layers: [{ id: 1, material: material, from: 0, to: 10 }]
        };
        
        // Perform multiple operations
        const group = boreholeVisualizer.createEnhancedBoreholeMarker(borehole);
        const color = OptimizedVolumetricMeshGenerator.getMaterialColor(material);
        
        return { group, color, material };
      });
      
      const results = await Promise.all(promises);
      const end = performance.now();
      
      const totalConcurrentTime = end - start;
      
      // Verify all operations completed successfully
      results.forEach(result => {
        expect(result.group).toBeTruthy();
        expect(result.color).toBeInstanceOf(THREE.Color);
      });
      
      // Concurrent operations should complete within reasonable time
      expect(totalConcurrentTime).toBeLessThan(500);
      
      console.log(`Concurrent Operations (${concurrentMaterials.length} materials): ${totalConcurrentTime.toFixed(2)}ms`);
    });
  });
  
  describe('Performance Regression Detection', () => {
    test('should maintain performance benchmarks for key operations', () => {
      const benchmarks = {
        singleMaterialColorLookup: 0,
        boreholeCreation: 0,
        spatialIndexBuild: 0,
        volumetricMeshSmall: 0
      };

      // Benchmark: Single material color lookup
      let start = performance.now();
      VolumetricMeshGenerator.getMaterialColor('CL');
      benchmarks.singleMaterialColorLookup = performance.now() - start;

      // Benchmark: Borehole creation
      const testBorehole = {
        id: 'benchmark-borehole',
        x: 100, y: 50, z: 0,
        diameter: 0.2, depth: 15,
        layers: [{ id: 1, material: 'CL', from: 0, to: 15 }]
      };

      start = performance.now();
      const group = boreholeVisualizer.createEnhancedBoreholeMarker(testBorehole);
      benchmarks.boreholeCreation = performance.now() - start;

      // Benchmark: Spatial index build
      const benchmarkDataset = Array.from({ length: 20 }, (_, i) => ({
        id: `benchmark-${i}`,
        x: (i % 5) * 20, y: Math.floor(i / 5) * 20, z: 0,
        depth: 10, layers: [{ id: 1, material: 'CL', from: 0, to: 10 }]
      }));

      start = performance.now();
      const spatialIndex = OptimizedVolumetricMeshGenerator.buildSpatialIndex(benchmarkDataset);
      benchmarks.spatialIndexBuild = performance.now() - start;

      // Benchmark: Small volumetric mesh
      const topSurface = [
        { x: 0, y: 0, z: 10 }, { x: 10, y: 0, z: 10 },
        { x: 0, y: 10, z: 10 }, { x: 10, y: 10, z: 10 }
      ];
      const bottomSurface = [
        { x: 0, y: 0, z: 5 }, { x: 10, y: 0, z: 5 },
        { x: 0, y: 10, z: 5 }, { x: 10, y: 10, z: 5 }
      ];

      start = performance.now();
      const volume = VolumetricMeshGenerator.createLayerVolume(
        topSurface, bottomSurface, 'CL',
        { minX: -1, maxX: 11, minY: -1, maxY: 11 }, 2, { opacity: 0.7 }
      );
      benchmarks.volumetricMeshSmall = performance.now() - start;

      // Verify all benchmarks meet thresholds
      expect(benchmarks.singleMaterialColorLookup).toBeLessThan(PERFORMANCE_THRESHOLDS.MATERIAL_COLOR_LOOKUP);
      expect(benchmarks.boreholeCreation).toBeLessThan(PERFORMANCE_THRESHOLDS.BOREHOLE_CREATION);
      expect(benchmarks.spatialIndexBuild).toBeLessThan(PERFORMANCE_THRESHOLDS.SPATIAL_INDEX_BUILD);
      expect(benchmarks.volumetricMeshSmall).toBeLessThan(PERFORMANCE_THRESHOLDS.VOLUMETRIC_MESH_SMALL);

      // Log benchmarks for performance tracking
      console.log('Performance Benchmarks:');
      Object.entries(benchmarks).forEach(([operation, time]) => {
        console.log(`  ${operation}: ${time.toFixed(2)}ms`);
      });

      // Verify all objects were created successfully
      expect(group).toBeTruthy();
      expect(spatialIndex.size).toBeGreaterThan(0);
      expect(volume).toBeTruthy();
    });
  });
});