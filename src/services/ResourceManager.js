// src/services/ResourceManager.js

/**
 * Manages Three.js resources to prevent memory leaks
 */
class ResourceManager {
  constructor() {
    this.resources = {
      geometries: new Map(),
      materials: new Map(),
      textures: new Map(),
      objects: new Map()
    };
  }
  
  /**
   * Get or create a geometry
   * @param {String} key - Unique identifier
   * @param {Function} createFn - Function to create the geometry if it doesn't exist
   * @returns {THREE.BufferGeometry}
   */
  getGeometry(key, createFn) {
    if (!this.resources.geometries.has(key)) {
      const geometry = createFn();
      this.resources.geometries.set(key, geometry);
    }
    return this.resources.geometries.get(key);
  }
  
  /**
   * Get or create a material
   * @param {String} key - Unique identifier
   * @param {Function} createFn - Function to create the material if it doesn't exist
   * @returns {THREE.Material}
   */
  getMaterial(key, createFn) {
    if (!this.resources.materials.has(key)) {
      const material = createFn();
      this.resources.materials.set(key, material);
    }
    return this.resources.materials.get(key);
  }
  
  /**
   * Get or create a texture
   * @param {String} key - Unique identifier
   * @param {Function} createFn - Function to create the texture if it doesn't exist
   * @returns {THREE.Texture}
   */
  getTexture(key, createFn) {
    if (!this.resources.textures.has(key)) {
      const texture = createFn();
      this.resources.textures.set(key, texture);
    }
    return this.resources.textures.get(key);
  }
  
  /**
   * Get or create a THREE.js object
   * @param {String} key - Unique identifier
   * @param {Function} createFn - Function to create the object if it doesn't exist
   * @returns {THREE.Object3D}
   */
  getObject(key, createFn) {
    if (!this.resources.objects.has(key)) {
      const object = createFn();
      this.resources.objects.set(key, object);
    }
    return this.resources.objects.get(key);
  }
  
  /**
   * Update a material's properties
   * @param {String} key - Material identifier
   * @param {Object} properties - Properties to update
   */
  updateMaterial(key, properties) {
    if (this.resources.materials.has(key)) {
      const material = this.resources.materials.get(key);
      
      Object.entries(properties).forEach(([prop, value]) => {
        material[prop] = value;
      });
      
      material.needsUpdate = true;
    }
  }
  
  /**
   * Dispose a specific resource
   * @param {String} type - Resource type (geometries, materials, textures, objects)
   * @param {String} key - Resource identifier
   */
  disposeResource(type, key) {
    if (this.resources[type] && this.resources[type].has(key)) {
      const resource = this.resources[type].get(key);
      
      if (type === 'geometries') {
        resource.dispose();
      } else if (type === 'materials') {
        if (resource.map) resource.map.dispose();
        resource.dispose();
      } else if (type === 'textures') {
        resource.dispose();
      } else if (type === 'objects') {
        this.disposeObject(resource);
      }
      
      this.resources[type].delete(key);
    }
  }
  
  /**
   * Dispose a Three.js object and its children
   * @param {THREE.Object3D} object - Object to dispose
   */
  disposeObject(object) {
    if (!object) return;
    
    object.traverse(child => {
      if (child.geometry) {
        child.geometry.dispose();
      }
      
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach(material => {
            if (material.map) material.map.dispose();
            material.dispose();
          });
        } else {
          if (child.material.map) child.material.map.dispose();
          child.material.dispose();
        }
      }
    });
  }
  
  /**
   * Dispose all resources of a specific type
   * @param {String} type - Resource type (geometries, materials, textures, objects)
   */
  disposeAllOfType(type) {
    if (this.resources[type]) {
      this.resources[type].forEach((resource, key) => {
        this.disposeResource(type, key);
      });
      this.resources[type].clear();
    }
  }
  
  /**
   * Dispose all resources
   */
  disposeAll() {
    this.disposeAllOfType('geometries');
    this.disposeAllOfType('materials');
    this.disposeAllOfType('textures');
    this.disposeAllOfType('objects');
  }
}

export default ResourceManager;