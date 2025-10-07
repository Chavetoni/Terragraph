/**
 * Integration test to verify texture optimization implementation
 * Tests the interaction between BoreholeVisualizer, VolumetricMeshGenerator, and TextureManager
 */
import { BoreholeVisualizer } from './BoreholeVisualizer';
import { VolumetricMeshGenerator } from './VolumetricMeshGenerator';
import { textureManager } from './TextureManager';
import * as THREE from 'three';

// Mock scene for testing
const mockScene = {
  add: jest.fn(),
  remove: jest.fn(),
  getObjectByName: jest.fn()
};

// Mock camera for testing
const mockCamera = {
  position: { x: 0, y: 0, z: 0 },
  lookAt: jest.fn()
};

describe('Texture System Integration', () => {
  afterEach(() => {
    // Clear texture cache between tests
    textureManager.clearCache();
  });

  describe('TextureManager Integration', () => {
    test('should be properly imported and instantiated', () => {
      expect(textureManager).toBeDefined();
      expect(typeof textureManager.createSoilTexture).toBe('function');
      expect(typeof textureManager.getCacheStats).toBe('function');
    });

    test('should handle cache statistics correctly', () => {
      const initialStats = textureManager.getCacheStats();
      expect(initialStats.hits).toBe(0);
      expect(initialStats.misses).toBe(0);
      expect(initialStats.size).toBe(0);
    });

    test('should normalize material types correctly', () => {
      expect(textureManager.normalizeMaterialType('CLAY')).toBe('clay');
      expect(textureManager.normalizeMaterialType('Clay')).toBe('clay');
      expect(textureManager.normalizeMaterialType(null)).toBe('clay');
      expect(textureManager.normalizeMaterialType('')).toBe('clay');
    });

    test('should normalize colors consistently', () => {
      expect(textureManager.normalizeColor('#FF0000')).toBe('#ff0000');
      expect(textureManager.normalizeColor('#ff0000')).toBe('#ff0000');
      expect(textureManager.normalizeColor('rgb(255, 0, 0)')).toBe('#ff0000');
      expect(textureManager.normalizeColor(null)).toBe('#888888');
    });
  });

  describe('BoreholeVisualizer Integration', () => {
    let visualizer;

    beforeEach(() => {
      visualizer = new BoreholeVisualizer(mockScene, mockCamera);
    });

    afterEach(() => {
      visualizer.dispose();
    });

    test('should create BoreholeVisualizer without texture creation methods', () => {
      expect(visualizer).toBeDefined();
      expect(visualizer.createSimpleSoilTexture).toBeUndefined();
      expect(visualizer.createHighContrastSoilTexture).toBeUndefined();
    });

    test('should maintain geometry pooling functionality', () => {
      expect(visualizer.geometryPool).toBeDefined();
      expect(visualizer.geometryPool.getCylinder).toBeDefined();
      expect(visualizer.geometryPool.getSphere).toBeDefined();
      expect(visualizer.geometryPool.getCone).toBeDefined();
    });

    test('should handle texture cache and material cache', () => {
      expect(visualizer.textureCache).toBeDefined();
      expect(visualizer.materialCache).toBeDefined();
    });
  });

  describe('VolumetricMeshGenerator Integration', () => {
    test('should use TextureManager for texture creation', () => {
      // VolumetricMeshGenerator should not have its own texture creation
      expect(VolumetricMeshGenerator.createSimpleSoilTexture).toBeUndefined();
      
      // Check that deprecated methods are properly marked
      expect(VolumetricMeshGenerator.getDefaultPattern).toBeDefined();
    });

    test('should handle material color extraction', () => {
      // Test the getMaterialColor method still works
      const color = VolumetricMeshGenerator.getMaterialColor('clay');
      expect(color).toBeDefined();
      expect(typeof color).toBe('number');
    });
  });

  describe('Texture Scaling Consistency', () => {
    const testMaterials = ['clay', 'sand', 'gravel', 'rock', 'silt'];
    const testColors = ['#8B4513', '#F4A460', '#A0522D'];
    const testScales = [0.5, 1.0, 1.5, 2.0];

    test('should apply consistent scaling across all material types', () => {
      testMaterials.forEach(material => {
        testScales.forEach(scale => {
          const params = textureManager.calculatePatternParameters({
            globalIntensity: 0.7,
            patternScale: scale
          });

          expect(params.scale).toBe(scale);
          expect(params.spacing).toBeGreaterThan(0);
          expect(params.elementSize).toBeGreaterThan(0);
          
          // Larger scale should result in larger spacing and elements
          if (scale > 1.0) {
            const baseParams = textureManager.calculatePatternParameters({
              globalIntensity: 0.7,
              patternScale: 1.0
            });
            expect(params.spacing).toBeGreaterThan(baseParams.spacing);
            expect(params.elementSize).toBeGreaterThan(baseParams.elementSize);
          }
        });
      });
    });

    test('should clamp scale values properly', () => {
      const params1 = textureManager.calculatePatternParameters({
        globalIntensity: 0.7,
        patternScale: 0.1 // Should be clamped to 0.5
      });
      expect(params1.scale).toBe(0.5);

      const params2 = textureManager.calculatePatternParameters({
        globalIntensity: 0.7,
        patternScale: 10.0 // Should be clamped to 2.5
      });
      expect(params2.scale).toBe(2.5);
    });

    test('should generate deterministic patterns', () => {
      const particles1 = textureManager.generateDeterministicParticles(8, 16);
      const particles2 = textureManager.generateDeterministicParticles(8, 16);
      
      expect(particles1).toEqual(particles2);
      expect(particles1.length).toBe(8);
      
      particles1.forEach(particle => {
        expect(particle.x).toBeGreaterThanOrEqual(0);
        expect(particle.y).toBeGreaterThanOrEqual(0);
        expect(particle.size).toBeGreaterThan(0);
      });
    });
  });

  describe('Performance Optimizations', () => {
    test('should have performance monitoring capabilities', () => {
      expect(textureManager.getCacheStats).toBeDefined();
      
      const stats = textureManager.getCacheStats();
      expect(stats).toHaveProperty('hits');
      expect(stats).toHaveProperty('misses');
      expect(stats).toHaveProperty('size');
    });

    test('should manage cache size effectively', () => {
      const originalMaxSize = textureManager.maxCacheSize;
      textureManager.maxCacheSize = 2;

      // Generate more textures than cache can hold
      textureManager.createSoilTexture('clay', '#8B4513', { globalIntensity: 0.7 });
      textureManager.createSoilTexture('sand', '#F4A460', { globalIntensity: 0.7 });
      textureManager.createSoilTexture('gravel', '#A0522D', { globalIntensity: 0.7 });

      const stats = textureManager.getCacheStats();
      expect(stats.size).toBeLessThanOrEqual(2);

      // Restore original max size
      textureManager.maxCacheSize = originalMaxSize;
    });

    test('should dispose of resources properly', () => {
      textureManager.createSoilTexture('clay', '#8B4513', { globalIntensity: 0.7 });
      
      const statsBefore = textureManager.getCacheStats();
      expect(statsBefore.size).toBeGreaterThan(0);
      
      textureManager.dispose();
      
      const statsAfter = textureManager.getCacheStats();
      expect(statsAfter.size).toBe(0);
      expect(statsAfter.hits).toBe(0);
      expect(statsAfter.misses).toBe(0);
    });
  });

  describe('Backward Compatibility', () => {
    test('should maintain existing API compatibility', () => {
      // BoreholeVisualizer should still work with existing interface
      const visualizer = new BoreholeVisualizer(mockScene, mockCamera);
      expect(visualizer).toBeDefined();
      expect(visualizer.createEnhancedBoreholeMarker).toBeDefined();
      expect(visualizer.dispose).toBeDefined();
      
      visualizer.dispose();
    });

    test('should handle legacy material types', () => {
      const legacyTypes = ['clay', 'sand', 'gravel', 'rock', 'silt', 'organic', 'fill'];
      
      legacyTypes.forEach(type => {
        expect(() => {
          textureManager.createSoilTexture(type, '#888888', { globalIntensity: 0.7 });
        }).not.toThrow();
      });
    });

    test('should handle USCS material codes', () => {
      const uscsCodes = ['CL', 'SW', 'GW', 'CH', 'SM', 'GP'];
      
      uscsCodes.forEach(code => {
        expect(() => {
          textureManager.createSoilTexture(code, '#888888', { globalIntensity: 0.7 });
        }).not.toThrow();
      });
    });
  });
});