

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import * as THREE from 'three';
import { VolumetricDepthScale } from './VolumetricDepthScale';
import { ThreeJsContext } from '../../contexts/ThreeJsContext';
import { GeologicalModelingContext } from '../../contexts/GeologicalModelingContext';
import { DisplayOptionsContext } from '../../contexts/DisplayOptionsContext';

// Mock Three.js utilities
jest.mock('../../utils/threeJsHelpers', () => {
  const mockTHREE = require('three');
  return {
    createGlassmorphismLabel: jest.fn((text, color, type) => {
      const mockLabel = new mockTHREE.Object3D();
      mockLabel.userData = { isGlassmorphismLabel: true, labelType: type, originalText: text };
      mockLabel.position = new mockTHREE.Vector3();
      return mockLabel;
    })
  };
});

describe('VolumetricDepthScale Component', () => {
  let mockScene, mockSceneManager, mockCSS3DScene;
  
  const createMockThreeJsContext = (isInitialized = true) => {
    mockScene = new THREE.Scene();
    mockCSS3DScene = new THREE.Scene();
    mockSceneManager = {
      addCSS3D: jest.fn(),
      removeCSS3D: jest.fn(),
      objects: new Map(),
      css3DObjects: new Map()
    };

    return {
      scene: mockScene,
      css3DScene: mockCSS3DScene,
      sceneManager: mockSceneManager,
      isInitialized,
      camera: new THREE.PerspectiveCamera(),
      renderer: {},
      controls: {}
    };
  };

  const createMockDisplayOptionsContext = (showDepthMarkers = true) => ({
    showLabels: false,
    showStrata: true,
    showDepthMarkers,
    showGroundGrid: true,
    showBoreholes: true,
    showBoreholeStrata: true,
    showWaterTable: true
  });

  const createMockVolumetricDataWithDepth = () => {
    // Create mock meshes with proper bounding boxes
    const mockMesh1 = new THREE.Mesh(
      new THREE.BoxGeometry(2, 3, 2),
      new THREE.MeshBasicMaterial()
    );
    mockMesh1.position.set(0, -1.5, 0); // Surface to -3m
    
    const mockMesh2 = new THREE.Mesh(
      new THREE.BoxGeometry(2, 2, 2), 
      new THREE.MeshBasicMaterial()
    );
    mockMesh2.position.set(0, -4, 0); // -3m to -5m

    return {
      type: 'volumetric',
      volumes: [
        {
          material: 'Clay',
          customColor: '#8B4513',
          mesh: mockMesh1,
          type: 'layer'
        },
        {
          material: 'Sand',
          customColor: '#F4A460', 
          mesh: mockMesh2,
          type: 'layer'
        }
      ]
    };
  };

  const renderWithProviders = (prototypeResult = null, showDepthMarkers = true, isInitialized = true) => {
    const threeJsContext = createMockThreeJsContext(isInitialized);
    const displayOptionsContext = createMockDisplayOptionsContext(showDepthMarkers);
    const geologicalModelingContext = {
      prototypeResult,
      modelingSettings: {}
    };

    return render(
      <ThreeJsContext.Provider value={threeJsContext}>
        <GeologicalModelingContext.Provider value={geologicalModelingContext}>
          <DisplayOptionsContext.Provider value={displayOptionsContext}>
            <VolumetricDepthScale />
          </DisplayOptionsContext.Provider>
        </GeologicalModelingContext.Provider>
      </ThreeJsContext.Provider>
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();
    console.log = jest.fn(); // Mock console.log for debugging tests
  });

  describe('Critical Bug Fix Validation', () => {
    test('should correctly identify volumetric data when type is volumetric', () => {
      const volumetricData = createMockVolumetricDataWithDepth();
      
      renderWithProviders(volumetricData, true, true);
      
      // Verify the component recognizes volumetric data
      expect(console.log).toHaveBeenCalledWith(
        'VolumetricDepthScale: Creating depth scale for volumetric model',
        expect.objectContaining({
          type: 'volumetric',
          volumeCount: 2,
          showDepthMarkers: true
        })
      );
    });

    test('should NOT process depth scale when type is not volumetric', () => {
      const nonVolumetricData = { type: 'simple', layers: [] };
      
      renderWithProviders(nonVolumetricData, true, true);
      
      // Verify early return with correct logging
      expect(console.log).toHaveBeenCalledWith(
        'VolumetricDepthScale: No volumetric data available',
        expect.objectContaining({
          type: 'simple',
          volumesLength: undefined
        })
      );

      // Verify no CSS3D depth labels were added
      expect(mockSceneManager.addCSS3D).not.toHaveBeenCalled();
    });

    test('should NOT process depth scale when volumes array is empty', () => {
      const emptyVolumetricData = { type: 'volumetric', volumes: [] };
      
      renderWithProviders(emptyVolumetricData, true, true);
      
      expect(console.log).toHaveBeenCalledWith(
        'VolumetricDepthScale: No volumetric data available',
        expect.objectContaining({
          type: 'volumetric',
          volumesLength: 0
        })
      );
    });
  });

  describe('Component Dependencies', () => {
    test('should not render when ThreeJs is not initialized', () => {
      const volumetricData = createMockVolumetricDataWithDepth();
      
      renderWithProviders(volumetricData, true, false);
      
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('VolumetricDepthScale useEffect triggered:'),
        expect.objectContaining({ isInitialized: false })
      );
      
      expect(console.log).toHaveBeenCalledWith(
        'VolumetricDepthScale: Early return - missing dependencies or showDepthMarkers false'
      );
      
      expect(mockSceneManager.addCSS3D).not.toHaveBeenCalled();
    });

    test('should not render when showDepthMarkers is false', () => {
      const volumetricData = createMockVolumetricDataWithDepth();
      
      renderWithProviders(volumetricData, false, true);
      
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('VolumetricDepthScale useEffect triggered:'),
        expect.objectContaining({ showDepthMarkers: false })
      );
      
      expect(mockSceneManager.addCSS3D).not.toHaveBeenCalled();
    });
  });

  describe('Depth Scale Creation', () => {
    test('should create CSS3D depth labels for depth positions', async () => {
      const volumetricData = createMockVolumetricDataWithDepth();
      
      renderWithProviders(volumetricData, true, true);
      
      await waitFor(() => {
        // Verify CSS3D depth labels were created
        expect(mockSceneManager.addCSS3D).toHaveBeenCalled();
        
        // Should create multiple depth markers (surface, intervals, bottom)
        const addCSS3DCalls = mockSceneManager.addCSS3D.mock.calls;
        const depthLabelCalls = addCSS3DCalls.filter(call => 
          call[0].startsWith('volumetric-depth-')
        );
        
        expect(depthLabelCalls.length).toBeGreaterThan(0);
      });
    });

    test('should log detailed information about depth label creation', () => {
      const volumetricData = createMockVolumetricDataWithDepth();
      
      renderWithProviders(volumetricData, true, true);
      
      // Verify detailed logging for depth label creation
      expect(console.log).toHaveBeenCalledWith(
        expect.stringMatching(/VolumetricDepthScale: Creating depth label \d+:/),
        expect.objectContaining({
          label: expect.any(String),
          position: expect.any(Number)
        })
      );
      
      expect(console.log).toHaveBeenCalledWith(
        expect.stringMatching(/VolumetricDepthScale: Added CSS3D depth label volumetric-depth-\d+ to scene manager/)
      );
    });

    test('should skip pocket volumes when calculating depth range', () => {
      const volumetricDataWithPockets = {
        type: 'volumetric',
        volumes: [
          {
            material: 'Clay',
            mesh: new THREE.Mesh(new THREE.BoxGeometry(2, 3, 2), new THREE.MeshBasicMaterial()),
            type: 'layer'
          },
          {
            material: 'IsolatedPocket',
            mesh: new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial()),
            type: 'pocket' // This should be skipped for depth calculation
          }
        ]
      };
      
      renderWithProviders(volumetricDataWithPockets, true, true);
      
      // Should still create depth scale based on non-pocket volumes
      expect(console.log).toHaveBeenCalledWith(
        'VolumetricDepthScale: Creating depth scale for volumetric model',
        expect.objectContaining({
          type: 'volumetric',
          volumeCount: 2
        })
      );
    });
  });

  describe('Depth Calculation Logic', () => {
    test('should handle different depth ranges with appropriate intervals', () => {
      // Create data with specific depth range (shallow)
      const shallowData = {
        type: 'volumetric',
        volumes: [
          {
            material: 'TopSoil',
            mesh: (() => {
              const mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 1, 2));
              mesh.position.set(0, -0.5, 0); // 0 to -1m
              return mesh;
            })(),
            type: 'layer'
          }
        ]
      };
      
      renderWithProviders(shallowData, true, true);
      
      // Should create depth scale even for shallow models
      expect(console.log).toHaveBeenCalledWith(
        'VolumetricDepthScale: Creating depth scale for volumetric model',
        expect.any(Object)
      );
    });

    test('should handle models with no valid mesh bounds', () => {
      const malformedData = {
        type: 'volumetric',
        volumes: [
          {
            material: 'Clay',
            // No mesh property
            type: 'layer'
          }
        ]
      };
      
      renderWithProviders(malformedData, true, true);
      
      // Should attempt to create but return early if no valid bounds
      expect(console.log).toHaveBeenCalledWith(
        'VolumetricDepthScale: Creating depth scale for volumetric model',
        expect.objectContaining({
          type: 'volumetric',
          volumeCount: 1
        })
      );
    });
  });

  describe('Cleanup Functionality', () => {
    test('should remove CSS3D labels when showDepthMarkers becomes false', () => {
      const volumetricData = createMockVolumetricDataWithDepth();
      
      const { rerender } = renderWithProviders(volumetricData, true, true);
      
      // Initially creates depth scale
      expect(mockSceneManager.addCSS3D).toHaveBeenCalled();
      
      // Clear mocks
      jest.clearAllMocks();
      
      // Re-render with showDepthMarkers false
      const threeJsContext = createMockThreeJsContext(true);
      const displayOptionsContext = createMockDisplayOptionsContext(false);
      const geologicalModelingContext = { prototypeResult: volumetricData };

      rerender(
        <ThreeJsContext.Provider value={threeJsContext}>
          <GeologicalModelingContext.Provider value={geologicalModelingContext}>
            <DisplayOptionsContext.Provider value={displayOptionsContext}>
              <VolumetricDepthScale />
            </DisplayOptionsContext.Provider>
          </GeologicalModelingContext.Provider>
        </ThreeJsContext.Provider>
      );
      
      // Should not create new depth markers when disabled
      expect(mockSceneManager.addCSS3D).not.toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    test('should handle null prototypeResult gracefully', () => {
      renderWithProviders(null, true, true);
      
      expect(console.log).toHaveBeenCalledWith(
        'VolumetricDepthScale: No volumetric data available',
        expect.objectContaining({
          type: undefined,
          volumesLength: undefined
        })
      );
      
      expect(mockSceneManager.addCSS3D).not.toHaveBeenCalled();
    });

    test('should handle zero depth range gracefully', () => {
      const zeroDepthData = {
        type: 'volumetric',
        volumes: [
          {
            material: 'Surface',
            mesh: (() => {
              const mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 0, 2));
              mesh.position.set(0, 0, 0); // No depth
              return mesh;
            })(),
            type: 'layer'
          }
        ]
      };
      
      renderWithProviders(zeroDepthData, true, true);
      
      // Should handle zero depth without crashing
      expect(console.log).toHaveBeenCalledWith(
        'VolumetricDepthScale: Creating depth scale for volumetric model',
        expect.any(Object)
      );
    });
  });
});