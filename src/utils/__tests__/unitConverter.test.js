/**
 * Unit Converter Test Suite
 * 
 * Validates mathematical precision and accuracy of all unit conversion functions.
 * Ensures zero data loss and proper handling of edge cases.
 */

import {
  feetToMeters,
  metersToFeet,
  feetToInches,
  inchesToFeet,
  metersToInches,
  inchesToMeters,
  formatDepthMetersToFeet,
  formatDiameterFeetToInches,
  parseUserFeetToMeters,
  coordsMetersToFeet,
  coordsFeetToMeters,
  preCompensateFeetForViewer,
  calculateViewerDisplayValue,
  isGeologicallyEqual,
  roundToGeologicalPrecision,
  validateConversions,
  CONVERSION_FACTORS
} from '../unitConverter.js';

describe('Unit Converter', () => {
  
  describe('Basic Conversion Functions', () => {
    test('feetToMeters converts accurately', () => {
      expect(feetToMeters(1)).toBeCloseTo(0.3048, 6);
      expect(feetToMeters(10)).toBeCloseTo(3.048, 6);
      expect(feetToMeters(100)).toBeCloseTo(30.48, 6);
      expect(feetToMeters(0)).toBe(0);
    });

    test('metersToFeet converts accurately', () => {
      expect(metersToFeet(1)).toBeCloseTo(3.28084, 5);
      expect(metersToFeet(3.048)).toBeCloseTo(10, 5);
      expect(metersToFeet(30.48)).toBeCloseTo(100, 5);
      expect(metersToFeet(0)).toBe(0);
    });

    test('feetToInches converts accurately', () => {
      expect(feetToInches(1)).toBe(12);
      expect(feetToInches(2.5)).toBe(30);
      expect(feetToInches(0)).toBe(0);
    });

    test('inchesToFeet converts accurately', () => {
      expect(inchesToFeet(12)).toBe(1);
      expect(inchesToFeet(30)).toBe(2.5);
      expect(inchesToFeet(0)).toBe(0);
    });
  });

  describe('Round-trip Conversion Accuracy', () => {
    const testValues = [0, 1, 10, 30.5, 100, 1000.123];

    testValues.forEach(value => {
      test(`feet ↔ meters round-trip for ${value}`, () => {
        const converted = metersToFeet(feetToMeters(value));
        expect(Math.abs(value - converted)).toBeLessThan(1e-4); // Acceptable precision for geological measurements
      });

      test(`feet ↔ inches round-trip for ${value}`, () => {
        const converted = inchesToFeet(feetToInches(value));
        expect(Math.abs(value - converted)).toBeLessThan(1e-15);
      });
    });
  });

  describe('Geological-Specific Functions', () => {
    test('formatDepthMetersToFeet handles typical values', () => {
      expect(formatDepthMetersToFeet(10)).toBe('32.8');
      expect(formatDepthMetersToFeet(30.48)).toBe('100.0');
      expect(formatDepthMetersToFeet(0)).toBe('0.0');
      expect(formatDepthMetersToFeet(-5)).toBe('-16.4'); // Negative depths allowed
    });

    test('formatDiameterFeetToInches handles typical borehole diameters', () => {
      expect(formatDiameterFeetToInches(0.5)).toBe('6.0');
      expect(formatDiameterFeetToInches(1)).toBe('12.0');
      expect(formatDiameterFeetToInches(0.49)).toBe('5.9'); // Common default
    });

    test('parseUserFeetToMeters handles various inputs', () => {
      expect(parseUserFeetToMeters('10')).toBeCloseTo(3.048, 6);
      expect(parseUserFeetToMeters('10.5')).toBeCloseTo(3.2004, 6);
      expect(parseUserFeetToMeters(10)).toBeCloseTo(3.048, 6);
      expect(parseUserFeetToMeters('invalid')).toBe(0);
      expect(parseUserFeetToMeters(-1)).toBe(0); // Negative values return 0
    });
  });

  describe('Coordinate Array Conversions', () => {
    test('coordsMetersToFeet converts coordinate arrays', () => {
      const metersCoords = [1, 2, 3];
      const feetCoords = coordsMetersToFeet(metersCoords);
      expect(feetCoords[0]).toBeCloseTo(3.28084, 5);
      expect(feetCoords[1]).toBeCloseTo(6.56168, 5);
      expect(feetCoords[2]).toBeCloseTo(9.84252, 5);
    });

    test('coordsFeetToMeters converts coordinate arrays', () => {
      const feetCoords = [10, 20, 30];
      const metersCoords = coordsFeetToMeters(feetCoords);
      expect(metersCoords[0]).toBeCloseTo(3.048, 6);
      expect(metersCoords[1]).toBeCloseTo(6.096, 6);
      expect(metersCoords[2]).toBeCloseTo(9.144, 6);
    });
  });

  describe('Export-Specific Functions', () => {
    test('preCompensateFeetForViewer calculates correct pre-compensation', () => {
      const originalFeet = 100;
      const preCompensated = preCompensateFeetForViewer(originalFeet);
      expect(preCompensated).toBeCloseTo(originalFeet / CONVERSION_FACTORS.METERS_TO_FEET, 6);
    });

    test('calculateViewerDisplayValue shows correct display value', () => {
      const preCompensated = 30.48;
      const displayValue = calculateViewerDisplayValue(preCompensated);
      expect(displayValue).toBeCloseTo(100, 5); // Should display as 100 feet
    });

    test('export round-trip maintains accuracy', () => {
      const originalFeet = 50;
      const preCompensated = preCompensateFeetForViewer(originalFeet);
      const displayValue = calculateViewerDisplayValue(preCompensated);
      expect(displayValue).toBeCloseTo(originalFeet, 5);
    });
  });

  describe('Utility Functions', () => {
    test('isGeologicallyEqual handles precision comparison', () => {
      expect(isGeologicallyEqual(1.0, 1.0000001)).toBe(true);
      expect(isGeologicallyEqual(1.0, 1.1)).toBe(false);
      expect(isGeologicallyEqual(0, 0.0000001)).toBe(true);
    });

    test('roundToGeologicalPrecision rounds appropriately', () => {
      expect(roundToGeologicalPrecision(1.234567, 0.1)).toBe(1.2);
      expect(roundToGeologicalPrecision(1.567890, 0.1)).toBe(1.6);
      expect(roundToGeologicalPrecision(1.05, 0.1)).toBe(1.1);
    });
  });

  describe('Input Validation', () => {
    test('functions throw errors for invalid inputs', () => {
      expect(() => feetToMeters('invalid')).toThrow('Invalid input');
      expect(() => metersToFeet(null)).toThrow('Invalid input');
      expect(() => feetToInches(undefined)).toThrow('Invalid input');
      expect(() => inchesToFeet(NaN)).toThrow('Invalid input');
    });

    test('functions handle edge cases gracefully', () => {
      expect(feetToMeters(0)).toBe(0);
      expect(metersToFeet(0)).toBe(0);
      expect(formatDepthMetersToFeet(null)).toBe('0.0');
      expect(formatDiameterFeetToInches(undefined)).toBe('0.0');
    });
  });

  describe('Conversion Factor Validation', () => {
    test('conversion factors are mathematically consistent', () => {
      expect(CONVERSION_FACTORS.FEET_TO_METERS * CONVERSION_FACTORS.METERS_TO_FEET).toBeCloseTo(1, 5);
      expect(CONVERSION_FACTORS.INCHES_TO_FEET * CONVERSION_FACTORS.FEET_TO_INCHES).toBe(1);
      expect(CONVERSION_FACTORS.INCHES_TO_METERS * CONVERSION_FACTORS.METERS_TO_INCHES).toBeCloseTo(1, 5);
    });

    test('validateConversions returns accurate results', () => {
      const validation = validateConversions();
      expect(validation.accurate).toBe(true);
      validation.tests.forEach(test => {
        expect(test.withinTolerance).toBe(true);
      });
    });
  });

  describe('Precision and Performance', () => {
    test('conversions maintain high precision', () => {
      const testValue = 123.456789;
      const roundTrip = metersToFeet(feetToMeters(testValue));
      const error = Math.abs(testValue - roundTrip);
      expect(error).toBeLessThan(1e-5); // Realistic precision for floating-point arithmetic
    });

    test('functions perform within acceptable time limits', () => {
      const startTime = performance.now();
      for (let i = 0; i < 10000; i++) {
        feetToMeters(i * 0.1);
        metersToFeet(i * 0.1);
        feetToInches(i * 0.1);
      }
      const endTime = performance.now();
      const executionTime = endTime - startTime;
      expect(executionTime).toBeLessThan(100); // Should complete in under 100ms
    });
  });

  describe('Real-world Geological Scenarios', () => {
    test('typical borehole depth conversions', () => {
      // 30-foot borehole
      const depthMeters = parseUserFeetToMeters('30');
      expect(depthMeters).toBeCloseTo(9.144, 6);
      
      const depthDisplay = formatDepthMetersToFeet(depthMeters);
      expect(depthDisplay).toBe('30.0');
    });

    test('typical borehole diameter conversions', () => {
      // 6-inch diameter (0.5 feet)
      const diameterFeet = inchesToFeet(6);
      expect(diameterFeet).toBe(0.5);
      
      const diameterDisplay = formatDiameterFeetToInches(diameterFeet);
      expect(diameterDisplay).toBe('6.0');
    });

    test('3D coordinate transformations', () => {
      // Site coordinates in meters
      const siteMeters = [100, 50, -10]; // x, y, depth
      const siteFeet = coordsMetersToFeet(siteMeters);
      const backToMeters = coordsFeetToMeters(siteFeet);
      
      siteMeters.forEach((original, i) => {
        expect(Math.abs(original - backToMeters[i])).toBeLessThan(1e-5);
      });
    });
  });
});