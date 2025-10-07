/**
 * Volumetric Model Disposal Utilities
 * Ensures proper cleanup of Three.js resources to prevent memory leaks
 */

import { Object3D, Mesh } from 'three';
import { memoryLogger } from './Logger.js';

/**
 * Dispose of a volumetric group and all its children
 * @param {THREE.Group} group - The volumetric group to dispose
 */
export function disposeVolumetricGroup(group) {
  if (!group || !(group instanceof Object3D)) {
    return;
  }

  // Traverse all children and dispose resources
  group.traverse((child) => {
    if (child instanceof Mesh) {
      // Dispose geometry
      if (child.geometry) {
        child.geometry.dispose();
      }

      // Dispose material(s)
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach(material => {
            disposeMaterial(material);
          });
        } else {
          disposeMaterial(child.material);
        }
      }
    }
  });

  // Clear the group
  while (group.children.length > 0) {
    group.remove(group.children[0]);
  }
}

/**
 * Dispose of a material and its textures
 * @param {THREE.Material} material - The material to dispose
 */
function disposeMaterial(material) {
  if (!material) return;

  // Dispose of all possible texture types
  const textureProperties = [
    'map',
    'alphaMap',
    'aoMap',
    'bumpMap',
    'displacementMap',
    'emissiveMap',
    'envMap',
    'lightMap',
    'metalnessMap',
    'normalMap',
    'roughnessMap'
  ];

  textureProperties.forEach(prop => {
    if (material[prop] && material[prop].dispose) {
      material[prop].dispose();
    }
  });

  // Dispose the material itself
  if (material.dispose) {
    material.dispose();
  }
}

/**
 * Monitor and log memory usage for volumetric models
 * @returns {Object} Memory usage statistics
 */
