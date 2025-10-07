import { BoxGeometry, BufferAttribute, BufferGeometry, Color, CylinderGeometry, DoubleSide, Group, Line, LineBasicMaterial, Mesh, MeshBasicMaterial, MeshStandardMaterial, SphereGeometry, Vector3 } from 'three';
import { getStrataDimensions, getBoreholeDimensions, getDepthMarkerDimensions } from '../utils/scaleConstants';
import { createGlassmorphismLabel } from '../utils/threeJsHelpers';
import { formatDepthMetersToFeet } from '../utils/unitConverter.js';

class SimpleSceneManager {
  constructor(scene, css3DScene = null) {
    this.scene = scene;
    this.css3DScene = css3DScene;
    this.objects = new Map();
    this.css3DObjects = new Map();
    this.resources = {
      geometries: new Set(),
      materials: new Set(),
      textures: new Set(),
      objects: new Set()
    };
  }

  add(name, object) {
    if (this.objects.has(name)) {
      this.remove(name);
    }
    
    this.objects.set(name, object);
    this.resources.objects.add(object);
    this.scene.add(object);
  }

  addCSS3D(name, object) {
    if (this.css3DObjects.has(name)) {
      this.removeCSS3D(name);
    }
    
    this.css3DObjects.set(name, object);
    if (this.css3DScene) {
      this.css3DScene.add(object);
    }
  }

