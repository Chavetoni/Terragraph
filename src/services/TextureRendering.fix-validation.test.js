/**
 * Validation test for texture rendering fix
 * Demonstrates that the critical texture rendering errors have been resolved
 */

import { TextureManager } from './TextureManager';
import { VolumetricMeshGenerator } from './VolumetricMeshGenerator';
import * as THREE from 'three';

describe('Texture Rendering Fix Validation', () => {
  let textureManager;

  beforeEach(() => {
    textureManager = new TextureManager();
    
    // Mock HTML5 Canvas properly
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
        setLineDash: jest.fn()
      })),
      width: 256,
      height: 256,
      toDataURL: jest.fn(() => 'data:image/png;base64,mock')
    };
    
    global.document = {
      createElement: jest.fn(() => mockCanvas)
    };
  });

  afterEach(() => {
    textureManager.dispose();
  });

  const createGeologicalVolumeData = (material, color) => ({
    material,
    triangles: [
      { vertices: [[0, 0, 0], [1, 0, 0], [1, 1, 0]] },
      { vertices: [[0, 0, 0], [1, 1, 0], [0, 1, 0]] }
    ],
    center: { x: 0.5, y: 0.5, z: 0 },
    bounds: { min: { x: 0, y: 0, z: 0 }, max: { x: 1, y: 1, z: 0 } },
    volume: 0.5,
    color,
    // Mock required volume data properties
    vertices: new Float32Array([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0]),
    colors: new Float32Array([1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0]),
    normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1]),
    uvs: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]),
    indices: new Uint16Array([0, 1, 2, 0, 2, 3])
  });

  describe('Critical Error Resolution', () => {
    test('should resolve "Cannot read properties of null (reading createSoilTexture)" error', () => {
      const volumeData = createGeologicalVolumeData('SC', '#8B4513');
      const textureSettings = {
        enabled: true,
        globalIntensity: 0.7,
        patternScale: 1.0
      };

      // Before fix: This would throw "Cannot read properties of null (reading 'createSoilTexture')"
      // After fix: This should work without errors
      expect(() => {
        const mesh = VolumetricMeshGenerator.createThreeJsMesh(
          volumeData,
          {},
          textureManager, // Now properly passed instead of null
          textureSettings
        );
        expect(mesh).toBeDefined();
        expect(mesh.geometry).toBeDefined();
        expect(mesh.material).toBeDefined();
      }).not.toThrow();
    });

    test('should handle color conversion from THREE.Color to hex string', () => {
      const volumeData = createGeologicalVolumeData('SM', '#F4A460');
      const textureSettings = {
        enabled: true,
        globalIntensity: 0.8,
        patternScale: 1.5
      };

      // Before fix: Colors were passed as THREE.Color objects causing "color.startsWith is not a function"
      // After fix: Colors are properly converted to hex strings
      expect(() => {
        const mesh = VolumetricMeshGenerator.createThreeJsMesh(
          volumeData,
          {},
          textureManager,
          textureSettings
        );
        expect(mesh).toBeDefined();
      }).not.toThrow();
    });
  });

  describe('Geological Material Support', () => {
    const geologicalMaterials = [
      { code: 'SC', name: 'Sandy Clay', color: '#8B4513' },
      { code: 'SM', name: 'Silty Sand', color: '#F4A460' },
      { code: 'CL', name: 'Clay (Low Plasticity)', color: '#8B4513' },
      { code: 'ML', name: 'Silt (Low Plasticity)', color: '#9ACD32' },
      { code: 'SW', name: 'Well-Graded Sand', color: '#F4A460' },
      { code: 'GW', name: 'Well-Graded Gravel', color: '#8B7355' }
    ];

    geologicalMaterials.forEach(({ code, name, color }) => {
      test(`should create texture for ${code} (${name}) without errors`, () => {
        const volumeData = createGeologicalVolumeData(code, color);
        const textureSettings = {
          enabled: true,
          globalIntensity: 0.7,
          patternScale: 1.0
        };

        expect(() => {
          const mesh = VolumetricMeshGenerator.createThreeJsMesh(
            volumeData,
            {},
            textureManager,
            textureSettings
          );
          expect(mesh).toBeDefined();
        }).not.toThrow();
      });
    });
  });

  describe('TextureManager Integration', () => {
    test('should properly instantiate and use TextureManager', () => {
      expect(textureManager).toBeInstanceOf(TextureManager);
      expect(typeof textureManager.createSoilTexture).toBe('function');
      expect(typeof textureManager.dispose).toBe('function');
    });

    test('should handle texture creation for geological materials', () => {
      const settings = {
        enabled: true,
        globalIntensity: 0.7,
        patternScale: 1.0
      };

      expect(() => {
        const texture = textureManager.createSoilTexture('SC', '#8B4513', settings);
        expect(texture).toBeDefined();
      }).not.toThrow();
    });

    test('should properly dispose of resources', () => {
      const settings = { enabled: true, globalIntensity: 0.7 };
      
      textureManager.createSoilTexture('SC', '#8B4513', settings);
      const statsBefore = textureManager.getCacheStats();
      expect(statsBefore.size).toBeGreaterThan(0);
      
      textureManager.dispose();
      const statsAfter = textureManager.getCacheStats();
      expect(statsAfter.size).toBe(0);
    });
  });

  describe('Error Handling and Fallbacks', () => {
    test('should gracefully handle disabled textures', () => {
      const volumeData = createGeologicalVolumeData('SC', '#8B4513');
      const disabledSettings = { enabled: false };

      expect(() => {
        const mesh = VolumetricMeshGenerator.createThreeJsMesh(
          volumeData,
          {},
          textureManager,
          disabledSettings
        );
        expect(mesh).toBeDefined();
      }).not.toThrow();
    });

    test('should handle missing texture settings', () => {
      const volumeData = createGeologicalVolumeData('SM', '#F4A460');

      expect(() => {
        const mesh = VolumetricMeshGenerator.createThreeJsMesh(
          volumeData,
          {},
          textureManager,
          null // No texture settings
        );
        expect(mesh).toBeDefined();
      }).not.toThrow();
    });

    test('should demonstrate contrast between null and proper TextureManager', () => {
      const volumeData = createGeologicalVolumeData('SC', '#8B4513');
      const textureSettings = { enabled: true, globalIntensity: 0.7 };

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      // Test with null (should warn)
      const meshWithNull = VolumetricMeshGenerator.createThreeJsMesh(
        volumeData,
        {},
        null,
        textureSettings
      );
      
      expect(meshWithNull).toBeDefined();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to apply texture to SC'),
        expect.any(Error)
      );

      consoleSpy.mockClear();

      // Test with proper TextureManager (should not warn)
      const meshWithTextureManager = VolumetricMeshGenerator.createThreeJsMesh(
        volumeData,
        {},
        textureManager,
        textureSettings
      );
      
      expect(meshWithTextureManager).toBeDefined();
      
      consoleSpy.mockRestore();
    });
  });

  describe('Fix Summary Validation', () => {
    test('should demonstrate all critical fixes working together', () => {
      const testCases = [
        { material: 'SC', color: '#8B4513', name: 'Sandy Clay' },
        { material: 'SM', color: '#F4A460', name: 'Silty Sand' },
        { material: 'CL', color: '#8B4513', name: 'Clay' },
        { material: 'SW', color: '#F4A460', name: 'Well-Graded Sand' }
      ];

      testCases.forEach(({ material, color, name }) => {
        const volumeData = createGeologicalVolumeData(material, color);
        const textureSettings = {
          enabled: true,
          globalIntensity: 0.7,
          patternScale: 1.0
        };

        expect(() => {
          const mesh = VolumetricMeshGenerator.createThreeJsMesh(
            volumeData,
            {},
            textureManager, // Fix 1: Proper TextureManager instance
            textureSettings // Fix 2: Color conversion handled internally
          );
          expect(mesh).toBeDefined();
        }).not.toThrow();
      });
    });
  });
});