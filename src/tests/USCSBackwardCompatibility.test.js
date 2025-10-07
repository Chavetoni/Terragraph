/**
 * Backward Compatibility Test Suite for USCS Materials Integration
 * 
 * This test suite validates that the USCS materials integration maintains
 * backward compatibility with existing legacy material data and workflows,
 * ensuring that existing geological models and borehole data continue to
 * function properly after the USCS standardization.
 * 
 * Backward Compatibility Testing Focus:
 * 1. Legacy material data handling (CLAY, SAND, GRAVEL, SILT, ROCK, PEAT)
 * 2. Mixed USCS and legacy materials in same workflow
 * 3. Existing borehole data format compatibility
 * 4. Legacy color scheme preservation where appropriate
 * 5. Migration path from legacy to USCS materials
 * 6. API compatibility for existing integrations
 * 7. Export format compatibility
 */

import * as THREE from 'three';
import BoreholeVisualizer from '../services/BoreholeVisualizer';
import { VolumetricMeshGenerator } from '../services/VolumetricMeshGenerator';
import { OptimizedVolumetricMeshGenerator } from '../services/OptimizedVolumetricMeshGenerator';
import { 
  getMaterialProperties, 
  normalizeMaterialName, 
  validateMaterialSequence,
  STANDARD_MATERIALS, 
  USCS_CLASSIFICATIONS 
} from '../utils/materialStandardization';

// Mock Three.js for backward compatibility testing
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
  
  CylinderGeometry: jest.fn(() => ({ dispose: jest.fn(), computeBoundingSphere: jest.fn() })),
  SphereGeometry: jest.fn(() => ({ dispose: jest.fn() })),
  CircleGeometry: jest.fn(() => ({ dispose: jest.fn() })),
  
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
  
  DoubleSide: 2
}));

// Mock utilities
jest.mock('../utils/scaleConstants', () => ({
  getBoreholeDimensions: () => ({ markerRadius: 1.0, markerHeight: 2.0 })
}));

jest.mock('../utils/threeJsHelpers', () => ({
  createGlassmorphismLabel: jest.fn(() => ({ position: { set: jest.fn() } }))
}));

