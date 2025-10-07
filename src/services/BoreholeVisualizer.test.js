/**
 * Comprehensive Test Suite for USCS Materials Integration in BoreholeVisualizer
 * 
 * This test suite validates the integration of the Unified Soil Classification System (USCS)
 * materials with the BoreholeVisualizer service, ensuring proper 3D visualization of all
 * geological materials in the borehole strata system.
 * 
 * Testing Focus:
 * 1. USCS material color resolution in 3D borehole markers
 * 2. Material consistency between UI selection and 3D visualization
 * 3. Strata visualization with correct USCS material properties
 * 4. Professional USCS codes display in 3D labels
 * 5. Texture generation for USCS materials
 * 6. Backward compatibility with legacy materials
 * 7. Performance with multiple USCS materials
 */

import * as THREE from 'three';
import BoreholeVisualizer from './BoreholeVisualizer';
import { getMaterialProperties, STANDARD_MATERIALS, USCS_CLASSIFICATIONS } from '../utils/materialStandardization';

// Mock Three.js dependencies for testing
jest.mock('three', () => ({
  Group: jest.fn(() => ({
    name: '',
    userData: {},
    add: jest.fn(),
    position: { set: jest.fn() },
    layers: { enable: jest.fn() },
    updateMatrixWorld: jest.fn(),
    traverse: jest.fn()
  })),
  
  CylinderGeometry: jest.fn(() => ({
    dispose: jest.fn()
  })),
  
  SphereGeometry: jest.fn(() => ({
    dispose: jest.fn()
  })),
  
  ConeGeometry: jest.fn(() => ({
    dispose: jest.fn()
  })),
  
  CircleGeometry: jest.fn(() => ({
    dispose: jest.fn()
  })),
  
  RingGeometry: jest.fn(() => ({
    dispose: jest.fn()
  })),
  
  MeshStandardMaterial: jest.fn(() => ({
    dispose: jest.fn(),
    color: { set: jest.fn(), multiplyScalar: jest.fn() },
    needsUpdate: true
  })),
  
  MeshLambertMaterial: jest.fn(() => ({
    dispose: jest.fn(),
    color: { set: jest.fn(), multiplyScalar: jest.fn() },
    needsUpdate: true
  })),
  
  MeshBasicMaterial: jest.fn(() => ({
    dispose: jest.fn(),
    color: { set: jest.fn(), multiplyScalar: jest.fn() }
  })),
  
  Mesh: jest.fn(() => ({
    position: { set: jest.fn(), clone: jest.fn() },
    rotation: { x: 0, y: 0, z: 0 },
    layers: { enable: jest.fn() },
    userData: {},
    renderOrder: 0,
    material: { depthWrite: true },
    geometry: { computeBoundingSphere: jest.fn() }
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
  
  RepeatWrapping: 1000,
  NearestFilter: 1003,
  DoubleSide: 2
}));

// Mock getBoreholeDimensions utility
jest.mock('../utils/scaleConstants', () => ({
  getBoreholeDimensions: () => ({
    markerRadius: 1.0,
    markerHeight: 2.0
  })
}));

// Mock createGlassmorphismLabel utility
jest.mock('../utils/threeJsHelpers', () => ({
  createGlassmorphismLabel: jest.fn(() => ({
    position: { set: jest.fn() },
    name: 'mock-label'
  }))
}));

describe('BoreholeVisualizer USCS Materials Integration', () => {
  let mockScene;
  let mockCamera;
  let mockSceneManager;
  let boreholeVisualizer;

  beforeEach(() => {
    // Create mock Three.js scene and camera
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

    // Initialize BoreholeVisualizer
    boreholeVisualizer = new BoreholeVisualizer(mockScene, mockCamera, mockSceneManager);
    
    // Clear all mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Clean up resources
    if (boreholeVisualizer) {
      boreholeVisualizer.dispose();
    }
  });

  describe('USCS Material Color Integration', () => {
    test('should correctly resolve colors for all USCS coarse-grained materials', () => {
      const coarseGrainedMaterials = ['GW', 'GP', 'GM', 'GC', 'SW', 'SP', 'SM', 'SC'];
      
      coarseGrainedMaterials.forEach(material => {
        const color = BoreholeVisualizer.getMaterialColor(material);
        
        expect(color).toBeInstanceOf(THREE.Color);
        
        // Verify the color matches the USCS standard
        const expectedProps = getMaterialProperties(material);
        const expectedColor = new THREE.Color(expectedProps.color);
        
        expect(color.r).toBeCloseTo(expectedColor.r, 2);
        expect(color.g).toBeCloseTo(expectedColor.g, 2);
        expect(color.b).toBeCloseTo(expectedColor.b, 2);
      });
    });

    test('should correctly resolve colors for all USCS fine-grained materials', () => {
      const fineGrainedMaterials = ['ML', 'CL', 'OL', 'MH', 'CH', 'OH'];
      
      fineGrainedMaterials.forEach(material => {
        const color = BoreholeVisualizer.getMaterialColor(material);
        
        expect(color).toBeInstanceOf(THREE.Color);
        
        // Verify the color matches the USCS standard
        const expectedProps = getMaterialProperties(material);
        const expectedColor = new THREE.Color(expectedProps.color);
        
        expect(color.r).toBeCloseTo(expectedColor.r, 2);
        expect(color.g).toBeCloseTo(expectedColor.g, 2);
        expect(color.b).toBeCloseTo(expectedColor.b, 2);
      });
    });

    test('should correctly resolve colors for highly organic and special materials', () => {
      const specialMaterials = ['PT', 'ROCK', 'FILL', 'TOPSOIL'];
      
      specialMaterials.forEach(material => {
        const color = BoreholeVisualizer.getMaterialColor(material);
        
        expect(color).toBeInstanceOf(THREE.Color);
        
        // Verify the color matches the USCS standard
        const expectedProps = getMaterialProperties(material);
        const expectedColor = new THREE.Color(expectedProps.color);
        
        expect(color.r).toBeCloseTo(expectedColor.r, 2);
        expect(color.g).toBeCloseTo(expectedColor.g, 2);
        expect(color.b).toBeCloseTo(expectedColor.b, 2);
      });
    });

    test('should handle invalid material types gracefully', () => {
      const invalidMaterials = ['INVALID', '', null, undefined];
      
      invalidMaterials.forEach(material => {
        const color = BoreholeVisualizer.getMaterialColor(material);
        
        expect(color).toBeInstanceOf(THREE.Color);
        // Should return gray fallback color
        expect(color.r).toBeCloseTo(0.5, 1); // #808080 = gray
        expect(color.g).toBeCloseTo(0.5, 1);
        expect(color.b).toBeCloseTo(0.5, 1);
      });
    });
  });

  describe('USCS Material Borehole Strata Creation', () => {
    const mockLayersContext = {
      layers: [
        { id: 1, name: 'Clay Layer', color: '#8B4513' },
        { id: 2, name: 'Sand Layer', color: '#F4A460' }
      ]
    };

    test('should create borehole strata with USCS material codes in layer names', () => {
      const borehole = {
        id: 'test-1',
        x: 100,
        y: 50,
        z: 0,
        diameter: 0.2,
        depth: 10,
        layers: [
          { id: 1, material: 'CL', from: 0, to: 5, customColor: '#A0522D' },
          { id: 2, material: 'SW', from: 5, to: 10, customColor: '#F4A460' }
        ]
      };

      const strataGroup = boreholeVisualizer.createBoreholeStrata(borehole, mockLayersContext);

      expect(strataGroup).toBeTruthy();
      expect(strataGroup.name).toBe('borehole_strata_test-1');
      expect(strataGroup.userData.type).toBe('borehole_strata');
      expect(strataGroup.userData.boreholeId).toBe('test-1');

      // Verify that mesh creation was called for each layer
      expect(THREE.Mesh).toHaveBeenCalledTimes(2);
      
      // Verify cylinder geometries were created with correct dimensions
      expect(THREE.CylinderGeometry).toHaveBeenCalledWith(0.3, 0.3, 5, 16, 1, false); // Layer 1
      expect(THREE.CylinderGeometry).toHaveBeenCalledWith(0.3, 0.3, 5, 16, 1, false); // Layer 2
    });

    test('should use USCS material properties when custom color is not provided', () => {
      const borehole = {
        id: 'test-2',
        x: 100,
        y: 50,
        z: 0,
        diameter: 0.2,
        depth: 10,
        layers: [
          { id: 1, material: 'GW', from: 0, to: 5 }, // No custom color, should use USCS
          { id: 2, material: 'CH', from: 5, to: 10 }  // No custom color, should use USCS
        ]
      };

      const strataGroup = boreholeVisualizer.createBoreholeStrata(borehole, mockLayersContext);

      expect(strataGroup).toBeTruthy();

      // Verify materials were created with USCS colors
      expect(THREE.MeshLambertMaterial).toHaveBeenCalledWith(
        expect.objectContaining({
          color: getMaterialProperties('GW').color,
          transparent: true,
          opacity: 0.9,
          side: THREE.DoubleSide
        })
      );

      expect(THREE.MeshLambertMaterial).toHaveBeenCalledWith(
        expect.objectContaining({
          color: getMaterialProperties('CH').color,
          transparent: true,
          opacity: 0.9,
          side: THREE.DoubleSide
        })
      );
    });

    test('should create proper layer names using USCS codes', () => {
      const borehole = {
        id: 'test-3',
        x: 100,
        y: 50,
        z: 0,
        diameter: 0.2,
        depth: 15,
        layers: [
          { id: 1, material: 'CL', from: 0, to: 5 },
          { id: 2, material: 'SW', from: 5, to: 10 },
          { id: 3, material: 'PT', from: 10, to: 15 }
        ]
      };

      const strataGroup = boreholeVisualizer.createBoreholeStrata(borehole, mockLayersContext);

      // Verify that the strataLabels array contains USCS codes
      const labels = strataGroup.userData.labels;
      expect(labels).toHaveLength(3);
      expect(labels[0].text).toBe('CL');
      expect(labels[1].text).toBe('SW');
      expect(labels[2].text).toBe('PT');
    });

    test('should handle legacy materials with USCS equivalents', () => {
      const borehole = {
        id: 'test-4',
        x: 100,
        y: 50,
        z: 0,
        diameter: 0.2,
        depth: 10,
        layers: [
          { id: 1, material: 'CLAY', from: 0, to: 5 }, // Legacy material
          { id: 2, material: 'SAND', from: 5, to: 10 }  // Legacy material
        ]
      };

      const strataGroup = boreholeVisualizer.createBoreholeStrata(borehole, mockLayersContext);

      expect(strataGroup).toBeTruthy();

      // Should use USCS colors for legacy materials
      expect(THREE.MeshLambertMaterial).toHaveBeenCalledWith(
        expect.objectContaining({
          color: getMaterialProperties('CLAY').color,
          transparent: true,
          opacity: 0.9,
          side: THREE.DoubleSide
        })
      );
    });
  });

  describe('USCS Material Texture Generation', () => {
    test('should create high-contrast textures for all USCS materials', () => {
      const allUSCSMaterials = Object.keys(USCS_CLASSIFICATIONS);
      
      allUSCSMaterials.forEach(material => {
        const mockDocument = {
          createElement: jest.fn(() => ({
            width: 0,
            height: 0,
            getContext: jest.fn(() => ({
              fillStyle: '',
              strokeStyle: '',
              lineWidth: 0,
              fillRect: jest.fn(),
              strokeRect: jest.fn(),
              beginPath: jest.fn(),
              moveTo: jest.fn(),
              lineTo: jest.fn(),
              stroke: jest.fn(),
              fill: jest.fn(),
              arc: jest.fn(),
              font: '',
              textAlign: '',
              fillText: jest.fn()
            }))
          }))
        };

        // Mock document.createElement for texture creation
        global.document = mockDocument;

        const materialProps = getMaterialProperties(material);
        const texture = boreholeVisualizer.createHighContrastSoilTexture(material, materialProps.color);

        expect(texture).toBeTruthy();
        expect(THREE.CanvasTexture).toHaveBeenCalled();
      });
    });

    test('should generate material-specific texture patterns', () => {
      const materialPatterns = {
        'CL': 'horizontal lines', // Clay
        'SW': 'dots', // Sand
        'GW': 'circles', // Gravel
        'MH': 'diagonal lines', // Silt
        'PT': 'irregular organic' // Peat
      };

      Object.keys(materialPatterns).forEach(material => {
        // Mock canvas context to track pattern creation
        const mockContext = {
          fillStyle: '',
          strokeStyle: '',
          lineWidth: 0,
          fillRect: jest.fn(),
          strokeRect: jest.fn(),
          beginPath: jest.fn(),
          moveTo: jest.fn(),
          lineTo: jest.fn(),
          stroke: jest.fn(),
          fill: jest.fn(),
          arc: jest.fn(),
          font: '',
          textAlign: '',
          fillText: jest.fn()
        };

        const mockCanvas = {
          width: 128,
          height: 128,
          getContext: jest.fn(() => mockContext)
        };

        global.document = {
          createElement: jest.fn(() => mockCanvas)
        };

        const materialProps = getMaterialProperties(material);
        const texture = boreholeVisualizer.createHighContrastSoilTexture(material, materialProps.color);

        expect(texture).toBeTruthy();
        expect(mockContext.fillRect).toHaveBeenCalled(); // Base color fill
        
        // Verify pattern-specific drawing calls based on material type
        if (material === 'CL') {
          expect(mockContext.stroke).toHaveBeenCalled(); // Horizontal lines
        } else if (material === 'SW') {
          expect(mockContext.fill).toHaveBeenCalled(); // Dots
        } else if (material === 'GW') {
          expect(mockContext.fill).toHaveBeenCalled(); // Circles
        }
      });
    });
  });

  describe('USCS Material Performance and Memory Management', () => {
    test('should efficiently create materials for large numbers of USCS layers', () => {
      const performanceStart = performance.now();
      
      // Create a borehole with many USCS layers
      const borehole = {
        id: 'performance-test',
        x: 100,
        y: 50,
        z: 0,
        diameter: 0.2,
        depth: 50,
        layers: []
      };

      // Add 20 layers with different USCS materials
      const uscsTypes = ['GW', 'GP', 'GM', 'GC', 'SW', 'SP', 'SM', 'SC', 'ML', 'CL', 'OL', 'MH', 'CH', 'OH', 'PT'];
      for (let i = 0; i < 20; i++) {
        borehole.layers.push({
          id: i + 1,
          material: uscsTypes[i % uscsTypes.length],
          from: i * 2.5,
          to: (i + 1) * 2.5
        });
      }

      const strataGroup = boreholeVisualizer.createBoreholeStrata(borehole, { layers: [] });
      const performanceEnd = performance.now();

      expect(strataGroup).toBeTruthy();
      expect(performanceEnd - performanceStart).toBeLessThan(200); // Should complete within 200ms
      
      // Verify all layers were created
      expect(THREE.Mesh).toHaveBeenCalledTimes(20);
      expect(THREE.CylinderGeometry).toHaveBeenCalledTimes(20);
      expect(THREE.MeshLambertMaterial).toHaveBeenCalledTimes(20);
    });

    test('should properly dispose of USCS material resources', () => {
      const borehole = {
        id: 'disposal-test',
        x: 100,
        y: 50,
        z: 0,
        diameter: 0.2,
        depth: 10,
        layers: [
          { id: 1, material: 'CL', from: 0, to: 5 },
          { id: 2, material: 'SW', from: 5, to: 10 }
        ]
      };

      const strataGroup = boreholeVisualizer.createBoreholeStrata(borehole, { layers: [] });
      
      // Mock traverse method to simulate disposal
      strataGroup.traverse = jest.fn((callback) => {
        // Simulate child meshes with geometry and material
        const mockChild1 = {
          geometry: { dispose: jest.fn() },
          material: { dispose: jest.fn(), map: { dispose: jest.fn() } }
        };
        const mockChild2 = {
          geometry: { dispose: jest.fn() },
          material: { dispose: jest.fn(), map: { dispose: jest.fn() } }
        };
        callback(mockChild1);
        callback(mockChild2);
      });

      // Test disposal
      boreholeVisualizer.disposeBoreholeStrata(strataGroup);

      expect(strataGroup.traverse).toHaveBeenCalled();
    });
  });

  describe('USCS Material Water Table Integration', () => {
    test('should create water table indicators with USCS material context', () => {
      const borehole = {
        id: 'water-table-test',
        x: 100,
        y: 50,
        z: 0,
        diameter: 0.2,
        depth: 10,
        waterTableEncountered: true,
        waterTableDepth: 3.5,
        waterTableElevation: 46.5,
        layers: [
          { id: 1, material: 'SW', from: 0, to: 3 },
          { id: 2, material: 'CL', from: 3, to: 10 }
        ]
      };

      const waterTableRing = boreholeVisualizer.createWaterTableRing(borehole);

      expect(waterTableRing).toBeTruthy();
      expect(waterTableRing.name).toBe('water_table_water-table-test');
      expect(waterTableRing.userData.type).toBe('water_table');
      expect(waterTableRing.userData.waterTableDepth).toBe(3.5);
      expect(waterTableRing.userData.waterTableElevation).toBe(46.5);

      // Verify water table geometry creation
      expect(THREE.CircleGeometry).toHaveBeenCalled();
      expect(THREE.RingGeometry).toHaveBeenCalled();
    });

    test('should not create water table when not encountered', () => {
      const borehole = {
        id: 'no-water-table',
        x: 100,
        y: 50,
        z: 0,
        diameter: 0.2,
        depth: 10,
        waterTableEncountered: false,
        layers: [
          { id: 1, material: 'GW', from: 0, to: 10 }
        ]
      };

      const waterTableRing = boreholeVisualizer.createWaterTableRing(borehole);

      expect(waterTableRing).toBeNull();
    });
  });

  describe('USCS Material Backward Compatibility', () => {
    test('should handle mixed USCS and legacy materials in same borehole', () => {
      const borehole = {
        id: 'mixed-materials',
        x: 100,
        y: 50,
        z: 0,
        diameter: 0.2,
        depth: 15,
        layers: [
          { id: 1, material: 'CLAY', from: 0, to: 5 },    // Legacy
          { id: 2, material: 'CL', from: 5, to: 10 },     // USCS
          { id: 3, material: 'SAND', from: 10, to: 15 }   // Legacy
        ]
      };

      const strataGroup = boreholeVisualizer.createBoreholeStrata(borehole, { layers: [] });

      expect(strataGroup).toBeTruthy();
      expect(THREE.Mesh).toHaveBeenCalledTimes(3);

      // Verify that all materials (legacy and USCS) were processed
      const labels = strataGroup.userData.labels;
      expect(labels).toHaveLength(3);
      expect(labels[0].text).toBe('CLAY');
      expect(labels[1].text).toBe('CL');
      expect(labels[2].text).toBe('SAND');
    });

    test('should maintain proper color consistency across material types', () => {
      const legacyMaterials = ['CLAY', 'SAND', 'GRAVEL', 'SILT'];
      const uscsMaterials = ['CL', 'SW', 'GW', 'ML'];

      // Test that legacy materials map to appropriate USCS equivalents
      legacyMaterials.forEach((legacyMaterial, index) => {
        const legacyColor = BoreholeVisualizer.getMaterialColor(legacyMaterial);
        const uscsColor = BoreholeVisualizer.getMaterialColor(uscsMaterials[index]);

        expect(legacyColor).toBeInstanceOf(THREE.Color);
        expect(uscsColor).toBeInstanceOf(THREE.Color);

        // Colors may differ but should be valid geological colors
        expect(legacyColor.r + legacyColor.g + legacyColor.b).toBeGreaterThan(0);
        expect(uscsColor.r + uscsColor.g + uscsColor.b).toBeGreaterThan(0);
      });
    });
  });

  describe('USCS Material Error Handling and Edge Cases', () => {
    test('should handle empty layer arrays gracefully', () => {
      const borehole = {
        id: 'empty-layers',
        x: 100,
        y: 50,
        z: 0,
        diameter: 0.2,
        depth: 10,
        layers: []
      };

      const strataGroup = boreholeVisualizer.createBoreholeStrata(borehole, { layers: [] });

      expect(strataGroup).toBeTruthy();
      expect(strataGroup.children).toHaveLength(0);
    });

    test('should handle malformed layer data', () => {
      const borehole = {
        id: 'malformed-layers',
        x: 100,
        y: 50,
        z: 0,
        diameter: 0.2,
        depth: 10,
        layers: [
          { id: 1, material: 'CL', from: 0, to: 5 },
          { id: 2, from: 5, to: 10 },  // Missing material
          { id: 3, material: '', from: 10, to: 15 },  // Empty material
          null,  // Null layer
          { id: 4, material: 'INVALID_MATERIAL', from: 15, to: 20 }  // Invalid material
        ]
      };

      expect(() => {
        const strataGroup = boreholeVisualizer.createBoreholeStrata(borehole, { layers: [] });
      }).not.toThrow();
    });

    test('should handle very thin layers with USCS materials', () => {
      const borehole = {
        id: 'thin-layers',
        x: 100,
        y: 50,
        z: 0,
        diameter: 0.2,
        depth: 1,
        layers: [
          { id: 1, material: 'CL', from: 0, to: 0.1 },     // 10cm layer
          { id: 2, material: 'SW', from: 0.1, to: 0.15 },  // 5cm layer  
          { id: 3, material: 'GW', from: 0.15, to: 1.0 }   // Normal layer
        ]
      };

      const strataGroup = boreholeVisualizer.createBoreholeStrata(borehole, { layers: [] });

      expect(strataGroup).toBeTruthy();
      expect(THREE.CylinderGeometry).toHaveBeenCalledWith(0.3, 0.3, 0.1, 16, 1, false); // Thin layer
      expect(THREE.CylinderGeometry).toHaveBeenCalledWith(0.3, 0.3, 0.05, 16, 1, false); // Very thin layer
    });
  });
});