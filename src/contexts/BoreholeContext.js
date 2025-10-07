import React, { createContext, useState, useEffect, useCallback, useContext, useRef, useMemo } from 'react';
import { Borehole, BOREHOLE_TYPES } from '../models/Borehole';
import { ThreeJsContext } from './ThreeJsContext';
import { useLayers } from './LayersContext';
import { useDisplayOptions } from './DisplayOptionsContext';
import { useGeologicalModeling } from './OptimizedGeologicalModelingContext';
import { getBoreholeDimensions } from '../utils/scaleConstants';
import { BoreholeVisualizer } from '../services/BoreholeVisualizer';
import { Color, Matrix4, Mesh, MeshBasicMaterial, PlaneGeometry, Raycaster, SphereGeometry, Vector2, Vector3 } from 'three';

export const BoreholeContext = createContext();

// Helper function to get borehole type color
const getBoreholetypeColor = (type) => {
  return BOREHOLE_TYPES[type]?.color || BOREHOLE_TYPES.OTHER.color;
};

export const useBoreholes = () => {
  const context = useContext(BoreholeContext);
  if (!context) {
    throw new Error('useBoreholes must be used within a BoreholeProvider');
  }
  return context;
};

export const BoreholeProvider = ({ children }) => {
  const [boreholes, setBoreholes] = useState([]);
  const [selectedBorehole, setSelectedBorehole] = useState(null);
  const [isPlacingBorehole, setIsPlacingBorehole] = useState(false);
  const [hoveredBorehole, setHoveredBorehole] = useState(null);
  const [hoveredStrataLayer, setHoveredStrataLayer] = useState(null);
  const [showCreationModal, setShowCreationModal] = useState(false);
  const [pendingBoreholeData, setPendingBoreholeData] = useState(null);
  const raycasterRef = useRef(new Raycaster());
  const visualizerRef = useRef(null);
  
  // Performance optimization: Reusable objects to reduce garbage collection
  const mouseVectorRef = useRef(new Vector2());
  const tempPlaneRef = useRef(null);
  
  // Object pool for performance optimization
  const objectPool = useRef({
    vectors: [],
    matrices: [],
    
    getVector3: () => {
      return objectPool.current.vectors.pop() || new Vector3();
    },
    
    returnVector3: (vector) => {
      vector.set(0, 0, 0);
      objectPool.current.vectors.push(vector);
    },
    
    getMatrix4: () => {
      return objectPool.current.matrices.pop() || new Matrix4();
    },
    
    returnMatrix4: (matrix) => {
      matrix.identity();
      objectPool.current.matrices.push(matrix);
    }
  });
  
  // Raycasting performance optimization: Set up distance culling
  useEffect(() => {
    if (raycasterRef.current) {
      // Don't set default layers here - let each operation handle its own layers
      // This prevents conflicts between placement and hover operations
      
      // Limit raycasting distance to improve performance
      raycasterRef.current.far = 1000;
      raycasterRef.current.params.Points.threshold = 0.1;
      raycasterRef.current.params.Line.threshold = 0.1;
    }
  }, []);
  
  const { sceneManager, isInitialized, camera, scene, renderer } = useContext(ThreeJsContext);
  const { updateCapabilities } = useGeologicalModeling();
  
  const { layers: soilLayers } = useLayers();
  const { 
    showBoreholes, 
    boreholesIndividualVisibility,
    showBoreholeStrata,
    boreholesStrataVisibility,
    getBoreholeStrataVisibility,
    setBoreholesStrataVisibility,
    showWaterTable,
    textureSettings
  } = useDisplayOptions();


  // Initialize visualizer when scene is ready
  useEffect(() => {
    if (scene && camera && sceneManager && !visualizerRef.current) {
      visualizerRef.current = new BoreholeVisualizer(scene, camera, sceneManager);
    }
  }, [scene, camera, sceneManager]);

  const getSoilLayerById = useCallback((id) => {
    return soilLayers.find(layer => layer.id === id);
  }, [soilLayers]);


  const addBorehole = useCallback((boreholeData) => {
    const newBorehole = new Borehole(boreholeData, getSoilLayerById);
    setBoreholes(prev => [...prev, newBorehole]);
    return newBorehole; // Return the created borehole
  }, [getSoilLayerById]);

  const updateBorehole = useCallback((id, updatedData) => {
    setBoreholes(prev =>
      prev.map(b => (b.id === id ? b.update(updatedData) : b))
    );
    if (selectedBorehole && selectedBorehole.id === id) {
        setSelectedBorehole(prev => prev.update(updatedData));
    }
  }, [selectedBorehole]);

  const deleteBorehole = useCallback((id) => {
    setBoreholes(prev => prev.filter(b => b.id !== id));
    if (selectedBorehole && selectedBorehole.id === id) {
        setSelectedBorehole(null);
    }
    
    // Also remove any associated isolated pockets
    if (sceneManager && sceneManager.objects) {
      // Check for combined pocket (contains borehole ID)
      const combinedPocketKey = `IsolatedPocket_combined_${id}_pocket`;
      if (sceneManager.objects.has(combinedPocketKey)) {

        sceneManager.remove(combinedPocketKey);
      }
      
      // For now, we can't easily identify material-specific pockets by borehole ID
      // since they use material-based unique keys. This would require storing
      // the borehole ID in the mesh userData when creating pockets.
      // TODO: Consider adding boreholeId to pocket mesh userData for easier cleanup
    }
  }, [selectedBorehole, sceneManager]);

  const selectBorehole = useCallback((id) => {
    const borehole = boreholes.find(b => b.id === id) || null;
    setSelectedBorehole(borehole);
    
    // Update visual state
    if (visualizerRef.current) {
      // Reset all markers to normal
      boreholes.forEach(bh => {
        visualizerRef.current.updateMarkerState(bh.id, 'normal');
      });
      
      // Apply selection state to selected borehole
      if (borehole) {
        visualizerRef.current.updateMarkerState(borehole.id, 'selected');
      }
    }
  }, [boreholes]);

  const hoverBorehole = useCallback((id) => {
    if (id === hoveredBorehole) return;
    
    // Remove hover from previous borehole
    if (hoveredBorehole && visualizerRef.current) {
      visualizerRef.current.updateMarkerState(hoveredBorehole, 'normal');
    }
    
    setHoveredBorehole(id);
    
    // Apply hover to new borehole
    if (id && visualizerRef.current) {
      visualizerRef.current.updateMarkerState(id, 'hover');
    }
  }, [hoveredBorehole]);


  const addSimpleBorehole = useCallback((x, y, z, name, depth = 10, type = 'GENERAL', color = null) => {
    const boreholeId = Date.now();
    
    // Automatically assign layers based on soil layers if they exist
    let boreholeLayers = [];
    if (soilLayers && soilLayers.length > 0) {
      let currentDepth = 0;
      boreholeLayers = soilLayers.map(layer => {
        const layerDepth = parseFloat(layer.depth) || 1;
        const thickness = Math.min(layerDepth, depth - currentDepth);
        currentDepth += thickness;
        
        if (thickness > 0) {
          return {
            id: layer.id,
            thickness: thickness,
            name: layer.name
          };
        }
        return null;
      }).filter(Boolean);
    }
    
    const newBorehole = {
      id: boreholeId,
      name: name || `BH-${boreholes.length + 1}`,
      x: parseFloat(parseFloat(x).toFixed(2)),
      y: parseFloat(parseFloat(y).toFixed(2)),
      z: parseFloat(parseFloat(z).toFixed(2)),
      depth: parseFloat(parseFloat(depth).toFixed(2)),
      type: type,
      color: color || (type !== 'OTHER' ? getBoreholetypeColor(type) : '#795548'),
      diameter: getBoreholeDimensions().diameter,
      layers: boreholeLayers
    };

    setBoreholes(prev => [...prev, newBorehole]);
    return newBorehole;
  }, [boreholes.length, soilLayers]);

  // Test function to add a borehole with layers for debugging
  const addTestBoreholeWithLayers = useCallback(() => {
    const testBoreholeData = {
      name: 'Test BH with Layers',
      x: 0,
      y: 0,
      z: 0,
      depth: 10,
      totalDepth: 10,
      diameter: 0.15,
      type: 'BUILDING',
      color: '#F44336',
      layers: [
        {
          id: 'layer1',
          from: 0,
          to: 3,
          material: 'CLAY',
          thickness: 3
        },
        {
          id: 'layer2', 
          from: 3,
          to: 7,
          material: 'SAND',
          thickness: 4
        },
        {
          id: 'layer3',
          from: 7,
          to: 10,
          material: 'ROCK',
          thickness: 3
        }
      ]
    };

    const newBorehole = addBorehole(testBoreholeData);
    return newBorehole;
  }, [addBorehole]);


  const removeBorehole = useCallback((idToRemove) => {
    setBoreholes(prev => prev.filter(bh => bh.id !== idToRemove));
    
    // Remove individual borehole visual representation from scene
    if (sceneManager && visualizerRef.current) {
      // Get the marker before removing it for proper disposal
      const marker = sceneManager.get(`borehole_${idToRemove}`);
      if (marker) {
        visualizerRef.current.disposeBorehole(marker);
      }
      sceneManager.remove(`borehole_${idToRemove}`);
    }
    
    // Clean up strata visibility state for removed borehole
    if (setBoreholesStrataVisibility) {
      setBoreholesStrataVisibility(prev => {
        const updated = new Map(prev);
        updated.delete(idToRemove);
        return updated;
      });
    }
    
    // Also ensure no collective borehole group exists (cleanup from old system)
    if (sceneManager) {
      sceneManager.remove('boreholes');
      
      // Also remove any associated isolated pockets
      if (sceneManager.objects) {
        // Check for combined pocket (contains borehole ID)
        const combinedPocketKey = `IsolatedPocket_combined_${idToRemove}_pocket`;
        if (sceneManager.objects.has(combinedPocketKey)) {

          sceneManager.remove(combinedPocketKey);
        }
        
        // For now, we can't easily identify material-specific pockets by borehole ID
        // since they use material-based unique keys. This would require storing
        // the borehole ID in the mesh userData when creating pockets.
        // TODO: Consider adding boreholeId to pocket mesh userData for easier cleanup
      }
    }
  }, [sceneManager, setBoreholesStrataVisibility]);

  // Clear all boreholes function for testing
  const clearAllBoreholes = useCallback(() => {
    // Get all current borehole IDs before clearing
    const allIds = boreholes.map(bh => bh.id);
    
    // Clear the boreholes array
    setBoreholes([]);
    
    // Remove all visual representations from scene
    if (sceneManager && visualizerRef.current) {
      allIds.forEach(id => {
        // Remove individual borehole marker
        const marker = sceneManager.get(`borehole_${id}`);
        if (marker) {
          visualizerRef.current.disposeBorehole(marker);
        }
        sceneManager.remove(`borehole_${id}`);
      });
      
      // Also remove any collective group
      sceneManager.remove('boreholes');
    }
    
    // Clear all strata visibility states
    if (setBoreholesStrataVisibility) {
      setBoreholesStrataVisibility(new Map());
    }
    
    // Clear selection state
    setSelectedBorehole(null);
    setHoveredBorehole(null);
    setHoveredStrataLayer(null);
  }, [boreholes, sceneManager, visualizerRef, setBoreholesStrataVisibility]);

  // Make test functions available globally for debugging
  useEffect(() => {
    window.addTestBoreholeWithLayers = addTestBoreholeWithLayers;
    window.addBorehole = addBorehole;
    window.clearAllBoreholes = clearAllBoreholes;
    
    // Debug function to create a test borehole with water table
    window.addTestBoreholeWithWaterTable = () => {

      const testBoreholeData = {
        name: 'Water Table Test BH',
        x: 2,
        y: 0,
        z: 2,
        depth: 8,
        totalDepth: 8,
        diameter: 0.15,
        type: 'BUILDING',
        color: '#2196F3',
        waterTableEncountered: true,
        waterTableDepth: 3.5,
        layers: [
          { id: 'test1', from: 0, to: 2, material: 'CLAY', thickness: 2 },
          { id: 'test2', from: 2, to: 5, material: 'SAND', thickness: 3 },
          { id: 'test3', from: 5, to: 8, material: 'ROCK', thickness: 3 }
        ]
      };

      const newBorehole = addBorehole(testBoreholeData);

      return newBorehole;
    };
    
    // Debug function to check water table visibility
    window.checkWaterTableVisibility = () => {

      boreholes.forEach((borehole, index) => {

      });
    };
    
    // Debug function to test texture rendering
    window.addTextureTestBorehole = () => {

      const testBoreholeData = {
        name: 'Texture Test BH',
        x: -2,
        y: 0,
        z: -2,
        depth: 10,
        totalDepth: 10,
        diameter: 0.15,
        type: 'BUILDING',
        color: '#FF5722',
        layers: [
          { id: 'tex1', from: 0, to: 2, material: 'CLAY', thickness: 2 },
          { id: 'tex2', from: 2, to: 4, material: 'SAND', thickness: 2 },
          { id: 'tex3', from: 4, to: 6, material: 'ROCK', thickness: 2 },
          { id: 'tex4', from: 6, to: 8, material: 'SILT', thickness: 2 },
          { id: 'tex5', from: 8, to: 10, material: 'GRAVEL', thickness: 2 }
        ]
      };

      const newBorehole = addBorehole(testBoreholeData);

      return newBorehole;
    };
    
    // Debug function to check geological modeling capabilities
    window.checkGeologicalCapabilities = () => {
      return {
        withLayers: boreholes.filter(bh => bh.layers && bh.layers.length > 0),
        withCoordinates: boreholes.filter(bh => 
          typeof bh.x === 'number' && typeof bh.y === 'number'
        )
      };
    };

    // Helper function to check if current boreholes form a proper triangle
    window.checkBoreholeDistribution = () => {
      if (boreholes.length < 3) {
        return;
      }
      
      const positions = boreholes.slice(0, 3).map(bh => ({ 
        x: bh.x, 
        z: bh.z,  // Use Z for horizontal positioning
        y: bh.y,  // Y is elevation (can be same for all)
        name: bh.name 
      }));
      const [p1, p2, p3] = positions;
      const area = Math.abs(
        p1.x * (p2.z - p3.z) + 
        p2.x * (p3.z - p1.z) + 
        p3.x * (p1.z - p2.z)
      ) / 2;
      
      
      if (area < 0.01) {
      } else {
      }
      
      // Check layer data
      const withLayers = boreholes.filter(bh => bh.layers && bh.layers.length > 0);
      
      if (withLayers.length < 3) {
      }
    };

    // Add test boreholes in triangular distribution for geological modeling
    window.addTriangularTestBoreholes = () => {
      // Clear existing boreholes first
      setBoreholes([]);
      
      setTimeout(() => {
        const timestamp = Date.now();
        
        // Create 3 boreholes in triangular pattern with Y positions at or below 0
        // Each material appears in all 3 for proper interpolation
        const boreholeData1 = {
          name: 'Triangle-BH-1',
          x: 0,
          y: 0,      // Ground level
          z: 0,      // North-South position
          type: 'BUILDING',
          layers: [
            { id: 'layer1-' + timestamp, from: 0, to: 2, material: 'CLAY', thickness: 2 },
            { id: 'layer2-' + timestamp, from: 2, to: 5, material: 'SAND', thickness: 3 },
            { id: 'layer3-' + timestamp, from: 5, to: 8, material: 'ROCK', thickness: 3 }
          ]
        };

        const boreholeData2 = {
          name: 'Triangle-BH-2',
          x: 6,      // East position
          y: -3,     // Below ground level
          z: 4,      // North position - DIFFERENT from others
          type: 'BUILDING',
          layers: [
            { id: 'layer4-' + (timestamp + 1), from: 0, to: 3, material: 'CLAY', thickness: 3 },
            { id: 'layer5-' + (timestamp + 1), from: 3, to: 6, material: 'SAND', thickness: 3 },
            { id: 'layer6-' + (timestamp + 1), from: 6, to: 10, material: 'ROCK', thickness: 4 }
          ]
        };

        const boreholeData3 = {
          name: 'Triangle-BH-3',
          x: -4,     // West position
          y: -2,     // Below ground level
          z: -5,     // South position - DIFFERENT from others
          type: 'BUILDING',
          layers: [
            { id: 'layer7-' + (timestamp + 2), from: 0, to: 1, material: 'CLAY', thickness: 1 },
            { id: 'layer8-' + (timestamp + 2), from: 1, to: 4, material: 'SAND', thickness: 3 },
            { id: 'layer9-' + (timestamp + 2), from: 4, to: 9, material: 'ROCK', thickness: 5 }
          ]
        };

        // Add boreholes with delays to ensure unique IDs
        addBorehole(boreholeData1);
        setTimeout(() => addBorehole(boreholeData2), 10);
        setTimeout(() => addBorehole(boreholeData3), 20);

      }, 100);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps

    // Cleanup: Remove global debug functions
    return () => {
      delete window.addTestBoreholeWithLayers;
      delete window.addBorehole;
      delete window.clearAllBoreholes;
      delete window.addTestBoreholeWithWaterTable;
    };
  }, [addTestBoreholeWithLayers, boreholes, addBorehole, clearAllBoreholes]);

  const updateBoreholeDynamic = useCallback((id, updates) => {
    setBoreholes(prev => 
      prev.map(bh => 
        bh.id === id 
          ? { ...bh, ...updates }
          : bh
      )
    );
    
    // Update visual representation (borehole marker only)
    if (sceneManager && visualizerRef.current) {
      // Remove existing visual
      sceneManager.remove(`borehole_${id}`);
      
      // Find the updated borehole data
      const updatedBorehole = boreholes.find(bh => bh.id === id);
      if (updatedBorehole) {
        const newBorehole = { ...updatedBorehole, ...updates };
        
        // Create enhanced marker using the new visualizer
        const enhancedMarker = visualizerRef.current.createEnhancedBoreholeMarker(
          newBorehole,
          { layers: soilLayers },
          showBoreholeStrata,
          showWaterTable,
          textureSettings
        );

        // Add to scene manager
        sceneManager.add(`borehole_${newBorehole.id}`, enhancedMarker);
      }
    }
    
  }, [sceneManager, boreholes, soilLayers, showBoreholeStrata, showWaterTable, textureSettings]);

  const createBoreholeVisual = useCallback((borehole) => {
    if (!sceneManager || !scene || !visualizerRef.current) {
      return;
    }

    // Remove existing visual if it exists
    const existingVisual = sceneManager.get(`borehole_${borehole.id}`);
    if (existingVisual) {
      sceneManager.remove(`borehole_${borehole.id}`);
    }

    // Create enhanced marker using the new visualizer
    const enhancedMarker = visualizerRef.current.createEnhancedBoreholeMarker(
      borehole,
      { layers: soilLayers },
      showBoreholeStrata,
      showWaterTable,
      textureSettings
    );

    // Add to scene manager
    sceneManager.add(`borehole_${borehole.id}`, enhancedMarker);
    
  }, [sceneManager, scene, soilLayers, showBoreholeStrata, showWaterTable, textureSettings]);

  // Camera synchronization validation
  const validateCameraSync = useCallback(() => {
    if (!camera || !renderer) return false;

    const rendererSize = renderer.getSize(new Vector2());
    const expectedAspect = rendererSize.width / rendererSize.height;

    if (Math.abs(camera.aspect - expectedAspect) > 0.01) {
      return false;
    }
    return true;
  }, [camera, renderer]);

  const calculateNormalizedCoordinates = useCallback((event, canvasElement) => {
    const rect = canvasElement.getBoundingClientRect();
    
    // Reuse mouse vector to reduce garbage collection
    const mouse = mouseVectorRef.current;
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    return mouse;
  }, []);

  const addDebugMarker = useCallback((position, color = 0xff0000) => {
    if (!sceneManager) return;
    
    // Remove existing debug marker
    sceneManager.remove('debug_marker');
    
    // Create small debug sphere
    const geometry = new SphereGeometry(0.2, 8, 8);
    const material = new MeshBasicMaterial({ color });
    const marker = new Mesh(geometry, material);
    marker.position.copy(position);
    
    sceneManager.add('debug_marker', marker);
    
    // Remove debug marker after 3 seconds
    const timeoutId = setTimeout(() => {
      sceneManager.remove('debug_marker');
    }, 3000);
    
    // Store timeout for cleanup
    if (!window._debugMarkerTimeouts) window._debugMarkerTimeouts = [];
    window._debugMarkerTimeouts.push(timeoutId);
  }, [sceneManager]);

  const selectBestIntersection = useCallback((intersects) => {
    // Priority order: Site maps > Strata layers > Grid helper > Ground plane
    const priorityOrder = {
      'siteMap': 1,
      'Mesh': 2,      // Strata layers are typically meshes
      'GridHelper': 3,
      'groundPlane': 4
    };
    
    // Enhanced sorting that considers site map children
    const sortedIntersects = intersects.sort((a, b) => {
      // Check if objects are part of site map
      let aIsSiteMapChild = false;
      let bIsSiteMapChild = false;
      
      let parent = a.object.parent;
      while (parent) {
        if (parent === sceneManager?.get('siteMap')) {
          aIsSiteMapChild = true;
          break;
        }
        parent = parent.parent;
      }
      
      parent = b.object.parent;
      while (parent) {
        if (parent === sceneManager?.get('siteMap')) {
          bIsSiteMapChild = true;
          break;
        }
        parent = parent.parent;
      }
      
      // Site map children get highest priority
      const aPriority = aIsSiteMapChild ? 1 : (priorityOrder[a.object.name] || priorityOrder[a.object.type] || 5);
      const bPriority = bIsSiteMapChild ? 1 : (priorityOrder[b.object.name] || priorityOrder[b.object.type] || 5);
      
      // If same priority, sort by distance
      if (aPriority === bPriority) {
        return a.distance - b.distance;
      }
      
      return aPriority - bPriority;
    });
    
    
    return sortedIntersects[0];
  }, [sceneManager]);

  const adjustIntersectionForSurface = useCallback((intersection, point) => {
    const objectType = intersection.object.type;
    const objectName = intersection.object.name || '';
    
    let adjustedPoint = point.clone();
    
    // Check if the intersected object is part of the site map
    let isSiteMapChild = false;
    let parent = intersection.object.parent;
    while (parent) {
      if (parent === sceneManager?.get('siteMap')) {
        isSiteMapChild = true;
        break;
      }
      parent = parent.parent;
    }
    
    if (isSiteMapChild || objectName === 'siteMap') {
      // For site maps and their children, use the actual intersection point
      // This preserves the elevation of 3D terrain
    } else if (objectType === 'GridHelper') {
      // For grid helper, ensure Y=0 positioning
      adjustedPoint.y = 0;
    } else if (objectType === 'Mesh') {
      // For strata layers (mesh objects that aren't site maps)
      // Place borehole at surface level (Y=0) regardless of which layer was clicked
      adjustedPoint.y = 0;
    } else if (objectName === 'groundPlane') {
      // For ground plane, ensure Y=0
      adjustedPoint.y = 0;
    }
    
    return adjustedPoint;
  }, [sceneManager]);

  const verifyBoreholeAccuracy = useCallback((intersectionPoint, createdBorehole) => {
    // Add visual debug marker at intersection point
    addDebugMarker(intersectionPoint, 0xff0000); // Red marker for intersection
    
    // Project 3D point back to screen space
    const screenPoint = intersectionPoint.clone();
    screenPoint.project(camera);


  }, [camera, addDebugMarker]);

  const handleCanvasClick = useCallback((event, canvasElement) => {
    if (!isPlacingBorehole || !canvasElement || !sceneManager || !camera || !scene || !renderer) {
      return;
    }

    // Validate camera synchronization
    if (!validateCameraSync()) {
      return;
    }

    // Calculate normalized coordinates (reuses mouse vector)
    const mouse = calculateNormalizedCoordinates(event, canvasElement);

    raycasterRef.current.setFromCamera(mouse, camera);

    // Temporarily enable all layers for placement raycasting
    const originalLayers = raycasterRef.current.layers.mask;
    raycasterRef.current.layers.enableAll();

    let intersects = [];
    const potentialTargets = [];

    // Performance optimization: Only raycast against placement-relevant objects
    // Get the site map object from the scene manager
    const siteMap = sceneManager?.get('siteMap');
    if (siteMap && siteMap.visible) {
      potentialTargets.push(siteMap);
    }

    // Try to find the ground grid in the scene
    if (scene) {
      const groundGrid = scene.children.find(child => child.type === 'GridHelper');
      if (groundGrid && groundGrid.visible) {
        potentialTargets.push(groundGrid);
      }
    }

    // Reuse or create ground plane for fallback intersection
    if (!tempPlaneRef.current) {
      tempPlaneRef.current = new Mesh(
        new PlaneGeometry(1000, 1000),
        new MeshBasicMaterial({ visible: false })
      );
      tempPlaneRef.current.rotation.x = -Math.PI / 2;
      tempPlaneRef.current.position.y = 0;
      tempPlaneRef.current.name = 'groundPlane';
    }
    
    scene.add(tempPlaneRef.current);
    potentialTargets.push(tempPlaneRef.current);

    // Performance optimization: Use distance culling and limited scope
    if (potentialTargets.length > 0) {
      intersects = raycasterRef.current.intersectObjects(potentialTargets, true);
    }

    // Restore original layer settings
    raycasterRef.current.layers.mask = originalLayers;

    // Clean up temporary ground plane from scene (but keep object for reuse)
    scene.remove(tempPlaneRef.current);


    if (intersects.length > 0) {
      // Smart intersection selection based on surface type
      const selectedIntersection = selectBestIntersection(intersects);
      let intersectionPoint = selectedIntersection.point.clone();
      
      // Adjust position based on object type
      intersectionPoint = adjustIntersectionForSurface(selectedIntersection, intersectionPoint);
      
      // Store intersection data and show modal
      const boreholeData = {
        x: intersectionPoint.x,
        y: intersectionPoint.y,
        z: intersectionPoint.z,
        defaultName: `BH-${boreholes.length + 1}`
      };
      
      setPendingBoreholeData(boreholeData);
      setShowCreationModal(true);
    } else {
      alert('Could not place borehole. Please try clicking on a visible surface.');
    }
    
    setIsPlacingBorehole(false);
  }, [isPlacingBorehole, boreholes.length, sceneManager, camera, scene, renderer, validateCameraSync, calculateNormalizedCoordinates, selectBestIntersection, adjustIntersectionForSurface]);

  const handleBoreholeCreationConfirm = useCallback((boreholeData) => {
    if (!pendingBoreholeData) return;
    
    let createdBorehole;
    
    if (boreholeData.useGlobalLayers) {
      // Default mode: Use the existing addSimpleBorehole system with global soil layers
      // But we need to add the water table data manually since addSimpleBorehole doesn't handle it
      createdBorehole = addSimpleBorehole(
        pendingBoreholeData.x,
        pendingBoreholeData.y,
        pendingBoreholeData.z,
        boreholeData.name,
        boreholeData.depth,
        boreholeData.type,
        boreholeData.color
      );
      
      // Add water table data to the created borehole
      if (createdBorehole && (boreholeData.waterTableEncountered || boreholeData.waterTableDepth)) {

        // Update the borehole in the array with water table data
        setBoreholes(prev => prev.map(bh => 
          bh.id === createdBorehole.id 
            ? { 
                ...bh, 
                waterTableEncountered: boreholeData.waterTableEncountered,
                waterTableDepth: boreholeData.waterTableDepth 
              }
            : bh
        ));
      }
    } else {
      // Advanced mode: Create borehole with custom layer data INCLUDING water table data
      const newBorehole = new Borehole({
        name: boreholeData.name,
        x: pendingBoreholeData.x,
        y: pendingBoreholeData.y,
        z: pendingBoreholeData.z,
        depth: boreholeData.depth,
        totalDepth: boreholeData.totalDepth,
        type: boreholeData.type,
        color: boreholeData.color,
        layers: boreholeData.layers || [],
        // Include water table data
        waterTableEncountered: boreholeData.waterTableEncountered,
        waterTableDepth: boreholeData.waterTableDepth
      }, getSoilLayerById);

      setBoreholes(prev => [...prev, newBorehole]);
      createdBorehole = newBorehole;
    }
    
    // Verify placement accuracy
    const intersectionPoint = new Vector3(
      pendingBoreholeData.x,
      pendingBoreholeData.y,
      pendingBoreholeData.z
    );
    verifyBoreholeAccuracy(intersectionPoint, createdBorehole);
    
    // Clean up
    setShowCreationModal(false);
    setPendingBoreholeData(null);
  }, [pendingBoreholeData, addSimpleBorehole, verifyBoreholeAccuracy, getSoilLayerById]);

  const handleBoreholeCreationCancel = useCallback(() => {
    setShowCreationModal(false);
    setPendingBoreholeData(null);
  }, []);

  // Effect to create visual representations when boreholes are added
  useEffect(() => {
    if (sceneManager && isInitialized && boreholes.length > 0) {
      // Clear existing borehole visuals
      boreholes.forEach(bh => {
        const existingVisual = sceneManager.get(`borehole_${bh.id}`);
        if (!existingVisual) {
          createBoreholeVisual(bh);
        }
      });
    }
  }, [boreholes, sceneManager, isInitialized, createBoreholeVisual]);

  // Remove the old collective borehole rendering system
  useEffect(() => {
    if (sceneManager && isInitialized) {
      // Clean up any old collective borehole group that might exist
      sceneManager.remove('boreholes');
    }
  }, [sceneManager, isInitialized]);

  /**
   * Effect to handle borehole visibility changes
   * Manages both global and individual visibility states
   * Updates both 3D objects and CSS3D labels synchronously
   */
  useEffect(() => {
    if (!sceneManager || !isInitialized || !visualizerRef.current) return;

    boreholes.forEach(borehole => {
      const boreholeVisual = sceneManager.get(`borehole_${borehole.id}`);
      if (boreholeVisual) {
        // Check individual visibility first, then global visibility
        const individualVisible = boreholesIndividualVisibility.get(borehole.id);
        const isIndividuallyVisible = individualVisible !== undefined ? individualVisible : true;
        const finalVisible = showBoreholes && isIndividuallyVisible;
        
        // Handle visibility without animation to maintain strata control
        boreholeVisual.visible = finalVisible;
        
        // Handle strata and water table visibility separately within the borehole
        boreholeVisual.traverse((child) => {
          if (child.userData && child.userData.type === 'borehole_strata') {
            const individualStrataVisible = getBoreholeStrataVisibility(borehole.id);
            child.visible = finalVisible && showBoreholeStrata && individualStrataVisible;
          } else if (child.userData && child.userData.type === 'water_table') {
            // Control water table ring visibility
            child.visible = finalVisible && showWaterTable;
          }
        });
        
        // Also handle CSS3D labels if they exist
        if (sceneManager && sceneManager.css3DObjects) {
          const label = sceneManager.css3DObjects.get(`borehole-pin-label-${borehole.id}`);
          if (label) {
            label.visible = finalVisible;
          }
        }
      }
    });
  }, [boreholes, showBoreholes, boreholesIndividualVisibility, showBoreholeStrata, boreholesStrataVisibility, getBoreholeStrataVisibility, showWaterTable, sceneManager, isInitialized]);

  // Debounced capabilities update to prevent cascade re-renders
  const debouncedUpdateCapabilitiesRef = useRef(null);
  
  useEffect(() => {
    if (updateCapabilities) {
      // Clear previous timeout
      if (debouncedUpdateCapabilitiesRef.current) {
        clearTimeout(debouncedUpdateCapabilitiesRef.current);
      }
      
      // Debounce expensive capabilities update by 150ms
      debouncedUpdateCapabilitiesRef.current = setTimeout(() => {
        updateCapabilities(boreholes);
      }, 150);
    }
    
    // Cleanup timeout on unmount or dependency change
    return () => {
      if (debouncedUpdateCapabilitiesRef.current) {
        clearTimeout(debouncedUpdateCapabilitiesRef.current);
      }
    };
  }, [boreholes, updateCapabilities]);

  // Cleanup visualizer on unmount
  useEffect(() => {
    const currentPool = objectPool.current;
    const currentThrottledMouseMove = throttledMouseMove.current;
    const currentTempPlane = tempPlaneRef.current;
    
    return () => {
      if (visualizerRef.current) {
        visualizerRef.current.dispose();
      }
      
      // Clean up object pool
      if (currentPool) {
        currentPool.vectors.length = 0;
        currentPool.matrices.length = 0;
      }
      
      // Cancel any pending animation frames
      if (currentThrottledMouseMove) {
        cancelAnimationFrame(currentThrottledMouseMove);
      }
      
      // Clean up temporary plane
      if (currentTempPlane) {
        currentTempPlane.geometry.dispose();
        currentTempPlane.material.dispose();
      }
    };
  }, []);


  // Throttled mouse move handler for better performance
  const throttledMouseMove = useRef(null);
  
  // Clear all strata hover effects - defined before handleCanvasMouseMove
  const clearStrataHoverEffects = useCallback(() => {
    if (!scene || !sceneManager) return;
    
    // Performance optimization: Only check borehole strata objects instead of entire scene
    boreholes.forEach(borehole => {
      const strataGroup = sceneManager.get(`borehole_strata_${borehole.id}`);
      if (strataGroup) {
        strataGroup.traverse((child) => {
          if (child.userData && child.userData.type === 'borehole_strata_layer' && child.material) {
            child.material.emissive = new Color(0x000000);
            child.material.emissiveIntensity = 0;
          }
        });
      }
    });
  }, [scene, sceneManager, boreholes]);
  
  // Handle mouse move for hover effects with performance optimization
  const handleCanvasMouseMove = useCallback((event, canvasElement) => {
    if (!camera || !scene || !renderer || !canvasElement) return;
    
    // Performance optimization: Throttle mouse move events to 60fps
    if (throttledMouseMove.current) {
      cancelAnimationFrame(throttledMouseMove.current);
    }
    
    throttledMouseMove.current = requestAnimationFrame(() => {
      // Use requestIdleCallback for non-critical raycasting
      const performHoverRaycast = () => {
        const mouse = calculateNormalizedCoordinates(event, canvasElement);
        raycasterRef.current.setFromCamera(mouse, camera);
        
        // Performance optimization: Only raycast against strata objects, not entire scene
        const originalLayers = raycasterRef.current.layers.mask;
        raycasterRef.current.layers.set(2); // Set to layer 2 for strata hover
        
        // Collect only borehole strata objects for raycasting (much faster than scene.children)
        const strataTargets = [];
        boreholes.forEach(borehole => {
          const strataGroup = sceneManager?.get(`borehole_strata_${borehole.id}`);
          if (strataGroup && strataGroup.visible) {
            strataTargets.push(strataGroup);
          }
        });
        
        // Only raycast if we have strata targets (empty check prevents unnecessary work)
        const intersects = strataTargets.length > 0 
          ? raycasterRef.current.intersectObjects(strataTargets, true)
          : [];
        
        // Restore original layers
        raycasterRef.current.layers.mask = originalLayers;
        
        // Check for strata layer hover
        let foundStrataLayer = false;
        for (const intersect of intersects) {
          if (intersect.object.userData && intersect.object.userData.type === 'borehole_strata_layer') {
            const layerData = intersect.object.userData;
            setHoveredStrataLayer(layerData);
            foundStrataLayer = true;
            
            // Apply hover effect
            if (intersect.object.material) {
              intersect.object.material.emissive = new Color(0x444444);
              intersect.object.material.emissiveIntensity = 0.3;
            }
            break;
          }
        }
        
        if (!foundStrataLayer && hoveredStrataLayer) {
          // Remove hover effect from previous layer
          clearStrataHoverEffects();
          setHoveredStrataLayer(null);
        }
      };
      
      // Use requestIdleCallback for non-critical hover operations
      if (window.requestIdleCallback) {
        window.requestIdleCallback(() => {
          try {
            performHoverRaycast();
          } catch (error) {
          }
        }, { timeout: 16 });
      } else {
        // Fallback for browsers without requestIdleCallback
        setTimeout(() => {
          try {
            performHoverRaycast();
          } catch (error) {
          }
        }, 0);
      }
    });
  }, [camera, scene, renderer, calculateNormalizedCoordinates, hoveredStrataLayer, clearStrataHoverEffects, boreholes, sceneManager]);

  // Memoize context value to prevent unnecessary re-renders
  // Split into stable and dynamic parts for better optimization
  const stableMethods = useMemo(() => ({
    addBorehole,
    updateBorehole,
    deleteBorehole,
    selectBorehole,
    hoverBorehole,
    addSimpleBorehole,
    removeBorehole,
    clearAllBoreholes,
    handleCanvasClick,
    handleCanvasMouseMove,
    createBoreholeVisual,
    updateBoreholeDynamic,
    handleBoreholeCreationConfirm,
    handleBoreholeCreationCancel,
    setIsPlacingBorehole
  }), [
    addBorehole,
    updateBorehole, 
    deleteBorehole,
    selectBorehole,
    hoverBorehole,
    addSimpleBorehole,
    removeBorehole,
    clearAllBoreholes,
    handleCanvasClick,
    handleCanvasMouseMove,
    createBoreholeVisual,
    updateBoreholeDynamic,
    handleBoreholeCreationConfirm,
    handleBoreholeCreationCancel,
    setIsPlacingBorehole
  ]);

  const dynamicState = useMemo(() => ({
    boreholes,
    selectedBorehole,
    hoveredBorehole,
    hoveredStrataLayer,
    isPlacingBorehole,
    showCreationModal,
    pendingBoreholeData
  }), [
    boreholes,
    selectedBorehole,
    hoveredBorehole,
    hoveredStrataLayer,
    isPlacingBorehole,
    showCreationModal,
    pendingBoreholeData
  ]);

  const value = useMemo(() => ({
    ...dynamicState,
    ...stableMethods
  }), [dynamicState, stableMethods]);

  return (
    <BoreholeContext.Provider value={value}>
      {children}
    </BoreholeContext.Provider>
  );
};
