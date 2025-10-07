/**
 * Comprehensive Test Suite for USCS Materials Integration in VolumetricMeshGenerator
 * 
 * This test suite validates the integration of the Unified Soil Classification System (USCS)
 * materials with the VolumetricMeshGenerator service, ensuring proper 3D geological interpolation
 * and visualization with standardized material properties.
 * 
 * Testing Focus:
 * 1. USCS material integration in 3D volumetric mesh generation
 * 2. Material color consistency in interpolation models
 * 3. Performance with multiple USCS materials
 * 4. Integration with SpatialInterpolationEngine using USCS materials
 * 5. Volumetric mesh creation with USCS material properties
 * 6. Backward compatibility with legacy materials
 * 7. Error handling with invalid USCS material combinations
 */

import * as THREE from 'three';
import { VolumetricMeshGenerator } from './VolumetricMeshGenerator';
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

jest.mock('./GeologicalSequenceEngine', () => ({
  GeologicalSequenceEngine: {
    analyzeSequence: jest.fn(() => ({
      isValidSequence: true,
      layerTransitions: [],
      confidence: 0.9
    }))
  }
}));

jest.mock('./AdvancedInterpolationEngine', () => ({
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
    }))
  }
}));

describe('VolumetricMeshGenerator USCS Materials Integration', () => {
  let mockBoreholes;
  let mockExtent;
  let mockOptions;

  beforeEach(() => {
    // Setup mock borehole data with USCS materials
    mockBoreholes = [
      {
        id: 'bh1',
        x: 0,
        y: 0,
        z: 0,
        depth: 15,
        layers: [
          { id: 1, material: 'CL', from: 0, to: 5, description: 'Lean Clay' },
          { id: 2, material: 'SW', from: 5, to: 10, description: 'Well-graded Sand' },
          { id: 3, material: 'GW', from: 10, to: 15, description: 'Well-graded Gravel' }
        ]
      },
      {
        id: 'bh2',
        x: 100,
        y: 0,
        z: 0,
        depth: 12,
        layers: [
          { id: 1, material: 'CH', from: 0, to: 4, description: 'Fat Clay' },
          { id: 2, material: 'SM', from: 4, to: 8, description: 'Silty Sand' },
          { id: 3, material: 'GP', from: 8, to: 12, description: 'Poorly-graded Gravel' }
        ]
      },
      {
        id: 'bh3',
        x: 50,
        y: 100,
        z: 0,
        depth: 18,
        layers: [
          { id: 1, material: 'ML', from: 0, to: 6, description: 'Inorganic Silt' },
          { id: 2, material: 'SC', from: 6, to: 12, description: 'Clayey Sand' },
          { id: 3, material: 'PT', from: 12, to: 18, description: 'Peat' }
        ]
      }
    ];

    mockExtent = {
      minX: -10,
      maxX: 110,
      minY: -10,
      maxY: 110,
      width: 120,
      height: 120
    };

    mockOptions = {
      gridResolution: 10,
      interpolationMethod: 'idw',
      opacity: 0.7,
      enableContours: true
    };

    // Clear all mocks
    jest.clearAllMocks();
  });

  describe('USCS Material Color Resolution in Volumetric Meshes', () => {
    test('should correctly resolve USCS material colors for mesh creation', () => {
      const allUSCSMaterials = Object.keys(USCS_CLASSIFICATIONS);
      
      allUSCSMaterials.forEach(material => {
        const color = VolumetricMeshGenerator.getMaterialColor(material);
        
        expect(color).toBeInstanceOf(THREE.Color);
        
        // Verify color matches USCS standards
        const expectedProps = getMaterialProperties(material);
        const expectedColor = new THREE.Color(expectedProps.color);
        
        expect(color.r).toBeCloseTo(expectedColor.r, 2);
        expect(color.g).toBeCloseTo(expectedColor.g, 2);
        expect(color.b).toBeCloseTo(expectedColor.b, 2);
      });
    });

    test('should handle material color resolution errors gracefully', () => {
      const invalidMaterials = ['INVALID_USCS', null, undefined, ''];
      
      invalidMaterials.forEach(material => {
        const color = VolumetricMeshGenerator.getMaterialColor(material);
        
        expect(color).toBeInstanceOf(THREE.Color);
        // Should return fallback gray color (#808080)
        expect(color.r).toBeCloseTo(0.5, 1);
        expect(color.g).toBeCloseTo(0.5, 1);
        expect(color.b).toBeCloseTo(0.5, 1);
      });
    });

    test('should maintain color consistency across different geological contexts', () => {
      const testMaterial = 'CL'; // Lean Clay
      const color1 = VolumetricMeshGenerator.getMaterialColor(testMaterial);
      const color2 = VolumetricMeshGenerator.getMaterialColor(testMaterial);
      
      // Colors should be identical for same material
      expect(color1.r).toEqual(color2.r);
      expect(color1.g).toEqual(color2.g);
      expect(color1.b).toEqual(color2.b);
    });
  });

  describe('USCS Material Integration in Layer Volume Creation', () => {
    test('should create layer volumes with proper USCS material colors', () => {
      const topSurface = [
        { x: 0, y: 0, z: 10 },
        { x: 10, y: 0, z: 10 },
        { x: 0, y: 10, z: 10 },
        { x: 10, y: 10, z: 10 }
      ];

      const bottomSurface = [
        { x: 0, y: 0, z: 5 },
        { x: 10, y: 0, z: 5 },
        { x: 0, y: 10, z: 5 },
        { x: 10, y: 10, z: 5 }
      ];

      const uscsCoarseGrained = ['GW', 'GP', 'GM', 'GC', 'SW', 'SP', 'SM', 'SC'];
      
      uscsCoarseGrained.forEach(material => {
        const layerVolume = VolumetricMeshGenerator.createLayerVolume(
          topSurface,
          bottomSurface,
          material,
          mockExtent,
          4, // 2x2 grid
          mockOptions
        );

        expect(layerVolume).toBeTruthy();
        expect(layerVolume.vertices).toBeDefined();
        expect(layerVolume.indices).toBeDefined();
        expect(layerVolume.colors).toBeDefined();
        expect(layerVolume.normals).toBeDefined();
        expect(layerVolume.uvs).toBeDefined();

        // Verify that colors are set based on USCS material properties
        expect(layerVolume.colors.length).toBeGreaterThan(0);
        
        // Colors should be arrays of RGB values (0-1 range)
        for (let i = 0; i < layerVolume.colors.length; i += 3) {
          expect(layerVolume.colors[i]).toBeGreaterThanOrEqual(0);
          expect(layerVolume.colors[i]).toBeLessThanOrEqual(1);
          expect(layerVolume.colors[i + 1]).toBeGreaterThanOrEqual(0);
          expect(layerVolume.colors[i + 1]).toBeLessThanOrEqual(1);
          expect(layerVolume.colors[i + 2]).toBeGreaterThanOrEqual(0);
          expect(layerVolume.colors[i + 2]).toBeLessThanOrEqual(1);
        }
      });
    });

    test('should create layer volumes with fine-grained USCS materials', () => {
      const topSurface = [
        { x: 0, y: 0, z: 8 },
        { x: 20, y: 0, z: 7 },
        { x: 0, y: 20, z: 9 },
        { x: 20, y: 20, z: 6 }
      ];

      const bottomSurface = [
        { x: 0, y: 0, z: 3 },
        { x: 20, y: 0, z: 2 },
        { x: 0, y: 20, z: 4 },
        { x: 20, y: 20, z: 1 }
      ];

      const uscsFineGrained = ['ML', 'CL', 'OL', 'MH', 'CH', 'OH'];
      
      uscsFineGrained.forEach(material => {
        const layerVolume = VolumetricMeshGenerator.createLayerVolume(
          topSurface,
          bottomSurface,
          material,
          mockExtent,
          4, // 2x2 grid
          mockOptions
        );

        expect(layerVolume).toBeTruthy();
        
        // Verify material-specific color application
        const expectedProps = getMaterialProperties(material);
        const expectedColor = new THREE.Color(expectedProps.color);
        
        // Check that some colors in the array approximate the expected material color
        let colorMatches = 0;
        for (let i = 0; i < layerVolume.colors.length; i += 3) {
          const colorDiff = Math.abs(layerVolume.colors[i] - expectedColor.r) +
                           Math.abs(layerVolume.colors[i + 1] - expectedColor.g) +
                           Math.abs(layerVolume.colors[i + 2] - expectedColor.b);
          if (colorDiff < 1.0) { // Allow for brightness variations
            colorMatches++;
          }
        }
        
        expect(colorMatches).toBeGreaterThan(0);
      });
    });

    test('should handle opacity-based contour visualization with USCS materials', () => {
      const topSurface = [
        { x: 0, y: 0, z: 12 },
        { x: 15, y: 0, z: 11 },
        { x: 0, y: 15, z: 13 },
        { x: 15, y: 15, z: 10 }
      ];

      const bottomSurface = [
        { x: 0, y: 0, z: 7 },
        { x: 15, y: 0, z: 6 },
        { x: 0, y: 15, z: 8 },
        { x: 15, y: 15, z: 5 }
      ];

      const opacityLevels = [0.1, 0.3, 0.5, 0.7, 0.9];
      
      opacityLevels.forEach(opacity => {
        const optionsWithOpacity = { ...mockOptions, opacity };
        
        const layerVolume = VolumetricMeshGenerator.createLayerVolume(
          topSurface,
          bottomSurface,
          'CL', // Lean Clay
          mockExtent,
          4,
          optionsWithOpacity
        );

        expect(layerVolume).toBeTruthy();
        expect(layerVolume.colors.length).toBeGreaterThan(0);
        
        // At lower opacity, should have more color variation (contours)
        // At higher opacity, should have less color variation (solid)
        const colorVariation = this.calculateColorVariation(layerVolume.colors);
        
        if (opacity < 0.3) {
          // High transparency = high variation (contours visible)
          expect(colorVariation).toBeGreaterThan(0.1);
        } else if (opacity > 0.8) {
          // Low transparency = low variation (solid appearance)
          expect(colorVariation).toBeLessThan(0.5);
        }
      });
    });
  });

  describe('USCS Material Integration with Spatial Index', () => {
    test('should build spatial index efficiently with USCS material data', () => {
      const performanceStart = performance.now();
      
      const spatialIndex = VolumetricMeshGenerator.buildSpatialIndex(mockBoreholes);
      
      const performanceEnd = performance.now();

      expect(spatialIndex).toBeTruthy();
      expect(spatialIndex instanceof Map).toBeTruthy();
      expect(spatialIndex.size).toBeGreaterThan(0);
      expect(performanceEnd - performanceStart).toBeLessThan(50); // Should be very fast
    });

    test('should retrieve nearby boreholes with USCS materials correctly', () => {
      const spatialIndex = VolumetricMeshGenerator.buildSpatialIndex(mockBoreholes);
      const nearbyBoreholes = VolumetricMeshGenerator.getNearbyBoreholes(25, 25, 100, spatialIndex);
      
      expect(Array.isArray(nearbyBoreholes)).toBeTruthy();
      expect(nearbyBoreholes.length).toBeGreaterThan(0);
      expect(nearbyBoreholes.length).toBeLessThanOrEqual(10); // MAX_NEARBY_BOREHOLES limit
      
      // Verify boreholes have USCS materials
      nearbyBoreholes.forEach(bh => {
        expect(bh.layers).toBeDefined();
        bh.layers.forEach(layer => {
          expect(layer.material).toBeDefined();
          expect(typeof layer.material).toBe('string');
        });
      });
    });
  });

  describe('USCS Material Performance and Memory Management', () => {
    test('should handle large-scale USCS material processing efficiently', () => {
      // Create a large dataset with mixed USCS materials
      const largeMockBoreholes = [];
      const uscsTypes = Object.keys(USCS_CLASSIFICATIONS);
      
      for (let i = 0; i < 50; i++) {
        const borehole = {
          id: `bh_${i}`,
          x: (i % 10) * 20,
          y: Math.floor(i / 10) * 20,
          z: 0,
          depth: 10 + (i % 3) * 5,
          layers: []
        };
        
        // Add 3-5 layers per borehole with random USCS materials
        const layerCount = 3 + (i % 3);
        for (let j = 0; j < layerCount; j++) {
          const depthIncrement = borehole.depth / layerCount;
          borehole.layers.push({
            id: j + 1,
            material: uscsTypes[j % uscsTypes.length],
            from: j * depthIncrement,
            to: (j + 1) * depthIncrement,
            description: `Layer ${j + 1}`
          });
        }
        largeMockBoreholes.push(borehole);
      }

      const performanceStart = performance.now();
      
      // Test spatial index with large dataset
      const spatialIndex = VolumetricMeshGenerator.buildSpatialIndex(largeMockBoreholes);
      const nearbyBoreholes = VolumetricMeshGenerator.getNearbyBoreholes(100, 100, 150, spatialIndex);
      
      // Test material color resolution
      uscsTypes.forEach(material => {
        VolumetricMeshGenerator.getMaterialColor(material);
      });
      
      const performanceEnd = performance.now();

      expect(performanceEnd - performanceStart).toBeLessThan(200); // Should complete within 200ms
      expect(spatialIndex.size).toBeGreaterThan(0);
      expect(nearbyBoreholes.length).toBeLessThanOrEqual(10);
    });

    test('should maintain memory efficiency with repeated USCS material usage', () => {
      const memoryStart = process.memoryUsage().heapUsed;
      
      // Repeatedly access the same USCS materials (should use caching)
      const commonMaterials = ['CL', 'SW', 'GW', 'CH', 'SM'];
      
      for (let i = 0; i < 1000; i++) {
        const material = commonMaterials[i % commonMaterials.length];
        VolumetricMeshGenerator.getMaterialColor(material);
      }
      
      const memoryEnd = process.memoryUsage().heapUsed;
      const memoryIncrease = memoryEnd - memoryStart;
      
      // Memory increase should be minimal due to caching
      expect(memoryIncrease).toBeLessThan(5 * 1024 * 1024); // Less than 5MB
    });
  });

  describe('USCS Material Error Handling and Edge Cases', () => {
    test('should handle boreholes with mixed USCS and legacy materials', () => {
      const mixedMaterialBorehole = {
        id: 'mixed_bh',
        x: 50,
        y: 50,
        z: 0,
        depth: 12,
        layers: [
          { id: 1, material: 'CLAY', from: 0, to: 4 },      // Legacy
          { id: 2, material: 'CL', from: 4, to: 8 },        // USCS
          { id: 3, material: 'SAND', from: 8, to: 12 }      // Legacy
        ]
      };

      const mixedBoreholes = [mixedMaterialBorehole];
      
      expect(() => {
        const spatialIndex = VolumetricMeshGenerator.buildSpatialIndex(mixedBoreholes);
        const nearbyBoreholes = VolumetricMeshGenerator.getNearbyBoreholes(50, 50, 100, spatialIndex);
        
        // Test color resolution for mixed materials
        VolumetricMeshGenerator.getMaterialColor('CLAY');
        VolumetricMeshGenerator.getMaterialColor('CL');
        VolumetricMeshGenerator.getMaterialColor('SAND');
      }).not.toThrow();
    });

    test('should handle empty or malformed borehole data', () => {
      const emptyBoreholes = [];
      const malformedBoreholes = [
        null,
        undefined,
        { id: 'incomplete' }, // Missing required fields
        { id: 'no_layers', x: 0, y: 0, z: 0, depth: 10 } // No layers
      ];

      expect(() => {
        VolumetricMeshGenerator.buildSpatialIndex(emptyBoreholes);
      }).not.toThrow();

      expect(() => {
        VolumetricMeshGenerator.buildSpatialIndex(malformedBoreholes.filter(Boolean));
      }).not.toThrow();
    });

    test('should handle invalid USCS material combinations gracefully', () => {
      const invalidMaterials = [
        'INVALID_USCS',
        'XY', // Not a valid USCS code
        '123',
        '',
        null,
        undefined
      ];

      invalidMaterials.forEach(material => {
        expect(() => {
          const color = VolumetricMeshGenerator.getMaterialColor(material);
          expect(color).toBeInstanceOf(THREE.Color);
        }).not.toThrow();
      });
    });

    test('should handle extreme geological conditions with USCS materials', () => {
      const extremeConditions = [
        {
          name: 'Very thin layers',
          borehole: {
            id: 'thin_layers',
            x: 0,
            y: 0,
            z: 0,
            depth: 1,
            layers: [
              { id: 1, material: 'CL', from: 0, to: 0.1 },
              { id: 2, material: 'SW', from: 0.1, to: 0.2 },
              { id: 3, material: 'GW', from: 0.2, to: 1.0 }
            ]
          }
        },
        {
          name: 'Very deep borehole',
          borehole: {
            id: 'deep_borehole',
            x: 0,
            y: 0,
            z: 0,
            depth: 200,
            layers: [
              { id: 1, material: 'PT', from: 0, to: 50 },
              { id: 2, material: 'CH', from: 50, to: 150 },
              { id: 3, material: 'ROCK', from: 150, to: 200 }
            ]
          }
        }
      ];

      extremeConditions.forEach(({ name, borehole }) => {
        expect(() => {
          const spatialIndex = VolumetricMeshGenerator.buildSpatialIndex([borehole]);
          
          borehole.layers.forEach(layer => {
            VolumetricMeshGenerator.getMaterialColor(layer.material);
          });
        }).not.toThrow();
      });
    });
  });

  // Helper method for calculating color variation
  calculateColorVariation(colors) {
    if (colors.length < 6) return 0; // Need at least 2 RGB triplets
    
    let totalVariation = 0;
    let comparisons = 0;
    
    for (let i = 0; i < colors.length - 3; i += 3) {
      const r1 = colors[i], g1 = colors[i + 1], b1 = colors[i + 2];
      const r2 = colors[i + 3], g2 = colors[i + 4], b2 = colors[i + 5];
      
      const variation = Math.abs(r1 - r2) + Math.abs(g1 - g2) + Math.abs(b1 - b2);
      totalVariation += variation;
      comparisons++;
    }
    
    return comparisons > 0 ? totalVariation / comparisons : 0;
  }
});