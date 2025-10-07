import { BoreholeVisualizer } from './BoreholeVisualizer';
import { textureManager } from './TextureManager';
import * as THREE from 'three';

// Mock Three.js Scene and Camera
const mockScene = {
  add: jest.fn(),
  remove: jest.fn(),
  getObjectByName: jest.fn(),
  children: []
};

const mockCamera = {
  position: { x: 0, y: 0, z: 0 },
  lookAt: jest.fn()
};

// Mock DOM for CanvasTexture
global.document = {
  createElement: jest.fn(() => ({
    width: 128,
    height: 128,
    getContext: jest.fn(() => ({
      clearRect: jest.fn(),
      fillRect: jest.fn(),
      beginPath: jest.fn(),
      moveTo: jest.fn(),
      lineTo: jest.fn(),
      arc: jest.fn(),
      ellipse: jest.fn(),
      fill: jest.fn(),
      stroke: jest.fn(),
      setLineDash: jest.fn(),
      fillStyle: '#000000',
      strokeStyle: '#000000',
      lineWidth: 1
    }))
  }))
};

describe('BoreholeVisualizer - Texture Integration', () => {
  let visualizer;
  let testBorehole;
  let textureSettings;
  let layersContext;

  beforeEach(() => {
    visualizer = new BoreholeVisualizer(mockScene, mockCamera);
    
    testBorehole = {
      id: 'test-borehole-1',
      x: 100,
      y: 0,
      z: 100,
      depth: 20,
      diameter: 0.5,
      color: '#1976D2',
      layers: [
        { id: 1, material: 'CL', topDepth: 0, bottomDepth: 5, color: '#8B4513' },
        { id: 2, material: 'SW', topDepth: 5, bottomDepth: 12, color: '#F4A460' },
        { id: 3, material: 'GW', topDepth: 12, bottomDepth: 20, color: '#8B7355' }
      ]
    };

    textureSettings = {
      enabled: true,
      globalIntensity: 0.7,
      patternScale: 1.0
    };

    layersContext = {
      layers: [
        { id: 1, name: 'Clay Layer', color: '#8B4513', material: 'CL' },
        { id: 2, name: 'Sand Layer', color: '#F4A460', material: 'SW' },
        { id: 3, name: 'Gravel Layer', color: '#8B7355', material: 'GW' }
      ]
    };

    jest.clearAllMocks();
  });

  afterEach(() => {
    visualizer.dispose && visualizer.dispose();
    textureManager.clearCache();
  });

  describe('Borehole Strata Texture Application', () => {
    test('should apply textures to borehole strata when enabled', () => {
      const strataGroup = visualizer.createBoreholeStrata(testBorehole, layersContext, textureSettings);
      
      expect(strataGroup).toBeDefined();
      expect(strataGroup.children.length).toBe(3); // Three layers
      
      // Check each layer mesh for texture application
      strataGroup.children.forEach((layerMesh, index) => {
        expect(layerMesh).toBeInstanceOf(THREE.Mesh);
        expect(layerMesh.material).toBeInstanceOf(THREE.MeshLambertMaterial);
        
        // Texture should be applied when settings are enabled
        if (textureSettings.enabled) {
          expect(layerMesh.material.map).toBeInstanceOf(THREE.CanvasTexture);
        }
      });
    });

    test('should not apply textures when settings disabled', () => {
      const disabledSettings = { ...textureSettings, enabled: false };
      const strataGroup = visualizer.createBoreholeStrata(testBorehole, layersContext, disabledSettings);
      
      expect(strataGroup).toBeDefined();
      
      // Check that no textures are applied
      strataGroup.children.forEach(layerMesh => {
        expect(layerMesh.material.map).toBeNull();
      });
    });

    test('should handle null texture settings gracefully', () => {
      const strataGroup = visualizer.createBoreholeStrata(testBorehole, layersContext, null);
      
      expect(strataGroup).toBeDefined();
      expect(strataGroup.children.length).toBe(3);
      
      // Should work without textures
      strataGroup.children.forEach(layerMesh => {
        expect(layerMesh).toBeInstanceOf(THREE.Mesh);
        expect(layerMesh.material).toBeInstanceOf(THREE.MeshLambertMaterial);
        expect(layerMesh.material.map).toBeNull();
      });
    });

    test('should apply different textures for different materials', () => {
      const strataGroup = visualizer.createBoreholeStrata(testBorehole, layersContext, textureSettings);
      
      const textures = strataGroup.children.map(mesh => mesh.material.map);
      
      // Each material should have a different texture
      expect(textures[0]).not.toBe(textures[1]); // CL vs SW
      expect(textures[1]).not.toBe(textures[2]); // SW vs GW
      expect(textures[0]).not.toBe(textures[2]); // CL vs GW
    });

    test('should use cached textures for same materials', () => {
      // Create first borehole with clay
      const borehole1 = {
        ...testBorehole,
        id: 'borehole-1',
        layers: [{ id: 1, material: 'CL', topDepth: 0, bottomDepth: 10, color: '#8B4513' }]
      };

      // Create second borehole with same clay material
      const borehole2 = {
        ...testBorehole,
        id: 'borehole-2',
        layers: [{ id: 1, material: 'CL', topDepth: 0, bottomDepth: 8, color: '#8B4513' }]
      };

      const strata1 = visualizer.createBoreholeStrata(borehole1, layersContext, textureSettings);
      const strata2 = visualizer.createBoreholeStrata(borehole2, layersContext, textureSettings);

      // Should use cached texture for same material
      const texture1 = strata1.children[0].material.map;
      const texture2 = strata2.children[0].material.map;
      expect(texture1).toBe(texture2);
    });
  });

  describe('Enhanced Borehole Marker Texture Integration', () => {
    test('should create enhanced marker with texture-enabled strata', () => {
      const marker = visualizer.createEnhancedBoreholeMarker(
        testBorehole, 
        layersContext, 
        true, // showBoreholeStrata
        true, // showWaterTable  
        textureSettings
      );

      expect(marker).toBeInstanceOf(THREE.Group);
      expect(marker.name).toBe('borehole_test-borehole-1');
      
      // Should contain strata group with textures
      const strataGroup = marker.children.find(child => 
        child.userData && child.userData.type === 'borehole_strata'
      );
      
      expect(strataGroup).toBeDefined();
      expect(strataGroup.visible).toBe(true);
      
      // Check texture application
      strataGroup.children.forEach(layerMesh => {
        if (textureSettings.enabled) {
          expect(layerMesh.material.map).toBeInstanceOf(THREE.CanvasTexture);
        }
      });
    });

    test('should respect strata visibility setting', () => {
      const marker = visualizer.createEnhancedBoreholeMarker(
        testBorehole, 
        layersContext, 
        false, // showBoreholeStrata = false
        true,  
        textureSettings
      );

      const strataGroup = marker.children.find(child => 
        child.userData && child.userData.type === 'borehole_strata'
      );
      
      expect(strataGroup).toBeDefined();
      expect(strataGroup.visible).toBe(false); // Should be hidden
    });

    test('should handle boreholes without layers', () => {
      const boreholeNoLayers = {
        ...testBorehole,
        layers: []
      };

      const marker = visualizer.createEnhancedBoreholeMarker(
        boreholeNoLayers, 
        layersContext, 
        true, 
        true, 
        textureSettings
      );

      expect(marker).toBeInstanceOf(THREE.Group);
      
      // Should not contain strata group
      const strataGroup = marker.children.find(child => 
        child.userData && child.userData.type === 'borehole_strata'
      );
      
      expect(strataGroup).toBeUndefined();
    });
  });

  describe('Texture Settings Parameter Handling', () => {
    test('should apply different intensity settings', () => {
      const lowIntensity = { ...textureSettings, globalIntensity: 0.3 };
      const highIntensity = { ...textureSettings, globalIntensity: 1.0 };

      const strata1 = visualizer.createBoreholeStrata(testBorehole, layersContext, lowIntensity);
      const strata2 = visualizer.createBoreholeStrata(testBorehole, layersContext, highIntensity);

      // Should create different textures due to different intensity
      const texture1 = strata1.children[0].material.map;
      const texture2 = strata2.children[0].material.map;
      expect(texture1).not.toBe(texture2);
    });

    test('should apply different scale settings', () => {
      const smallScale = { ...textureSettings, patternScale: 0.5 };
      const largeScale = { ...textureSettings, patternScale: 2.0 };

      const strata1 = visualizer.createBoreholeStrata(testBorehole, layersContext, smallScale);
      const strata2 = visualizer.createBoreholeStrata(testBorehole, layersContext, largeScale);

      // Should create different textures due to different scale
      const texture1 = strata1.children[0].material.map;
      const texture2 = strata2.children[0].material.map;
      expect(texture1).not.toBe(texture2);
    });

    test('should handle missing texture settings properties', () => {
      const partialSettings = { enabled: true }; // Missing intensity and scale

      const strataGroup = visualizer.createBoreholeStrata(testBorehole, layersContext, partialSettings);
      
      expect(strataGroup).toBeDefined();
      
      // Should still apply textures with default values
      strataGroup.children.forEach(layerMesh => {
        expect(layerMesh.material.map).toBeInstanceOf(THREE.CanvasTexture);
      });
    });
  });

  describe('Material Color and Texture Coordination', () => {
    test('should coordinate base color with texture pattern', () => {
      const strataGroup = visualizer.createBoreholeStrata(testBorehole, layersContext, textureSettings);
      
      strataGroup.children.forEach((layerMesh, index) => {
        const layer = testBorehole.layers[index];
        
        // Material should have base color
        expect(layerMesh.material.color).toBeInstanceOf(THREE.Color);
        
        // Texture should be applied on top of base color
        if (textureSettings.enabled) {
          expect(layerMesh.material.map).toBeInstanceOf(THREE.CanvasTexture);
          
          // Texture metadata should match material
          expect(layerMesh.material.map.userData.materialType).toBe(layer.material.toLowerCase());
        }
      });
    });

    test('should handle unknown material types gracefully', () => {
      const boreholeUnknownMaterial = {
        ...testBorehole,
        layers: [
          { id: 1, material: 'UNKNOWN', topDepth: 0, bottomDepth: 10, color: '#888888' }
        ]
      };

      const strataGroup = visualizer.createBoreholeStrata(boreholeUnknownMaterial, layersContext, textureSettings);
      
      expect(strataGroup).toBeDefined();
      expect(strataGroup.children.length).toBe(1);
      
      const layerMesh = strataGroup.children[0];
      expect(layerMesh.material.map).toBeInstanceOf(THREE.CanvasTexture);
      
      // Should fall back to clay pattern for unknown materials
      expect(layerMesh.material.map.userData.materialType).toBe('unknown');
    });
  });

  describe('Layer Context Integration', () => {
    test('should use global layer information when available', () => {
      const strataGroup = visualizer.createBoreholeStrata(testBorehole, layersContext, textureSettings);
      
      expect(strataGroup).toBeDefined();
      expect(strataGroup.children.length).toBe(3);
      
      // Should create strata for all borehole layers
      strataGroup.children.forEach((layerMesh, index) => {
        expect(layerMesh).toBeInstanceOf(THREE.Mesh);
        expect(layerMesh.material).toBeInstanceOf(THREE.MeshLambertMaterial);
      });
    });

    test('should handle missing layer context', () => {
      const strataGroup = visualizer.createBoreholeStrata(testBorehole, null, textureSettings);
      
      expect(strataGroup).toBeDefined();
      expect(strataGroup.children.length).toBe(3);
      
      // Should still create strata using borehole layer data
      strataGroup.children.forEach(layerMesh => {
        expect(layerMesh).toBeInstanceOf(THREE.Mesh);
        if (textureSettings.enabled) {
          expect(layerMesh.material.map).toBeInstanceOf(THREE.CanvasTexture);
        }
      });
    });

    test('should handle empty layer context', () => {
      const emptyContext = { layers: [] };
      const strataGroup = visualizer.createBoreholeStrata(testBorehole, emptyContext, textureSettings);
      
      expect(strataGroup).toBeDefined();
      expect(strataGroup.children.length).toBe(3);
      
      // Should use borehole layer data directly
      strataGroup.children.forEach(layerMesh => {
        expect(layerMesh).toBeInstanceOf(THREE.Mesh);
      });
    });
  });

  describe('Performance and Memory Management', () => {
    test('should reuse geometry from pool', () => {
      // Create multiple boreholes with same dimensions
      const borehole1 = { ...testBorehole, id: 'bh1' };
      const borehole2 = { ...testBorehole, id: 'bh2' };

      const strata1 = visualizer.createBoreholeStrata(borehole1, layersContext, textureSettings);
      const strata2 = visualizer.createBoreholeStrata(borehole2, layersContext, textureSettings);

      // Geometries should be reused from pool (same radius/height)
      const geo1 = strata1.children[0].geometry;
      const geo2 = strata2.children[0].geometry;
      expect(geo1).toBe(geo2); // Same geometry instance from pool
    });

    test('should dispose of resources properly', () => {
      const strataGroup = visualizer.createBoreholeStrata(testBorehole, layersContext, textureSettings);
      
      // Track texture references
      const textures = strataGroup.children.map(mesh => mesh.material.map);
      
      // All textures should be valid
      textures.forEach(texture => {
        expect(texture).toBeInstanceOf(THREE.CanvasTexture);
        expect(texture.userData).toBeDefined();
      });

      // Dispose should work without errors
      if (visualizer.dispose) {
        expect(() => visualizer.dispose()).not.toThrow();
      }
    });

    test('should handle large numbers of layers efficiently', () => {
      const manyLayersBorehole = {
        ...testBorehole,
        layers: Array.from({ length: 20 }, (_, i) => ({
          id: i + 1,
          material: ['CL', 'SW', 'GW', 'ML', 'OL'][i % 5],
          topDepth: i * 2,
          bottomDepth: (i + 1) * 2,
          color: '#888888'
        }))
      };

      const start = performance.now();
      const strataGroup = visualizer.createBoreholeStrata(manyLayersBorehole, layersContext, textureSettings);
      const end = performance.now();

      expect(strataGroup).toBeDefined();
      expect(strataGroup.children.length).toBe(20);
      
      // Should complete in reasonable time (< 1 second)
      expect(end - start).toBeLessThan(1000);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle invalid borehole data', () => {
      const invalidBorehole = {
        id: 'invalid',
        x: 0, y: 0, z: 0,
        depth: 0,
        layers: null
      };

      expect(() => {
        visualizer.createBoreholeStrata(invalidBorehole, layersContext, textureSettings);
      }).not.toThrow();
    });

    test('should handle texture creation failures gracefully', () => {
      // Mock texture manager to simulate failure
      const originalCreateTexture = textureManager.createSoilTexture;
      textureManager.createSoilTexture = jest.fn(() => null);

      const strataGroup = visualizer.createBoreholeStrata(testBorehole, layersContext, textureSettings);
      
      expect(strataGroup).toBeDefined();
      expect(strataGroup.children.length).toBe(3);
      
      // Should still create meshes without textures
      strataGroup.children.forEach(layerMesh => {
        expect(layerMesh).toBeInstanceOf(THREE.Mesh);
        expect(layerMesh.material.map).toBeNull();
      });

      // Restore original method
      textureManager.createSoilTexture = originalCreateTexture;
    });

    test('should handle empty or malformed layer data', () => {
      const malformedBorehole = {
        ...testBorehole,
        layers: [
          { /* missing properties */ },
          { id: 2, material: '', topDepth: 5, bottomDepth: 5 }, // zero thickness
          { id: 3, material: 'INVALID', topDepth: 10, bottomDepth: 8 } // invalid depths
        ]
      };

      expect(() => {
        const strataGroup = visualizer.createBoreholeStrata(malformedBorehole, layersContext, textureSettings);
        expect(strataGroup).toBeDefined();
      }).not.toThrow();
    });
  });
});