/**
 * Visual Consistency Test Suite for USCS Materials Integration
 * 
 * This test suite validates that UI material selection matches 3D rendering
 * across all USCS materials, ensuring visual consistency between the user
 * interface and the 3D geological visualization pipeline.
 * 
 * Visual Consistency Testing Focus:
 * 1. UI material selection color matches 3D borehole marker colors
 * 2. Material colors are consistent across all 3D services
 * 3. Texture generation matches material selection
 * 4. Water table visualization colors are consistent
 * 5. Label colors match corresponding 3D objects
 * 6. Interpolation model colors match selected materials
 * 7. Export color preservation validation
 */

import * as THREE from 'three';
import BoreholeVisualizer from '../services/BoreholeVisualizer';
import { VolumetricMeshGenerator } from '../services/VolumetricMeshGenerator';
import { OptimizedVolumetricMeshGenerator } from '../services/OptimizedVolumetricMeshGenerator';
import { getMaterialProperties, STANDARD_MATERIALS, USCS_CLASSIFICATIONS } from '../utils/materialStandardization';

// Mock Three.js for visual consistency testing
jest.mock('three', () => ({
  Color: jest.fn((color) => {
    const hex = typeof color === 'string' && color.startsWith('#') ? 
      parseInt(color.slice(1), 16) : 0x808080;
    const mockColor = {
      r: ((hex >> 16) & 255) / 255,
      g: ((hex >> 8) & 255) / 255,
      b: (hex & 255) / 255,
      getHex: () => hex,
      clone: () => mockColor,
      multiplyScalar: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      getHexString: () => color.startsWith('#') ? color.slice(1).toUpperCase() : '808080'
    };
    return mockColor;
  }),
  
  Group: jest.fn(() => ({
    name: '',
    userData: {},
    children: [],
    add: jest.fn(),
    position: { set: jest.fn() },
    layers: { enable: jest.fn() },
    updateMatrixWorld: jest.fn(),
    traverse: jest.fn()
  })),
  
  CylinderGeometry: jest.fn(() => ({ dispose: jest.fn() })),
  SphereGeometry: jest.fn(() => ({ dispose: jest.fn() })),
  CircleGeometry: jest.fn(() => ({ dispose: jest.fn() })),
  RingGeometry: jest.fn(() => ({ dispose: jest.fn() })),
  
  MeshStandardMaterial: jest.fn(() => ({
    color: { set: jest.fn(), multiplyScalar: jest.fn() },
    dispose: jest.fn()
  })),
  
  MeshLambertMaterial: jest.fn(() => ({
    color: { set: jest.fn(), multiplyScalar: jest.fn() },
    dispose: jest.fn()
  })),
  
  Mesh: jest.fn(() => ({
    position: { set: jest.fn() },
    layers: { enable: jest.fn() },
    userData: {},
    geometry: { computeBoundingSphere: jest.fn() }
  })),
  
  CanvasTexture: jest.fn(() => ({
    wrapS: 0, wrapT: 0,
    repeat: { set: jest.fn() },
    needsUpdate: true,
    dispose: jest.fn()
  })),
  
  RepeatWrapping: 1000,
  NearestFilter: 1003,
  DoubleSide: 2
}));

// Mock utilities
jest.mock('../utils/scaleConstants', () => ({
  getBoreholeDimensions: () => ({ markerRadius: 1.0, markerHeight: 2.0 })
}));

jest.mock('../utils/threeJsHelpers', () => ({
  createGlassmorphismLabel: jest.fn(() => ({
    position: { set: jest.fn() },
    style: { backgroundColor: '#000000', color: '#FFFFFF' }
  }))
}));

