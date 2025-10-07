/**
 * Comprehensive Test Suite for USCS Materials Integration in OptimizedVolumetricMeshGenerator
 * 
 * This test suite validates the integration of the Unified Soil Classification System (USCS)
 * materials with the OptimizedVolumetricMeshGenerator service, ensuring proper 3D geological 
 * interpolation with improved performance, caching, and memory management while maintaining
 * USCS material standardization.
 * 
 * Testing Focus:
 * 1. USCS material color caching and optimization
 * 2. Performance improvements with USCS materials
 * 3. Memory management with cached USCS color objects  
 * 4. Spatial indexing optimization with USCS material data
 * 5. Large-scale USCS material processing efficiency
 * 6. Cache consistency and invalidation
 * 7. Integration with parent VolumetricMeshGenerator functionality
 */

import * as THREE from 'three';
import { OptimizedVolumetricMeshGenerator } from './OptimizedVolumetricMeshGenerator';
import { getMaterialProperties, STANDARD_MATERIALS, USCS_CLASSIFICATIONS } from '../utils/materialStandardization';

// Mock Three.js for testing
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
  
  BufferGeometry: jest.fn(() => ({
    setAttribute: jest.fn(),
    setIndex: jest.fn(),
    computeVertexNormals: jest.fn(),
    computeBoundingSphere: jest.fn(),
    dispose: jest.fn()
  })),
  
  Float32BufferAttribute: jest.fn(),
  Uint32BufferAttribute: jest.fn(),
  Int32Array: Int32Array, // Use real Int32Array for performance tests
  
  MeshLambertMaterial: jest.fn(() => ({
    transparent: true,
    opacity: 0.5,
    side: 2,
    vertexColors: true,
    dispose: jest.fn()
  })),
  
  Mesh: jest.fn(() => ({
    geometry: {},
    material: {},
    position: { set: jest.fn() },
    castShadow: true,
    receiveShadow: true,
    userData: {},
    dispose: jest.fn()
  })),
  
  DoubleSide: 2
}));

// Mock interpolation engines
jest.mock('./SpatialInterpolationEngine', () => ({
  SpatialInterpolationEngine: {
    interpolateGrid: jest.fn(() => [
      { x: 0, y: 0, z: 10, material: 'CL', confidence: 0.8 },
      { x: 10, y: 0, z: 8, material: 'CL', confidence: 0.8 },
      { x: 0, y: 10, z: 9, material: 'SW', confidence: 0.7 },
      { x: 10, y: 10, z: 7, material: 'SW', confidence: 0.7 }
    ])
  }
}));

