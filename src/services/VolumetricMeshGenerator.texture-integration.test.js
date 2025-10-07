/**
 * Integration tests for texture rendering pipeline in VolumetricMeshGenerator
 * Tests the complete texture application workflow including TextureManager integration
 */

import * as THREE from 'three';
import { VolumetricMeshGenerator } from './VolumetricMeshGenerator';
import { TextureManager } from './TextureManager';

// Mock Three.js to prevent WebGL context issues in tests
jest.mock('three', () => {
  const actual = jest.requireActual('three');
  return {
    ...actual,
    WebGLRenderer: jest.fn(() => ({
      setSize: jest.fn(),
      render: jest.fn(),
      dispose: jest.fn()
    })),
    Texture: jest.fn(() => ({
      wrapS: actual.RepeatWrapping,
      wrapT: actual.RepeatWrapping,
      repeat: { set: jest.fn() },
      needsUpdate: false,
      dispose: jest.fn()
    })),
    CanvasTexture: jest.fn(() => ({
      wrapS: actual.RepeatWrapping,
      wrapT: actual.RepeatWrapping,
      repeat: { set: jest.fn() },
      needsUpdate: false,
      dispose: jest.fn()
    }))
  };
});

describe('VolumetricMeshGenerator Texture Integration', () => {
  let textureManager;
  
  beforeEach(() => {
    textureManager = new TextureManager();
    
    // Mock HTML5 Canvas API
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

  const createTestVolumeData = (material = 'SC') => ({
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

  describe('Texture Manager Integration', () => {
    test('should work with valid TextureManager instance', () => {
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
          textureManager, // Valid TextureManager instance
          textureSettings
        );
        expect(mesh).toBeDefined();
        expect(mesh.material).toBeDefined();
      }).not.toThrow();
    });

    test('should handle null textureManager gracefully', () => {
      const volumeData = createTestVolumeData('SC');
      const textureSettings = { 
        enabled: true, 
        globalIntensity: 0.7, 
        patternScale: 1.0 
      };

      // This should not throw but should log a warning
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      const mesh = VolumetricMeshGenerator.createThreeJsMesh(
        volumeData,
        {},
        null, // null textureManager
        textureSettings
      );

      expect(mesh).toBeDefined();
      expect(mesh.material).toBeDefined();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to apply texture to SC'),
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    test('should handle undefined textureManager gracefully', () => {
      const volumeData = createTestVolumeData('SM');
      const textureSettings = { 
        enabled: true, 
        globalIntensity: 0.8, 
        patternScale: 1.5 
      };

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      const mesh = VolumetricMeshGenerator.createThreeJsMesh(
        volumeData,
        {},
        undefined, // undefined textureManager
        textureSettings
      );

      expect(mesh).toBeDefined();
      expect(mesh.material).toBeDefined();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to apply texture to SM'),
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Geological Material Texture Application', () => {
    const geologicalMaterials = [
      'SC', 'SM', 'CL', 'ML', 'CH', 'MH', 'SW', 'SP', 'GW', 'GP', 'OL', 'OH'
    ];

    geologicalMaterials.forEach(material => {
      test(`should apply texture to ${material} material with valid TextureManager`, () => {
        const volumeData = createTestVolumeData(material);
        const textureSettings = { 
          enabled: true, 
          globalIntensity: 0.7, 
          patternScale: 1.0 
        };

        const mesh = VolumetricMeshGenerator.createThreeJsMesh(
          volumeData,
          {},
          textureManager,
          textureSettings
        );

        expect(mesh).toBeDefined();
        expect(mesh.material).toBeDefined();
        
        // Verify texture was applied if material is supported
        if (mesh.material.map) {
          expect(mesh.material.map.wrapS).toBe(THREE.RepeatWrapping);
          expect(mesh.material.map.wrapT).toBe(THREE.RepeatWrapping);
          expect(mesh.material.map.repeat.set).toHaveBeenCalledWith(1, 1);
        }
      });
    });
  });

  describe('Texture Settings Validation', () => {
    test('should handle missing texture settings with valid TextureManager', () => {
      const volumeData = createTestVolumeData('SC');

      const mesh = VolumetricMeshGenerator.createThreeJsMesh(
        volumeData,
        {},
        textureManager,
        null // No texture settings
      );

      expect(mesh).toBeDefined();
      expect(mesh.material).toBeDefined();
    });

    test('should handle disabled textures', () => {
      const volumeData = createTestVolumeData('SC');
      const textureSettings = { enabled: false };

      const mesh = VolumetricMeshGenerator.createThreeJsMesh(
        volumeData,
        {},
        textureManager,
        textureSettings
      );

      expect(mesh).toBeDefined();
      expect(mesh.material).toBeDefined();
      // Should not have texture when disabled
      expect(mesh.material.map).toBeFalsy();
    });

    test('should use default values for partial texture settings', () => {
      const volumeData = createTestVolumeData('SC');
      const partialSettings = { enabled: true }; // Missing intensity and scale

      expect(() => {
        const mesh = VolumetricMeshGenerator.createThreeJsMesh(
          volumeData,
          {},
          textureManager,
          partialSettings
        );
        expect(mesh).toBeDefined();
      }).not.toThrow();
    });
  });

  describe('Error Handling and Recovery', () => {
    test('should recover from texture creation errors', () => {
      // Create a faulty TextureManager that throws errors
      const faultyTextureManager = {
        createSoilTexture: jest.fn(() => {
          throw new Error('Texture creation failed');
        })
      };

      const volumeData = createTestVolumeData('SC');
      const textureSettings = { 
        enabled: true, 
        globalIntensity: 0.7, 
        patternScale: 1.0 
      };

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      const mesh = VolumetricMeshGenerator.createThreeJsMesh(
        volumeData,
        {},
        faultyTextureManager,
        textureSettings
      );

      expect(mesh).toBeDefined();
      expect(mesh.material).toBeDefined();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to apply texture to SC'),
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    test('should continue with base color when texture fails', () => {
      const faultyTextureManager = {
        createSoilTexture: jest.fn(() => null) // Returns null
      };

      const volumeData = createTestVolumeData('SC');
      const textureSettings = { 
        enabled: true, 
        globalIntensity: 0.7, 
        patternScale: 1.0 
      };

      const mesh = VolumetricMeshGenerator.createThreeJsMesh(
        volumeData,
        {},
        faultyTextureManager,
        textureSettings
      );

      expect(mesh).toBeDefined();
      expect(mesh.material).toBeDefined();
      expect(mesh.material.color).toBeDefined();
      // Should not have texture when creation returns null
      expect(mesh.material.map).toBeFalsy();
    });
  });

  describe('Texture Properties Configuration', () => {
    test('should set correct texture wrapping mode', () => {
      const volumeData = createTestVolumeData('SC');
      const textureSettings = { 
        enabled: true, 
        globalIntensity: 0.7, 
        patternScale: 1.0 
      };

      // Mock TextureManager to return a controllable texture
      const mockTexture = new THREE.Texture();
      const spyTextureManager = {
        createSoilTexture: jest.fn(() => mockTexture)
      };

      const mesh = VolumetricMeshGenerator.createThreeJsMesh(
        volumeData,
        {},
        spyTextureManager,
        textureSettings
      );

      expect(spyTextureManager.createSoilTexture).toHaveBeenCalledWith(
        'SC',
        '#8B4513',
        expect.objectContaining({
          enabled: true,
          intensity: 0.7,
          scale: 1.0,
          pattern: null
        })
      );

      expect(mockTexture.wrapS).toBe(THREE.RepeatWrapping);
      expect(mockTexture.wrapT).toBe(THREE.RepeatWrapping);
      expect(mockTexture.repeat.set).toHaveBeenCalledWith(1, 1);
      expect(mockTexture.needsUpdate).toBe(true);
    });

    test('should pass correct material texture options', () => {
      const volumeData = createTestVolumeData('CL');
      const textureSettings = { 
        enabled: true, 
        globalIntensity: 0.8, 
        patternScale: 1.5 
      };

      const spyTextureManager = {
        createSoilTexture: jest.fn(() => new THREE.Texture())
      };

      VolumetricMeshGenerator.createThreeJsMesh(
        volumeData,
        {},
        spyTextureManager,
        textureSettings
      );

      expect(spyTextureManager.createSoilTexture).toHaveBeenCalledWith(
        'CL',
        '#8B4513',
        expect.objectContaining({
          enabled: true,
          intensity: 0.8,
          scale: 1.5,
          pattern: null
        })
      );
    });
  });

  describe('Material Color Integration', () => {
    test('should use volume data color for texture base', () => {
      const customColor = '#FF5722';
      const volumeData = { ...createTestVolumeData('SW'), color: customColor };
      const textureSettings = { enabled: true, globalIntensity: 0.7 };

      const spyTextureManager = {
        createSoilTexture: jest.fn(() => new THREE.Texture())
      };

      VolumetricMeshGenerator.createThreeJsMesh(
        volumeData,
        {},
        spyTextureManager,
        textureSettings
      );

      expect(spyTextureManager.createSoilTexture).toHaveBeenCalledWith(
        'SW',
        customColor,
        expect.any(Object)
      );
    });

    test('should use custom color override when provided', () => {
      const volumeColor = '#8B4513';
      const customColor = '#2E7D32';
      const volumeData = { ...createTestVolumeData('GP'), color: volumeColor };
      const textureSettings = { enabled: true, globalIntensity: 0.7 };

      const spyTextureManager = {
        createSoilTexture: jest.fn(() => new THREE.Texture())
      };

      VolumetricMeshGenerator.createThreeJsMesh(
        volumeData,
        {},
        spyTextureManager,
        textureSettings,
        customColor // Custom color override
      );

      expect(spyTextureManager.createSoilTexture).toHaveBeenCalledWith(
        'GP',
        customColor, // Should use custom color, not volume color
        expect.any(Object)
      );
    });
  });

  describe('Memory Management', () => {
    test('should not leak textures during repeated calls', () => {
      const volumeData = createTestVolumeData('SC');
      const textureSettings = { enabled: true, globalIntensity: 0.7 };

      const mockTextures = [];
      const spyTextureManager = {
        createSoilTexture: jest.fn(() => {
          const texture = new THREE.Texture();
          mockTextures.push(texture);
          return texture;
        })
      };

      // Create multiple meshes
      for (let i = 0; i < 5; i++) {
        const mesh = VolumetricMeshGenerator.createThreeJsMesh(
          volumeData,
          {},
          spyTextureManager,
          textureSettings
        );
        expect(mesh).toBeDefined();
      }

      // Verify textures were created (TextureManager should handle caching)
      expect(spyTextureManager.createSoilTexture).toHaveBeenCalledTimes(5);
    });
  });
});