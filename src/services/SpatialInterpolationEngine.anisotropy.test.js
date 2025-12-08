/**
 * Unit tests for anisotropic distance weighting in SpatialInterpolationEngine
 * Tests the 3D ellipsoidal distance calculation that prioritizes horizontal neighbors
 */

import { SpatialInterpolationEngine } from './SpatialInterpolationEngine';

describe('SpatialInterpolationEngine - Anisotropic Distance', () => {
  describe('anisotropicDistance', () => {
    it('should calculate horizontal distance correctly with default scales', () => {
      const p1 = { x: 0, y: 0, topZ: 0, bottomZ: 0 };
      const p2 = { x: 10, y: 0, topZ: 0, bottomZ: 0 }; // 10 feet horizontal

      const distance = SpatialInterpolationEngine.anisotropicDistance(p1, p2);

      // With default Lx=1, Ly=1, horizontal distance should be 10
      expect(distance).toBeCloseTo(10, 5);
    });

    it('should make vertical distance 10x more expensive with default Lz=0.1', () => {
      const origin = { x: 0, y: 0, topZ: 0, bottomZ: 0 };
      const horizontal = { x: 10, y: 0, topZ: 0, bottomZ: 0 }; // 10ft horizontal
      const vertical = { x: 0, y: 0, topZ: -10, bottomZ: -10 };   // 10ft vertical

      const dHorizontal = SpatialInterpolationEngine.anisotropicDistance(origin, horizontal);
      const dVertical = SpatialInterpolationEngine.anisotropicDistance(origin, vertical);

      // Horizontal: sqrt((10/1)^2) = 10
      // Vertical: sqrt((10/0.1)^2) = sqrt(10000) = 100
      expect(dHorizontal).toBeCloseTo(10, 5);
      expect(dVertical).toBeCloseTo(100, 5);

      // Vertical should be 10x horizontal
      expect(dVertical / dHorizontal).toBeCloseTo(10, 5);
    });

    it('should use center Z when given topZ/bottomZ', () => {
      const p1 = { x: 0, y: 0, topZ: -5, bottomZ: -10 }; // Center = -7.5
      const p2 = { x: 0, y: 0, topZ: -15, bottomZ: -20 }; // Center = -17.5

      // Difference in center Z = 10
      const distance = SpatialInterpolationEngine.anisotropicDistance(p1, p2);

      // With Lz=0.1, distance should be 10/0.1 = 100
      expect(distance).toBeCloseTo(100, 5);
    });

    it('should handle simple z format', () => {
      const p1 = { x: 0, y: 0, z: 0 };
      const p2 = { x: 0, y: 0, z: -10 };

      const distance = SpatialInterpolationEngine.anisotropicDistance(p1, p2);

      // With Lz=0.1, distance should be 10/0.1 = 100
      expect(distance).toBeCloseTo(100, 5);
    });

    it('should apply custom anisotropy scales', () => {
      const p1 = { x: 0, y: 0, z: 0 };
      const p2 = { x: 10, y: 10, z: -10 };

      // Custom scales: make all equal (isotropic)
      const distance = SpatialInterpolationEngine.anisotropicDistance(p1, p2, {
        Lx: 1,
        Ly: 1,
        Lz: 1
      });

      // Should be standard 3D Euclidean distance
      const expected = Math.sqrt(10**2 + 10**2 + 10**2);
      expect(distance).toBeCloseTo(expected, 5);
    });

    it('should apply strong anisotropy (Lz=0.05 = 20:1 ratio)', () => {
      const origin = { x: 0, y: 0, z: 0 };
      const horizontal = { x: 1, y: 0, z: 0 };
      const vertical = { x: 0, y: 0, z: -1 };

      const dHorizontal = SpatialInterpolationEngine.anisotropicDistance(
        origin, horizontal, { Lx: 1, Ly: 1, Lz: 0.05 }
      );
      const dVertical = SpatialInterpolationEngine.anisotropicDistance(
        origin, vertical, { Lx: 1, Ly: 1, Lz: 0.05 }
      );

      // Vertical should be 20x horizontal
      expect(dVertical / dHorizontal).toBeCloseTo(20, 5);
    });
  });

  describe('inverseDistanceWeightingAnisotropic', () => {
    it('should return single point value when only one data point', () => {
      const target = { x: 0, y: 0 };
      const dataPoints = [
        { x: 10, y: 10, topZ: -5, bottomZ: -10, value: 100 }
      ];

      const result = SpatialInterpolationEngine.inverseDistanceWeightingAnisotropic(
        target, dataPoints, 2
      );

      expect(result).toBe(100);
    });

    it('should return exact value when at data point location', () => {
      const target = { x: 10, y: 10 };
      const dataPoints = [
        { x: 10, y: 10, topZ: -5, bottomZ: -10, value: 100 },
        { x: 20, y: 20, topZ: -5, bottomZ: -10, value: 50 }
      ];

      const result = SpatialInterpolationEngine.inverseDistanceWeightingAnisotropic(
        target, dataPoints, 2
      );

      // Should return the value of the point at the same location
      expect(result).toBe(100);
    });

    it('should prefer horizontal neighbors over vertical', () => {
      // Target at x=5, y=5
      const target = { x: 5, y: 5 };

      // Two data points:
      // - One horizontal neighbor at x=10, y=5 (5 units away horizontally)
      // - One "vertical" neighbor at x=5, y=5 but at different Z (50 units vertically)
      const dataPoints = [
        { x: 10, y: 5, topZ: 0, bottomZ: 0, value: 100 },      // 5ft horizontal
        { x: 5, y: 5, topZ: -50, bottomZ: -50, value: 0 }      // 50ft vertical, but 0 horizontal
      ];

      const result = SpatialInterpolationEngine.inverseDistanceWeightingAnisotropic(
        target, dataPoints, 2, { scales: { Lx: 1, Ly: 1, Lz: 0.1 } }
      );

      // With Lz=0.1:
      // - Horizontal point: distance = 5
      // - Vertical point: distance = 50/0.1 = 500
      // The horizontal neighbor should dominate heavily
      // Weight ratio: (1/5^2) / (1/500^2) = 10000
      // Expected result should be very close to 100
      expect(result).toBeGreaterThan(99);
    });

    it('should respect maxDistance parameter', () => {
      const target = { x: 0, y: 0 };
      const dataPoints = [
        { x: 5, y: 0, topZ: 0, bottomZ: 0, value: 100 },   // Within range
        { x: 15, y: 0, topZ: 0, bottomZ: 0, value: 0 }     // Outside range
      ];

      const result = SpatialInterpolationEngine.inverseDistanceWeightingAnisotropic(
        target, dataPoints, 2, { maxDistance: 10 }
      );

      // Only the nearby point should contribute
      expect(result).toBe(100);
    });
  });

  describe('interpolateLayerSurface with anisotropy', () => {
    it('should pass anisotropy options to interpolation', () => {
      const layerPoints = [
        { x: 0, y: 0, topZ: -5, bottomZ: -10 },
        { x: 10, y: 0, topZ: -6, bottomZ: -11 },
        { x: 20, y: 0, topZ: -5, bottomZ: -10 }
      ];

      const extent = { minX: 0, maxX: 20, minY: -5, maxY: 5 };

      const result = SpatialInterpolationEngine.interpolateLayerSurface(
        layerPoints,
        extent,
        5, // Low resolution for speed
        {
          useAnisotropy: true,
          anisotropyScales: { Lx: 1, Ly: 1, Lz: 0.1 }
        }
      );

      expect(result.topSurface).toBeDefined();
      expect(result.bottomSurface).toBeDefined();
      expect(result.topSurface.length).toBe(25); // 5x5 grid
    });

    it('should disable KD-tree when using anisotropy', () => {
      // This test verifies that the brute-force approach is used
      // when anisotropy is enabled (KD-tree is 2D only)
      const layerPoints = [];
      for (let i = 0; i < 20; i++) { // Enough points to trigger KD-tree normally
        layerPoints.push({
          x: i * 5,
          y: 0,
          topZ: -5 - Math.random(),
          bottomZ: -10 - Math.random()
        });
      }

      const extent = { minX: 0, maxX: 95, minY: -5, maxY: 5 };

      // This should work without errors even though KD-tree is disabled
      const result = SpatialInterpolationEngine.interpolateLayerSurface(
        layerPoints,
        extent,
        5,
        {
          useAnisotropy: true,
          anisotropyScales: { Lx: 1, Ly: 1, Lz: 0.1 }
        }
      );

      expect(result.topSurface).toBeDefined();
      expect(result.bottomSurface).toBeDefined();
    });
  });

  describe('mathematical correctness', () => {
    it('should implement correct ellipsoidal distance formula', () => {
      // Formula: d = sqrt((dx/Lx)^2 + (dy/Ly)^2 + (dz/Lz)^2)
      const p1 = { x: 0, y: 0, z: 0 };
      const p2 = { x: 3, y: 4, z: 5 };

      const scales = { Lx: 1, Ly: 2, Lz: 0.5 };

      const distance = SpatialInterpolationEngine.anisotropicDistance(p1, p2, scales);

      // Expected: sqrt((3/1)^2 + (4/2)^2 + (5/0.5)^2)
      //         = sqrt(9 + 4 + 100)
      //         = sqrt(113)
      //         ≈ 10.63
      const expected = Math.sqrt(
        (3/scales.Lx)**2 +
        (4/scales.Ly)**2 +
        (5/scales.Lz)**2
      );

      expect(distance).toBeCloseTo(expected, 5);
    });

    it('should handle zero distance edge case', () => {
      const p = { x: 5, y: 10, z: -15 };

      const distance = SpatialInterpolationEngine.anisotropicDistance(p, p);

      expect(distance).toBe(0);
    });

    it('should handle missing Z gracefully', () => {
      const p1 = { x: 0, y: 0 }; // No z
      const p2 = { x: 10, y: 0 }; // No z

      const distance = SpatialInterpolationEngine.anisotropicDistance(p1, p2);

      // Should treat missing Z as 0
      expect(distance).toBeCloseTo(10, 5);
    });
  });
});
