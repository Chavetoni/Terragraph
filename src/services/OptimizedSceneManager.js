import { BoxGeometry, Color, CylinderGeometry, DoubleSide, Group, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, MeshPhongMaterial, MeshStandardMaterial, Quaternion, SphereGeometry, Vector3 } from 'three';
import { mergeBufferGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils';
import { getStrataDimensions, getBoreholeDimensions, getDepthMarkerDimensions } from '../utils/scaleConstants';
import { createGlassmorphismLabel } from '../utils/threeJsHelpers';
import { formatDepthMetersToFeet } from '../utils/unitConverter.js';

/**
 * Optimized Scene Manager with improved resource management and performance
 */
class OptimizedSceneManager {
  constructor(scene, css3DScene = null) {
    this.scene = scene;
    this.css3DScene = css3DScene;
    
    // Use Maps for O(1) lookups
    this.objects = new Map();
    this.css3DObjects = new Map();
    
    // Resource tracking with weak references where possible
    this.resources = {
      geometries: new Set(),
      materials: new Set(),
      textures: new Set(),
      objects: new WeakSet() // Use WeakSet for automatic cleanup
    };
    
    // Object pools for reuse
    this.geometryPool = new Map();
    this.materialPool = new Map();
    
    // Batch operations queue
    this.pendingOperations = [];
    this.frameId = null;
  }

  /**
   * Add object with batched scene updates
   */
  add(name, object, immediate = false) {
    if (this.objects.has(name)) {
      this.remove(name, immediate);
    }
    
    this.objects.set(name, object);
    this.resources.objects.add(object);
    
    if (immediate) {
      this.scene.add(object);
    } else {
      this.queueOperation(() => this.scene.add(object));
    }
  }

  /**
   * Add CSS3D object with cleanup
   */
  addCSS3D(name, object) {
    if (this.css3DObjects.has(name)) {
      this.removeCSS3D(name);
    }
    
    this.css3DObjects.set(name, object);
    if (this.css3DScene) {
      this.css3DScene.add(object);
    }
  }

  /**
   * Remove object with proper disposal
   */
  remove(name, immediate = false) {
    const object = this.objects.get(name);
    if (!object) return;
    
    const removeOp = () => {
      this.scene.remove(object);
      this.disposeObject(object);
      this.objects.delete(name);
    };
    
    if (immediate) {
      removeOp();
    } else {
      this.queueOperation(removeOp);
    }
  }

  /**
   * Queue operation for batched execution
   */
  queueOperation(operation) {
    this.pendingOperations.push(operation);
    
    if (!this.frameId) {
      this.frameId = requestAnimationFrame(() => {
        this.executePendingOperations();
      });
    }
  }

  /**
   * Execute all pending operations in batch
   */
  executePendingOperations() {
    const operations = this.pendingOperations.splice(0);
    operations.forEach(op => op());
    this.frameId = null;
  }

  /**
   * Get or create pooled geometry
   */
  getPooledGeometry(type, ...args) {
    const key = `${type}_${args.join('_')}`;
    
    if (!this.geometryPool.has(key)) {
      let geometry;
      switch (type) {
        case 'cylinder':
          geometry = new CylinderGeometry(...args);
          break;
        case 'box':
          geometry = new BoxGeometry(...args);
          break;
        case 'sphere':
          geometry = new SphereGeometry(...args);
          break;
        default:
          throw new Error(`Unknown geometry type: ${type}`);
      }
      this.geometryPool.set(key, geometry);
      this.resources.geometries.add(geometry);
    }
    
    return this.geometryPool.get(key);
  }

  /**
   * Get or create pooled material
   */
  getPooledMaterial(type, config) {
    const key = `${type}_${JSON.stringify(config)}`;
    
    if (!this.materialPool.has(key)) {
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
        default:
          material = new MeshStandardMaterial(config);
      }
      this.materialPool.set(key, material);
      this.resources.materials.add(material);
    }
    
    return this.materialPool.get(key);
  }

  /**
   * Optimized borehole drawing with instancing for large datasets
   */
  drawBoreholes(boreholes, displayOptions, soilLayers) {
    // Remove existing boreholes
    this.remove('boreholes', true);
    
    // Clear existing labels efficiently
    this.clearCSS3DByPrefix('simple-borehole-label-');
    
    if (!boreholes || boreholes.length === 0) return;
    
    const boreholeGroup = new Group();
    boreholeGroup.name = 'boreholes';
    
    const boreholeDims = getBoreholeDimensions();
    
    // Use instanced mesh for large numbers of boreholes
    if (boreholes.length > 50) {
      this.drawBoreholesInstanced(boreholes, boreholeGroup, boreholeDims);
    } else {
      this.drawBoreholesIndividual(boreholes, boreholeGroup, boreholeDims, displayOptions);
    }
    
    this.add('boreholes', boreholeGroup, true);
  }

  /**
   * Draw boreholes using instanced rendering for performance
   */
  drawBoreholesInstanced(boreholes, group, dims) {
    const geometry = this.getPooledGeometry('cylinder', 
      dims.diameter / 2, 
      dims.diameter / 2, 
      1, // Unit height, will be scaled
      8
    );
    
    const material = this.getPooledMaterial('standard', {
      color: 0x8B4513,
      transparent: true,
      opacity: 0.8
    });
    
    const mesh = new InstancedMesh(geometry, material, boreholes.length);
    const matrix = new Matrix4();
    const position = new Vector3();
    const scale = new Vector3();
    
    boreholes.forEach((borehole, i) => {
      const depth = borehole.depth || 10;
      position.set(
        borehole.x || (i * 5),
        -depth / 2,
        borehole.z || 0
      );
      scale.set(1, depth, 1);
      
      matrix.compose(
        position,
        new Quaternion(),
        scale
      );
      
      mesh.setMatrixAt(i, matrix);
    });
    
    mesh.instanceMatrix.needsUpdate = true;
    group.add(mesh);
  }

  /**
   * Draw boreholes individually (for smaller datasets)
   */
  drawBoreholesIndividual(boreholes, group, dims, displayOptions) {
    boreholes.forEach((borehole, index) => {
      const depth = borehole.depth || 10;
      
      // Reuse geometry from pool
      const geometry = this.getPooledGeometry('cylinder',
        dims.diameter / 2,
        dims.diameter / 2,
        depth,
        8
      );
      
      // Reuse material from pool
      const material = this.getPooledMaterial('standard', {
        color: 0x8B4513,
        transparent: true,
        opacity: 0.8
      });
      
      const mesh = new Mesh(geometry, material);
      mesh.position.set(
        borehole.x || (index * 5),
        -depth / 2,
        borehole.z || 0
      );
      
      group.add(mesh);
      
      // Add label if needed
      if (displayOptions?.showLabels) {
        this.addBoreholeLabel(borehole, index, depth);
      }
    });
  }

  /**
   * Add borehole label
   */
  addBoreholeLabel(borehole, index, depth) {
    const depthInFeet = formatDepthMetersToFeet(depth);
    const labelText = `${borehole.name || `BH-${index + 1}`}: ${depthInFeet}' deep`;
    const glassLabel = createGlassmorphismLabel(labelText, '#ff0000', 'borehole');
    
    glassLabel.position.set(
      borehole.x || (index * 5),
      depth / 2 + 2,
      borehole.z || 0
    );
    
    this.addCSS3D(`simple-borehole-label-${index}`, glassLabel);
  }

  /**
   * Optimized soil layer drawing with merged geometry
   */
  drawSoilLayers(layers, displayOptions) {
    this.remove('soilLayers', true);
    this.clearCSS3DByPrefix('simple-layer-label-');
    
    if (!layers || layers.length === 0 || !displayOptions.showStrata) {
      return;
    }

    const soilGroup = new Group();
    soilGroup.name = 'soilLayers';
    
    const strataDims = getStrataDimensions();
    const dimensions = displayOptions.strataDimensions || { 
      width: strataDims.width, 
      depth: strataDims.depth 
    };
    
    // Use merged geometry for better performance
    if (layers.length > 10) {
      this.drawLayersMerged(layers, soilGroup, dimensions, displayOptions);
    } else {
      this.drawLayersIndividual(layers, soilGroup, dimensions, displayOptions);
    }
    
    this.add('soilLayers', soilGroup, true);
  }

  /**
   * Draw layers with merged geometry for performance
   */
  drawLayersMerged(layers, group, dimensions, displayOptions) {
    const geometries = [];
    const materials = [];
    let currentY = 0;
    
    layers.forEach((layer, index) => {
      const layerDepth = parseFloat(layer.depth) || 1;
      
      const geometry = new BoxGeometry(
        dimensions.width,
        layerDepth,
        dimensions.depth
      );
      
      // Transform geometry to correct position
      geometry.translate(0, currentY - layerDepth / 2, 0);
      geometries.push(geometry);
      
      const material = this.getPooledMaterial('standard', {
        color: new Color(layer.color || '#888888'),
        transparent: true,
        opacity: 0.8,
        side: DoubleSide
      });
      materials.push(material);
      
      currentY -= layerDepth;
    });
    
    // Merge geometries
    const mergedGeometry = mergeBufferGeometries(geometries);
    const mesh = new Mesh(mergedGeometry, materials);
    group.add(mesh);
  }

  /**
   * Draw layers individually
   */
  drawLayersIndividual(layers, group, dimensions, displayOptions) {
    let currentY = 0;
    
    layers.forEach((layer, index) => {
      const layerDepth = parseFloat(layer.depth) || 1;
      
      const geometry = this.getPooledGeometry('box',
        dimensions.width,
        layerDepth,
        dimensions.depth
      );
      
      const material = this.getPooledMaterial('standard', {
        color: new Color(layer.color || '#888888'),
        transparent: true,
        opacity: 0.8,
        side: DoubleSide
      });
      
      const mesh = new Mesh(geometry, material);
      mesh.position.set(0, currentY - layerDepth / 2, 0);
      
      mesh.userData = {
        layerIndex: index,
        layerName: layer.name,
        layerDepth: layerDepth,
        layerColor: layer.color
      };
      
      group.add(mesh);
      
      if (displayOptions.showLabels) {
        this.addLayerLabel(layer, index, layerDepth, currentY, dimensions);
      }
      
      currentY -= layerDepth;
    });
  }

  /**
   * Add layer label
   */
  addLayerLabel(layer, index, depth, yPosition, dimensions) {
    const depthInFeet = formatDepthMetersToFeet(depth);
    const labelText = `${layer.name || `Layer ${index + 1}`}: ${depthInFeet}'`;
    const glassLabel = createGlassmorphismLabel(labelText, layer.color || '#ffffff', 'layer');
    
    glassLabel.position.set(
      dimensions.width / 2 + 2,
      yPosition - depth / 2,
      0
    );
    
    this.addCSS3D(`simple-layer-label-${index}`, glassLabel);
  }

  /**
   * Clear CSS3D objects by prefix
   */
  clearCSS3DByPrefix(prefix) {
    const keysToRemove = [];
    for (const [key] of this.css3DObjects) {
      if (key.startsWith(prefix)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => this.removeCSS3D(key));
  }

  /**
   * Optimized object disposal
   */
  disposeObject(object) {
    if (!object) return;
    
    // Traverse and dispose
    object.traverse((child) => {
      if (child instanceof Mesh) {
        // Don't dispose pooled resources
        if (!this.geometryPool.has(child.geometry) && child.geometry) {
          child.geometry.dispose();
        }
        
        if (child.material) {
          const materials = Array.isArray(child.material) ? child.material : [child.material];
          materials.forEach(mat => {
            if (!this.materialPool.has(mat)) {
              this.disposeMaterial(mat);
            }
          });
        }
      }
    });
    
    // Clear children
    while (object.children.length > 0) {
      object.remove(object.children[0]);
    }
  }

  /**
   * Dispose material and its textures
   */
  disposeMaterial(material) {
    if (!material) return;
    
    const textureProps = [
      'map', 'alphaMap', 'aoMap', 'bumpMap', 'displacementMap',
      'emissiveMap', 'envMap', 'lightMap', 'metalnessMap',
      'normalMap', 'roughnessMap'
    ];
    
    textureProps.forEach(prop => {
      if (material[prop]?.dispose) {
        material[prop].dispose();
      }
    });
    
    if (material.dispose) {
      material.dispose();
    }
  }

  /**
   * Clear all resources and pools
   */
  dispose() {
    // Cancel pending operations
    if (this.frameId) {
      cancelAnimationFrame(this.frameId);
    }
    
    // Clear objects
    this.objects.forEach((object, name) => {
      this.remove(name, true);
    });
    
    // Clear CSS3D objects
    this.css3DObjects.forEach((_, name) => {
      this.removeCSS3D(name);
    });
    
    // Dispose pooled resources
    this.geometryPool.forEach(geom => geom.dispose());
    this.materialPool.forEach(mat => this.disposeMaterial(mat));
    
    // Clear pools
    this.geometryPool.clear();
    this.materialPool.clear();
    
    // Clear resource sets
    this.resources.geometries.clear();
    this.resources.materials.clear();
    this.resources.textures.clear();
  }

  // Convenience methods
  get(name) {
    return this.objects.get(name);
  }

  has(name) {
    return this.objects.has(name);
  }

  removeCSS3D(name) {
    const object = this.css3DObjects.get(name);
    if (object) {
      if (this.css3DScene) {
        this.css3DScene.remove(object);
      }
      this.css3DObjects.delete(name);
    }
  }
}

export default OptimizedSceneManager;