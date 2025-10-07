/**
 * Performance Monitoring Utilities
 * Comprehensive performance tracking for 3D rendering and React components
 */

import { performanceLogger } from './Logger.js';

/**
 * Performance Monitor for tracking FPS, memory, and render times
 */
export class PerformanceMonitor {
  constructor(options = {}) {
    this.options = {
      trackFPS: true,
      trackMemory: true,
      trackRenderTime: true,
      sampleInterval: 1000, // ms
      historySize: 60, // Keep 60 samples
      ...options
    };
    
    this.stats = {
      fps: { current: 0, average: 0, min: 60, max: 0, history: [] },
      memory: { current: 0, peak: 0, history: [] },
      renderTime: { current: 0, average: 0, max: 0, history: [] },
      drawCalls: { current: 0, average: 0, history: [] },
      triangles: { current: 0, average: 0, history: [] }
    };
    
    this.frameCount = 0;
    this.lastTime = performance.now();
    this.isRunning = false;
    this.callbacks = new Set();
    
    // Three.js renderer info
    this.renderer = null;
  }

  /**
   * Set the Three.js renderer for tracking
   */
  setRenderer(renderer) {
    this.renderer = renderer;
  }

  /**
   * Start monitoring
   */
  start() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    this.lastTime = performance.now();
    this.frameCount = 0;
    
    this.update();
    
    // Start sampling interval
    this.intervalId = setInterval(() => {
      this.sample();
    }, this.options.sampleInterval);
  }

  /**
   * Stop monitoring
   */
  stop() {
    this.isRunning = false;
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    
    if (this.frameId) {
      cancelAnimationFrame(this.frameId);
      this.frameId = null;
    }
  }

  /**
   * Update frame counter
   */
  update() {
    if (!this.isRunning) return;
    
    this.frameCount++;
    
    // Request next frame
    this.frameId = requestAnimationFrame(() => this.update());
  }

  /**
   * Sample current stats
   */
  sample() {
    const now = performance.now();
    const delta = now - this.lastTime;
    
    // Calculate FPS
    if (this.options.trackFPS && delta > 0) {
      const fps = (this.frameCount / delta) * 1000;
      this.updateStat('fps', fps);
      
      this.frameCount = 0;
      this.lastTime = now;
    }
    
    // Track memory
    if (this.options.trackMemory && performance.memory) {
      const memory = performance.memory.usedJSHeapSize / 1048576; // MB
      this.updateStat('memory', memory);
      
      if (memory > this.stats.memory.peak) {
        this.stats.memory.peak = memory;
      }
    }
    
    // Track Three.js renderer stats
    if (this.renderer && this.renderer.info) {
      const info = this.renderer.info;
      
      if (info.render) {
        this.updateStat('drawCalls', info.render.calls);
        this.updateStat('triangles', info.render.triangles);
      }
    }
    
    // Notify callbacks
    this.notifyCallbacks();
  }

  /**
   * Update a statistic
   */
  updateStat(name, value) {
    const stat = this.stats[name];
    if (!stat) return;
    
    stat.current = value;
    stat.history.push(value);
    
    // Maintain history size
    if (stat.history.length > this.options.historySize) {
      stat.history.shift();
    }
    
    // Calculate average
    if (stat.history.length > 0) {
      const sum = stat.history.reduce((a, b) => a + b, 0);
      stat.average = sum / stat.history.length;
    }
    
    // Update min/max for FPS
    if (name === 'fps') {
      if (value < stat.min) stat.min = value;
      if (value > stat.max) stat.max = value;
    }
    
    // Update max for render time
    if (name === 'renderTime') {
      if (value > stat.max) stat.max = value;
    }
  }

  /**
   * Mark render time
   */
  markRenderTime(time) {
    if (this.options.trackRenderTime) {
      this.updateStat('renderTime', time);
    }
  }

  /**
   * Get current stats
   */
  getStats() {
    return {
      fps: Math.round(this.stats.fps.current),
      fpsAvg: Math.round(this.stats.fps.average),
      fpsMin: Math.round(this.stats.fps.min),
      fpsMax: Math.round(this.stats.fps.max),
      memory: this.stats.memory.current.toFixed(1),
      memoryPeak: this.stats.memory.peak.toFixed(1),
      renderTime: this.stats.renderTime.current.toFixed(2),
      renderTimeAvg: this.stats.renderTime.average.toFixed(2),
      renderTimeMax: this.stats.renderTime.max.toFixed(2),
      drawCalls: Math.round(this.stats.drawCalls.current),
      triangles: Math.round(this.stats.triangles.current)
    };
  }

  /**
   * Get performance report
   */
  getReport() {
    const stats = this.getStats();
    const warnings = [];
    
    // Check for performance issues
    if (stats.fps < 30) {
      warnings.push(`Low FPS: ${stats.fps} (target: 60)`);
    }
    
    if (stats.renderTime > 16.67) {
      warnings.push(`High render time: ${stats.renderTime}ms (target: <16.67ms)`);
    }
    
    if (stats.drawCalls > 1000) {
      warnings.push(`High draw calls: ${stats.drawCalls} (target: <1000)`);
    }
    
    if (parseFloat(stats.memory) > 500) {
      warnings.push(`High memory usage: ${stats.memory}MB (warning: >500MB)`);
    }
    
    return {
      stats,
      warnings,
      health: warnings.length === 0 ? 'good' : warnings.length < 3 ? 'warning' : 'poor'
    };
  }

  /**
   * Add callback for stats updates
   */
  addCallback(callback) {
    this.callbacks.add(callback);
  }

  /**
   * Remove callback
   */
  removeCallback(callback) {
    this.callbacks.delete(callback);
  }

  /**
   * Notify all callbacks
   */
  notifyCallbacks() {
    const stats = this.getStats();
    this.callbacks.forEach(callback => callback(stats));
  }

  /**
   * Reset statistics
   */
  reset() {
    Object.keys(this.stats).forEach(key => {
      this.stats[key].current = 0;
      this.stats[key].history = [];
      if (this.stats[key].average !== undefined) {
        this.stats[key].average = 0;
      }
    });
    
    this.stats.fps.min = 60;
    this.stats.fps.max = 0;
    this.stats.memory.peak = 0;
    this.stats.renderTime.max = 0;
  }
}

