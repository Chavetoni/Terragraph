// src/services/GLTFLoader.js
import { GLTFLoader as ThreeGLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader} from 'three/addons/loaders/DRACOLoader.js';
import { Box3, Vector3 } from 'three';

class GLTFLoader {
  constructor() {
    this.loader = new ThreeGLTFLoader();
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('/draco/');
    this.loader.setDRACOLoader(dracoLoader);
  }
  
  /**
   * Load a GLTF model from array buffer
   * @param {ArrayBuffer} buffer - The file content as array buffer
   * @param {Function} onSuccess - Success callback
   * @param {Function} onError - Error callback
   */
  loadFromBuffer(buffer, onSuccess, onError) {
    try {
      this.loader.parse(
        buffer,
        '',
        (gltf) => {
          if (onSuccess) onSuccess(gltf);
        },
        (error) => {
          if (onError) onError(error);
        }
      );
    } catch (error) {
      if (onError) onError(error);
    }
  }
  
  /**
   * Process and optimize a loaded GLTF model
   * @param {Object} gltf - The loaded GLTF model
   * @param {Object} options - Processing options
   */
  processModel(gltf, options = {}) {
    const {
      center = true,
      scale = null,
      rotation = null,
      meshOptimization = true
    } = options;
    
    const model = gltf.scene;
    
    // Center model
    if (center) {
      model.updateMatrixWorld(true);
      const box = new Box3().setFromObject(model);
      const center = box.getCenter(new Vector3());
      model.position.sub(center);
      model.updateMatrixWorld(true);
    }
    
    // Apply scaling
    if (scale) {
      if (typeof scale === 'number') {
        model.scale.set(scale, scale, scale);
      } else {
        model.scale.set(scale.x || 1, scale.y || 1, scale.z || 1);
      }
    }
    
    // Apply rotation
    if (rotation) {
      model.rotation.set(rotation.x || 0, rotation.y || 0, rotation.z || 0);
    }
    
    // Mesh optimization
    if (meshOptimization) {
      model.traverse((node) => {
        if (node.isMesh) {
          // Optimize geometries if needed
          if (node.geometry && !node.geometry.attributes.normal) {
            node.geometry.computeVertexNormals();
          }
          
          // Set better material properties
          if (node.material) {
            // Handle array of materials
            const materials = Array.isArray(node.material) ? node.material : [node.material];
            
            materials.forEach(material => {
              // Enable better rendering quality
              if (material.map) material.map.anisotropy = 16;
            });
          }
        }
      });
    }
    
    return model;
  }
}

export default GLTFLoader;