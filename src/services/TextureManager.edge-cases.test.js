import { TextureManager, textureManager } from './TextureManager';
import * as THREE from 'three';

// Mock DOM APIs with potential failure scenarios
const createMockContext = (shouldFail = false) => ({
  clearRect: shouldFail ? jest.fn(() => { throw new Error('Canvas operation failed'); }) : jest.fn(),
  fillRect: shouldFail ? jest.fn(() => { throw new Error('Canvas operation failed'); }) : jest.fn(),
  beginPath: jest.fn(),
  moveTo: jest.fn(),
  lineTo: jest.fn(),
  arc: shouldFail ? jest.fn(() => { throw new Error('Arc operation failed'); }) : jest.fn(),
  ellipse: jest.fn(),
  fill: jest.fn(),
  stroke: jest.fn(),
  closePath: jest.fn(),
  setLineDash: jest.fn(),
  fillStyle: '#000000',
  strokeStyle: '#000000',
  lineWidth: 1
});

const createMockCanvas = (shouldFail = false) => ({
  width: 128,
  height: 128,
  getContext: jest.fn(() => shouldFail ? null : createMockContext(shouldFail))
});

describe('TextureManager - Edge Cases and Error Handling', () => {
  let manager;

  beforeEach(() => {
    manager = new TextureManager();
    
    // Reset global document mock
    global.document = {
      createElement: jest.fn(() => createMockCanvas(false))
    };
    
    jest.clearAllMocks();
  });

  afterEach(() => {
    manager.dispose();
  });

  describe('Invalid Input Handling', () => {
    test('should handle null material type', () => {
      const texture = manager.createSoilTexture(null, '#8B4513', {
        globalIntensity: 0.7,
        patternScale: 1.0
      });

      expect(texture).toBeInstanceOf(THREE.CanvasTexture);
      expect(texture.userData.materialType).toBe('clay'); // Should default to clay
    });

    test('should handle undefined material type', () => {
      const texture = manager.createSoilTexture(undefined, '#8B4513', {
        globalIntensity: 0.7,
        patternScale: 1.0
      });

      expect(texture).toBeInstanceOf(THREE.CanvasTexture);
      expect(texture.userData.materialType).toBe('clay'); // Should default to clay
    });

    test('should handle empty string material type', () => {
      const texture = manager.createSoilTexture('', '#8B4513', {
        globalIntensity: 0.7,
        patternScale: 1.0
      });

      expect(texture).toBeInstanceOf(THREE.CanvasTexture);
      expect(texture.userData.materialType).toBe('clay'); // Should default to clay
    });

    test('should handle non-string material type', () => {
      const invalidInputs = [123, {}, [], true, Symbol('test')];
      
      invalidInputs.forEach(input => {
        const texture = manager.createSoilTexture(input, '#8B4513', {
          globalIntensity: 0.7,
          patternScale: 1.0
        });

        expect(texture).toBeInstanceOf(THREE.CanvasTexture);
        expect(texture.userData.materialType).toBe(String(input).toLowerCase());
      });
    });

    test('should handle null base color', () => {
      const texture = manager.createSoilTexture('clay', null, {
        globalIntensity: 0.7,
        patternScale: 1.0
      });

      expect(texture).toBeInstanceOf(THREE.CanvasTexture);
      // Should use default color
    });

    test('should handle invalid color formats', () => {
      const invalidColors = ['invalid', '#GGG', 'rgb(300, 300, 300)', '', null, undefined];
      
      invalidColors.forEach(color => {
        const texture = manager.createSoilTexture('clay', color, {
          globalIntensity: 0.7,
          patternScale: 1.0
        });

        expect(texture).toBeInstanceOf(THREE.CanvasTexture);
        // Should handle gracefully with default or corrected color
      });
    });

    test('should handle null texture settings', () => {
      const texture = manager.createSoilTexture('clay', '#8B4513', null);

      expect(texture).toBeInstanceOf(THREE.CanvasTexture);
      // Should use default settings
    });

    test('should handle undefined texture settings', () => {
      const texture = manager.createSoilTexture('clay', '#8B4513', undefined);

      expect(texture).toBeInstanceOf(THREE.CanvasTexture);
      // Should use default settings
    });

    test('should handle malformed texture settings', () => {
      const malformedSettings = [
        { globalIntensity: 'invalid', patternScale: 'invalid' },
        { globalIntensity: NaN, patternScale: Infinity },
        { globalIntensity: -Infinity, patternScale: null },
        'not an object',
        123,
        []
      ];

      malformedSettings.forEach(settings => {
        expect(() => {
          const texture = manager.createSoilTexture('clay', '#8B4513', settings);
          expect(texture).toBeInstanceOf(THREE.CanvasTexture);
        }).not.toThrow();
      });
    });
  });

  describe('Canvas Creation Failures', () => {
    test('should handle canvas creation failure', () => {
      global.document.createElement = jest.fn(() => null);

      expect(() => {
        manager.createSoilTexture('clay', '#8B4513', { globalIntensity: 0.7 });
      }).toThrow();
    });

    test('should handle getContext failure', () => {
      global.document.createElement = jest.fn(() => createMockCanvas(true));

      expect(() => {
        manager.createSoilTexture('clay', '#8B4513', { globalIntensity: 0.7 });
      }).toThrow();
    });

    test('should handle canvas operation failures gracefully', () => {
      global.document.createElement = jest.fn(() => ({
        width: 128,
        height: 128,
        getContext: jest.fn(() => createMockContext(true))
      }));

      expect(() => {
        manager.createSoilTexture('clay', '#8B4513', { globalIntensity: 0.7 });
      }).toThrow();
    });
  });

  describe('Pattern Rendering Error Handling', () => {
    test('should fall back to clay pattern on renderer error', () => {
      // Mock a pattern renderer to throw an error
      const originalRenderer = manager.patternRenderers.get('sand');
      manager.patternRenderers.set('sand', () => {
        throw new Error('Pattern rendering failed');
      });

      // Should not throw and should fall back
      expect(() => {
        const texture = manager.createSoilTexture('sand', '#F4A460', { globalIntensity: 0.7 });
        expect(texture).toBeInstanceOf(THREE.CanvasTexture);
      }).not.toThrow();

      // Restore original renderer
      manager.patternRenderers.set('sand', originalRenderer);
    });

    test('should handle missing pattern renderer', () => {
      // Remove a pattern renderer
      manager.patternRenderers.delete('gravel');

      const texture = manager.createSoilTexture('gravel', '#8B7355', { globalIntensity: 0.7 });
      
      expect(texture).toBeInstanceOf(THREE.CanvasTexture);
      // Should fall back to clay pattern
    });

    test('should handle corrupted pattern renderer map', () => {
      // Corrupt the pattern renderers
      manager.patternRenderers.clear();

      const texture = manager.createSoilTexture('clay', '#8B4513', { globalIntensity: 0.7 });
      
      expect(texture).toBeInstanceOf(THREE.CanvasTexture);
      // Should still work with fallback
    });
  });

  describe('Extreme Parameter Values', () => {
    test('should handle extremely small intensity values', () => {
      const extremeSettings = {
        globalIntensity: Number.MIN_VALUE,
        patternScale: Number.MIN_VALUE
      };

      const texture = manager.createSoilTexture('clay', '#8B4513', extremeSettings);
      expect(texture).toBeInstanceOf(THREE.CanvasTexture);
      
      const params = manager.calculatePatternParameters(extremeSettings);
      expect(params.intensity).toBeGreaterThan(0);
      expect(params.scale).toBeGreaterThan(0);
    });

    test('should handle extremely large parameter values', () => {
      const extremeSettings = {
        globalIntensity: Number.MAX_VALUE,
        patternScale: Number.MAX_VALUE
      };

      const texture = manager.createSoilTexture('clay', '#8B4513', extremeSettings);
      expect(texture).toBeInstanceOf(THREE.CanvasTexture);
      
      const params = manager.calculatePatternParameters(extremeSettings);
      expect(params.intensity).toBeLessThanOrEqual(1.0);
      expect(params.scale).toBeLessThanOrEqual(2.5);
    });

    test('should handle NaN parameter values', () => {
      const nanSettings = {
        globalIntensity: NaN,
        patternScale: NaN
      };

      const texture = manager.createSoilTexture('clay', '#8B4513', nanSettings);
      expect(texture).toBeInstanceOf(THREE.CanvasTexture);
      
      const params = manager.calculatePatternParameters(nanSettings);
      expect(isNaN(params.intensity)).toBe(false);
      expect(isNaN(params.scale)).toBe(false);
    });

    test('should handle Infinity parameter values', () => {
      const infinitySettings = {
        globalIntensity: Infinity,
        patternScale: -Infinity
      };

      const texture = manager.createSoilTexture('clay', '#8B4513', infinitySettings);
      expect(texture).toBeInstanceOf(THREE.CanvasTexture);
      
      const params = manager.calculatePatternParameters(infinitySettings);
      expect(isFinite(params.intensity)).toBe(true);
      expect(isFinite(params.scale)).toBe(true);
    });
  });

  describe('Cache Corruption and Recovery', () => {
    test('should handle corrupted cache entries', () => {
      // Create a texture and corrupt its cache entry
      const texture1 = manager.createSoilTexture('clay', '#8B4513', { globalIntensity: 0.7 });
      
      // Corrupt the cache
      const cacheKey = Array.from(manager.textureCache.keys())[0];
      manager.textureCache.set(cacheKey, null);
      
      // Should handle corruption gracefully
      const texture2 = manager.createSoilTexture('clay', '#8B4513', { globalIntensity: 0.7 });
      expect(texture2).toBeInstanceOf(THREE.CanvasTexture);
    });

    test('should handle cache key collision', () => {
      // Force a hash collision by mocking the hash function
      const originalHash = manager.hashSettings;
      manager.hashSettings = () => 'collision'; // Always return same hash
      
      const texture1 = manager.createSoilTexture('clay', '#8B4513', { globalIntensity: 0.7 });
      const texture2 = manager.createSoilTexture('sand', '#F4A460', { globalIntensity: 0.8 });
      
      // Should still work despite collision
      expect(texture1).toBeInstanceOf(THREE.CanvasTexture);
      expect(texture2).toBeInstanceOf(THREE.CanvasTexture);
      
      manager.hashSettings = originalHash;
    });

    test('should recover from cache clear during operation', () => {
      // Start creating texture
      const texture1 = manager.createSoilTexture('clay', '#8B4513', { globalIntensity: 0.7 });
      
      // Clear cache mid-operation
      manager.clearCache();
      
      // Should still be able to create new textures
      const texture2 = manager.createSoilTexture('clay', '#8B4513', { globalIntensity: 0.7 });
      expect(texture2).toBeInstanceOf(THREE.CanvasTexture);
      expect(texture2).not.toBe(texture1); // Should be different due to cache clear
    });
  });

  describe('Resource Exhaustion Scenarios', () => {
    test('should handle canvas pool exhaustion', () => {
      // Exhaust canvas pool by not returning canvases
      const canvases = [];
      for (let i = 0; i < 20; i++) {
        canvases.push(manager.getCanvas());
      }
      
      // Should still be able to create textures
      const texture = manager.createSoilTexture('clay', '#8B4513', { globalIntensity: 0.7 });
      expect(texture).toBeInstanceOf(THREE.CanvasTexture);
    });

    test('should handle memory pressure gracefully', () => {
      // Simulate memory pressure with very small cache
      manager.maxCacheSize = 1;
      
      const textures = [];
      for (let i = 0; i < 100; i++) {
        textures.push(manager.createSoilTexture(`material_${i}`, '#888888', { globalIntensity: 0.7 }));
      }
      
      // All textures should be valid
      textures.forEach(texture => {
        expect(texture).toBeInstanceOf(THREE.CanvasTexture);
      });
      
      // Cache should not exceed limit
      expect(manager.getCacheStats().size).toBeLessThanOrEqual(1);
    });

    test('should handle rapid cache eviction', () => {
      manager.maxCacheSize = 3;
      
      // Create many textures rapidly
      const promises = [];
      for (let i = 0; i < 50; i++) {
        promises.push(Promise.resolve().then(() => 
          manager.createSoilTexture(`material_${i}`, '#888888', { globalIntensity: 0.7 })
        ));
      }
      
      return Promise.all(promises).then(textures => {
        textures.forEach(texture => {
          expect(texture).toBeInstanceOf(THREE.CanvasTexture);
        });
        
        expect(manager.getCacheStats().size).toBeLessThanOrEqual(3);
      });
    });
  });

  describe('Deterministic Generation Edge Cases', () => {
    test('should handle zero particle count', () => {
      const particles = manager.generateDeterministicParticles(0, 16);
      expect(particles).toEqual([]);
    });

    test('should handle negative particle count', () => {
      const particles = manager.generateDeterministicParticles(-5, 16);
      expect(particles).toEqual([]);
    });

    test('should handle extreme spacing values', () => {
      const largeSpacing = manager.generateDeterministicParticles(5, 1000);
      const smallSpacing = manager.generateDeterministicParticles(5, 0.1);
      
      expect(largeSpacing.length).toBe(5);
      expect(smallSpacing.length).toBe(5);
      
      largeSpacing.forEach(particle => {
        expect(particle.x).toBeGreaterThanOrEqual(0);
        expect(particle.y).toBeGreaterThanOrEqual(0);
      });
    });

    test('should handle malformed deterministic generation parameters', () => {
      expect(() => {
        manager.generateDeterministicParticles(null, null);
      }).not.toThrow();
      
      expect(() => {
        manager.generateDeterministicFormations(undefined, undefined);
      }).not.toThrow();
      
      expect(() => {
        manager.generateDeterministicOrganics(NaN, Infinity);
      }).not.toThrow();
    });
  });

  describe('Three.js Integration Edge Cases', () => {
    test('should handle Three.js texture creation failure', () => {
      // Mock THREE.CanvasTexture to fail
      const OriginalCanvasTexture = THREE.CanvasTexture;
      THREE.CanvasTexture = jest.fn(() => {
        throw new Error('Three.js texture creation failed');
      });
      
      expect(() => {
        manager.createSoilTexture('clay', '#8B4513', { globalIntensity: 0.7 });
      }).toThrow();
      
      // Restore original
      THREE.CanvasTexture = OriginalCanvasTexture;
    });

    test('should handle texture property setting failures', () => {
      // Create texture with mock that fails on property setting
      const texture = manager.createSoilTexture('clay', '#8B4513', { globalIntensity: 0.7 });
      
      // Mock property setters to fail
      Object.defineProperty(texture, 'wrapS', {
        set: () => { throw new Error('Property setting failed'); }
      });
      
      // Should still be a valid texture
      expect(texture).toBeInstanceOf(THREE.CanvasTexture);
    });
  });

  describe('Color Normalization Edge Cases', () => {
    test('should handle color with extra whitespace', () => {
      const color = manager.normalizeColor('  #FF0000  ');
      expect(color).toBe('#ff0000');
    });

    test('should handle RGB with invalid numbers', () => {
      const color = manager.normalizeColor('rgb(999, -50, abc)');
      expect(color).toBe('rgb(999, -50, abc)'); // Should return as-is if can't parse
    });

    test('should handle short hex colors', () => {
      const color = manager.normalizeColor('#F00');
      expect(color).toBe('#f00');
    });

    test('should handle color names', () => {
      const color = manager.normalizeColor('red');
      expect(color).toBe('red');
    });

    test('should handle malformed RGB strings', () => {
      const malformedColors = [
        'rgb(255)',
        'rgb(255, 0)',
        'rgb(255, 0, 0, 1, extra)',
        'rgba(255, 0, 0)',
        'rgba(255, 0, 0, 1, extra)'
      ];
      
      malformedColors.forEach(color => {
        expect(() => {
          const normalized = manager.normalizeColor(color);
          expect(typeof normalized).toBe('string');
        }).not.toThrow();
      });
    });
  });

  describe('Settings Hash Edge Cases', () => {
    test('should handle circular references in settings', () => {
      const circularSettings = { globalIntensity: 0.7 };
      circularSettings.self = circularSettings;
      
      expect(() => {
        const hash = manager.hashSettings(circularSettings);
        expect(typeof hash).toBe('string');
      }).not.toThrow();
    });

    test('should handle very large settings objects', () => {
      const largeSettings = {
        globalIntensity: 0.7,
        patternScale: 1.0
      };
      
      // Add many properties
      for (let i = 0; i < 1000; i++) {
        largeSettings[`prop_${i}`] = i;
      }
      
      expect(() => {
        const hash = manager.hashSettings(largeSettings);
        expect(typeof hash).toBe('string');
      }).not.toThrow();
    });

    test('should handle settings with special characters', () => {
      const specialSettings = {
        globalIntensity: 0.7,
        patternScale: 1.0,
        special: '🎨🖼️🎭',
        unicode: 'αβγδε',
        control: '\n\t\r'
      };
      
      expect(() => {
        const hash = manager.hashSettings(specialSettings);
        expect(typeof hash).toBe('string');
      }).not.toThrow();
    });
  });

  describe('Global Instance Error Handling', () => {
    test('should handle errors in global instance gracefully', () => {
      // Corrupt global instance cache
      textureManager.textureCache = null;
      
      expect(() => {
        textureManager.getCacheStats();
      }).toThrow();
      
      // Should be able to create new instance
      const newManager = new TextureManager();
      expect(newManager).toBeInstanceOf(TextureManager);
      newManager.dispose();
    });

    test('should handle disposal of already disposed instance', () => {
      const tempManager = new TextureManager();
      tempManager.dispose();
      
      expect(() => {
        tempManager.dispose(); // Double disposal
      }).not.toThrow();
    });

    test('should handle operations on disposed instance', () => {
      const tempManager = new TextureManager();
      tempManager.dispose();
      
      // Operations should fail gracefully
      expect(() => {
        tempManager.createSoilTexture('clay', '#8B4513', { globalIntensity: 0.7 });
      }).toThrow();
    });
  });
});