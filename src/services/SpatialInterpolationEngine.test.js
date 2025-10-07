import { SpatialInterpolationEngine } from './SpatialInterpolationEngine';

describe('SpatialInterpolationEngine', () => {
  const mockData = [
    { x: 0, y: 0, z: 10 },
    { x: 10, y: 0, z: 20 },
    { x: 5, y: 10, z: 15 },
    { x: 0, y: 10, z: 12 }
  ];

  beforeEach(() => {
    // Clear any mocks between tests
    jest.clearAllMocks();
  });

  describe('Static Methods', () => {
    test('provides static interpolation methods', () => {
      expect(typeof SpatialInterpolationEngine.inverseDistanceWeighting).toBe('function');
      expect(typeof SpatialInterpolationEngine.calculateExtent).toBe('function');
      expect(typeof SpatialInterpolationEngine.generateGrid).toBe('function');
      expect(typeof SpatialInterpolationEngine.generateConfidenceGrid).toBe('function');
    });

    test('calculateExtent finds data boundaries', () => {
      const boreholes = [
        { x: 0, z: 0 },
        { x: 10, z: 0 },
        { x: 5, z: 10 }
      ];
      
      const extent = SpatialInterpolationEngine.calculateExtent(boreholes);
      expect(extent.minX).toBeCloseTo(-0.5, 1);
      expect(extent.maxX).toBeCloseTo(10.5, 1);
      expect(extent.minY).toBeCloseTo(-0.5, 1);
      expect(extent.maxY).toBeCloseTo(10.5, 1);
    });
  });

  describe('IDW Interpolation', () => {
    test('interpolates values using inverse distance weighting', () => {
      const targetPoint = { x: 5, y: 5 };
      const dataPoints = mockData.map(d => ({ x: d.x, y: d.y, value: d.z }));
      
      const result = SpatialInterpolationEngine.inverseDistanceWeighting(
        targetPoint,
        dataPoints,
        2, // power
        100 // maxDistance
      );
      
      expect(result).toBeDefined();
      expect(typeof result).toBe('number');
      expect(result).toBeGreaterThan(10);
      expect(result).toBeLessThan(20);
    });

    test('returns exact value at data point location', () => {
      const targetPoint = { x: 0, y: 0 };
      const dataPoints = mockData.map(d => ({ x: d.x, y: d.y, value: d.z }));
      
      const result = SpatialInterpolationEngine.inverseDistanceWeighting(
        targetPoint,
        dataPoints,
        2,
        100
      );
      expect(result).toBeCloseTo(10, 0.1);
    });

    test('handles single data point', () => {
      const targetPoint = { x: 5, y: 5 };
      const singlePoint = [{ x: 0, y: 0, value: 10 }];
      
      const result = SpatialInterpolationEngine.inverseDistanceWeighting(
        targetPoint,
        singlePoint,
        2,
        100
      );
      expect(result).toBe(10);
    });

    test('handles edge cases with zero distances', () => {
      const targetPoint = { x: 10, y: 0 };
      const dataPoints = mockData.map(d => ({ x: d.x, y: d.y, value: d.z }));
      
      const result = SpatialInterpolationEngine.inverseDistanceWeighting(
        targetPoint,
        dataPoints,
        2,
        100
      );
      expect(result).toBeCloseTo(20, 0.1);
    });
  });

  describe('Grid Generation', () => {
    test('generates regular grid of points', () => {
      const extent = { minX: 0, maxX: 10, minY: 0, maxY: 10 };
      const resolution = 5;
      
      const grid = SpatialInterpolationEngine.generateGrid(extent, resolution);
      
      expect(Array.isArray(grid)).toBe(true);
      expect(grid.length).toBe(resolution * resolution);
      
      // Check first and last points
      expect(grid[0]).toEqual({ x: 0, y: 0, gridIndex: { i: 0, j: 0 } });
      expect(grid[grid.length - 1]).toEqual({ x: 10, y: 10, gridIndex: { i: 4, j: 4 } });
    });

    test('generates confidence grid with distance-based confidence', () => {
      const extent = { minX: 0, maxX: 10, minY: 0, maxY: 10 };
      const gridPoints = SpatialInterpolationEngine.generateGrid(extent, 3);
      const dataPoints = [{ x: 5, y: 5 }];
      
      const confidenceGrid = SpatialInterpolationEngine.generateConfidenceGrid(
        gridPoints,
        dataPoints,
        { maxGoodDistance: 5 }
      );
      
      expect(Array.isArray(confidenceGrid)).toBe(true);
      expect(confidenceGrid.length).toBe(gridPoints.length);
      
      // Points closer to data should have higher confidence
      const centerPoint = confidenceGrid.find(p => p.x === 5 && p.y === 5);
      const cornerPoint = confidenceGrid.find(p => p.x === 0 && p.y === 0);
      
      expect(centerPoint.confidence).toBeGreaterThan(cornerPoint.confidence);
    });
  });

  describe('Data Validation', () => {
    test('handles invalid input gracefully', () => {
      const invalidData = [
        { x: 'invalid', y: 0, value: 10 }
      ];
      
      // Static method should handle invalid data
      const result = SpatialInterpolationEngine.inverseDistanceWeighting(
        { x: 0, y: 0 },
        invalidData,
        2,
        100
      );
      
      // Should return a default value or NaN for invalid data
      expect(typeof result).toBe('number');
    });

    test('handles empty data array', () => {
      const result = SpatialInterpolationEngine.inverseDistanceWeighting(
        { x: 0, y: 0 },
        [],
        2,
        100
      );
      
      expect(result).toBe(0); // Should return 0 for empty data
    });
  });

  describe('Performance', () => {
    test('handles large datasets efficiently', () => {
      const largeDataset = Array.from({ length: 1000 }, (_, i) => ({
        x: Math.random() * 100,
        y: Math.random() * 100,
        value: Math.random() * 50
      }));

      const startTime = performance.now();
      const result = SpatialInterpolationEngine.inverseDistanceWeighting(
        { x: 50, y: 50 },
        largeDataset,
        2,
        100
      );
      const endTime = performance.now();
      
      expect(typeof result).toBe('number');
      expect(endTime - startTime).toBeLessThan(100); // Should complete quickly
    });
  });

  describe('Power Parameter Effects', () => {
    test('different power values produce different results', () => {
      const dataPoints = mockData.map(d => ({ x: d.x, y: d.y, value: d.z }));
      
      const result1 = SpatialInterpolationEngine.inverseDistanceWeighting(
        { x: 7, y: 7 },
        dataPoints,
        1, // power 1
        100
      );
      
      const result2 = SpatialInterpolationEngine.inverseDistanceWeighting(
        { x: 7, y: 7 },
        dataPoints,
        3, // power 3
        100
      );
      
      expect(result1).not.toBeCloseTo(result2, 2);
    });

    test('higher power gives more weight to closer points', () => {
      const closeData = [
        { x: 0, y: 0, value: 100 }, // Very close
        { x: 50, y: 50, value: 0 }  // Far away
      ];
      
      const lowPowerResult = SpatialInterpolationEngine.inverseDistanceWeighting(
        { x: 1, y: 1 },
        closeData,
        1, // low power
        100
      );
      
      const highPowerResult = SpatialInterpolationEngine.inverseDistanceWeighting(
        { x: 1, y: 1 },
        closeData,
        5, // high power
        100
      );
      
      // Higher power should be closer to the value of the nearest point (100)
      expect(highPowerResult).toBeGreaterThan(lowPowerResult);
    });
  });

  describe('Distance Cutoff', () => {
    test('respects maximum distance parameter', () => {
      const farData = [
        { x: 0, y: 0, value: 100 },
        { x: 100, y: 100, value: 200 } // Very far away
      ];
      
      // With small maxDistance, should only consider nearby points
      const result = SpatialInterpolationEngine.inverseDistanceWeighting(
        { x: 0, y: 0 },
        farData,
        2,
        10 // Small max distance
      );
      
      expect(result).toBeCloseTo(100, 1); // Should be close to nearby point value
    });
  });
});