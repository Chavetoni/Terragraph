import { VolumetricMeshGenerator } from './VolumetricMeshGenerator';
import { textureManager } from './TextureManager';
import * as THREE from 'three';

// Mock Three.js environment
global.THREE = THREE;

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

describe('VolumetricMeshGenerator - Texture Integration', () => {
  let testVolumeData;
  let textureSettings;
  let meshSettings;

  beforeEach(() => {
    testVolumeData = {
      vertices: [
        0, 0, 0,    // vertex 0
        10, 0, 0,   // vertex 1
        5, 10, 0,   // vertex 2
        5, 5, 10    // vertex 3
      ],
      indices: [
        0, 1, 2,    // face 1
        0, 1, 3,    // face 2
        1, 2, 3,    // face 3
        0, 2, 3     // face 4
      ],
      material: 'CL',
      color: '#8B4513',
      volume: 100.5,
      confidence: 0.85,
      metadata: {
        interpolationMethod: 'idw',
        gridResolution: 25
      }
    };

    textureSettings = {
      enabled: true,
      globalIntensity: 0.7,
      patternScale: 1.0
    };

    meshSettings = {
      opacity: 0.8,
      wireframe: false
    };

    jest.clearAllMocks();
    textureManager.clearCache();
  });

  afterEach(() => {
    textureManager.clearCache();
  });

  describe('Mesh Creation with Textures', () => {
    test('should create Three.js mesh with texture when enabled', () => {
      const mesh = VolumetricMeshGenerator.createThreeJsMesh(
        testVolumeData,
        meshSettings,
        null, // deprecated textureManager parameter
        textureSettings
      );

      expect(mesh).toBeInstanceOf(THREE.Mesh);
      expect(mesh.geometry).toBeInstanceOf(THREE.BufferGeometry);
      expect(mesh.material).toBeInstanceOf(THREE.MeshLambertMaterial);
      
      // Should have texture applied
      expect(mesh.material.map).toBeInstanceOf(THREE.CanvasTexture);
      expect(mesh.material.map.userData.materialType).toBe('cl');
    });

    test('should create mesh without texture when disabled', () => {
      const disabledSettings = { ...textureSettings, enabled: false };
      
      const mesh = VolumetricMeshGenerator.createThreeJsMesh(
        testVolumeData,
        meshSettings,
        null,
        disabledSettings
      );

      expect(mesh).toBeInstanceOf(THREE.Mesh);
      expect(mesh.material.map).toBeNull();
    });

    test('should handle null texture settings', () => {
      const mesh = VolumetricMeshGenerator.createThreeJsMesh(
        testVolumeData,
        meshSettings,
        null,
        null // null texture settings
      );

      expect(mesh).toBeInstanceOf(THREE.Mesh);
      expect(mesh.material.map).toBeNull();
    });

    test('should apply custom color when provided', () => {
      const customColor = '#FF0000';
      
      const mesh = VolumetricMeshGenerator.createThreeJsMesh(
        testVolumeData,
        meshSettings,
        null,
        textureSettings,
        customColor
      );

      expect(mesh.material.color).toBeInstanceOf(THREE.Color);
      expect(mesh.material.color.getHexString()).toBe('ff0000');
    });

    test('should use volume data color when no custom color provided', () => {
      const mesh = VolumetricMeshGenerator.createThreeJsMesh(
        testVolumeData,
        meshSettings,
        null,
        textureSettings
      );

      // Should use color from volume data
      expect(mesh.material.color).toBeInstanceOf(THREE.Color);
      expect(mesh.material.color.getHexString()).toBe('8b4513');
    });
  });

  describe('Texture Parameter Application', () => {
    test('should apply intensity settings to texture', () => {
      const lowIntensity = { ...textureSettings, globalIntensity: 0.3 };
      const highIntensity = { ...textureSettings, globalIntensity: 1.0 };

      const mesh1 = VolumetricMeshGenerator.createThreeJsMesh(testVolumeData, meshSettings, null, lowIntensity);
      const mesh2 = VolumetricMeshGenerator.createThreeJsMesh(testVolumeData, meshSettings, null, highIntensity);

      // Should create different textures due to different intensity
      expect(mesh1.material.map).not.toBe(mesh2.material.map);
      expect(mesh1.material.map.userData.settings.globalIntensity).toBe(0.3);
      expect(mesh2.material.map.userData.settings.globalIntensity).toBe(1.0);
    });

    test('should apply scale settings to texture', () => {
      const smallScale = { ...textureSettings, patternScale: 0.5 };
      const largeScale = { ...textureSettings, patternScale: 2.0 };

      const mesh1 = VolumetricMeshGenerator.createThreeJsMesh(testVolumeData, meshSettings, null, smallScale);
      const mesh2 = VolumetricMeshGenerator.createThreeJsMesh(testVolumeData, meshSettings, null, largeScale);

      // Should create different textures due to different scale
      expect(mesh1.material.map).not.toBe(mesh2.material.map);
      expect(mesh1.material.map.userData.settings.patternScale).toBe(0.5);
      expect(mesh2.material.map.userData.settings.patternScale).toBe(2.0);
    });

    test('should handle missing texture parameters with defaults', () => {
      const partialSettings = { enabled: true }; // Missing intensity and scale

      const mesh = VolumetricMeshGenerator.createThreeJsMesh(
        testVolumeData,
        meshSettings,
        null,
        partialSettings
      );

      expect(mesh.material.map).toBeInstanceOf(THREE.CanvasTexture);
      // Should use default values from TextureManager
    });
  });

  describe('Different Material Types', () => {
    const materialTests = [
      { material: 'CL', name: 'Clay', expectedPattern: 'clay' },
      { material: 'SW', name: 'Sand', expectedPattern: 'sand' },
      { material: 'GW', name: 'Gravel', expectedPattern: 'gravel' },
      { material: 'ML', name: 'Silt', expectedPattern: 'silt' },
      { material: 'OL', name: 'Organic', expectedPattern: 'organic' }
    ];

    materialTests.forEach(({ material, name, expectedPattern }) => {
      test(`should create appropriate texture for ${name} (${material})`, () => {
        const materialVolumeData = { ...testVolumeData, material };
        
        const mesh = VolumetricMeshGenerator.createThreeJsMesh(
          materialVolumeData,
          meshSettings,
          null,
          textureSettings
        );

        expect(mesh.material.map).toBeInstanceOf(THREE.CanvasTexture);
        expect(mesh.material.map.userData.materialType).toBe(material.toLowerCase());
        
        // Should use appropriate pattern for material type
        const patternType = textureManager.getPatternType(material);
        expect(patternType).toBe(expectedPattern);
      });
    });

    test('should handle unknown material types gracefully', () => {
      const unknownMaterialData = { ...testVolumeData, material: 'UNKNOWN_TYPE' };
      
      const mesh = VolumetricMeshGenerator.createThreeJsMesh(
        unknownMaterialData,
        meshSettings,
        null,
        textureSettings
      );

      expect(mesh.material.map).toBeInstanceOf(THREE.CanvasTexture);
      expect(mesh.material.map.userData.materialType).toBe('unknown_type');
      
      // Should fall back to clay pattern
      expect(textureManager.getPatternType('UNKNOWN_TYPE')).toBe('clay');
    });
  });

  describe('Texture Wrapping and Filtering', () => {
    test('should set proper texture wrapping mode', () => {
      const mesh = VolumetricMeshGenerator.createThreeJsMesh(
        testVolumeData,
        meshSettings,
        null,
        textureSettings
      );

      const texture = mesh.material.map;
      expect(texture.wrapS).toBe(THREE.RepeatWrapping);
      expect(texture.wrapT).toBe(THREE.RepeatWrapping);
    });

    test('should set proper texture filtering for crisp patterns', () => {
      const mesh = VolumetricMeshGenerator.createThreeJsMesh(
        testVolumeData,
        meshSettings,
        null,
        textureSettings
      );

      const texture = mesh.material.map;
      expect(texture.magFilter).toBe(THREE.NearestFilter);
      expect(texture.minFilter).toBe(THREE.NearestFilter);
    });

    test('should set texture repeat to 1,1 for element-based scaling', () => {
      const mesh = VolumetricMeshGenerator.createThreeJsMesh(
        testVolumeData,
        meshSettings,
        null,
        textureSettings
      );

      const texture = mesh.material.map;
      expect(texture.repeat.x).toBe(1);
      expect(texture.repeat.y).toBe(1);
    });
  });

  describe('Isolated Pocket Texture Support', () => {
    test('should apply textures to isolated pockets', () => {
      const pocketSettings = {
        material: 'SW',
        radius: 5.0,
        opacity: 0.7,
        depthRatio: 0.5,
        boreholeTotalDepth: 20,
        textureSettings: textureSettings
      };

      const pocket = VolumetricMeshGenerator.createIsolatedStrataPocket(pocketSettings);

      expect(pocket).toBeInstanceOf(THREE.Mesh);
      expect(pocket.material.map).toBeInstanceOf(THREE.CanvasTexture);
      expect(pocket.material.map.userData.materialType).toBe('sw');
    });

    test('should handle isolated pockets without texture settings', () => {
      const pocketSettings = {
        material: 'GW',
        radius: 3.0,
        opacity: 0.8,
        depthRatio: 0.3,
        boreholeTotalDepth: 15,
        textureSettings: null
      };

      const pocket = VolumetricMeshGenerator.createIsolatedStrataPocket(pocketSettings);

      expect(pocket).toBeInstanceOf(THREE.Mesh);
      expect(pocket.material.map).toBeNull();
    });

    test('should apply different textures to different pocket materials', () => {
      const clayPocket = VolumetricMeshGenerator.createIsolatedStrataPocket({
        material: 'CL',
        radius: 4.0,
        opacity: 0.7,
        depthRatio: 0.4,
        boreholeTotalDepth: 20,
        textureSettings: textureSettings
      });

      const sandPocket = VolumetricMeshGenerator.createIsolatedStrataPocket({
        material: 'SW',
        radius: 4.0,
        opacity: 0.7,
        depthRatio: 0.4,
        boreholeTotalDepth: 20,
        textureSettings: textureSettings
      });

      expect(clayPocket.material.map).not.toBe(sandPocket.material.map);
      expect(clayPocket.material.map.userData.materialType).toBe('cl');
      expect(sandPocket.material.map.userData.materialType).toBe('sw');
    });
  });

  describe('Mesh Metadata and Texture Information', () => {
    test('should include texture metadata in mesh userData', () => {
      const mesh = VolumetricMeshGenerator.createThreeJsMesh(
        testVolumeData,
        meshSettings,
        null,
        textureSettings
      );

      expect(mesh.userData).toBeDefined();
      expect(mesh.userData.material).toBe('CL');
      expect(mesh.userData.volume).toBe(100.5);
      expect(mesh.userData.confidence).toBe(0.85);
      
      // Should include texture-related metadata
      const texture = mesh.material.map;
      expect(texture.userData.materialType).toBe('cl');
      expect(texture.userData.settings).toBeDefined();
      expect(texture.userData.createdAt).toBeDefined();
    });

    test('should preserve original volume data metadata', () => {
      const mesh = VolumetricMeshGenerator.createThreeJsMesh(
        testVolumeData,
        meshSettings,
        null,
        textureSettings
      );

      expect(mesh.userData.metadata).toBeDefined();
      expect(mesh.userData.metadata.interpolationMethod).toBe('idw');
      expect(mesh.userData.metadata.gridResolution).toBe(25);
    });
  });

  describe('Texture Caching Integration', () => {
    test('should use cached textures for same material and settings', () => {
      const mesh1 = VolumetricMeshGenerator.createThreeJsMesh(testVolumeData, meshSettings, null, textureSettings);
      const mesh2 = VolumetricMeshGenerator.createThreeJsMesh(testVolumeData, meshSettings, null, textureSettings);

      // Should use same cached texture
      expect(mesh1.material.map).toBe(mesh2.material.map);
      
      // Verify cache hit
      const stats = textureManager.getCacheStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
    });

    test('should create different textures for different materials', () => {
      const clayData = { ...testVolumeData, material: 'CL' };
      const sandData = { ...testVolumeData, material: 'SW' };

      const clayMesh = VolumetricMeshGenerator.createThreeJsMesh(clayData, meshSettings, null, textureSettings);
      const sandMesh = VolumetricMeshGenerator.createThreeJsMesh(sandData, meshSettings, null, textureSettings);

      // Should have different textures
      expect(clayMesh.material.map).not.toBe(sandMesh.material.map);
      
      // Verify separate cache entries
      const stats = textureManager.getCacheStats();
      expect(stats.misses).toBe(2);
      expect(stats.hits).toBe(0);
    });

    test('should handle cache eviction gracefully', () => {
      // Set small cache size for testing
      textureManager.maxCacheSize = 2;

      const materials = ['CL', 'SW', 'GW'];
      const meshes = materials.map(material => {
        const volumeData = { ...testVolumeData, material };
        return VolumetricMeshGenerator.createThreeJsMesh(volumeData, meshSettings, null, textureSettings);
      });

      // All meshes should be valid despite cache eviction
      meshes.forEach(mesh => {
        expect(mesh.material.map).toBeInstanceOf(THREE.CanvasTexture);
      });

      // Cache should not exceed max size
      const stats = textureManager.getCacheStats();
      expect(stats.size).toBeLessThanOrEqual(2);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle malformed volume data', () => {
      const malformedData = {
        vertices: [], // empty vertices
        indices: [],
        material: 'CL'
      };

      expect(() => {
        VolumetricMeshGenerator.createThreeJsMesh(malformedData, meshSettings, null, textureSettings);
      }).not.toThrow();
    });

    test('should handle missing material in volume data', () => {
      const noMaterialData = {
        ...testVolumeData,
        material: null
      };

      const mesh = VolumetricMeshGenerator.createThreeJsMesh(noMaterialData, meshSettings, null, textureSettings);
      
      expect(mesh).toBeInstanceOf(THREE.Mesh);
      // Should still work, possibly with default material
    });

    test('should handle texture creation failure gracefully', () => {
      // Mock texture manager to simulate failure
      const originalCreateTexture = textureManager.createSoilTexture;
      textureManager.createSoilTexture = jest.fn(() => null);

      const mesh = VolumetricMeshGenerator.createThreeJsMesh(testVolumeData, meshSettings, null, textureSettings);
      
      expect(mesh).toBeInstanceOf(THREE.Mesh);
      expect(mesh.material.map).toBeNull();

      // Restore original method
      textureManager.createSoilTexture = originalCreateTexture;
    });

    test('should handle extreme texture settings values', () => {
      const extremeSettings = {
        enabled: true,
        globalIntensity: 10.0, // Way above normal range
        patternScale: -5.0     // Negative value
      };

      const mesh = VolumetricMeshGenerator.createThreeJsMesh(testVolumeData, meshSettings, null, extremeSettings);
      
      expect(mesh).toBeInstanceOf(THREE.Mesh);
      expect(mesh.material.map).toBeInstanceOf(THREE.CanvasTexture);
      
      // TextureManager should clamp values appropriately
    });
  });

  describe('Performance Considerations', () => {
    test('should handle multiple mesh creation efficiently', () => {
      const start = performance.now();
      
      const meshes = [];
      for (let i = 0; i < 50; i++) {
        const volumeData = {
          ...testVolumeData,
          material: ['CL', 'SW', 'GW', 'ML', 'OL'][i % 5]
        };
        meshes.push(VolumetricMeshGenerator.createThreeJsMesh(volumeData, meshSettings, null, textureSettings));
      }
      
      const end = performance.now();
      
      expect(meshes.length).toBe(50);
      expect(end - start).toBeLessThan(5000); // Should complete in reasonable time
      
      // Should benefit from texture caching
      const stats = textureManager.getCacheStats();
      expect(stats.hits).toBeGreaterThan(0);
    });

    test('should dispose of resources properly', () => {
      const mesh = VolumetricMeshGenerator.createThreeJsMesh(testVolumeData, meshSettings, null, textureSettings);
      
      // Should be able to dispose geometry and material
      expect(() => {
        mesh.geometry.dispose();
        mesh.material.dispose();
        if (mesh.material.map) {
          mesh.material.map.dispose();
        }
      }).not.toThrow();
    });
  });
});