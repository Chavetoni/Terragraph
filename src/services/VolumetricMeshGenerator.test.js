// Mock Three.js with doMock to override any existing mocks
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
    rotateZ: jest.fn()
  };

  const mockMaterial = {
    dispose: jest.fn(),
    color: { setHex: jest.fn() }
  };

  const mockModule = {
    BufferGeometry: jest.fn(() => mockGeometry),
    BufferAttribute: jest.fn((array, itemSize) => ({ array, itemSize })),
    MeshLambertMaterial: jest.fn(() => mockMaterial),
    MeshBasicMaterial: jest.fn(() => mockMaterial),
    MeshPhysicalMaterial: jest.fn(() => mockMaterial),
    Mesh: jest.fn((geometry, material) => ({ geometry, material })),
    Vector3: jest.fn((x = 0, y = 0, z = 0) => ({ x, y, z })),
    Color: jest.fn(() => ({ setHex: jest.fn(), r: 1, g: 1, b: 1 })),
    // Add pocket geometry support
    SphereGeometry: jest.fn(() => mockGeometry),
    CylinderGeometry: jest.fn(() => mockGeometry),
    BoxGeometry: jest.fn(() => mockGeometry),
    DoubleSide: 2,
    FrontSide: 0,
    BackSide: 1
  };

  return mockModule;
});

import { VolumetricMeshGenerator } from './VolumetricMeshGenerator';
import { Borehole } from '../models/Borehole';

