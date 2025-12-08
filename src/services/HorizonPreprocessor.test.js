/**
 * Unit tests for HorizonPreprocessor
 * Tests stratigraphic pinch-out handling and zero-thickness marker insertion
 */

import { HorizonPreprocessor } from './HorizonPreprocessor';

// Mock borehole class
class MockBorehole {
  constructor(id, x, z, layers = []) {
    this.id = id;
    this.x = x;
    this.z = z; // N-S coordinate
    this.layers = layers;
  }

  getLayerPointsForMaterial(material) {
    return this.layers
      .filter(l => l.material === material)
      .map(l => ({
        x: this.x,
        y: this.z,
        topZ: l.topZ,
        bottomZ: l.bottomZ,
        thickness: Math.abs(l.topZ - l.bottomZ)
      }));
  }

  getLayerPointsForMaterialAndColor(material, color) {
    return this.layers
      .filter(l => l.material === material && (l.color === color || color === 'default'))
      .map(l => ({
        x: this.x,
        y: this.z,
        topZ: l.topZ,
        bottomZ: l.bottomZ,
        thickness: Math.abs(l.topZ - l.bottomZ)
      }));
  }
}

describe('HorizonPreprocessor', () => {
  describe('preprocessHorizons', () => {
    it('should return empty map for empty input', () => {
      const result = HorizonPreprocessor.preprocessHorizons([], []);
      expect(result.size).toBe(0);
    });

    it('should return observed points when layer is present in all boreholes', () => {
      const boreholes = [
        new MockBorehole('BH1', 0, 0, [{ material: 'CLAY', topZ: -5, bottomZ: -10, color: 'default' }]),
        new MockBorehole('BH2', 10, 0, [{ material: 'CLAY', topZ: -5, bottomZ: -10, color: 'default' }]),
        new MockBorehole('BH3', 20, 0, [{ material: 'CLAY', topZ: -5, bottomZ: -10, color: 'default' }])
      ];

      const result = HorizonPreprocessor.preprocessHorizons(boreholes, ['CLAY']);
      const clayPoints = result.get('CLAY');

      expect(clayPoints).toHaveLength(3);
      expect(clayPoints.every(p => p.insertionMethod === 'observed')).toBe(true);
      expect(clayPoints.every(p => p.isZeroThickness === false)).toBe(true);
      expect(clayPoints.every(p => p.confidence === 1.0)).toBe(true);
    });

    it('should insert zero-thickness marker for missing layer', () => {
      const boreholes = [
        new MockBorehole('BH1', 0, 0, [{ material: 'CLAY', topZ: -5, bottomZ: -10, color: 'default' }]),
        new MockBorehole('BH2', 10, 0, [{ material: 'CLAY', topZ: -5, bottomZ: -10, color: 'default' }]),
        new MockBorehole('BH3', 20, 0, []) // No CLAY layer
      ];

      const result = HorizonPreprocessor.preprocessHorizons(boreholes, ['CLAY']);
      const clayPoints = result.get('CLAY');

      expect(clayPoints).toHaveLength(3);

      const observedPoints = clayPoints.filter(p => p.insertionMethod === 'observed');
      const pinchOutPoints = clayPoints.filter(p => p.isZeroThickness === true);

      expect(observedPoints).toHaveLength(2);
      expect(pinchOutPoints).toHaveLength(1);
      expect(pinchOutPoints[0].boreholeId).toBe('BH3');
      expect(pinchOutPoints[0].thickness).toBe(0);
      expect(pinchOutPoints[0].topZ).toBe(pinchOutPoints[0].bottomZ);
    });
  });

  describe('estimateStratigraphicPosition', () => {
    it('should estimate depth between adjacent layers', () => {
      // BH3 has layers above and below the missing SAND layer
      const boreholes = [
        new MockBorehole('BH1', 0, 0, [
          { material: 'CLAY', topZ: 0, bottomZ: -5, color: 'default' },
          { material: 'SAND', topZ: -5, bottomZ: -10, color: 'default' },
          { material: 'GRAVEL', topZ: -10, bottomZ: -15, color: 'default' }
        ]),
        new MockBorehole('BH2', 20, 0, [
          { material: 'CLAY', topZ: 0, bottomZ: -5, color: 'default' },
          { material: 'SAND', topZ: -5, bottomZ: -10, color: 'default' },
          { material: 'GRAVEL', topZ: -10, bottomZ: -15, color: 'default' }
        ]),
        new MockBorehole('BH3', 10, 0, [
          { material: 'CLAY', topZ: 0, bottomZ: -6, color: 'default' },
          // Missing SAND layer - should pinch out here
          { material: 'GRAVEL', topZ: -8, bottomZ: -15, color: 'default' }
        ])
      ];

      const result = HorizonPreprocessor.preprocessHorizons(
        boreholes,
        ['CLAY', 'SAND', 'GRAVEL']
      );
      const sandPoints = result.get('SAND');

      const pinchOutPoint = sandPoints.find(p => p.boreholeId === 'BH3');
      expect(pinchOutPoint).toBeDefined();
      expect(pinchOutPoint.isZeroThickness).toBe(true);
      expect(pinchOutPoint.insertionMethod).toBe('stratigraphic-pinchout');

      // Should be positioned between CLAY bottom (-6) and GRAVEL top (-8)
      // Expected: (-6 + -8) / 2 = -7
      expect(pinchOutPoint.topZ).toBe(-7);
      expect(pinchOutPoint.bottomZ).toBe(-7);
    });
  });

  describe('estimateFromNeighbors', () => {
    it('should use IDW when stratigraphic position not available', () => {
      // BH3 has no adjacent layers - fallback to IDW estimation
      const boreholes = [
        new MockBorehole('BH1', 0, 0, [
          { material: 'CLAY', topZ: -10, bottomZ: -20, color: 'default' }
        ]),
        new MockBorehole('BH2', 20, 0, [
          { material: 'CLAY', topZ: -10, bottomZ: -20, color: 'default' }
        ]),
        new MockBorehole('BH3', 10, 0, [
          // No CLAY layer, and no adjacent layers either
        ])
      ];

      const result = HorizonPreprocessor.preprocessHorizons(boreholes, ['CLAY']);
      const clayPoints = result.get('CLAY');

      const pinchOutPoint = clayPoints.find(p => p.boreholeId === 'BH3');
      expect(pinchOutPoint).toBeDefined();
      expect(pinchOutPoint.isZeroThickness).toBe(true);

      // Should use neighbor-estimated method since no adjacent layers
      expect(pinchOutPoint.insertionMethod).toBe('neighbor-estimated');

      // Estimated depth should be near the center of CLAY in neighbors (-15)
      expect(pinchOutPoint.topZ).toBeCloseTo(-15, 1);
    });
  });

  describe('getPreprocessingStats', () => {
    it('should return correct statistics', () => {
      const boreholes = [
        new MockBorehole('BH1', 0, 0, [{ material: 'CLAY', topZ: -5, bottomZ: -10, color: 'default' }]),
        new MockBorehole('BH2', 10, 0, [{ material: 'CLAY', topZ: -5, bottomZ: -10, color: 'default' }]),
        new MockBorehole('BH3', 20, 0, []) // Missing CLAY
      ];

      const horizonMap = HorizonPreprocessor.preprocessHorizons(boreholes, ['CLAY']);
      const stats = HorizonPreprocessor.getPreprocessingStats(horizonMap);

      expect(stats.totalMaterials).toBe(1);
      expect(stats.materials[0].material).toBe('CLAY');
      expect(stats.materials[0].totalPoints).toBe(3);
      expect(stats.materials[0].observedPoints).toBe(2);
      expect(stats.materials[0].stratigraphicPinchouts + stats.materials[0].neighborEstimated).toBe(1);
    });
  });

  describe('unique key handling', () => {
    it('should handle material_color unique keys', () => {
      const boreholes = [
        new MockBorehole('BH1', 0, 0, [
          { material: 'CLAY', topZ: -5, bottomZ: -10, color: 'brown' }
        ]),
        new MockBorehole('BH2', 10, 0, [
          { material: 'CLAY', topZ: -5, bottomZ: -10, color: 'brown' }
        ])
      ];

      const result = HorizonPreprocessor.preprocessHorizons(boreholes, ['CLAY_brown']);
      const clayPoints = result.get('CLAY_brown');

      expect(clayPoints).toHaveLength(2);
    });
  });
});