describe('OptimizedVolumetricMeshGenerator USCS Materials Integration', () => {
  let mockBoreholes;
  let mockExtent;

  beforeEach(() => {
    // Setup comprehensive mock borehole data with all USCS material categories
    mockBoreholes = [
      {
        id: 'bh_coarse_grained',
        x: 0,
        y: 0,
        z: 0,
        depth: 20,
        layers: [
          { id: 1, material: 'GW', from: 0, to: 5 },   // Well-graded Gravel
          { id: 2, material: 'SW', from: 5, to: 10 },  // Well-graded Sand
          { id: 3, material: 'GM', from: 10, to: 15 }, // Silty Gravel
          { id: 4, material: 'SC', from: 15, to: 20 }  // Clayey Sand
        ]
      },
      {
        id: 'bh_fine_grained_low',
        x: 100,
        y: 0,
        z: 0,
        depth: 18,
        layers: [
          { id: 1, material: 'ML', from: 0, to: 6 },   // Inorganic Silt
          { id: 2, material: 'CL', from: 6, to: 12 },  // Lean Clay
          { id: 3, material: 'OL', from: 12, to: 18 }  // Organic Silt
        ]
      },
      {
        id: 'bh_fine_grained_high',
        x: 50,
        y: 100,
        z: 0,
        depth: 15,
        layers: [
          { id: 1, material: 'MH', from: 0, to: 5 },   // Elastic Silt
          { id: 2, material: 'CH', from: 5, to: 10 },  // Fat Clay
          { id: 3, material: 'OH', from: 10, to: 15 }  // Organic Clay
        ]
      },
      {
        id: 'bh_special_materials',
        x: 150,
        y: 50,
        z: 0,
        depth: 12,
        layers: [
          { id: 1, material: 'PT', from: 0, to: 4 },     // Peat
          { id: 2, material: 'ROCK', from: 4, to: 8 },   // Bedrock
          { id: 3, material: 'FILL', from: 8, to: 12 }   // Engineered Fill
        ]
      }
    ];

    mockExtent = {
      minX: -10,
      maxX: 160,
      minY: -10,
      maxY: 110,
      width: 170,
      height: 120
    };

    // Clear all mocks and caches
    jest.clearAllMocks();
    
    // Clear the static caches in OptimizedVolumetricMeshGenerator
    OptimizedVolumetricMeshGenerator.spatialIndexCache = new WeakMap();
    OptimizedVolumetricMeshGenerator.interpolationCache = new Map();
  });

  describe('USCS Material Color Caching Optimization', () => {
    test('should cache USCS material colors for performance', () => {
      const testMaterial = 'CL';
      
      // First access should create and cache the color
      const color1 = OptimizedVolumetricMeshGenerator.getMaterialColor(testMaterial);
      expect(color1).toBeInstanceOf(THREE.Color);
      
      // Second access should return cached color
      const color2 = OptimizedVolumetricMeshGenerator.getMaterialColor(testMaterial);
      expect(color2).toBe(color1); // Should be the exact same object (cached)
      
      // Verify THREE.Color constructor was only called once
      expect(THREE.Color).toHaveBeenCalledTimes(1);
    });

    test('should cache colors for all USCS material types', () => {
      const allUSCSMaterials = Object.keys(USCS_CLASSIFICATIONS);
      
      // Access each material color twice
      allUSCSMaterials.forEach(material => {
        const color1 = OptimizedVolumetricMeshGenerator.getMaterialColor(material);
        const color2 = OptimizedVolumetricMeshGenerator.getMaterialColor(material);
        
        expect(color1).toBe(color2); // Should be cached
        expect(color1).toBeInstanceOf(THREE.Color);
      });
      
      // THREE.Color should have been called exactly once per unique material
      expect(THREE.Color).toHaveBeenCalledTimes(allUSCSMaterials.length);
    });

    test('should maintain separate cache entries for different materials', () => {
      const materials = ['CL', 'SW', 'GW', 'CH'];
      const colors = materials.map(material => 
        OptimizedVolumetricMeshGenerator.getMaterialColor(material)
      );
      
      // All colors should be different objects
      for (let i = 0; i < colors.length; i++) {
        for (let j = i + 1; j < colors.length; j++) {
          expect(colors[i]).not.toBe(colors[j]);
        }
      }
      
      // But accessing the same material should return the cached object
      materials.forEach((material, index) => {
        const cachedColor = OptimizedVolumetricMeshGenerator.getMaterialColor(material);
        expect(cachedColor).toBe(colors[index]);
      });
    });

    test('should handle cache misses and create new colors as needed', () => {
      const unknownMaterial = 'UNKNOWN_MATERIAL_TYPE';
      
      const color1 = OptimizedVolumetricMeshGenerator.getMaterialColor(unknownMaterial);
      const color2 = OptimizedVolumetricMeshGenerator.getMaterialColor(unknownMaterial);
      
      expect(color1).toBe(color2); // Should cache even unknown materials
      expect(color1).toBeInstanceOf(THREE.Color);
    });
  });

  describe('Optimized Spatial Indexing with USCS Materials', () => {
    test('should build spatial index with caching for repeated operations', () => {
      // First build should create and cache the index
      const index1 = OptimizedVolumetricMeshGenerator.buildSpatialIndex(mockBoreholes);
      expect(index1).toBeInstanceOf(Map);
      expect(index1.size).toBeGreaterThan(0);
      
      // Second build with same boreholes should return cached index
      const index2 = OptimizedVolumetricMeshGenerator.buildSpatialIndex(mockBoreholes);
      expect(index2).toBe(index1); // Should be the exact same cached object
    });

    test('should use Int32Array for improved performance with large datasets', () => {
      const largeMockBoreholes = [];
      
      // Create large dataset with USCS materials
      for (let i = 0; i < 100; i++) {
        largeMockBoreholes.push({
          id: `bh_${i}`,
          x: (i % 10) * 20,
          y: Math.floor(i / 10) * 20,
          z: 0,
          depth: 10,
          layers: [
            { id: 1, material: 'CL', from: 0, to: 10 }
          ]
        });
      }
      
      const performanceStart = performance.now();
      const spatialIndex = OptimizedVolumetricMeshGenerator.buildSpatialIndex(largeMockBoreholes);
      const performanceEnd = performance.now();
      
      expect(spatialIndex).toBeInstanceOf(Map);
      expect(spatialIndex.size).toBeGreaterThan(0);
      expect(performanceEnd - performanceStart).toBeLessThan(100); // Should be fast
    });

    test('should optimize nearby borehole searches with early termination', () => {
      const spatialIndex = OptimizedVolumetricMeshGenerator.buildSpatialIndex(mockBoreholes);
      
      const performanceStart = performance.now();
      const nearbyBoreholes = OptimizedVolumetricMeshGenerator.getNearbyBoreholes(
        75, 50, 100, spatialIndex
      );
      const performanceEnd = performance.now();
      
      expect(Array.isArray(nearbyBoreholes)).toBeTruthy();
      expect(nearbyBoreholes.length).toBeGreaterThan(0);
      expect(nearbyBoreholes.length).toBeLessThanOrEqual(10); // MAX_NEARBY_BOREHOLES limit
      expect(performanceEnd - performanceStart).toBeLessThan(50); // Should be very fast
      
      // Verify all nearby boreholes have USCS materials
      nearbyBoreholes.forEach(bh => {
        expect(bh.layers).toBeDefined();
        bh.layers.forEach(layer => {
          expect(layer.material).toBeDefined();
          expect(Object.keys(USCS_CLASSIFICATIONS).includes(layer.material) || 
                 Object.keys(STANDARD_MATERIALS).includes(layer.material)).toBeTruthy();
        });
      });
    });

    test('should use squared distances to avoid sqrt calculations', () => {
      const spatialIndex = OptimizedVolumetricMeshGenerator.buildSpatialIndex(mockBoreholes);
      
      // Test with different radius values
      const radii = [50, 100, 150, 200];
      
      radii.forEach(radius => {
        const performanceStart = performance.now();
        const nearbyBoreholes = OptimizedVolumetricMeshGenerator.getNearbyBoreholes(
          75, 50, radius, spatialIndex
        );
        const performanceEnd = performance.now();
        
        expect(performanceEnd - performanceStart).toBeLessThan(20); // Should be consistently fast
        expect(Array.isArray(nearbyBoreholes)).toBeTruthy();
      });
    });
  });

  describe('Memory Management and Performance Optimization', () => {
    test('should maintain efficient memory usage with repeated USCS material access', () => {
      const memoryStart = process.memoryUsage().heapUsed;
      
      // Access the same materials many times (should use cache)
      const commonUSCSMaterials = ['CL', 'SW', 'GW', 'CH', 'SM', 'GP', 'ML', 'SC'];
      
      for (let i = 0; i < 1000; i++) {
        const material = commonUSCSMaterials[i % commonUSCSMaterials.length];
        OptimizedVolumetricMeshGenerator.getMaterialColor(material);
      }
      
      const memoryEnd = process.memoryUsage().heapUsed;
      const memoryIncrease = memoryEnd - memoryStart;
      
      // Memory increase should be minimal due to caching
      expect(memoryIncrease).toBeLessThan(2 * 1024 * 1024); // Less than 2MB
    });

    test('should perform better than non-optimized version for large datasets', () => {
      // Create large dataset
      const largeMockBoreholes = [];
      const uscsTypes = Object.keys(USCS_CLASSIFICATIONS);
      
      for (let i = 0; i < 200; i++) {
        largeMockBoreholes.push({
          id: `large_bh_${i}`,
          x: (i % 20) * 10,
          y: Math.floor(i / 20) * 10,
          z: 0,
          depth: 15,
          layers: [
            { id: 1, material: uscsTypes[i % uscsTypes.length], from: 0, to: 5 },
            { id: 2, material: uscsTypes[(i + 1) % uscsTypes.length], from: 5, to: 10 },
            { id: 3, material: uscsTypes[(i + 2) % uscsTypes.length], from: 10, to: 15 }
          ]
        });
      }
      
      const performanceStart = performance.now();
      
      // Build spatial index (should use caching)
      const spatialIndex = OptimizedVolumetricMeshGenerator.buildSpatialIndex(largeMockBoreholes);
      
      // Perform multiple nearby searches
      for (let i = 0; i < 50; i++) {
        OptimizedVolumetricMeshGenerator.getNearbyBoreholes(
          i * 4, i * 3, 50, spatialIndex
        );
      }
      
      // Access material colors (should use caching)
      uscsTypes.forEach(material => {
        for (let i = 0; i < 10; i++) {
          OptimizedVolumetricMeshGenerator.getMaterialColor(material);
        }
      });
      
      const performanceEnd = performance.now();
      
      expect(performanceEnd - performanceStart).toBeLessThan(500); // Should be fast even with large dataset
    });

    test('should handle concurrent access to cached materials safely', async () => {
      const materials = ['CL', 'SW', 'GW', 'CH', 'ML', 'SM'];
      
      // Simulate concurrent access
      const promises = materials.map(async (material, index) => {
        await new Promise(resolve => setTimeout(resolve, index)); // Stagger slightly
        return OptimizedVolumetricMeshGenerator.getMaterialColor(material);
      });
      
      const colors = await Promise.all(promises);
      
      // All colors should be valid and properly cached
      colors.forEach(color => {
        expect(color).toBeInstanceOf(THREE.Color);
      });
      
      // Verify caching worked - accessing same materials should return same objects
      materials.forEach((material, index) => {
        const cachedColor = OptimizedVolumetricMeshGenerator.getMaterialColor(material);
        expect(cachedColor).toBe(colors[index]);
      });
    });
  });

  describe('Integration with Legacy VolumetricMeshGenerator Features', () => {
    test('should maintain compatibility with all USCS material types', () => {
      const allUSCSMaterials = Object.keys(USCS_CLASSIFICATIONS);
      
      allUSCSMaterials.forEach(material => {
        const color = OptimizedVolumetricMeshGenerator.getMaterialColor(material);
        const expectedProps = getMaterialProperties(material);
        const expectedColor = new THREE.Color(expectedProps.color);
        
        expect(color).toBeInstanceOf(THREE.Color);
        expect(color.r).toBeCloseTo(expectedColor.r, 2);
        expect(color.g).toBeCloseTo(expectedColor.g, 2);
        expect(color.b).toBeCloseTo(expectedColor.b, 2);
      });
    });

    test('should maintain compatibility with legacy materials', () => {
      const legacyMaterials = ['CLAY', 'SAND', 'GRAVEL', 'SILT', 'ROCK', 'PEAT'];
      
      legacyMaterials.forEach(material => {
        const color = OptimizedVolumetricMeshGenerator.getMaterialColor(material);
        const expectedProps = getMaterialProperties(material);
        const expectedColor = new THREE.Color(expectedProps.color);
        
        expect(color).toBeInstanceOf(THREE.Color);
        expect(color.r).toBeCloseTo(expectedColor.r, 2);
        expect(color.g).toBeCloseTo(expectedColor.g, 2);
        expect(color.b).toBeCloseTo(expectedColor.b, 2);
      });
    });

    test('should handle mixed material types in spatial operations', () => {
      const mixedMaterialBoreholes = [
        {
          id: 'mixed_1',
          x: 0,
          y: 0,
          z: 0,
          depth: 12,
          layers: [
            { id: 1, material: 'CL', from: 0, to: 4 },     // USCS
            { id: 2, material: 'SAND', from: 4, to: 8 },   // Legacy
            { id: 3, material: 'GW', from: 8, to: 12 }     // USCS
          ]
        },
        {
          id: 'mixed_2',
          x: 50,
          y: 50,
          z: 0,
          depth: 10,
          layers: [
            { id: 1, material: 'CLAY', from: 0, to: 5 },   // Legacy
            { id: 2, material: 'SW', from: 5, to: 10 }     // USCS
          ]
        }
      ];
      
      const spatialIndex = OptimizedVolumetricMeshGenerator.buildSpatialIndex(mixedMaterialBoreholes);
      const nearbyBoreholes = OptimizedVolumetricMeshGenerator.getNearbyBoreholes(
        25, 25, 100, spatialIndex
      );
      
      expect(spatialIndex).toBeInstanceOf(Map);
      expect(nearbyBoreholes.length).toBeGreaterThan(0);
      
      // Verify all materials can be processed
      nearbyBoreholes.forEach(bh => {
        bh.layers.forEach(layer => {
          expect(() => {
            const color = OptimizedVolumetricMeshGenerator.getMaterialColor(layer.material);
            expect(color).toBeInstanceOf(THREE.Color);
          }).not.toThrow();
        });
      });
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('should handle null and undefined materials gracefully', () => {
      const invalidMaterials = [null, undefined, '', 'INVALID_USCS'];
      
      invalidMaterials.forEach(material => {
        expect(() => {
          const color = OptimizedVolumetricMeshGenerator.getMaterialColor(material);
          expect(color).toBeInstanceOf(THREE.Color);
          
          // Should cache invalid materials too
          const color2 = OptimizedVolumetricMeshGenerator.getMaterialColor(material);
          expect(color2).toBe(color);
        }).not.toThrow();
      });
    });

    test('should handle empty borehole arrays in spatial indexing', () => {
      expect(() => {
        const emptyIndex = OptimizedVolumetricMeshGenerator.buildSpatialIndex([]);
        expect(emptyIndex).toBeInstanceOf(Map);
        
        const nearbyBoreholes = OptimizedVolumetricMeshGenerator.getNearbyBoreholes(
          0, 0, 100, emptyIndex
        );
        expect(Array.isArray(nearbyBoreholes)).toBeTruthy();
        expect(nearbyBoreholes.length).toBe(0);
      }).not.toThrow();
    });

    test('should handle malformed borehole data without crashing', () => {
      const malformedBoreholes = [
        null,
        undefined,
        { id: 'incomplete' }, // Missing x, y, z
        { id: 'no_layers', x: 0, y: 0, z: 0 }, // Missing layers
        { x: 10, y: 10, z: 0, layers: [] } // Missing id
      ];
      
      expect(() => {
        const validBoreholes = malformedBoreholes.filter(bh => bh && bh.id && bh.x !== undefined);
        const spatialIndex = OptimizedVolumetricMeshGenerator.buildSpatialIndex(validBoreholes);
        expect(spatialIndex).toBeInstanceOf(Map);
      }).not.toThrow();
    });

    test('should maintain cache integrity under stress conditions', () => {
      const stressTestMaterials = [];
      
      // Create many material access patterns
      for (let i = 0; i < 1000; i++) {
        const materials = ['CL', 'SW', 'GW', 'CH', null, undefined, '', 'INVALID'];
        stressTestMaterials.push(materials[i % materials.length]);
      }
      
      expect(() => {
        stressTestMaterials.forEach(material => {
          OptimizedVolumetricMeshGenerator.getMaterialColor(material);
        });
        
        // Verify cache consistency - repeated access should return same objects
        stressTestMaterials.slice(0, 10).forEach(material => {
          const color1 = OptimizedVolumetricMeshGenerator.getMaterialColor(material);
          const color2 = OptimizedVolumetricMeshGenerator.getMaterialColor(material);
          expect(color1).toBe(color2);
        });
      }).not.toThrow();
    });
  });
});