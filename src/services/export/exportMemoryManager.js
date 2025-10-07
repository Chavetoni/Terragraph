/**
 * Export Memory Manager - Comprehensive Three.js memory management for export operations
 *
 * This service provides specialized memory management for geological model export operations,
 * extending the existing volumetricDisposal.js patterns with export-specific optimizations.
 *
 * Features:
 * - Export-specific memory tracking and cleanup
 * - Resource pools for batch export operations
 * - Memory usage monitoring and warnings
 * - Emergency cleanup and leak detection
 * - Integration with existing disposal patterns
 * - Performance optimization for large geological datasets
 * - GPU memory monitoring and management
 *
 * Architecture:
 * - Extends VolumetricResourceTracker for geological mesh handling
 * - Integrates with OptimizedSceneManager resource pools
 * - Works with existing export services (ObjMtlExporter, RevitExportOrchestrator)
 * - Provides development tools and debugging utilities
 *
 * Memory Management Strategy:
 * - Pre-export: Resource allocation and planning
 * - During-export: Active tracking and optimization
 * - Post-export: Comprehensive cleanup and validation
 * - Emergency: Automatic recovery from memory pressure
 *
 * @author Frontend Developer Agent
 * @version 1.0.0
 */

import {
  BufferGeometry,
  Material,
  Texture,
  Object3D,
  Mesh,
  Group,
  CanvasTexture
} from 'three';

import {
  VolumetricResourceTracker,
  AdvancedMemoryManager,
  disposeVolumetricGroup,
  getVolumetricMemoryStats
} from '../../utils/volumetricDisposal.js';

import { performanceMonitor, PerformanceMonitor } from '../../utils/performanceMonitor.js';
import { memoryLogger, performanceLogger } from '../../utils/Logger.js';

/**
 * Export operation phases for lifecycle management
 */
export const ExportPhase = {
  IDLE: 'idle',
  PREPARING: 'preparing',
  PROCESSING: 'processing',
  GENERATING: 'generating',
  PACKAGING: 'packaging',
  CLEANING: 'cleaning',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled'
};

/**
 * Memory pressure levels for automatic management
 */
export const MemoryPressure = {
  LOW: 'low',          // < 50% usage
  MODERATE: 'moderate', // 50-70% usage
  HIGH: 'high',        // 70-85% usage
  CRITICAL: 'critical' // > 85% usage
};

/**
 * Resource types for specialized disposal
 */
export const ResourceType = {
  GEOMETRY: 'geometry',
  MATERIAL: 'material',
  TEXTURE: 'texture',
  MESH: 'mesh',
  GROUP: 'group',
  CANVAS: 'canvas',
  BUFFER: 'buffer',
  EXPORT_TEMP: 'export_temp',
  CLONED_OBJECT: 'cloned_object',
  GEOLOGICAL_MESH: 'geological_mesh',
  WATER_TABLE: 'water_table',
  BOREHOLE_MARKER: 'borehole_marker'
};

/**
 * Export-specific memory manager extending VolumetricResourceTracker
 */
export class ExportMemoryManager extends VolumetricResourceTracker {
  constructor(options = {}) {
    super();

    this.options = {
      // Memory management thresholds
      warningThreshold: 0.70,        // 70% memory usage warning
      criticalThreshold: 0.85,       // 85% memory usage critical
      cleanupThreshold: 0.75,        // 75% triggers proactive cleanup

      // Resource limits
      maxTemporaryResources: 1000,   // Maximum temporary resources
      maxClonedObjects: 500,         // Maximum cloned objects
      maxTextureSize: 2048 * 2048,   // Maximum texture size in pixels

      // Monitoring intervals
      monitoringInterval: 5000,      // 5 seconds
      cleanupInterval: 30000,        // 30 seconds

      // Performance settings
      enablePerformanceTracking: true,
      enableGPUMonitoring: true,
      enableLeakDetection: true,

      // Debug options
      debugMode: process.env.NODE_ENV === 'development',
      verboseLogging: false,

      ...options
    };

    // Export operation state
    this.currentPhase = ExportPhase.IDLE;
    this.exportId = null;
    this.startTime = null;
    this.phaseStartTime = null;

    // Resource tracking
    this.exportResources = new Map();     // Export-specific resources
    this.temporaryResources = new Set();  // Temporary resources for cleanup
    this.clonedObjects = new Map();       // Cloned objects tracking
    this.resourcePools = new Map();       // Resource pools for reuse
    this.textureAtlas = new Map();        // Texture atlas for optimization

    // Memory monitoring
    this.memorySnapshots = [];
    this.memoryWarnings = [];
    this.currentPressure = MemoryPressure.LOW;
    this.peakMemoryUsage = 0;

    // Performance tracking
    this.performanceMetrics = new Map();
    this.phaseMetrics = new Map();

    // Cleanup strategies
    this.cleanupStrategies = new Map();
    this.emergencyCleanupEnabled = true;
    this.lastEmergencyCleanup = 0;

    // Monitoring timers
    this.monitoringTimer = null;
    this.cleanupTimer = null;

    // Initialize cleanup strategies
    this.initializeCleanupStrategies();

    // Initialize monitoring if enabled
    if (this.options.enablePerformanceTracking) {
      this.initializeMonitoring();
    }

    memoryLogger.info('ExportMemoryManager initialized', {
      options: this.options,
      debugMode: this.options.debugMode
    });
  }

