/**
 * Optimization Configuration
 * Central configuration for all performance optimizations
 */

// Performance thresholds
export const PERFORMANCE_THRESHOLDS = {
  targetFPS: 60,
  minFPS: 30,
  maxRenderTime: 16.67, // ms for 60 FPS
  maxMemoryUsage: 500, // MB
  maxDrawCalls: 1000,
  maxTriangles: 1000000
};

// Caching configuration
export const CACHE_CONFIG = {
  interpolation: {
    enabled: true,
    maxSize: 1000,
    ttl: 300000 // 5 minutes
  },
  geometry: {
    enabled: true,
    maxPoolSize: 100
  },
  material: {
    enabled: true,
    maxCacheSize: 100
  },
  texture: {
    enabled: true,
    atlasSize: 2048
  }
};

// Memory management configuration
export const MEMORY_CONFIG = {
  monitoring: {
    enabled: true,
    interval: 5000, // ms
    threshold: 500 * 1024 * 1024 // 500MB
  },
  pooling: {
    enabled: true,
    geometryPoolSize: 50,
    materialPoolSize: 50,
    meshPoolSize: 100
  },
  disposal: {
    aggressive: true,
    disposeOnUnmount: true,
    disposeTimeout: 1000 // ms
  }
};

// Rendering optimization configuration
export const RENDER_CONFIG = {
  adaptiveQuality: {
    enabled: true,
    autoAdjust: true,
    adjustmentThreshold: 5, // frames
    levels: ['ultra', 'high', 'medium', 'low', 'potato']
  },
  instancing: {
    enabled: true,
    threshold: 50 // Use instancing for >50 similar objects
  },
  frustumCulling: {
    enabled: true,
    aggressive: false
  },
  levelOfDetail: {
    enabled: true,
    distances: [50, 100, 200, 500] // feet
  },
  shadows: {
    enabled: true,
    quality: 'medium',
    autoAdjust: true
  }
};

// React optimization configuration
export const REACT_CONFIG = {
  memo: {
    enabled: true,
    deepComparison: false
  },
  lazy: {
    enabled: true,
    suspenseDelay: 200 // ms
  },
  virtualScrolling: {
    enabled: true,
    itemHeight: 50,
    overscan: 5
  },
  debouncing: {
    enabled: true,
    inputDelay: 300, // ms
    scrollDelay: 100 // ms
  }
};

// Three.js specific optimizations
export const THREEJS_CONFIG = {
  renderer: {
    antialias: true,
    powerPreference: 'high-performance',
    stencil: false,
    depth: true,
    logarithmicDepthBuffer: false,
    physicallyCorrectLights: true,
    outputEncoding: 'sRGB',
    toneMapping: 'ACESFilmic',
    shadowMap: {
      enabled: true,
      type: 'PCFSoft',
      autoUpdate: true
    }
  },
  scene: {
    fog: {
      enabled: true,
      near: 100,
      far: 1000
    },
    environment: {
      enabled: false // Disable for performance
    }
  },
  camera: {
    near: 0.1,
    far: 10000,
    fov: 75
  },
  lights: {
    ambient: {
      enabled: true,
      intensity: 0.4
    },
    directional: {
      enabled: true,
      intensity: 0.6,
      castShadow: true,
      shadowMapSize: 1024
    }
  }
};

// Geological modeling optimizations
export const GEOLOGICAL_CONFIG = {
  interpolation: {
    useKDTree: true,
    maxNearbyBoreholes: 10,
    spatialGridSize: 50, // feet
    batchProcessing: true,
    batchSize: 32
  },
  meshing: {
    usePooledGeometry: true,
    mergeGeometries: true,
    mergeThreshold: 10, // Merge if >10 layers
    optimizeMesh: true,
    simplifyThreshold: 0.1
  },
  textures: {
    useAtlas: true,
    atlasSize: 2048,
    compressionEnabled: true,
    mipmaps: true
  },
  volumetric: {
    adaptiveResolution: true,
    minResolution: 10,
    maxResolution: 50,
    autoResolution: true
  }
};

// WebWorker configuration for heavy computations
export const WORKER_CONFIG = {
  enabled: false, // Enable when workers are implemented
  interpolation: {
    enabled: true,
    workerCount: navigator.hardwareConcurrency || 4
  },
  meshing: {
    enabled: true,
    workerCount: 2
  }
};

// Development/Production specific settings
const isDevelopment = process.env.NODE_ENV === 'development';

export const ENV_CONFIG = {
  debug: {
    enabled: isDevelopment,
    showStats: isDevelopment,
    logPerformance: isDevelopment,
    verboseLogging: false
  },
  optimization: {
    minify: !isDevelopment,
    compress: !isDevelopment,
    treeshake: !isDevelopment,
    sourceMaps: isDevelopment
  }
};

// Feature flags for gradual rollout
export const FEATURE_FLAGS = {
  useOptimizedVolumetricMesh: true,
  useOptimizedSpatialInterpolation: true,
  useOptimizedSceneManager: true,
  useCompoundProviders: true,
  useMemoryMonitoring: true,
  usePerformanceMonitoring: true,
  useAdaptiveQuality: true,
  useInstancedRendering: true,
  useTextureAtlas: false, // Disabled until fully tested
  useWebWorkers: false // Disabled until implemented
};

// Export helper function to get all active optimizations
export function getActiveOptimizations() {
  const active = [];
  
  Object.entries(FEATURE_FLAGS).forEach(([key, value]) => {
    if (value) {
      active.push(key);
    }
  });
  
  return active;
}

// Export helper to check if an optimization is enabled
export function isOptimizationEnabled(optimization) {
  return FEATURE_FLAGS[optimization] === true;
}

// Export configuration preset loader
export function loadPreset(preset) {
  switch (preset) {
    case 'performance':
      // Maximum performance, lower quality
      return {
        ...RENDER_CONFIG,
        adaptiveQuality: { ...RENDER_CONFIG.adaptiveQuality, enabled: true },
        shadows: { enabled: false }
      };
      
    case 'quality':
      // Maximum quality, may impact performance
      return {
        ...RENDER_CONFIG,
        adaptiveQuality: { ...RENDER_CONFIG.adaptiveQuality, enabled: false },
        shadows: { enabled: true, quality: 'high' }
      };
      
    case 'balanced':
      // Balanced performance and quality
      return RENDER_CONFIG;
      
    default:
      return RENDER_CONFIG;
  }
}

// Export default configuration
export default {
  performance: PERFORMANCE_THRESHOLDS,
  cache: CACHE_CONFIG,
  memory: MEMORY_CONFIG,
  render: RENDER_CONFIG,
  react: REACT_CONFIG,
  threejs: THREEJS_CONFIG,
  geological: GEOLOGICAL_CONFIG,
  worker: WORKER_CONFIG,
  env: ENV_CONFIG,
  features: FEATURE_FLAGS
};