/**
 * React Component Performance Tracker
 */
export class ComponentProfiler {
  constructor() {
    this.profiles = new Map();
    this.enabled = true;
  }

  /**
   * Profile a component render
   */
  onRender(id, phase, actualDuration, baseDuration, startTime, commitTime) {
    if (!this.enabled) return;
    
    if (!this.profiles.has(id)) {
      this.profiles.set(id, {
        renderCount: 0,
        totalTime: 0,
        averageTime: 0,
        maxTime: 0,
        minTime: Infinity,
        phases: { mount: 0, update: 0 },
        history: []
      });
    }
    
    const profile = this.profiles.get(id);
    
    // Update stats
    profile.renderCount++;
    profile.totalTime += actualDuration;
    profile.averageTime = profile.totalTime / profile.renderCount;
    profile.phases[phase]++;
    
    if (actualDuration > profile.maxTime) {
      profile.maxTime = actualDuration;
    }
    
    if (actualDuration < profile.minTime) {
      profile.minTime = actualDuration;
    }
    
    // Add to history
    profile.history.push({
      phase,
      duration: actualDuration,
      timestamp: commitTime
    });
    
    // Limit history size
    if (profile.history.length > 100) {
      profile.history.shift();
    }
  }

  /**
   * Get profile for a component
   */
  getProfile(id) {
    return this.profiles.get(id);
  }

  /**
   * Get all profiles
   */
  getAllProfiles() {
    const results = [];
    
    this.profiles.forEach((profile, id) => {
      results.push({
        id,
        renderCount: profile.renderCount,
        averageTime: profile.averageTime.toFixed(2),
        maxTime: profile.maxTime.toFixed(2),
        minTime: profile.minTime.toFixed(2),
        totalTime: profile.totalTime.toFixed(2),
        mountCount: profile.phases.mount,
        updateCount: profile.phases.update
      });
    });
    
    // Sort by total time
    results.sort((a, b) => b.totalTime - a.totalTime);
    
    return results;
  }

  /**
   * Get slow components
   */
  getSlowComponents(threshold = 16.67) {
    return this.getAllProfiles().filter(p => parseFloat(p.averageTime) > threshold);
  }

  /**
   * Clear profiles
   */
  clear() {
    this.profiles.clear();
  }

  /**
   * Enable/disable profiling
   */
  setEnabled(enabled) {
    this.enabled = enabled;
  }
}

