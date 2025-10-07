// Integration tests for complete USCS materials and texture workflow
jest.doMock('three', () => {
  const mockGeometry = {
    dispose: jest.fn(),
    setIndex: jest.fn(),
    setAttribute: jest.fn(),
    computeVertexNormals: jest.fn(),
    computeBoundingBox: jest.fn(),
    computeBoundingSphere: jest.fn(),
    deleteAttribute: jest.fn(),
    getAttribute: jest.fn(),
    scale: jest.fn(),
    translate: jest.fn(),
    rotateX: jest.fn(),
    rotateY: jest.fn(),
    rotateZ: jest.fn(),
    attributes: {
      position: { array: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]) },
      uv: { array: new Float32Array([0, 0, 1, 0, 0.5, 1]) }
    }
  };

  const mockTexture = {
    dispose: jest.fn(),
    userData: {},
    wrapS: 1000,
    wrapT: 1000,
    repeat: { set: jest.fn() },
    offset: { set: jest.fn() },
    needsUpdate: true
  };

  const mockMaterial = {
    dispose: jest.fn(),
    color: { setHex: jest.fn() },
    map: mockTexture,
    transparent: true,
    opacity: 1.0,
    side: 2
  };

  const mockModule = {
    BufferGeometry: jest.fn(() => mockGeometry),
    BufferAttribute: jest.fn((array, itemSize) => ({ array, itemSize })),
    MeshLambertMaterial: jest.fn(() => mockMaterial),
    MeshBasicMaterial: jest.fn(() => mockMaterial),
    MeshPhysicalMaterial: jest.fn(() => mockMaterial),
    Mesh: jest.fn((geometry, material) => ({ geometry, material, userData: {} })),
    Vector3: jest.fn((x = 0, y = 0, z = 0) => ({ x, y, z })),
    Color: jest.fn(() => ({ setHex: jest.fn(), r: 1, g: 1, b: 1 })),
    Texture: jest.fn(() => mockTexture),
    CanvasTexture: jest.fn(() => mockTexture),
    DoubleSide: 2,
    FrontSide: 0,
    BackSide: 1,
    RepeatWrapping: 1000
  };

  return mockModule;
});

import { VolumetricMeshGenerator } from '../services/VolumetricMeshGenerator';
import { 
  STANDARD_MATERIALS, 
  normalizeMaterialName, 
  getMaterialProperties, 
  getMaterialCategory 
} from '../utils/materialStandardization';
import { Borehole } from '../models/Borehole';

