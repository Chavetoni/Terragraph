/**
 * Performance configuration settings
 * Toggle these flags to enable/disable optimizations
 */

export const PERFORMANCE_CONFIG = {
  // Enable lazy loading for Three.js canvas
  ENABLE_LAZY_CANVAS: true,



  // Enable optimized sidebar with transitions
  ENABLE_OPTIMIZED_SIDEBAR: true,

  // Three.js specific optimizations
  THREE_JS: {
    // Maximum pixel ratio for rendering (2 = retina, 1 = standard)
    MAX_PIXEL_RATIO: 2,

    // Enable/disable shadows (expensive)
    ENABLE_SHADOWS: true,

    // Antialias setting (expensive on mobile)
    ENABLE_ANTIALIAS: true,

    // Power preference for WebGL
    POWER_PREFERENCE: 'high-performance', // 'high-performance' | 'low-power' | 'default'

    // Frame rate limiting
    TARGET_FPS: 60,

    // Level of detail distances
    LOD_DISTANCES: {
      HIGH: 50,
      MEDIUM: 100,
      LOW: 200
    }
  },

  // Context provider optimizations
  PROVIDERS: {
    // Delay before loading heavy providers (ms)
    LAZY_LOAD_DELAY: 100,

    // Use request idle callback for deferred loading
    USE_IDLE_CALLBACK: true,

    // Timeout for idle callback (ms)
    IDLE_CALLBACK_TIMEOUT: 1000
  },

  // Interaction optimizations
  INTERACTIONS: {
    // Throttle delay for sidebar buttons (ms)
    SIDEBAR_THROTTLE: 150,

    // Debounce delay for search inputs (ms)
    SEARCH_DEBOUNCE: 300,

    // Throttle delay for canvas mouse move (ms)
    MOUSE_MOVE_THROTTLE: 50,

    // Enable React 18 transitions
    USE_TRANSITIONS: true
  },

  // Memory management
  MEMORY: {
    // Enable automatic disposal of unused Three.js objects
    AUTO_DISPOSE: true,

    // Memory check interval (ms)
    CHECK_INTERVAL: 10000,

    // Memory usage warning threshold (percentage)
    WARNING_THRESHOLD: 0.9
  },

  // Development tools
  DEV_TOOLS: {
    // Enable performance monitoring
    ENABLE_MONITORING: process.env.NODE_ENV === 'development',

    // Enable web vitals logging
    LOG_WEB_VITALS: process.env.NODE_ENV === 'development',

    // Enable memory usage monitoring
    MONITOR_MEMORY: process.env.NODE_ENV === 'development',

    // Enable render performance logging
    LOG_RENDER_PERFORMANCE: process.env.NODE_ENV === 'development'
  }
};

/**
 * Get optimization level based on device capabilities
 * @returns {'high' | 'medium' | 'low'} Optimization level
 */
export const getOptimizationLevel = () => {
  // Check for mobile devices
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  // Check for low-end devices based on hardware concurrency
  const cores = navigator.hardwareConcurrency || 4;
  const memory = navigator.deviceMemory || 4; // Device memory in GB (Chrome only)

  if (isMobile || cores <= 2 || memory <= 2) {
    return 'low';
  } else if (cores <= 4 || memory <= 4) {
    return 'medium';
  }

  return 'high';
};

/**
 * Apply performance optimizations based on device
 */
export const applyDeviceOptimizations = () => {
  const level = getOptimizationLevel();

  switch (level) {
    case 'low':
      PERFORMANCE_CONFIG.THREE_JS.MAX_PIXEL_RATIO = 1;
      PERFORMANCE_CONFIG.THREE_JS.ENABLE_SHADOWS = false;
      PERFORMANCE_CONFIG.THREE_JS.ENABLE_ANTIALIAS = false;
      PERFORMANCE_CONFIG.THREE_JS.TARGET_FPS = 30;
      break;
    case 'medium':
      PERFORMANCE_CONFIG.THREE_JS.MAX_PIXEL_RATIO = 1.5;
      PERFORMANCE_CONFIG.THREE_JS.TARGET_FPS = 45;
      break;
    case 'high':
    default:
      // Use default high-performance settings
      break;
  }

  // Only log in development mode
  if (process.env.NODE_ENV === 'development') {
  }
};

// Auto-apply optimizations on load
if (typeof window !== 'undefined') {
  applyDeviceOptimizations();
}