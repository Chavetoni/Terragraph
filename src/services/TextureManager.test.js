import { TextureManager, textureManager } from './TextureManager';
import * as THREE from 'three';

// Mock DOM APIs for testing
const createMockContext = () => ({
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
  lineWidth: 1,
  textAlign: 'left',
  font: '10px sans-serif'
});

const createMockCanvas = () => ({
  width: 128,
  height: 128,
  getContext: jest.fn(() => createMockContext())
});

// Setup global document mock
beforeEach(() => {
  global.document = {
    createElement: jest.fn(() => createMockCanvas())
  };
});

describe('TextureManager', () => {
  let manager;

  beforeEach(() => {
    manager = new TextureManager();
  });

  afterEach(() => {
    manager.dispose();
  });

  describe('Texture Creation', () => {
    test('should create soil texture for clay material', () => {
      const texture = manager.createSoilTexture('clay', '#8B4513', {
        globalIntensity: 0.7,
        patternScale: 1.0
      });

      expect(texture).toBeInstanceOf(THREE.CanvasTexture);
      expect(texture.wrapS).toBe(THREE.RepeatWrapping);
      expect(texture.wrapT).toBe(THREE.RepeatWrapping);
      expect(texture.repeat.x).toBe(1);
      expect(texture.repeat.y).toBe(1);
      expect(texture.userData.materialType).toBe('clay');
    });

    test('should create soil texture for sand material', () => {
      const texture = manager.createSoilTexture('sand', '#F4A460', {
        globalIntensity: 0.8,
        patternScale: 1.5
      });

      expect(texture).toBeInstanceOf(THREE.CanvasTexture);
      expect(texture.userData.materialType).toBe('sand');
    });

    test('should handle USCS material codes', () => {
      const clayTexture = manager.createSoilTexture('CL', '#8B4513', {
        globalIntensity: 0.7,
        patternScale: 1.0
      });

      const sandTexture = manager.createSoilTexture('SW', '#F4A460', {
        globalIntensity: 0.7,
        patternScale: 1.0
      });

      expect(clayTexture).toBeInstanceOf(THREE.CanvasTexture);
      expect(sandTexture).toBeInstanceOf(THREE.CanvasTexture);
    });
  });

  describe('Caching System', () => {
    test('should cache textures with identical parameters', () => {
      const texture1 = manager.createSoilTexture('clay', '#8B4513', {
        globalIntensity: 0.7,
        patternScale: 1.0
      });

      const texture2 = manager.createSoilTexture('clay', '#8B4513', {
        globalIntensity: 0.7,
        patternScale: 1.0
      });

      expect(texture1).toBe(texture2); // Should be the same cached instance
      
      const stats = manager.getCacheStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
    });

    test('should create different textures for different parameters', () => {
      const texture1 = manager.createSoilTexture('clay', '#8B4513', {
        globalIntensity: 0.7,
        patternScale: 1.0
      });

      const texture2 = manager.createSoilTexture('clay', '#8B4513', {
        globalIntensity: 0.8, // Different intensity
        patternScale: 1.0
      });

      expect(texture1).not.toBe(texture2); // Should be different instances
    });

    test('should evict old textures when cache is full', () => {
      // Set a small cache size for testing
      manager.maxCacheSize = 2;

      const texture1 = manager.createSoilTexture('clay', '#8B4513', { globalIntensity: 0.7 });
      const texture2 = manager.createSoilTexture('sand', '#F4A460', { globalIntensity: 0.7 });
      const texture3 = manager.createSoilTexture('gravel', '#A0522D', { globalIntensity: 0.7 });

      const stats = manager.getCacheStats();
      expect(stats.size).toBeLessThanOrEqual(2);
    });
  });

  describe('Pattern Parameter Calculation', () => {
    test('should calculate consistent pattern parameters', () => {
      const params1 = manager.calculatePatternParameters({
        globalIntensity: 0.7,
        patternScale: 1.0
      });

      const params2 = manager.calculatePatternParameters({
        globalIntensity: 0.7,
        patternScale: 1.0
      });

      expect(params1).toEqual(params2);
      expect(params1.intensity).toBe(0.7);
      expect(params1.scale).toBe(1.0);
    });

    test('should clamp intensity and scale values', () => {
      const params = manager.calculatePatternParameters({
        globalIntensity: 1.5, // Should be clamped to 1.0
        patternScale: 0.1     // Should be clamped to 0.5
      });

      expect(params.intensity).toBe(1.0);
      expect(params.scale).toBe(0.5);
    });

    test('should apply scale to spacing and element size', () => {
      const params1 = manager.calculatePatternParameters({
        globalIntensity: 0.7,
        patternScale: 1.0
      });

      const params2 = manager.calculatePatternParameters({
        globalIntensity: 0.7,
        patternScale: 2.0
      });

      expect(params2.spacing).toBeGreaterThan(params1.spacing);
      expect(params2.elementSize).toBeGreaterThan(params1.elementSize);
    });
  });

  describe('Material Type Mapping', () => {
    test('should map USCS codes to pattern types', () => {
      expect(manager.getPatternType('CL')).toBe('clay');
      expect(manager.getPatternType('SW')).toBe('sand');
      expect(manager.getPatternType('GW')).toBe('gravel');
      expect(manager.getPatternType('unknown')).toBe('silt'); // 'unknown' maps to silt via horizontal_lines pattern
    });

    test('should handle legacy material names', () => {
      expect(manager.getPatternType('clay')).toBe('clay');
      expect(manager.getPatternType('sand')).toBe('sand');
      expect(manager.getPatternType('rock')).toBe('rock');
      expect(manager.getPatternType('silt')).toBe('silt');
    });
  });

  describe('Color Normalization', () => {
    test('should normalize hex colors', () => {
      expect(manager.normalizeColor('#FF0000')).toBe('#ff0000');
      expect(manager.normalizeColor('#ff0000')).toBe('#ff0000');
    });

    test('should convert rgb to hex', () => {
      expect(manager.normalizeColor('rgb(255, 0, 0)')).toBe('#ff0000');
      expect(manager.normalizeColor('rgba(255, 0, 0, 1)')).toBe('#ff0000');
    });

    test('should handle invalid colors', () => {
      expect(manager.normalizeColor('')).toBe('#888888');
      expect(manager.normalizeColor(null)).toBe('#888888');
    });
  });

  describe('Deterministic Pattern Generation', () => {
    test('should generate consistent particles', () => {
      const particles1 = manager.generateDeterministicParticles(8, 16);
      const particles2 = manager.generateDeterministicParticles(8, 16);

      expect(particles1).toEqual(particles2);
      expect(particles1.length).toBe(8);
    });

    test('should generate consistent formations', () => {
      const formations1 = manager.generateDeterministicFormations(6, 20);
      const formations2 = manager.generateDeterministicFormations(6, 20);

      expect(formations1).toEqual(formations2);
      expect(formations1.length).toBe(6);
    });
  });

  describe('Memory Management', () => {
    test('should clear cache and reset stats', () => {
      manager.createSoilTexture('clay', '#8B4513', { globalIntensity: 0.7 });
      manager.createSoilTexture('sand', '#F4A460', { globalIntensity: 0.7 });

      expect(manager.getCacheStats().size).toBeGreaterThan(0);

      manager.clearCache();

      const stats = manager.getCacheStats();
      expect(stats.size).toBe(0);
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
    });

    test('should dispose of all resources', () => {
      manager.createSoilTexture('clay', '#8B4513', { globalIntensity: 0.7 });
      
      expect(manager.textureCache.size).toBeGreaterThan(0);
      
      manager.dispose();
      
      expect(manager.textureCache.size).toBe(0);
      expect(manager.canvasPool.length).toBe(0);
    });
  });

  describe('Settings Hash Generation', () => {
    test('should generate consistent hashes for identical settings', () => {
      const hash1 = manager.hashSettings({ globalIntensity: 0.7, patternScale: 1.0 });
      const hash2 = manager.hashSettings({ globalIntensity: 0.7, patternScale: 1.0 });

      expect(hash1).toBe(hash2);
    });

    test('should generate different hashes for different settings', () => {
      const hash1 = manager.hashSettings({ globalIntensity: 0.7, patternScale: 1.0 });
      const hash2 = manager.hashSettings({ globalIntensity: 0.8, patternScale: 1.0 });

      expect(hash1).not.toBe(hash2);
    });
  });
});

describe('Global TextureManager Instance', () => {
  test('should export singleton instance', () => {
    expect(textureManager).toBeInstanceOf(TextureManager);
  });

  test('should maintain state across calls', () => {
    const texture1 = textureManager.createSoilTexture('clay', '#8B4513', { globalIntensity: 0.7 });
    const texture2 = textureManager.createSoilTexture('clay', '#8B4513', { globalIntensity: 0.7 });

    expect(texture1).toBe(texture2); // Should be cached
  });
});