describe('USCS Materials and Texture Integration Workflow', () => {
  beforeEach(() => {
    // Mock canvas for texture tests
    const mockCanvas = {
      getContext: jest.fn(() => ({
        beginPath: jest.fn(),
        moveTo: jest.fn(),
        lineTo: jest.fn(),
        arc: jest.fn(),
        rect: jest.fn(),
        stroke: jest.fn(),
        fill: jest.fn(),
        closePath: jest.fn(),
        save: jest.fn(),
        restore: jest.fn(),
        translate: jest.fn(),
        rotate: jest.fn(),
        scale: jest.fn(),
        setLineDash: jest.fn(),
        clearRect: jest.fn(),
        fillRect: jest.fn(),
        strokeRect: jest.fn(),
        fillStyle: '#000000',
        strokeStyle: '#000000',
        lineWidth: 1,
        globalAlpha: 1,
        createLinearGradient: jest.fn(() => ({
          addColorStop: jest.fn()
        })),
        createRadialGradient: jest.fn(() => ({
          addColorStop: jest.fn()
        }))
      })),
      width: 256,
      height: 256,
      toDataURL: jest.fn(() => 'data:image/png;base64,mockdata')
    };

    global.document = {
      createElement: jest.fn(() => mockCanvas)
    };

    jest.clearAllMocks();
  });

  afterEach(() => {
    delete global.document;
  });

  describe('Complete USCS Material Workflow', () => {
    test('processes complete geological sequence with USCS materials', () => {
      // Create boreholes with various USCS materials
      const uscsBoreholes = [
        new Borehole({
          id: 'uscs_bh1',
          x: 0, z: 0,
          layers: [
            { material: 'CL', from: 0, to: 5, thickness: 5, color: '#A0522D' },    // Lean clay
            { material: 'SM', from: 5, to: 12, thickness: 7, color: '#D2B48C' },   // Silty sand  
            { material: 'GW', from: 12, to: 20, thickness: 8, color: '#D2691E' }   // Well-graded gravel
          ],
          depth: 20
        }),
        new Borehole({
          id: 'uscs_bh2', 
          x: 15, z: 0,
          layers: [
            { material: 'CL', from: 0, to: 7, thickness: 7, color: '#A0522D' },
            { material: 'SM', from: 7, to: 14, thickness: 7, color: '#D2B48C' },
            { material: 'GW', from: 14, to: 22, thickness: 8, color: '#D2691E' }
          ],
          depth: 22
        }),
        new Borehole({
          id: 'uscs_bh3',
          x: 8, z: 12,
          layers: [
            { material: 'CL', from: 0, to: 6, thickness: 6, color: '#A0522D' },
            { material: 'SM', from: 6, to: 13, thickness: 7, color: '#D2B48C' },
            { material: 'GW', from: 13, to: 21, thickness: 8, color: '#D2691E' }
          ],
          depth: 21
        })
      ];

      // Step 1: Material normalization
      uscsBoreholes.forEach(borehole => {
        borehole.layers.forEach(layer => {
          const normalizedMaterial = normalizeMaterialName(layer.material);
          expect(['CL', 'SM', 'GW']).toContain(normalizedMaterial);
          
          const properties = getMaterialProperties(normalizedMaterial);
          expect(properties).toBeDefined();
          expect(properties.pattern).toBeDefined();
          expect(properties.color).toBeDefined();
          expect(properties.category).toBeDefined();
        });
      });

      // Step 2: Generate 3D geological volumes
      const textureSettings = { intensity: 0.8, scale: 1.0, showTextures: true };
      const volumes = VolumetricMeshGenerator.generateStratigraphy(uscsBoreholes, { 
        gridResolution: 15,
        textureSettings 
      });

      expect(volumes).toBeDefined();
      expect(Array.isArray(volumes)).toBe(true);
      expect(volumes.length).toBeGreaterThan(0);

      // Should have volumes for each material
      const clVolumes = volumes.filter(v => v.material === 'CL');
      const smVolumes = volumes.filter(v => v.material === 'SM');
      const gwVolumes = volumes.filter(v => v.material === 'GW');

      expect(clVolumes.length).toBeGreaterThan(0);
      expect(smVolumes.length).toBeGreaterThan(0);
      expect(gwVolumes.length).toBeGreaterThan(0);

      // Step 3: Create Three.js meshes with USCS textures
      volumes.forEach(volume => {
        const mesh = VolumetricMeshGenerator.createThreeJsMesh(volume, {}, null, textureSettings);
        
        expect(mesh).toBeDefined();
        expect(mesh.geometry).toBeDefined();
        expect(mesh.material).toBeDefined();
        
        // Validate texture application
        if (textureSettings.showTextures && mesh.material.map) {
          expect(mesh.material.map.userData.material).toBe(volume.material);
          
          // Verify pattern matches USCS classification
          const expectedPattern = VolumetricMeshGenerator.getDefaultPattern(volume.material);
          expect(mesh.material.map.userData.pattern).toBe(expectedPattern);
        }
      });
    });

    test('handles mixed USCS and legacy materials seamlessly', () => {
      const mixedBoreholes = [
        new Borehole({
          id: 'mixed_bh1',
          x: 0, z: 0,
          layers: [
            { material: 'CLAY', from: 0, to: 4, thickness: 4, color: '#A0522D' },      // Legacy 
            { material: 'CH', from: 4, to: 8, thickness: 4, color: '#8B4513' },        // USCS
            { material: 'sand', from: 8, to: 15, thickness: 7, color: '#F4A460' }      // Legacy lowercase
          ],
          depth: 15
        }),
        new Borehole({
          id: 'mixed_bh2',
          x: 10, z: 0, 
          layers: [
            { material: 'cl', from: 0, to: 5, thickness: 5, color: '#A0522D' },        // USCS lowercase
            { material: 'CH', from: 5, to: 9, thickness: 4, color: '#8B4513' },
            { material: 'SW', from: 9, to: 16, thickness: 7, color: '#F4A460' }        // USCS
          ],
          depth: 16
        }),
        new Borehole({
          id: 'mixed_bh3',
          x: 5, z: 8,
          layers: [
            { material: 'lean clay', from: 0, to: 4, thickness: 4, color: '#A0522D' }, // Alias
            { material: 'fat clay', from: 4, to: 8, thickness: 4, color: '#8B4513' },  // Alias  
            { material: 'well-graded sand', from: 8, to: 15, thickness: 7, color: '#F4A460' } // Alias
          ],
          depth: 15
        })
      ];

      // Material normalization should handle all variants
      const expectedNormalization = {
        'CLAY': 'CLAY',
        'CH': 'CH', 
        'sand': 'SAND',
        'cl': 'CL',
        'SW': 'SW',
        'lean clay': 'CL',
        'fat clay': 'CH',
        'well-graded sand': 'SW'
      };

      mixedBoreholes.forEach(borehole => {
        borehole.layers.forEach(layer => {
          const normalized = normalizeMaterialName(layer.material);
          const expected = expectedNormalization[layer.material];
          
          expect(normalized).toBe(expected);
          
          // All should have valid properties
          const properties = getMaterialProperties(normalized);
          expect(properties).toBeDefined();
          expect(properties.pattern).toBeDefined();
          expect(properties.color).toBeDefined();
        });
      });

      // Generate volumes with mixed materials
      const volumes = VolumetricMeshGenerator.generateStratigraphy(mixedBoreholes, { 
        gridResolution: 12 
      });

      expect(volumes).toBeDefined();
      expect(volumes.length).toBeGreaterThan(0);

      // Should process all materials successfully
      const materialTypes = volumes.map(v => v.material);
      expect(materialTypes).toContain('CL');  // From various sources
      expect(materialTypes).toContain('CH');  // From various sources
      expect(materialTypes).toContain('SW');  // From SW and aliases
    });

    test('validates geological consistency across USCS workflow', () => {
      // Create geologically reasonable sequence
      const geologicalSequence = [
        new Borehole({
          id: 'geo_bh1',
          x: 0, z: 0,
          layers: [
            { material: 'TOPSOIL', from: 0, to: 1, thickness: 1, color: '#654321' },  // Surface
            { material: 'CL', from: 1, to: 5, thickness: 4, color: '#A0522D' },       // Lean clay
            { material: 'ML', from: 5, to: 8, thickness: 3, color: '#B8860B' },       // Silt
            { material: 'SW', from: 8, to: 15, thickness: 7, color: '#F4A460' },      // Sand
            { material: 'ROCK', from: 15, to: 20, thickness: 5, color: '#708090' }    // Bedrock
          ],
          depth: 20
        }),
        new Borehole({
          id: 'geo_bh2',
          x: 12, z: 0,
          layers: [
            { material: 'TOPSOIL', from: 0, to: 0.5, thickness: 0.5, color: '#654321' },
            { material: 'CL', from: 0.5, to: 6, thickness: 5.5, color: '#A0522D' },
            { material: 'ML', from: 6, to: 9, thickness: 3, color: '#B8860B' },
            { material: 'SW', from: 9, to: 16, thickness: 7, color: '#F4A460' },
            { material: 'ROCK', from: 16, to: 22, thickness: 6, color: '#708090' }
          ],
          depth: 22
        }),
        new Borehole({
          id: 'geo_bh3',
          x: 6, z: 10,
          layers: [
            { material: 'TOPSOIL', from: 0, to: 1.5, thickness: 1.5, color: '#654321' },
            { material: 'CL', from: 1.5, to: 7, thickness: 5.5, color: '#A0522D' },
            { material: 'ML', from: 7, to: 10, thickness: 3, color: '#B8860B' },
            { material: 'SW', from: 10, to: 17, thickness: 7, color: '#F4A460' },
            { material: 'ROCK', from: 17, to: 23, thickness: 6, color: '#708090' }
          ],
          depth: 23
        })
      ];

      // Validate geological sequence
      geologicalSequence.forEach(borehole => {
        // Check material categories are geologically reasonable
        const surfaceMaterials = borehole.layers.filter(l => l.from < 2);
        const deepMaterials = borehole.layers.filter(l => l.from > 15);

        surfaceMaterials.forEach(layer => {
          const category = getMaterialCategory(normalizeMaterialName(layer.material));
          expect(['SURFACE', 'FINE_GRAINED_LOW']).toContain(category);
        });

        deepMaterials.forEach(layer => {
          const category = getMaterialCategory(normalizeMaterialName(layer.material));
          expect(['COARSE_GRAINED', 'BEDROCK']).toContain(category);
        });
      });

      // Generate geological model
      const volumes = VolumetricMeshGenerator.generateStratigraphy(geologicalSequence, { 
        gridResolution: 10 
      });

      expect(volumes).toBeDefined();
      expect(volumes.length).toBeGreaterThan(0);

      // Should create volumes for most materials (some may be filtered)
      const materialTypes = new Set(volumes.map(v => v.material));
      expect(materialTypes.size).toBeGreaterThan(2); // At least major materials

      // Validate pattern appropriateness for geological context
      volumes.forEach(volume => {
        const pattern = VolumetricMeshGenerator.getDefaultPattern(volume.material);
        
        if (volume.material === 'CL') {
          expect(pattern).toBe('horizontal_dashed'); // Clay laminations
        } else if (volume.material === 'ML') {
          expect(pattern).toBe('horizontal_lines'); // Silt layers
        } else if (volume.material === 'SW') {
          expect(pattern).toBe('sand_dots'); // Granular sand
        } else if (volume.material === 'ROCK') {
          expect(pattern).toBe('rock_pattern'); // Rock structure
        }
      });
    });
  });

  describe('Legacy Material Migration', () => {
    test('migrates existing legacy data to USCS equivalents', () => {
      const legacyBoreholes = [
        new Borehole({
          id: 'legacy_bh1',
          x: 0, z: 0,
          layers: [
            { material: 'CLAY', from: 0, to: 8, thickness: 8, color: '#A0522D' },
            { material: 'SAND', from: 8, to: 16, thickness: 8, color: '#F4A460' },
            { material: 'GRAVEL', from: 16, to: 22, thickness: 6, color: '#D2691E' }
          ],
          depth: 22
        }),
        new Borehole({
          id: 'legacy_bh2',
          x: 10, z: 0,
          layers: [
            { material: 'SILT', from: 0, to: 6, thickness: 6, color: '#B8860B' },
            { material: 'CLAY', from: 6, to: 12, thickness: 6, color: '#A0522D' },
            { material: 'SAND', from: 12, to: 20, thickness: 8, color: '#F4A460' }
          ],
          depth: 20
        }),
        new Borehole({
          id: 'legacy_bh3',
          x: 5, z: 8,
          layers: [
            { material: 'PEAT', from: 0, to: 2, thickness: 2, color: '#2F4F4F' },
            { material: 'CLAY', from: 2, to: 10, thickness: 8, color: '#A0522D' },
            { material: 'ROCK', from: 10, to: 18, thickness: 8, color: '#708090' }
          ],
          depth: 18
        })
      ];

      // Validate legacy material mapping to USCS
      const legacyToUSCS = {
        'CLAY': 'CL',
        'SAND': 'SW', 
        'GRAVEL': 'GW',
        'SILT': 'ML',
        'PEAT': 'PT'
      };

      legacyBoreholes.forEach(borehole => {
        borehole.layers.forEach(layer => {
          const normalized = normalizeMaterialName(layer.material);
          
          if (legacyToUSCS[layer.material]) {
            // Should maintain legacy material name but have USCS equivalent
            expect(normalized).toBe(layer.material);
            
            const properties = getMaterialProperties(normalized);
            expect(properties.uscsEquivalent).toBe(legacyToUSCS[layer.material]);
          }
        });
      });

      // Generate volumes - should work with legacy materials
      const volumes = VolumetricMeshGenerator.generateStratigraphy(legacyBoreholes, { 
        gridResolution: 10 
      });

      expect(volumes).toBeDefined();
      expect(volumes.length).toBeGreaterThan(0);

      // Legacy materials should have appropriate patterns
      volumes.forEach(volume => {
        const pattern = VolumetricMeshGenerator.getDefaultPattern(volume.material);
        
        switch (volume.material) {
          case 'CLAY':
            expect(pattern).toBe('horizontal_dashed');
            break;
          case 'SAND':
            expect(pattern).toBe('sand_dots');
            break;
          case 'GRAVEL':
            expect(pattern).toBe('gravel_circles');
            break;
          case 'SILT':
            expect(pattern).toBe('horizontal_lines');
            break;
          case 'PEAT':
            expect(pattern).toBe('organic_irregular');
            break;
          case 'ROCK':
            expect(pattern).toBe('rock_pattern');
            break;
        }
      });
    });

    test('backward compatibility maintains existing workflows', () => {
      // Simulate existing codebase using legacy materials
      const existingData = [
        { material: 'clay', description: 'Brown clay layer' },
        { material: 'SAND', description: 'Medium sand' },
        { material: 'Rock', description: 'Limestone bedrock' },
        { material: 'silty clay', description: 'Mixed fine material' }
      ];

      existingData.forEach(layer => {
        // Old workflow should still work
        const normalized = normalizeMaterialName(layer.material);
        expect(normalized).toBeDefined();
        expect(normalized).not.toBe('UNKNOWN');

        const properties = getMaterialProperties(normalized);
        expect(properties).toBeDefined();
        expect(properties.color).toBeDefined();
        expect(properties.pattern).toBeDefined();

        // Create texture - should not fail
        const texture = VolumetricMeshGenerator.createTexture(normalized, { 
          intensity: 0.7, scale: 1.0, showTextures: true 
        });
        expect(texture).toBeDefined();
      });
    });
  });

  describe('Texture Pattern Workflow Integration', () => {
    test('complete texture generation workflow for USCS materials', () => {
      const uscsTestSuite = [
        { material: 'GW', expectedPattern: 'gravel_circles', category: 'COARSE_GRAINED' },
        { material: 'SW', expectedPattern: 'sand_dots', category: 'COARSE_GRAINED' },
        { material: 'CL', expectedPattern: 'horizontal_dashed', category: 'FINE_GRAINED_LOW' },
        { material: 'CH', expectedPattern: 'diagonal_crosshatch', category: 'FINE_GRAINED_HIGH' },
        { material: 'PT', expectedPattern: 'organic_irregular', category: 'HIGHLY_ORGANIC' }
      ];

      uscsTestSuite.forEach(({ material, expectedPattern, category }) => {
        // Step 1: Material properties
        const properties = getMaterialProperties(material);
        expect(properties.pattern).toBe(expectedPattern);
        expect(properties.category).toBe(category);

        // Step 2: Pattern selection
        const selectedPattern = VolumetricMeshGenerator.getDefaultPattern(material);
        expect(selectedPattern).toBe(expectedPattern);

        // Step 3: Texture creation
        const settings = { intensity: 0.8, scale: 1.5, showTextures: true };
        const texture = VolumetricMeshGenerator.createTexture(material, settings);
        
        expect(texture).toBeDefined();
        expect(texture.userData.material).toBe(material);
        expect(texture.userData.pattern).toBe(expectedPattern);

        // Step 4: 3D mesh integration
        const volumeData = {
          material: material,
          vertices: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
          indices: new Uint32Array([0, 1, 2]),
          colors: new Float32Array(Array(9).fill(0.5)),
          normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]),
          uvs: new Float32Array([0, 0, 1, 0, 0.5, 1]),
          vertexCount: 3,
          indexCount: 3
        };

        const mesh = VolumetricMeshGenerator.createThreeJsMesh(volumeData, {}, null, settings);
        
        expect(mesh).toBeDefined();
        expect(mesh.material.map).toBeDefined();
        expect(mesh.material.map.userData.material).toBe(material);
        expect(mesh.material.map.userData.pattern).toBe(expectedPattern);
      });
    });

    test('texture settings propagate correctly through workflow', () => {
      const materials = ['GW', 'CL', 'PT'];
      const settingsVariants = [
        { intensity: 0.3, scale: 0.5, showTextures: true },
        { intensity: 0.9, scale: 2.0, showTextures: true },
        { intensity: 0.7, scale: 1.0, showTextures: false }
      ];

      materials.forEach(material => {
        settingsVariants.forEach(settings => {
          const texture = VolumetricMeshGenerator.createTexture(material, settings);
          
          if (settings.showTextures) {
            expect(texture).toBeDefined();
            expect(texture.userData).toBeDefined();
          } else {
            expect(texture).toBeDefined(); // Should still create texture but handle disabled state
          }

          // Create mesh with these settings
          const volumeData = {
            material: material,
            vertices: new Float32Array(9),
            indices: new Uint32Array(3),
            colors: new Float32Array(9),
            normals: new Float32Array(9),
            uvs: new Float32Array(6),
            vertexCount: 3,
            indexCount: 3
          };

          expect(() => {
            VolumetricMeshGenerator.createThreeJsMesh(volumeData, {}, null, settings);
          }).not.toThrow();
        });
      });
    });
  });

  describe('Performance and Memory Management', () => {
    test('complete workflow performs within acceptable bounds', () => {
      // Create moderate-sized dataset
      const performanceTestBoreholes = Array.from({ length: 8 }, (_, i) => {
        const uscsSequence = ['CL', 'SM', 'GW', 'CH', 'SW'];
        const layers = uscsSequence.map((material, idx) => ({
          material,
          from: idx * 3,
          to: (idx + 1) * 3,
          thickness: 3,
          color: STANDARD_MATERIALS[material].color
        }));

        return new Borehole({
          id: `perf_bh${i}`,
          x: i * 5,
          z: (i % 2) * 10,
          layers,
          depth: 15
        });
      });

      const startTime = performance.now();

      // Complete workflow
      const volumes = VolumetricMeshGenerator.generateStratigraphy(performanceTestBoreholes, { 
        gridResolution: 12 
      });

      const textureSettings = { intensity: 0.7, scale: 1.0, showTextures: true };
      const meshes = volumes.map(volume => 
        VolumetricMeshGenerator.createThreeJsMesh(volume, {}, null, textureSettings)
      );

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      // Should complete within reasonable time
      expect(totalTime).toBeLessThan(1000); // 1 second
      expect(volumes.length).toBeGreaterThan(0);
      expect(meshes.length).toBe(volumes.length);
      
      meshes.forEach(mesh => {
        expect(mesh).toBeDefined();
        expect(mesh.geometry).toBeDefined();
        expect(mesh.material).toBeDefined();
      });
    });

    test('memory cleanup works correctly', () => {
      const materials = ['GW', 'SW', 'CL', 'CH', 'PT'];
      const textures = [];
      const meshes = [];

      // Create multiple textures and meshes
      materials.forEach(material => {
        for (let i = 0; i < 3; i++) {
          const texture = VolumetricMeshGenerator.createTexture(material, { 
            intensity: 0.7, scale: 1.0, showTextures: true 
          });
          textures.push(texture);

          const volumeData = {
            material: material,
            vertices: new Float32Array(9),
            indices: new Uint32Array(3),
            colors: new Float32Array(9),
            normals: new Float32Array(9),
            uvs: new Float32Array(6),
            vertexCount: 3,
            indexCount: 3
          };

          const mesh = VolumetricMeshGenerator.createThreeJsMesh(volumeData, {}, null, { 
            intensity: 0.7, scale: 1.0, showTextures: true 
          });
          meshes.push(mesh);
        }
      });

      // All should be created successfully
      expect(textures.length).toBe(15);
      expect(meshes.length).toBe(15);

      // Cleanup should not throw errors
      expect(() => {
        textures.forEach(texture => {
          if (texture && texture.dispose) {
            texture.dispose();
          }
        });

        meshes.forEach(mesh => {
          if (mesh && mesh.geometry && mesh.geometry.dispose) {
            mesh.geometry.dispose();
          }
          if (mesh && mesh.material && mesh.material.dispose) {
            mesh.material.dispose();
          }
        });
      }).not.toThrow();
    });
  });

  describe('Error Recovery and Edge Cases', () => {
    test('workflow handles corrupted material data gracefully', () => {
      const corruptedBoreholes = [
        new Borehole({
          id: 'corrupt_bh1',
          x: 0, z: 0,
          layers: [
            { material: '', from: 0, to: 5, thickness: 5, color: '#000000' },           // Empty material
            { material: 'INVALID_USCS', from: 5, to: 10, thickness: 5, color: '#000000' }, // Invalid USCS
            { material: null, from: 10, to: 15, thickness: 5, color: '#000000' }        // Null material
          ],
          depth: 15
        }),
        new Borehole({
          id: 'corrupt_bh2',
          x: 10, z: 0,
          layers: [
            { material: 'GW', from: 0, to: 8, thickness: 8, color: '#D2691E' },        // Valid USCS
            { material: 'random text', from: 8, to: 12, thickness: 4, color: '#000000' } // Random text
          ],
          depth: 12
        })
      ];

      // Should handle corrupted data without crashing
      expect(() => {
        corruptedBoreholes.forEach(borehole => {
          borehole.layers.forEach(layer => {
            const normalized = normalizeMaterialName(layer.material);
            expect(normalized).toBeDefined();
            
            const properties = getMaterialProperties(normalized);
            expect(properties).toBeDefined();
          });
        });
      }).not.toThrow();

      // Volume generation should handle corrupted data
      expect(() => {
        const volumes = VolumetricMeshGenerator.generateStratigraphy(corruptedBoreholes, { 
          gridResolution: 8 
        });
        expect(Array.isArray(volumes)).toBe(true);
      }).not.toThrow();
    });

    test('workflow recovers from texture generation failures', () => {
      // Temporarily break canvas creation
      const originalCreateElement = global.document?.createElement;
      
      const materials = ['GW', 'CL'];
      
      materials.forEach(material => {
        // Break canvas creation
        if (global.document) {
          global.document.createElement = jest.fn(() => null);
        }

        expect(() => {
          const texture = VolumetricMeshGenerator.createTexture(material, { 
            intensity: 0.7, scale: 1.0, showTextures: true 
          });
          // Should handle failure gracefully
        }).not.toThrow();

        // Restore canvas creation  
        if (global.document && originalCreateElement) {
          global.document.createElement = originalCreateElement;
        }
      });
    });
  });
});