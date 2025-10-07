/**
 * Optimized Three.js imports to reduce bundle size
 * Only import what we actually use to enable better tree shaking
 */

// Core Three.js classes - import only what we need
export { 
  Scene,
  PerspectiveCamera,
  WebGLRenderer,
  Group,
  Mesh,
  BufferGeometry,
  BufferAttribute,
  Material,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Color,
  Vector3,
  Box3,
  
  // Lights - only what we use
  AmbientLight,
  DirectionalLight,
  
  // Helpers - only GridHelper
  GridHelper,
  
  // Constants - only essential ones
  DoubleSide,
  SRGBColorSpace,
  ACESFilmicToneMapping,
  PCFSoftShadowMap
} from 'three';

// Geometry classes - specific imports
export {
  BoxGeometry,
  CylinderGeometry,
  SphereGeometry,
  PlaneGeometry
} from 'three/src/geometries/geometries.js';

// Controls - lazy load to reduce initial bundle
export const OrbitControls = () => import('three/examples/jsm/controls/OrbitControls.js')
  .then(module => module.OrbitControls);

// CSS3DRenderer - lazy load since it's only used in specific scenarios  
export const CSS3DRenderer = () => import('three/examples/jsm/renderers/CSS3DRenderer.js')
  .then(module => module.CSS3DRenderer);

// GLTF Loader - lazy load since it's only used for imports
export const GLTFLoader = () => import('three/examples/jsm/loaders/GLTFLoader.js')
  .then(module => module.GLTFLoader);

// DRACO Loader - lazy load since it's optional
export const DRACOLoader = () => import('three/examples/jsm/loaders/DRACOLoader.js')
  .then(module => module.DRACOLoader);

/**
 * Performance-optimized Three.js setup function
 * Loads only required components asynchronously
 */
export const loadThreeJsComponents = async () => {
  const [controls, css3d, gltf] = await Promise.all([
    OrbitControls(),
    CSS3DRenderer(), 
    GLTFLoader()
  ]);
  
  return {
    OrbitControls: controls,
    CSS3DRenderer: css3d,
    GLTFLoader: gltf
  };
};

/**
 * Create optimized material instances with minimal Three.js footprint
 */
export const createOptimizedMaterial = (options = {}) => {
  const {
    color = 0xffffff,
    transparent = false,
    opacity = 1,
    side = undefined
  } = options;
  
  // Use MeshBasicMaterial for simple cases to reduce shader compilation
  if (!options.needsLighting) {
    return new MeshBasicMaterial({
      color,
      transparent,
      opacity,
      side
    });
  }
  
  return new MeshStandardMaterial({
    color,
    transparent,
    opacity,
    side
  });
};