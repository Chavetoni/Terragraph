import React, { createContext, useContext, useState, useCallback } from 'react';
import { ThreeJsContext } from './ThreeJsContext';
import { MathUtils, Mesh, MeshBasicMaterial, PlaneGeometry, TextureLoader } from 'three';
import { validationLogger } from '../utils/Logger.js';

const SiteMapContext = createContext();

export const useSiteMap = () => {
  const context = useContext(SiteMapContext);
  if (!context) {
    throw new Error('useSiteMap must be used within a SiteMapProvider');
  }
  return context;
};

export const SiteMapProvider = ({ children }) => {
  const { sceneManager } = useContext(ThreeJsContext);
  const [mapData, setMapData] = useState(null);
  const [mapObject, setMapObject] = useState(null);
  const [mapFileName, setMapFileName] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [siteMapProps, setSiteMapProps] = useState({
    position: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
    rotation: { x: 0, y: 0, z: 0 },
    visible: true,
    opacity: 1.0
  });


  const loadSiteMap = useCallback(async (mapConfig) => {
    if (!sceneManager) return;
    setIsLoading(true);
    setError(null);

    try {
      if (mapConfig.isGLTF) {
        // Handle GLTF/GLB files with DRACO compression support
        const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader');
        const { DRACOLoader } = await import('three/examples/jsm/loaders/DRACOLoader');
        
        const loader = new GLTFLoader();
        
        // Configure DRACO loader for compressed geometries
        const dracoLoader = new DRACOLoader();
        dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
        dracoLoader.setDecoderConfig({ type: 'js' });
        loader.setDRACOLoader(dracoLoader);
        
        const gltf = await new Promise((resolve, reject) => {
          loader.load(
            mapConfig.url, 
            resolve, 
            undefined, 
            (error) => {
              // Cleanup DRACO loader on error
              dracoLoader.dispose();
              reject(error);
            }
          );
        });
        
        // Cleanup DRACO loader after successful use
        dracoLoader.dispose();
        
        const model = gltf.scene;
        model.position.set(0, 0, 0);
        model.scale.set(1, 1, 1);
        
        // Disable shadows on site map to prevent interference with strata visibility
        model.traverse((object) => {
          if (object.isMesh) {
            object.castShadow = false;
            object.receiveShadow = false;
          }
        });
        
        sceneManager.add('siteMap', model);
        setMapObject(model);
        setMapData(mapConfig);
      } else {
        // Handle image files as textures
        const textureLoader = new TextureLoader();
        const texture = await new Promise((resolve, reject) => {
          textureLoader.load(mapConfig.url, resolve, undefined, reject);
        });
        const aspectRatio = texture.image.width / texture.image.height;
        const size = mapConfig.size || 100;
        const planeWidth = size;
        const planeHeight = size / aspectRatio;

        const planeGeometry = new PlaneGeometry(planeWidth, planeHeight);
        const planeMaterial = new MeshBasicMaterial({ map: texture, transparent: true });
        const plane = new Mesh(planeGeometry, planeMaterial);

        plane.rotation.x = -Math.PI / 2;
        plane.position.y = mapConfig.positionY || 0;
        
        // Disable shadows on image plane to prevent interference with strata visibility
        plane.castShadow = false;
        plane.receiveShadow = false;
        
        sceneManager.add('siteMap', plane);
        setMapObject(plane);
        setMapData(mapConfig);
      }
    } catch (err) {
      validationLogger.error("Error loading site map:", err);
      setError("Failed to load site map. Please check the URL and file format.");
    } finally {
      setIsLoading(false);
    }
  }, [sceneManager]);

  const removeSiteMap = useCallback(() => {
    if (sceneManager && mapObject) {
      sceneManager.remove('siteMap');
      setMapObject(null);
      setMapData(null);
      setMapFileName(null);
    }
  }, [sceneManager, mapObject]);

  const handleFileChange = useCallback((event, callbacks) => {
    const file = event.target.files[0];
    if (!file) return;

    setIsLoading(true);
    setError(null);
    setMapFileName(file.name);

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const arrayBuffer = e.target.result;
        const blob = new Blob([arrayBuffer]);
        const url = URL.createObjectURL(blob);
        
        const isGLTF = file.name.toLowerCase().endsWith('.glb') || file.name.toLowerCase().endsWith('.gltf');
        
        await loadSiteMap({ url, size: 100, isGLTF });
        
        if (callbacks?.onSuccess) callbacks.onSuccess();
      } catch (error) {
        validationLogger.error('Error loading map:', error);
        setError(error.message || 'Failed to load map');
        setMapFileName(null);
        if (callbacks?.onError) callbacks.onError(error.message || 'Failed to load map');
      }
    };
    
    reader.onerror = () => {
      const errorMsg = 'Failed to read file';
      setError(errorMsg);
      setMapFileName(null);
      if (callbacks?.onError) callbacks.onError(errorMsg);
    };
    
    reader.readAsArrayBuffer(file);
  }, [loadSiteMap]);

  const handleMapPropChange = useCallback((propType, axis, value) => {
    setSiteMapProps(prev => {
      const newProps = { ...prev };
      
      if (axis) {
        newProps[propType] = { ...prev[propType], [axis]: parseFloat(value) || 0 };
      } else {
        newProps[propType] = propType === 'visible' ? value : parseFloat(value) || 0;
      }
      
      return newProps;
    });
    
    // Apply changes to the map object if it exists
    if (mapObject) {
      if (propType === 'position' && axis) {
        mapObject.position[axis] = parseFloat(value) || 0;
      } else if (propType === 'scale' && axis) {
        mapObject.scale[axis] = parseFloat(value) || 1;
      } else if (propType === 'rotation' && axis) {
        mapObject.rotation[axis] = MathUtils.degToRad(parseFloat(value) || 0);
      } else if (propType === 'visible') {
        mapObject.visible = value;
      } else if (propType === 'opacity') {
        mapObject.traverse((child) => {
          if (child.material) {
            child.material.transparent = value < 1.0;
            child.material.opacity = value;
            child.material.needsUpdate = true;
          }
        });
      }
    }
  }, [mapObject]);

  const handleRemoveMap = useCallback(() => {
    removeSiteMap();
    setSiteMapProps({
      position: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
      rotation: { x: 0, y: 0, z: 0 },
      visible: true,
      opacity: 1.0
    });
  }, [removeSiteMap]);

  const handleQuickRotation = useCallback((action) => {
    if (!mapObject) return;
    
    switch (action) {
      case 'makeFlat':
        mapObject.rotation.set(-Math.PI / 2, 0, 0);
        setSiteMapProps(prev => ({
          ...prev,
          rotation: { x: -90, y: 0, z: 0 }
        }));
        break;
      case 'rotate90Y':
        mapObject.rotation.set(0, 0, 0);
        setSiteMapProps(prev => ({
          ...prev,
          rotation: { x: 0, y: 0, z: 0 }
        }));
        break;
      default:
        break;
    }
  }, [mapObject]);

  const toggleSiteMapVisibility = useCallback((visible) => {
    if (mapObject) {
      mapObject.visible = visible;
    }
  }, [mapObject]);

  const value = {
    mapData,
    mapObject,
    mapFileName,
    siteMapProps,
    error,
    isLoading,
    loadSiteMap,
    removeSiteMap,
    toggleSiteMapVisibility,
    handleFileChange,
    handleMapPropChange,
    handleRemoveMap,
    handleQuickRotation
  };

  return (
    <SiteMapContext.Provider value={value}>
      {children}
    </SiteMapContext.Provider>
  );
};