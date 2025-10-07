/**
 * Comprehensive Integration Test Suite for USCS Materials Complete Workflow
 * 
 * This test suite validates the complete integration of the Unified Soil Classification System (USCS)
 * materials throughout the entire 3D geological visualization pipeline, from UI material selection
 * through 3D visualization to interpolation modeling.
 * 
 * Integration Testing Focus:
 * 1. Complete workflow: UI selection -> 3D borehole creation -> interpolation modeling
 * 2. Material consistency across all system components
 * 3. All 16+ USCS materials working correctly in complete pipeline
 * 4. Performance validation across integrated workflow
 * 5. Data flow integrity from input to 3D rendering
 * 6. Error propagation and handling across system boundaries
 * 7. Memory management across integrated components
 */

import * as THREE from 'three';
import BoreholeVisualizer from '../services/BoreholeVisualizer';
import { VolumetricMeshGenerator } from '../services/VolumetricMeshGenerator';
import { OptimizedVolumetricMeshGenerator } from '../services/OptimizedVolumetricMeshGenerator';
import { MultiLevelSurfaceGenerator } from '../services/MultiLevelSurfaceGenerator';
import { getMaterialProperties, STANDARD_MATERIALS, USCS_CLASSIFICATIONS } from '../utils/materialStandardization';

// Mock Three.js comprehensively for integration testing
jest.mock('three', () => {
  const mockGeometry = () => ({
    dispose: jest.fn(),
    setAttribute: jest.fn(),
    setIndex: jest.fn(),
    computeVertexNormals: jest.fn(),
    computeBoundingSphere: jest.fn(),
    attributes: {
      position: { count: 100 }
    }
  });

  const mockMaterial = () => ({
    dispose: jest.fn(),
    color: { set: jest.fn(), multiplyScalar: jest.fn() },
    needsUpdate: true,
    transparent: true,
    opacity: 0.8,
    side: 2
  });

  return {
    Group: jest.fn(() => ({
      name: '',
      userData: {},
      children: [],
      add: jest.fn(function(child) { this.children.push(child); }),
      remove: jest.fn(),
      position: { set: jest.fn() },
      layers: { enable: jest.fn() },
      updateMatrixWorld: jest.fn(),
      traverse: jest.fn(function(callback) { 
        this.children.forEach(child => {
          callback(child);
          if (child.traverse) child.traverse(callback);
        });
      })
    })),
    
    CylinderGeometry: jest.fn(mockGeometry),
    SphereGeometry: jest.fn(mockGeometry),
    ConeGeometry: jest.fn(mockGeometry),
    CircleGeometry: jest.fn(mockGeometry),
    RingGeometry: jest.fn(mockGeometry),
    BufferGeometry: jest.fn(mockGeometry),
    
    MeshStandardMaterial: jest.fn(mockMaterial),
    MeshLambertMaterial: jest.fn(mockMaterial),
    MeshBasicMaterial: jest.fn(mockMaterial),
    
    Mesh: jest.fn(() => ({
      geometry: mockGeometry(),
      material: mockMaterial(),
      position: { set: jest.fn(), clone: () => ({ x: 0, y: 0, z: 0 }) },
      rotation: { x: 0, y: 0, z: 0 },
      layers: { enable: jest.fn() },
      userData: {},
      renderOrder: 0,
      castShadow: true,
      receiveShadow: true,
      traverse: jest.fn()
    })),
    
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
    
    CanvasTexture: jest.fn(() => ({
      wrapS: 0,
      wrapT: 0,
      repeat: { set: jest.fn() },
      magFilter: 0,
      minFilter: 0,
      needsUpdate: true,
      dispose: jest.fn()
    })),
    
    Float32BufferAttribute: jest.fn(),
    Uint32BufferAttribute: jest.fn(),
    
    RepeatWrapping: 1000,
    NearestFilter: 1003,
    DoubleSide: 2
  };
});

// Mock utilities and dependencies
jest.mock('../utils/scaleConstants', () => ({
  getBoreholeDimensions: () => ({
    markerRadius: 1.0,
    markerHeight: 2.0
  })
}));

jest.mock('../utils/threeJsHelpers', () => ({
  createGlassmorphismLabel: jest.fn(() => ({
    position: { set: jest.fn() },
    name: 'mock-label'
  }))
}));