  /**
   * Initialize cleanup strategies for different resource types
   * @private
   */
  initializeCleanupStrategies() {
    // Geometry cleanup strategy
    this.cleanupStrategies.set(ResourceType.GEOMETRY, (resource) => {
      if (resource && typeof resource.dispose === 'function') {
        resource.dispose();
        return true;
      }
      return false;
    });

    // Material cleanup strategy
    this.cleanupStrategies.set(ResourceType.MATERIAL, (resource) => {
      if (resource && typeof resource.dispose === 'function') {
        // Dispose textures first
        const textureProps = [
          'map', 'alphaMap', 'aoMap', 'bumpMap', 'displacementMap',
          'emissiveMap', 'envMap', 'lightMap', 'metalnessMap',
          'normalMap', 'roughnessMap'
        ];

        textureProps.forEach(prop => {
          if (resource[prop] && typeof resource[prop].dispose === 'function') {
            resource[prop].dispose();
          }
        });

        resource.dispose();
        return true;
      }
      return false;
    });

    // Texture cleanup strategy
    this.cleanupStrategies.set(ResourceType.TEXTURE, (resource) => {
      if (resource && typeof resource.dispose === 'function') {
        resource.dispose();
        return true;
      }
      return false;
    });

    // Mesh cleanup strategy
    this.cleanupStrategies.set(ResourceType.MESH, (resource) => {
      if (resource instanceof Mesh) {
        if (resource.geometry) {
          this.disposeResource(resource.geometry, ResourceType.GEOMETRY);
        }
        if (resource.material) {
          const materials = Array.isArray(resource.material) ? resource.material : [resource.material];
          materials.forEach(material => {
            this.disposeResource(material, ResourceType.MATERIAL);
          });
        }
        return true;
      }
      return false;
    });

    // Group cleanup strategy
    this.cleanupStrategies.set(ResourceType.GROUP, (resource) => {
      if (resource instanceof Group || resource instanceof Object3D) {
        disposeVolumetricGroup(resource);
        return true;
      }
      return false;
    });

    // Geological mesh cleanup strategy
    this.cleanupStrategies.set(ResourceType.GEOLOGICAL_MESH, (resource) => {
      if (resource instanceof Mesh && resource.userData?.geological) {
        // Use specialized geological disposal
        return this.cleanupStrategies.get(ResourceType.MESH)(resource);
      }
      return false;
    });

    // Canvas cleanup strategy
    this.cleanupStrategies.set(ResourceType.CANVAS, (resource) => {
      if (resource instanceof HTMLCanvasElement) {
        const ctx = resource.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, resource.width, resource.height);
        }
        resource.width = 0;
        resource.height = 0;
        return true;
      }
      return false;
    });

    // Buffer cleanup strategy
    this.cleanupStrategies.set(ResourceType.BUFFER, (resource) => {
      if (resource instanceof ArrayBuffer || resource instanceof Uint8Array || resource instanceof Float32Array) {
        // Set reference to null to help garbage collection
        resource = null;
        return true;
      }
      return false;
    });
  }

  /**
   * Initialize memory and performance monitoring
   * @private
   */
  initializeMonitoring() {
    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
    }

    // Start memory monitoring
    this.monitoringTimer = setInterval(() => {
      this.monitorMemoryUsage();
    }, this.options.monitoringInterval);

    // Start periodic cleanup
    if (this.options.cleanupInterval > 0) {
      this.cleanupTimer = setInterval(() => {
        this.performPeriodicCleanup();
      }, this.options.cleanupInterval);
    }

    memoryLogger.info('Memory monitoring initialized', {
      monitoringInterval: this.options.monitoringInterval,
      cleanupInterval: this.options.cleanupInterval
    });
  }

  /**
   * Start an export operation with memory tracking
   * @param {string} exportId - Unique identifier for the export operation
   * @param {Object} options - Export-specific options
   * @returns {Object} - Export session information
   */
  startExportOperation(exportId, options = {}) {
    if (this.currentPhase !== ExportPhase.IDLE) {
      memoryLogger.warn('Starting new export while another is in progress', {
        currentPhase: this.currentPhase,
        currentExportId: this.exportId,
        newExportId: exportId
      });

      // Cleanup previous operation
      this.cleanupExportOperation();
    }

    this.exportId = exportId;
    this.currentPhase = ExportPhase.PREPARING;
    this.startTime = performance.now();
    this.phaseStartTime = this.startTime;

    // Take initial memory snapshot
    const initialSnapshot = this.takeMemorySnapshot('export_start');
    this.memorySnapshots = [initialSnapshot];

    // Initialize export-specific tracking
    this.exportResources.clear();
    this.temporaryResources.clear();
    this.clonedObjects.clear();
    this.performanceMetrics.clear();
    this.phaseMetrics.clear();

    // Reset warnings
    this.memoryWarnings = [];

    const sessionInfo = {
      exportId,
      startTime: this.startTime,
      phase: this.currentPhase,
      initialMemory: initialSnapshot,
      options
    };

    memoryLogger.info('Export operation started', sessionInfo);

    return sessionInfo;
  }

  /**
   * Transition to a new export phase
   * @param {string} phase - New phase from ExportPhase enum
   * @param {Object} data - Phase-specific data
   */
  setExportPhase(phase, data = {}) {
    if (!Object.values(ExportPhase).includes(phase)) {
      memoryLogger.warn('Invalid export phase', { phase, validPhases: Object.values(ExportPhase) });
      return;
    }

    const previousPhase = this.currentPhase;
    const previousPhaseTime = this.phaseStartTime;
    const now = performance.now();

    // Record previous phase metrics
    if (previousPhaseTime) {
      const phaseDuration = now - previousPhaseTime;
      this.phaseMetrics.set(previousPhase, {
        duration: phaseDuration,
        memorySnapshot: this.takeMemorySnapshot(`phase_${previousPhase}_end`),
        ...data
      });
    }

    // Update current phase
    this.currentPhase = phase;
    this.phaseStartTime = now;

    // Take phase transition snapshot
    const snapshot = this.takeMemorySnapshot(`phase_${phase}_start`);
    this.memorySnapshots.push(snapshot);

    // Check for memory pressure during critical phases
    if ([ExportPhase.PROCESSING, ExportPhase.GENERATING].includes(phase)) {
      this.checkMemoryPressure();
    }

    memoryLogger.info('Export phase transition', {
      exportId: this.exportId,
      from: previousPhase,
      to: phase,
      phaseDuration: previousPhaseTime ? now - previousPhaseTime : 0,
      totalDuration: now - this.startTime,
      memoryUsage: snapshot.usagePercent,
      data
    });
  }

  /**
   * Track a resource for export-specific cleanup
   * @param {string} resourceId - Unique resource identifier
   * @param {*} resource - The resource to track
   * @param {string} type - Resource type from ResourceType enum
   * @param {Object} metadata - Additional metadata
   */
  trackExportResource(resourceId, resource, type, metadata = {}) {
    if (!resource) {
      memoryLogger.warn('Attempted to track null/undefined resource', { resourceId, type });
      return;
    }

    // Track with parent class
    this.track(resourceId, resource, type);

    // Export-specific tracking
    this.exportResources.set(resourceId, {
      resource,
      type,
      metadata: {
        ...metadata,
        exportId: this.exportId,
        phase: this.currentPhase,
        trackedAt: performance.now(),
        temporary: metadata.temporary || false
      }
    });

    // Add to temporary resources if marked as such
    if (metadata.temporary) {
      this.temporaryResources.add(resourceId);
    }

    // Track cloned objects separately
    if (metadata.isCloned) {
      this.clonedObjects.set(resourceId, {
        original: metadata.original,
        clone: resource,
        type,
        clonedAt: performance.now()
      });
    }

    if (this.options.verboseLogging) {
      memoryLogger.debug('Export resource tracked', {
        resourceId,
        type,
        temporary: metadata.temporary,
        isCloned: metadata.isCloned,
        totalTracked: this.exportResources.size
      });
    }
  }

  /**
   * Create and track a cloned object for export
   * @param {string} resourceId - Unique identifier for the cloned resource
   * @param {*} original - Original object to clone
   * @param {string} type - Resource type
   * @param {Object} options - Cloning options
   * @returns {*} - Cloned object
   */
  trackClonedResource(resourceId, original, type, options = {}) {
    if (!original) {
      memoryLogger.warn('Attempted to clone null/undefined resource', { resourceId, type });
      return null;
    }

    let cloned;

    try {
      // Perform type-specific cloning
      switch (type) {
        case ResourceType.GEOMETRY:
          if (original instanceof BufferGeometry) {
            cloned = original.clone();
          } else {
            throw new Error('Invalid geometry for cloning');
          }
          break;

        case ResourceType.MATERIAL:
          if (original instanceof Material) {
            cloned = original.clone();
          } else {
            throw new Error('Invalid material for cloning');
          }
          break;

        case ResourceType.TEXTURE:
          if (original instanceof Texture) {
            cloned = original.clone();
          } else {
            throw new Error('Invalid texture for cloning');
          }
          break;

        case ResourceType.MESH:
          if (original instanceof Mesh) {
            cloned = new Mesh();
            cloned.geometry = original.geometry ? original.geometry.clone() : null;
            cloned.material = original.material ? original.material.clone() : null;
            cloned.position.copy(original.position);
            cloned.rotation.copy(original.rotation);
            cloned.scale.copy(original.scale);
            cloned.userData = { ...original.userData };
          } else {
            throw new Error('Invalid mesh for cloning');
          }
          break;

        case ResourceType.GROUP:
          if (original instanceof Group || original instanceof Object3D) {
            cloned = original.clone(true); // Deep clone
          } else {
            throw new Error('Invalid group/object for cloning');
          }
          break;

        default:
          // Generic cloning fallback
          if (typeof original.clone === 'function') {
            cloned = original.clone();
          } else {
            throw new Error(`Unsupported resource type for cloning: ${type}`);
          }
          break;
      }

      // Track the cloned resource
      this.trackExportResource(resourceId, cloned, type, {
        ...options,
        isCloned: true,
        original: original,
        temporary: true // Cloned resources are typically temporary
      });

      if (this.options.verboseLogging) {
        memoryLogger.debug('Resource cloned and tracked', {
          resourceId,
          type,
          originalSize: this.estimateResourceSize(original),
          clonedSize: this.estimateResourceSize(cloned)
        });
      }

      return cloned;

    } catch (error) {
      memoryLogger.error('Failed to clone resource', {
        resourceId,
        type,
        error: error.message
      });
      return null;
    }
  }

  /**
   * Create a resource pool for reusing similar resources
   * @param {string} poolId - Unique pool identifier
   * @param {string} resourceType - Type of resources in the pool
   * @param {Object} poolOptions - Pool configuration options
   * @returns {Object} - Resource pool interface
   */
  createResourcePool(poolId, resourceType, poolOptions = {}) {
    const defaultOptions = {
      maxSize: 100,           // Maximum pool size
      cleanupThreshold: 80,   // Cleanup when 80% full
      idleTimeout: 300000,    // 5 minutes idle timeout
      enableReuse: true       // Enable resource reuse
    };

    const options = { ...defaultOptions, ...poolOptions };

    const pool = {
      id: poolId,
      type: resourceType,
      options,
      resources: new Map(),
      available: new Set(),
      inUse: new Set(),
      createdAt: performance.now(),
      lastUsed: performance.now(),
      stats: {
        created: 0,
        reused: 0,
        disposed: 0,
        hits: 0,
        misses: 0
      }
    };

    this.resourcePools.set(poolId, pool);

    const poolInterface = {
      /**
       * Get or create a resource from the pool
       * @param {string} key - Resource key for retrieval
       * @param {Function} createFn - Function to create new resource if not available
       * @returns {*} - Resource from pool or newly created
       */
      getOrCreate: (key, createFn) => {
        pool.lastUsed = performance.now();

        // Check if resource is available in pool
        if (options.enableReuse && pool.resources.has(key) && pool.available.has(key)) {
          const resource = pool.resources.get(key);
          pool.available.delete(key);
          pool.inUse.add(key);
          pool.stats.reused++;
          pool.stats.hits++;

          if (this.options.verboseLogging) {
            memoryLogger.debug('Resource reused from pool', { poolId, key, resourceType });
          }

          return resource;
        }

        // Create new resource
        try {
          const newResource = createFn();
          pool.resources.set(key, newResource);
          pool.inUse.add(key);
          pool.stats.created++;
          pool.stats.misses++;

          // Track the pooled resource
          const resourceId = `${poolId}_${key}`;
          this.trackExportResource(resourceId, newResource, resourceType, {
            pooled: true,
            poolId,
            poolKey: key
          });

          if (this.options.verboseLogging) {
            memoryLogger.debug('New resource created for pool', { poolId, key, resourceType });
          }

          return newResource;

        } catch (error) {
          memoryLogger.error('Failed to create resource for pool', {
            poolId,
            key,
            resourceType,
            error: error.message
          });
          return null;
        }
      },

      /**
       * Return a resource to the pool
       * @param {string} key - Resource key
       */
      release: (key) => {
        if (pool.inUse.has(key)) {
          pool.inUse.delete(key);
          if (options.enableReuse && pool.resources.has(key)) {
            pool.available.add(key);
          }
          pool.lastUsed = performance.now();

          if (this.options.verboseLogging) {
            memoryLogger.debug('Resource released to pool', { poolId, key });
          }
        }
      },

      /**
       * Get pool statistics
       */
      getStats: () => ({ ...pool.stats, size: pool.resources.size }),

      /**
       * Clear the pool
       */
      clear: () => {
        this.clearResourcePool(poolId);
      }
    };

    memoryLogger.info('Resource pool created', { poolId, resourceType, options });

    return poolInterface;
  }

  /**
   * Clear a resource pool
   * @param {string} poolId - Pool identifier
   */
  clearResourcePool(poolId) {
    const pool = this.resourcePools.get(poolId);
    if (!pool) {
      memoryLogger.warn('Attempted to clear non-existent resource pool', { poolId });
      return;
    }

    // Dispose all resources in the pool
    pool.resources.forEach((resource, key) => {
      const resourceId = `${poolId}_${key}`;
      this.disposeExportResource(resourceId);
      pool.stats.disposed++;
    });

    // Clear pool data structures
    pool.resources.clear();
    pool.available.clear();
    pool.inUse.clear();

    memoryLogger.info('Resource pool cleared', {
      poolId,
      disposed: pool.stats.disposed,
      finalStats: pool.stats
    });
  }

  /**
   * Monitor memory usage and detect pressure
   * @private
   */
  monitorMemoryUsage() {
    const snapshot = this.takeMemorySnapshot('periodic_monitor');

    if (!snapshot.available) {
      return; // Memory monitoring not available
    }

    // Update memory snapshots (keep last 20)
    this.memorySnapshots.push(snapshot);
    if (this.memorySnapshots.length > 20) {
      this.memorySnapshots.shift();
    }

    // Update peak usage
    if (snapshot.usagePercent > this.peakMemoryUsage) {
      this.peakMemoryUsage = snapshot.usagePercent;
    }

    // Determine memory pressure
    const previousPressure = this.currentPressure;
    this.currentPressure = this.calculateMemoryPressure(snapshot.usagePercent);

    // Log pressure changes
    if (this.currentPressure !== previousPressure) {
      memoryLogger.info('Memory pressure changed', {
        from: previousPressure,
        to: this.currentPressure,
        usagePercent: snapshot.usagePercent,
        exportId: this.exportId,
        phase: this.currentPhase
      });

      // Add warning for high pressure
      if (this.currentPressure === MemoryPressure.HIGH || this.currentPressure === MemoryPressure.CRITICAL) {
        this.addMemoryWarning({
          level: this.currentPressure,
          message: `Memory pressure ${this.currentPressure}: ${snapshot.usagePercent.toFixed(1)}% usage`,
          snapshot,
          timestamp: performance.now(),
          recommendations: this.getMemoryRecommendations()
        });
      }
    }

    // Trigger automatic cleanup if needed
    if (snapshot.usagePercent > this.options.cleanupThreshold * 100) {
      this.performProactiveCleanup();
    }

    // Emergency cleanup for critical pressure
    if (this.currentPressure === MemoryPressure.CRITICAL && this.emergencyCleanupEnabled) {
      const timeSinceLastEmergency = performance.now() - this.lastEmergencyCleanup;
      if (timeSinceLastEmergency > 30000) { // 30 seconds minimum between emergency cleanups
        this.performEmergencyCleanup();
      }
    }

    if (this.options.verboseLogging) {
      memoryLogger.debug('Memory monitoring update', {
        usage: snapshot.usage,
        pressure: this.currentPressure,
        peakUsage: this.peakMemoryUsage,
        trackedResources: this.exportResources.size,
        temporaryResources: this.temporaryResources.size
      });
    }
  }

  /**
   * Calculate memory pressure level
   * @param {number} usagePercent - Memory usage percentage
   * @returns {string} - Memory pressure level
   * @private
   */
  calculateMemoryPressure(usagePercent) {
    if (usagePercent >= 85) return MemoryPressure.CRITICAL;
    if (usagePercent >= 70) return MemoryPressure.HIGH;
    if (usagePercent >= 50) return MemoryPressure.MODERATE;
    return MemoryPressure.LOW;
  }

  /**
   * Take a memory usage snapshot
   * @param {string} label - Snapshot label
   * @returns {Object} - Memory snapshot data
   * @private
   */
  takeMemorySnapshot(label) {
    const volumetricStats = getVolumetricMemoryStats();
    const timestamp = performance.now();

    const snapshot = {
      label,
      timestamp,
      exportId: this.exportId,
      phase: this.currentPhase,
      ...volumetricStats,
      // Additional export-specific metrics
      trackedResources: this.exportResources.size,
      temporaryResources: this.temporaryResources.size,
      clonedObjects: this.clonedObjects.size,
      resourcePools: this.resourcePools.size
    };

    // Calculate usage percentage if available
    if (volumetricStats.available && volumetricStats.usage) {
      const usageMatch = volumetricStats.usage.match(/(\d+\.?\d*)%/);
      if (usageMatch) {
        snapshot.usagePercent = parseFloat(usageMatch[1]);
      }
    }

    return snapshot;
  }

  /**
   * Check memory pressure and take action
   * @private
   */
  checkMemoryPressure() {
    const snapshot = this.takeMemorySnapshot('pressure_check');

    if (snapshot.usagePercent > this.options.warningThreshold * 100) {
      this.addMemoryWarning({
        level: 'warning',
        message: `Memory usage warning: ${snapshot.usagePercent.toFixed(1)}%`,
        snapshot,
        timestamp: performance.now(),
        phase: this.currentPhase,
        recommendations: this.getMemoryRecommendations()
      });
    }

    if (snapshot.usagePercent > this.options.criticalThreshold * 100) {
      this.addMemoryWarning({
        level: 'critical',
        message: `Critical memory usage: ${snapshot.usagePercent.toFixed(1)}%`,
        snapshot,
        timestamp: performance.now(),
        phase: this.currentPhase,
        recommendations: ['Reduce geological model complexity', 'Enable lower quality settings', 'Clean up temporary resources']
      });
    }
  }

  /**
   * Add a memory warning
   * @param {Object} warning - Warning details
   * @private
   */
  addMemoryWarning(warning) {
    this.memoryWarnings.push(warning);

    // Keep only last 10 warnings
    if (this.memoryWarnings.length > 10) {
      this.memoryWarnings.shift();
    }

    // Log the warning
    const logLevel = warning.level === 'critical' ? 'error' : 'warn';
    memoryLogger.log(logLevel, warning.message, {
      exportId: this.exportId,
      phase: this.currentPhase,
      recommendations: warning.recommendations
    });
  }

  /**
   * Get memory optimization recommendations
   * @returns {Array<string>} - Array of recommendation strings
   * @private
   */
  getMemoryRecommendations() {
    const recommendations = [];

    if (this.temporaryResources.size > 50) {
      recommendations.push('Clean up temporary resources');
    }

    if (this.clonedObjects.size > 20) {
      recommendations.push('Reduce object cloning');
    }

    if (this.exportResources.size > 200) {
      recommendations.push('Consider batch processing');
    }

    if (this.resourcePools.size === 0) {
      recommendations.push('Enable resource pooling');
    }

    return recommendations;
  }

  /**
   * Perform periodic cleanup
   * @private
   */
  performPeriodicCleanup() {
    const startTime = performance.now();
    let cleanedCount = 0;

    memoryLogger.debug('Starting periodic cleanup', {
      exportId: this.exportId,
      phase: this.currentPhase,
      trackedResources: this.exportResources.size,
      temporaryResources: this.temporaryResources.size
    });

    // Clean up idle resource pools
    this.resourcePools.forEach((pool, poolId) => {
      const idleTime = startTime - pool.lastUsed;
      if (idleTime > pool.options.idleTimeout) {
        this.clearResourcePool(poolId);
        cleanedCount++;
      }
    });

    // Clean up old temporary resources
    const tempThreshold = 60000; // 1 minute
    const tempToRemove = [];

    this.temporaryResources.forEach(resourceId => {
      const tracked = this.exportResources.get(resourceId);
      if (tracked && (startTime - tracked.metadata.trackedAt) > tempThreshold) {
        tempToRemove.push(resourceId);
      }
    });

    tempToRemove.forEach(resourceId => {
      this.disposeExportResource(resourceId);
      cleanedCount++;
    });

    const duration = performance.now() - startTime;

    if (cleanedCount > 0 || this.options.verboseLogging) {
      memoryLogger.info('Periodic cleanup completed', {
        duration: duration.toFixed(2),
        resourcesCleaned: cleanedCount,
        remainingResources: this.exportResources.size
      });
    }
  }

  /**
   * Perform proactive cleanup based on memory pressure
   * @private
   */
  performProactiveCleanup() {
    const startTime = performance.now();
    let cleanedCount = 0;

    memoryLogger.info('Starting proactive cleanup due to memory pressure', {
      pressure: this.currentPressure,
      trackedResources: this.exportResources.size,
      temporaryResources: this.temporaryResources.size
    });

    // Clean up all temporary resources
    const tempResources = Array.from(this.temporaryResources);
    tempResources.forEach(resourceId => {
      this.disposeExportResource(resourceId);
      cleanedCount++;
    });

    // Clean up idle resource pools
    this.resourcePools.forEach((pool, poolId) => {
      if (pool.available.size > pool.options.cleanupThreshold) {
        // Remove excess resources from pool
        const toRemove = Array.from(pool.available).slice(pool.options.cleanupThreshold);
        toRemove.forEach(key => {
          const resourceId = `${poolId}_${key}`;
          this.disposeExportResource(resourceId);
          pool.resources.delete(key);
          pool.available.delete(key);
          pool.stats.disposed++;
          cleanedCount++;
        });
      }
    });

    // Force garbage collection if available (Chrome DevTools)
    if (window.gc && cleanedCount > 0) {
      try {
        window.gc();
      } catch (e) {
        // Ignore if not available
      }
    }

    const duration = performance.now() - startTime;

    memoryLogger.info('Proactive cleanup completed', {
      duration: duration.toFixed(2),
      resourcesCleaned: cleanedCount,
      remainingResources: this.exportResources.size,
      currentPressure: this.currentPressure
    });
  }

  /**
   * Perform emergency cleanup for critical memory situations
   * @private
   */
  performEmergencyCleanup() {
    const startTime = performance.now();
    this.lastEmergencyCleanup = startTime;

    memoryLogger.warn('EMERGENCY CLEANUP TRIGGERED - Critical memory pressure detected', {
      exportId: this.exportId,
      phase: this.currentPhase,
      trackedResources: this.exportResources.size,
      memoryPressure: this.currentPressure
    });

    let cleanedCount = 0;

    try {
      // 1. Clear all temporary resources immediately
      const tempResources = Array.from(this.temporaryResources);
      tempResources.forEach(resourceId => {
        try {
          this.disposeExportResource(resourceId);
          cleanedCount++;
        } catch (error) {
          memoryLogger.error('Error disposing temporary resource during emergency cleanup', {
            resourceId,
            error: error.message
          });
        }
      });

      // 2. Clear all resource pools
      this.resourcePools.forEach((pool, poolId) => {
        try {
          this.clearResourcePool(poolId);
          cleanedCount += pool.resources.size;
        } catch (error) {
          memoryLogger.error('Error clearing resource pool during emergency cleanup', {
            poolId,
            error: error.message
          });
        }
      });

      // 3. Clear cloned objects
      this.clonedObjects.forEach((cloneInfo, resourceId) => {
        try {
          this.disposeExportResource(resourceId);
          cleanedCount++;
        } catch (error) {
          memoryLogger.error('Error disposing cloned resource during emergency cleanup', {
            resourceId,
            error: error.message
          });
        }
      });

      // 4. Force garbage collection multiple times
      if (window.gc) {
        try {
          window.gc();
          window.gc();
          window.gc();
        } catch (e) {
          // Ignore if not available
        }
      }

      // 5. Wait a moment for GC to run
      await new Promise(resolve => setTimeout(resolve, 100));

      const duration = performance.now() - startTime;

      // Take post-cleanup snapshot
      const postSnapshot = this.takeMemorySnapshot('post_emergency_cleanup');

      memoryLogger.warn('Emergency cleanup completed', {
        duration: duration.toFixed(2),
        resourcesCleaned: cleanedCount,
        remainingResources: this.exportResources.size,
        memoryBefore: this.currentPressure,
        memoryAfter: this.calculateMemoryPressure(postSnapshot.usagePercent || 0)
      });

      // Add emergency cleanup warning
      this.addMemoryWarning({
        level: 'emergency',
        message: `Emergency cleanup performed - cleaned ${cleanedCount} resources`,
        snapshot: postSnapshot,
        timestamp: performance.now(),
        phase: this.currentPhase,
        recommendations: ['Consider reducing geological model complexity', 'Enable lower quality export settings']
      });

    } catch (error) {
      memoryLogger.error('Error during emergency cleanup', {
        error: error.message,
        stack: error.stack
      });
    }
  }

  /**
   * Dispose a specific export resource
   * @param {string} resourceId - Resource identifier
   * @returns {boolean} - Whether disposal was successful
   */
  disposeExportResource(resourceId) {
    const tracked = this.exportResources.get(resourceId);
    if (!tracked) {
      if (this.options.verboseLogging) {
        memoryLogger.warn('Attempted to dispose non-existent export resource', { resourceId });
      }
      return false;
    }

    try {
      const { resource, type } = tracked;

      // Use specialized disposal strategy
      const success = this.disposeResource(resource, type);

      if (success) {
        // Remove from tracking
        this.exportResources.delete(resourceId);
        this.temporaryResources.delete(resourceId);
        this.clonedObjects.delete(resourceId);

        // Remove from parent class tracking
        this.dispose(resourceId);

        if (this.options.verboseLogging) {
          memoryLogger.debug('Export resource disposed', { resourceId, type });
        }

        return true;
      } else {
        memoryLogger.warn('Failed to dispose export resource', { resourceId, type });
        return false;
      }

    } catch (error) {
      memoryLogger.error('Error disposing export resource', {
        resourceId,
        error: error.message,
        stack: error.stack
      });
      return false;
    }
  }

  /**
   * Dispose a resource using appropriate strategy
   * @param {*} resource - Resource to dispose
   * @param {string} type - Resource type
   * @returns {boolean} - Whether disposal was successful
   * @private
   */
  disposeResource(resource, type) {
    const strategy = this.cleanupStrategies.get(type);
    if (strategy) {
      try {
        return strategy(resource);
      } catch (error) {
        memoryLogger.error('Error in disposal strategy', {
          type,
          error: error.message
        });
        return false;
      }
    } else {
      // Fallback disposal
      if (resource && typeof resource.dispose === 'function') {
        resource.dispose();
        return true;
      }
      return false;
    }
  }

  /**
   * Estimate the memory size of a resource
   * @param {*} resource - Resource to estimate
   * @returns {number} - Estimated size in bytes
   * @private
   */
  estimateResourceSize(resource) {
    if (!resource) return 0;

    try {
      if (resource instanceof BufferGeometry) {
        let size = 0;
        Object.values(resource.attributes).forEach(attribute => {
          if (attribute.array) {
            size += attribute.array.byteLength;
          }
        });
        if (resource.index && resource.index.array) {
          size += resource.index.array.byteLength;
        }
        return size;
      }

      if (resource instanceof Texture) {
        if (resource.image) {
          const width = resource.image.width || 512;
          const height = resource.image.height || 512;
          return width * height * 4; // Assume RGBA
        }
      }

      if (resource instanceof Material) {
        // Rough estimate for material
        return 1024; // 1KB baseline
      }

      // Generic size estimation
      return 1024;

    } catch (error) {
      return 0;
    }
  }

  /**
   * Get comprehensive export memory statistics
   * @returns {Object} - Complete memory statistics
   */
  getExportMemoryStats() {
    const baseStats = this.getEnhancedStats();
    const currentSnapshot = this.takeMemorySnapshot('stats_request');

    // Calculate resource type distribution
    const resourceTypeDistribution = new Map();
    this.exportResources.forEach(tracked => {
      const count = resourceTypeDistribution.get(tracked.type) || 0;
      resourceTypeDistribution.set(tracked.type, count + 1);
    });

    // Calculate pool statistics
    const poolStats = new Map();
    this.resourcePools.forEach((pool, poolId) => {
      poolStats.set(poolId, pool.getStats ? pool.getStats() : pool.stats);
    });

    // Phase statistics
    const phaseStats = new Map();
    this.phaseMetrics.forEach((metrics, phase) => {
      phaseStats.set(phase, {
        duration: metrics.duration,
        memoryAtEnd: metrics.memorySnapshot?.usagePercent || 0
      });
    });

    return {
      // Base statistics from parent class
      ...baseStats,

      // Export-specific statistics
      export: {
        id: this.exportId,
        phase: this.currentPhase,
        duration: this.startTime ? performance.now() - this.startTime : 0,
        resourcesTracked: this.exportResources.size,
        temporaryResources: this.temporaryResources.size,
        clonedObjects: this.clonedObjects.size,
        resourcePools: this.resourcePools.size
      },

      // Memory monitoring
      memoryMonitoring: {
        currentPressure: this.currentPressure,
        peakUsage: this.peakMemoryUsage,
        warningsCount: this.memoryWarnings.length,
        snapshotsCount: this.memorySnapshots.length,
        lastSnapshot: currentSnapshot
      },

      // Resource distributions
      resourceTypes: Object.fromEntries(resourceTypeDistribution),
      resourcePools: Object.fromEntries(poolStats),
      phaseMetrics: Object.fromEntries(phaseStats),

      // Performance metrics
      performance: {
        monitoringEnabled: !!this.monitoringTimer,
        cleanupEnabled: !!this.cleanupTimer,
        emergencyCleanupEnabled: this.emergencyCleanupEnabled,
        lastEmergencyCleanup: this.lastEmergencyCleanup
      },

      // Recommendations
      recommendations: this.getMemoryRecommendations()
    };
  }

  /**
   * Get memory warnings
   * @returns {Array<Object>} - Array of memory warnings
   */
  getMemoryWarnings() {
    return [...this.memoryWarnings];
  }

  /**
   * Clear memory warnings
   */
  clearMemoryWarnings() {
    this.memoryWarnings = [];
    memoryLogger.info('Memory warnings cleared');
  }

  /**
   * Clean up all export resources and complete the export operation
   * @param {boolean} force - Force cleanup even if export is in progress
   */
  cleanupExportOperation(force = false) {
    if (!force && this.currentPhase === ExportPhase.PROCESSING) {
      memoryLogger.warn('Attempted to cleanup export during processing phase', {
        exportId: this.exportId,
        phase: this.currentPhase
      });
      return;
    }

    const startTime = performance.now();
    let cleanedCount = 0;

    memoryLogger.info('Cleaning up export operation', {
      exportId: this.exportId,
      phase: this.currentPhase,
      force,
      trackedResources: this.exportResources.size
    });

    try {
      // Set cleanup phase
      this.setExportPhase(ExportPhase.CLEANING);

      // Dispose all export resources
      const allResources = Array.from(this.exportResources.keys());
      allResources.forEach(resourceId => {
        if (this.disposeExportResource(resourceId)) {
          cleanedCount++;
        }
      });

      // Clear resource pools
      this.resourcePools.forEach((pool, poolId) => {
        this.clearResourcePool(poolId);
      });

      // Clear all tracking data structures
      this.exportResources.clear();
      this.temporaryResources.clear();
      this.clonedObjects.clear();
      this.resourcePools.clear();
      this.performanceMetrics.clear();
      this.phaseMetrics.clear();

      // Take final snapshot
      const finalSnapshot = this.takeMemorySnapshot('export_cleanup_complete');
      this.memorySnapshots.push(finalSnapshot);

      // Reset export state
      const totalDuration = this.startTime ? performance.now() - this.startTime : 0;
      this.currentPhase = ExportPhase.COMPLETED;
      this.exportId = null;
      this.startTime = null;
      this.phaseStartTime = null;

      const cleanupDuration = performance.now() - startTime;

      memoryLogger.info('Export operation cleanup completed', {
        totalDuration: totalDuration.toFixed(2),
        cleanupDuration: cleanupDuration.toFixed(2),
        resourcesCleaned: cleanedCount,
        finalMemoryUsage: finalSnapshot.usage,
        peakMemoryUsage: this.peakMemoryUsage
      });

      // Force garbage collection
      if (window.gc && cleanedCount > 50) {
        try {
          window.gc();
        } catch (e) {
          // Ignore if not available
        }
      }

      return {
        success: true,
        duration: cleanupDuration,
        resourcesCleaned: cleanedCount,
        totalDuration,
        finalSnapshot
      };

    } catch (error) {
      memoryLogger.error('Error during export operation cleanup', {
        exportId: this.exportId,
        error: error.message,
        stack: error.stack
      });

      // Force reset state
      this.currentPhase = ExportPhase.FAILED;

      return {
        success: false,
        error: error.message,
        duration: performance.now() - startTime
      };
    }
  }

  /**
   * Handle cancelled export operation
   * @param {string} reason - Cancellation reason
   */
  handleExportCancellation(reason = 'User cancelled') {
    memoryLogger.info('Export operation cancelled', {
      exportId: this.exportId,
      phase: this.currentPhase,
      reason
    });

    this.setExportPhase(ExportPhase.CANCELLED, { reason });

    // Cleanup with force flag
    return this.cleanupExportOperation(true);
  }

  /**
   * Dispose all resources and stop monitoring
   */
  dispose() {
    memoryLogger.info('Disposing ExportMemoryManager');

    // Stop monitoring
    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
      this.monitoringTimer = null;
    }

    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    // Cleanup any active export operation
    if (this.currentPhase !== ExportPhase.IDLE && this.currentPhase !== ExportPhase.COMPLETED) {
      this.cleanupExportOperation(true);
    }

    // Dispose all remaining resources
    this.disposeAll();

    // Clear all data structures
    this.exportResources.clear();
    this.temporaryResources.clear();
    this.clonedObjects.clear();
    this.resourcePools.clear();
    this.performanceMetrics.clear();
    this.phaseMetrics.clear();
    this.memorySnapshots = [];
    this.memoryWarnings = [];

    memoryLogger.info('ExportMemoryManager disposed');
  }

  /**
   * Get debug information for development
   * @returns {Object} - Debug information
   */
  getDebugInfo() {
    if (!this.options.debugMode) {
      return { debugMode: false };
    }

    return {
      debugMode: true,
      currentState: {
        exportId: this.exportId,
        phase: this.currentPhase,
        startTime: this.startTime,
        pressure: this.currentPressure
      },
      resources: {
        tracked: this.exportResources.size,
        temporary: this.temporaryResources.size,
        cloned: this.clonedObjects.size,
        pools: this.resourcePools.size
      },
      monitoring: {
        snapshots: this.memorySnapshots.length,
        warnings: this.memoryWarnings.length,
        peakUsage: this.peakMemoryUsage
      },
      options: this.options,
      cleanupStrategies: Array.from(this.cleanupStrategies.keys()),
      memorySnapshots: this.memorySnapshots.slice(-5), // Last 5 snapshots
      memoryWarnings: this.memoryWarnings.slice(-3)    // Last 3 warnings
    };
  }
}

// Export the main class and utility functions
export default ExportMemoryManager;

// Export convenience functions
export {
  ExportPhase,
  MemoryPressure,
  ResourceType
};

/**
 * Create a singleton export memory manager instance
 */
let exportMemoryManagerInstance = null;

export function getExportMemoryManager(options = {}) {
  if (!exportMemoryManagerInstance) {
    exportMemoryManagerInstance = new ExportMemoryManager(options);
  }
  return exportMemoryManagerInstance;
}

/**
 * Dispose the singleton instance
 */
export function disposeExportMemoryManager() {
  if (exportMemoryManagerInstance) {
    exportMemoryManagerInstance.dispose();
    exportMemoryManagerInstance = null;
  }
}