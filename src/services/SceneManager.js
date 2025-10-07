// src/services/SceneManager.js
import { AmbientLight, BoxGeometry, DirectionalLight, GridHelper, MathUtils, Mesh, MeshBasicMaterial, PerspectiveCamera, Plane, Raycaster, Scene, Vector2, Vector3, WebGLRenderer } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import ThreeJsObjectFactory from './ThreeJsObjectFactory';
import { scene3dLogger, validationLogger } from '../utils/Logger.js';

class SceneManager {
  constructor(container, onObjectSelect = null) {
    // Core Three.js objects
    this.scene = new Scene();
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.container = container;
    this.factory = new ThreeJsObjectFactory();
    this.onObjectSelect = onObjectSelect;
    this.onContextRestored = null;
    
    // Scene objects references
    this.soilCube = null;
    this.groundGrid = null;
    this.siteMap = null;
    this.boreholeMarkersGroup = null;
    
    // Resource tracking
    this.resources = {
      geometries: new Set(),
      materials: new Set(),
      textures: new Set(),
      objects: new Set()
    };
    
    // Constants
    this.GROUND_GRID_SIZE = 100;
    this.GROUND_GRID_DIVISIONS = 50;
    
    this.initialize();
  }
  
  // Track resources for proper disposal
  trackResource(type, resource) {
    if (this.resources[type]) {
      this.resources[type].add(resource);
    }
    return resource;
  }
  
  createGeometry(geometryFunc) {
    const geometry = geometryFunc();
    return this.trackResource('geometries', geometry);
  }
  
  createMaterial(materialFunc) {
    const material = materialFunc();
    return this.trackResource('materials', material);
  }
  
  createTexture(textureFunc) {
    const texture = textureFunc();
    return this.trackResource('textures', texture);
  }
  
  initialize() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    
    // Create scene with transparent background
    this.scene.background = null;
    
    // Create camera
    this.camera = new PerspectiveCamera(
      60, 
      width / height, 
      0.1, 
      this.GROUND_GRID_SIZE * 5
    );
    this.camera.position.set(
      this.GROUND_GRID_SIZE / 2, 
      this.GROUND_GRID_SIZE / 2, 
      this.GROUND_GRID_SIZE / 2
    );
    
