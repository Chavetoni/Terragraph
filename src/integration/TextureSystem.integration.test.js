/**
 * Comprehensive integration tests for the complete texture scaling system
 * Tests the interaction between TextureManager, BoreholeVisualizer, VolumetricMeshGenerator, and UI controls
 */

import { TextureManager, textureManager } from '../services/TextureManager';
import { BoreholeVisualizer } from '../services/BoreholeVisualizer';
import { VolumetricMeshGenerator } from '../services/VolumetricMeshGenerator';
import * as THREE from 'three';

// Mock DOM environment
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

// Mock Three.js scene
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

describe('Texture System Integration Tests', () => {
  let visualizer;
  let testBorehole;
  let textureSettings;
  let layersContext;
  let volumeData;

  beforeEach(() => {
    visualizer = new BoreholeVisualizer(mockScene, mockCamera);
    
    // Comprehensive test borehole with multiple materials
    testBorehole = {
      id: 'integration-test-borehole',
      x: 100,
      y: 0,
      z: 100,
      depth: 25,
      diameter: 0.6,
      color: '#1976D2',
      layers: [
        { id: 1, material: 'CL', topDepth: 0, bottomDepth: 3, color: '#8B4513' },
        { id: 2, material: 'SW', topDepth: 3, bottomDepth: 8, color: '#F4A460' },
        { id: 3, material: 'GW', topDepth: 8, bottomDepth: 15, color: '#8B7355' },
        { id: 4, material: 'ML', topDepth: 15, bottomDepth: 20, color: '#9ACD32' },
        { id: 5, material: 'OL', topDepth: 20, bottomDepth: 25, color: '#654321' }
      ]
    };

    // Base texture settings
    textureSettings = {
      enabled: true,
      globalIntensity: 0.7,
      patternScale: 1.0
    };

    layersContext = {
      layers: [
        { id: 1, name: 'Clay Layer', color: '#8B4513', material: 'CL' },
        { id: 2, name: 'Sand Layer', color: '#F4A460', material: 'SW' },
        { id: 3, name: 'Gravel Layer', color: '#8B7355', material: 'GW' },
        { id: 4, name: 'Silt Layer', color: '#9ACD32', material: 'ML' },
        { id: 5, name: 'Organic Layer', color: '#654321', material: 'OL' }
      ]
    };

    // Test volume data for VolumetricMeshGenerator
    volumeData = {
      vertices: [
        0, 0, 0, 10, 0, 0, 5, 10, 0, 5, 5, 10
      ],
      indices: [0, 1, 2, 0, 1, 3, 1, 2, 3, 0, 2, 3],
      material: 'CL',
      color: '#8B4513',
      volume: 150.5,
      confidence: 0.88
    };

    jest.clearAllMocks();
    textureManager.clearCache();
  });

  afterEach(() => {
    textureManager.clearCache();
  });

  describe('Cross-Component Texture Consistency', () => {
    test('should use same texture instance across BoreholeVisualizer and VolumetricMeshGenerator', () => {
      // Create borehole strata
      const strataGroup = visualizer.createBoreholeStrata(testBorehole, layersContext, textureSettings);
      const clayStrataTexture = strataGroup.children[0].material.map; // First layer is CL
      
      // Create volumetric mesh with same material
      const mesh = VolumetricMeshGenerator.createThreeJsMesh(
        volumeData,
        { opacity: 0.8 },
        null,
        textureSettings
      );
      const clayVolumeTexture = mesh.material.map;
      
      // Should be the same cached texture instance
      expect(clayStrataTexture).toBe(clayVolumeTexture);
      
      // Verify cache efficiency
      const stats = textureManager.getCacheStats();
      expect(stats.hits).toBeGreaterThan(0);
    });

    test('should maintain consistent scaling across all components', () => {
      const scales = [0.5, 1.0, 1.5, 2.0];
      const allTextures = new Map();
      
      scales.forEach(scale => {
        const settings = { ...textureSettings, patternScale: scale };
        
        // Create textures from different components
        const strataGroup = visualizer.createBoreholeStrata(testBorehole, layersContext, settings);
        const clayStrataTexture = strataGroup.children[0].material.map;
        
        const mesh = VolumetricMeshGenerator.createThreeJsMesh(
          volumeData,
          { opacity: 0.8 },
          null,
          settings
        );
        const clayVolumeTexture = mesh.material.map;
        
        // Should be the same texture for same scale
        expect(clayStrataTexture).toBe(clayVolumeTexture);
        
        // Store for comparison
        allTextures.set(scale, clayStrataTexture);
      });
      
      // All scales should produce different textures
      const textureInstances = Array.from(allTextures.values());
      const uniqueTextures = new Set(textureInstances);
      expect(uniqueTextures.size).toBe(scales.length);
    });

    test('should handle material changes consistently across components', () => {
      const materials = ['CL', 'SW', 'GW', 'ML', 'OL'];
      const componentTextures = new Map();
      
      materials.forEach(material => {
        // Test with borehole
        const testLayer = { id: 1, material, topDepth: 0, bottomDepth: 10, color: '#888888' };
        const boreholeWithMaterial = { ...testBorehole, layers: [testLayer] };
        const strataGroup = visualizer.createBoreholeStrata(boreholeWithMaterial, layersContext, textureSettings);
        const strataTexture = strataGroup.children[0].material.map;
        
        // Test with volume
        const volumeWithMaterial = { ...volumeData, material };
        const mesh = VolumetricMeshGenerator.createThreeJsMesh(
          volumeWithMaterial,
          { opacity: 0.8 },
          null,
          textureSettings
        );
        const volumeTexture = mesh.material.map;
        
        // Should be same texture for same material
        expect(strataTexture).toBe(volumeTexture);
        componentTextures.set(material, strataTexture);
      });
      
      // All materials should have different textures
      const allTextures = Array.from(componentTextures.values());
      const uniqueTextures = new Set(allTextures);
      expect(uniqueTextures.size).toBe(materials.length);
    });
  });

  describe('Pattern Scale Validation - No Tiling Artifacts', () => {
    test('should eliminate 4x4 tiling patterns with element-based scaling', () => {
      const problematicScales = [0.25, 0.5, 1.0, 2.0, 4.0]; // Values that could cause tiling
      
      problematicScales.forEach(scale => {
        const settings = { ...textureSettings, patternScale: scale };
        
        // Test with all material types that had tiling issues
        ['CL', 'SW', 'GW'].forEach(material => {
          const volumeWithMaterial = { ...volumeData, material };
          const mesh = VolumetricMeshGenerator.createThreeJsMesh(
            volumeWithMaterial,
            { opacity: 0.8 },
            null,
            settings
          );
          
          expect(mesh.material.map).toBeInstanceOf(THREE.CanvasTexture);
          
          // Texture should have proper repeat settings (1,1 for element-based scaling)
          expect(mesh.material.map.repeat.x).toBe(1);
          expect(mesh.material.map.repeat.y).toBe(1);
          
          // Texture metadata should reflect correct scale
          expect(mesh.material.map.userData.settings.patternScale).toBe(scale);
        });
      });
    });

    test('should produce visually different patterns at different scales', () => {
      const scales = [0.5, 1.0, 2.0];
      const patternResults = new Map();
      
      scales.forEach(scale => {
        const settings = { ...textureSettings, patternScale: scale };
        
        // Clear mocks to capture pattern generation calls
        jest.clearAllMocks();
        
        const texture = textureManager.createSoilTexture('CL', '#8B4513', settings);
        
        // Capture pattern generation parameters
        const params = textureManager.calculatePatternParameters(settings);
        patternResults.set(scale, {
          texture,
          spacing: params.spacing,
          elementSize: params.elementSize,
          lineWidth: params.lineWidth
        });
      });
      
      // Verify patterns scale proportionally
      const scale05 = patternResults.get(0.5);
      const scale10 = patternResults.get(1.0);
      const scale20 = patternResults.get(2.0);
      
      expect(scale05.spacing).toBeLessThan(scale10.spacing);
      expect(scale10.spacing).toBeLessThan(scale20.spacing);
      
      expect(scale05.elementSize).toBeLessThan(scale10.elementSize);
      expect(scale10.elementSize).toBeLessThan(scale20.elementSize);
      
      // Should be different texture instances
      expect(scale05.texture).not.toBe(scale10.texture);
      expect(scale10.texture).not.toBe(scale20.texture);
    });

    test('should maintain pattern coherence across intensity changes', () => {
      const intensities = [0.3, 0.5, 0.7, 1.0];
      const fixedScale = 1.5;
      
      intensities.forEach(intensity => {
        const settings = { 
          enabled: true,
          globalIntensity: intensity, 
          patternScale: fixedScale 
        };
        
        const texture = textureManager.createSoilTexture('SW', '#F4A460', settings);
        expect(texture).toBeInstanceOf(THREE.CanvasTexture);
        
        const params = textureManager.calculatePatternParameters(settings);
        
        // Scale should remain constant
        expect(params.scale).toBe(fixedScale);
        
        // Intensity should be applied correctly
        expect(params.intensity).toBe(intensity);
        
        // Spacing should be consistent (not affected by intensity)
        expect(params.spacing).toBe(Math.max(6, Math.round(16 * fixedScale)));
      });
    });
  });

  describe('USCS Material Support Integration', () => {
    test('should support all USCS codes across all components', () => {
      const uscsCodes = [
        'GW', 'GP', 'GM', 'GC', // Gravel
        'SW', 'SP', 'SM', 'SC', // Sand  
        'ML', 'MH',             // Silt
        'CL', 'CH',             // Clay
        'OL', 'OH', 'PT'        // Organic
      ];
      
      uscsCodes.forEach(uscsCode => {
        // Test with BoreholeVisualizer
        const testLayer = { id: 1, material: uscsCode, topDepth: 0, bottomDepth: 10, color: '#888888' };
        const boreholeWithUSCS = { ...testBorehole, layers: [testLayer] };
        const strataGroup = visualizer.createBoreholeStrata(boreholeWithUSCS, layersContext, textureSettings);
        
        expect(strataGroup.children.length).toBe(1);
        expect(strataGroup.children[0].material.map).toBeInstanceOf(THREE.CanvasTexture);
        expect(strataGroup.children[0].material.map.userData.materialType).toBe(uscsCode.toLowerCase());
        
        // Test with VolumetricMeshGenerator
        const volumeWithUSCS = { ...volumeData, material: uscsCode };
        const mesh = VolumetricMeshGenerator.createThreeJsMesh(
          volumeWithUSCS,
          { opacity: 0.8 },
          null,
          textureSettings
        );
        
        expect(mesh.material.map).toBeInstanceOf(THREE.CanvasTexture);
        expect(mesh.material.map.userData.materialType).toBe(uscsCode.toLowerCase());
        
        // Should use same cached texture
        expect(strataGroup.children[0].material.map).toBe(mesh.material.map);
      });
    });

    test('should map USCS families to correct patterns', () => {
      const uscsToPatternExpected = {
        'GW': 'gravel', 'GP': 'gravel', 'GM': 'gravel', 'GC': 'gravel',
        'SW': 'sand', 'SP': 'sand', 'SM': 'sand', 'SC': 'sand',
        'ML': 'silt', 'MH': 'silt',
        'CL': 'clay', 'CH': 'clay',
        'OL': 'organic', 'OH': 'organic', 'PT': 'organic'
      };
      
      Object.entries(uscsToPatternExpected).forEach(([uscsCode, expectedPattern]) => {
        const patternType = textureManager.getPatternType(uscsCode);
        expect(patternType).toBe(expectedPattern);
        
        // Create texture and verify it works
        const texture = textureManager.createSoilTexture(uscsCode, '#888888', textureSettings);
        expect(texture).toBeInstanceOf(THREE.CanvasTexture);
        expect(texture.userData.materialType).toBe(uscsCode.toLowerCase());
      });
    });
  });

  describe('Performance Integration', () => {
    test('should maintain performance with complex geological models', () => {
      // Create a complex borehole with many layers
      const complexBorehole = {
        ...testBorehole,
        layers: Array.from({ length: 15 }, (_, i) => ({
          id: i + 1,
          material: ['CL', 'SW', 'GW', 'ML', 'OL'][i % 5],
          topDepth: i * 2,
          bottomDepth: (i + 1) * 2,
          color: '#888888'
        }))
      };
      
      const start = performance.now();
      
      // Create multiple complex visualizations
      for (let i = 0; i < 5; i++) {
        const strataGroup = visualizer.createBoreholeStrata(complexBorehole, layersContext, textureSettings);
        expect(strataGroup.children.length).toBe(15);
        
        // Each layer should have proper texture
        strataGroup.children.forEach(layerMesh => {
          expect(layerMesh.material.map).toBeInstanceOf(THREE.CanvasTexture);
        });
      }
      
      const end = performance.now();
      
      // Should complete efficiently due to caching
      expect(end - start).toBeLessThan(1000); // < 1 second
      
      // Should have high cache hit ratio
      const stats = textureManager.getCacheStats();
      const hitRatio = stats.hits / (stats.hits + stats.misses);
      expect(hitRatio).toBeGreaterThan(0.8); // > 80% hit ratio
    });

    test('should handle mixed component usage efficiently', () => {
      const materials = ['CL', 'SW', 'GW'];
      const scales = [0.5, 1.0, 1.5, 2.0];
      
      const start = performance.now();
      
      // Simulate mixed usage pattern
      materials.forEach(material => {
        scales.forEach(scale => {
          const settings = { ...textureSettings, patternScale: scale };
          
          // Create via BoreholeVisualizer
          const testLayer = { id: 1, material, topDepth: 0, bottomDepth: 10, color: '#888888' };
          const boreholeWithMaterial = { ...testBorehole, layers: [testLayer] };
          const strataGroup = visualizer.createBoreholeStrata(boreholeWithMaterial, layersContext, settings);
          
          // Create via VolumetricMeshGenerator
          const volumeWithMaterial = { ...volumeData, material };
          const mesh = VolumetricMeshGenerator.createThreeJsMesh(
            volumeWithMaterial,
            { opacity: 0.8 },
            null,
            settings
          );
          
          // Should be same cached texture
          expect(strataGroup.children[0].material.map).toBe(mesh.material.map);
        });
      });
      
      const end = performance.now();
      
      expect(end - start).toBeLessThan(2000); // < 2 seconds for all combinations
      
      // Verify efficient caching
      const stats = textureManager.getCacheStats();
      expect(stats.size).toBe(materials.length * scales.length); // One texture per material-scale combo
    });
  });

  describe('Error Handling Integration', () => {
    test('should handle texture creation failures gracefully across components', () => {
      // Mock texture manager to fail occasionally
      let callCount = 0;
      const originalCreateTexture = textureManager.createSoilTexture;
      textureManager.createSoilTexture = jest.fn((material, color, settings) => {
        callCount++;
        if (callCount % 3 === 0) {
          return null; // Simulate failure
        }
        return originalCreateTexture.call(textureManager, material, color, settings);
      });
      
      // Test BoreholeVisualizer
      const strataGroup = visualizer.createBoreholeStrata(testBorehole, layersContext, textureSettings);
      expect(strataGroup).toBeDefined();
      expect(strataGroup.children.length).toBe(5);
      
      // Some should have textures, some shouldn't due to failures
      strataGroup.children.forEach(layerMesh => {
        expect(layerMesh).toBeInstanceOf(THREE.Mesh);
        // May or may not have texture depending on failure simulation
      });
      
      // Test VolumetricMeshGenerator
      const mesh = VolumetricMeshGenerator.createThreeJsMesh(
        volumeData,
        { opacity: 0.8 },
        null,
        textureSettings
      );
      
      expect(mesh).toBeInstanceOf(THREE.Mesh);
      // May or may not have texture depending on failure simulation
      
      // Restore original
      textureManager.createSoilTexture = originalCreateTexture;
    });

    test('should handle malformed settings consistently', () => {
      const malformedSettings = [
        null,
        undefined,
        { enabled: 'yes' },
        { globalIntensity: 'high', patternScale: 'large' },
        { globalIntensity: NaN, patternScale: Infinity }
      ];
      
      malformedSettings.forEach(settings => {
        // Should not throw in any component
        expect(() => {
          const strataGroup = visualizer.createBoreholeStrata(testBorehole, layersContext, settings);
          expect(strataGroup).toBeDefined();
        }).not.toThrow();
        
        expect(() => {
          const mesh = VolumetricMeshGenerator.createThreeJsMesh(
            volumeData,
            { opacity: 0.8 },
            null,
            settings
          );
          expect(mesh).toBeInstanceOf(THREE.Mesh);
        }).not.toThrow();
      });
    });
  });

  describe('Memory Management Integration', () => {
    test('should properly dispose of textures when components are disposed', () => {
      // Create many textures through components
      const textures = [];
      
      for (let i = 0; i < 10; i++) {
        const strataGroup = visualizer.createBoreholeStrata(testBorehole, layersContext, textureSettings);
        strataGroup.children.forEach(layerMesh => {
          if (layerMesh.material.map) {
            textures.push(layerMesh.material.map);
          }
        });
      }
      
      expect(textures.length).toBeGreaterThan(0);
      
      // Clear cache should dispose textures
      textureManager.clearCache();
      
      // Cache should be empty
      expect(textureManager.getCacheStats().size).toBe(0);
    });

    test('should handle cache eviction during mixed component usage', () => {
      // Set small cache for testing
      textureManager.maxCacheSize = 3;
      
      const materials = ['CL', 'SW', 'GW', 'ML', 'OL', 'CH', 'SP'];
      
      materials.forEach(material => {
        // Create via both components
        const testLayer = { id: 1, material, topDepth: 0, bottomDepth: 10, color: '#888888' };
        const boreholeWithMaterial = { ...testBorehole, layers: [testLayer] };
        const strataGroup = visualizer.createBoreholeStrata(boreholeWithMaterial, layersContext, textureSettings);
        
        const volumeWithMaterial = { ...volumeData, material };
        const mesh = VolumetricMeshGenerator.createThreeJsMesh(
          volumeWithMaterial,
          { opacity: 0.8 },
          null,
          textureSettings
        );
        
        // Should still be the same texture despite cache pressure
        expect(strataGroup.children[0].material.map).toBe(mesh.material.map);
      });
      
      // Cache should not exceed limit
      expect(textureManager.getCacheStats().size).toBeLessThanOrEqual(3);
    });
  });
});