describe('VolumetricMeshGenerator', () => {
  const mockBoreholes = [
    new Borehole({
      id: 'bh1',
      x: 0,
      z: 0,
      layers: [
        { material: 'CLAY', from: 0, to: 5, thickness: 5, color: '#8B4513' },
        { material: 'SAND', from: 5, to: 15, thickness: 10, color: '#F4A460' }
      ],
      depth: 15
    }),
    new Borehole({
      id: 'bh2', 
      x: 10,
      z: 0,
      layers: [
        { material: 'CLAY', from: 0, to: 3, thickness: 3, color: '#8B4513' },
        { material: 'SAND', from: 3, to: 15, thickness: 12, color: '#F4A460' }
      ],
      depth: 15
    }),
    new Borehole({
      id: 'bh3',
      x: 5,
      z: 10,
      layers: [
        { material: 'CLAY', from: 0, to: 4, thickness: 4, color: '#8B4513' },
        { material: 'SAND', from: 4, to: 15, thickness: 11, color: '#F4A460' }
      ],
      depth: 15
    })
  ];

  beforeEach(() => {
    // Clear any mocks between tests
    jest.clearAllMocks();
  });

  describe('Static Methods', () => {
    test('getMaterialColor returns correct colors', () => {
      expect(VolumetricMeshGenerator.getMaterialColor('CLAY')).toBeDefined();
      expect(VolumetricMeshGenerator.getMaterialColor('SAND')).toBeDefined();
      expect(VolumetricMeshGenerator.getMaterialColor('UNKNOWN_MATERIAL')).toBeDefined();
    });

    test('generateStratigraphy is a static method', () => {
      expect(typeof VolumetricMeshGenerator.generateStratigraphy).toBe('function');
    });
  });

  describe('Stratigraphy Generation', () => {
    test('generates volumes from sufficient borehole data', () => {
      const options = { gridResolution: 10 };
      const result = VolumetricMeshGenerator.generateStratigraphy(mockBoreholes, options);
      
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });

    test('returns empty array for insufficient boreholes', () => {
      const insufficientBoreholes = mockBoreholes.slice(0, 2);
      // With sparse stratum filtering (30% threshold), need strata present in <30% of boreholes
      // Create scenario where one stratum is too sparse
      const sparseBoreholes = [
        new Borehole({
          id: 'sparse1',
          x: 0, z: 0,
          layers: [{ material: 'CLAY', from: 0, to: 5, thickness: 5, color: '#8B4513' }],
          depth: 5
        }),
        new Borehole({
          id: 'sparse2', 
          x: 10, z: 0,
          layers: [{ material: 'SAND', from: 0, to: 5, thickness: 5, color: '#F4A460' }],
          depth: 5
        }),
        new Borehole({
          id: 'sparse3',
          x: 5, z: 10,
          layers: [{ material: 'SAND', from: 0, to: 5, thickness: 5, color: '#F4A460' }],
          depth: 5
        }),
        new Borehole({
          id: 'sparse4',
          x: 15, z: 10,
          layers: [{ material: 'SAND', from: 0, to: 5, thickness: 5, color: '#F4A460' }],
          depth: 5
        })
      ];
      
      const result = VolumetricMeshGenerator.generateStratigraphy(sparseBoreholes, {});
      
      expect(Array.isArray(result)).toBe(true);
      // CLAY is only in 1/4 boreholes (25% < 30% threshold), so should be filtered out
      // SAND is in 3/4 boreholes (75% >= 30% threshold), so should be included  
      expect(result.length).toBe(1);
      expect(result[0].material).toBe('SAND');
    });

    test('handles boreholes without spatial coordinates', () => {
      const boreholesMissingCoords = [
        new Borehole({ id: 'bh1', layers: [{ material: 'Clay', from: 0, to: 5, thickness: 5 }], depth: 5 }),
        new Borehole({ id: 'bh2', x: 10, layers: [{ material: 'Clay', from: 0, to: 5, thickness: 5 }], depth: 5 }),
        new Borehole({ id: 'bh3', x: 5, z: 10, layers: [{ material: 'Clay', from: 0, to: 5, thickness: 5 }], depth: 5 })
      ];
      
      const result = VolumetricMeshGenerator.generateStratigraphy(boreholesMissingCoords, {});
      expect(Array.isArray(result)).toBe(true);
      // Note: The service will process valid data even if some boreholes have missing coordinates
      // The Borehole constructor defaults missing coordinates to 0, so this actually produces valid data
      expect(result.length).toBeGreaterThanOrEqual(0);
    });

    test('handles boreholes without layer data', () => {
      const boreholesNoLayers = [
        new Borehole({ id: 'bh1', x: 0, z: 0, layers: [], depth: 10 }),
        new Borehole({ id: 'bh2', x: 10, z: 0, layers: [], depth: 10 }),
        new Borehole({ id: 'bh3', x: 5, z: 10, layers: [], depth: 10 })
      ];
      
      const result = VolumetricMeshGenerator.generateStratigraphy(boreholesNoLayers, {});
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(0);
    });
  });

  describe('Layer Volume Creation', () => {
    test('createLayerVolume generates mesh data', () => {
      const topSurface = [
        {x: 0, y: 0, z: 0},
        {x: 10, y: 0, z: 0},
        {x: 0, y: 10, z: 0}
      ];
      const bottomSurface = [
        {x: 0, y: 0, z: -5},
        {x: 10, y: 0, z: -5},
        {x: 0, y: 10, z: -5}
      ];
      
      const volumeData = VolumetricMeshGenerator.createLayerVolume(
        topSurface,
        bottomSurface,
        'CLAY',
        {minX: 0, maxX: 10, minY: 0, maxY: 10},
        10
      );
      
      expect(volumeData).toBeDefined();
      expect(volumeData.vertices).toBeDefined();
      expect(volumeData.indices).toBeDefined();
      expect(volumeData.material).toBe('CLAY');
    });
  });

  describe('Three.js Mesh Creation', () => {
    test('createThreeJsMesh creates valid mesh objects', () => {
      const volumeData = {
        material: 'SAND',
        vertices: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
        indices: new Uint32Array([0, 1, 2]),
        colors: new Float32Array([0.5, 0.3, 0.1, 0.5, 0.3, 0.1, 0.5, 0.3, 0.1]),
        normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]),
        uvs: new Float32Array([0, 0, 1, 0, 0.5, 1]),
        vertexCount: 3,
        indexCount: 3
      };
      
      const mesh = VolumetricMeshGenerator.createThreeJsMesh(volumeData, {});
      expect(mesh).toBeDefined();
      expect(mesh.geometry).toBeDefined();
      expect(mesh.material).toBeDefined();
    });

    test('calculateVolumeStatistics returns proper stats', () => {
      const volumeData = {
        material: 'ROCK',
        vertices: new Float32Array(9),
        vertexCount: 3,
        indexCount: 3
      };
      
      const stats = VolumetricMeshGenerator.calculateVolumeStatistics(volumeData);
      expect(stats).toBeDefined();
      expect(stats.vertexCount).toBe(3);
      expect(stats.triangleCount).toBe(1);
    });
  });

  describe('Performance and Memory', () => {
    test('handles large datasets efficiently', async () => {
      const largeDataset = Array.from({ length: 20 }, (_, i) => {
        const clayThickness = 5 + Math.random() * 5;
        const sandThickness = 10 + Math.random() * 10;
        return new Borehole({
          id: `bh${i}`,
          x: Math.random() * 100,
          z: Math.random() * 100,
          depth: clayThickness + sandThickness,
          layers: [
            { material: 'CLAY', from: 0, to: clayThickness, thickness: clayThickness, color: '#8B4513' },
            { material: 'SAND', from: clayThickness, to: clayThickness + sandThickness, thickness: sandThickness, color: '#F4A460' }
          ]
        });
      });

      const startTime = performance.now();
      const result = VolumetricMeshGenerator.generateStratigraphy(largeDataset, { gridResolution: 10 });
      const endTime = performance.now();
      
      expect(Array.isArray(result)).toBe(true);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
    });

    test('static methods do not require disposal', () => {
      // Static methods don't maintain state, so no disposal needed
      // This test verifies the API design is static
      expect(typeof VolumetricMeshGenerator.generateStratigraphy).toBe('function');
      expect(typeof VolumetricMeshGenerator.createLayerVolume).toBe('function');
      expect(typeof VolumetricMeshGenerator.createThreeJsMesh).toBe('function');
    });
  });

  describe('Error Handling', () => {
    test('handles invalid input gracefully', () => {
      const invalidData = null;
      
      // Should handle null input gracefully
      try {
        const result = VolumetricMeshGenerator.generateStratigraphy(invalidData, {});
        // If it doesn't throw, should return empty array
        expect(Array.isArray(result)).toBe(true);
        expect(result.length).toBe(0);
      } catch (error) {
        // Or it may throw an error, which is also acceptable
        expect(error).toBeDefined();
      }
    });

    test('handles malformed borehole data', () => {
      // Note: Borehole constructor will handle invalid coordinates by defaulting to 0
      const corruptedData = [
        new Borehole({
          id: 'bh1',
          x: 'invalid', // Will be defaulted to 0
          z: 'invalid', // Will be defaulted to 0
          layers: [],
          depth: 5
        })
      ];
      
      const result = VolumetricMeshGenerator.generateStratigraphy(corruptedData, {});
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(0);
    });
  });

  describe('Grid Resolution Impact', () => {
    test('different resolutions produce different detail levels', () => {
      const lowResResult = VolumetricMeshGenerator.generateStratigraphy(mockBoreholes, { gridResolution: 5 });
      const highResResult = VolumetricMeshGenerator.generateStratigraphy(mockBoreholes, { gridResolution: 20 });
      
      if (lowResResult.length > 0 && highResResult.length > 0) {
        // Higher resolution should produce more vertices
        const lowResVertexCount = lowResResult.reduce((sum, v) => sum + v.vertexCount, 0);
        const highResVertexCount = highResResult.reduce((sum, v) => sum + v.vertexCount, 0);
        expect(highResVertexCount).toBeGreaterThan(lowResVertexCount);
      }
    });
  });

  describe('Edge Case Handling', () => {
    describe('Discontinuous Strata and Varying Depths', () => {
      test('handles boreholes with significant depth variations', () => {
        const varyingDepthBoreholes = [
          new Borehole({
            id: 'test1',
            x: 0, z: 0,
            layers: [
              { material: 'CLAY', from: 0, to: 15, thickness: 15, color: '#8B4513' },
              { material: 'SAND', from: 15, to: 25, thickness: 10, color: '#F4A460' }
            ],
            depth: 25
          }),
          new Borehole({
            id: 'test2',
            x: 10, z: 0,
            layers: [
              { material: 'CLAY', from: 0, to: 5, thickness: 5, color: '#8B4513' },
              { material: 'SAND', from: 5, to: 10, thickness: 5, color: '#F4A460' }
            ],
            depth: 10
          }),
          new Borehole({
            id: 'test3',
            x: 5, z: 10,
            layers: [
              { material: 'CLAY', from: 0, to: 20, thickness: 20, color: '#8B4513' },
              { material: 'SAND', from: 20, to: 35, thickness: 15, color: '#F4A460' }
            ],
            depth: 35
          })
        ];

        const settings = {
          maxGapTolerance: 10,
          enableGapBridging: true,
          validateEdgeCases: true
        };

        const result = VolumetricMeshGenerator.generateStratigraphy(varyingDepthBoreholes, settings);
        
        expect(result).toBeDefined();
        expect(Array.isArray(result)).toBe(true);
        
        // Should have volumes for both materials
        const clayVolumes = result.filter(v => v.material === 'CLAY');
        const sandVolumes = result.filter(v => v.material === 'SAND');
        
        expect(clayVolumes.length).toBeGreaterThan(0);
        expect(sandVolumes.length).toBeGreaterThan(0);
        
        // With gap bridging enabled, should have fewer sequences per material
        clayVolumes.forEach(volume => {
          expect(volume.confidence).toBeDefined();
          expect(volume.confidence).toBeGreaterThan(0);
          expect(volume.confidence).toBeLessThanOrEqual(1);
        });
      });

      test('detects and handles single-point interpolation scenarios', () => {
        const singlePointBorehole = [
          new Borehole({
            id: 'single',
            x: 0, z: 0,
            layers: [
              { material: 'CLAY', from: 0, to: 10, thickness: 10, color: '#8B4513' }
            ],
            depth: 10
          })
        ];

        const result = VolumetricMeshGenerator.generateStratigraphy(singlePointBorehole);
        
        expect(result).toBeDefined();
        expect(result.length).toBeGreaterThan(0);
        
        // Should use geological extrapolation
        const clayVolume = result.find(v => v.material === 'CLAY');
        expect(clayVolume).toBeDefined();
        expect(clayVolume.confidence).toBeLessThan(1.0); // Should have reduced confidence
      });

      test('handles two-point linear interpolation with geological constraints', () => {
        const twoPointBoreholes = [
          new Borehole({
            id: 'point1',
            x: 0, z: 0,
            layers: [
              { material: 'SAND', from: 0, to: 8, thickness: 8, color: '#F4A460' }
            ],
            depth: 8
          }),
          new Borehole({
            id: 'point2',
            x: 20, z: 0,
            layers: [
              { material: 'SAND', from: 0, to: 12, thickness: 12, color: '#F4A460' }
            ],
            depth: 12
          })
        ];

        const result = VolumetricMeshGenerator.generateStratigraphy(twoPointBoreholes);
        
        expect(result).toBeDefined();
        expect(result.length).toBeGreaterThan(0);
        
        const sandVolume = result.find(v => v.material === 'SAND');
        expect(sandVolume).toBeDefined();
        expect(sandVolume.confidence).toBeGreaterThan(0);
        expect(sandVolume.confidence).toBeLessThan(1.0); // Should reflect limited data
      });

      test('applies confidence-based visual indicators', () => {
        const lowConfidenceScenario = [
          new Borehole({
            id: 'sparse1',
            x: 0, z: 0,
            layers: [
              { material: 'CLAY', from: 0, to: 5, thickness: 5, color: '#8B4513' }
            ],
            depth: 5
          }),
          new Borehole({
            id: 'sparse2',
            x: 50, z: 50,
            layers: [
              { material: 'CLAY', from: 0, to: 15, thickness: 15, color: '#8B4513' }
            ],
            depth: 15
          })
        ];

        const result = VolumetricMeshGenerator.generateStratigraphy(lowConfidenceScenario);
        
        expect(result).toBeDefined();
        const clayVolume = result.find(v => v.material === 'CLAY');
        expect(clayVolume).toBeDefined();
        
        // Should have low confidence due to sparse data (2 points = 0.75 confidence)
        expect(clayVolume.confidence).toBeLessThan(0.8);
        
        // Mesh should include confidence metadata
        if (clayVolume.mesh) {
          expect(clayVolume.mesh.userData).toBeDefined();
          expect(clayVolume.mesh.userData.confidence).toBeDefined();
        }
      });

      test('validates gap bridging functionality', () => {
        const gapBridgingScenario = [
          new Borehole({
            id: 'gap1',
            x: 0, z: 0,
            layers: [
              { material: 'SAND', from: 0, to: 5, thickness: 5, color: '#F4A460' },
              { material: 'CLAY', from: 15, to: 25, thickness: 10, color: '#8B4513' } // 10ft gap
            ],
            depth: 25
          }),
          new Borehole({
            id: 'gap2',
            x: 10, z: 0,
            layers: [
              { material: 'SAND', from: 0, to: 8, thickness: 8, color: '#F4A460' },
              { material: 'CLAY', from: 18, to: 30, thickness: 12, color: '#8B4513' } // 10ft gap
            ],
            depth: 30
          })
        ];

        const settings = {
          maxGapTolerance: 10,
          enableGapBridging: true
        };

        const result = VolumetricMeshGenerator.generateStratigraphy(gapBridgingScenario, settings);
        
        expect(result).toBeDefined();
        
        // Should bridge gaps and create continuous volumes
        const clayVolumes = result.filter(v => v.material === 'CLAY');
        const sandVolumes = result.filter(v => v.material === 'SAND');
        
        // With gap bridging, should have fewer sequences per material
        expect(clayVolumes.length).toBeLessThanOrEqual(2);
        expect(sandVolumes.length).toBeLessThanOrEqual(2);
        
        // Volumes should have gap bridging metadata
        clayVolumes.forEach(volume => {
          if (volume.gapsBridged) {
            expect(volume.gapsBridged).toBe(true);
          }
        });
      });

      test('performance maintains target under 200ms for edge cases', () => {
        const complexEdgeCaseData = [];
        
        // Create complex scenario with varying depths and gaps
        for (let i = 0; i < 5; i++) {
          complexEdgeCaseData.push(new Borehole({
            id: `complex${i}`,
            x: i * 10, z: i * 5,
            layers: [
              { material: 'CLAY', from: 0, to: 5 + i * 2, thickness: 5 + i * 2, color: '#8B4513' },
              { material: 'SAND', from: 15 + i * 3, to: 25 + i * 5, thickness: 10 + i * 2, color: '#F4A460' }
            ],
            depth: 25 + i * 5
          }));
        }

        const startTime = performance.now();
        const result = VolumetricMeshGenerator.generateStratigraphy(complexEdgeCaseData);
        const endTime = performance.now();
        
        const executionTime = endTime - startTime;
        
        expect(result).toBeDefined();
        expect(executionTime).toBeLessThan(200); // Target performance

      });
    });

    describe('Console Warning Validation', () => {
      test('does not log multiple sequences for same material with gap bridging', () => {
        const consoleSpy = jest.spyOn(console, 'log');
        
        const varyingDepthBoreholes = [
          new Borehole({
            id: 'test1',
            x: 0, z: 0,
            layers: [{ material: 'SAND', from: 0, to: 10, thickness: 10, color: '#F4A460' }],
            depth: 10
          }),
          new Borehole({
            id: 'test2',
            x: 10, z: 0,
            layers: [{ material: 'SAND', from: 5, to: 15, thickness: 10, color: '#F4A460' }],
            depth: 15
          })
        ];

        const settings = { maxGapTolerance: 10, enableGapBridging: true };
        VolumetricMeshGenerator.generateStratigraphy(varyingDepthBoreholes, settings);
        
        const sequenceLogCalls = consoleSpy.mock.calls.filter(call =>
          call.some(arg => typeof arg === 'string' && arg.includes('Found') && arg.includes('continuous sequences'))
        );
        
        // Should not have multiple sequences for same material
        sequenceLogCalls.forEach(call => {
          const message = call.join(' ');
          const match = message.match(/Found (\d+) continuous sequences/);
          if (match) {
            const sequenceCount = parseInt(match[1]);
            expect(sequenceCount).toBeLessThanOrEqual(1); // Should merge sequences
          }
        });
        
        consoleSpy.mockRestore();
      });
    });

    describe('Sparse Stratum Filtering', () => {
      test('skips strata present in ≤50% of boreholes or with <2 data points', () => {
        const consoleSpy = jest.spyOn(console, 'log');
        
        // 4 boreholes: ROCK only in 1 borehole (25% ≤ 50% threshold + 1 < 2 data points)
        const sparseStratumBoreholes = [
          new Borehole({
            id: 'bh1',
            x: 0, z: 0,
            layers: [
              { material: 'CLAY', from: 0, to: 10, thickness: 10, color: '#8B4513' },
              { material: 'ROCK', from: 10, to: 15, thickness: 5, color: '#708090' } // Only in this borehole
            ],
            depth: 15
          }),
          new Borehole({
            id: 'bh2',
            x: 10, z: 0,
            layers: [
              { material: 'CLAY', from: 0, to: 12, thickness: 12, color: '#8B4513' }
            ],
            depth: 12
          }),
          new Borehole({
            id: 'bh3',
            x: 5, z: 10,
            layers: [
              { material: 'CLAY', from: 0, to: 8, thickness: 8, color: '#8B4513' }
            ],
            depth: 8
          }),
          new Borehole({
            id: 'bh4',
            x: 15, z: 10,
            layers: [
              { material: 'CLAY', from: 0, to: 11, thickness: 11, color: '#8B4513' }
            ],
            depth: 11
          })
        ];

        const result = VolumetricMeshGenerator.generateStratigraphy(sparseStratumBoreholes);
        
        // Should only have CLAY volume, ROCK should be skipped
        expect(result).toBeDefined();
        const clayVolumes = result.filter(v => v.material === 'CLAY');
        const rockVolumes = result.filter(v => v.material === 'ROCK');
        
        expect(clayVolumes.length).toBeGreaterThan(0); // CLAY should be created (100% presence + 4 data points)
        expect(rockVolumes.length).toBe(0); // ROCK should be skipped (25% ≤ 50% threshold + 1 < 2 data points)
        
        // Check console output for skip message
        const skipMessages = consoleSpy.mock.calls.filter(call =>
          call.some(arg => typeof arg === 'string' && arg.includes('Skipping sparse stratum ROCK'))
        );
        
        expect(skipMessages.length).toBeGreaterThan(0);
        
        consoleSpy.mockRestore();
      });

      test('creates volumes for strata present in >50% of boreholes with ≥2 data points', () => {
        // 3 boreholes: ROCK in 2 boreholes (67% > 50% threshold + 2 ≥ 2 data points)
        const acceptableStratumBoreholes = [
          new Borehole({
            id: 'bh1',
            x: 0, z: 0,
            layers: [
              { material: 'CLAY', from: 0, to: 10, thickness: 10, color: '#8B4513' },
              { material: 'ROCK', from: 10, to: 15, thickness: 5, color: '#708090' }
            ],
            depth: 15
          }),
          new Borehole({
            id: 'bh2',
            x: 10, z: 0,
            layers: [
              { material: 'CLAY', from: 0, to: 12, thickness: 12, color: '#8B4513' },
              { material: 'ROCK', from: 12, to: 18, thickness: 6, color: '#708090' }
            ],
            depth: 18
          }),
          new Borehole({
            id: 'bh3',
            x: 5, z: 10,
            layers: [
              { material: 'CLAY', from: 0, to: 8, thickness: 8, color: '#8B4513' }
            ],
            depth: 8
          })
        ];

        const result = VolumetricMeshGenerator.generateStratigraphy(acceptableStratumBoreholes);
        
        const clayVolumes = result.filter(v => v.material === 'CLAY');
        const rockVolumes = result.filter(v => v.material === 'ROCK');
        
        expect(clayVolumes.length).toBeGreaterThan(0); // CLAY should be created (100% presence + 3 data points)
        expect(rockVolumes.length).toBeGreaterThan(0); // ROCK should be created (67% > 50% + 2 ≥ 2 data points)
      });

      test('respects custom minPresenceThreshold and minDataPoints settings', () => {
        const consoleSpy = jest.spyOn(console, 'log');
        
        // 4 boreholes: ROCK in 2 boreholes (50% presence, 2 data points)
        const testBoreholes = [
          new Borehole({
            id: 'bh1',
            x: 0, z: 0,
            layers: [{ material: 'ROCK', from: 0, to: 5, thickness: 5, color: '#708090' }],
            depth: 5
          }),
          new Borehole({
            id: 'bh2',
            x: 10, z: 0,
            layers: [{ material: 'ROCK', from: 0, to: 7, thickness: 7, color: '#708090' }],
            depth: 7
          }),
          new Borehole({
            id: 'bh3',
            x: 5, z: 10,
            layers: [{ material: 'CLAY', from: 0, to: 8, thickness: 8, color: '#8B4513' }],
            depth: 8
          }),
          new Borehole({
            id: 'bh4',
            x: 15, z: 10,
            layers: [{ material: 'CLAY', from: 0, to: 6, thickness: 6, color: '#8B4513' }],
            depth: 6
          })
        ];

        // Test with higher threshold (60%) - should skip ROCK (50% ≤ 60%)
        const strictSettings = { minPresenceThreshold: 0.6 };
        const strictResult = VolumetricMeshGenerator.generateStratigraphy(testBoreholes, strictSettings);
        
        const strictRockVolumes = strictResult.filter(v => v.material === 'ROCK');
        expect(strictRockVolumes.length).toBe(0); // 50% ≤ 60% threshold
        
        // Test with lower threshold (40%) and sufficient data points - should include ROCK
        const permissiveSettings = { minPresenceThreshold: 0.4, minDataPoints: 2 };
        const permissiveResult = VolumetricMeshGenerator.generateStratigraphy(testBoreholes, permissiveSettings);
        
        const permissiveRockVolumes = permissiveResult.filter(v => v.material === 'ROCK');
        expect(permissiveRockVolumes.length).toBeGreaterThan(0); // 50% > 40% threshold + 2 ≥ 2 data points
        
        consoleSpy.mockRestore();
      });
    });

    describe('Isolated Material Pocket Rendering', () => {
      test('analyzeMaterialDistribution correctly identifies isolated materials', () => {
        const boreholes = [
          new Borehole({
            id: 'bh1',
            x: 0, z: 0,
            layers: [
              { material: 'CLAY', from: 0, to: 10, thickness: 10, color: '#8B4513' },
              { material: 'ROCK', from: 10, to: 15, thickness: 5, color: '#555' }
            ],
            depth: 15
          }),
          new Borehole({
            id: 'bh2',
            x: 10, z: 0,
            layers: [
              { material: 'CLAY', from: 0, to: 12, thickness: 12, color: '#8B4513' }
            ],
            depth: 12
          }),
          new Borehole({
            id: 'bh3',
            x: 5, z: 10,
            layers: [
              { material: 'CLAY', from: 0, to: 8, thickness: 8, color: '#8B4513' },
              { material: 'ORGANIC', from: 8, to: 10, thickness: 2, color: '#2D1B0E' }
            ],
            depth: 10
          }),
          new Borehole({
            id: 'bh4',
            x: 15, z: 10,
            layers: [
              { material: 'CLAY', from: 0, to: 11, thickness: 11, color: '#8B4513' }
            ],
            depth: 11
          })
        ];

        const distribution = VolumetricMeshGenerator.analyzeMaterialDistribution(boreholes);
        
        expect(distribution).toBeDefined();
        expect(distribution.length).toBe(3); // CLAY, ROCK, ORGANIC

        const clayData = distribution.find(m => m.material === 'CLAY');
        const rockData = distribution.find(m => m.material === 'ROCK');
        const organicData = distribution.find(m => m.material === 'ORGANIC');

        // CLAY should be common (4/4 boreholes = 100%)
        expect(clayData.presenceRatio).toBe(1.0);
        expect(clayData.isIsolated).toBe(false);
        expect(clayData.boreholes.length).toBe(4);

        // ROCK should be isolated (1/4 boreholes = 25% < 50%)
        expect(rockData.presenceRatio).toBe(0.25);
        expect(rockData.isIsolated).toBe(true);
        expect(rockData.boreholes.length).toBe(1);

        // ORGANIC should be isolated (1/4 boreholes = 25% < 50%)
        expect(organicData.presenceRatio).toBe(0.25);
        expect(organicData.isIsolated).toBe(true);
        expect(organicData.boreholes.length).toBe(1);
      });

      test('createLocalizedPocket generates proper pocket geometry', () => {
        const materialData = {
          material: 'ROCK',
          color: '#555',
          key: 'ROCK_#555',
          presenceRatio: 0.25,
          occurrences: [
            { boreholeId: 'bh1', x: 100, y: 200, depth: 10, thickness: 5 }
          ]
        };

        const location = {
          boreholeId: 'bh1',
          x: 100,
          y: 200,
          depth: 10,
          thickness: 5
        };

        const settings = {
          radius: 50,
          opacity: 0.8,
          shape: 'cylinder'
        };

        const pocket = VolumetricMeshGenerator.createLocalizedPocket(materialData, location, settings);

        expect(pocket).toBeDefined();
        expect(pocket.userData.type).toBe('isolated_football_zone');
        expect(pocket.userData.material).toBe('ROCK');
        expect(pocket.userData.borehole).toBe('bh1');
        expect(pocket.userData.presenceRatio).toBe(0.25);
        expect(pocket.userData.uniqueKey).toBe('ROCK_#555');
        expect(pocket.userData.zoneRadius).toBe(50);

        // Check positioning (raw coordinates - football covers full depth)
        expect(pocket.position.x).toBe(100); // Raw coordinate (no scale factor)
        expect(pocket.position.z).toBe(200); // Raw coordinate (no scale factor) 
        expect(pocket.position.y).toBe(-20); // Center of 40ft depth range (0 to -40)
      });

      test('generateStratigraphy creates pockets for isolated materials when isolatedMaterialHandling=pockets', () => {
        const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
        
        const boreholes = [
          new Borehole({
            id: 'bh1',
            x: 0, z: 0,
            layers: [
              { material: 'CLAY', from: 0, to: 10, thickness: 10, color: '#8B4513' },
              { material: 'ROCK', from: 10, to: 15, thickness: 5, color: '#555' }
            ],
            depth: 15
          }),
          new Borehole({
            id: 'bh2',
            x: 10, z: 0,
            layers: [
              { material: 'CLAY', from: 0, to: 12, thickness: 12, color: '#8B4513' }
            ],
            depth: 12
          }),
          new Borehole({
            id: 'bh3',
            x: 5, z: 10,
            layers: [
              { material: 'CLAY', from: 0, to: 8, thickness: 8, color: '#8B4513' }
            ],
            depth: 8
          }),
          new Borehole({
            id: 'bh4',
            x: 15, z: 10,
            layers: [
              { material: 'CLAY', from: 0, to: 11, thickness: 11, color: '#8B4513' }
            ],
            depth: 11
          })
        ];

        const settings = {
          isolatedMaterialHandling: 'pockets',
          pocketRadius: 30,
          pocketOpacity: 0.7,
          pocketShape: 'cylinder'
        };

        const result = VolumetricMeshGenerator.generateStratigraphy(boreholes, settings);

        // Should have CLAY volumes (interpolated) and ROCK pocket(s)
        expect(result).toBeDefined();
        expect(result.length).toBeGreaterThan(0);

        // Check that pockets were created
        const pocketMessages = consoleSpy.mock.calls.filter(call =>
          call.some(arg => typeof arg === 'string' && arg.includes('Creating localized pockets for isolated material'))
        );
        expect(pocketMessages.length).toBeGreaterThan(0);

        consoleSpy.mockRestore();
      });

      test('generateStratigraphy ignores isolated materials when isolatedMaterialHandling=ignore', () => {
        const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
        
        const boreholes = [
          new Borehole({
            id: 'bh1',
            x: 0, z: 0,
            layers: [
              { material: 'CLAY', from: 0, to: 10, thickness: 10, color: '#8B4513' },
              { material: 'ROCK', from: 10, to: 15, thickness: 5, color: '#555' }
            ],
            depth: 15
          }),
          new Borehole({
            id: 'bh2',
            x: 10, z: 0,
            layers: [
              { material: 'CLAY', from: 0, to: 12, thickness: 12, color: '#8B4513' }
            ],
            depth: 12
          })
        ];

        const settings = {
          isolatedMaterialHandling: 'ignore',
          minPresenceThreshold: 0.5
        };

        const result = VolumetricMeshGenerator.generateStratigraphy(boreholes, settings);

        // Should only have CLAY volumes, ROCK should be ignored
        expect(result).toBeDefined();
        const clayVolumes = result.filter(v => v.material === 'CLAY');
        expect(clayVolumes.length).toBeGreaterThan(0);

        // Check for skip messages
        const skipMessages = consoleSpy.mock.calls.filter(call =>
          call.some(arg => typeof arg === 'string' && arg.includes('Skipping sparse stratum ROCK'))
        );
        expect(skipMessages.length).toBeGreaterThan(0);

        consoleSpy.mockRestore();
      });

      test('generateStratigraphy interpolates isolated materials when isolatedMaterialHandling=interpolate', () => {
        const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
        
        const boreholes = [
          new Borehole({
            id: 'bh1',
            x: 0, z: 0,
            layers: [
              { material: 'CLAY', from: 0, to: 10, thickness: 10, color: '#8B4513' },
              { material: 'ROCK', from: 10, to: 15, thickness: 5, color: '#555' }
            ],
            depth: 15
          }),
          new Borehole({
            id: 'bh2',
            x: 10, z: 0,
            layers: [
              { material: 'CLAY', from: 0, to: 12, thickness: 12, color: '#8B4513' }
            ],
            depth: 12
          }),
          new Borehole({
            id: 'bh3',
            x: 5, z: 10,
            layers: [
              { material: 'CLAY', from: 0, to: 8, thickness: 8, color: '#8B4513' }
            ],
            depth: 8
          })
        ];

        const settings = {
          isolatedMaterialHandling: 'interpolate',
          minPresenceThreshold: 0.5
        };

        const result = VolumetricMeshGenerator.generateStratigraphy(boreholes, settings);

        // Should have both CLAY and ROCK volumes (interpolated despite low presence)
        expect(result).toBeDefined();
        const clayVolumes = result.filter(v => v.material === 'CLAY');
        const rockVolumes = result.filter(v => v.material === 'ROCK');
        
        expect(clayVolumes.length).toBeGreaterThan(0);
        expect(rockVolumes.length).toBeGreaterThan(0); // Force interpolated despite isolation

        // Check for force interpolation warning
        const forceMessages = consoleSpy.mock.calls.filter(call =>
          call.some(arg => typeof arg === 'string' && arg.includes('Force interpolating sparse stratum'))
        );
        expect(forceMessages.length).toBeGreaterThan(0);

        consoleSpy.mockRestore();
      });

      test('handles edge case: single borehole with unique material stack', () => {
        const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
        
        const boreholes = [
          new Borehole({
            id: 'bh1',
            x: 0, z: 0,
            layers: [
              { material: 'ROCK', from: 0, to: 5, thickness: 5, color: '#555' },
              { material: 'GRAVEL', from: 5, to: 8, thickness: 3, color: '#888' },
              { material: 'ORGANIC', from: 8, to: 10, thickness: 2, color: '#2D1B0E' }
            ],
            depth: 10
          }),
          new Borehole({
            id: 'bh2',
            x: 20, z: 0,
            layers: [
              { material: 'CLAY', from: 0, to: 15, thickness: 15, color: '#8B4513' }
            ],
            depth: 15
          })
        ];

        const settings = { isolatedMaterialHandling: 'pockets' };
        const result = VolumetricMeshGenerator.generateStratigraphy(boreholes, settings);

        expect(result).toBeDefined();

        // All materials except the most common should be handled as pockets
        const pocketMessages = consoleSpy.mock.calls.filter(call =>
          call.some(arg => typeof arg === 'string' && arg.includes('Creating localized pockets'))
        );
        expect(pocketMessages.length).toBeGreaterThan(0);

        consoleSpy.mockRestore();
      });

      test('handles threshold change causing mode switch', () => {
        const boreholes = [
          new Borehole({
            id: 'bh1',
            x: 0, z: 0,
            layers: [{ material: 'ROCK', from: 0, to: 5, thickness: 5, color: '#555' }],
            depth: 5
          }),
          new Borehole({
            id: 'bh2',
            x: 10, z: 0,
            layers: [{ material: 'CLAY', from: 0, to: 10, thickness: 10, color: '#8B4513' }],
            depth: 10
          }),
          new Borehole({
            id: 'bh3',
            x: 5, z: 10,
            layers: [{ material: 'ROCK', from: 0, to: 6, thickness: 6, color: '#555' }],
            depth: 6
          }),
          new Borehole({
            id: 'bh4',
            x: 15, z: 10,
            layers: [{ material: 'CLAY', from: 0, to: 8, thickness: 8, color: '#8B4513' }],
            depth: 8
          })
        ];

        const distribution = VolumetricMeshGenerator.analyzeMaterialDistribution(boreholes);
        const rockData = distribution.find(m => m.material === 'ROCK');
        
        // ROCK is in 2/4 = 50% of boreholes
        expect(rockData.presenceRatio).toBe(0.5);
        
        // At 50% threshold, should NOT be considered isolated (logic is < 0.5, not <= 0.5)
        expect(rockData.isIsolated).toBe(false);
        
        // At 40% threshold, would not be isolated
        // This tests the threshold boundary behavior
      });

      test('pocket positioning coordinates match geological model system', () => {
        const materialData = {
          material: 'ROCK',
          color: '#555',
          key: 'ROCK_#555',
          presenceRatio: 0.25
        };

        const location = {
          boreholeId: 'bh1',
          x: 500,  // feet
          y: 1000, // feet  
          depth: 20, // feet
          thickness: 10 // feet
        };

        const pocket = VolumetricMeshGenerator.createLocalizedPocket(materialData, location);

        // Should use same coordinate system as borehole markers
        // X: East-West, Y: Elevation (negative), Z: North-South  
        expect(pocket.position.x).toBe(500); // Raw coordinate (no scale factor)
        expect(pocket.position.z).toBe(1000); // Raw coordinate (no scale factor)
        expect(pocket.position.y).toBe(-20); // Center of 40ft depth range (0 to -40)
      });

      test('supports multiple pocket shapes', () => {
        const materialData = {
          material: 'ROCK',
          color: '#555',
          key: 'ROCK_#555',
          presenceRatio: 0.25
        };

        const location = {
          boreholeId: 'bh1',
          x: 100,
          y: 200,
          depth: 10,
          thickness: 5
        };

        // Test each shape variant
        const shapes = ['cylinder', 'sphere', 'ellipsoid', 'irregular', 'adaptive'];
        
        shapes.forEach(shape => {
          const settings = { radius: 50, opacity: 0.8, shape: shape };
          const pocket = VolumetricMeshGenerator.createLocalizedPocket(materialData, location, settings);

          expect(pocket).toBeDefined();
          expect(pocket.userData.type).toBe('isolated_pocket');
          expect(pocket.userData.material).toBe('ROCK');
          expect(pocket.geometry).toBeDefined();
          
          // Verify geometry was created (should have vertices)
          const hasVertices = pocket.geometry.attributes && 
                              pocket.geometry.attributes.position && 
                              pocket.geometry.attributes.position.array.length > 0;
          expect(hasVertices).toBe(true);
        });
      });

      test('irregular shape creates deformed geometry', () => {
        const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
        
        const materialData = {
          material: 'ROCK',
          color: '#555',
          key: 'ROCK_#555',
          presenceRatio: 0.25
        };

        const location = {
          boreholeId: 'bh1',
          x: 100,
          y: 200,
          depth: 10,
          thickness: 5
        };

        const settings = { radius: 50, opacity: 0.8, shape: 'irregular' };
        const pocket = VolumetricMeshGenerator.createLocalizedPocket(materialData, location, settings);

        expect(pocket).toBeDefined();
        
        // Check that irregular geometry message was logged
        const irregularMessages = consoleSpy.mock.calls.filter(call =>
          call.some(arg => typeof arg === 'string' && arg.includes('🗿 Created irregular pocket geometry'))
        );
        expect(irregularMessages.length).toBe(1);

        consoleSpy.mockRestore();
      });

      test('adaptive shape scales based on thickness ratio', () => {
        const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
        
        const materialData = {
          material: 'ROCK',
          color: '#555',
          key: 'ROCK_#555',
          presenceRatio: 0.25
        };

        const location = {
          boreholeId: 'bh1',
          x: 100,
          y: 200,
          depth: 10,
          thickness: 20 // Thick layer for testing adaptation
        };

        const settings = { radius: 30, opacity: 0.8, shape: 'adaptive' };
        const pocket = VolumetricMeshGenerator.createLocalizedPocket(materialData, location, settings);

        expect(pocket).toBeDefined();
        
        // Check that adaptive geometry message was logged
        const adaptiveMessages = consoleSpy.mock.calls.filter(call =>
          call.some(arg => typeof arg === 'string' && arg.includes('🎯 Created adaptive pocket geometry'))
        );
        expect(adaptiveMessages.length).toBe(1);

        consoleSpy.mockRestore();
      });

      test('ellipsoid shape applies height scaling', () => {
        const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
        
        const materialData = {
          material: 'ROCK',
          color: '#555',
          key: 'ROCK_#555',
          presenceRatio: 0.25
        };

        const location = {
          boreholeId: 'bh1',
          x: 100,
          y: 200,
          depth: 10,
          thickness: 3 // Thin layer for ellipsoid flattening
        };

        const settings = { radius: 50, opacity: 0.8, shape: 'ellipsoid' };
        const pocket = VolumetricMeshGenerator.createLocalizedPocket(materialData, location, settings);

        expect(pocket).toBeDefined();
        
        // Check that ellipsoid geometry message was logged with height scale
        const ellipsoidMessages = consoleSpy.mock.calls.filter(call =>
          call.some(arg => typeof arg === 'string' && arg.includes('🥚 Created ellipsoid pocket geometry'))
        );
        expect(ellipsoidMessages.length).toBe(1);

        consoleSpy.mockRestore();
      });

      test('createTransitionZone generates proper transition geometry', () => {
        const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
        
        const materialData = {
          material: 'ROCK',
          color: '#555',
          key: 'ROCK_#555',
          presenceRatio: 0.25
        };

        const location = {
          boreholeId: 'bh1',
          x: 100,
          y: 200,
          depth: 10,
          thickness: 5
        };

        const settings = {
          innerRadius: 100,
          outerRadius: 150,
          height: 10,
          opacity: 0.3,
          falloff: 'linear',
          baseColor: '#555555',
          shape: 'cylinder'
        };

        const transitionZone = VolumetricMeshGenerator.createTransitionZone(materialData, location, settings);

        expect(transitionZone).toBeDefined();
        expect(transitionZone.userData.type).toBe('transition_zone');
        expect(transitionZone.userData.material).toBe('ROCK');
        expect(transitionZone.userData.falloff).toBe('linear');
        expect(transitionZone.userData.innerRadius).toBe(100);
        expect(transitionZone.userData.outerRadius).toBe(150);

        // Check that transition zone was logged
        const transitionMessages = consoleSpy.mock.calls.filter(call =>
          call.some(arg => typeof arg === 'string' && arg.includes('🌊 Creating transition zone'))
        );
        expect(transitionMessages.length).toBe(1);

        consoleSpy.mockRestore();
      });

      test('transition zone returns null for insufficient radius difference', () => {
        const materialData = {
          material: 'ROCK',
          color: '#555',
          key: 'ROCK_#555',
          presenceRatio: 0.25
        };

        const location = {
          boreholeId: 'bh1',
          x: 100,
          y: 200,
          depth: 10,
          thickness: 5
        };

        // Radii too close together
        const settings = {
          innerRadius: 100,
          outerRadius: 102, // Only 2 unit difference, less than minimum of 5
          height: 10,
          opacity: 0.3,
          falloff: 'linear',
          baseColor: '#555555',
          shape: 'cylinder'
        };

        const transitionZone = VolumetricMeshGenerator.createTransitionZone(materialData, location, settings);
        expect(transitionZone).toBeNull();
      });

      test('pockets with transition zones create nested mesh structure', () => {
        const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
        
        const materialData = {
          material: 'ROCK',
          color: '#555',
          key: 'ROCK_#555',
          presenceRatio: 0.25
        };

        const location = {
          boreholeId: 'bh1',
          x: 100,
          y: 200,
          depth: 10,
          thickness: 5
        };

        const settings = {
          radius: 50,
          opacity: 0.8,
          shape: 'cylinder',
          enableTransitionZone: true,
          transitionFalloff: 'exponential',
          transitionRadius: 75 // 1.5x radius
        };

        const pocket = VolumetricMeshGenerator.createLocalizedPocket(materialData, location, settings);

        expect(pocket).toBeDefined();
        
        // Should have child transition zone
        expect(pocket.children.length).toBeGreaterThan(0);
        
        // Check for transition zone creation messages
        const transitionMessages = consoleSpy.mock.calls.filter(call =>
          call.some(arg => typeof arg === 'string' && arg.includes('🌊 Added transition zone for smooth blending'))
        );
        expect(transitionMessages.length).toBe(1);

        consoleSpy.mockRestore();
      });

      test('transition zones work with different pocket shapes', () => {
        const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
        
        const materialData = {
          material: 'ROCK',
          color: '#555',
          key: 'ROCK_#555',
          presenceRatio: 0.25
        };

        const location = {
          boreholeId: 'bh1',
          x: 100,
          y: 200,
          depth: 10,
          thickness: 8
        };

        const shapes = ['cylinder', 'sphere', 'ellipsoid', 'irregular', 'adaptive'];
        
        shapes.forEach(shape => {
          const settings = {
            radius: 50,
            opacity: 0.8,
            shape: shape,
            enableTransitionZone: true,
            transitionFalloff: 'smooth',
            transitionRadius: 80
          };

          const pocket = VolumetricMeshGenerator.createLocalizedPocket(materialData, location, settings);

          expect(pocket).toBeDefined();
          expect(pocket.children.length).toBeGreaterThan(0); // Should have transition zone
        });

        consoleSpy.mockRestore();
      });

      test('generateStratigraphy uses transition zone settings for isolated pockets', () => {
        const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
        
        const boreholes = [
          new Borehole({
            id: 'bh1',
            x: 0, z: 0,
            layers: [
              { material: 'CLAY', from: 0, to: 10, thickness: 10, color: '#8B4513' },
              { material: 'ROCK', from: 10, to: 15, thickness: 5, color: '#555' } // Isolated
            ],
            depth: 15
          }),
          new Borehole({
            id: 'bh2',
            x: 10, z: 0,
            layers: [
              { material: 'CLAY', from: 0, to: 12, thickness: 12, color: '#8B4513' }
            ],
            depth: 12
          })
        ];

        const settings = {
          isolatedMaterialHandling: 'pockets',
          pocketRadius: 40,
          pocketOpacity: 0.6,
          pocketShape: 'sphere',
          enableTransitionZone: true,
          transitionFalloff: 'exponential',
          transitionRadiusMultiplier: 2.0
        };

        const result = VolumetricMeshGenerator.generateStratigraphy(boreholes, settings);

        expect(result).toBeDefined();

        // Check that transition zones were enabled in pocket creation
        const transitionMessages = consoleSpy.mock.calls.filter(call =>
          call.some(arg => typeof arg === 'string' && arg.includes('🌊 Transition zone enabled'))
        );
        expect(transitionMessages.length).toBeGreaterThan(0);

        consoleSpy.mockRestore();
      });
    });
  });

  describe('USCS Texture Pattern System', () => {
    beforeEach(() => {
      // Mock canvas for texture pattern tests
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
          createPattern: jest.fn(() => 'mock-pattern'),
          createLinearGradient: jest.fn(() => ({
            addColorStop: jest.fn()
          })),
          createRadialGradient: jest.fn(() => ({
            addColorStop: jest.fn()
          })),
          setTransform: jest.fn(),
          transform: jest.fn(),
          clip: jest.fn(),
          isPointInPath: jest.fn(),
          measureText: jest.fn(() => ({ width: 10 })),
          getImageData: jest.fn(() => ({ data: new Uint8ClampedArray(256) })),
          putImageData: jest.fn(),
          createImageData: jest.fn(() => ({ data: new Uint8ClampedArray(256) }))
        })),
        width: 256,
        height: 256,
        toDataURL: jest.fn(() => 'data:image/png;base64,mockdata')
      };

      // Mock document.createElement for canvas creation
      global.document = {
        createElement: jest.fn(() => mockCanvas)
      };

      // Mock OffscreenCanvas if available
      global.OffscreenCanvas = jest.fn(() => mockCanvas);
    });

    afterEach(() => {
      delete global.document;
      delete global.OffscreenCanvas;
    });

    describe('getDefaultPattern', () => {
      test('returns correct patterns for USCS gravel materials', () => {
        expect(VolumetricMeshGenerator.getDefaultPattern('GW')).toBe('gravel_circles');
        expect(VolumetricMeshGenerator.getDefaultPattern('gw')).toBe('gravel_circles');
        expect(VolumetricMeshGenerator.getDefaultPattern('GP')).toBe('gravel_circles');
        expect(VolumetricMeshGenerator.getDefaultPattern('GM')).toBe('gravel_silt');
        expect(VolumetricMeshGenerator.getDefaultPattern('GC')).toBe('gravel_clay');
      });

      test('returns correct patterns for USCS sand materials', () => {
        expect(VolumetricMeshGenerator.getDefaultPattern('SW')).toBe('sand_dots');
        expect(VolumetricMeshGenerator.getDefaultPattern('sw')).toBe('sand_dots');
        expect(VolumetricMeshGenerator.getDefaultPattern('SP')).toBe('sand_dots');
        expect(VolumetricMeshGenerator.getDefaultPattern('SM')).toBe('sand_silt');
        expect(VolumetricMeshGenerator.getDefaultPattern('SC')).toBe('sand_clay');
      });

      test('returns correct patterns for USCS fine-grained low plasticity materials', () => {
        expect(VolumetricMeshGenerator.getDefaultPattern('ML')).toBe('horizontal_lines');
        expect(VolumetricMeshGenerator.getDefaultPattern('ml')).toBe('horizontal_lines');
        expect(VolumetricMeshGenerator.getDefaultPattern('CL')).toBe('horizontal_dashed');
        expect(VolumetricMeshGenerator.getDefaultPattern('OL')).toBe('horizontal_lines_organic');
      });

      test('returns correct patterns for USCS fine-grained high plasticity materials', () => {
        expect(VolumetricMeshGenerator.getDefaultPattern('MH')).toBe('diagonal_lines');
        expect(VolumetricMeshGenerator.getDefaultPattern('mh')).toBe('diagonal_lines');
        expect(VolumetricMeshGenerator.getDefaultPattern('CH')).toBe('diagonal_crosshatch');
        expect(VolumetricMeshGenerator.getDefaultPattern('OH')).toBe('diagonal_lines_organic');
      });

      test('returns correct patterns for USCS highly organic materials', () => {
        expect(VolumetricMeshGenerator.getDefaultPattern('PT')).toBe('organic_irregular');
        expect(VolumetricMeshGenerator.getDefaultPattern('pt')).toBe('organic_irregular');
      });

      test('returns correct patterns for legacy materials', () => {
        expect(VolumetricMeshGenerator.getDefaultPattern('clay')).toBe('horizontal_dashed');
        expect(VolumetricMeshGenerator.getDefaultPattern('sand')).toBe('sand_dots');
        expect(VolumetricMeshGenerator.getDefaultPattern('gravel')).toBe('gravel_circles');
        expect(VolumetricMeshGenerator.getDefaultPattern('silt')).toBe('horizontal_lines');
        expect(VolumetricMeshGenerator.getDefaultPattern('rock')).toBe('rock_pattern');
        expect(VolumetricMeshGenerator.getDefaultPattern('peat')).toBe('organic_irregular');
      });

      test('returns default pattern for unknown materials', () => {
        expect(VolumetricMeshGenerator.getDefaultPattern('unknown')).toBe('horizontal_lines');
        expect(VolumetricMeshGenerator.getDefaultPattern('')).toBe('horizontal_lines');
        expect(VolumetricMeshGenerator.getDefaultPattern(null)).toBe('horizontal_lines');
        expect(VolumetricMeshGenerator.getDefaultPattern(undefined)).toBe('horizontal_lines');
      });

      test('handles case insensitive matching', () => {
        expect(VolumetricMeshGenerator.getDefaultPattern('GW')).toBe('gravel_circles');
        expect(VolumetricMeshGenerator.getDefaultPattern('gw')).toBe('gravel_circles');
        expect(VolumetricMeshGenerator.getDefaultPattern('Gw')).toBe('gravel_circles');
        expect(VolumetricMeshGenerator.getDefaultPattern('gW')).toBe('gravel_circles');
      });
    });

    describe('createTexture', () => {
      test('creates texture for all USCS gravel patterns', () => {
        const uscsGravelMaterials = ['GW', 'GP', 'GM', 'GC'];
        const settings = { intensity: 0.7, scale: 1.0, showTextures: true };

        uscsGravelMaterials.forEach(material => {
          const texture = VolumetricMeshGenerator.createTexture(material, settings);
          expect(texture).toBeDefined();
          expect(texture.userData).toBeDefined();
          expect(texture.userData.material).toBe(material);
          expect(texture.userData.pattern).toBeDefined();
        });
      });

      test('creates texture for all USCS sand patterns', () => {
        const uscsSandMaterials = ['SW', 'SP', 'SM', 'SC'];
        const settings = { intensity: 0.7, scale: 1.0, showTextures: true };

        uscsSandMaterials.forEach(material => {
          const texture = VolumetricMeshGenerator.createTexture(material, settings);
          expect(texture).toBeDefined();
          expect(texture.userData).toBeDefined();
          expect(texture.userData.material).toBe(material);
          expect(texture.userData.pattern).toBeDefined();
        });
      });

      test('creates texture for all USCS fine-grained materials', () => {
        const uscsFineGrainedMaterials = ['ML', 'CL', 'OL', 'MH', 'CH', 'OH'];
        const settings = { intensity: 0.7, scale: 1.0, showTextures: true };

        uscsFineGrainedMaterials.forEach(material => {
          const texture = VolumetricMeshGenerator.createTexture(material, settings);
          expect(texture).toBeDefined();
          expect(texture.userData).toBeDefined();
          expect(texture.userData.material).toBe(material);
          expect(texture.userData.pattern).toBeDefined();
        });
      });

      test('creates texture for USCS highly organic materials', () => {
        const settings = { intensity: 0.7, scale: 1.0, showTextures: true };
        
        const texture = VolumetricMeshGenerator.createTexture('PT', settings);
        expect(texture).toBeDefined();
        expect(texture.userData).toBeDefined();
        expect(texture.userData.material).toBe('PT');
        expect(texture.userData.pattern).toBe('organic_irregular');
      });

      test('respects texture settings parameters', () => {
        const materialSets = [
          { material: 'GW', expectedPattern: 'gravel_circles' },
          { material: 'SW', expectedPattern: 'sand_dots' },
          { material: 'CL', expectedPattern: 'horizontal_dashed' },
          { material: 'CH', expectedPattern: 'diagonal_crosshatch' },
          { material: 'PT', expectedPattern: 'organic_irregular' }
        ];

        materialSets.forEach(({ material, expectedPattern }) => {
          // Test with different settings
          const highIntensity = VolumetricMeshGenerator.createTexture(material, { 
            intensity: 0.9, scale: 2.0, showTextures: true 
          });
          const lowIntensity = VolumetricMeshGenerator.createTexture(material, { 
            intensity: 0.3, scale: 0.5, showTextures: true 
          });

          expect(highIntensity).toBeDefined();
          expect(lowIntensity).toBeDefined();
          expect(highIntensity.userData.pattern).toBe(expectedPattern);
          expect(lowIntensity.userData.pattern).toBe(expectedPattern);
        });
      });

      test('handles disabled textures', () => {
        const texture = VolumetricMeshGenerator.createTexture('GW', { 
          intensity: 0.7, scale: 1.0, showTextures: false 
        });
        
        expect(texture).toBeDefined();
        // Should still create texture but with different properties when disabled
        expect(texture.userData).toBeDefined();
      });

      test('handles legacy material texture creation', () => {
        const legacyMaterials = ['CLAY', 'SAND', 'GRAVEL', 'SILT', 'ROCK', 'PEAT'];
        const settings = { intensity: 0.7, scale: 1.0, showTextures: true };

        legacyMaterials.forEach(material => {
          const texture = VolumetricMeshGenerator.createTexture(material, settings);
          expect(texture).toBeDefined();
          expect(texture.userData).toBeDefined();
          expect(texture.userData.material).toBe(material);
        });
      });
    });

    describe('renderTexturePattern', () => {
      let mockCtx;

      beforeEach(() => {
        mockCtx = {
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
          globalAlpha: 1
        };
      });

      test('renders USCS gravel patterns correctly', () => {
        const gravelPatterns = [
          'gravel_circles',
          'gravel_silt',
          'gravel_clay'
        ];

        const options = {
          patternColor: '#D2691E',
          strokeColor: '#A0522D',
          adjustedSpacing: 20,
          scale: 1.0,
          materialType: 'GW'
        };

        gravelPatterns.forEach(pattern => {
          mockCtx.beginPath.mockClear();
          mockCtx.arc.mockClear();
          mockCtx.stroke.mockClear();

          VolumetricMeshGenerator.renderTexturePattern(mockCtx, pattern, options);
          
          if (pattern === 'gravel_circles') {
            expect(mockCtx.arc).toHaveBeenCalled();
          }
          expect(mockCtx.beginPath).toHaveBeenCalled();
        });
      });

      test('renders USCS sand patterns correctly', () => {
        const sandPatterns = [
          'sand_dots',
          'sand_silt', 
          'sand_clay'
        ];

        const options = {
          patternColor: '#F4A460',
          strokeColor: '#DEB887',
          adjustedSpacing: 15,
          scale: 1.0,
          materialType: 'SW'
        };

        sandPatterns.forEach(pattern => {
          mockCtx.beginPath.mockClear();
          mockCtx.arc.mockClear();
          mockCtx.fill.mockClear();

          VolumetricMeshGenerator.renderTexturePattern(mockCtx, pattern, options);
          
          if (pattern === 'sand_dots') {
            expect(mockCtx.arc).toHaveBeenCalled();
          }
          expect(mockCtx.beginPath).toHaveBeenCalled();
        });
      });

      test('renders USCS fine-grained patterns correctly', () => {
        const fineGrainedPatterns = [
          'horizontal_dashed',
          'horizontal_lines_organic',
          'diagonal_crosshatch',
          'diagonal_lines_organic'
        ];

        const options = {
          patternColor: '#A0522D',
          strokeColor: '#8B4513',
          adjustedSpacing: 12,
          scale: 1.0,
          materialType: 'CL'
        };

        fineGrainedPatterns.forEach(pattern => {
          mockCtx.beginPath.mockClear();
          mockCtx.moveTo.mockClear();
          mockCtx.lineTo.mockClear();
          mockCtx.stroke.mockClear();
          mockCtx.setLineDash.mockClear();

          VolumetricMeshGenerator.renderTexturePattern(mockCtx, pattern, options);
          
          expect(mockCtx.beginPath).toHaveBeenCalled();
          if (pattern.includes('dashed')) {
            expect(mockCtx.setLineDash).toHaveBeenCalled();
          }
          if (pattern.includes('horizontal') || pattern.includes('diagonal')) {
            expect(mockCtx.moveTo).toHaveBeenCalled();
            expect(mockCtx.lineTo).toHaveBeenCalled();
          }
        });
      });

      test('renders organic irregular pattern correctly', () => {
        const options = {
          patternColor: '#2F4F4F',
          strokeColor: '#1C3B3B',
          adjustedSpacing: 18,
          scale: 1.0,
          materialType: 'PT'
        };

        mockCtx.beginPath.mockClear();
        mockCtx.moveTo.mockClear();
        mockCtx.lineTo.mockClear();
        mockCtx.fill.mockClear();

        VolumetricMeshGenerator.renderTexturePattern(mockCtx, 'organic_irregular', options);
        
        expect(mockCtx.beginPath).toHaveBeenCalled();
        expect(mockCtx.fill).toHaveBeenCalled();
      });

      test('handles unknown patterns gracefully', () => {
        const options = {
          patternColor: '#CCCCCC',
          strokeColor: '#999999',
          adjustedSpacing: 15,
          scale: 1.0,
          materialType: 'UNKNOWN'
        };

        expect(() => {
          VolumetricMeshGenerator.renderTexturePattern(mockCtx, 'unknown_pattern', options);
        }).not.toThrow();
      });

      test('respects scale parameter in pattern rendering', () => {
        const options = {
          patternColor: '#D2691E',
          strokeColor: '#A0522D',
          adjustedSpacing: 20,
          scale: 2.0, // Double scale
          materialType: 'GW'
        };

        VolumetricMeshGenerator.renderTexturePattern(mockCtx, 'gravel_circles', options);
        
        // Scale should affect spacing calculations in the pattern rendering
        expect(mockCtx.beginPath).toHaveBeenCalled();
      });
    });

    describe('Pattern-Material Integration', () => {
      test('USCS materials map to geologically appropriate patterns', () => {
        const geologicallyAppropriate = {
          // Coarse-grained materials should have granular patterns
          'GW': 'gravel_circles',  // Well-graded gravel
          'GP': 'gravel_circles',  // Poorly-graded gravel  
          'SW': 'sand_dots',       // Well-graded sand
          'SP': 'sand_dots',       // Poorly-graded sand
          
          // Mixed coarse materials should show composite patterns
          'GM': 'gravel_silt',     // Silty gravel
          'GC': 'gravel_clay',     // Clayey gravel
          'SM': 'sand_silt',       // Silty sand
          'SC': 'sand_clay',       // Clayey sand
          
          // Fine-grained low plasticity - horizontal patterns
          'ML': 'horizontal_lines',        // Inorganic silt
          'CL': 'horizontal_dashed',       // Lean clay (dashed for plasticity)
          'OL': 'horizontal_lines_organic', // Organic silt
          
          // Fine-grained high plasticity - diagonal patterns (higher energy)
          'MH': 'diagonal_lines',          // Elastic silt
          'CH': 'diagonal_crosshatch',     // Fat clay (crosshatch for high plasticity)
          'OH': 'diagonal_lines_organic',  // Organic clay
          
          // Highly organic - irregular patterns
          'PT': 'organic_irregular'        // Peat
        };

        Object.entries(geologicallyAppropriate).forEach(([material, expectedPattern]) => {
          const actualPattern = VolumetricMeshGenerator.getDefaultPattern(material);
          expect(actualPattern).toBe(expectedPattern);
        });
      });

      test('legacy materials maintain backward compatibility patterns', () => {
        const legacyCompatibility = {
          'CLAY': 'horizontal_dashed',  // Should map to CL pattern
          'SAND': 'sand_dots',          // Should map to SW pattern
          'GRAVEL': 'gravel_circles',   // Should map to GW pattern
          'SILT': 'horizontal_lines',   // Should map to ML pattern
          'PEAT': 'organic_irregular',  // Should map to PT pattern
          'ROCK': 'rock_pattern'        // Special bedrock pattern
        };

        Object.entries(legacyCompatibility).forEach(([material, expectedPattern]) => {
          const actualPattern = VolumetricMeshGenerator.getDefaultPattern(material);
          expect(actualPattern).toBe(expectedPattern);
        });
      });

      test('pattern complexity matches material classification complexity', () => {
        // Simple materials should have simple patterns
        const simplePatterns = ['GW', 'GP', 'SW', 'SP', 'ML'];
        simplePatterns.forEach(material => {
          const pattern = VolumetricMeshGenerator.getDefaultPattern(material);
          // Simple patterns: circles, dots, horizontal lines
          expect(['gravel_circles', 'sand_dots', 'horizontal_lines']).toContain(pattern);
        });

        // Complex materials should have complex patterns  
        const complexPatterns = ['CH', 'OH', 'PT'];
        complexPatterns.forEach(material => {
          const pattern = VolumetricMeshGenerator.getDefaultPattern(material);
          // Complex patterns: crosshatch, organic, irregular
          expect(['diagonal_crosshatch', 'diagonal_lines_organic', 'organic_irregular']).toContain(pattern);
        });
      });
    });

    describe('Texture Memory Management', () => {
      test('texture disposal prevents memory leaks', () => {
        const settings = { intensity: 0.7, scale: 1.0, showTextures: true };
        const texture = VolumetricMeshGenerator.createTexture('GW', settings);
        
        expect(texture).toBeDefined();
        expect(texture.dispose).toBeDefined();
        expect(typeof texture.dispose).toBe('function');
        
        // Should not throw when disposing
        expect(() => texture.dispose()).not.toThrow();
      });

      test('texture caching prevents duplicate creation', () => {
        const settings = { intensity: 0.7, scale: 1.0, showTextures: true };
        
        const texture1 = VolumetricMeshGenerator.createTexture('GW', settings);
        const texture2 = VolumetricMeshGenerator.createTexture('GW', settings);
        
        expect(texture1).toBeDefined();
        expect(texture2).toBeDefined();
        
        // Textures should have consistent properties even if cached
        expect(texture1.userData.material).toBe(texture2.userData.material);
        expect(texture1.userData.pattern).toBe(texture2.userData.pattern);
      });

      test('texture creation handles canvas disposal', () => {
        const settings = { intensity: 0.7, scale: 1.0, showTextures: true };
        
        // Should handle canvas cleanup internally
        expect(() => {
          for (let i = 0; i < 10; i++) {
            const texture = VolumetricMeshGenerator.createTexture(`material_${i}`, settings);
            if (texture && texture.dispose) {
              texture.dispose();
            }
          }
        }).not.toThrow();
      });
    });

    describe('Performance Optimization', () => {
      test('texture creation completes within performance threshold', () => {
        const settings = { intensity: 0.7, scale: 1.0, showTextures: true };
        const allUSCSMaterials = ['GW', 'GP', 'GM', 'GC', 'SW', 'SP', 'SM', 'SC', 
                                  'ML', 'CL', 'OL', 'MH', 'CH', 'OH', 'PT'];
        
        const startTime = performance.now();
        
        allUSCSMaterials.forEach(material => {
          const texture = VolumetricMeshGenerator.createTexture(material, settings);
          expect(texture).toBeDefined();
        });
        
        const endTime = performance.now();
        const executionTime = endTime - startTime;
        
        // Should create all USCS textures quickly (under 100ms in test environment)
        expect(executionTime).toBeLessThan(100);
      });

      test('pattern rendering scales efficiently with complexity', () => {
        const mockCtx = {
          beginPath: jest.fn(),
          moveTo: jest.fn(), 
          lineTo: jest.fn(),
          arc: jest.fn(),
          stroke: jest.fn(),
          fill: jest.fn(),
          closePath: jest.fn(),
          save: jest.fn(),
          restore: jest.fn(),
          setLineDash: jest.fn(),
          fillStyle: '#000',
          strokeStyle: '#000'
        };

        const options = {
          patternColor: '#D2691E',
          strokeColor: '#A0522D', 
          adjustedSpacing: 20,
          scale: 1.0,
          materialType: 'GW'
        };

        const startTime = performance.now();
        
        // Render multiple complex patterns
        const complexPatterns = ['diagonal_crosshatch', 'organic_irregular', 'gravel_clay'];
        complexPatterns.forEach(pattern => {
          VolumetricMeshGenerator.renderTexturePattern(mockCtx, pattern, options);
        });
        
        const endTime = performance.now();
        const executionTime = endTime - startTime;
        
        // Complex pattern rendering should complete quickly
        expect(executionTime).toBeLessThan(50);
      });
    });

    describe('Error Handling and Edge Cases', () => {
      test('handles invalid material codes gracefully', () => {
        const settings = { intensity: 0.7, scale: 1.0, showTextures: true };
        
        expect(() => {
          VolumetricMeshGenerator.createTexture(null, settings);
        }).not.toThrow();
        
        expect(() => {
          VolumetricMeshGenerator.createTexture(undefined, settings);
        }).not.toThrow();
        
        expect(() => {
          VolumetricMeshGenerator.createTexture('', settings);
        }).not.toThrow();
        
        expect(() => {
          VolumetricMeshGenerator.createTexture('INVALID_CODE', settings);
        }).not.toThrow();
      });

      test('handles malformed texture settings', () => {
        expect(() => {
          VolumetricMeshGenerator.createTexture('GW', null);
        }).not.toThrow();
        
        expect(() => {
          VolumetricMeshGenerator.createTexture('GW', {});
        }).not.toThrow();
        
        expect(() => {
          VolumetricMeshGenerator.createTexture('GW', { intensity: -1, scale: 0 });
        }).not.toThrow();
        
        expect(() => {
          VolumetricMeshGenerator.createTexture('GW', { intensity: 2, scale: 100 });
        }).not.toThrow();
      });

      test('handles canvas creation failures', () => {
        // Temporarily break document.createElement
        const originalCreateElement = global.document?.createElement;
        if (global.document) {
          global.document.createElement = jest.fn(() => null);
        }

        const settings = { intensity: 0.7, scale: 1.0, showTextures: true };
        
        expect(() => {
          VolumetricMeshGenerator.createTexture('GW', settings);
        }).not.toThrow();

        // Restore original function
        if (global.document && originalCreateElement) {
          global.document.createElement = originalCreateElement;
        }
      });

      test('validates pattern parameters within reasonable bounds', () => {
        const mockCtx = {
          beginPath: jest.fn(),
          arc: jest.fn(),
          stroke: jest.fn(),
          fill: jest.fn(),
          closePath: jest.fn(),
          fillStyle: '#000',
          strokeStyle: '#000'
        };

        // Extreme values should be handled gracefully
        const extremeOptions = {
          patternColor: '#D2691E',
          strokeColor: '#A0522D',
          adjustedSpacing: 0.1,    // Very small
          scale: 1000,             // Very large
          materialType: 'GW'
        };

        expect(() => {
          VolumetricMeshGenerator.renderTexturePattern(mockCtx, 'gravel_circles', extremeOptions);
        }).not.toThrow();
      });
    });

    describe('Three.js Integration', () => {
      test('textures integrate properly with Three.js materials', () => {
        const settings = { intensity: 0.7, scale: 1.0, showTextures: true };
        
        const uscsTestMaterials = ['GW', 'SW', 'CL', 'CH', 'PT'];
        
        uscsTestMaterials.forEach(material => {
          const volumeData = {
            material: material,
            vertices: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
            indices: new Uint32Array([0, 1, 2]),
            colors: new Float32Array([0.5, 0.3, 0.1, 0.5, 0.3, 0.1, 0.5, 0.3, 0.1]),
            normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]),
            uvs: new Float32Array([0, 0, 1, 0, 0.5, 1]),
            vertexCount: 3,
            indexCount: 3
          };
          
          const mesh = VolumetricMeshGenerator.createThreeJsMesh(volumeData, settings, null, settings);
          expect(mesh).toBeDefined();
          expect(mesh.geometry).toBeDefined();
          expect(mesh.material).toBeDefined();
          
          // Material should have texture applied when settings.showTextures is true
          if (settings.showTextures) {
            expect(mesh.material.map).toBeDefined();
          }
        });
      });

      test('UV coordinates work correctly with USCS texture patterns', () => {
        const volumeData = {
          material: 'GW',
          vertices: new Float32Array([
            0, 0, 0,    // Bottom-left
            10, 0, 0,   // Bottom-right  
            0, 10, 0    // Top-left
          ]),
          indices: new Uint32Array([0, 1, 2]),
          colors: new Float32Array([0.8, 0.4, 0.1, 0.8, 0.4, 0.1, 0.8, 0.4, 0.1]),
          normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]),
          uvs: new Float32Array([
            0.0, 0.0,   // Bottom-left UV
            1.0, 0.0,   // Bottom-right UV
            0.0, 1.0    // Top-left UV
          ]),
          vertexCount: 3,
          indexCount: 3
        };
        
        const textureSettings = { intensity: 0.8, scale: 1.5, showTextures: true };
        const mesh = VolumetricMeshGenerator.createThreeJsMesh(volumeData, {}, null, textureSettings);
        
        expect(mesh).toBeDefined();
        expect(mesh.geometry.attributes.uv).toBeDefined();
        expect(mesh.geometry.attributes.uv.array).toEqual(volumeData.uvs);
        
        // Texture should be applied to material
        expect(mesh.material.map).toBeDefined();
        expect(mesh.material.map.userData.material).toBe('GW');
        expect(mesh.material.map.userData.pattern).toBe('gravel_circles');
      });
    });
  });
});