jest.mock('../services/SpatialInterpolationEngine', () => ({
  SpatialInterpolationEngine: {
    interpolateGrid: jest.fn(() => [
      { x: 0, y: 0, z: 10, material: 'CL', confidence: 0.8 },
      { x: 10, y: 0, z: 8, material: 'CL', confidence: 0.8 },
      { x: 0, y: 10, z: 9, material: 'SW', confidence: 0.7 },
      { x: 10, y: 10, z: 7, material: 'SW', confidence: 0.7 }
    ])
  }
}));

jest.mock('../services/GeologicalSequenceEngine', () => ({
  GeologicalSequenceEngine: {
    analyzeSequence: jest.fn(() => ({
      isValidSequence: true,
      layerTransitions: [],
      confidence: 0.9
    }))
  }
}));

jest.mock('../services/AdvancedInterpolationEngine', () => ({
  AdvancedInterpolationEngine: {
    interpolateMultiMethod: jest.fn(() => ({
      surface: [
        { x: 0, y: 0, z: 10 },
        { x: 10, y: 0, z: 8 },
        { x: 0, y: 10, z: 9 },
        { x: 10, y: 10, z: 7 }
      ],
      quality: 0.8,
      method: 'idw'
    })),
    
    analyzeDataDensity: jest.fn(() => ({
      avgDensity: 0.8,
      densityMap: new Map(),
      sparsityZones: []
    })),
    
    calculateQualityMetrics: jest.fn(() => ({
      interpolationQuality: 0.8,
      dataReliability: 0.9,
      spatialCoverage: 0.85
    }))
  }
}));

