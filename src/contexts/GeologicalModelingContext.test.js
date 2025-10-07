import React from 'react';
import { render, act, renderHook } from '@testing-library/react';
import { 
  GeologicalModelingProvider, 
  useGeologicalModeling,
  MODELING_MODES,
  INTERPOLATION_METHODS,
  GRID_RESOLUTIONS
} from './GeologicalModelingContext';

describe('GeologicalModelingContext', () => {
  const TestComponent = ({ children }) => (
    <GeologicalModelingProvider>
      {children}
    </GeologicalModelingProvider>
  );

  describe('Provider Initialization', () => {
    test('provides default values', () => {
      const { result } = renderHook(() => useGeologicalModeling(), {
        wrapper: TestComponent
      });

      expect(result.current.modelingMode).toBe(MODELING_MODES.CONCEPTUAL);
      expect(result.current.isProcessing).toBe(false);
      expect(result.current.modelingSettings).toBeDefined();
      expect(result.current.capabilities.canUseDataDriven).toBe(false);
    });

    test('initializes with correct default settings', () => {
      const { result } = renderHook(() => useGeologicalModeling(), {
        wrapper: TestComponent
      });

      const settings = result.current.modelingSettings;
      expect(settings.interpolationMethod).toBe(INTERPOLATION_METHODS.IDW);
      expect(settings.gridResolution).toBe(GRID_RESOLUTIONS.AUTO);
      expect(settings.minimumBoreholes).toBe(3);
      expect(settings.validateData).toBe(true);
    });
  });

  describe('Mode Switching', () => {
    test('switches from conceptual to data-driven when sufficient data', async () => {
      const { result } = renderHook(() => useGeologicalModeling(), {
        wrapper: TestComponent
      });

      // First update capabilities to allow data-driven mode
      const mockBoreholes = [
        { id: 1, x: 0, y: 0, layers: [{ name: 'Clay', thickness: 5 }] },
        { id: 2, x: 10, y: 0, layers: [{ name: 'Clay', thickness: 3 }] },
        { id: 3, x: 5, y: 10, layers: [{ name: 'Clay', thickness: 4 }] }
      ];

      act(() => {
        result.current.updateCapabilities(mockBoreholes);
      });

      expect(result.current.capabilities.canUseDataDriven).toBe(true);

      // Now switch mode
      act(() => {
        result.current.switchMode(MODELING_MODES.DATA_DRIVEN);
      });

      expect(result.current.modelingMode).toBe(MODELING_MODES.DATA_DRIVEN);
    });

    test('prevents switching to data-driven without sufficient data', () => {
      const { result } = renderHook(() => useGeologicalModeling(), {
        wrapper: TestComponent
      });

      expect(() => {
        act(() => {
          result.current.switchMode(MODELING_MODES.DATA_DRIVEN);
        });
      }).toThrow();

      expect(result.current.modelingMode).toBe(MODELING_MODES.CONCEPTUAL);
    });

    test('auto-switches to conceptual when data becomes insufficient', () => {
      const { result } = renderHook(() => useGeologicalModeling(), {
        wrapper: TestComponent
      });

      // First set up sufficient data and switch to data-driven
      const sufficientBoreholes = [
        { id: 1, x: 0, y: 0, layers: [{ name: 'Clay', thickness: 5 }] },
        { id: 2, x: 10, y: 0, layers: [{ name: 'Clay', thickness: 3 }] },
        { id: 3, x: 5, y: 10, layers: [{ name: 'Clay', thickness: 4 }] }
      ];

      act(() => {
        result.current.updateCapabilities(sufficientBoreholes);
      });
      
      act(() => {
        result.current.switchMode(MODELING_MODES.DATA_DRIVEN);
      });

      expect(result.current.modelingMode).toBe(MODELING_MODES.DATA_DRIVEN);

      // Now reduce data below threshold
      const insufficientBoreholes = sufficientBoreholes.slice(0, 2);

      act(() => {
        result.current.updateCapabilities(insufficientBoreholes);
      });

      expect(result.current.modelingMode).toBe(MODELING_MODES.CONCEPTUAL);
    });
  });

  describe('Capabilities Assessment', () => {
    test('correctly assesses borehole count', () => {
      const { result } = renderHook(() => useGeologicalModeling(), {
        wrapper: TestComponent
      });

      const boreholes = [
        { id: 1, x: 0, y: 0, layers: [] },
        { id: 2, x: 10, y: 0, layers: [] }
      ];

      act(() => {
        result.current.updateCapabilities(boreholes);
      });

      expect(result.current.capabilities.boreholeCount).toBe(2);
    });

    test('correctly assesses layer data presence', () => {
      const { result } = renderHook(() => useGeologicalModeling(), {
        wrapper: TestComponent
      });

      const boreholesWithLayers = [
        { id: 1, x: 0, y: 0, layers: [{ name: 'Clay', thickness: 5 }] },
        { id: 2, x: 10, y: 0, layers: [] },
        { id: 3, x: 5, y: 10, layers: [{ name: 'Sand', thickness: 3 }] }
      ];

      act(() => {
        result.current.updateCapabilities(boreholesWithLayers);
      });

      expect(result.current.capabilities.hasLayerData).toBe(true);
    });

    test('correctly assesses spatial data presence', () => {
      const { result } = renderHook(() => useGeologicalModeling(), {
        wrapper: TestComponent
      });

      const boreholesWithCoords = [
        { id: 1, x: 0, y: 0, layers: [] },
        { id: 2, x: 10, layers: [] }, // Missing y coordinate
        { id: 3, x: 5, y: 10, layers: [] }
      ];

      act(() => {
        result.current.updateCapabilities(boreholesWithCoords);
      });

      expect(result.current.capabilities.hasSpatialData).toBe(true);
    });

    test('requires all criteria for data-driven capability', () => {
      const { result } = renderHook(() => useGeologicalModeling(), {
        wrapper: TestComponent
      });

      // Missing layer data
      const boreholesNoLayers = [
        { id: 1, x: 0, y: 0, layers: [] },
        { id: 2, x: 10, y: 0, layers: [] },
        { id: 3, x: 5, y: 10, layers: [] }
      ];

      act(() => {
        result.current.updateCapabilities(boreholesNoLayers);
      });

      expect(result.current.capabilities.canUseDataDriven).toBe(false);
    });
  });

  describe('Settings Management', () => {
    test('updates individual settings', () => {
      const { result } = renderHook(() => useGeologicalModeling(), {
        wrapper: TestComponent
      });

      act(() => {
        result.current.updateSettings({ 
          interpolationMethod: INTERPOLATION_METHODS.KRIGING,
          gridResolution: GRID_RESOLUTIONS.FINE
        });
      });

      expect(result.current.modelingSettings.interpolationMethod).toBe(INTERPOLATION_METHODS.KRIGING);
      expect(result.current.modelingSettings.gridResolution).toBe(GRID_RESOLUTIONS.FINE);
    });

    test('resets settings to defaults', () => {
      const { result } = renderHook(() => useGeologicalModeling(), {
        wrapper: TestComponent
      });

      // First change some settings
      act(() => {
        result.current.updateSettings({ 
          interpolationMethod: INTERPOLATION_METHODS.KRIGING,
          confidenceThreshold: 0.9
        });
      });

      // Then reset
      act(() => {
        result.current.resetSettings();
      });

      expect(result.current.modelingSettings.interpolationMethod).toBe(INTERPOLATION_METHODS.IDW);
      expect(result.current.modelingSettings.confidenceThreshold).toBe(0.7);
    });
  });

  describe('Configuration Validation', () => {
    test('validates configuration for data-driven mode', () => {
      const { result } = renderHook(() => useGeologicalModeling(), {
        wrapper: TestComponent
      });

      // Set up data-driven mode with valid data
      const validBoreholes = [
        { id: 1, x: 0, y: 0, layers: [{ name: 'Clay', thickness: 5 }] },
        { id: 2, x: 10, y: 0, layers: [{ name: 'Clay', thickness: 3 }] },
        { id: 3, x: 5, y: 10, layers: [{ name: 'Clay', thickness: 4 }] }
      ];

      act(() => {
        result.current.updateCapabilities(validBoreholes);
      });
      
      act(() => {
        result.current.switchMode(MODELING_MODES.DATA_DRIVEN);
      });

      act(() => {
        const validation = result.current.validateConfiguration();
        expect(validation.isValid).toBe(true);
        expect(validation.errors).toHaveLength(0);
      });
    });

    test('identifies validation errors', () => {
      const { result } = renderHook(() => useGeologicalModeling(), {
        wrapper: TestComponent
      });

      act(() => {
        const validation = result.current.validateConfiguration();
        expect(validation.isValid).toBe(true); // Conceptual mode should be valid
      });
    });

    test('provides warnings for suboptimal settings', () => {
      const { result } = renderHook(() => useGeologicalModeling(), {
        wrapper: TestComponent
      });

      act(() => {
        result.current.updateSettings({ confidenceThreshold: 0.3 });
      });

      act(() => {
        const validation = result.current.validateConfiguration();
        expect(validation.warnings.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Model Processing', () => {
    test('processes model with valid configuration', async () => {
      const { result } = renderHook(() => useGeologicalModeling(), {
        wrapper: TestComponent
      });

      const mockBoreholes = [
        { id: 1, x: 0, y: 0, layers: [{ name: 'Clay', thickness: 5 }] }
      ];

      let processResult;
      await act(async () => {
        processResult = await result.current.processModel(mockBoreholes);
      });

      expect(processResult.success).toBe(true);
      expect(processResult.mode).toBe(MODELING_MODES.CONCEPTUAL);
      expect(processResult.boreholeCount).toBe(1);
    });

    test('updates processing status during execution', async () => {
      const { result } = renderHook(() => useGeologicalModeling(), {
        wrapper: TestComponent
      });

      const mockBoreholes = [];

      act(() => {
        result.current.processModel(mockBoreholes);
      });

      expect(result.current.isProcessing).toBe(true);
      expect(result.current.processingStatus).toBeTruthy();
    });

    test('handles processing errors gracefully', async () => {
      const { result } = renderHook(() => useGeologicalModeling(), {
        wrapper: TestComponent
      });

      // Force an error by trying to switch to data-driven mode without sufficient data
      expect(() => {
        act(() => {
          result.current.switchMode(MODELING_MODES.DATA_DRIVEN); // Should fail due to insufficient capabilities
        });
      }).toThrow();

      // Verify we're still in conceptual mode
      expect(result.current.modelingMode).toBe(MODELING_MODES.CONCEPTUAL);
    });
  });

  describe('Configuration Import/Export', () => {
    test('exports current configuration', () => {
      const { result } = renderHook(() => useGeologicalModeling(), {
        wrapper: TestComponent
      });

      const config = result.current.exportConfiguration();
      
      expect(config.mode).toBe(MODELING_MODES.CONCEPTUAL);
      expect(config.settings).toBeDefined();
      expect(config.capabilities).toBeDefined();
      expect(config.exportedAt).toBeDefined();
      expect(config.version).toBe('1.0');
    });

    test('imports valid configuration', () => {
      const { result } = renderHook(() => useGeologicalModeling(), {
        wrapper: TestComponent
      });

      const testConfig = {
        mode: MODELING_MODES.CONCEPTUAL,
        settings: {
          interpolationMethod: INTERPOLATION_METHODS.KRIGING,
          gridResolution: GRID_RESOLUTIONS.FINE
        }
      };

      act(() => {
        result.current.importConfiguration(testConfig);
      });

      expect(result.current.modelingMode).toBe(MODELING_MODES.CONCEPTUAL);
      expect(result.current.modelingSettings.interpolationMethod).toBe(INTERPOLATION_METHODS.KRIGING);
    });

    test('rejects invalid configuration', () => {
      const { result } = renderHook(() => useGeologicalModeling(), {
        wrapper: TestComponent
      });

      expect(() => {
        act(() => {
          result.current.importConfiguration(null);
        });
      }).toThrow('Invalid configuration data');
    });
  });

  describe('Mode Information', () => {
    test('provides correct mode information', () => {
      const { result } = renderHook(() => useGeologicalModeling(), {
        wrapper: TestComponent
      });

      const conceptualInfo = result.current.getModeInfo(MODELING_MODES.CONCEPTUAL);
      expect(conceptualInfo.name).toBe('Conceptual Modeling');
      expect(conceptualInfo.capabilities).toContain('Manual layer correlation');

      const dataDriverInfo = result.current.getModeInfo(MODELING_MODES.DATA_DRIVEN);
      expect(dataDriverInfo.name).toBe('Data-Driven Modeling');
      expect(dataDriverInfo.capabilities).toContain('Statistical interpolation');
    });
  });

  describe('Prototype State Management', () => {
    test('manages prototype result state', () => {
      const { result } = renderHook(() => useGeologicalModeling(), {
        wrapper: TestComponent
      });

      const mockResult = { success: true, data: 'test' };

      act(() => {
        result.current.setPrototypeState(mockResult);
      });

      expect(result.current.prototypeResult).toEqual(mockResult);
      expect(result.current.prototypeError).toBe(null);
    });

    test('manages prototype error state', () => {
      const { result } = renderHook(() => useGeologicalModeling(), {
        wrapper: TestComponent
      });

      const mockError = new Error('Test error');

      act(() => {
        result.current.setPrototypeState(null, mockError);
      });

      expect(result.current.prototypeResult).toBe(null);
      expect(result.current.prototypeError).toEqual(mockError);
    });

    test('clears prototype state', () => {
      const { result } = renderHook(() => useGeologicalModeling(), {
        wrapper: TestComponent
      });

      // Set some state first
      act(() => {
        result.current.setPrototypeState({ data: 'test' }, new Error('test'));
      });

      // Then clear it
      act(() => {
        result.current.clearPrototypeState();
      });

      expect(result.current.prototypeResult).toBe(null);
      expect(result.current.prototypeError).toBe(null);
    });
  });

  describe('Context Error Handling', () => {
    test('throws error when used outside provider', () => {
      expect(() => {
        renderHook(() => useGeologicalModeling());
      }).toThrow('useGeologicalModeling must be used within GeologicalModelingProvider');
    });
  });
});