describe('USCS Materials Backward Compatibility Testing', () => {
  let mockScene, mockCamera, mockSceneManager, boreholeVisualizer;

  beforeEach(() => {
    mockScene = { add: jest.fn(), remove: jest.fn(), traverse: jest.fn() };
    mockCamera = { position: { x: 0, y: 10, z: 10 } };
    mockSceneManager = { addCSS3D: jest.fn(), removeCSS3D: jest.fn() };
    
    boreholeVisualizer = new BoreholeVisualizer(mockScene, mockCamera, mockSceneManager);
    jest.clearAllMocks();
  });

  afterEach(() => {
    if (boreholeVisualizer) {
      boreholeVisualizer.dispose();
    }
  });

  describe('Legacy Material Data Handling', () => {
    test('should handle all legacy material types correctly', () => {
      const legacyMaterials = ['CLAY', 'SAND', 'GRAVEL', 'SILT', 'ROCK', 'PEAT', 'FILL', 'TOPSOIL'];
      
      legacyMaterials.forEach(material => {
        // Verify legacy materials are still recognized
        const materialProps = getMaterialProperties(material);
        expect(materialProps).toBeTruthy();
        expect(materialProps.color).toBeDefined();
        expect(materialProps.density).toBeGreaterThan(0);
        expect(materialProps.category).toBeDefined();

        // Verify 3D color resolution works
        const color = VolumetricMeshGenerator.getMaterialColor(material);
        expect(color).toBeInstanceOf(THREE.Color);
        expect(color.r + color.g + color.b).toBeGreaterThan(0);
      });
    });

    test('should maintain USCS equivalent mappings for legacy materials', () => {
      const legacyToUSCSMappings = {
        'CLAY': 'CL',
        'SAND': 'SW', 
        'GRAVEL': 'GW',
        'SILT': 'ML',
        'PEAT': 'PT'
      };

      Object.entries(legacyToUSCSMappings).forEach(([legacy, expectedUSCS]) => {
        const legacyProps = getMaterialProperties(legacy);
        const uscsProps = getMaterialProperties(expectedUSCS);

        expect(legacyProps).toBeTruthy();
        expect(uscsProps).toBeTruthy();

        // Legacy materials should have USCS equivalents defined
        if (legacyProps.uscsEquivalent) {
          expect(legacyProps.uscsEquivalent).toBe(expectedUSCS);
        }
      });
    });

    test('should normalize legacy material name variations', () => {
      const materialVariations = [
        { inputs: ['clay', 'CLAY', 'Clay', 'clayey'], expected: 'CLAY' },
        { inputs: ['sand', 'SAND', 'sandy', 'sand soil'], expected: 'SAND' },
        { inputs: ['gravel', 'GRAVEL', 'gravelly'], expected: 'GRAVEL' },
        { inputs: ['silt', 'SILT', 'silty'], expected: 'SILT' },
        { inputs: ['rock', 'ROCK', 'bedrock', 'limestone'], expected: 'ROCK' }
      ];

      materialVariations.forEach(({ inputs, expected }) => {
        inputs.forEach(input => {
          const normalized = normalizeMaterialName(input);
          expect(normalized).toBe(expected);
        });
      });
    });

    test('should handle case-insensitive legacy material lookup', () => {
      const caseVariations = ['clay', 'CLAY', 'Clay', 'cLaY'];
      
      caseVariations.forEach(variation => {
        const props = getMaterialProperties(variation);
        expect(props).toBeTruthy();
        expect(props.color).toBe(STANDARD_MATERIALS['CLAY'].color);
      });
    });
  });

  describe('Mixed USCS and Legacy Materials Workflow', () => {
    test('should handle mixed materials in single borehole', () => {
      const mixedMaterialBorehole = {
        id: 'mixed-compatibility-test',
        x: 100, y: 50, z: 0,
        diameter: 0.2, depth: 18,
        layers: [
          { id: 1, material: 'CLAY', from: 0, to: 6 },    // Legacy
          { id: 2, material: 'CL', from: 6, to: 12 },     // USCS
          { id: 3, material: 'SAND', from: 12, to: 18 }   // Legacy
        ]
      };

      expect(() => {
        const boreholeGroup = boreholeVisualizer.createEnhancedBoreholeMarker(mixedMaterialBorehole);
        const strataGroup = boreholeVisualizer.createBoreholeStrata(mixedMaterialBorehole, { layers: [] });
        
        expect(boreholeGroup).toBeTruthy();
        expect(strataGroup).toBeTruthy();
        expect(strataGroup.children.length).toBe(3); // All layers should be created
      }).not.toThrow();

      // Verify all materials resolve to valid colors
      mixedMaterialBorehole.layers.forEach(layer => {
        const color = VolumetricMeshGenerator.getMaterialColor(layer.material);
        expect(color).toBeInstanceOf(THREE.Color);
      });
    });

    test('should maintain consistent processing for legacy and USCS materials', () => {
      const legacyBorehole = {
        id: 'legacy-bh',
        x: 0, y: 0, z: 0,
        depth: 15,
        layers: [
          { id: 1, material: 'CLAY', from: 0, to: 5 },
          { id: 2, material: 'SAND', from: 5, to: 10 },
          { id: 3, material: 'GRAVEL', from: 10, to: 15 }
        ]
      };

      const uscsBorehole = {
        id: 'uscs-bh',
        x: 50, y: 50, z: 0,
        depth: 15,
        layers: [
          { id: 1, material: 'CL', from: 0, to: 5 },
          { id: 2, material: 'SW', from: 5, to: 10 },
          { id: 3, material: 'GW', from: 10, to: 15 }
        ]
      };

      // Both should process without errors
      const legacyGroup = boreholeVisualizer.createEnhancedBoreholeMarker(legacyBorehole);
      const uscsGroup = boreholeVisualizer.createEnhancedBoreholeMarker(uscsBorehole);

      expect(legacyGroup).toBeTruthy();
      expect(uscsGroup).toBeTruthy();
      expect(legacyGroup.children.length).toBeGreaterThan(0);
      expect(uscsGroup.children.length).toBeGreaterThan(0);

      // Both should work in spatial indexing
      const mixedDataset = [legacyBorehole, uscsBorehole];
      const spatialIndex = OptimizedVolumetricMeshGenerator.buildSpatialIndex(mixedDataset);
      expect(spatialIndex.size).toBeGreaterThan(0);
    });

    test('should handle volumetric mesh generation with mixed materials', () => {
      const topSurface = [
        { x: 0, y: 0, z: 10 }, { x: 20, y: 0, z: 9 },
        { x: 0, y: 20, z: 11 }, { x: 20, y: 20, z: 8 }
      ];

      const bottomSurface = [
        { x: 0, y: 0, z: 5 }, { x: 20, y: 0, z: 4 },
        { x: 0, y: 20, z: 6 }, { x: 20, y: 20, z: 3 }
      ];

      const extent = { minX: -1, maxX: 21, minY: -1, maxY: 21 };
      const mixedMaterials = ['CLAY', 'CL', 'SAND', 'SW', 'GRAVEL', 'GW'];

      mixedMaterials.forEach(material => {
        expect(() => {
          const layerVolume = VolumetricMeshGenerator.createLayerVolume(
            topSurface, bottomSurface, material, extent, 4, { opacity: 0.7 }
          );
          expect(layerVolume).toBeTruthy();
          expect(layerVolume.vertices.length).toBeGreaterThan(0);
          expect(layerVolume.colors.length).toBeGreaterThan(0);
        }).not.toThrow();
      });
    });
  });

  describe('Existing Borehole Data Format Compatibility', () => {
    test('should handle legacy borehole data structures', () => {
      // Simulate older borehole data format
      const legacyBoreholeData = {
        id: 'legacy-format-test',
        x: 100,
        y: 50,
        z: 0,
        diameter: 0.2,
        depth: 12,
        // Legacy format might not have structured layers
        materialType: 'CLAY',
        description: 'Clay layer from legacy system'
      };

      // Should handle missing layers gracefully
      expect(() => {
        const group = boreholeVisualizer.createEnhancedBoreholeMarker(legacyBoreholeData);
        expect(group).toBeTruthy();
        expect(group.name).toBe(`borehole_${legacyBoreholeData.id}`);
      }).not.toThrow();
    });

    test('should handle incomplete layer data', () => {
      const incompleteLayerBorehole = {
        id: 'incomplete-layers-test',
        x: 100, y: 50, z: 0,
        diameter: 0.2, depth: 15,
        layers: [
          { id: 1, material: 'CLAY', from: 0, to: 5 },
          { id: 2, from: 5, to: 10 },  // Missing material
          { id: 3, material: '', from: 10, to: 15 },  // Empty material
          null,  // Null layer
          { id: 4, material: 'SAND' }  // Missing depth info
        ]
      };

      expect(() => {
        const group = boreholeVisualizer.createEnhancedBoreholeMarker(incompleteLayerBorehole);
        const strataGroup = boreholeVisualizer.createBoreholeStrata(incompleteLayerBorehole, { layers: [] });
        
        expect(group).toBeTruthy();
        // Should handle incomplete data gracefully
      }).not.toThrow();
    });

    test('should preserve custom colors in legacy data', () => {
      const customColorBorehole = {
        id: 'custom-color-test',
        x: 100, y: 50, z: 0,
        diameter: 0.2, depth: 10,
        layers: [
          { 
            id: 1, 
            material: 'CLAY', 
            from: 0, 
            to: 10,
            customColor: '#FF0000' // Custom red color
          }
        ]
      };

      const strataGroup = boreholeVisualizer.createBoreholeStrata(customColorBorehole, { layers: [] });
      
      expect(strataGroup).toBeTruthy();
      // Custom color should be preserved over standard material color
      expect(THREE.MeshLambertMaterial).toHaveBeenCalledWith(
        expect.objectContaining({
          color: '#FF0000'
        })
      );
    });
  });

  describe('Material Validation Backward Compatibility', () => {
    test('should validate mixed legacy and USCS material sequences', () => {
      const mixedMaterialSequence = [
        { material: 'TOPSOIL', from: 0, to: 2 },    // Legacy
        { material: 'CL', from: 2, to: 8 },         // USCS  
        { material: 'SAND', from: 8, to: 12 },      // Legacy
        { material: 'GW', from: 12, to: 18 },       // USCS
        { material: 'ROCK', from: 18, to: 25 }      // Legacy
      ];

      const validation = validateMaterialSequence(mixedMaterialSequence);
      
      expect(validation.isValid).toBeTruthy();
      expect(Array.isArray(validation.warnings)).toBeTruthy();
      expect(Array.isArray(validation.errors)).toBeTruthy();
    });

    test('should handle legacy material name normalization in validation', () => {
      const legacyVariationSequence = [
        { material: 'clay soil', from: 0, to: 5 },
        { material: 'sandy', from: 5, to: 10 },
        { material: 'gravelly', from: 10, to: 15 }
      ];

      expect(() => {
        const validation = validateMaterialSequence(legacyVariationSequence);
        expect(validation).toBeTruthy();
      }).not.toThrow();
    });

    test('should provide appropriate warnings for legacy material usage', () => {
      const legacySequence = [
        { material: 'CLAY', from: 0, to: 5 },
        { material: 'SAND', from: 5, to: 10 }
      ];

      const validation = validateMaterialSequence(legacySequence);
      
      expect(validation.isValid).toBeTruthy();
      // May include informational warnings about legacy materials
      expect(validation.warnings).toBeDefined();
    });
  });

  describe('API Compatibility', () => {
    test('should maintain existing API signatures for material functions', () => {
      // Test that existing API calls still work
      const legacyAPIUsage = [
        () => getMaterialProperties('CLAY'),
        () => getMaterialProperties('clay'),
        () => normalizeMaterialName('Sandy Clay'),
        () => VolumetricMeshGenerator.getMaterialColor('SAND'),
        () => OptimizedVolumetricMeshGenerator.getMaterialColor('GRAVEL')
      ];

      legacyAPIUsage.forEach(apiCall => {
        expect(() => {
          const result = apiCall();
          expect(result).toBeTruthy();
        }).not.toThrow();
      });
    });

    test('should maintain consistent return types for legacy materials', () => {
      const legacyMaterials = ['CLAY', 'SAND', 'GRAVEL', 'SILT'];

      legacyMaterials.forEach(material => {
        const props = getMaterialProperties(material);
        
        // Verify expected structure is maintained
        expect(props).toHaveProperty('color');
        expect(props).toHaveProperty('density');
        expect(props).toHaveProperty('pattern');
        expect(props).toHaveProperty('description');
        expect(props).toHaveProperty('category');
        expect(Array.isArray(props.aliases)).toBeTruthy();

        const color = VolumetricMeshGenerator.getMaterialColor(material);
        expect(color).toBeInstanceOf(THREE.Color);
        expect(typeof color.r).toBe('number');
        expect(typeof color.g).toBe('number');
        expect(typeof color.b).toBe('number');
      });
    });
  });

  describe('Migration Path and Upgrade Support', () => {
    test('should provide smooth migration from legacy to USCS materials', () => {
      const legacyMaterials = ['CLAY', 'SAND', 'GRAVEL', 'SILT', 'PEAT'];
      
      legacyMaterials.forEach(legacyMaterial => {
        const legacyProps = getMaterialProperties(legacyMaterial);
        
        if (legacyProps.uscsEquivalent) {
          const uscsProps = getMaterialProperties(legacyProps.uscsEquivalent);
          
          // USCS equivalent should have similar or better properties
          expect(uscsProps).toBeTruthy();
          expect(uscsProps.category).toBeDefined();
          expect(uscsProps.density).toBeGreaterThan(0);
          
          // Colors may differ but should be geologically appropriate
          const legacyColor = new THREE.Color(legacyProps.color);
          const uscsColor = new THREE.Color(uscsProps.color);
          
          expect(legacyColor.r + legacyColor.g + legacyColor.b).toBeGreaterThan(0);
          expect(uscsColor.r + uscsColor.g + uscsColor.b).toBeGreaterThan(0);
        }
      });
    });

    test('should support gradual migration with mixed material datasets', () => {
      // Simulate a site with gradually migrated data
      const migrationDataset = [
        {
          id: 'old-borehole-1',
          x: 0, y: 0, z: 0, depth: 10,
          layers: [{ id: 1, material: 'CLAY', from: 0, to: 10 }] // Old format
        },
        {
          id: 'transitional-borehole-2',
          x: 50, y: 0, z: 0, depth: 12,
          layers: [
            { id: 1, material: 'CLAY', from: 0, to: 6 },  // Old format
            { id: 2, material: 'CL', from: 6, to: 12 }    // New USCS format
          ]
        },
        {
          id: 'new-borehole-3',
          x: 100, y: 0, z: 0, depth: 15,
          layers: [
            { id: 1, material: 'CL', from: 0, to: 8 },    // Full USCS
            { id: 2, material: 'SW', from: 8, to: 15 }
          ]
        }
      ];

      // All boreholes should process without issues
      migrationDataset.forEach(borehole => {
        expect(() => {
          const group = boreholeVisualizer.createEnhancedBoreholeMarker(borehole);
          expect(group).toBeTruthy();
        }).not.toThrow();
      });

      // Spatial operations should work with mixed dataset
      const spatialIndex = OptimizedVolumetricMeshGenerator.buildSpatialIndex(migrationDataset);
      expect(spatialIndex.size).toBeGreaterThan(0);

      // All materials should resolve correctly
      const allMaterials = migrationDataset.flatMap(bh => bh.layers.map(layer => layer.material));
      allMaterials.forEach(material => {
        const color = VolumetricMeshGenerator.getMaterialColor(material);
        expect(color).toBeInstanceOf(THREE.Color);
      });
    });
  });

  describe('Export Format Compatibility', () => {
    test('should maintain export compatibility for legacy materials', () => {
      const legacyExportData = {
        siteInfo: {
          name: 'Legacy Site',
          location: 'Test Location'
        },
        boreholes: [
          {
            id: 'export-test-legacy',
            x: 100, y: 50, z: 0,
            depth: 15,
            layers: [
              { id: 1, material: 'CLAY', from: 0, to: 8, description: 'Clay Layer' },
              { id: 2, material: 'SAND', from: 8, to: 15, description: 'Sand Layer' }
            ]
          }
        ]
      };

      // Verify all materials in export data can be processed
      legacyExportData.boreholes.forEach(borehole => {
        borehole.layers.forEach(layer => {
          const props = getMaterialProperties(layer.material);
          expect(props).toBeTruthy();
          expect(props.color).toBeDefined();
          expect(props.description).toBeTruthy();
        });
      });

      // Verify export structure is maintained
      expect(legacyExportData.siteInfo).toBeDefined();
      expect(Array.isArray(legacyExportData.boreholes)).toBeTruthy();
      expect(legacyExportData.boreholes[0].layers.length).toBe(2);
    });

    test('should handle legacy import data gracefully', () => {
      const legacyImportData = {
        version: '1.0.0',
        materials: {
          'CLAY': { color: '#8B4513', type: 'cohesive' },
          'SAND': { color: '#F4A460', type: 'granular' }
        },
        boreholes: [
          {
            name: 'BH-1',
            location: { x: 100, y: 50 },
            depth: 10,
            materials: [
              { type: 'CLAY', depth: 5 },
              { type: 'SAND', depth: 5 }
            ]
          }
        ]
      };

      // Should handle different data structures gracefully
      expect(() => {
        const materials = Object.keys(legacyImportData.materials);
        materials.forEach(material => {
          const props = getMaterialProperties(material);
          expect(props).toBeTruthy();
        });
      }).not.toThrow();
    });
  });

  describe('Error Handling and Fallbacks', () => {
    test('should provide meaningful fallbacks for unknown legacy materials', () => {
      const unknownLegacyMaterials = ['OLD_CLAY_TYPE', 'CUSTOM_SAND', 'SITE_SPECIFIC_ROCK'];
      
      unknownLegacyMaterials.forEach(material => {
        const props = getMaterialProperties(material);
        const color = VolumetricMeshGenerator.getMaterialColor(material);
        
        // Should provide default properties instead of crashing
        expect(props).toBeTruthy();
        expect(props.color).toBeDefined();
        expect(color).toBeInstanceOf(THREE.Color);
      });
    });

    test('should handle corrupted legacy material data', () => {
      const corruptedMaterialInputs = [
        null,
        undefined,
        '',
        '   ',
        123,
        {},
        [],
        'CLAY\x00NULL',  // Null byte
        'SAND\n\r',      // Control characters
      ];

      corruptedMaterialInputs.forEach(input => {
        expect(() => {
          const props = getMaterialProperties(input);
          const normalized = normalizeMaterialName(input);
          
          // Should handle gracefully without throwing
          expect(props).toBeTruthy();
          expect(normalized).toBeTruthy();
        }).not.toThrow();
      });
    });

    test('should maintain system stability with legacy edge cases', () => {
      const edgeCaseBorehole = {
        id: 'edge-case-legacy',
        x: 0, y: 0, z: 0,
        diameter: 0.1,
        depth: 0.5,  // Very shallow
        layers: [
          { id: 1, material: 'clay soil mixture', from: 0, to: 0.2 },
          { id: 2, material: 'sandy clay', from: 0.2, to: 0.5 }
        ]
      };

      expect(() => {
        const group = boreholeVisualizer.createEnhancedBoreholeMarker(edgeCaseBorehole);
        const strataGroup = boreholeVisualizer.createBoreholeStrata(edgeCaseBorehole, { layers: [] });
        
        expect(group).toBeTruthy();
        expect(strataGroup).toBeTruthy();
      }).not.toThrow();
    });
  });

  describe('Performance Regression Prevention', () => {
    test('should maintain performance with legacy material processing', () => {
      const legacyMaterials = ['CLAY', 'SAND', 'GRAVEL', 'SILT', 'ROCK'];
      const iterations = 1000;
      
      const start = performance.now();
      
      for (let i = 0; i < iterations; i++) {
        const material = legacyMaterials[i % legacyMaterials.length];
        getMaterialProperties(material);
        VolumetricMeshGenerator.getMaterialColor(material);
        normalizeMaterialName(material);
      }
      
      const end = performance.now();
      const avgTime = (end - start) / iterations;
      
      // Legacy material processing should be fast
      expect(avgTime).toBeLessThan(1); // Less than 1ms per operation
      
      console.log(`Legacy Material Performance - Average: ${avgTime.toFixed(3)}ms per operation`);
    });

    test('should not degrade performance with mixed legacy/USCS datasets', () => {
      const mixedDataset = [];
      const legacyMaterials = ['CLAY', 'SAND', 'GRAVEL'];
      const uscsMaterials = ['CL', 'SW', 'GW'];
      
      for (let i = 0; i < 100; i++) {
        const useLegacy = i % 2 === 0;
        const materialSet = useLegacy ? legacyMaterials : uscsMaterials;
        const material = materialSet[i % materialSet.length];
        
        mixedDataset.push({
          id: `mixed-perf-${i}`,
          x: (i % 10) * 20, y: Math.floor(i / 10) * 20, z: 0,
          depth: 10,
          layers: [{ id: 1, material: material, from: 0, to: 10 }]
        });
      }

      const start = performance.now();
      
      // Process mixed dataset
      mixedDataset.forEach(borehole => {
        const group = boreholeVisualizer.createEnhancedBoreholeMarker(borehole);
        expect(group).toBeTruthy();
      });

      const spatialIndex = OptimizedVolumetricMeshGenerator.buildSpatialIndex(mixedDataset);
      expect(spatialIndex.size).toBeGreaterThan(0);

      const end = performance.now();
      const totalTime = end - start;
      
      // Should process 100 mixed boreholes quickly
      expect(totalTime).toBeLessThan(2000); // Less than 2 seconds
      
      console.log(`Mixed Dataset Processing (100 boreholes): ${totalTime.toFixed(2)}ms`);
    });
  });
});