describe('USCS Materials Complete Workflow Integration', () => {
  let mockScene;
  let mockCamera;
  let mockSceneManager;
  let boreholeVisualizer;

  beforeEach(() => {
    // Setup mock 3D scene environment
    mockScene = {
      add: jest.fn(),
      remove: jest.fn(),
      getObjectByName: jest.fn(),
      traverse: jest.fn()
    };
    
    mockCamera = {
      position: { x: 0, y: 10, z: 10 }
    };
    
    mockSceneManager = {
      addCSS3D: jest.fn(),
      removeCSS3D: jest.fn()
    };

    boreholeVisualizer = new BoreholeVisualizer(mockScene, mockCamera, mockSceneManager);
    
    jest.clearAllMocks();
  });

  afterEach(() => {
    if (boreholeVisualizer) {
      boreholeVisualizer.dispose();
    }
  });

  describe('Complete USCS Workflow: Material Selection to 3D Visualization', () => {
    test('should process complete workflow for all USCS coarse-grained materials', async () => {
      const coarseGrainedMaterials = ['GW', 'GP', 'GM', 'GC', 'SW', 'SP', 'SM', 'SC'];
      
      for (const material of coarseGrainedMaterials) {
        // Step 1: UI Material Selection (simulated)
        const selectedMaterial = material;
        const materialProps = getMaterialProperties(selectedMaterial);
        
        expect(materialProps).toBeTruthy();
        expect(materialProps.color).toBeDefined();
        expect(materialProps.density).toBeGreaterThan(0);

        // Step 2: Borehole Creation with Selected Material
        const borehole = {
          id: `test-borehole-${material}`,
          x: 100,
          y: 50,
          z: 0,
          diameter: 0.2,
          depth: 15,
          layers: [
            {
              id: 1,
              material: selectedMaterial,
              from: 0,
              to: 15,
              description: `${material} layer`
            }
          ]
        };

        // Step 3: 3D Borehole Visualization
        const boreholeGroup = boreholeVisualizer.createEnhancedBoreholeMarker(
          borehole,
          { layers: [] },
          true
        );

        expect(boreholeGroup).toBeTruthy();
        expect(boreholeGroup.name).toBe(`borehole_${borehole.id}`);
        expect(boreholeGroup.children.length).toBeGreaterThan(0);

        // Step 4: Volumetric Mesh Generation
        const topSurface = [
          { x: 90, y: 40, z: 15 },
          { x: 110, y: 40, z: 14 },
          { x: 90, y: 60, z: 15 },
          { x: 110, y: 60, z: 14 }
        ];

        const bottomSurface = [
          { x: 90, y: 40, z: 0 },
          { x: 110, y: 40, z: 0 },
          { x: 90, y: 60, z: 0 },
          { x: 110, y: 60, z: 0 }
        ];

        const extent = { minX: 80, maxX: 120, minY: 30, maxY: 70 };
        
        const layerVolume = VolumetricMeshGenerator.createLayerVolume(
          topSurface,
          bottomSurface,
          selectedMaterial,
          extent,
          2,
          { opacity: 0.7 }
        );

        expect(layerVolume).toBeTruthy();
        expect(layerVolume.vertices).toBeDefined();
        expect(layerVolume.colors).toBeDefined();
        expect(layerVolume.colors.length).toBeGreaterThan(0);

        // Step 5: Verify Color Consistency Across Pipeline
        const visualizerColor = BoreholeVisualizer.getMaterialColor(selectedMaterial);
        const volumeColor = VolumetricMeshGenerator.getMaterialColor(selectedMaterial);
        
        expect(visualizerColor.r).toBeCloseTo(volumeColor.r, 2);
        expect(visualizerColor.g).toBeCloseTo(volumeColor.g, 2);
        expect(visualizerColor.b).toBeCloseTo(volumeColor.b, 2);
      }
    });

    test('should process complete workflow for all USCS fine-grained materials', async () => {
      const fineGrainedMaterials = ['ML', 'CL', 'OL', 'MH', 'CH', 'OH'];
      
      for (const material of fineGrainedMaterials) {
        // Complete workflow test for fine-grained materials
        const borehole = {
          id: `fine-borehole-${material}`,
          x: 200,
          y: 100,
          z: 0,
          diameter: 0.15,
          depth: 12,
          layers: [
            {
              id: 1,
              material: material,
              from: 0,
              to: 12,
              description: `${material} fine-grained layer`
            }
          ]
        };

        // 3D Visualization
        const boreholeGroup = boreholeVisualizer.createEnhancedBoreholeMarker(borehole);
        expect(boreholeGroup).toBeTruthy();

        // Volumetric Processing with Optimization
        const optimizedColor = OptimizedVolumetricMeshGenerator.getMaterialColor(material);
        expect(optimizedColor).toBeInstanceOf(THREE.Color);

        // Spatial Indexing
        const spatialIndex = OptimizedVolumetricMeshGenerator.buildSpatialIndex([borehole]);
        expect(spatialIndex.size).toBeGreaterThan(0);

        // Multi-level Surface Generation
        const topSurface = [
          { x: 190, y: 90, z: 12, material: material },
          { x: 210, y: 90, z: 11, material: material },
          { x: 190, y: 110, z: 12, material: material },
          { x: 210, y: 110, z: 11, material: material }
        ];

        const bottomSurface = [
          { x: 190, y: 90, z: 0 },
          { x: 210, y: 90, z: 0 },
          { x: 190, y: 110, z: 0 },
          { x: 210, y: 110, z: 0 }
        ];

        const multiLevelResult = MultiLevelSurfaceGenerator.generateInternalSurfaces(
          topSurface,
          bottomSurface,
          [{ x: 200, y: 100, z: 6, material: material, boreholeId: borehole.id }]
        );

        expect(multiLevelResult).toBeTruthy();
        expect(multiLevelResult.allSurfaces.length).toBeGreaterThan(2);
      }
    });

    test('should handle complete workflow for special USCS materials', async () => {
      const specialMaterials = ['PT', 'ROCK', 'FILL', 'TOPSOIL'];
      
      for (const material of specialMaterials) {
        const borehole = {
          id: `special-borehole-${material}`,
          x: 300,
          y: 150,
          z: 0,
          diameter: 0.25,
          depth: 8,
          layers: [
            {
              id: 1,
              material: material,
              from: 0,
              to: 8,
              description: `${material} special layer`
            }
          ]
        };

        // Complete workflow validation
        expect(() => {
          const boreholeGroup = boreholeVisualizer.createEnhancedBoreholeMarker(borehole);
          const color = VolumetricMeshGenerator.getMaterialColor(material);
          const optimizedColor = OptimizedVolumetricMeshGenerator.getMaterialColor(material);
          
          expect(boreholeGroup).toBeTruthy();
          expect(color).toBeInstanceOf(THREE.Color);
          expect(optimizedColor).toBeInstanceOf(THREE.Color);
        }).not.toThrow();
      }
    });
  });

  describe('Multi-Borehole USCS Integration Workflow', () => {
    test('should process complex site with multiple USCS materials', async () => {
      const complexSiteBoreholes = [
        {
          id: 'site-bh-1',
          x: 0,
          y: 0,
          z: 0,
          depth: 20,
          layers: [
            { id: 1, material: 'CL', from: 0, to: 5 },
            { id: 2, material: 'SW', from: 5, to: 15 },
            { id: 3, material: 'GW', from: 15, to: 20 }
          ]
        },
        {
          id: 'site-bh-2',
          x: 100,
          y: 0,
          z: 0,
          depth: 18,
          layers: [
            { id: 1, material: 'CH', from: 0, to: 6 },
            { id: 2, material: 'SM', from: 6, to: 12 },
            { id: 3, material: 'GP', from: 12, to: 18 }
          ]
        },
        {
          id: 'site-bh-3',
          x: 50,
          y: 100,
          z: 0,
          depth: 22,
          layers: [
            { id: 1, material: 'ML', from: 0, to: 8 },
            { id: 2, material: 'SC', from: 8, to: 16 },
            { id: 3, material: 'PT', from: 16, to: 22 }
          ]
        }
      ];

      const performanceStart = performance.now();

      // Step 1: Create all borehole visualizations
      const boreholeGroups = complexSiteBoreholes.map(borehole => {
        const group = boreholeVisualizer.createEnhancedBoreholeMarker(borehole);
        expect(group).toBeTruthy();
        expect(group.children.length).toBeGreaterThan(0);
        return group;
      });

      // Step 2: Build spatial index for site
      const spatialIndex = OptimizedVolumetricMeshGenerator.buildSpatialIndex(complexSiteBoreholes);
      expect(spatialIndex.size).toBeGreaterThan(0);

      // Step 3: Generate volumetric models for each layer
      const extent = { minX: -10, maxX: 110, minY: -10, maxY: 110 };
      const allLayers = complexSiteBoreholes.flatMap(bh => 
        bh.layers.map(layer => ({ ...layer, boreholeId: bh.id }))
      );

      const uniqueMaterials = [...new Set(allLayers.map(layer => layer.material))];
      
      uniqueMaterials.forEach(material => {
        const materialColor = VolumetricMeshGenerator.getMaterialColor(material);
        expect(materialColor).toBeInstanceOf(THREE.Color);
      });

      // Step 4: Verify nearby borehole queries work
      const nearbyBoreholes = OptimizedVolumetricMeshGenerator.getNearbyBoreholes(
        50, 50, 100, spatialIndex
      );
      expect(nearbyBoreholes.length).toBeGreaterThan(0);

      const performanceEnd = performance.now();
      expect(performanceEnd - performanceStart).toBeLessThan(1000); // Should complete within 1 second

      // Step 5: Verify material consistency across all components
      uniqueMaterials.forEach(material => {
        const visualizerColor = BoreholeVisualizer.getMaterialColor(material);
        const volumeColor = VolumetricMeshGenerator.getMaterialColor(material);
        const optimizedColor = OptimizedVolumetricMeshGenerator.getMaterialColor(material);
        
        expect(visualizerColor.r).toBeCloseTo(volumeColor.r, 2);
        expect(visualizerColor.g).toBeCloseTo(volumeColor.g, 2);
        expect(visualizerColor.b).toBeCloseTo(volumeColor.b, 2);
        
        expect(optimizedColor.r).toBeCloseTo(volumeColor.r, 2);
        expect(optimizedColor.g).toBeCloseTo(volumeColor.g, 2);
        expect(optimizedColor.b).toBeCloseTo(volumeColor.b, 2);
      });
    });

    test('should handle mixed USCS and legacy materials in integrated workflow', async () => {
      const mixedMaterialSite = [
        {
          id: 'mixed-bh-1',
          x: 0,
          y: 0,
          z: 0,
          depth: 15,
          layers: [
            { id: 1, material: 'CLAY', from: 0, to: 5 },    // Legacy
            { id: 2, material: 'CL', from: 5, to: 10 },     // USCS
            { id: 3, material: 'SAND', from: 10, to: 15 }   // Legacy
          ]
        },
        {
          id: 'mixed-bh-2',
          x: 80,
          y: 80,
          z: 0,
          depth: 12,
          layers: [
            { id: 1, material: 'SW', from: 0, to: 4 },      // USCS
            { id: 2, material: 'GRAVEL', from: 4, to: 8 },  // Legacy
            { id: 3, material: 'GW', from: 8, to: 12 }      // USCS
          ]
        }
      ];

      // Verify complete workflow works with mixed materials
      mixedMaterialSite.forEach(borehole => {
        const boreholeGroup = boreholeVisualizer.createEnhancedBoreholeMarker(borehole);
        expect(boreholeGroup).toBeTruthy();

        borehole.layers.forEach(layer => {
          const color = VolumetricMeshGenerator.getMaterialColor(layer.material);
          expect(color).toBeInstanceOf(THREE.Color);
        });
      });

      // Verify spatial operations work with mixed materials
      const spatialIndex = OptimizedVolumetricMeshGenerator.buildSpatialIndex(mixedMaterialSite);
      expect(spatialIndex.size).toBeGreaterThan(0);
    });
  });

  describe('Performance Integration Testing', () => {
    test('should maintain performance across full USCS workflow with large datasets', async () => {
      // Create large dataset with all USCS materials
      const largeSiteBoreholes = [];
      const allUSCSMaterials = Object.keys(USCS_CLASSIFICATIONS);
      
      for (let i = 0; i < 100; i++) {
        const material = allUSCSMaterials[i % allUSCSMaterials.length];
        largeSiteBoreholes.push({
          id: `large-bh-${i}`,
          x: (i % 10) * 50,
          y: Math.floor(i / 10) * 50,
          z: 0,
          depth: 10 + (i % 5) * 2,
          layers: [
            {
              id: 1,
              material: material,
              from: 0,
              to: 10 + (i % 5) * 2,
              description: `${material} layer`
            }
          ]
        });
      }

      const performanceStart = performance.now();

      // Step 1: Bulk borehole visualization (simulate batch processing)
      let visualizationTime = 0;
      for (let i = 0; i < Math.min(20, largeSiteBoreholes.length); i++) {
        const vizStart = performance.now();
        const group = boreholeVisualizer.createEnhancedBoreholeMarker(largeSiteBoreholes[i]);
        visualizationTime += performance.now() - vizStart;
        expect(group).toBeTruthy();
      }

      // Step 2: Spatial indexing performance
      const indexStart = performance.now();
      const spatialIndex = OptimizedVolumetricMeshGenerator.buildSpatialIndex(largeSiteBoreholes);
      const indexTime = performance.now() - indexStart;

      expect(spatialIndex.size).toBeGreaterThan(0);
      expect(indexTime).toBeLessThan(200); // Should be fast even with 100 boreholes

      // Step 3: Material color resolution performance
      const colorStart = performance.now();
      allUSCSMaterials.forEach(material => {
        VolumetricMeshGenerator.getMaterialColor(material);
        OptimizedVolumetricMeshGenerator.getMaterialColor(material);
      });
      const colorTime = performance.now() - colorStart;

      expect(colorTime).toBeLessThan(100); // Should be fast with caching

      const performanceEnd = performance.now();
      const totalTime = performanceEnd - performanceStart;

      expect(totalTime).toBeLessThan(2000); // Total workflow should complete within 2 seconds
      
      // Performance breakdown validation
      expect(visualizationTime).toBeLessThan(1000); // Visualization should be reasonable
      expect(indexTime).toBeLessThan(200); // Indexing should be fast
      expect(colorTime).toBeLessThan(100); // Color resolution should be fast
    });

    test('should maintain memory efficiency across integrated workflow', async () => {
      const memoryStart = process.memoryUsage().heapUsed;

      // Create moderate dataset
      const moderateDataset = [];
      const testMaterials = ['CL', 'SW', 'GW', 'CH', 'ML', 'SM', 'GP', 'SC'];
      
      for (let i = 0; i < 50; i++) {
        const material = testMaterials[i % testMaterials.length];
        moderateDataset.push({
          id: `memory-bh-${i}`,
          x: (i % 8) * 30,
          y: Math.floor(i / 8) * 30,
          z: 0,
          depth: 12,
          layers: [
            { id: 1, material: material, from: 0, to: 6 },
            { id: 2, material: testMaterials[(i + 1) % testMaterials.length], from: 6, to: 12 }
          ]
        });
      }

      // Run complete workflow
      moderateDataset.forEach(borehole => {
        const group = boreholeVisualizer.createEnhancedBoreholeMarker(borehole);
        expect(group).toBeTruthy();
      });

      const spatialIndex = OptimizedVolumetricMeshGenerator.buildSpatialIndex(moderateDataset);
      expect(spatialIndex.size).toBeGreaterThan(0);

      // Access materials many times (testing caching)
      for (let i = 0; i < 500; i++) {
        const material = testMaterials[i % testMaterials.length];
        OptimizedVolumetricMeshGenerator.getMaterialColor(material);
      }

      const memoryEnd = process.memoryUsage().heapUsed;
      const memoryIncrease = memoryEnd - memoryStart;

      // Memory increase should be reasonable
      expect(memoryIncrease).toBeLessThan(20 * 1024 * 1024); // Less than 20MB
    });
  });

  describe('Error Handling and Edge Cases Integration', () => {
    test('should handle complete workflow with invalid USCS materials', async () => {
      const invalidMaterialBorehole = {
        id: 'invalid-material-bh',
        x: 50,
        y: 50,
        z: 0,
        depth: 10,
        layers: [
          { id: 1, material: 'INVALID_USCS', from: 0, to: 5 },
          { id: 2, material: '', from: 5, to: 10 }
        ]
      };

      expect(() => {
        const group = boreholeVisualizer.createEnhancedBoreholeMarker(invalidMaterialBorehole);
        expect(group).toBeTruthy();

        const color1 = VolumetricMeshGenerator.getMaterialColor('INVALID_USCS');
        const color2 = OptimizedVolumetricMeshGenerator.getMaterialColor('');
        
        expect(color1).toBeInstanceOf(THREE.Color);
        expect(color2).toBeInstanceOf(THREE.Color);
      }).not.toThrow();
    });

    test('should handle workflow with malformed borehole data', async () => {
      const malformedBoreholes = [
        null,
        undefined,
        { id: 'incomplete' },
        { id: 'no-layers', x: 0, y: 0, z: 0, depth: 10 },
        { id: 'empty-layers', x: 10, y: 10, z: 0, depth: 8, layers: [] }
      ];

      expect(() => {
        malformedBoreholes.forEach(borehole => {
          if (borehole && borehole.id && borehole.layers) {
            const group = boreholeVisualizer.createEnhancedBoreholeMarker(borehole);
            expect(group).toBeTruthy();
          }
        });

        const validBoreholes = malformedBoreholes.filter(bh => 
          bh && bh.x !== undefined && bh.y !== undefined
        );
        
        if (validBoreholes.length > 0) {
          const spatialIndex = OptimizedVolumetricMeshGenerator.buildSpatialIndex(validBoreholes);
          expect(spatialIndex).toBeInstanceOf(Map);
        }
      }).not.toThrow();
    });

    test('should maintain system stability under stress conditions', async () => {
      const stressConditions = {
        extremeDepths: [0.1, 500], // Very shallow and very deep
        extremeCoordinates: [-1000, 1000], // Far coordinates
        edgeCaseMaterials: [null, undefined, '', 'INVALID', 'XYZ123']
      };

      expect(() => {
        stressConditions.extremeDepths.forEach((depth, i) => {
          const borehole = {
            id: `stress-depth-${i}`,
            x: 0,
            y: 0,
            z: 0,
            depth: depth,
            layers: [
              { id: 1, material: 'CL', from: 0, to: depth }
            ]
          };

          const group = boreholeVisualizer.createEnhancedBoreholeMarker(borehole);
          expect(group).toBeTruthy();
        });

        stressConditions.extremeCoordinates.forEach((coord, i) => {
          const borehole = {
            id: `stress-coord-${i}`,
            x: coord,
            y: coord,
            z: 0,
            depth: 10,
            layers: [
              { id: 1, material: 'SW', from: 0, to: 10 }
            ]
          };

          const spatialIndex = OptimizedVolumetricMeshGenerator.buildSpatialIndex([borehole]);
          expect(spatialIndex).toBeInstanceOf(Map);
        });

        stressConditions.edgeCaseMaterials.forEach(material => {
          const color = VolumetricMeshGenerator.getMaterialColor(material);
          expect(color).toBeInstanceOf(THREE.Color);
        });
      }).not.toThrow();
    });
  });

  describe('Data Integrity and Consistency Validation', () => {
    test('should maintain data consistency across all integrated components', async () => {
      const testBorehole = {
        id: 'consistency-test-bh',
        x: 100,
        y: 100,
        z: 0,
        depth: 15,
        layers: [
          { id: 1, material: 'CL', from: 0, to: 5 },
          { id: 2, material: 'SW', from: 5, to: 10 },
          { id: 3, material: 'GW', from: 10, to: 15 }
        ]
      };

      // Create visualization
      const boreholeGroup = boreholeVisualizer.createEnhancedBoreholeMarker(testBorehole);
      
      // Verify borehole data integrity
      expect(boreholeGroup.userData.id).toBe(testBorehole.id);
      expect(boreholeGroup.userData.type).toBe('borehole');

      // Verify material colors are consistent across services
      testBorehole.layers.forEach(layer => {
        const visualizerColor = BoreholeVisualizer.getMaterialColor(layer.material);
        const volumeColor = VolumetricMeshGenerator.getMaterialColor(layer.material);
        const optimizedColor = OptimizedVolumetricMeshGenerator.getMaterialColor(layer.material);
        
        // All colors should match USCS standards
        const expectedProps = getMaterialProperties(layer.material);
        const expectedColor = new THREE.Color(expectedProps.color);
        
        expect(visualizerColor.r).toBeCloseTo(expectedColor.r, 2);
        expect(volumeColor.r).toBeCloseTo(expectedColor.r, 2);
        expect(optimizedColor.r).toBeCloseTo(expectedColor.r, 2);
      });

      // Verify spatial indexing preserves borehole data
      const spatialIndex = OptimizedVolumetricMeshGenerator.buildSpatialIndex([testBorehole]);
      const nearbyBoreholes = OptimizedVolumetricMeshGenerator.getNearbyBoreholes(
        100, 100, 50, spatialIndex
      );

      expect(nearbyBoreholes.length).toBe(1);
      expect(nearbyBoreholes[0].id).toBe(testBorehole.id);
      expect(nearbyBoreholes[0].layers.length).toBe(testBorehole.layers.length);
    });

    test('should preserve USCS material properties throughout processing pipeline', async () => {
      const allUSCSMaterials = Object.keys(USCS_CLASSIFICATIONS);
      
      allUSCSMaterials.forEach(material => {
        // Get original properties
        const originalProps = getMaterialProperties(material);
        
        // Process through all services
        const visualizerColor = BoreholeVisualizer.getMaterialColor(material);
        const volumeColor = VolumetricMeshGenerator.getMaterialColor(material);
        const optimizedColor = OptimizedVolumetricMeshGenerator.getMaterialColor(material);
        
        // Verify all match original USCS standard
        const expectedColor = new THREE.Color(originalProps.color);
        
        expect(visualizerColor.r).toBeCloseTo(expectedColor.r, 2);
        expect(visualizerColor.g).toBeCloseTo(expectedColor.g, 2);
        expect(visualizerColor.b).toBeCloseTo(expectedColor.b, 2);
        
        expect(volumeColor.r).toBeCloseTo(expectedColor.r, 2);
        expect(volumeColor.g).toBeCloseTo(expectedColor.g, 2);
        expect(volumeColor.b).toBeCloseTo(expectedColor.b, 2);
        
        expect(optimizedColor.r).toBeCloseTo(expectedColor.r, 2);
        expect(optimizedColor.g).toBeCloseTo(expectedColor.g, 2);
        expect(optimizedColor.b).toBeCloseTo(expectedColor.b, 2);
      });
    });
  });
});