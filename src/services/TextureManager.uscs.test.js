import { TextureManager, textureManager } from './TextureManager';
import { getMaterialProperties } from '../utils/materialStandardization';
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
  lineWidth: 1,
  textAlign: 'left',
  font: '10px sans-serif'
};

const mockCanvas = {
  width: 128,
  height: 128,
  getContext: jest.fn(() => mockContext)
};

global.document = {
  createElement: jest.fn(() => mockCanvas)
};

describe('TextureManager - USCS Material Support', () => {
  let manager;

  beforeEach(() => {
    manager = new TextureManager();
    jest.clearAllMocks();
  });

  afterEach(() => {
    manager.dispose();
  });

  describe('USCS Code Pattern Mapping', () => {
    const uscsGravel = [
      { code: 'GW', name: 'Well-graded gravel', expectedPattern: 'gravel' },
      { code: 'GP', name: 'Poorly graded gravel', expectedPattern: 'gravel' },
      { code: 'GM', name: 'Silty gravel', expectedPattern: 'gravel' },
      { code: 'GC', name: 'Clayey gravel', expectedPattern: 'gravel' }
    ];

    const uscsSand = [
      { code: 'SW', name: 'Well-graded sand', expectedPattern: 'sand' },
      { code: 'SP', name: 'Poorly graded sand', expectedPattern: 'sand' },
      { code: 'SM', name: 'Silty sand', expectedPattern: 'sand' },
      { code: 'SC', name: 'Clayey sand', expectedPattern: 'sand' }
    ];

    const uscsSilt = [
      { code: 'ML', name: 'Inorganic silt', expectedPattern: 'silt' },
      { code: 'MH', name: 'High plasticity silt', expectedPattern: 'silt' }
    ];

    const uscsClay = [
      { code: 'CL', name: 'Low plasticity clay', expectedPattern: 'clay' },
      { code: 'CH', name: 'High plasticity clay', expectedPattern: 'clay' }
    ];

    const uscsOrganic = [
      { code: 'OL', name: 'Organic silt/clay', expectedPattern: 'organic' },
      { code: 'OH', name: 'High plasticity organic', expectedPattern: 'organic' },
      { code: 'PT', name: 'Peat', expectedPattern: 'organic' }
    ];

    [...uscsGravel, ...uscsSand, ...uscsSilt, ...uscsClay, ...uscsOrganic].forEach(({ code, name, expectedPattern }) => {
      test(`should map USCS code ${code} (${name}) to ${expectedPattern} pattern`, () => {
        const patternType = manager.getPatternType(code);
        expect(patternType).toBe(expectedPattern);
      });

      test(`should create texture for USCS code ${code}`, () => {
        const texture = manager.createSoilTexture(code, '#888888', {
          globalIntensity: 0.7,
          patternScale: 1.0
        });

        expect(texture).toBeInstanceOf(THREE.CanvasTexture);
        expect(texture.userData.materialType).toBe(code.toLowerCase());
      });
    });
  });

  describe('USCS Pattern Generation Validation', () => {
    test('should generate gravel circles for GW materials', () => {
      manager.createSoilTexture('GW', '#8B7355', { globalIntensity: 0.7, patternScale: 1.0 });
      
      // Should generate circular patterns for gravel
      expect(mockContext.arc).toHaveBeenCalled();
      expect(mockContext.fill).toHaveBeenCalled();
      expect(mockContext.stroke).toHaveBeenCalled();
      
      // Should have proper gravel particle distribution
      const arcCalls = mockContext.arc.mock.calls;
      expect(arcCalls.length).toBeGreaterThan(6); // Multiple particles
    });

    test('should generate sand dots for SW materials', () => {
      manager.createSoilTexture('SW', '#F4A460', { globalIntensity: 0.8, patternScale: 1.0 });
      
      // Should generate dot patterns for sand
      expect(mockContext.arc).toHaveBeenCalled();
      expect(mockContext.fill).toHaveBeenCalled();
      
      // Sand should have regular grid pattern
      const arcCalls = mockContext.arc.mock.calls;
      expect(arcCalls.length).toBeGreaterThan(10); // Regular grid of dots
    });

    test('should generate horizontal lines for CL materials', () => {
      manager.createSoilTexture('CL', '#8B4513', { globalIntensity: 0.7, patternScale: 1.0 });
      
      // Should generate horizontal line patterns for clay
      expect(mockContext.stroke).toHaveBeenCalled();
      expect(mockContext.moveTo).toHaveBeenCalled();
      expect(mockContext.lineTo).toHaveBeenCalled();
      
      // Check for horizontal line pattern
      const lineToCallsY = mockContext.lineTo.mock.calls.map(call => call[1]);
      const moveToCallsY = mockContext.moveTo.mock.calls.map(call => call[1]);
      
      // Lines should be horizontal (same Y coordinates for moveTo and lineTo)
      expect(lineToCallsY.some((y, i) => Math.abs(y - moveToCallsY[i]) < 0.1)).toBe(true);
    });

    test('should generate diagonal lines for ML materials', () => {
      manager.createSoilTexture('ML', '#9ACD32', { globalIntensity: 0.7, patternScale: 1.0 });
      
      // Should generate diagonal line patterns for silt
      expect(mockContext.stroke).toHaveBeenCalled();
      expect(mockContext.moveTo).toHaveBeenCalled();
      expect(mockContext.lineTo).toHaveBeenCalled();
      
      // Check for diagonal line pattern
      const moveToCallsX = mockContext.moveTo.mock.calls.map(call => call[0]);
      const lineToCallsX = mockContext.lineTo.mock.calls.map(call => call[0]);
      
      // Diagonal lines should have different X coordinates
      expect(lineToCallsX.some((x, i) => Math.abs(x - moveToCallsX[i]) > 10)).toBe(true);
    });

    test('should generate irregular organic patterns for OL materials', () => {
      manager.createSoilTexture('OL', '#8B4513', { globalIntensity: 0.7, patternScale: 1.0 });
      
      // Should generate elliptical organic shapes
      expect(mockContext.ellipse).toHaveBeenCalled();
      expect(mockContext.fill).toHaveBeenCalled();
      expect(mockContext.stroke).toHaveBeenCalled();
      
      // Should also have some horizontal layering
      expect(mockContext.moveTo).toHaveBeenCalled();
      expect(mockContext.lineTo).toHaveBeenCalled();
    });
  });

  describe('USCS Material Properties Integration', () => {
    test('should use material properties from standardization system', () => {
      const material = 'CL';
      const materialProps = getMaterialProperties(material);
      
      if (materialProps && materialProps.pattern) {
        const patternType = manager.getPatternType(material);
        
        // Should map pattern to appropriate renderer
        expect(['clay', 'sand', 'gravel', 'rock', 'silt', 'organic', 'fill']).toContain(patternType);
      }
    });

    test('should handle unknown USCS codes gracefully', () => {
      const unknownCodes = ['XX', 'ZZ', 'INVALID'];
      
      unknownCodes.forEach(code => {
        const texture = manager.createSoilTexture(code, '#888888', {
          globalIntensity: 0.7,
          patternScale: 1.0
        });
        
        expect(texture).toBeInstanceOf(THREE.CanvasTexture);
        // Should fall back to clay pattern
        expect(manager.getPatternType(code)).toBe('clay');
      });
    });

    test('should preserve USCS code in texture metadata', () => {
      const uscsCodes = ['GW', 'SW', 'CL', 'ML', 'OL'];
      
      uscsCodes.forEach(code => {
        const texture = manager.createSoilTexture(code, '#888888', {
          globalIntensity: 0.7,
          patternScale: 1.0
        });
        
        expect(texture.userData.materialType).toBe(code.toLowerCase());
        expect(texture.userData.settings).toBeDefined();
        expect(texture.userData.createdAt).toBeDefined();
      });
    });
  });

  describe('Visual Consistency Across USCS Materials', () => {
    test('should produce consistent patterns for same USCS material family', () => {
      const gravelCodes = ['GW', 'GP', 'GM', 'GC'];
      const textures = gravelCodes.map(code => 
        manager.createSoilTexture(code, '#8B7355', { globalIntensity: 0.7, patternScale: 1.0 })
      );
      
      // All gravel materials should use the same pattern type
      gravelCodes.forEach(code => {
        expect(manager.getPatternType(code)).toBe('gravel');
      });
      
      // All should be valid textures
      textures.forEach(texture => {
        expect(texture).toBeInstanceOf(THREE.CanvasTexture);
      });
    });

    test('should produce different patterns for different USCS families', () => {
      jest.clearAllMocks();
      manager.createSoilTexture('GW', '#8B7355', { globalIntensity: 0.7, patternScale: 1.0 });
      const gravelCalls = {
        arc: mockContext.arc.mock.calls.length,
        stroke: mockContext.stroke.mock.calls.length,
        ellipse: mockContext.ellipse.mock.calls.length
      };
      
      jest.clearAllMocks();
      manager.createSoilTexture('CL', '#8B4513', { globalIntensity: 0.7, patternScale: 1.0 });
      const clayCalls = {
        arc: mockContext.arc.mock.calls.length,
        stroke: mockContext.stroke.mock.calls.length,
        ellipse: mockContext.ellipse.mock.calls.length
      };
      
      // Different materials should have different pattern characteristics
      expect(gravelCalls).not.toEqual(clayCalls);
    });

    test('should scale USCS patterns consistently', () => {
      const uscsCode = 'SW';
      const scales = [0.5, 1.0, 2.0];
      
      scales.forEach(scale => {
        jest.clearAllMocks();
        const texture = manager.createSoilTexture(uscsCode, '#F4A460', {
          globalIntensity: 0.7,
          patternScale: scale
        });
        
        expect(texture).toBeInstanceOf(THREE.CanvasTexture);
        expect(texture.userData.settings.patternScale).toBe(scale);
        
        // Pattern should be applied (sand uses arc calls)
        expect(mockContext.arc).toHaveBeenCalled();
      });
    });
  });

  describe('USCS Color and Texture Integration', () => {
    test('should apply proper base colors for USCS materials', () => {
      const materialColors = [
        { code: 'GW', color: '#8B7355' },
        { code: 'SW', color: '#F4A460' },
        { code: 'CL', color: '#8B4513' },
        { code: 'ML', color: '#9ACD32' },
        { code: 'OL', color: '#654321' }
      ];
      
      materialColors.forEach(({ code, color }) => {
        jest.clearAllMocks();
        manager.createSoilTexture(code, color, { globalIntensity: 0.7, patternScale: 1.0 });
        
        // Base color should be applied
        expect(mockContext.fillStyle).toBe(color);
        expect(mockContext.fillRect).toHaveBeenCalledWith(0, 0, 128, 128);
      });
    });

    test('should handle texture intensity for USCS materials', () => {
      const intensities = [0.3, 0.7, 1.0];
      
      intensities.forEach(intensity => {
        const params = manager.calculatePatternParameters({
          globalIntensity: intensity,
          patternScale: 1.0
        });
        
        expect(params.intensity).toBe(intensity);
        expect(params.patternColor).toContain(`rgba(255, 255, 255, ${Math.min(1.0, intensity * 1.2)}`);
        expect(params.strokeColor).toContain(`rgba(0, 0, 0, ${Math.min(1.0, intensity * 0.8)}`);
      });
    });
  });

  describe('USCS Pattern Determinism', () => {
    test('should generate deterministic patterns for USCS codes', () => {
      const uscsCode = 'GW';
      
      // Generate same pattern twice
      jest.clearAllMocks();
      manager.createSoilTexture(uscsCode, '#8B7355', { globalIntensity: 0.7, patternScale: 1.0 });
      const calls1 = [...mockContext.arc.mock.calls];
      
      jest.clearAllMocks();
      manager.createSoilTexture(uscsCode, '#8B7355', { globalIntensity: 0.7, patternScale: 1.0 });
      const calls2 = [...mockContext.arc.mock.calls];
      
      // Should be identical (deterministic)
      expect(calls1.length).toBe(calls2.length);
      expect(calls1).toEqual(calls2);
    });

    test('should use deterministic particle generation for gravel patterns', () => {
      const particles1 = manager.generateDeterministicParticles(8, 16);
      const particles2 = manager.generateDeterministicParticles(8, 16);
      
      expect(particles1).toEqual(particles2);
      expect(particles1.length).toBe(8);
      
      // All particles should have valid properties
      particles1.forEach(particle => {
        expect(particle.x).toBeGreaterThanOrEqual(0);
        expect(particle.x).toBeLessThanOrEqual(128);
        expect(particle.y).toBeGreaterThanOrEqual(0);
        expect(particle.y).toBeLessThanOrEqual(128);
        expect(particle.size).toBeGreaterThan(0);
        expect(particle.size).toBeLessThanOrEqual(1);
      });
    });

    test('should use deterministic formation generation for rock patterns', () => {
      const formations1 = manager.generateDeterministicFormations(6, 20);
      const formations2 = manager.generateDeterministicFormations(6, 20);
      
      expect(formations1).toEqual(formations2);
      expect(formations1.length).toBe(6);
      
      // All formations should have valid properties
      formations1.forEach(formation => {
        expect(formation.x).toBeGreaterThanOrEqual(0);
        expect(formation.x).toBeLessThanOrEqual(128);
        expect(formation.y).toBeGreaterThanOrEqual(0);
        expect(formation.y).toBeLessThanOrEqual(128);
        expect(formation.size).toBeGreaterThan(0);
      });
    });
  });

  describe('USCS Cache Behavior', () => {
    test('should cache USCS textures with same parameters', () => {
      const texture1 = manager.createSoilTexture('CL', '#8B4513', { globalIntensity: 0.7, patternScale: 1.0 });
      const texture2 = manager.createSoilTexture('CL', '#8B4513', { globalIntensity: 0.7, patternScale: 1.0 });
      
      expect(texture1).toBe(texture2); // Should be cached
      
      const stats = manager.getCacheStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
    });

    test('should create separate cache entries for different USCS codes', () => {
      const texture1 = manager.createSoilTexture('CL', '#8B4513', { globalIntensity: 0.7, patternScale: 1.0 });
      const texture2 = manager.createSoilTexture('CH', '#8B4513', { globalIntensity: 0.7, patternScale: 1.0 });
      
      expect(texture1).not.toBe(texture2); // Different materials
      
      const stats = manager.getCacheStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(2);
    });

    test('should handle case variations in USCS codes', () => {
      const texture1 = manager.createSoilTexture('cl', '#8B4513', { globalIntensity: 0.7, patternScale: 1.0 });
      const texture2 = manager.createSoilTexture('CL', '#8B4513', { globalIntensity: 0.7, patternScale: 1.0 });
      
      // Should normalize case and cache properly
      expect(texture1).toBe(texture2);
      
      const stats = manager.getCacheStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
    });
  });
});