export function getVolumetricMemoryStats() {
  if (!window.performance || !window.performance.memory) {
    return {
      available: false,
      message: 'Memory monitoring not available in this browser'
    };
  }

  const memory = window.performance.memory;
  return {
    available: true,
    usedJSHeapSize: (memory.usedJSHeapSize / 1048576).toFixed(2) + ' MB',
    totalJSHeapSize: (memory.totalJSHeapSize / 1048576).toFixed(2) + ' MB',
    jsHeapSizeLimit: (memory.jsHeapSizeLimit / 1048576).toFixed(2) + ' MB',
    usage: ((memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100).toFixed(2) + '%'
  };
}

/**
 * Create a disposal tracker for volumetric resources
 */
export class VolumetricResourceTracker {
  constructor() {
    this.resources = new Map();
    this.disposed = new Set();
  }

  /**
   * Track a volumetric resource
   * @param {string} id - Unique identifier
   * @param {Object} resource - The resource to track
   * @param {string} type - Resource type (geometry, material, texture)
   */
  track(id, resource, type) {
    this.resources.set(id, { resource, type, tracked: Date.now() });
  }

  /**
   * Dispose a tracked resource
   * @param {string} id - Resource identifier
   */
  dispose(id) {
    const tracked = this.resources.get(id);
    if (!tracked) return;

    const { resource, type } = tracked;

    switch (type) {
      case 'geometry':
        if (resource.dispose) resource.dispose();
        break;
      case 'material':
        disposeMaterial(resource);
        break;
      case 'texture':
        if (resource.dispose) resource.dispose();
        break;
      case 'group':
        disposeVolumetricGroup(resource);
        break;
      default:
        memoryLogger.warn('Unknown resource type for disposal:', type);
        break;
    }

    this.resources.delete(id);
    this.disposed.add(id);
  }

  /**
   * Dispose all tracked resources
   */
  disposeAll() {
    this.resources.forEach((_, id) => {
      this.dispose(id);
    });
  }

  /**
   * Get tracking statistics
   */
  getStats() {
    return {
      active: this.resources.size,
      disposed: this.disposed.size,
      resources: Array.from(this.resources.entries()).map(([id, data]) => ({
        id,
        type: data.type,
        age: Date.now() - data.tracked
      }))
    };
  }
}

/**
 * Enhanced memory management with automatic cleanup strategies
 */
export class AdvancedMemoryManager extends VolumetricResourceTracker {
  constructor() {
    super();
    this.memoryPressureThreshold = 0.05; // 5% memory usage triggers cleanup (from 80% - was incorrect threshold)
    this.autoCleanupEnabled = true;
    this.lastCleanup = Date.now();
    this.cleanupInterval = 60000; // 60 seconds between automatic cleanups (was 30s - too frequent)
    
    // Start memory monitoring if supported
    if (typeof window !== 'undefined' && window.performance?.memory) {
      this.startMemoryMonitoring();
    }
  }

  /**
   * Start automatic memory monitoring and cleanup
   */
  startMemoryMonitoring() {
    setInterval(() => {
      if (this.autoCleanupEnabled) {
        this.checkMemoryPressure();
      }
    }, 15000); // Check every 15 seconds (was 5s - too frequent for low memory usage)
  }

  /**
   * Check for memory pressure and trigger cleanup if needed
   */
  checkMemoryPressure() {
    const stats = getVolumetricMemoryStats();
    if (!stats.available) return;

    const usagePercent = parseFloat(stats.usage.replace('%', '')) / 100;
    const timeSinceLastCleanup = Date.now() - this.lastCleanup;
    
    // Trigger cleanup if memory pressure is high or it's been a while
    if (usagePercent > this.memoryPressureThreshold || timeSinceLastCleanup > this.cleanupInterval) {
      this.performProactiveCleanup();
      memoryLogger.info(`Automatic memory cleanup triggered. Usage: ${stats.usage}`);
    }
  }

  /**
   * Perform proactive cleanup of old or unused resources
   */
  performProactiveCleanup() {
    const now = Date.now();
    const oldResourceThreshold = 300000; // 5 minutes
    
    // Find resources older than threshold
    const oldResources = [];
    this.resources.forEach((data, id) => {
      if (now - data.tracked > oldResourceThreshold) {
        oldResources.push(id);
      }
    });

    // Dispose old resources
    let disposedCount = 0;
    oldResources.forEach(id => {
      this.dispose(id);
      disposedCount++;
    });

    // Force garbage collection if available (Chrome DevTools)
    if (window.gc && disposedCount > 0) {
      try {
        window.gc();
      } catch (e) {
        // Ignore if not available
      }
    }

    this.lastCleanup = now;
    
    if (disposedCount > 0) {
      memoryLogger.info(`Proactive cleanup disposed ${disposedCount} old resources`);
    }
  }

  /**
   * Get enhanced statistics including memory pressure indicators
   */
  getEnhancedStats() {
    const baseStats = this.getStats();
    const memoryStats = getVolumetricMemoryStats();
    
    return {
      ...baseStats,
      memory: memoryStats,
      autoCleanup: {
        enabled: this.autoCleanupEnabled,
        lastCleanup: this.lastCleanup,
        timeSinceLastCleanup: Date.now() - this.lastCleanup
      },
      recommendations: this.getMemoryRecommendations(memoryStats)
    };
  }

  /**
   * Get memory optimization recommendations
   */
  getMemoryRecommendations(memoryStats) {
    const recommendations = [];
    
    if (memoryStats.available) {
      const usagePercent = parseFloat(memoryStats.usage.replace('%', ''));
      
      if (usagePercent > 90) {
        recommendations.push({
          severity: 'critical',
          message: 'Memory usage critical - consider reducing geological model complexity'
        });
      } else if (usagePercent > 75) {
        recommendations.push({
          severity: 'warning',
          message: 'High memory usage - monitor for potential issues'
        });
      }
    }

    if (this.resources.size > 50) {
      recommendations.push({
        severity: 'info',
        message: `${this.resources.size} active resources - consider periodic cleanup`
      });
    }

    return recommendations;
  }

  /**
   * Enable or disable automatic cleanup
   */
  setAutoCleanup(enabled) {
    this.autoCleanupEnabled = enabled;
    memoryLogger.info(`Automatic memory cleanup ${enabled ? 'enabled' : 'disabled'}`);
  }
}

// Export enhanced singleton instance for global tracking
export const volumetricTracker = new AdvancedMemoryManager();