import { Logger } from './Logger.js';

const logger = new Logger().withContext('PerformanceOptimizer');

/**
 * Debounce function to limit expensive operations
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} Debounced function
 */
export const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

/**
 * Throttle function to limit operation frequency
 * @param {Function} func - Function to throttle
 * @param {number} limit - Minimum time between calls in milliseconds
 * @returns {Function} Throttled function
 */
export const throttle = (func, limit) => {
  let inThrottle;
  return function(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
};

/**
 * Request idle callback with fallback
 * @param {Function} callback - Callback to execute when idle
 * @param {Object} options - Options object with timeout
 * @returns {number} Callback ID
 */
export const requestIdleCallbackPolyfill = (callback, options = {}) => {
  if ('requestIdleCallback' in window) {
    return window.requestIdleCallback(callback, options);
  }
  // Fallback using setTimeout
  const start = Date.now();
  return setTimeout(() => {
    callback({
      didTimeout: false,
      timeRemaining: () => Math.max(0, 50 - (Date.now() - start))
    });
  }, 1);
};

/**
 * Cancel idle callback with fallback
 * @param {number} id - Callback ID to cancel
 */
export const cancelIdleCallbackPolyfill = (id) => {
  if ('cancelIdleCallback' in window) {
    window.cancelIdleCallback(id);
  } else {
    clearTimeout(id);
  }
};

/**
 * Measure performance of a function
 * @param {string} name - Name for the performance mark
 * @param {Function} func - Function to measure
 * @returns {any} Function result
 */
export const measurePerformance = (name, func) => {
  if ('performance' in window && 'mark' in performance) {
    const startMark = `${name}-start`;
    const endMark = `${name}-end`;
    const measureName = `${name}-duration`;
    
    performance.mark(startMark);
    const result = func();
    performance.mark(endMark);
    performance.measure(measureName, startMark, endMark);
    
    const measure = performance.getEntriesByName(measureName)[0];
    if (measure && measure.duration > 100) {
    }
    
    // Clean up marks
    performance.clearMarks(startMark);
    performance.clearMarks(endMark);
    performance.clearMeasures(measureName);
    
    return result;
  }
  return func();
};

/**
 * Batch DOM reads and writes using requestAnimationFrame
 * @param {Function} readFunc - Function that reads from DOM
 * @param {Function} writeFunc - Function that writes to DOM
 */
export const batchDOMOperations = (readFunc, writeFunc) => {
  // Schedule read for next frame
  requestAnimationFrame(() => {
    const readResult = readFunc();
    // Schedule write for frame after read
    requestAnimationFrame(() => {
      writeFunc(readResult);
    });
  });
};

/**
 * Create a memoized selector for expensive computations
 * @param {Function} selector - Selector function
 * @param {Function} equalityFn - Optional equality function
 * @returns {Function} Memoized selector
 */
export const createMemoizedSelector = (selector, equalityFn = (a, b) => a === b) => {
  let lastArgs = null;
  let lastResult = null;
  
  return (...args) => {
    if (lastArgs === null || !args.every((arg, i) => equalityFn(arg, lastArgs[i]))) {
      lastArgs = args;
      lastResult = selector(...args);
    }
    return lastResult;
  };
};

/**
 * Web Vitals monitoring helper
 * Reports Core Web Vitals to console in development
 */
export const monitorWebVitals = () => {
  if (process.env.NODE_ENV === 'development') {
    import('web-vitals').then(({ getCLS, getFID, getFCP, getLCP, getTTFB, getINP }) => {
      getCLS((metric) => {});
      getFID((metric) => {});
      getFCP((metric) => {});
      getLCP((metric) => {});
      getTTFB((metric) => {});
      getINP((metric) => {});
    });
  }
};

/**
 * Optimize Three.js render loop with frame skipping
 * @param {Function} renderFunc - Render function to optimize
 * @param {number} targetFPS - Target frames per second (default 60)
 * @returns {Function} Optimized render function
 */
export const optimizeRenderLoop = (renderFunc, targetFPS = 60) => {
  const frameTime = 1000 / targetFPS;
  let lastTime = 0;
  
  return (currentTime) => {
    if (currentTime - lastTime >= frameTime) {
      renderFunc(currentTime);
      lastTime = currentTime;
    }
  };
};

/**
 * Lazy load images with Intersection Observer
 * @param {string} selector - CSS selector for images
 */
export const lazyLoadImages = (selector = 'img[data-src]') => {
  const images = document.querySelectorAll(selector);
  
  if ('IntersectionObserver' in window) {
    const imageObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target;
          img.src = img.dataset.src;
          img.removeAttribute('data-src');
          imageObserver.unobserve(img);
        }
      });
    });
    
    images.forEach(img => imageObserver.observe(img));
  } else {
    // Fallback for browsers without IntersectionObserver
    images.forEach(img => {
      img.src = img.dataset.src;
      img.removeAttribute('data-src');
    });
  }
};

/**
 * Memory usage monitor for development
 */
export const monitorMemoryUsage = () => {
  if (process.env.NODE_ENV === 'development' && 'memory' in performance) {
    setInterval(() => {
      const memory = performance.memory;
      const usedMB = (memory.usedJSHeapSize / 1048576).toFixed(2);
      const totalMB = (memory.totalJSHeapSize / 1048576).toFixed(2);
      const limitMB = (memory.jsHeapSizeLimit / 1048576).toFixed(2);
      
      if (memory.usedJSHeapSize / memory.jsHeapSizeLimit > 0.9) {
      }
    }, 10000); // Check every 10 seconds
  }
};