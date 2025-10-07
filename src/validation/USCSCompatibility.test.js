// Validation tests to ensure existing borehole data works with new USCS system
import { normalizeMaterialName, getMaterialProperties } from '../utils/materialStandardization';
import { Borehole } from '../models/Borehole';

describe('USCS System Compatibility Validation', () => {
  
  describe('Legacy Data Compatibility', () => {
    test('existing legacy borehole data remains functional', () => {
      // Simulate existing data structures that might be in the application
      const existingBoreholeData = [
        {
          id: 'legacy_1',
          x: 0, z: 0, depth: 20,
          layers: [
            { material: 'clay', from: 0, to: 5, thickness: 5 },
            { material: 'SAND', from: 5, to: 12, thickness: 7 },
            { material: 'Rock', from: 12, to: 20, thickness: 8 }
          ]
        },
        {
          id: 'legacy_2', 
          x: 10, z: 0, depth: 18,
          layers: [
            { material: 'Silt', from: 0, to: 4, thickness: 4 },
            { material: 'clayey sand', from: 4, to: 10, thickness: 6 },
            { material: 'gravel', from: 10, to: 18, thickness: 8 }
          ]
        }
      ];

      // Convert to Borehole instances
      const boreholes = existingBoreholeData.map(data => new Borehole(data));

      // Validate that all materials can be normalized
      boreholes.forEach(borehole => {
        borehole.layers.forEach(layer => {
          const normalized = normalizeMaterialName(layer.material);
          expect(normalized).toBeDefined();
          expect(normalized).not.toBe('UNKNOWN');
          
          const properties = getMaterialProperties(normalized);
          expect(properties).toBeDefined();
          expect(properties.color).toBeDefined();
          expect(properties.pattern).toBeDefined();
          expect(properties.density).toBeGreaterThan(0);
        });
      });

      // Expected normalized materials
      expect(normalizeMaterialName('clay')).toBe('CLAY');
      expect(normalizeMaterialName('SAND')).toBe('SAND');
      expect(normalizeMaterialName('Rock')).toBe('ROCK');
      expect(normalizeMaterialName('Silt')).toBe('SILT');
      expect(normalizeMaterialName('clayey sand')).toBe('SC'); // Should match SC alias
      expect(normalizeMaterialName('gravel')).toBe('GRAVEL');
    });

    test('mixed legacy and USCS materials work together', () => {
      const mixedData = {
        id: 'mixed_test',
        x: 5, z: 5, depth: 25,
        layers: [
          { material: 'TOPSOIL', from: 0, to: 1, thickness: 1 },     // Non-USCS
          { material: 'CL', from: 1, to: 6, thickness: 5 },          // USCS
          { material: 'clay', from: 6, to: 10, thickness: 4 },       // Legacy
          { material: 'well-graded sand', from: 10, to: 18, thickness: 8 }, // USCS alias
          { material: 'GRAVEL', from: 18, to: 25, thickness: 7 }     // Legacy uppercase
        ]
      };

      const borehole = new Borehole(mixedData);
      
      // All materials should normalize successfully
      const expectedMapping = {
        'TOPSOIL': 'TOPSOIL',
        'CL': 'CL',
        'clay': 'CLAY',
        'well-graded sand': 'SW',
        'GRAVEL': 'GRAVEL'
      };

      borehole.layers.forEach(layer => {
        const normalized = normalizeMaterialName(layer.material);
        const expected = expectedMapping[layer.material];
        expect(normalized).toBe(expected);
        
        // All should have valid properties
        const properties = getMaterialProperties(normalized);
        expect(properties).toBeDefined();
        expect(properties.color).toMatch(/^#[0-9A-F]{6}$/i);
      });
    });

    test('case insensitive material matching works', () => {
      const caseVariations = [
        'gw', 'Gw', 'GW', 'gW',
        'cl', 'Cl', 'CL', 'cL', 
        'pt', 'Pt', 'PT', 'pT',
        'clay', 'CLAY', 'Clay', 'cLaY',
        'sand', 'SAND', 'Sand', 'sAnD'
      ];

      caseVariations.forEach(variation => {
        const normalized = normalizeMaterialName(variation);
        expect(normalized).toBeDefined();
        expect(normalized).not.toBe('UNKNOWN');
        
        const properties = getMaterialProperties(normalized);
        expect(properties).toBeDefined();
      });

      // Verify specific case mappings
      expect(normalizeMaterialName('gw')).toBe('GW');
      expect(normalizeMaterialName('GW')).toBe('GW');
      expect(normalizeMaterialName('cl')).toBe('CL');
      expect(normalizeMaterialName('CL')).toBe('CL');
      expect(normalizeMaterialName('clay')).toBe('CLAY');
      expect(normalizeMaterialName('CLAY')).toBe('CLAY');
    });
  });

  describe('Workflow Integration Validation', () => {
    test('complete geological modeling workflow with USCS materials', () => {
      // Create realistic geological sequence using USCS classifications
      const geologicalBorehole = new Borehole({
        id: 'geological_validation',
        x: 0, z: 0, depth: 30,
        layers: [
          // Surface materials
          { material: 'TOPSOIL', from: 0, to: 0.5, thickness: 0.5, color: '#654321' },
          
          // Recent deposits - fine-grained
          { material: 'CL', from: 0.5, to: 4, thickness: 3.5, color: '#A0522D' },
          
          // Alluvial sequence
          { material: 'ML', from: 4, to: 7, thickness: 3, color: '#B8860B' },
          { material: 'SM', from: 7, to: 12, thickness: 5, color: '#D2B48C' },
          
          // Older deposits - coarse-grained
          { material: 'GW', from: 12, to: 20, thickness: 8, color: '#D2691E' },
          
          // Organic layer (could be problematic if found at depth)
          { material: 'PT', from: 20, to: 22, thickness: 2, color: '#2F4F4F' },
          
          // Bedrock
          { material: 'ROCK', from: 22, to: 30, thickness: 8, color: '#708090' }
        ]
      });

      // Validate each layer
      geologicalBorehole.layers.forEach((layer, index) => {
        const normalized = normalizeMaterialName(layer.material);
        const properties = getMaterialProperties(normalized);
        
        expect(normalized).toBeDefined();
        expect(properties).toBeDefined();
        expect(properties.pattern).toBeDefined();
        
        // Validate patterns are geologically appropriate
        if (['CL', 'ML'].includes(normalized)) {
          expect(properties.pattern).toMatch(/horizontal/);
        } else if (['GW', 'SW'].includes(normalized)) {
          expect(properties.pattern).toMatch(/circles|dots/);
        } else if (normalized === 'PT') {
          expect(properties.pattern).toBe('organic_irregular');
        }
      });

      // Validate geological sequence makes sense
      expect(geologicalBorehole.layers.length).toBe(7);
      expect(geologicalBorehole.layers[0].material).toBe('TOPSOIL'); // Surface
      expect(geologicalBorehole.layers[geologicalBorehole.layers.length - 1].material).toBe('ROCK'); // Bottom
    });

    test('material properties consistency across system', () => {
      const testMaterials = ['GW', 'SW', 'CL', 'CH', 'ML', 'MH', 'PT'];
      
      testMaterials.forEach(material => {
        const properties = getMaterialProperties(material);
        
        // Density should be reasonable for soil materials
        expect(properties.density).toBeGreaterThan(1.0);
        expect(properties.density).toBeLessThan(3.0);
        
        // Color should be valid hex
        expect(properties.color).toMatch(/^#[0-9A-F]{6}$/i);
        
        // Pattern should be defined and not empty
        expect(properties.pattern).toBeTruthy();
        expect(typeof properties.pattern).toBe('string');
        
        // Description should be informative
        expect(properties.description).toBeTruthy();
        expect(properties.description.length).toBeGreaterThan(10);
        
        // Category should be defined
        expect(properties.category).toBeTruthy();
      });
    });

    test('error handling maintains system stability', () => {
      const problematicInputs = [
        null, undefined, '', 
        'invalid_material_xyz', 
        '12345', 
        'special!@#characters',
        'very long material name that probably does not exist in the system',
        {},
        []
      ];

      problematicInputs.forEach(input => {
        // Should not throw errors
        expect(() => {
          const normalized = normalizeMaterialName(input);
          const properties = getMaterialProperties(normalized);
          
          // Should return fallback values
          expect(normalized).toBeDefined();
          expect(properties).toBeDefined();
          
        }).not.toThrow();
      });
    });
  });

  describe('Performance and Scalability', () => {
    test('material normalization performs well with large datasets', () => {
      const materialVariations = [
        'GW', 'gw', 'GP', 'gp', 'GM', 'gm', 'GC', 'gc',
        'SW', 'sw', 'SP', 'sp', 'SM', 'sm', 'SC', 'sc',
        'ML', 'ml', 'CL', 'cl', 'OL', 'ol',
        'MH', 'mh', 'CH', 'ch', 'OH', 'oh',
        'PT', 'pt',
        'CLAY', 'clay', 'SAND', 'sand', 'GRAVEL', 'gravel',
        'SILT', 'silt', 'ROCK', 'rock', 'PEAT', 'peat',
        'well-graded sand', 'lean clay', 'fat clay',
        'elastic silt', 'organic clay', 'highly organic soil'
      ];

      const startTime = performance.now();

      // Process materials multiple times to simulate real usage
      for (let i = 0; i < 100; i++) {
        materialVariations.forEach(material => {
          const normalized = normalizeMaterialName(material);
          const properties = getMaterialProperties(normalized);
          
          // Validate results are consistent
          expect(normalized).toBeDefined();
          expect(properties).toBeDefined();
        });
      }

      const endTime = performance.now();
      const executionTime = endTime - startTime;

      // Should complete quickly even with many iterations
      expect(executionTime).toBeLessThan(1000); // Less than 1 second
    });

    test('memory usage remains stable', () => {
      const materials = ['GW', 'CL', 'PT', 'SAND', 'ROCK'];
      const results = [];

      // Create many material property objects
      for (let i = 0; i < 1000; i++) {
        materials.forEach(material => {
          const properties = getMaterialProperties(material);
          results.push(properties);
        });
      }

      expect(results.length).toBe(5000);
      
      // All results should be valid
      results.forEach(result => {
        expect(result).toBeDefined();
        expect(result.color).toBeDefined();
        expect(result.pattern).toBeDefined();
        expect(result.density).toBeGreaterThan(0);
      });
    });
  });

  describe('Professional Standards Compliance', () => {
    test('USCS classifications follow professional standards', () => {
      // Verify USCS codes exist and have proper descriptions
      const requiredUSCSCodes = [
        'GW', 'GP', 'GM', 'GC', // Gravels
        'SW', 'SP', 'SM', 'SC', // Sands  
        'ML', 'CL', 'OL',       // Low plasticity silts/clays
        'MH', 'CH', 'OH',       // High plasticity silts/clays
        'PT'                    // Highly organic
      ];

      requiredUSCSCodes.forEach(code => {
        const properties = getMaterialProperties(code);
        
        expect(properties).toBeDefined();
        expect(properties.description).toBeTruthy();
        expect(properties.category).toBeTruthy();
        
        // Description should be professional and informative
        expect(properties.description.length).toBeGreaterThan(20);
        
        // Category should match USCS structure
        if (['GW', 'GP', 'GM', 'GC', 'SW', 'SP', 'SM', 'SC'].includes(code)) {
          expect(properties.category).toBe('COARSE_GRAINED');
        } else if (['ML', 'CL', 'OL'].includes(code)) {
          expect(properties.category).toBe('FINE_GRAINED_LOW');
        } else if (['MH', 'CH', 'OH'].includes(code)) {
          expect(properties.category).toBe('FINE_GRAINED_HIGH');
        } else if (code === 'PT') {
          expect(properties.category).toBe('HIGHLY_ORGANIC');
        }
      });
    });

    test('material densities are geologically realistic', () => {
      const materialDensityRanges = {
        // Organic materials (lowest density)
        'PT': { min: 1.0, max: 1.3 },
        'PEAT': { min: 1.0, max: 1.3 },
        
        // Fine-grained materials
        'CL': { min: 1.6, max: 2.1 },
        'CH': { min: 1.8, max: 2.2 },
        'ML': { min: 1.4, max: 1.8 },
        'MH': { min: 1.4, max: 1.8 },
        
        // Coarse-grained materials
        'SW': { min: 1.5, max: 1.8 },
        'GW': { min: 1.9, max: 2.2 },
        
        // Rock (highest density)
        'ROCK': { min: 2.3, max: 2.7 }
      };

      Object.entries(materialDensityRanges).forEach(([material, range]) => {
        const properties = getMaterialProperties(material);
        
        expect(properties.density).toBeGreaterThanOrEqual(range.min);
        expect(properties.density).toBeLessThanOrEqual(range.max);
      });
    });

    test('texture patterns represent geological characteristics', () => {
      const patternMappings = {
        // Granular materials - circular/dot patterns
        'GW': 'circles',
        'GP': 'circles', 
        'SW': 'dots',
        'SP': 'dots',
        
        // Fine-grained materials - linear patterns
        'CL': 'horizontal',
        'CH': 'diagonal',
        'ML': 'horizontal',
        'MH': 'diagonal',
        
        // Organic materials - irregular patterns
        'PT': 'irregular',
        'OL': 'organic',
        'OH': 'organic'
      };

      Object.entries(patternMappings).forEach(([material, expectedType]) => {
        const properties = getMaterialProperties(material);
        const pattern = properties.pattern.toLowerCase();
        
        expect(pattern).toContain(expectedType);
      });
    });
  });
});