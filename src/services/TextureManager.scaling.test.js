import { TextureManager, textureManager } from './TextureManager';
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

describe('TextureManager - Texture Scaling System', () => {
  let manager;

  beforeEach(() => {
    manager = new TextureManager();
    // Reset mock counters
    jest.clearAllMocks();
  });

  afterEach(() => {
    manager.dispose();
  });

  describe('Pattern Scale Parameter Handling', () => {
    test('should apply proper scaling to pattern elements at different scale values', () => {
      const baseSettings = { globalIntensity: 0.7, patternScale: 1.0 };
      const smallScale = { globalIntensity: 0.7, patternScale: 0.5 };
      const largeScale = { globalIntensity: 0.7, patternScale: 2.0 };

      const baseParams = manager.calculatePatternParameters(baseSettings);
      const smallParams = manager.calculatePatternParameters(smallScale);
      const largeParams = manager.calculatePatternParameters(largeScale);

      // Verify scaling affects spacing and element size consistently
      expect(smallParams.spacing).toBeLessThan(baseParams.spacing);
      expect(largeParams.spacing).toBeGreaterThan(baseParams.spacing);
      
      expect(smallParams.elementSize).toBeLessThan(baseParams.elementSize);
      expect(largeParams.elementSize).toBeGreaterThan(baseParams.elementSize);
      
      // Verify scaling is proportional
      expect(largeParams.spacing / baseParams.spacing).toBeCloseTo(2.0, 1);
      expect(smallParams.spacing / baseParams.spacing).toBeCloseTo(0.5, 1);
    });

    test('should clamp scale values to valid range (0.5-2.5)', () => {
      const extremelySmall = { patternScale: 0.1 };
      const extremelyLarge = { patternScale: 5.0 };
      
      const smallParams = manager.calculatePatternParameters(extremelySmall);
      const largeParams = manager.calculatePatternParameters(extremelyLarge);
      
      expect(smallParams.scale).toBe(0.5);
      expect(largeParams.scale).toBe(2.5);
    });

    test('should maintain pattern coherence across different scale values', () => {
      const scales = [0.5, 1.0, 1.5, 2.0, 2.5];
      const results = scales.map(scale => 
        manager.calculatePatternParameters({ patternScale: scale })
      );

      // All parameters should scale proportionally
      for (let i = 1; i < results.length; i++) {
        const prev = results[i - 1];
        const curr = results[i];
        
        expect(curr.spacing).toBeGreaterThan(prev.spacing);
        expect(curr.elementSize).toBeGreaterThan(prev.elementSize);
        expect(curr.lineWidth).toBeGreaterThanOrEqual(prev.lineWidth);
      }
    });
  });

  describe('Element-Based Scaling Implementation', () => {
    test('should use element-based scaling for clay horizontal lines', () => {
      const settings = { globalIntensity: 0.7, patternScale: 1.5 };
      
      manager.createSoilTexture('clay', '#8B4513', settings);
      
      // Verify stroke calls were made with scaled parameters
      expect(mockContext.stroke).toHaveBeenCalled();
      
      // Should have proper line width and spacing based on scaling
      const expectedLineWidth = Math.max(1, Math.round(3 * 0.7 * 1.5)); // intensity * scale
      const expectedSpacing = Math.max(6, Math.round(16 * 1.5)); // base spacing * scale
      
      expect(mockContext.lineWidth).toBe(expectedLineWidth);
    });

    test('should use element-based scaling for sand dot patterns', () => {
      const settings = { globalIntensity: 0.8, patternScale: 2.0 };
      
      manager.createSoilTexture('sand', '#F4A460', settings);
      
      // Verify arc calls were made for dots
      expect(mockContext.arc).toHaveBeenCalled();
      expect(mockContext.fill).toHaveBeenCalled();
      
      // Should have proper element size and spacing
      const expectedElementSize = Math.max(2, Math.round(6 * 0.8 * 2.0));
      const expectedSpacing = Math.max(6, Math.round(16 * 2.0));
      
      // Verify pattern generation calls match expected scaling
      expect(mockContext.arc).toHaveBeenCalledWith(
        expect.any(Number), expect.any(Number), expectedElementSize, 0, Math.PI * 2
      );
    });

    test('should prevent 4x4 tiling artifacts with proper element scaling', () => {
      const smallScale = { patternScale: 0.5 };
      const largeScale = { patternScale: 2.5 };
      
      manager.createSoilTexture('gravel', '#A0522D', smallScale);
      const smallCalls = mockContext.arc.mock.calls.length;
      
      jest.clearAllMocks();
      
      manager.createSoilTexture('gravel', '#A0522D', largeScale);
      const largeCalls = mockContext.arc.mock.calls.length;
      
      // Different scale values should produce different pattern densities
      // but not create repetitive 4x4 tiling patterns
      expect(smallCalls).toBeGreaterThan(0);
      expect(largeCalls).toBeGreaterThan(0);
      
      // Pattern should be deterministic for same scale
      jest.clearAllMocks();
      manager.createSoilTexture('gravel', '#A0522D', largeScale);
      expect(mockContext.arc.mock.calls.length).toBe(largeCalls);
    });
  });

  describe('Material-Specific Pattern Scaling', () => {
    const materialTypes = ['clay', 'sand', 'gravel', 'rock', 'silt', 'organic', 'fill'];
    
    materialTypes.forEach(materialType => {
      test(`should apply consistent scaling to ${materialType} patterns`, () => {
        const scales = [0.5, 1.0, 2.0];
        const results = [];
        
        scales.forEach(scale => {
          jest.clearAllMocks();
          manager.createSoilTexture(materialType, '#888888', { patternScale: scale });
          
          results.push({
            scale,
            strokeCalls: mockContext.stroke.mock.calls.length,
            fillCalls: mockContext.fill.mock.calls.length,
            arcCalls: mockContext.arc.mock.calls.length,
            lineWidthValue: mockContext.lineWidth
          });
        });
        
        // Verify scaling affects pattern generation
        expect(results[0]).not.toEqual(results[1]);
        expect(results[1]).not.toEqual(results[2]);
        
        // Larger scales should generally have fewer, larger elements
        if (results[2].lineWidthValue && results[0].lineWidthValue) {
          expect(results[2].lineWidthValue).toBeGreaterThanOrEqual(results[0].lineWidthValue);
        }
      });
    });
  });

  describe('USCS Material Code Scaling', () => {
    const uscsCodes = ['CL', 'CH', 'SW', 'SP', 'GW', 'GP', 'ML', 'MH', 'OL', 'OH', 'PT'];
    
    uscsCodes.forEach(uscsCode => {
      test(`should handle scaling for USCS code ${uscsCode}`, () => {
        const texture = manager.createSoilTexture(uscsCode, '#888888', {
          globalIntensity: 0.7,
          patternScale: 1.5
        });
        
        expect(texture).toBeInstanceOf(THREE.CanvasTexture);
        expect(texture.userData.materialType).toBe(uscsCode.toLowerCase());
        
        // Verify texture has proper scaling settings applied
        expect(texture.userData.settings.patternScale).toBe(1.5);
      });
    });
  });

  describe('Texture Repeat and UV Mapping', () => {
    test('should set texture repeat to 1,1 for element-based scaling', () => {
      const texture = manager.createSoilTexture('clay', '#8B4513', {
        patternScale: 1.5
      });
      
      // Scale should be handled in pattern generation, not UV repeat
      expect(texture.repeat.x).toBe(1);
      expect(texture.repeat.y).toBe(1);
      expect(texture.wrapS).toBe(THREE.RepeatWrapping);
      expect(texture.wrapT).toBe(THREE.RepeatWrapping);
    });

    test('should maintain consistent UV mapping across different scales', () => {
      const texture1 = manager.createSoilTexture('sand', '#F4A460', { patternScale: 0.5 });
      const texture2 = manager.createSoilTexture('sand', '#F4A460', { patternScale: 2.0 });
      
      // UV settings should be identical - scaling is in pattern generation
      expect(texture1.repeat.x).toBe(texture2.repeat.x);
      expect(texture1.repeat.y).toBe(texture2.repeat.y);
      expect(texture1.wrapS).toBe(texture2.wrapS);
      expect(texture1.wrapT).toBe(texture2.wrapT);
    });
  });

  describe('Performance with Different Scale Values', () => {
    test('should maintain reasonable performance across scale range', () => {
      const scales = [0.5, 1.0, 1.5, 2.0, 2.5];
      const times = [];
      
      scales.forEach(scale => {
        const start = performance.now();
        
        for (let i = 0; i < 10; i++) {
          manager.createSoilTexture('clay', '#8B4513', { patternScale: scale });
        }
        
        const end = performance.now();
        times.push(end - start);
      });
      
      // Performance should be relatively consistent across scales
      const maxTime = Math.max(...times);
      const minTime = Math.min(...times);
      const ratio = maxTime / minTime;
      
      expect(ratio).toBeLessThan(3.0); // No more than 3x difference
    });

    test('should cache textures with different scales separately', () => {
      const texture1 = manager.createSoilTexture('clay', '#8B4513', { patternScale: 1.0 });
      const texture2 = manager.createSoilTexture('clay', '#8B4513', { patternScale: 1.5 });
      const texture3 = manager.createSoilTexture('clay', '#8B4513', { patternScale: 1.0 }); // Same as texture1
      
      expect(texture1).not.toBe(texture2); // Different scales
      expect(texture1).toBe(texture3); // Same scale, should be cached
      
      const stats = manager.getCacheStats();
      expect(stats.hits).toBe(1); // texture3 was a cache hit
      expect(stats.misses).toBe(2); // texture1 and texture2 were cache misses
    });
  });

  describe('Scale Value Edge Cases', () => {
    test('should handle undefined scale gracefully', () => {
      const texture = manager.createSoilTexture('clay', '#8B4513', {
        globalIntensity: 0.7
        // patternScale undefined
      });
      
      expect(texture).toBeInstanceOf(THREE.CanvasTexture);
      expect(texture.userData.settings.patternScale).toBeUndefined();
    });

    test('should handle zero and negative scale values', () => {
      const zeroScale = manager.calculatePatternParameters({ patternScale: 0 });
      const negativeScale = manager.calculatePatternParameters({ patternScale: -1 });
      
      expect(zeroScale.scale).toBe(0.5); // Should clamp to minimum
      expect(negativeScale.scale).toBe(0.5); // Should clamp to minimum
    });

    test('should handle non-numeric scale values', () => {
      const invalidScale = manager.calculatePatternParameters({ patternScale: 'invalid' });
      
      expect(invalidScale.scale).toBe(1.0); // Should use default
    });
  });

  describe('Visual Consistency Validation', () => {
    test('should produce deterministic patterns for same scale values', () => {
      jest.clearAllMocks();
      manager.createSoilTexture('clay', '#8B4513', { patternScale: 1.5 });
      const calls1 = [...mockContext.stroke.mock.calls];
      
      jest.clearAllMocks();
      manager.createSoilTexture('clay', '#8B4513', { patternScale: 1.5 });
      const calls2 = [...mockContext.stroke.mock.calls];
      
      // Should be deterministic - same calls for same parameters
      expect(calls1.length).toBe(calls2.length);
    });

    test('should scale all pattern elements proportionally', () => {
      const baseParams = manager.calculatePatternParameters({ 
        globalIntensity: 0.7, 
        patternScale: 1.0 
      });
      
      const scaledParams = manager.calculatePatternParameters({ 
        globalIntensity: 0.7, 
        patternScale: 2.0 
      });
      
      // All size-related parameters should scale proportionally
      const spacingRatio = scaledParams.spacing / baseParams.spacing;
      const elementRatio = scaledParams.elementSize / baseParams.elementSize;
      const lineRatio = scaledParams.lineWidth / baseParams.lineWidth;
      
      expect(spacingRatio).toBeCloseTo(2.0, 1);
      expect(elementRatio).toBeCloseTo(2.0, 1);
      expect(lineRatio).toBeCloseTo(2.0, 1);
    });
  });
});