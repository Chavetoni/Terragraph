// // src/hooks/useThreeJsScene.js
// import { useRef, useState, useEffect, useCallback } from 'react';
// import { AmbientLight, Color, DirectionalLight, Fog, PerspectiveCamera, Scene, WebGLRenderer } from 'three';
// import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
// import { GROUND_GRID_SIZE } from '../utils/constants';

// export const useThreeJsScene = (containerRef) => {
//   const sceneRef = useRef(null);
//   const cameraRef = useRef(null);
//   const rendererRef = useRef(null);
//   const controlsRef = useRef(null);
//   const animationFrameId = useRef(null);
//   const [isInitialized, setIsInitialized] = useState(false);

//   const initializeScene = useCallback(() => {
//     if (!containerRef.current) return false;

//     // Create scene
//     const scene = new Scene();
//     const backgroundColor = 0xd1d5db;
//     scene.background = new Color(backgroundColor);
    
//     // Add fog for distance culling
//     const fogNear = GROUND_GRID_SIZE * 0.75;
//     const fogFar = GROUND_GRID_SIZE * 2.5;
//     scene.fog = new Fog(backgroundColor, fogNear, fogFar);
    
//     sceneRef.current = scene;

//     // Create camera
//     const aspect = containerRef.current.clientWidth / containerRef.current.clientHeight;
//     const camera = new PerspectiveCamera(60, aspect, 0.1, GROUND_GRID_SIZE * 5);
//     camera.position.set(GROUND_GRID_SIZE / 3, GROUND_GRID_SIZE / 4, GROUND_GRID_SIZE / 3);
//     cameraRef.current = camera;

//     // Create renderer
//     const renderer = new WebGLRenderer({ antialias: true });
//     renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
//     renderer.setPixelRatio(window.devicePixelRatio);
//     renderer.autoClear = true;
    
//     // Clear container and add renderer
//     while (containerRef.current.firstChild) {
//       containerRef.current.removeChild(containerRef.current.firstChild);
//     }
//     containerRef.current.appendChild(renderer.domElement);
//     rendererRef.current = renderer;

//     // Add lighting
//     addLighting(scene);

//     // Add controls
//     const controls = new OrbitControls(camera, renderer.domElement);
//     controls.enableDamping = true;
//     controls.dampingFactor = 0.05;
//     controls.minDistance = 1;
//     controls.maxDistance = GROUND_GRID_SIZE * 2;
//     controls.target.set(0, 0, 0);
//     controls.panSpeed = 1.5;
//     controls.update();
//     controlsRef.current = controls;

//     setIsInitialized(true);
//     return true;
//   }, [containerRef]);

//   const addLighting = useCallback((scene) => {
//     const ambientLight = new AmbientLight(0xffffff, 0.8);
//     scene.add(ambientLight);
    
//     const directionalLight = new DirectionalLight(0xffffff, 1.2);
//     directionalLight.position.set(
//       GROUND_GRID_SIZE / 2,
//       GROUND_GRID_SIZE / 1.5,
//       GROUND_GRID_SIZE / 2
//     );
//     scene.add(directionalLight);
    
//     const backLight = new DirectionalLight(0xffffff, 0.6);
//     backLight.position.set(
//       -GROUND_GRID_SIZE / 2,
//       GROUND_GRID_SIZE / 3,
//       -GROUND_GRID_SIZE / 2
//     );
//     scene.add(backLight);
//   }, []);

//   const handleResize = useCallback(() => {
//     if (!containerRef.current || !rendererRef.current || !cameraRef.current) return;
    
//     const width = containerRef.current.clientWidth;
//     const height = containerRef.current.clientHeight;
    
//     if (width > 0 && height > 0) {
//       cameraRef.current.aspect = width / height;
//       cameraRef.current.updateProjectionMatrix();
//       rendererRef.current.setSize(width, height);
//     }
//   }, [containerRef]);

//   const animate = useCallback(() => {
//     animationFrameId.current = requestAnimationFrame(animate);
    
//     if (controlsRef.current) {
//       controlsRef.current.update();
//     }
    
//     if (rendererRef.current && sceneRef.current && cameraRef.current) {
//       rendererRef.current.render(sceneRef.current, cameraRef.current);
//     }
//   }, []);

//   const disposeObject = useCallback((object) => {
//     if (!object) return;
    
//     if (object.geometry) {
//       object.geometry.dispose();
//     }
    
//     if (object.material) {
//       if (Array.isArray(object.material)) {
//         object.material.forEach(material => {
//           if (material.map) material.map.dispose();
//           if (material.dispose) material.dispose();
//         });
//       } else {
//         if (object.material.map) object.material.map.dispose();
//         if (object.material.dispose) object.material.dispose();
//       }
//     }
    
//     while (object.children.length > 0) {
//       disposeObject(object.children[0]);
//       object.remove(object.children[0]);
//     }
//   }, []);

//   const cleanup = useCallback(() => {
//     if (animationFrameId.current) {
//       cancelAnimationFrame(animationFrameId.current);
//     }
    
//     if (controlsRef.current) {
//       controlsRef.current.dispose();
//       controlsRef.current = null;
//     }
    
//     if (sceneRef.current) {
//       while (sceneRef.current.children.length > 0) {
//         const object = sceneRef.current.children[0];
//         disposeObject(object);
//         sceneRef.current.remove(object);
//       }
      
//       sceneRef.current.fog = null;
//       sceneRef.current = null;
//     }
    
//     if (rendererRef.current) {
//       if (containerRef.current?.contains(rendererRef.current.domElement)) {
//         containerRef.current.removeChild(rendererRef.current.domElement);
//       }
//       rendererRef.current.dispose();
//       rendererRef.current = null;
//     }
    
//     cameraRef.current = null;
//     setIsInitialized(false);
//   }, [containerRef, disposeObject]);

//   // Initialize scene on mount
//   useEffect(() => {
//     const initialized = initializeScene();
    
//     if (initialized) {
//       animate();
//       window.addEventListener('resize', handleResize);
//     }
    
//     return () => {
//       window.removeEventListener('resize', handleResize);
//       cleanup();
//     };
//   }, [initializeScene, animate, handleResize, cleanup]);

//   return {
//     scene: sceneRef.current,
//     camera: cameraRef.current,
//     renderer: rendererRef.current,
//     controls: controlsRef.current,
//     isInitialized,
//     initializeScene,
//     handleResize,
//     disposeObject,
//     cleanup
//   };
// };

// export default useThreeJsScene;