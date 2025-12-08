import React, { createContext, useState, useEffect, useRef, useCallback, useContext } from 'react';
import { ACESFilmicToneMapping, AmbientLight, Box3, Color, DirectionalLight, GridHelper, PCFSoftShadowMap, PerspectiveCamera, SRGBColorSpace, Scene, Vector3, WebGLRenderer } from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { CSS3DRenderer } from 'three/examples/jsm/renderers/CSS3DRenderer';
import SimpleSceneManager from '../services/SimpleSceneManager';
import { SCALE } from '../utils/scaleConstants';
import { scene3dLogger } from '../utils/Logger.js';

export const ThreeJsContext = createContext();

/**
 * Sort geological meshes by distance from camera (back-to-front)
 * This ensures proper alpha blending for transparent layers
 *
 * @param {THREE.Object3D[]} meshes - Array of mesh objects to sort
 * @param {THREE.Camera} camera - The camera to calculate distance from
 */
function sortMeshesByDepth(meshes, camera) {
  if (!meshes || meshes.length === 0 || !camera) return;

  const cameraPosition = new Vector3();
  camera.getWorldPosition(cameraPosition);

  // Calculate centroid distance for each mesh
  const meshDistances = meshes.map(mesh => {
    try {
      const boundingBox = new Box3().setFromObject(mesh);
      const center = boundingBox.getCenter(new Vector3());
      const distance = cameraPosition.distanceTo(center);
      return { mesh, distance };
    } catch {
      return { mesh, distance: 0 };
    }
  });

  // Sort by distance (farthest first = renders first = back-to-front)
  meshDistances.sort((a, b) => b.distance - a.distance);

  // Assign render order based on sorted position
  meshDistances.forEach((item, index) => {
    item.mesh.renderOrder = index;
  });
}

