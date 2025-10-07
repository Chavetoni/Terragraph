/**
 * Optimized Memory Management Utilities
 * Enhanced resource tracking and disposal for Three.js objects
 */

import { BoxGeometry, BufferGeometry, CanvasTexture, CylinderGeometry, Material, Mesh, MeshBasicMaterial, MeshLambertMaterial, MeshPhongMaterial, MeshStandardMaterial, PlaneGeometry, SphereGeometry, Texture, WebGLRenderTarget } from 'three';
import { memoryLogger, performanceLogger } from './Logger.js';

/**
 * Resource Manager with automatic cleanup and monitoring
 */
export class ResourceManager {
  constructor() {
    // Use WeakMaps for automatic garbage collection
    this.geometries = new WeakMap();
    this.materials = new WeakMap();
    this.textures = new WeakMap();
    
    // Track resource counts
    this.stats = {
      geometries: 0,
      materials: 0,
      textures: 0,
      meshes: 0,
      totalMemory: 0
    };
    
    // Memory monitoring
    this.memoryMonitor = null;
    this.memoryThreshold = 500 * 1024 * 1024; // 500MB threshold
  }

  /**
   * Track a resource
   */
  track(resource, type) {
    switch (type) {
      case 'geometry':
        this.geometries.set(resource, Date.now());
        this.stats.geometries++;
        break;
      case 'material':
        this.materials.set(resource, Date.now());
        this.stats.materials++;
        break;
      case 'texture':
        this.textures.set(resource, Date.now());
        this.stats.textures++;
        break;
      case 'mesh':
        this.stats.meshes++;
        break;
    }
  }

  /**
   * Dispose a single resource
   */
  disposeResource(resource) {
    if (!resource) return;
    
    if (resource.dispose) {
      resource.dispose();
    }
    
    // Update stats
    if (resource instanceof BufferGeometry) {
      this.stats.geometries--;
    } else if (resource instanceof Material) {
      this.stats.materials--;
    } else if (resource instanceof Texture) {
      this.stats.textures--;
    }
  }

  /**
   * Dispose an object and all its resources
   */
  disposeObject(object) {
    if (!object) return;
    
    const disposedResources = new Set();
    
    object.traverse((child) => {
      if (child instanceof Mesh) {
        // Dispose geometry
        if (child.geometry && !disposedResources.has(child.geometry)) {
          this.disposeResource(child.geometry);
          disposedResources.add(child.geometry);
        }
        
        // Dispose material(s)
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        materials.forEach(material => {
          if (material && !disposedResources.has(material)) {
            this.disposeMaterial(material);
            disposedResources.add(material);
          }
        });
        
        this.stats.meshes--;
      }
    });
    
    // Clear children
    while (object.children.length > 0) {
      object.remove(object.children[0]);
    }
    
    // Remove from parent if exists
    if (object.parent) {
      object.parent.remove(object);
    }
  }

  /**
   * Dispose material and its textures
   */
  disposeMaterial(material) {
    if (!material) return;
    
    // Dispose all texture types
    const textureProps = [
      'map', 'alphaMap', 'aoMap', 'bumpMap', 'displacementMap',
      'emissiveMap', 'envMap', 'lightMap', 'metalnessMap',
      'normalMap', 'roughnessMap', 'specularMap', 'gradientMap'
    ];
    
    textureProps.forEach(prop => {
      if (material[prop]) {
        this.disposeTexture(material[prop]);
      }
    });
    
    // Dispose uniform textures for ShaderMaterial
    if (material.uniforms) {
      Object.values(material.uniforms).forEach(uniform => {
        if (uniform.value instanceof Texture) {
          this.disposeTexture(uniform.value);
        }
      });
    }
    
    this.disposeResource(material);
  }

  /**
   * Dispose texture
   */
  disposeTexture(texture) {
    if (!texture) return;
    
    // Dispose the texture
    this.disposeResource(texture);
    
    // If it's a render target, dispose its textures too
    if (texture instanceof WebGLRenderTarget) {
      this.disposeTexture(texture.texture);
      this.disposeTexture(texture.depthTexture);
    }
  }

