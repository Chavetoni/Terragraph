import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import * as THREE from 'three';
import { VolumetricLabels } from './VolumetricLabels';
import { ThreeJsContext } from '../../contexts/ThreeJsContext';
import { GeologicalModelingContext } from '../../contexts/GeologicalModelingContext';
import { DisplayOptionsContext } from '../../contexts/DisplayOptionsContext';

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

describe('VolumetricLabels Component', () => {
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

  const createMockDisplayOptionsContext = (showLabels = true) => ({
    showLabels,
    showStrata: true,
    showDepthMarkers: false,
    showGroundGrid: true,
    showBoreholes: true,
    showBoreholeStrata: true,
    showWaterTable: true
  });

  const createMockVolumetricData = () => ({
    type: 'volumetric',
    volumes: [
      {
        material: 'Clay',
        customColor: '#8B4513',
        mesh: {
          geometry: new THREE.BoxGeometry(1, 1, 1),
          position: new THREE.Vector3(0, -1, 0)
        },
        type: 'layer'
      },
      {
        material: 'Sand',
        customColor: '#F4A460',
        mesh: {
          geometry: new THREE.BoxGeometry(1, 1, 1),
          position: new THREE.Vector3(0, -2, 0)
        },
        type: 'layer'
      }
    ]
  });

  const renderWithProviders = (prototypeResult = null, showLabels = true, isInitialized = true) => {
    const threeJsContext = createMockThreeJsContext(isInitialized);
    const displayOptionsContext = createMockDisplayOptionsContext(showLabels);
    const geologicalModelingContext = {
      prototypeResult,
      modelingSettings: {}
    };

    return render(
      <ThreeJsContext.Provider value={threeJsContext}>
        <GeologicalModelingContext.Provider value={geologicalModelingContext}>
          <DisplayOptionsContext.Provider value={displayOptionsContext}>
            <VolumetricLabels />
          </DisplayOptionsContext.Provider>
        </GeologicalModelingContext.Provider>
      </ThreeJsContext.Provider>
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();
    console.log = jest.fn();
  });

  describe('Critical Bug Fix Validation', () => {
    test('should correctly identify volumetric data when type is volumetric', () => {
      const volumetricData = createMockVolumetricData();

      renderWithProviders(volumetricData, true, true);

      expect(console.log).toHaveBeenCalledWith(
        'VolumetricLabels: Creating labels for volumetric model',
        expect.objectContaining({
          type: 'volumetric',
          volumeCount: 2,
          showLabels: true
        })
      );
    });

    test('should NOT process labels when type is not volumetric', () => {
      const nonVolumetricData = { type: 'simple', layers: [] };
      
      renderWithProviders(nonVolumetricData, true, true);
      
      // Verify early return with correct logging
      expect(console.log).toHaveBeenCalledWith(
        'VolumetricLabels: No volumetric data available',
        expect.objectContaining({
          type: 'simple',
          volumesLength: undefined
        })
      );

      // Verify no CSS3D labels were added
      expect(mockSceneManager.addCSS3D).not.toHaveBeenCalled();
    });

    test('should NOT process labels when volumes array is empty', () => {
      const emptyVolumetricData = { type: 'volumetric', volumes: [] };
      
      renderWithProviders(emptyVolumetricData, true, true);
      
      expect(console.log).toHaveBeenCalledWith(
        'VolumetricLabels: No volumetric data available',
        expect.objectContaining({
          type: 'volumetric',
          volumesLength: 0
        })
      );
    });
  });

  describe('Component Dependencies', () => {
    test('should not render when ThreeJs is not initialized', () => {
      const volumetricData = createMockVolumetricData();
      
      renderWithProviders(volumetricData, true, false);
      
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('VolumetricLabels useEffect triggered:'),
        expect.objectContaining({ isInitialized: false })
      );
      
      expect(console.log).toHaveBeenCalledWith(
        'VolumetricLabels: Early return - missing dependencies or showLabels false'
      );
      
      expect(mockSceneManager.addCSS3D).not.toHaveBeenCalled();
    });

    test('should not render when showLabels is false', () => {
      const volumetricData = createMockVolumetricData();
      
      renderWithProviders(volumetricData, false, true);
      
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('VolumetricLabels useEffect triggered:'),
        expect.objectContaining({ showLabels: false })
      );
      
      expect(mockSceneManager.addCSS3D).not.toHaveBeenCalled();
    });
  });

  describe('Label Creation and Positioning', () => {
    test('should create CSS3D labels for each unique material', async () => {
      const volumetricData = createMockVolumetricData();
      
      renderWithProviders(volumetricData, true, true);
      
      await waitFor(() => {
        // Verify CSS3D labels were created for each material
        expect(mockSceneManager.addCSS3D).toHaveBeenCalledTimes(2);
        
        // Verify labels were added with correct IDs
        expect(mockSceneManager.addCSS3D).toHaveBeenCalledWith(
          'volumetric-label-0',
          expect.any(Object)
        );
        expect(mockSceneManager.addCSS3D).toHaveBeenCalledWith(
          'volumetric-label-1',
          expect.any(Object)
        );
      });
    });

    test('should log detailed information about label creation', () => {
      const volumetricData = createMockVolumetricData();
      
      renderWithProviders(volumetricData, true, true);
      
      // Verify detailed logging for each label
      expect(console.log).toHaveBeenCalledWith(
        'VolumetricLabels: Creating label 0:',
        expect.objectContaining({
          material: 'Clay',
          color: '#8B4513'
        })
      );
      
      expect(console.log).toHaveBeenCalledWith(
        'VolumetricLabels: Added CSS3D label volumetric-label-0 to scene manager'
      );
    });

    test('should skip pocket volumes when creating labels', () => {
      const volumetricDataWithPockets = {
        type: 'volumetric',
        volumes: [
          {
            material: 'Clay',
            customColor: '#8B4513',
            mesh: new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial()),
            type: 'layer'
          },
          {
            material: 'IsolatedPocket',
            customColor: '#FF0000',
            mesh: new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial()),
            type: 'pocket' // This should be skipped
          }
        ]
      };
      
      renderWithProviders(volumetricDataWithPockets, true, true);
      
      // Should only create one label (skip the pocket)
      expect(mockSceneManager.addCSS3D).toHaveBeenCalledTimes(1);
      expect(mockSceneManager.addCSS3D).toHaveBeenCalledWith(
        'volumetric-label-0',
        expect.any(Object)
      );
    });
  });

  describe('Label Cleanup', () => {
    test('should remove CSS3D labels when showLabels becomes false', () => {
      const volumetricData = createMockVolumetricData();
      
      const { rerender } = renderWithProviders(volumetricData, true, true);
      
      // Initially creates labels
      expect(mockSceneManager.addCSS3D).toHaveBeenCalled();
      
      // Clear mocks
      jest.clearAllMocks();
      
      // Re-render with showLabels false
      const threeJsContext = createMockThreeJsContext(true);
      const displayOptionsContext = createMockDisplayOptionsContext(false);
      const geologicalModelingContext = { prototypeResult: volumetricData };

      rerender(
        <ThreeJsContext.Provider value={threeJsContext}>
          <GeologicalModelingContext.Provider value={geologicalModelingContext}>
            <DisplayOptionsContext.Provider value={displayOptionsContext}>
              <VolumetricLabels />
            </DisplayOptionsContext.Provider>
          </GeologicalModelingContext.Provider>
        </ThreeJsContext.Provider>
      );
      
      // Should not create new labels when disabled
      expect(mockSceneManager.addCSS3D).not.toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    test('should handle null prototypeResult gracefully', () => {
      renderWithProviders(null, true, true);
      
      expect(console.log).toHaveBeenCalledWith(
        'VolumetricLabels: No volumetric data available',
        expect.objectContaining({
          type: undefined,
          volumesLength: undefined
        })
      );
      
      expect(mockSceneManager.addCSS3D).not.toHaveBeenCalled();
    });

    test('should handle volumes without mesh property', () => {
      const malformedVolumetricData = {
        type: 'volumetric',
        volumes: [
          {
            material: 'Clay',
            customColor: '#8B4513',
            // Missing mesh property
            type: 'layer'
          }
        ]
      };
      
      renderWithProviders(malformedVolumetricData, true, true);
      
      // Should still try to create labels but with default positioning
      expect(console.log).toHaveBeenCalledWith(
        'VolumetricLabels: Creating labels for volumetric model',
        expect.objectContaining({
          type: 'volumetric',
          volumeCount: 1
        })
      );
    });
  });
});