export const ThreeJsProvider = ({ children }) => {
  const mountRef = useRef(null);
  const animationFrameRef = useRef(null);
  const gridHelperRef = useRef(null);
  const keyboardHandlersRef = useRef(null); // Store keyboard handlers for cleanup
  const lastCameraPositionRef = useRef(new Vector3()); // Track camera movement for throttled sorting
  const sortThrottleRef = useRef(0); // Frame counter for throttling
  const [threeJs, setThreeJs] = useState({
    scene: null,
    camera: null,
    renderer: null,
    css3DRenderer: null,
    css3DScene: null,
    controls: null,
    sceneManager: null,
  });
  const [isInitialized, setIsInitialized] = useState(false);

  const initializeThreeJs = useCallback((container) => {
    if (!container || isInitialized) return;

    const scene = new Scene();
    scene.background = new Color(0x1a1a1a);

    const camera = new PerspectiveCamera(
      75,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    );
    camera.position.set(SCALE.CAMERA_DISTANCE * 0.4, SCALE.CAMERA_HEIGHT, SCALE.CAMERA_DISTANCE * 0.6);
    camera.lookAt(0, 0, 0);
    camera.layers.enableAll();

    const renderer = new WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
      stencil: false,
      depth: true
    });
    renderer.setSize(container.clientWidth, container.clientHeight);

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = PCFSoftShadowMap;
    renderer.setClearColor(0x000000, 0);

    renderer.outputColorSpace = SRGBColorSpace;
    renderer.toneMapping = ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1;

    renderer.sortObjects = false;
    renderer.info.autoReset = false;

    const css3DRenderer = new CSS3DRenderer();
    css3DRenderer.setSize(container.clientWidth, container.clientHeight);
    css3DRenderer.domElement.style.position = 'absolute';
    css3DRenderer.domElement.style.top = '0';
    css3DRenderer.domElement.style.pointerEvents = 'none';

    const css3DScene = new Scene();
    
    container.appendChild(renderer.domElement);
    container.appendChild(css3DRenderer.domElement);

    const ambientLight = new AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    
    const directionalLight = new DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(50, 50, 50);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    scene.add(directionalLight);

    const gridHelper = new GridHelper(SCALE.SITE_SIZE, SCALE.GRID_DIVISIONS);
    gridHelperRef.current = gridHelper;
    scene.add(gridHelper);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.screenSpacePanning = true; // Enable screen-space panning for vertical movement
    controls.minDistance = 5;
    controls.maxDistance = 500;
    controls.maxPolarAngle = Math.PI / 2;

    // Vertical movement speed for keyboard controls
    const verticalMoveSpeed = 5;

    controls.enableRotate = true;
    controls.enableZoom = true;
    controls.enablePan = true;
    controls.autoRotate = false;
    controls.autoRotateSpeed = 0;

    // Keyboard controls for vertical movement (Q = down, E = up)
    const handleKeyDown = (event) => {
      // Skip if user is typing in an input field
      if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
        return;
      }

      const key = event.key.toLowerCase();

      if (key === 'q' || key === 'e') {
        event.preventDefault();
        const direction = key === 'e' ? 1 : -1; // E = up, Q = down
        const moveAmount = verticalMoveSpeed * direction;

        // Move camera position
        camera.position.y += moveAmount;

        // Move the controls target (orbit center) to maintain relative position
        controls.target.y += moveAmount;

        // Trigger update
        controls.update();
      }

      // Page Up / Page Down for larger vertical movements
      if (event.key === 'PageUp' || event.key === 'PageDown') {
        event.preventDefault();
        const direction = event.key === 'PageUp' ? 1 : -1;
        const moveAmount = verticalMoveSpeed * 3 * direction; // 3x faster for Page keys

        camera.position.y += moveAmount;
        controls.target.y += moveAmount;
        controls.update();
      }
    };

    // Shift + Scroll for vertical movement
    const handleWheel = (event) => {
      if (event.shiftKey) {
        event.preventDefault();
        event.stopPropagation();

        // Scroll direction: up = negative deltaY = move camera up
        const direction = event.deltaY > 0 ? -1 : 1;
        const moveAmount = verticalMoveSpeed * direction;

        camera.position.y += moveAmount;
        controls.target.y += moveAmount;
        controls.update();
      }
    };

    // Add event listeners
    window.addEventListener('keydown', handleKeyDown);
    renderer.domElement.addEventListener('wheel', handleWheel, { passive: false });

    // Store handlers for cleanup
    keyboardHandlersRef.current = {
      handleKeyDown,
      handleWheel,
      rendererElement: renderer.domElement
    };

    controls.addEventListener('change', () => {
      if (renderer && scene && camera) {
        try {
          renderer.render(scene, camera);
          css3DRenderer.render(css3DScene, camera);
        } catch (renderError) {
          if (renderError.message && renderError.message.includes('byteLength')) {
            const potentiallyCorruptedModels = scene.children.filter(child => 
              child.name === 'GeologicalModel' || 
              child.userData?.type === 'GeologicalModel'
            );
            
            potentiallyCorruptedModels.forEach(model => {
              let isActuallyCorrupted = false;

              model.traverse((child) => {
                if (child.geometry && child.geometry.attributes) {
                  const position = child.geometry.attributes.position;
                  const index = child.geometry.index;

                  if (position && position.array && !position.array.byteLength) {
                    isActuallyCorrupted = true;
                  }
                  if (index && index.array && !index.array.byteLength) {
                    isActuallyCorrupted = true;
                  }
                }
              });

              if (isActuallyCorrupted) {
                try {
                  scene.remove(model);
                  if (model.geometry) model.geometry.dispose();
                  if (model.material && model.material.dispose) model.material.dispose();
                } catch (disposeError) {
                }
              }
            });
          }
        }
      }
    });

    const sceneManager = new SimpleSceneManager(scene, css3DScene);

    const newThreeJs = { scene, camera, renderer, css3DRenderer, css3DScene, controls, sceneManager };
    setThreeJs(newThreeJs);
    setIsInitialized(true);

    window.threeJsScene = scene;
    window.threeJsCamera = camera;
    window.threeJsRenderer = renderer;
    window.threeJsCSS3DRenderer = css3DRenderer;
    window.threeJsCSS3DScene = css3DScene;

    return newThreeJs;
  }, [isInitialized]);

  const canvasMountRef = useCallback((node) => {
    if (node && !mountRef.current) {
      mountRef.current = node;
      initializeThreeJs(node);
    }
  }, [initializeThreeJs]);

  const handleResize = useCallback(() => {
    if (!mountRef.current || !threeJs.renderer || !threeJs.camera) return;

    const container = mountRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    if (width > 0 && height > 0) {
      threeJs.camera.aspect = width / height;
      threeJs.camera.updateProjectionMatrix();
      threeJs.renderer.setSize(width, height);
      if (threeJs.css3DRenderer) {
        threeJs.css3DRenderer.setSize(width, height);
      }
    }
  }, [threeJs]);

  const updateGlassmorphismLabels = useCallback(() => {
    if (!threeJs.scene || !threeJs.camera) return;

    threeJs.scene.traverse((object) => {
      if (object.userData && object.userData.isGlassmorphismLabel) {
        const distance = threeJs.camera.position.distanceTo(object.position);
        const scaleFactor = Math.max(0.5, Math.min(2, distance / 50));

        if (object.userData.originalScale) {
          object.scale.set(
            object.userData.originalScale.x * scaleFactor,
            object.userData.originalScale.y * scaleFactor,
            object.userData.originalScale.z
          );
        }
      }
    });
  }, [threeJs.scene, threeJs.camera]);

  const animate = useCallback(() => {
    if (!isInitialized || !threeJs.renderer || !threeJs.scene || !threeJs.camera) {
      return;
    }

    animationFrameRef.current = requestAnimationFrame(animate);

    if (threeJs.controls) {
      threeJs.controls.update();
    }

    updateGlassmorphismLabels();

    // Manual render order sorting for transparent geological meshes
    // Throttled: only sort every 5 frames OR when camera moves significantly
    sortThrottleRef.current++;
    const shouldSort = sortThrottleRef.current >= 5;

    if (shouldSort) {
      sortThrottleRef.current = 0;

      // Check if camera has moved enough to warrant re-sorting
      const currentCameraPos = threeJs.camera.position;
      const distanceMoved = lastCameraPositionRef.current.distanceTo(currentCameraPos);

      if (distanceMoved > 0.5) { // Only re-sort if moved > 0.5 units
        lastCameraPositionRef.current.copy(currentCameraPos);

        // Find the VolumetricGeologicalModel group and sort its children
        const geologicalModel = threeJs.scene.getObjectByName('VolumetricGeologicalModel');
        if (geologicalModel && geologicalModel.children && geologicalModel.children.length > 0) {
          // Filter to only meshes with materials (actual geological layers)
          const transparentMeshes = geologicalModel.children.filter(
            child => child.isMesh && child.material && child.material.transparent
          );
          if (transparentMeshes.length > 0) {
            sortMeshesByDepth(transparentMeshes, threeJs.camera);
          }
        }
      }
    }

    try {
      threeJs.renderer.render(threeJs.scene, threeJs.camera);
    } catch (renderError) {
      if (renderError.message && renderError.message.includes('byteLength')) {
        const potentiallyCorruptedModels = threeJs.scene.children.filter(child => 
          child.name === 'GeologicalModel' || 
          child.userData?.type === 'GeologicalModel'
        );
        
        potentiallyCorruptedModels.forEach(model => {
          let isActuallyCorrupted = false;

          model.traverse((child) => {
            if (child.geometry && child.geometry.attributes) {
              const position = child.geometry.attributes.position;
              const index = child.geometry.index;

              if (position && position.array && !position.array.byteLength) {
                isActuallyCorrupted = true;
              }
              if (index && index.array && !index.array.byteLength) {
                isActuallyCorrupted = true;
              }
            }
          });

          if (isActuallyCorrupted) {
            try {
              threeJs.scene.remove(model);
              if (model.geometry) model.geometry.dispose();
              if (model.material && model.material.dispose) model.material.dispose();
            } catch (disposeError) {
            }
          } else {
          }
        });
      } else if (renderError.message && renderError.message.includes('GL_INVALID_OPERATION')) {
        scene3dLogger.warn('WebGL rendering error detected, skipping frame');
      }
    }

    try {
      if (threeJs.css3DRenderer && threeJs.css3DScene) {
        threeJs.css3DRenderer.render(threeJs.css3DScene, threeJs.camera);
      }
    } catch (css3dError) {
    }
  }, [isInitialized, threeJs, updateGlassmorphismLabels]);

  useEffect(() => {
    if (isInitialized) {
      animate();
      window.addEventListener('resize', handleResize);
      
      return () => {
        window.removeEventListener('resize', handleResize);
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
      };
    }
  }, [isInitialized, animate, handleResize]);

  const toggleGroundGrid = useCallback((show) => {
    if (threeJs.scene && gridHelperRef.current) {
      if (show) {
        if (!threeJs.scene.children.includes(gridHelperRef.current)) {
          threeJs.scene.add(gridHelperRef.current);
        }
      } else {
        if (threeJs.scene.children.includes(gridHelperRef.current)) {
          threeJs.scene.remove(gridHelperRef.current);
        }
      }
    }
  }, [threeJs.scene]);

  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }

      // Clean up keyboard and wheel event handlers
      if (keyboardHandlersRef.current) {
        window.removeEventListener('keydown', keyboardHandlersRef.current.handleKeyDown);
        if (keyboardHandlersRef.current.rendererElement) {
          keyboardHandlersRef.current.rendererElement.removeEventListener(
            'wheel',
            keyboardHandlersRef.current.handleWheel
          );
        }
        keyboardHandlersRef.current = null;
      }

      if (threeJs.controls) {
        threeJs.controls.dispose();
      }

      if (threeJs.renderer) {
        threeJs.renderer.dispose();
        if (mountRef.current && mountRef.current.contains(threeJs.renderer.domElement)) {
          mountRef.current.removeChild(threeJs.renderer.domElement);
        }
      }

      if (threeJs.css3DRenderer) {
        if (mountRef.current && mountRef.current.contains(threeJs.css3DRenderer.domElement)) {
          mountRef.current.removeChild(threeJs.css3DRenderer.domElement);
        }
      }
    };
  }, [threeJs.controls, threeJs.renderer, threeJs.css3DRenderer]);

  const value = { ...threeJs, canvasMountRef, isInitialized, toggleGroundGrid, handleResize };

  return (
    <ThreeJsContext.Provider value={value}>
      {children}
    </ThreeJsContext.Provider>
  );
};

export const useThreeJs = () => {
  const context = useContext(ThreeJsContext);
  if (!context) {
    throw new Error('useThreeJs must be used within a ThreeJsProvider');
  }
  return context;
};