  /**
   * Get memory statistics
   */
  getMemoryStats() {
    const stats = { ...this.stats };
    
    // Add browser memory info if available
    if (performance.memory) {
      stats.jsHeapUsed = (performance.memory.usedJSHeapSize / 1048576).toFixed(2) + ' MB';
      stats.jsHeapTotal = (performance.memory.totalJSHeapSize / 1048576).toFixed(2) + ' MB';
      stats.jsHeapLimit = (performance.memory.jsHeapSizeLimit / 1048576).toFixed(2) + ' MB';
      stats.usage = ((performance.memory.usedJSHeapSize / performance.memory.jsHeapSizeLimit) * 100).toFixed(2) + '%';
    }
    
    return stats;
  }

  /**
   * Start memory monitoring
   */
  startMemoryMonitoring(callback, interval = 5000) {
    this.stopMemoryMonitoring();
    
    this.memoryMonitor = setInterval(() => {
      const stats = this.getMemoryStats();
      
      // Check if memory usage is high
      if (performance.memory) {
        const usage = performance.memory.usedJSHeapSize;
        if (usage > this.memoryThreshold) {
          memoryLogger.warn('High memory usage detected:', stats);
          if (callback) callback('high', stats);
        }
      }
      
      if (callback) callback('normal', stats);
    }, interval);
  }

  /**
   * Stop memory monitoring
   */
  stopMemoryMonitoring() {
    if (this.memoryMonitor) {
      clearInterval(this.memoryMonitor);
      this.memoryMonitor = null;
    }
  }

  /**
   * Clear all tracked resources
   */
  clear() {
    this.geometries = new WeakMap();
    this.materials = new WeakMap();
    this.textures = new WeakMap();
    this.stats = {
      geometries: 0,
      materials: 0,
      textures: 0,
      meshes: 0,
      totalMemory: 0
    };
  }
}

/**
 * Object Pool for reusable Three.js objects
 */
export class ObjectPool {
  constructor(createFn, resetFn, maxSize = 100) {
    this.createFn = createFn;
    this.resetFn = resetFn;
    this.maxSize = maxSize;
    this.available = [];
    this.inUse = new Set();
  }

  /**
   * Get an object from the pool
   */
  acquire(...args) {
    let obj;
    
    if (this.available.length > 0) {
      obj = this.available.pop();
      if (this.resetFn) {
        this.resetFn(obj, ...args);
      }
    } else {
      obj = this.createFn(...args);
    }
    
    this.inUse.add(obj);
    return obj;
  }

  /**
   * Return an object to the pool
   */
  release(obj) {
    if (!this.inUse.has(obj)) return;
    
    this.inUse.delete(obj);
    
    if (this.available.length < this.maxSize) {
      this.available.push(obj);
    } else {
      // Dispose if pool is full
      if (obj.dispose) obj.dispose();
    }
  }

  /**
   * Release all objects in use
   */
  releaseAll() {
    this.inUse.forEach(obj => this.release(obj));
  }

  /**
   * Clear the pool
   */
  clear() {
    // Dispose all objects
    this.available.forEach(obj => {
      if (obj.dispose) obj.dispose();
    });
    this.inUse.forEach(obj => {
      if (obj.dispose) obj.dispose();
    });
    
    this.available = [];
    this.inUse.clear();
  }

  /**
   * Get pool statistics
   */
  getStats() {
    return {
      available: this.available.length,
      inUse: this.inUse.size,
      total: this.available.length + this.inUse.size,
      maxSize: this.maxSize
    };
  }
}

/**
 * Geometry Pool for common shapes
 */
export class GeometryPool {
  constructor() {
    this.pools = new Map();
  }

  /**
   * Get or create a geometry
   */
  get(type, ...args) {
    const key = `${type}_${args.join('_')}`;
    
    if (!this.pools.has(key)) {
      let createFn;
      
      switch (type) {
        case 'box':
          createFn = () => new BoxGeometry(...args);
          break;
        case 'sphere':
          createFn = () => new SphereGeometry(...args);
          break;
        case 'cylinder':
          createFn = () => new CylinderGeometry(...args);
          break;
        case 'plane':
          createFn = () => new PlaneGeometry(...args);
          break;
        default:
          throw new Error(`Unknown geometry type: ${type}`);
      }
      
      const pool = new ObjectPool(createFn, null, 10);
      this.pools.set(key, pool);
    }
    
    return this.pools.get(key).acquire();
  }

  /**
   * Release a geometry back to its pool
   */
  release(type, geometry, ...args) {
    const key = `${type}_${args.join('_')}`;
    const pool = this.pools.get(key);
    
    if (pool) {
      pool.release(geometry);
    }
  }