    // Create renderer
    this.renderer = new WebGLRenderer({ 
      antialias: true, 
      alpha: true 
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.autoClear = true;
    this.renderer.setClearColor(0x000000, 0);
    
    // Clear container and add renderer
    while (this.container.firstChild) {
      this.container.removeChild(this.container.firstChild);
    }
    this.container.appendChild(this.renderer.domElement);
    
    // Setup lighting
    this.setupLights();
    
    // Setup controls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.minDistance = 1;
    this.controls.maxDistance = this.GROUND_GRID_SIZE * 2;
    this.controls.target.set(0, 0, 0);
    this.controls.panSpeed = 1.5;
    this.controls.update();
    
    // Create ground grid by default
    this.createGroundGrid(true);
    
    // Add error event listeners for WebGL context
    this.renderer.domElement.addEventListener('webglcontextlost', this.handleContextLost.bind(this));
    this.renderer.domElement.addEventListener('webglcontextrestored', this.handleContextRestored.bind(this));
  }
  
  handleContextLost(event) {
    event.preventDefault();
    scene3dLogger.warn("WebGL context lost. Attempting to recover...");
    // Stop any ongoing animations or processes
  }
  
  handleContextRestored() {

    // Reinitialize necessary objects
    this.setupLights();
    // Redraw scene elements that were lost
    if (this.groundGrid && this.groundGrid.visible) {
      this.createGroundGrid(true);
    }
    // Notify application that context is restored
    if (typeof this.onContextRestored === 'function') {
      this.onContextRestored();
    }
  }
  
  setupLights() {
    const ambientLight = new AmbientLight(0xffffff, 0.8);
    this.scene.add(ambientLight);
    
    const directionalLight = new DirectionalLight(0xffffff, 1.2);
    directionalLight.position.set(
      this.GROUND_GRID_SIZE / 2, 
      this.GROUND_GRID_SIZE / 1.5, 
      this.GROUND_GRID_SIZE / 2
    );
    this.scene.add(directionalLight);
    
    const backLight = new DirectionalLight(0xffffff, 0.6);
    backLight.position.set(
      -this.GROUND_GRID_SIZE / 2, 
      this.GROUND_GRID_SIZE / 3, 
      -this.GROUND_GRID_SIZE / 2
    );
    this.scene.add(backLight);
  }
  
  render() {
    if (this.controls) this.controls.update();
    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  }
  
  handleResize() {
    if (!this.container || !this.renderer || !this.camera) return;
    
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    
    if (width > 0 && height > 0) {
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(width, height);
    }
  }
  
  createGroundGrid(showGrid) {

    if (this.groundGrid) {

      this.scene.remove(this.groundGrid);
      this.disposeObject(this.groundGrid);
      this.groundGrid = null;
    }
    
    if (showGrid) {

      const gridHelper = new GridHelper(
        this.GROUND_GRID_SIZE, 
        this.GROUND_GRID_DIVISIONS, 
        0xff0000, // Red center lines for visibility
        0x00ff00  // Green subdivision lines for visibility
      );
      gridHelper.position.y = 0;
      this.groundGrid = gridHelper;
      this.resources.objects.add(this.groundGrid);
      this.scene.add(gridHelper);
      
      // Add a bright test cube to verify rendering
      const testGeometry = new BoxGeometry(10, 10, 10);
      const testMaterial = new MeshBasicMaterial({ color: 0xff0000 });
      const testCube = new Mesh(testGeometry, testMaterial);
      testCube.position.set(0, 5, 0);
      this.scene.add(testCube);


    } else {

    }
  }
  
  createSoilLayers(layers, options) {
    const {
      strataDimensions,
      viewMode,
      verticalSpacing,
      showLabels,
      showMarkers,
      showDepthMarkers,
      showConnectors,
      showStrata
    } = options;
    
    // Remove existing soil cube
    if (this.soilCube) {
      this.scene.remove(this.soilCube);
      this.disposeObject(this.soilCube);
      this.resources.objects.delete(this.soilCube);
      this.soilCube = null;
    }
    
    if (layers.length === 0 || !showStrata) return;
    
    // Create new soil layers
    this.soilCube = this.factory.createSoilCube(
      layers,
      {
        strataDimensions,
        viewMode,
        verticalSpacing,
        showLabels,
        showMarkers,
        showDepthMarkers,
        showConnectors
      }
    );
    
    this.resources.objects.add(this.soilCube);
    this.scene.add(this.soilCube);
  }
  
  createBoreholeMarkers(boreholes) {
    if (this.boreholeMarkersGroup) {
      this.scene.remove(this.boreholeMarkersGroup);
      this.disposeObject(this.boreholeMarkersGroup);
      this.resources.objects.delete(this.boreholeMarkersGroup);
      this.boreholeMarkersGroup = null;
    }
    
    if (!boreholes || boreholes.length === 0) return;
    
    this.boreholeMarkersGroup = this.factory.createBoreholeMarkers(boreholes);
    this.resources.objects.add(this.boreholeMarkersGroup);
    this.scene.add(this.boreholeMarkersGroup);
  }
  
  loadSiteMap(fileContent, onSuccess, onError) {
    try {
      // Remove existing site map
      if (this.siteMap) {
        this.scene.remove(this.siteMap);
        this.disposeObject(this.siteMap);
        this.resources.objects.delete(this.siteMap);
        this.siteMap = null;
      }
      
      if (!fileContent) {
        // Null fileContent means we're just clearing the map
        if (onSuccess) onSuccess(null);
        return;
      }
      
      this.factory.loadGLTF(
        fileContent,
        (model) => {
          this.siteMap = model;
          
          // Disable shadows on site map to prevent interference with strata visibility
          this.siteMap.traverse((object) => {
            if (object.isMesh) {
              object.castShadow = false;
              object.receiveShadow = false;
            }
          });
          
          this.resources.objects.add(this.siteMap);
          this.scene.add(this.siteMap);
          if (onSuccess) onSuccess(model);
        },
        onError
      );
    } catch (error) {
      validationLogger.error("Error loading site map:", error);
      if (onError) onError(error);
    }
  }
  
  updateSiteMapProps(props) {
    if (!this.siteMap) return;
    
    const { position, scale, visible, opacity, rotation } = props;
    
    this.siteMap.position.set(position.x, position.y, position.z);
    this.siteMap.scale.set(scale.x, scale.y, scale.z);
    this.siteMap.visible = visible;

    if (rotation) {
      this.siteMap.rotation.set(
        MathUtils.degToRad(rotation.x),
        MathUtils.degToRad(rotation.y),
        MathUtils.degToRad(rotation.z)
      );
    }
    
    this.siteMap.traverse((object) => {
      if (object.isMesh) {
        const materials = Array.isArray(object.material) 
          ? object.material 
          : [object.material];
        
        materials.forEach(material => {
          if (material) {
            material.transparent = opacity < 1.0;
            material.opacity = opacity;
            material.needsUpdate = true;
          }
        });
      }
    });
    
    this.siteMap.updateMatrixWorld(true);
  }
  
  createRaycaster() {
    return new Raycaster();
  }
  
  getIntersectionPoint(event, canvasElement, raycaster) {
    if (!canvasElement || !this.camera) return null;
    
    const rect = canvasElement.getBoundingClientRect();
    const mouse = new Vector2();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    
    raycaster.setFromCamera(mouse, this.camera);
    
    const potentialTargets = [];
    
    if (this.siteMap && this.siteMap.visible) {
      potentialTargets.push(this.siteMap);
    }
    
    if (this.groundGrid && this.groundGrid.visible) {
      potentialTargets.push(this.groundGrid);
    }
    
    if (potentialTargets.length > 0) {
      const intersects = raycaster.intersectObjects(potentialTargets, true);
      
      if (intersects.length > 0) {
        return intersects[0].point;
      }
    }
    
    // Try Y=0 plane as fallback
    const plane = new Plane(new Vector3(0, 1, 0), 0);
    const intersectionPoint = new Vector3();
    
    if (raycaster.ray.intersectPlane(plane, intersectionPoint)) {
      return intersectionPoint;
    }
    
    return null;
  }
  
  onCanvasClick(event, canvasElement) {
    if (!this.onObjectSelect || !canvasElement || !this.camera) return;
    
    const rect = canvasElement.getBoundingClientRect();
    const mouse = new Vector2();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    
    const raycaster = new Raycaster();
    raycaster.setFromCamera(mouse, this.camera);
    
    const potentialTargets = [];
    
    if (this.siteMap && this.siteMap.visible) {
      potentialTargets.push(this.siteMap);
    }
    
    if (this.groundGrid && this.groundGrid.visible) {
      potentialTargets.push(this.groundGrid);
    }
    
    if (potentialTargets.length > 0) {
      const intersects = raycaster.intersectObjects(potentialTargets, true);
      
      if (intersects.length > 0) {
        this.onObjectSelect({
          type: 'Site Map',
          name: this.siteMap ? (this.siteMap.name || 'Site Model') : 'Site Model',
          point: intersects[0].point,
        });
      } else {
        this.onObjectSelect(null); // Deselect if background is clicked
      }
    } else {
      this.onObjectSelect(null); // Deselect if no objects present
    }
  }
  
  disposeObject(object) {
    if (!object) return;
    
    object.traverse(child => {
      if (child.geometry) {
        this.resources.geometries.delete(child.geometry);
        child.geometry.dispose();
      }
      
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach(material => {
            this.resources.materials.delete(material);
            if (material.map) {
              this.resources.textures.delete(material.map);
              material.map.dispose();
            }
            if (material.dispose) material.dispose();
          });
        } else {
          this.resources.materials.delete(child.material);
          if (child.material.map) {
            this.resources.textures.delete(child.material.map);
            child.material.map.dispose();
          }
          if (child.material.dispose) child.material.dispose();
        }
      }
    });
  }
  
  dispose() {
    // Remove event listeners
    if (this.renderer && this.renderer.domElement) {
      this.renderer.domElement.removeEventListener('webglcontextlost', this.handleContextLost);
      this.renderer.domElement.removeEventListener('webglcontextrestored', this.handleContextRestored);
    }
    
    // Dispose all tracked objects
    this.resources.objects.forEach(object => {
      if (this.scene) this.scene.remove(object);
      this.disposeObject(object);
    });
    this.resources.objects.clear();
    
    // Dispose all tracked resources
    this.resources.materials.forEach(material => material.dispose());
    this.resources.geometries.forEach(geometry => geometry.dispose());
    this.resources.textures.forEach(texture => texture.dispose());
    
    // Clear tracking sets
    this.resources.materials.clear();
    this.resources.geometries.clear();
    this.resources.textures.clear();
    
    // Dispose renderer
    if (this.renderer) {
      if (this.container && this.container.contains(this.renderer.domElement)) {
        this.container.removeChild(this.renderer.domElement);
      }
      this.renderer.dispose();
    }
    
    // Dispose controls
    if (this.controls) {
      this.controls.dispose();
    }
    
    // Clear references
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.soilCube = null;
    this.groundGrid = null;
    this.siteMap = null;
    this.boreholeMarkersGroup = null;
  }
}

export default SceneManager;