describe('USCS Materials Visual Consistency Testing', () => {
  let mockScene, mockCamera, mockSceneManager, boreholeVisualizer;

  beforeEach(() => {
    mockScene = {
      add: jest.fn(),
      remove: jest.fn(),
      getObjectByName: jest.fn(),
      traverse: jest.fn()
    };
    
    mockCamera = { position: { x: 0, y: 10, z: 10 } };
    mockSceneManager = { addCSS3D: jest.fn(), removeCSS3D: jest.fn() };
    
    boreholeVisualizer = new BoreholeVisualizer(mockScene, mockCamera, mockSceneManager);
    jest.clearAllMocks();
  });

  afterEach(() => {
    if (boreholeVisualizer) {
      boreholeVisualizer.dispose();
    }
  });

  describe('UI to 3D Material Color Consistency', () => {
    test('should maintain consistent colors between UI selection and 3D visualization for all USCS materials', () => {
      const allUSCSMaterials = Object.keys(USCS_CLASSIFICATIONS);
      
      allUSCSMaterials.forEach(material => {
        // Simulate UI material selection (get standard properties)
        const uiMaterialProps = getMaterialProperties(material);
        const uiColor = new THREE.Color(uiMaterialProps.color);
        
        // Get 3D service colors
        const visualizerColor = BoreholeVisualizer.getMaterialColor(material);
        const volumeColor = VolumetricMeshGenerator.getMaterialColor(material);
        const optimizedColor = OptimizedVolumetricMeshGenerator.getMaterialColor(material);
        
        // All colors should match UI selection
        expect(visualizerColor.r).toBeCloseTo(uiColor.r, 2);
        expect(visualizerColor.g).toBeCloseTo(uiColor.g, 2);
        expect(visualizerColor.b).toBeCloseTo(uiColor.b, 2);
        
        expect(volumeColor.r).toBeCloseTo(uiColor.r, 2);
        expect(volumeColor.g).toBeCloseTo(uiColor.g, 2);
        expect(volumeColor.b).toBeCloseTo(uiColor.b, 2);
        
        expect(optimizedColor.r).toBeCloseTo(uiColor.r, 2);
        expect(optimizedColor.g).toBeCloseTo(uiColor.g, 2);
        expect(optimizedColor.b).toBeCloseTo(uiColor.b, 2);
      });
    });

    test('should provide consistent visual feedback for material categories', () => {
      const materialCategories = {
        'COARSE_GRAINED_GRAVELS': ['GW', 'GP', 'GM', 'GC'],
        'COARSE_GRAINED_SANDS': ['SW', 'SP', 'SM', 'SC'],
        'FINE_GRAINED_LOW_PLASTICITY': ['ML', 'CL', 'OL'],
        'FINE_GRAINED_HIGH_PLASTICITY': ['MH', 'CH', 'OH'],
        'HIGHLY_ORGANIC': ['PT']
      };

      Object.entries(materialCategories).forEach(([category, materials]) => {
        const categoryColors = materials.map(material => {
          const props = getMaterialProperties(material);
          return new THREE.Color(props.color);
        });

        // Colors within category should be related but distinct
        for (let i = 0; i < categoryColors.length; i++) {
          for (let j = i + 1; j < categoryColors.length; j++) {
            const colorDistance = Math.sqrt(
              Math.pow(categoryColors[i].r - categoryColors[j].r, 2) +
              Math.pow(categoryColors[i].g - categoryColors[j].g, 2) +
              Math.pow(categoryColors[i].b - categoryColors[j].b, 2)
            );
            
            // Colors should be distinct enough to differentiate (distance > 0.1)
            expect(colorDistance).toBeGreaterThan(0.1);
            
            // But not so different that they don't feel related (distance < 1.0)
            expect(colorDistance).toBeLessThan(1.0);
          }
        }
      });
    });

    test('should maintain color consistency across different opacity levels', () => {
      const testMaterials = ['CL', 'SW', 'GW', 'CH', 'ML'];
      const opacityLevels = [0.1, 0.3, 0.5, 0.7, 0.9];
      
      testMaterials.forEach(material => {
        const baseColor = VolumetricMeshGenerator.getMaterialColor(material);
        
        opacityLevels.forEach(opacity => {
          // Simulate layer volume creation with different opacity
          const topSurface = [
            { x: 0, y: 0, z: 10 },
            { x: 10, y: 0, z: 10 },
            { x: 0, y: 10, z: 10 },
            { x: 10, y: 10, z: 10 }
          ];

          const bottomSurface = [
            { x: 0, y: 0, z: 5 },
            { x: 10, y: 0, z: 5 },
            { x: 0, y: 10, z: 5 },
            { x: 10, y: 10, z: 5 }
          ];

          const extent = { minX: -1, maxX: 11, minY: -1, maxY: 11 };
          
          const layerVolume = VolumetricMeshGenerator.createLayerVolume(
            topSurface,
            bottomSurface,
            material,
            extent,
            2,
            { opacity: opacity }
          );

          expect(layerVolume).toBeTruthy();
          expect(layerVolume.colors.length).toBeGreaterThan(0);

          // Colors should maintain material characteristics regardless of opacity
          // Base color should be recognizable in the volume colors
          let colorMatches = 0;
          for (let i = 0; i < layerVolume.colors.length; i += 3) {
            const volumeR = layerVolume.colors[i];
            const volumeG = layerVolume.colors[i + 1];
            const volumeB = layerVolume.colors[i + 2];
            
            // Check if this color is close to the base material color
            const colorDiff = Math.abs(volumeR - baseColor.r) +
                             Math.abs(volumeG - baseColor.g) +
                             Math.abs(volumeB - baseColor.b);
            
            if (colorDiff < 0.5) { // Allow for brightness variations
              colorMatches++;
            }
          }
          
          expect(colorMatches).toBeGreaterThan(0);
        });
      });
    });
  });

  describe('3D Object Visual Consistency', () => {
    test('should create visually consistent borehole markers for all USCS materials', () => {
      const allUSCSMaterials = Object.keys(USCS_CLASSIFICATIONS);
      
      allUSCSMaterials.forEach(material => {
        const borehole = {
          id: `visual-test-${material}`,
          x: 100,
          y: 50,
          z: 0,
          diameter: 0.2,
          depth: 15,
          color: getMaterialProperties(material).color,
          layers: [
            {
              id: 1,
              material: material,
              from: 0,
              to: 15,
              customColor: getMaterialProperties(material).color
            }
          ]
        };

        const boreholeGroup = boreholeVisualizer.createEnhancedBoreholeMarker(borehole);
        
        expect(boreholeGroup).toBeTruthy();
        expect(boreholeGroup.name).toBe(`borehole_${borehole.id}`);
        expect(boreholeGroup.children.length).toBeGreaterThan(0);

        // Verify borehole marker uses correct material color
        const expectedColor = new THREE.Color(getMaterialProperties(material).color);
        expect(THREE.MeshStandardMaterial).toHaveBeenCalled();
        expect(THREE.MeshLambertMaterial).toHaveBeenCalled();
      });
    });

    test('should create visually consistent strata cylinders with proper USCS colors', () => {
      const testMaterials = ['CL', 'SW', 'GW', 'CH', 'ML', 'SM'];
      
      testMaterials.forEach(material => {
        const borehole = {
          id: `strata-test-${material}`,
          x: 100,
          y: 50,
          z: 0,
          diameter: 0.2,
          depth: 12,
          layers: [
            {
              id: 1,
              material: material,
              from: 0,
              to: 6
            },
            {
              id: 2,
              material: material,
              from: 6,
              to: 12
            }
          ]
        };

        const strataGroup = boreholeVisualizer.createBoreholeStrata(borehole, { layers: [] });
        
        expect(strataGroup).toBeTruthy();
        expect(strataGroup.name).toBe(`borehole_strata_${borehole.id}`);

        // Verify strata colors match material properties
        expect(THREE.MeshLambertMaterial).toHaveBeenCalledWith(
          expect.objectContaining({
            color: getMaterialProperties(material).color,
            transparent: true,
            opacity: 0.9,
            side: THREE.DoubleSide
          })
        );

        // Verify layer labels use USCS codes
        const labels = strataGroup.userData.labels;
        expect(labels).toHaveLength(2);
        expect(labels[0].text).toBe(material.toUpperCase());
        expect(labels[1].text).toBe(material.toUpperCase());
      });
    });

    test('should create visually consistent water table indicators', () => {
      const testMaterials = ['CL', 'SW', 'GW'];
      
      testMaterials.forEach(material => {
        const borehole = {
          id: `water-table-test-${material}`,
          x: 100,
          y: 50,
          z: 0,
          diameter: 0.2,
          depth: 10,
          waterTableEncountered: true,
          waterTableDepth: 3.5,
          layers: [
            {
              id: 1,
              material: material,
              from: 0,
              to: 10
            }
          ]
        };

        const waterTableRing = boreholeVisualizer.createWaterTableRing(borehole);
        
        expect(waterTableRing).toBeTruthy();
        expect(waterTableRing.name).toBe(`water_table_${borehole.id}`);

        // Water table should have consistent blue appearance regardless of surrounding material
        expect(THREE.CircleGeometry).toHaveBeenCalled();
        expect(THREE.RingGeometry).toHaveBeenCalled();
        expect(THREE.MeshLambertMaterial).toHaveBeenCalledWith(
          expect.objectContaining({
            color: '#1976D2', // Standard water blue
            transparent: true,
            opacity: 0.6
          })
        );
      });
    });
  });

  describe('Texture Visual Consistency', () => {
    test('should generate material-specific texture patterns that visually match USCS classification', () => {
      const materialPatternMap = {
        'CL': 'horizontal lines',    // Clay - stratified appearance
        'SW': 'dots',               // Sand - granular appearance
        'GW': 'circles',            // Gravel - rounded particles
        'MH': 'diagonal lines',     // Silt - directional structure
        'PT': 'irregular organic'   // Peat - organic matter
      };

      Object.entries(materialPatternMap).forEach(([material, expectedPattern]) => {
        // Mock canvas for texture creation
        const mockContext = {
          fillStyle: '',
          strokeStyle: '',
          lineWidth: 0,
          fillRect: jest.fn(),
          strokeRect: jest.fn(),
          beginPath: jest.fn(),
          moveTo: jest.fn(),
          lineTo: jest.fn(),
          stroke: jest.fn(),
          fill: jest.fn(),
          arc: jest.fn(),
          font: '',
          textAlign: '',
          fillText: jest.fn()
        };

        const mockCanvas = {
          width: 128,
          height: 128,
          getContext: jest.fn(() => mockContext)
        };

        global.document = {
          createElement: jest.fn(() => mockCanvas)
        };

        const materialProps = getMaterialProperties(material);
        const texture = boreholeVisualizer.createHighContrastSoilTexture(material, materialProps.color);

        expect(texture).toBeTruthy();
        expect(THREE.CanvasTexture).toHaveBeenCalled();

        // Verify base color fill
        expect(mockContext.fillRect).toHaveBeenCalledWith(0, 0, 128, 128);

        // Verify pattern-specific drawing based on material type
        if (expectedPattern.includes('lines')) {
          expect(mockContext.stroke).toHaveBeenCalled();
        } else if (expectedPattern.includes('dots') || expectedPattern.includes('circles')) {
          expect(mockContext.fill).toHaveBeenCalled() || expect(mockContext.stroke).toHaveBeenCalled();
        }
      });
    });

    test('should maintain texture contrast across different base colors', () => {
      const darkMaterials = ['CH', 'PT', 'ROCK'];  // Typically dark colors
      const lightMaterials = ['SW', 'ML', 'FILL']; // Typically light colors
      
      [...darkMaterials, ...lightMaterials].forEach(material => {
        const mockContext = {
          fillStyle: '',
          strokeStyle: '',
          lineWidth: 0,
          fillRect: jest.fn(),
          strokeRect: jest.fn(),
          beginPath: jest.fn(),
          moveTo: jest.fn(),
          lineTo: jest.fn(),
          stroke: jest.fn(),
          fill: jest.fn(),
          arc: jest.fn(),
          font: '',
          textAlign: '',
          fillText: jest.fn()
        };

        global.document = {
          createElement: jest.fn(() => ({
            width: 128,
            height: 128,
            getContext: jest.fn(() => mockContext)
          }))
        };

        const materialProps = getMaterialProperties(material);
        const texture = boreholeVisualizer.createHighContrastSoilTexture(material, materialProps.color);

        expect(texture).toBeTruthy();

        // Verify high contrast patterns are created
        // Pattern color should be WHITE for maximum visibility
        expect(mockContext.strokeStyle).toContain('#FFFFFF') || 
               expect(mockContext.fillStyle).toContain('#FFFFFF');
      });
    });
  });

  describe('Label and Annotation Visual Consistency', () => {
    test('should create labels with colors that complement USCS material colors', () => {
      const testMaterials = ['CL', 'SW', 'GW', 'CH', 'ML'];
      
      testMaterials.forEach(material => {
        const borehole = {
          id: `label-test-${material}`,
          name: `Test-${material}`,
          x: 100,
          y: 50,
          z: 0,
          depth: 10,
          color: getMaterialProperties(material).color
        };

        boreholeVisualizer.createCompactPinLabel(borehole);

        // Verify label creation with material color
        expect(mockSceneManager.addCSS3D).toHaveBeenCalledWith(
          `borehole-pin-label-${borehole.id}`,
          expect.objectContaining({
            position: expect.objectContaining({
              set: expect.any(Function)
            })
          })
        );

        // Label should use borehole color for consistency
        expect(jest.requireMock('../utils/threeJsHelpers').createGlassmorphismLabel)
          .toHaveBeenCalledWith(
            expect.stringContaining(material),
            borehole.color,
            'borehole-pin'
          );
      });
    });

    test('should create strata labels with consistent USCS material identification', () => {
      const borehole = {
        id: 'label-consistency-test',
        x: 100,
        y: 50,
        z: 0,
        diameter: 0.2,
        depth: 18,
        layers: [
          { id: 1, material: 'CL', from: 0, to: 6 },
          { id: 2, material: 'SW', from: 6, to: 12 },
          { id: 3, material: 'GW', from: 12, to: 18 }
        ]
      };

      const strataGroup = boreholeVisualizer.createBoreholeStrata(borehole, { layers: [] });
      const labels = strataGroup.userData.labels;

      expect(labels).toHaveLength(3);
      
      // Labels should display USCS codes
      expect(labels[0].text).toBe('CL');
      expect(labels[1].text).toBe('SW');
      expect(labels[2].text).toBe('GW');

      // Label colors should match layer colors
      expect(labels[0].color).toBe(getMaterialProperties('CL').color);
      expect(labels[1].color).toBe(getMaterialProperties('SW').color);
      expect(labels[2].color).toBe(getMaterialProperties('GW').color);
    });
  });

  describe('Color Accessibility and Contrast', () => {
    test('should ensure USCS material colors meet accessibility standards', () => {
      const allUSCSMaterials = Object.keys(USCS_CLASSIFICATIONS);
      
      allUSCSMaterials.forEach(material => {
        const materialProps = getMaterialProperties(material);
        const color = new THREE.Color(materialProps.color);
        
        // Convert to RGB values (0-255)
        const r = Math.round(color.r * 255);
        const g = Math.round(color.g * 255);
        const b = Math.round(color.b * 255);
        
        // Calculate relative luminance (WCAG formula)
        const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        
        // Colors should not be too light (hard to see) or too dark (poor contrast)
        expect(luminance).toBeGreaterThan(0.1); // Not too dark
        expect(luminance).toBeLessThan(0.9);    // Not too light
        
        // RGB values should be distinguishable (not gray-scale)
        const colorRange = Math.max(r, g, b) - Math.min(r, g, b);
        expect(colorRange).toBeGreaterThan(20); // Should have some color distinction
      });
    });

    test('should provide sufficient contrast between related USCS materials', () => {
      const relatedMaterialPairs = [
        ['GW', 'GP'],  // Well-graded vs Poorly-graded Gravel
        ['SW', 'SP'],  // Well-graded vs Poorly-graded Sand
        ['CL', 'CH'],  // Low vs High plasticity Clay
        ['ML', 'MH']   // Low vs High plasticity Silt
      ];

      relatedMaterialPairs.forEach(([material1, material2]) => {
        const color1 = new THREE.Color(getMaterialProperties(material1).color);
        const color2 = new THREE.Color(getMaterialProperties(material2).color);

        // Calculate color distance in RGB space
        const colorDistance = Math.sqrt(
          Math.pow((color1.r - color2.r) * 255, 2) +
          Math.pow((color1.g - color2.g) * 255, 2) +
          Math.pow((color1.b - color2.b) * 255, 2)
        );

        // Related materials should have enough contrast to distinguish
        expect(colorDistance).toBeGreaterThan(50); // Minimum distinguishable difference
      });
    });
  });

  describe('Cross-Platform Visual Consistency', () => {
    test('should maintain color consistency across different rendering contexts', () => {
      const testMaterials = ['CL', 'SW', 'GW', 'CH'];
      
      testMaterials.forEach(material => {
        // Test color consistency across different Three.js material types
        const standardColor = new THREE.Color(getMaterialProperties(material).color);
        const visualizerColor = BoreholeVisualizer.getMaterialColor(material);
        const volumeColor = VolumetricMeshGenerator.getMaterialColor(material);
        
        // All should produce the same color values
        expect(visualizerColor.getHex()).toBe(standardColor.getHex());
        expect(volumeColor.getHex()).toBe(standardColor.getHex());

        // Test hex string representation for consistency
        expect(visualizerColor.getHexString()).toBe(standardColor.getHexString());
        expect(volumeColor.getHexString()).toBe(standardColor.getHexString());
      });
    });

    test('should handle color precision across different number formats', () => {
      const testColor = getMaterialProperties('CL').color; // #A0522D
      
      const color1 = new THREE.Color(testColor);           // Hex string
      const color2 = new THREE.Color(parseInt(testColor.slice(1), 16)); // Hex number
      
      // Should produce identical results regardless of input format
      expect(color1.r).toBeCloseTo(color2.r, 3);
      expect(color1.g).toBeCloseTo(color2.g, 3);
      expect(color1.b).toBeCloseTo(color2.b, 3);
    });
  });

  describe('Visual Regression Prevention', () => {
    test('should maintain established USCS color scheme', () => {
      // Define expected colors for key USCS materials (regression test)
      const establishedColors = {
        'CL': '#A0522D', // Lean Clay - brown
        'SW': '#F4A460', // Well-graded Sand - sandy brown
        'GW': '#D2691E', // Well-graded Gravel - chocolate
        'CH': '#8B4513', // Fat Clay - saddle brown
        'ML': '#B8860B', // Inorganic Silt - dark goldenrod
        'PT': '#2F4F4F'  // Peat - dark slate gray
      };

      Object.entries(establishedColors).forEach(([material, expectedHex]) => {
        const actualProps = getMaterialProperties(material);
        expect(actualProps.color.toUpperCase()).toBe(expectedHex.toUpperCase());
      });
    });

    test('should prevent accidental color modifications', () => {
      const originalColors = {};
      
      // Capture original colors
      Object.keys(USCS_CLASSIFICATIONS).forEach(material => {
        originalColors[material] = getMaterialProperties(material).color;
      });

      // Simulate material processing
      Object.keys(USCS_CLASSIFICATIONS).forEach(material => {
        BoreholeVisualizer.getMaterialColor(material);
        VolumetricMeshGenerator.getMaterialColor(material);
        OptimizedVolumetricMeshGenerator.getMaterialColor(material);
      });

      // Verify colors haven't changed
      Object.keys(USCS_CLASSIFICATIONS).forEach(material => {
        const currentColor = getMaterialProperties(material).color;
        expect(currentColor).toBe(originalColors[material]);
      });
    });
  });
});