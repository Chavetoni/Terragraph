import { Logger } from './Logger.js';

const logger = new Logger().withContext('RuntimeOptimizations');

/**
 * Optimized scheduler for expensive operations
 * Breaks up long tasks to reduce Total Blocking Time
 */
export class TaskScheduler {
  constructor() {
    this.taskQueue = [];
    this.isProcessing = false;
    this.maxTaskTime = 5; // 5ms chunks to keep under 16ms frame budget
  }
  
  /**
   * Schedule a task to run in small chunks
   * @param {Function} task - Task to execute
   * @param {Object} options - Options for task execution
   */
  schedule(task, options = {}) {
    return new Promise((resolve, reject) => {
      this.taskQueue.push({
        task,
        resolve,
        reject,
        priority: options.priority || 0,
        maxTime: options.maxTime || this.maxTaskTime
      });
      
      if (!this.isProcessing) {
        this.processQueue();
      }
    });
  }
  
  async processQueue() {
    if (this.taskQueue.length === 0) {
      this.isProcessing = false;
      return;
    }
    
    this.isProcessing = true;
    
    // Sort by priority
    this.taskQueue.sort((a, b) => b.priority - a.priority);
    
    const task = this.taskQueue.shift();
    
    try {
      // Use scheduler.yield if available (Chrome 115+)
      if ('scheduler' in window && 'yield' in window.scheduler) {
        await window.scheduler.yield();
      } else {
        // Fallback to setTimeout for yielding
        await new Promise(resolve => setTimeout(resolve, 0));
      }
      
      const result = await task.task();
      task.resolve(result);
    } catch (error) {
      task.reject(error);
    }
    
    // Continue processing
    this.processQueue();
  }
}

// Global task scheduler instance
export const globalScheduler = new TaskScheduler();

/**
 * Debounced function wrapper with cancellation support
 */
export const createDebouncedFunction = (func, delay, options = {}) => {
  let timeoutId = null;
  let lastCallTime = 0;
  
  const debouncedFunc = (...args) => {
    const now = Date.now();
    lastCallTime = now;
    
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    
    return new Promise((resolve, reject) => {
      timeoutId = setTimeout(async () => {
        // Check if this is still the latest call
        if (lastCallTime === now || options.executeStale) {
          try {
            const result = await func(...args);
            resolve(result);
          } catch (error) {
            reject(error);
          }
        }
      }, delay);
    });
  };
  
  debouncedFunc.cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };
  
  return debouncedFunc;
};

/**
 * Optimized RAF wrapper for smooth animations
 */
export class OptimizedRAF {
  constructor() {
    this.callbacks = new Set();
    this.isRunning = false;
  }
  
  add(callback) {
    this.callbacks.add(callback);
    
    if (!this.isRunning) {
      this.start();
    }
    
    return () => this.remove(callback);
  }
  
  remove(callback) {
    this.callbacks.delete(callback);
    
    if (this.callbacks.size === 0) {
      this.stop();
    }
  }
  
  start() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    this.tick();
  }
  
  stop() {
    this.isRunning = false;
  }
  
  tick = () => {
    if (!this.isRunning) return;
    
    const currentTime = performance.now();
    
    this.callbacks.forEach(callback => {
      try {
        callback(currentTime);
      } catch (error) {
        logger.error('RAF callback error:', error);
      }
    });
    
    requestAnimationFrame(this.tick);
  };
}

// Global RAF manager
export const globalRAF = new OptimizedRAF();

/**
 * Performance-aware state updater
 * Uses React transitions for non-urgent updates
 */
export const createOptimizedStateUpdater = (setState, isUrgent = false) => {
  if (isUrgent) {
    return setState;
  }
  
  return (newState) => {
    if (typeof newState === 'function') {
      globalScheduler.schedule(() => {
        setState(newState);
      }, { priority: 1 });
    } else {
      globalScheduler.schedule(() => {
        setState(newState);
      }, { priority: 1 });
    }
  };
};

/**
 * Optimized event handler creator
 * Automatically throttles high-frequency events
 */
export const createOptimizedEventHandler = (handler, eventType) => {
  const highFrequencyEvents = ['mousemove', 'scroll', 'resize', 'touchmove'];
  const shouldThrottle = highFrequencyEvents.includes(eventType);
  
  if (!shouldThrottle) {
    return handler;
  }
  
  let rafId = null;
  
  return (event) => {
    if (rafId) {
      cancelAnimationFrame(rafId);
    }
    
    rafId = requestAnimationFrame(() => {
      handler(event);
    });
  };
};

/**
 * Memory-efficient cache with automatic cleanup
 */
export class OptimizedCache {
  constructor(maxSize = 50, ttl = 5 * 60 * 1000) { // 5 minutes default TTL
    this.cache = new Map();
    this.maxSize = maxSize;
    this.ttl = ttl;
    this.timers = new Map();
  }
  
  get(key) {
    const item = this.cache.get(key);
    if (!item) return undefined;
    
    const now = Date.now();
    if (now - item.timestamp > this.ttl) {
      this.delete(key);
      return undefined;
    }
    
    // Update access time
    item.timestamp = now;
    return item.value;
  }
  
  set(key, value) {
    // Clean up if at max size
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      const firstKey = this.cache.keys().next().value;
      this.delete(firstKey);
    }
    
    // Clear existing timer if updating
    const existingTimer = this.timers.get(key);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }
    
    // Set new item
    this.cache.set(key, {
      value,
      timestamp: Date.now()
    });
    
    // Set cleanup timer
    const timer = setTimeout(() => {
      this.delete(key);
    }, this.ttl);
    
    this.timers.set(key, timer);
  }
  
  delete(key) {
    this.cache.delete(key);
    const timer = this.timers.get(key);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(key);
    }
  }
  
  clear() {
    this.timers.forEach(timer => clearTimeout(timer));
    this.cache.clear();
    this.timers.clear();
  }
}

/**
 * Initialize performance monitoring in development
 */
export const initPerformanceMonitoring = () => {
  if (process.env.NODE_ENV !== 'development') return;
  
  // Monitor long tasks
  if ('PerformanceObserver' in window) {
    const observer = new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => {
        if (entry.duration > 50) {
        }
      });
    });
    
    observer.observe({ entryTypes: ['longtask'] });
  }
  
  // Monitor layout shifts
  if ('PerformanceObserver' in window) {
    const clsObserver = new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => {
        if (entry.value > 0.1) {
        }
      });
    });
    
    clsObserver.observe({ entryTypes: ['layout-shift'] });
  }
};