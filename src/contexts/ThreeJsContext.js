import React, { createContext, useState, useEffect, useRef, useCallback, useContext } from 'react';
import { ACESFilmicToneMapping, AmbientLight, Color, DirectionalLight, GridHelper, PCFSoftShadowMap, PerspectiveCamera, SRGBColorSpace, Scene, WebGLRenderer } from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { CSS3DRenderer } from 'three/examples/jsm/renderers/CSS3DRenderer';
import SimpleSceneManager from '../services/SimpleSceneManager';
import { SCALE } from '../utils/scaleConstants';
import { scene3dLogger } from '../utils/Logger.js';

export const ThreeJsContext = createContext();

export const ThreeJsProvider = ({ children }) => {
  const mountRef = useRef(null);
  const animationFrameRef = useRef(null);
  const gridHelperRef = useRef(null);
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
    camera.layers.enableAll(); // Ensure camera sees all layers

    const renderer = new WebGLRenderer({ 
      antialias: true, 
      alpha: true,
      powerPreference: "high-performance", // Performance optimization
      stencil: false, // Disable stencil buffer if not needed
      depth: true
    });
    renderer.setSize(container.clientWidth, container.clientHeight);
    
    // Performance optimization: Limit pixel ratio to 2 for better performance
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = PCFSoftShadowMap;
    renderer.setClearColor(0x000000, 0);
    
    // Performance optimizations
    renderer.outputColorSpace = SRGBColorSpace; // Updated for newer Three.js versions
    renderer.toneMapping = ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1;
    
    // Enable hardware-accelerated culling
    renderer.sortObjects = false; // Disable sorting if not needed
    renderer.info.autoReset = false; // Manual reset for performance monitoring
    
    // Create CSS3D renderer for glassmorphism labels
    const css3DRenderer = new CSS3DRenderer();
    css3DRenderer.setSize(container.clientWidth, container.clientHeight);
    css3DRenderer.domElement.style.position = 'absolute';
    css3DRenderer.domElement.style.top = '0';
    css3DRenderer.domElement.style.pointerEvents = 'none';
    
    // Create CSS3D scene for labels
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
    controls.screenSpacePanning = false;
    controls.minDistance = 5;
    controls.maxDistance = 500;
    controls.maxPolarAngle = Math.PI / 2;
    
    // Performance optimization: Reduce control update frequency
    controls.enableRotate = true;
    controls.enableZoom = true;
    controls.enablePan = true;
    controls.autoRotate = false;
    controls.autoRotateSpeed = 0;
    
    // Performance optimization: Throttle control updates
    controls.addEventListener('change', () => {
      // Only render when controls change, not continuously
      if (renderer && scene && camera) {
        try {
          renderer.render(scene, camera);
          css3DRenderer.render(css3DScene, camera);
        } catch (renderError) {
          // Handle render errors in control change events (same as main render loop)
          if (renderError.message && renderError.message.includes('byteLength')) {
            // Only remove models that are actually corrupted by validating their geometry
            const potentiallyCorruptedModels = scene.children.filter(child => 
              child.name === 'GeologicalModel' || 
              child.userData?.type === 'GeologicalModel'
            );
            
            potentiallyCorruptedModels.forEach(model => {
              let isActuallyCorrupted = false;
              
              // Check if model is actually corrupted by testing its children
              model.traverse((child) => {
                if (child.geometry && child.geometry.attributes) {
                  const position = child.geometry.attributes.position;
                  const index = child.geometry.index;
                  
                  // Check if the arrays are actually corrupted (missing byteLength)
                  if (position && position.array && !position.array.byteLength) {
                    isActuallyCorrupted = true;
                  }
                  if (index && index.array && !index.array.byteLength) {
                    isActuallyCorrupted = true;
                  }
                }
              });
              
              // Only remove if actually corrupted
              if (isActuallyCorrupted) {
                try {
                  scene.remove(model);
                  if (model.geometry) model.geometry.dispose();
                  if (model.material && model.material.dispose) model.material.dispose();
                } catch (disposeError) {
                  // Silent disposal
                }
              }
            });
          }
          // Skip this render frame but continue
        }
      }
    });

    const sceneManager = new SimpleSceneManager(scene, css3DScene);

    const newThreeJs = { scene, camera, renderer, css3DRenderer, css3DScene, controls, sceneManager };
    setThreeJs(newThreeJs);
    setIsInitialized(true);
    
    // Expose scene to window for debugging
    window.threeJsScene = scene;
    window.threeJsCamera = camera;
    window.threeJsRenderer = renderer;
    window.threeJsCSS3DRenderer = css3DRenderer;
    window.threeJsCSS3DScene = css3DScene;
    // window.THREE removed - use specific imports for better tree-shaking

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
      // Update camera and renderer
      threeJs.camera.aspect = width / height;
      threeJs.camera.updateProjectionMatrix();
      threeJs.renderer.setSize(width, height);
      if (threeJs.css3DRenderer) {
        threeJs.css3DRenderer.setSize(width, height);
      }

      // Verify synchronization (size check for debugging if needed)
      // const newRendererSize = threeJs.renderer.getSize(new Vector2());
    }
  }, [threeJs]);

  const updateGlassmorphismLabels = useCallback(() => {
    if (!threeJs.scene || !threeJs.camera) return;
    
    // Traverse the scene to find all glassmorphism labels
    threeJs.scene.traverse((object) => {
      if (object.userData && object.userData.isGlassmorphismLabel) {
        // Sprites automatically face the camera, but we can ensure they maintain proper orientation
        // This is where you could add additional camera-facing logic if needed
        const distance = threeJs.camera.position.distanceTo(object.position);
        const scaleFactor = Math.max(0.5, Math.min(2, distance / 50));
        
        // Scale labels based on camera distance for better visibility
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
    
    // Update glassmorphism labels to face camera
    updateGlassmorphismLabels();
    
    // SAFETY: Try to render, but catch any rendering errors including WebGL feedback loops
    try {
      threeJs.renderer.render(threeJs.scene, threeJs.camera);
    } catch (renderError) {
      // Handle various rendering errors
      if (renderError.message && renderError.message.includes('byteLength')) {
        // Only remove models that are actually corrupted by validating their geometry
        const potentiallyCorruptedModels = threeJs.scene.children.filter(child => 
          child.name === 'GeologicalModel' || 
          child.userData?.type === 'GeologicalModel'
        );
        
        potentiallyCorruptedModels.forEach(model => {
          let isActuallyCorrupted = false;
          
          // Check if model is actually corrupted by testing its children
          model.traverse((child) => {
            if (child.geometry && child.geometry.attributes) {
              const position = child.geometry.attributes.position;
              const index = child.geometry.index;
              
              // Check if the arrays are actually corrupted (missing byteLength)
              if (position && position.array && !position.array.byteLength) {
                isActuallyCorrupted = true;
              }
              if (index && index.array && !index.array.byteLength) {
                isActuallyCorrupted = true;
              }
            }
          });
          
          // Only remove if actually corrupted
          if (isActuallyCorrupted) {
            try {
              threeJs.scene.remove(model);
              if (model.geometry) model.geometry.dispose();
              if (model.material && model.material.dispose) model.material.dispose();
            } catch (disposeError) {
              // Silent disposal
            }
          } else {
          }
        });
      } else if (renderError.message && renderError.message.includes('GL_INVALID_OPERATION')) {
        // Handle WebGL feedback loop or invalid operation errors
        scene3dLogger.warn('WebGL rendering error detected, skipping frame');
      }
      // Skip this render frame but continue animation loop
    }
    
    // TEMPORARY: Skip CSS3D rendering to avoid feedback loop
    // Render CSS3D labels only if main render succeeded
    try {
      if (threeJs.css3DRenderer && threeJs.css3DScene) {
        threeJs.css3DRenderer.render(threeJs.css3DScene, threeJs.camera);
      }
    } catch (css3dError) {
      // Silent skip of CSS3D rendering if it causes issues
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

  // Method to toggle ground grid
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

// Custom hook to use ThreeJs context
export const useThreeJs = () => {
  const context = useContext(ThreeJsContext);
  if (!context) {
    throw new Error('useThreeJs must be used within a ThreeJsProvider');
  }
  return context;
};
