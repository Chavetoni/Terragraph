/**
 * Test for the TextureManager geological material fix
 * Validates that SC and SM materials work properly with TextureManager
 */

import { TextureManager } from './TextureManager';
import { VolumetricMeshGenerator } from './VolumetricMeshGenerator';
import * as THREE from 'three';

// Mock Three.js components
jest.mock('three', () => {
  const actual = jest.requireActual('three');
  return {
    ...actual,
    CanvasTexture: jest.fn(() => ({
      wrapS: actual.RepeatWrapping,
      wrapT: actual.RepeatWrapping,
      repeat: { set: jest.fn() },
      needsUpdate: false,
      dispose: jest.fn(),
      userData: {}
    }))
  };
});

describe('TextureManager Geological Materials Fix', () => {
  let textureManager;

  beforeEach(() => {
    textureManager = new TextureManager();
    
    // Mock HTML5 Canvas
    const mockCanvas = {
      getContext: jest.fn(() => ({
        fillStyle: '',
        strokeStyle: '',
        lineWidth: 1,
        fillRect: jest.fn(),
        clearRect: jest.fn(),
        stroke: jest.fn(),
        fill: jest.fn(),
        beginPath: jest.fn(),
        moveTo: jest.fn(),
        lineTo: jest.fn(),
        arc: jest.fn(),
        ellipse: jest.fn(),
        closePath: jest.fn(),
        save: jest.fn(),
        restore: jest.fn(),
        translate: jest.fn(),
        rotate: jest.fn(),
        scale: jest.fn(),
        setLineDash: jest.fn(),
        createLinearGradient: jest.fn(() => ({
          addColorStop: jest.fn()
        }))
      })),
      width: 256,
      height: 256,
      toDataURL: jest.fn(() => 'data:image/png;base64,mock')
    };
    
    Object.defineProperty(global, 'document', {
      value: {
        createElement: jest.fn(() => mockCanvas)
      },
      writable: true
    });
  });

  afterEach(() => {
    textureManager.dispose();
  });

  describe('Critical Geological Materials', () => {
    test('should create texture for SC (Sandy Clay) material', () => {
      const settings = {
        enabled: true,
        globalIntensity: 0.7,
        patternScale: 1.0
      };

      expect(() => {
        const texture = textureManager.createSoilTexture('SC', '#8B4513', settings);
        expect(texture).toBeDefined();
        expect(texture.userData.materialType).toBe('SC');
      }).not.toThrow();
    });

    test('should create texture for SM (Silty Sand) material', () => {
      const settings = {
        enabled: true,
        globalIntensity: 0.8,
        patternScale: 1.5
      };

      expect(() => {
        const texture = textureManager.createSoilTexture('SM', '#F4A460', settings);
        expect(texture).toBeDefined();
        expect(texture.userData.materialType).toBe('SM');
      }).not.toThrow();
    });

    test('should handle all common USCS materials', () => {
      const materials = ['SC', 'SM', 'CL', 'ML', 'CH', 'MH', 'SW', 'SP', 'GW', 'GP', 'OL', 'OH'];
      const settings = { enabled: true, globalIntensity: 0.7, patternScale: 1.0 };

      materials.forEach(material => {
        expect(() => {
          const texture = textureManager.createSoilTexture(material, '#888888', settings);
          expect(texture).toBeDefined();
          expect(texture.userData.materialType).toBe(material);
        }).not.toThrow();
      });
    });
  });

  describe('VolumetricMeshGenerator Integration', () => {
    const createTestVolumeData = (material) => ({
      material,
      triangles: [
        { vertices: [[0, 0, 0], [1, 0, 0], [1, 1, 0]] },
        { vertices: [[0, 0, 0], [1, 1, 0], [0, 1, 0]] }
      ],
      center: { x: 0.5, y: 0.5, z: 0 },
      bounds: { min: { x: 0, y: 0, z: 0 }, max: { x: 1, y: 1, z: 0 } },
      volume: 0.5,
      color: '#8B4513'
    });

    test('should work with VolumetricMeshGenerator for SC material', () => {
      const volumeData = createTestVolumeData('SC');
      const textureSettings = {
        enabled: true,
        globalIntensity: 0.7,
        patternScale: 1.0
      };

      expect(() => {
        const mesh = VolumetricMeshGenerator.createThreeJsMesh(
          volumeData,
          {},
          textureManager, // Using actual TextureManager instance
          textureSettings
        );
        expect(mesh).toBeDefined();
        expect(mesh.material).toBeDefined();
      }).not.toThrow();
    });

    test('should work with VolumetricMeshGenerator for SM material', () => {
      const volumeData = createTestVolumeData('SM');
      const textureSettings = {
        enabled: true,
        globalIntensity: 0.8,
        patternScale: 1.5
      };

      expect(() => {
        const mesh = VolumetricMeshGenerator.createThreeJsMesh(
          volumeData,
          {},
          textureManager, // Using actual TextureManager instance
          textureSettings
        );
        expect(mesh).toBeDefined();
        expect(mesh.material).toBeDefined();
      }).not.toThrow();
    });

    test('should demonstrate the fix: no null reference errors', () => {
      const materials = ['SC', 'SM', 'CL', 'SW'];
      const textureSettings = {
        enabled: true,
        globalIntensity: 0.7,
        patternScale: 1.0
      };

      // This test proves the fix works - no "Cannot read properties of null" errors
      materials.forEach(material => {
        const volumeData = createTestVolumeData(material);
        
        expect(() => {
          const mesh = VolumetricMeshGenerator.createThreeJsMesh(
            volumeData,
            {},
            textureManager, // Real TextureManager instead of null
            textureSettings
          );
          expect(mesh).toBeDefined();
        }).not.toThrow();
      });
    });
  });

  describe('Error Handling Comparison', () => {
    const createTestVolumeData = (material) => ({
      material,
      triangles: [{ vertices: [[0, 0, 0], [1, 0, 0], [1, 1, 0]] }],
      center: { x: 0.5, y: 0.5, z: 0 },
      bounds: { min: { x: 0, y: 0, z: 0 }, max: { x: 1, y: 1, z: 0 } },
      volume: 0.5,
      color: '#8B4513'
    });

    test('should show difference between null and proper TextureManager', () => {
      const volumeData = createTestVolumeData('SC');
      const textureSettings = {
        enabled: true,
        globalIntensity: 0.7,
        patternScale: 1.0
      };

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      // Test with null (old behavior) - should warn but not crash
      const meshWithNull = VolumetricMeshGenerator.createThreeJsMesh(
        volumeData,
        {},
        null, // null TextureManager
        textureSettings
      );
      
      expect(meshWithNull).toBeDefined();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to apply texture to SC'),
        expect.any(Error)
      );

      consoleSpy.mockClear();

      // Test with proper TextureManager (new behavior) - should work without warnings
      const meshWithTextureManager = VolumetricMeshGenerator.createThreeJsMesh(
        volumeData,
        {},
        textureManager, // Proper TextureManager instance
        textureSettings
      );
      
      expect(meshWithTextureManager).toBeDefined();
      expect(consoleSpy).not.toHaveBeenCalled(); // No warnings with proper TextureManager

      consoleSpy.mockRestore();
    });
  });

  describe('Performance and Memory', () => {
    test('should cache textures properly to avoid recreation', () => {
      const settings = { enabled: true, globalIntensity: 0.7, patternScale: 1.0 };
      
      // Create texture twice with same parameters
      const texture1 = textureManager.createSoilTexture('SC', '#8B4513', settings);
      const texture2 = textureManager.createSoilTexture('SC', '#8B4513', settings);
      
      // Should use cached texture
      expect(texture1).toBe(texture2);
      
      const stats = textureManager.getCacheStats();
      expect(stats.hits).toBeGreaterThan(0);
    });

    test('should properly dispose of resources', () => {
      const settings = { enabled: true, globalIntensity: 0.7, patternScale: 1.0 };
      
      textureManager.createSoilTexture('SC', '#8B4513', settings);
      textureManager.createSoilTexture('SM', '#F4A460', settings);
      
      const statsBefore = textureManager.getCacheStats();
      expect(statsBefore.size).toBeGreaterThan(0);
      
      textureManager.dispose();
      
      const statsAfter = textureManager.getCacheStats();
      expect(statsAfter.size).toBe(0);
    });
  });
});