  /**
   * Clear all pools
   */
  clear() {
    this.pools.forEach(pool => pool.clear());
    this.pools.clear();
  }
}

/**
 * Material Cache for reusable materials
 */
export class MaterialCache {
  constructor(maxSize = 100) {
    this.cache = new Map();
    this.maxSize = maxSize;
  }

  /**
   * Get or create a material
   */
  get(type, config) {
    const key = `${type}_${JSON.stringify(config)}`;
    
    if (this.cache.has(key)) {
      return this.cache.get(key);
    }
    
    if (this.cache.size >= this.maxSize) {
      // Remove oldest entry
      const firstKey = this.cache.keys().next().value;
      const material = this.cache.get(firstKey);
      if (material.dispose) material.dispose();
      this.cache.delete(firstKey);
    }
    
    let material;
    switch (type) {
      case 'standard':
        material = new MeshStandardMaterial(config);
        break;
      case 'basic':
        material = new MeshBasicMaterial(config);
        break;
      case 'phong':
        material = new MeshPhongMaterial(config);
        break;
      case 'lambert':
        material = new MeshLambertMaterial(config);
        break;
      default:
        material = new MeshStandardMaterial(config);
    }
    
    this.cache.set(key, material);
    return material;
  }

  /**
   * Clear the cache
   */
  clear() {
    this.cache.forEach(material => {
      if (material.dispose) material.dispose();
    });
    this.cache.clear();
  }
}

/**
 * Texture Atlas Manager for efficient texture usage
 */
export class TextureAtlasManager {
  constructor(size = 2048) {
    this.size = size;
    this.canvas = document.createElement('canvas');
    this.canvas.width = size;
    this.canvas.height = size;
    this.ctx = this.canvas.getContext('2d');
    this.texture = null;
    this.regions = new Map();
    this.nextX = 0;
    this.nextY = 0;
    this.rowHeight = 0;
  }

  /**
   * Add an image to the atlas
   */
  add(id, image) {
    const padding = 2;
    const width = image.width + padding * 2;
    const height = image.height + padding * 2;
    
    // Check if we need to move to next row
    if (this.nextX + width > this.size) {
      this.nextX = 0;
      this.nextY += this.rowHeight;
      this.rowHeight = 0;
    }
    
    // Check if we have space
    if (this.nextY + height > this.size) {
      memoryLogger.warn('Texture atlas is full');
      return null;
    }
    
    // Draw image to atlas
    this.ctx.drawImage(image, this.nextX + padding, this.nextY + padding);
    
    // Store region info
    const region = {
      x: this.nextX + padding,
      y: this.nextY + padding,
      width: image.width,
      height: image.height,
      u1: (this.nextX + padding) / this.size,
      v1: (this.nextY + padding) / this.size,
      u2: (this.nextX + padding + image.width) / this.size,
      v2: (this.nextY + padding + image.height) / this.size
    };
    
    this.regions.set(id, region);
    
    // Update position
    this.nextX += width;
    this.rowHeight = Math.max(this.rowHeight, height);
    
    // Update texture
    this.updateTexture();
    
    return region;
  }

  /**
   * Get UV coordinates for a region
   */
  getUVs(id) {
    const region = this.regions.get(id);
    if (!region) return null;
    
    return [
      region.u1, region.v1,
      region.u2, region.v1,
      region.u2, region.v2,
      region.u1, region.v2
    ];
  }

  /**
   * Update the Three.js texture
   */
  updateTexture() {
    if (!this.texture) {
      this.texture = new CanvasTexture(this.canvas);
      this.texture.needsUpdate = true;
    } else {
      this.texture.needsUpdate = true;
    }
    return this.texture;
  }

  /**
   * Clear the atlas
   */
  clear() {
    this.ctx.clearRect(0, 0, this.size, this.size);
    this.regions.clear();
    this.nextX = 0;
    this.nextY = 0;
    this.rowHeight = 0;
    
    if (this.texture) {
      this.texture.dispose();
      this.texture = null;
    }
  }
}

// Export singleton instances for global use
export const globalResourceManager = new ResourceManager();
export const globalGeometryPool = new GeometryPool();
export const globalMaterialCache = new MaterialCache();

// Auto-cleanup on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    globalResourceManager.clear();
    globalGeometryPool.clear();
    globalMaterialCache.clear();
  });
}