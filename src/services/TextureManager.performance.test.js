import { TextureManager, textureManager } from './TextureManager';
import * as THREE from 'three';

// Mock DOM APIs for testing
const mockContext = {
  clearRect: jest.fn(),
  fillRect: jest.fn(),
  beginPath: jest.fn(),
  moveTo: jest.fn(),
  lineTo: jest.fn(),
  arc: jest.fn(),
  ellipse: jest.fn(),
  fill: jest.fn(),
  stroke: jest.fn(),
  closePath: jest.fn(),
  setLineDash: jest.fn(),
  fillStyle: '#000000',
  strokeStyle: '#000000',
  lineWidth: 1
};

const mockCanvas = {
  width: 128,
  height: 128,
  getContext: jest.fn(() => mockContext)
};

global.document = {
  createElement: jest.fn(() => mockCanvas)
};

describe('TextureManager - Performance and Memory Management', () => {
  let manager;

  beforeEach(() => {
    manager = new TextureManager();
    jest.clearAllMocks();
  });

  afterEach(() => {
    manager.dispose();
  });

  describe('Caching Performance', () => {
    test('should provide significant performance improvement with caching', () => {
      const settings = { globalIntensity: 0.7, patternScale: 1.0 };
      
      // First creation (cache miss)
      const start1 = performance.now();
      const texture1 = manager.createSoilTexture('clay', '#8B4513', settings);
      const end1 = performance.now();
      const firstTime = end1 - start1;
      
      // Second creation (cache hit)
      const start2 = performance.now();
      const texture2 = manager.createSoilTexture('clay', '#8B4513', settings);
      const end2 = performance.now();
      const secondTime = end2 - start2;
      
      expect(texture1).toBe(texture2); // Should be cached
      expect(secondTime).toBeLessThan(firstTime); // Should be faster
      
      const stats = manager.getCacheStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
    });

    test('should maintain high cache hit ratio with repeated requests', () => {
      const materials = ['clay', 'sand', 'gravel'];
      const colors = ['#8B4513', '#F4A460', '#8B7355'];
      const settings = { globalIntensity: 0.7, patternScale: 1.0 };
      
      // Create initial textures
      materials.forEach((material, i) => {
        manager.createSoilTexture(material, colors[i], settings);
      });
      
      manager.getCacheStats(); // Reset for measurement
      
      // Request same textures multiple times
      for (let round = 0; round < 10; round++) {
        materials.forEach((material, i) => {
          manager.createSoilTexture(material, colors[i], settings);
        });
      }
      
      const stats = manager.getCacheStats();
      const hitRatio = stats.hits / (stats.hits + stats.misses);
      
      expect(hitRatio).toBeGreaterThan(0.9); // > 90% hit ratio
    });

    test('should handle cache eviction without performance degradation', () => {
      manager.maxCacheSize = 5; // Small cache for testing
      
      const times = [];
      
      // Create many different textures to trigger eviction
      for (let i = 0; i < 20; i++) {
        const start = performance.now();
        manager.createSoilTexture('clay', `#${i.toString(16).padStart(6, '0')}`, {
          globalIntensity: 0.7,
          patternScale: 1.0
        });
        const end = performance.now();
        times.push(end - start);
      }
      
      // Performance should remain consistent despite eviction
      const avgTime = times.reduce((a, b) => a + b) / times.length;
      const maxTime = Math.max(...times);
      const minTime = Math.min(...times);
      
      expect(maxTime / minTime).toBeLessThan(5); // No more than 5x variation
      expect(times[times.length - 1]).toBeLessThan(avgTime * 2); // Last creation not significantly slower
    });

    test('should perform well with different scale and intensity combinations', () => {
      const scales = [0.5, 1.0, 1.5, 2.0];
      const intensities = [0.3, 0.5, 0.7, 1.0];
      const times = [];
      
      scales.forEach(scale => {
        intensities.forEach(intensity => {
          const start = performance.now();
          manager.createSoilTexture('clay', '#8B4513', {
            globalIntensity: intensity,
            patternScale: scale
          });
          const end = performance.now();
          times.push(end - start);
        });
      });
      
      const avgTime = times.reduce((a, b) => a + b) / times.length;
      const maxTime = Math.max(...times);
      
      expect(maxTime).toBeLessThan(avgTime * 3); // No single creation takes more than 3x average
      expect(avgTime).toBeLessThan(50); // Average creation time < 50ms
    });
  });

  describe('Memory Management', () => {
    test('should limit cache size to prevent memory bloat', () => {
      const originalMaxSize = manager.maxCacheSize;
      manager.maxCacheSize = 10;
      
      // Create more textures than cache can hold
      for (let i = 0; i < 20; i++) {
        manager.createSoilTexture('clay', `#${i.toString(16).padStart(6, '0')}`, {
          globalIntensity: 0.7,
          patternScale: 1.0
        });
      }
      
      const stats = manager.getCacheStats();
      expect(stats.size).toBeLessThanOrEqual(manager.maxCacheSize);
      
      manager.maxCacheSize = originalMaxSize;
    });

    test('should properly dispose of evicted textures', () => {
      manager.maxCacheSize = 2;
      
      const textures = [];
      const disposeSpy = jest.fn();
      
      // Mock texture dispose method
      const originalCreateTexture = manager.generateTexture;
      manager.generateTexture = function(...args) {
        const texture = originalCreateTexture.apply(this, args);
        texture.dispose = disposeSpy;
        textures.push(texture);
        return texture;
      };
      
      // Create textures to trigger eviction
      manager.createSoilTexture('clay', '#111111', { globalIntensity: 0.7 });
      manager.createSoilTexture('clay', '#222222', { globalIntensity: 0.7 });
      manager.createSoilTexture('clay', '#333333', { globalIntensity: 0.7 }); // Should evict first
      
      // First texture should have been disposed
      expect(disposeSpy).toHaveBeenCalled();
      
      manager.generateTexture = originalCreateTexture;
    });

    test('should clear all cached textures properly', () => {
      // Create several textures
      manager.createSoilTexture('clay', '#8B4513', { globalIntensity: 0.7 });
      manager.createSoilTexture('sand', '#F4A460', { globalIntensity: 0.7 });
      manager.createSoilTexture('gravel', '#8B7355', { globalIntensity: 0.7 });
      
      expect(manager.getCacheStats().size).toBe(3);
      
      manager.clearCache();
      
      const stats = manager.getCacheStats();
      expect(stats.size).toBe(0);
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
    });

    test('should dispose of all resources on manager disposal', () => {
      // Create textures and canvases
      manager.createSoilTexture('clay', '#8B4513', { globalIntensity: 0.7 });
      manager.createSoilTexture('sand', '#F4A460', { globalIntensity: 0.7 });
      
      // Add canvases to pool
      const canvas1 = manager.getCanvas();
      const canvas2 = manager.getCanvas();
      manager.returnCanvas(canvas1);
      manager.returnCanvas(canvas2);
      
      expect(manager.getCacheStats().size).toBeGreaterThan(0);
      expect(manager.canvasPool.length).toBeGreaterThan(0);
      
      manager.dispose();
      
      expect(manager.getCacheStats().size).toBe(0);
      expect(manager.canvasPool.length).toBe(0);
      expect(manager.patternRenderers.size).toBe(0);
    });
  });

  describe('Canvas Pooling Performance', () => {
    test('should reuse canvases from pool for better performance', () => {
      // Create and return canvases to pool
      const canvas1 = manager.getCanvas();
      const canvas2 = manager.getCanvas();
      manager.returnCanvas(canvas1);
      manager.returnCanvas(canvas2);
      
      expect(manager.canvasPool.length).toBe(2);
      
      // Getting canvas should reuse from pool
      const reusedCanvas = manager.getCanvas();
      expect(reusedCanvas).toBe(canvas2); // Should be last returned canvas
      expect(manager.canvasPool.length).toBe(1);
    });

    test('should limit canvas pool size to prevent memory bloat', () => {
      const maxPoolSize = 5;
      
      // Create and return more canvases than pool limit
      for (let i = 0; i < 10; i++) {
        const canvas = manager.getCanvas();
        manager.returnCanvas(canvas);
      }
      
      expect(manager.canvasPool.length).toBeLessThanOrEqual(maxPoolSize);
    });

    test('should create new canvas when pool is empty', () => {
      expect(manager.canvasPool.length).toBe(0);
      
      const canvas = manager.getCanvas();
      expect(canvas).toBeDefined();
      expect(canvas.width).toBe(128);
      expect(canvas.height).toBe(128);
      expect(manager.canvasPool.length).toBe(0); // Still empty
    });
  });

  describe('Pattern Rendering Performance', () => {
    test('should pre-compile pattern renderers for performance', () => {
      expect(manager.patternRenderers.size).toBeGreaterThan(0);
      expect(manager.patternRenderers.has('clay')).toBe(true);
      expect(manager.patternRenderers.has('sand')).toBe(true);
      expect(manager.patternRenderers.has('gravel')).toBe(true);
    });

    test('should render patterns efficiently across all material types', () => {
      const materials = ['clay', 'sand', 'gravel', 'rock', 'silt', 'organic', 'fill'];
      const times = [];
      
      materials.forEach(material => {
        const start = performance.now();
        for (let i = 0; i < 10; i++) {
          manager.createSoilTexture(material, '#888888', {
            globalIntensity: 0.7,
            patternScale: 1.0
          });
        }
        const end = performance.now();
        times.push((end - start) / 10); // Average time per texture
      });
      
      const avgTime = times.reduce((a, b) => a + b) / times.length;
      const maxTime = Math.max(...times);
      
      expect(maxTime).toBeLessThan(avgTime * 2); // No pattern takes more than 2x average time
      expect(avgTime).toBeLessThan(20); // Average pattern rendering < 20ms
    });

    test('should handle deterministic pattern generation efficiently', () => {
      const start = performance.now();
      
      // Generate many deterministic patterns
      for (let i = 0; i < 100; i++) {
        manager.generateDeterministicParticles(8, 16);
        manager.generateDeterministicFormations(6, 20);
        manager.generateDeterministicOrganics(12, 16);
        manager.generateDeterministicFragments(15, 16);
      }
      
      const end = performance.now();
      const totalTime = end - start;
      
      expect(totalTime).toBeLessThan(1000); // Should complete in < 1 second
    });
  });

  describe('Concurrent Access Performance', () => {
    test('should handle simultaneous texture creation efficiently', async () => {
      const concurrentRequests = Array.from({ length: 20 }, (_, i) => {
        return new Promise(resolve => {
          setTimeout(() => {
            const start = performance.now();
            const texture = manager.createSoilTexture('clay', '#8B4513', {
              globalIntensity: 0.7,
              patternScale: 1.0
            });
            const end = performance.now();
            resolve({ texture, time: end - start });
          }, Math.random() * 10); // Random delay 0-10ms
        });
      });
      
      const results = await Promise.all(concurrentRequests);
      
      // All should succeed
      results.forEach(result => {
        expect(result.texture).toBeInstanceOf(THREE.CanvasTexture);
        expect(result.time).toBeLessThan(100); // Each creation < 100ms
      });
      
      // Should benefit from caching (same texture for all)
      const firstTexture = results[0].texture;
      results.forEach(result => {
        expect(result.texture).toBe(firstTexture);
      });
    });

    test('should maintain cache consistency under concurrent access', () => {
      const materials = ['clay', 'sand', 'gravel'];
      const promises = [];
      
      // Create many concurrent requests for different materials
      for (let i = 0; i < 50; i++) {
        const material = materials[i % materials.length];
        promises.push(
          Promise.resolve().then(() => 
            manager.createSoilTexture(material, '#888888', {
              globalIntensity: 0.7,
              patternScale: 1.0
            })
          )
        );
      }
      
      return Promise.all(promises).then(textures => {
        // Should have exactly 3 unique textures (one per material)
        const uniqueTextures = new Set(textures);
        expect(uniqueTextures.size).toBe(3);
        
        // Cache stats should be consistent
        const stats = manager.getCacheStats();
        expect(stats.hits + stats.misses).toBe(50);
        expect(stats.size).toBe(3);
      });
    });
  });

  describe('Memory Pressure Handling', () => {
    test('should handle low memory conditions gracefully', () => {
      // Simulate memory pressure by setting very small cache
      manager.maxCacheSize = 1;
      
      const materials = ['clay', 'sand', 'gravel', 'rock', 'silt'];
      const textures = [];
      
      materials.forEach(material => {
        const texture = manager.createSoilTexture(material, '#888888', {
          globalIntensity: 0.7,
          patternScale: 1.0
        });
        textures.push(texture);
      });
      
      // All textures should be valid despite memory pressure
      textures.forEach(texture => {
        expect(texture).toBeInstanceOf(THREE.CanvasTexture);
      });
      
      // Cache should not exceed limit
      expect(manager.getCacheStats().size).toBeLessThanOrEqual(1);
    });

    test('should recover from cache eviction gracefully', () => {
      manager.maxCacheSize = 2;
      
      // Fill cache
      const texture1 = manager.createSoilTexture('clay', '#111111', { globalIntensity: 0.7 });
      const texture2 = manager.createSoilTexture('sand', '#222222', { globalIntensity: 0.7 });
      
      expect(manager.getCacheStats().size).toBe(2);
      
      // Force eviction
      const texture3 = manager.createSoilTexture('gravel', '#333333', { globalIntensity: 0.7 });
      
      expect(manager.getCacheStats().size).toBe(2);
      
      // Re-request evicted texture - should work
      const texture1Again = manager.createSoilTexture('clay', '#111111', { globalIntensity: 0.7 });
      expect(texture1Again).toBeInstanceOf(THREE.CanvasTexture);
      expect(texture1Again).not.toBe(texture1); // New instance due to eviction
    });
  });

  describe('Global Instance Performance', () => {
    test('should maintain performance with global singleton instance', () => {
      const start = performance.now();
      
      // Use global instance for many operations
      for (let i = 0; i < 100; i++) {
        textureManager.createSoilTexture('clay', '#8B4513', {
          globalIntensity: 0.7,
          patternScale: 1.0
        });
      }
      
      const end = performance.now();
      const totalTime = end - start;
      
      expect(totalTime).toBeLessThan(1000); // Should complete quickly due to caching
      
      // Should have high cache hit ratio
      const stats = textureManager.getCacheStats();
      const hitRatio = stats.hits / (stats.hits + stats.misses);
      expect(hitRatio).toBeGreaterThan(0.95); // > 95% hit ratio
    });

    test('should share cache efficiently across different usage patterns', () => {
      // Simulate different components using the same global instance
      const component1Textures = [];
      const component2Textures = [];
      
      // Component 1: Uses clay and sand
      for (let i = 0; i < 10; i++) {
        component1Textures.push(
          textureManager.createSoilTexture('clay', '#8B4513', { globalIntensity: 0.7, patternScale: 1.0 })
        );
        component1Textures.push(
          textureManager.createSoilTexture('sand', '#F4A460', { globalIntensity: 0.7, patternScale: 1.0 })
        );
      }
      
      // Component 2: Also uses clay and sand
      for (let i = 0; i < 10; i++) {
        component2Textures.push(
          textureManager.createSoilTexture('clay', '#8B4513', { globalIntensity: 0.7, patternScale: 1.0 })
        );
        component2Textures.push(
          textureManager.createSoilTexture('sand', '#F4A460', { globalIntensity: 0.7, patternScale: 1.0 })
        );
      }
      
      // Should share textures between components
      expect(component1Textures[0]).toBe(component2Textures[0]); // Same clay texture
      expect(component1Textures[1]).toBe(component2Textures[1]); // Same sand texture
      
      // Should have minimal cache entries
      const stats = textureManager.getCacheStats();
      expect(stats.size).toBe(2); // Only clay and sand
    });
  });
});