  remove(name) {
    const object = this.objects.get(name);
    if (object) {
      this.scene.remove(object);
      this.disposeObject(object);
      this.resources.objects.delete(object);
      this.objects.delete(name);
    }
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

  get(name) {
    return this.objects.get(name);
  }

  drawBoreholes(boreholes, displayOptions, soilLayers) {
    // Remove existing boreholes and labels
    this.remove('boreholes');
    
    // Clear existing borehole labels
    for (let i = 0; i < 20; i++) {
      this.removeCSS3D(`simple-borehole-label-${i}`);
    }
    
    if (!boreholes || boreholes.length === 0) return;
    
    // Create borehole group
    const boreholeGroup = new Group();
    boreholeGroup.name = 'boreholes';
    
    const boreholeDims = getBoreholeDimensions();
    
    boreholes.forEach((borehole, index) => {
      // Create simple marker for each borehole
      const geometry = new CylinderGeometry(
        boreholeDims.diameter / 2, 
        boreholeDims.diameter / 2, 
        borehole.depth || 10, 
        8
      );
      const material = new MeshStandardMaterial({ 
        color: 0x8B4513,
        transparent: true,
        opacity: 0.8
      });
      
      const mesh = new Mesh(geometry, material);
      mesh.position.set(
        borehole.x || (index * 5), 
        -(borehole.depth || 10) / 2, 
        borehole.z || 0
      );
      
      boreholeGroup.add(mesh);
      
      // Add glassmorphism label
      const depthInFeet = formatDepthMetersToFeet(borehole.depth || 10);
      const labelText = `${borehole.name || `BH-${index + 1}`}: ${depthInFeet}' deep`;
      const glassLabel = createGlassmorphismLabel(labelText, '#ff0000', 'borehole');
      
      glassLabel.position.set(
        borehole.x || (index * 5), 
        (borehole.depth || 10) / 2 + 2, 
        borehole.z || 0
      );
      
      this.addCSS3D(`simple-borehole-label-${index}`, glassLabel);
    });
    
    this.add('boreholes', boreholeGroup);
  }

  drawSoilLayers(layers, displayOptions) {
    // Remove existing soil layers and labels
    this.remove('soilLayers');
    
    // Clear existing layer labels
    for (let i = 0; i < 20; i++) {
      this.removeCSS3D(`simple-layer-label-${i}`);
    }
    
    if (!layers || layers.length === 0 || !displayOptions.showStrata) {
      return;
    }

    // Create soil layers group
    const soilGroup = new Group();
    soilGroup.name = 'soilLayers';
    
    const strataDims = getStrataDimensions();
    const strataDimensions = displayOptions.strataDimensions || { width: strataDims.width, depth: strataDims.depth };
    const viewMode = displayOptions.viewMode || 'normal';
    const verticalSpacing = displayOptions.verticalSpacing || 0.5;
    
    let currentY = 0;
    const totalDepth = layers.reduce((sum, layer) => sum + (parseFloat(layer.depth) || 1), 0);
    
    layers.forEach((layer, index) => {
      const layerDepth = parseFloat(layer.depth) || 1;
      
      // Create layer geometry
      const geometry = new BoxGeometry(
        strataDimensions.width,
        layerDepth,
        strataDimensions.depth
      );
      
      // Create layer material with color
      const color = new Color(layer.color || '#888888');
      const material = new MeshStandardMaterial({
        color: color,
        transparent: true,
        opacity: 0.8,
        side: DoubleSide
      });
      
      const mesh = new Mesh(geometry, material);
      
      // Position the layer
      mesh.position.set(
        0,
        currentY - layerDepth / 2,
        0
      );
      
      mesh.userData = {
        layerIndex: index,
        layerName: layer.name,
        layerDepth: layerDepth,
        layerColor: layer.color
      };
      
      soilGroup.add(mesh);
      
      // Add layer label with glassmorphism
      if (displayOptions.showLabels) {
        const depthInFeet = formatDepthMetersToFeet(layerDepth);
        const labelText = `${layer.name || `Layer ${index + 1}`}: ${depthInFeet}'`;
        const glassLabel = createGlassmorphismLabel(labelText, layer.color || '#ffffff', 'layer');
        
        glassLabel.position.set(
          strataDimensions.width / 2 + 2,
          currentY - layerDepth / 2,
          0
        );
        
        this.addCSS3D(`simple-layer-label-${index}`, glassLabel);
        
        // Add connection line
        const lineMaterial = new LineBasicMaterial({color: 0xffffff});
        const lineGeometry = new BufferGeometry().setFromPoints([
          new Vector3(strataDimensions.width / 2, currentY - layerDepth / 2, 0),
          new Vector3(strataDimensions.width / 2 + 1.8, currentY - layerDepth / 2, 0)
        ]);
        const line = new Line(lineGeometry, lineMaterial);
        soilGroup.add(line);
      }
      
      // Add layer markers
      if (displayOptions.showMarkers) {
        const markerGeometry = new SphereGeometry(strataDims.layerMarkerRadius || 0.1, 8, 8);
        const markerMaterial = new MeshBasicMaterial({ color: 0xff0000 });
        
        // Add markers at corners of the layer
        const cornerPositions = [
          [-strataDimensions.width / 2, currentY - layerDepth / 2, -strataDimensions.depth / 2],
          [strataDimensions.width / 2, currentY - layerDepth / 2, -strataDimensions.depth / 2],
          [-strataDimensions.width / 2, currentY - layerDepth / 2, strataDimensions.depth / 2],
          [strataDimensions.width / 2, currentY - layerDepth / 2, strataDimensions.depth / 2]
        ];
        
        cornerPositions.forEach(pos => {
          const marker = new Mesh(markerGeometry, markerMaterial);
          marker.position.set(...pos);
          soilGroup.add(marker);
        });
      }
      
      // Update position for next layer
      currentY -= layerDepth;
      
      // Add spacing in exploded view
      if (viewMode === 'exploded' && index < layers.length - 1) {
        currentY -= verticalSpacing;
      }
    });
    
    this.add('soilLayers', soilGroup);
    
    // Add depth scale if enabled
    if (displayOptions.showDepthMarkers) {
      this.drawDepthScale(totalDepth, strataDimensions);
    } else {
      // Remove depth scale when disabled
      this.remove('depthScale');
      
      // Clear existing depth scale labels
      for (let i = 0; i < 50; i++) {
        this.removeCSS3D(`simple-depth-scale-${i}`);
      }
    }
  }

  drawDepthScale(totalDepth, strataDimensions) {
    // Remove existing depth scale and labels
    this.remove('depthScale');
    
    // Clear existing depth scale labels
    for (let i = 0; i < 50; i++) {
      this.removeCSS3D(`simple-depth-scale-${i}`);
    }
    
    const depthGroup = new Group();
    depthGroup.name = 'depthScale';
    
    const depthMarkerDims = getDepthMarkerDimensions();
    
    // Position depth markers relative to strata dimensions
    const strataHalfWidth = strataDimensions.width / 2;
    const depthMarkerOffset = strataHalfWidth + 1; // 1m offset from strata edge
    const lineLength = 1.5; // 1.5m line length
    
    // Add main vertical line
    const verticalLineGeometry = new BufferGeometry();
    const verticalPositions = new Float32Array([
      -depthMarkerOffset, 0, 0,
      -depthMarkerOffset, -totalDepth, 0
    ]);
    verticalLineGeometry.setAttribute('position', new BufferAttribute(verticalPositions, 3));
    
    const verticalLineMaterial = new LineBasicMaterial({ color: 0xffffff });
    const verticalLine = new Line(verticalLineGeometry, verticalLineMaterial);
    depthGroup.add(verticalLine);
    
    // Create depth markers using unified scale interval
    const interval = depthMarkerDims.interval || 5;
    const numMarkers = Math.ceil(totalDepth / interval);
    
    for (let i = 0; i <= numMarkers; i++) {
      const depth = i * interval;
      if (depth > totalDepth) break;
      
      // Create depth marker tick line
      const lineGeometry = new BufferGeometry();
      const positions = new Float32Array([
        -depthMarkerOffset, -depth, 0,
        -depthMarkerOffset - lineLength, -depth, 0
      ]);
      lineGeometry.setAttribute('position', new BufferAttribute(positions, 3));
      
      const lineMaterial = new LineBasicMaterial({ color: 0xffffff });
      const line = new Line(lineGeometry, lineMaterial);
      depthGroup.add(line);
      
      // Create glassmorphism depth label
      const depthInFeet = formatDepthMetersToFeet(depth);
      const text = `${depthInFeet}'`;
      const glassLabel = createGlassmorphismLabel(text, '#ffffff', 'depth');
      
      glassLabel.position.set(
        -depthMarkerOffset - lineLength - 1,
        -depth,
        0
      );
      
      this.addCSS3D(`simple-depth-scale-${i}`, glassLabel);
    }
    
    this.add('depthScale', depthGroup);
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
    // Dispose all tracked objects
    this.resources.objects.forEach(object => {
      if (this.scene) this.scene.remove(object);
      this.disposeObject(object);
    });
    this.resources.objects.clear();
    
    // Clear CSS3D objects
    this.css3DObjects.forEach((object, name) => {
      if (this.css3DScene) this.css3DScene.remove(object);
    });
    this.css3DObjects.clear();
    
    // Dispose all tracked resources
    this.resources.materials.forEach(material => material.dispose());
    this.resources.geometries.forEach(geometry => geometry.dispose());
    this.resources.textures.forEach(texture => texture.dispose());
    
    // Clear tracking sets
    this.resources.materials.clear();
    this.resources.geometries.clear();
    this.resources.textures.clear();
    
    // Clear objects map
    this.objects.clear();
  }
}

export default SimpleSceneManager;