/**
 * Render Performance Optimizer
 */
export class RenderOptimizer {
  constructor() {
    this.frameTimeTarget = 16.67; // 60 FPS
    this.adaptiveQuality = true;
    this.qualityLevels = ['ultra', 'high', 'medium', 'low', 'potato'];
    this.currentQuality = 1; // Start at high
    this.frameHistory = [];
    this.historySize = 30;
    this.adjustmentThreshold = 5; // Number of slow frames before adjusting
  }

  /**
   * Record frame time
   */
  recordFrame(deltaTime) {
    this.frameHistory.push(deltaTime);
    
    if (this.frameHistory.length > this.historySize) {
      this.frameHistory.shift();
    }
    
    // Check if we need to adjust quality
    if (this.adaptiveQuality) {
      this.checkQualityAdjustment();
    }
  }

  /**
   * Check if quality adjustment is needed
   */
  checkQualityAdjustment() {
    if (this.frameHistory.length < this.adjustmentThreshold) return;
    
    // Count slow frames
    const slowFrames = this.frameHistory.filter(t => t > this.frameTimeTarget * 1.5).length;
    const fastFrames = this.frameHistory.filter(t => t < this.frameTimeTarget * 0.5).length;
    
    // Adjust quality
    if (slowFrames > this.adjustmentThreshold && this.currentQuality < this.qualityLevels.length - 1) {
      this.decreaseQuality();
    } else if (fastFrames > this.historySize * 0.8 && this.currentQuality > 0) {
      this.increaseQuality();
    }
  }

  /**
   * Decrease rendering quality
   */
  decreaseQuality() {
    if (this.currentQuality >= this.qualityLevels.length - 1) return;
    
    this.currentQuality++;
    const newQuality = this.qualityLevels[this.currentQuality];
    
    performanceLogger.debug(`Decreasing quality to: ${newQuality}`);
    
    return this.getQualitySettings(newQuality);
  }

  /**
   * Increase rendering quality
   */
  increaseQuality() {
    if (this.currentQuality <= 0) return;
    
    this.currentQuality--;
    const newQuality = this.qualityLevels[this.currentQuality];
    
    performanceLogger.debug(`Increasing quality to: ${newQuality}`);
    
    return this.getQualitySettings(newQuality);
  }

  /**
   * Get quality settings
   */
  getQualitySettings(level) {
    const settings = {
      ultra: {
        pixelRatio: window.devicePixelRatio,
        shadowMapSize: 2048,
        antialias: true,
        postProcessing: true,
        maxLights: 10,
        textureQuality: 1,
        geometryDetail: 1,
        particleCount: 1
      },
      high: {
        pixelRatio: Math.min(window.devicePixelRatio, 2),
        shadowMapSize: 1024,
        antialias: true,
        postProcessing: true,
        maxLights: 8,
        textureQuality: 0.75,
        geometryDetail: 0.8,
        particleCount: 0.75
      },
      medium: {
        pixelRatio: 1.5,
        shadowMapSize: 512,
        antialias: true,
        postProcessing: false,
        maxLights: 6,
        textureQuality: 0.5,
        geometryDetail: 0.6,
        particleCount: 0.5
      },
      low: {
        pixelRatio: 1,
        shadowMapSize: 256,
        antialias: false,
        postProcessing: false,
        maxLights: 4,
        textureQuality: 0.25,
        geometryDetail: 0.4,
        particleCount: 0.25
      },
      potato: {
        pixelRatio: 0.75,
        shadowMapSize: 128,
        antialias: false,
        postProcessing: false,
        maxLights: 2,
        textureQuality: 0.1,
        geometryDetail: 0.2,
        particleCount: 0.1
      }
    };
    
    return settings[level] || settings.medium;
  }

  /**
   * Get current quality
   */
  getCurrentQuality() {
    return this.qualityLevels[this.currentQuality];
  }

  /**
   * Set adaptive quality
   */
  setAdaptiveQuality(enabled) {
    this.adaptiveQuality = enabled;
  }

  /**
   * Reset
   */
  reset() {
    this.frameHistory = [];
    this.currentQuality = 1;
  }
}

// Export singleton instances
export const performanceMonitor = new PerformanceMonitor();
export const componentProfiler = new ComponentProfiler();
export const renderOptimizer = new RenderOptimizer();