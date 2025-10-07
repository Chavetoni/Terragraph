import { BufferAttribute, CircleGeometry, Color, ConeGeometry, CylinderGeometry, DoubleSide, Group, Mesh, MeshBasicMaterial, MeshLambertMaterial, MeshStandardMaterial, RingGeometry, SphereGeometry } from 'three';
import { getBoreholeDimensions } from '../utils/scaleConstants';
import { createGlassmorphismLabel } from '../utils/threeJsHelpers';
import { getMaterialProperties } from '../utils/materialStandardization';
import { textureManager } from './TextureManager';

export class BoreholeVisualizer {
  constructor(scene, camera, sceneManager = null) {
    this.scene = scene;
    this.camera = camera;
    this.sceneManager = sceneManager;
    this.textureCache = new Map();
    this.materialCache = new Map();
    this.animations = new Map(); // Track active animations
    
    // Geometry pooling for better performance
    this.geometryPool = {
      cylinders: new Map(),
      spheres: new Map(),
      cones: new Map(),
      
      getCylinder: (radiusTop, radiusBottom, height, radialSegments = 16) => {
        const key = `${radiusTop}_${radiusBottom}_${height}_${radialSegments}`;
        if (!this.geometryPool.cylinders.has(key)) {
          this.geometryPool.cylinders.set(key, new CylinderGeometry(radiusTop, radiusBottom, height, radialSegments));
        }
        return this.geometryPool.cylinders.get(key);
      },
      
      getSphere: (radius, widthSegments = 8, heightSegments = 6) => {
        const key = `${radius}_${widthSegments}_${heightSegments}`;
        if (!this.geometryPool.spheres.has(key)) {
          this.geometryPool.spheres.set(key, new SphereGeometry(radius, widthSegments, heightSegments));
        }
        return this.geometryPool.spheres.get(key);
      },
      
      getCone: (radius, height, radialSegments = 8) => {
        const key = `${radius}_${height}_${radialSegments}`;
        if (!this.geometryPool.cones.has(key)) {
          this.geometryPool.cones.set(key, new ConeGeometry(radius, height, radialSegments));
        }
        return this.geometryPool.cones.get(key);
      }
    };
  }

  /**
   * Creates an enhanced borehole marker with improved visual design
   * @param {Object} borehole - Borehole data
   * @param {Object} layersContext - Context containing global layer information
   * @param {boolean} showBoreholeStrata - Whether to show borehole strata
   * @param {boolean} showWaterTable - Whether to show water table
   * @param {Object} textureSettings - Global texture settings from DisplayOptionsContext
   */
  createEnhancedBoreholeMarker(borehole, layersContext = null, showBoreholeStrata = true, showWaterTable = true, textureSettings = null) {

    const group = new Group();
    group.name = `borehole_${borehole.id}`;
    group.userData = { type: 'borehole', id: borehole.id };
    
    // Ensure borehole is visible on default layer
    group.layers.enable(0);

    // Create compact pin marker
    const pinMarker = this.createCompactPinMarker(borehole);
    group.add(pinMarker);

    // Create depth shaft visualization
    const depthShaft = this.createDepthShaft(borehole);
    group.add(depthShaft);

    // Create borehole strata if borehole has layers (always create, but set visibility)
    if (borehole.layers && Array.isArray(borehole.layers) && borehole.layers.length > 0) {
      const strataGroup = this.createBoreholeStrata(borehole, layersContext || { layers: [] }, textureSettings);
      if (strataGroup && strataGroup.children.length > 0) {
        strataGroup.visible = showBoreholeStrata; // Set initial visibility
        group.add(strataGroup);
      }
    }

    // Create compact pin label
    this.createCompactPinLabel(borehole);

    // Set position
    group.position.set(borehole.x, borehole.y, borehole.z);
    group.updateMatrixWorld(true);

    return group;
  }

  /**
   * Creates a compact pin marker for boreholes with custom color
   */
  createCompactPinMarker(borehole) {
    const group = new Group();
    const boreholeDims = getBoreholeDimensions();
    
    // Parse borehole color or use default
    const boreholeColor = new Color(borehole.color || '#1976D2');
    const baseColor = boreholeColor.getHex();
    const topColor = boreholeColor.clone().multiplyScalar(1.2).getHex(); // Slightly lighter
    
    // Create small pin base - positioned just above surface
    const baseRadius = boreholeDims.markerRadius * 0.3; // Much smaller
    const baseHeight = 0.15; // 15cm tall pin
    
    const baseGeometry = this.geometryPool.getCylinder(baseRadius, baseRadius, baseHeight, 8);
    const baseMaterial = new MeshStandardMaterial({
      color: baseColor,
      metalness: 0.6,
      roughness: 0.3
    });
    const base = new Mesh(baseGeometry, baseMaterial);
    base.position.set(0, baseHeight / 2, 0); // Position just above surface
    group.add(base);
    
    // Create pin top indicator
    const topRadius = baseRadius * 0.6;
    
    const topGeometry = this.geometryPool.getSphere(topRadius, 8, 6);
    const topMaterial = new MeshStandardMaterial({
      color: topColor,
      metalness: 0.7,
      roughness: 0.2
    });
    const top = new Mesh(topGeometry, topMaterial);
    top.position.set(0, baseHeight, 0); // Position at top of pin
    group.add(top);
    
    return group;
  }

  /**
   * Creates a compact pin label for borehole with custom color
   */
  createCompactPinLabel(borehole) {
    if (!this.sceneManager) return;

    // Create compact label with format "BH-2 @ 10'"
    const depthInFeet = (borehole.depth || 32.8).toFixed(1);
    const labelText = `${borehole.name || 'BH'} @ ${depthInFeet}'`;
    
    // Use borehole color for label
    const labelColor = borehole.color || '#2196F3';
    const glassLabel = createGlassmorphismLabel(labelText, labelColor, 'borehole-pin');
    
    // Position label with better visibility above the compact pin marker
    const labelOffset = 0.8; // 80cm above surface for better visibility
    
    glassLabel.position.set(
      borehole.x + 0.7, // Increased offset to the right for better separation
      borehole.y + labelOffset,
      borehole.z + 0.2 // Slight forward offset for depth separation
    );
    
    // Add to CSS3D scene
    this.sceneManager.addCSS3D(`borehole-pin-label-${borehole.id}`, glassLabel);
  }

  /**
   * Creates the main surface marker (always modern style)
   */
  createMainMarker(borehole) {
    const boreholeDims = getBoreholeDimensions();
    return this.createModernMarker(borehole, boreholeDims);
  }

  /**
   * Creates a modern, sleek marker design - redesigned to be thinner
   */
  createModernMarker(borehole, dims) {
    const group = new Group();
    const baseRadius = dims.markerRadius * 0.8; // Made thinner
    const height = dims.markerHeight * 1.2;

    // Base platform - smaller and thinner
    const baseGeometry = new CylinderGeometry(baseRadius * 0.9, baseRadius * 0.9, height * 0.15, 16);
    const baseMaterial = new MeshStandardMaterial({
      color: 0x1976D2, // Blue color
      metalness: 0.7,
      roughness: 0.3
    });
    const base = new Mesh(baseGeometry, baseMaterial);
    base.position.set(borehole.x, borehole.y + height * 0.08, borehole.z);
    group.add(base);

    // Main marker column - much thinner
    const columnGeometry = new CylinderGeometry(baseRadius * 0.4, baseRadius * 0.5, height * 0.7, 12);
    const columnMaterial = new MeshStandardMaterial({
      color: 0x2196F3, // Lighter blue
      metalness: 0.5,
      roughness: 0.4
    });
    const column = new Mesh(columnGeometry, columnMaterial);
    column.position.set(borehole.x, borehole.y + height * 0.45, borehole.z);
    group.add(column);

    // Top indicator - smaller and thinner
    const topGeometry = new ConeGeometry(baseRadius * 0.3, height * 0.25, 8);
    const topMaterial = new MeshStandardMaterial({
      color: 0x0D47A1, // Darker blue
      metalness: 0.6,
      roughness: 0.3
    });
    const top = new Mesh(topGeometry, topMaterial);
    top.position.set(borehole.x, borehole.y + height * 0.88, borehole.z);
    group.add(top);

    return group;
  }


  /**
   * Creates depth shaft visualization with transparency and custom color
   */
  createDepthShaft(borehole) {
    const group = new Group();
    
    // Use a darker, more transparent version of the borehole color for the shaft
    const boreholeColor = new Color(borehole.color || '#8B4513');
    const shaftColor = boreholeColor.clone().multiplyScalar(0.7); // Darker shaft
    
    // Main shaft - positioned to go down from surface
    const shaftGeometry = this.geometryPool.getCylinder(
      borehole.diameter / 2,
      borehole.diameter / 2,
      borehole.depth,
      16
    );
    
    const shaftMaterial = new MeshStandardMaterial({
      color: shaftColor,
      transparent: true,
      opacity: 0.6,
      side: DoubleSide
    });
    
    const shaft = new Mesh(shaftGeometry, shaftMaterial);
    shaft.position.set(
      0,
      -borehole.depth / 2, // Center the shaft so top is at y=0 (surface)
      0
    );
    
    group.add(shaft);
    
    return group;
  }


  /**
   * Updates marker based on interaction state
   */
  updateMarkerState(markerId, state) {
    const marker = this.scene.getObjectByName(`borehole_${markerId}`);
    if (!marker) return;

    switch (state) {
      case 'hover':
        this.applyHoverEffect(marker);
        break;
      case 'selected':
        this.applySelectionEffect(marker);
        break;
      case 'normal':
        this.applyNormalEffect(marker);
        break;
      default:
        this.applyNormalEffect(marker);
        break;
    }
  }

  /**
   * Applies hover effect to marker
   */
  applyHoverEffect(marker) {
    marker.children.forEach(child => {
      if (child.material && child.material.color) {
        child.material.color.multiplyScalar(1.2);
      }
    });
  }

  /**
   * Applies selection effect to marker
   */
  applySelectionEffect(marker) {
    // Add selection outline
    const outlineGeometry = new RingGeometry(2, 2.2, 16);
    const outlineMaterial = new MeshBasicMaterial({
      color: 0xFFEB3B,
      transparent: true,
      opacity: 0.8
    });
    const outline = new Mesh(outlineGeometry, outlineMaterial);
    outline.position.y = 0.1;
    outline.rotation.x = -Math.PI / 2;
    outline.name = 'selection_outline';
    marker.add(outline);
  }

  /**
   * Applies normal effect to marker
   */
  applyNormalEffect(marker) {
    // Remove selection outline
    const outline = marker.getObjectByName('selection_outline');
    if (outline) {
      marker.remove(outline);
    }
    
    // Reset colors
    marker.children.forEach(child => {
      if (child.material && child.material.color) {
        child.material.color.set(child.userData.originalColor || child.material.color);
      }
    });
  }

  /**
   * Dispose of a specific borehole marker and its resources
   */
  disposeBorehole(marker) {
    if (!marker) return;
    
    // Remove associated CSS3D label
    if (marker.userData && marker.userData.id && this.sceneManager) {
      this.sceneManager.removeCSS3D(`borehole-pin-label-${marker.userData.id}`);
    }
    
    marker.traverse((child) => {
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
   * Dispose of borehole strata group and its resources
   */
  disposeBoreholeStrata(strataGroup) {
    if (!strataGroup) return;
    
    strataGroup.traverse((child) => {
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
   * Creates borehole-specific strata visualization
   * @param {Object} borehole - Borehole data with layers
   * @param {Object} layersContext - Context containing global layer information
   * @param {Object} textureSettings - Global texture settings from DisplayOptionsContext
   * @returns {Group} - Group containing strata cylinders
   */
  createBoreholeStrata(borehole, layersContext, textureSettings = null) {
    
    const strataGroup = new Group();
    strataGroup.name = `borehole_strata_${borehole.id}`;
    strataGroup.userData = { type: 'borehole_strata', boreholeId: borehole.id };
    
    const strataLabels = [];
    
    // Process each layer in the borehole
    if (borehole.layers && Array.isArray(borehole.layers)) {
      borehole.layers.forEach((layer, index) => {
        // Find the corresponding global layer for color information
        const globalLayer = layersContext.layers.find(l => l.id === layer.id);
        
        // Calculate layer thickness from from/to values
        const thickness = layer.to - layer.from;
        
        // Calculate strata radius - 3x larger than borehole diameter
        const radius = (borehole.diameter / 2) * 3.0;
        
        // Create cylinder geometry for the layer - FRESH GEOMETRY (no pooling for debugging)
        const geometry = new CylinderGeometry(
          radius,
          radius,
          thickness,
          16, // radial segments
          1,  // height segments
          false // openEnded = false (we want caps)
        );
        
        // Check for UV coordinates (needed for textures)
        const hasUVs = geometry.attributes.uv !== undefined;
        
        if (!hasUVs) {
          // Generate UV coordinates manually for cylinder if missing
          const positionAttribute = geometry.attributes.position;
          const vertexCount = positionAttribute.count;
          const uvs = new Float32Array(vertexCount * 2);
          
          // Generate basic cylindrical UV coordinates
          for (let i = 0; i < vertexCount; i++) {
            const x = positionAttribute.getX(i);
            const y = positionAttribute.getY(i);  
            const z = positionAttribute.getZ(i);
            
            // Calculate cylindrical UV coordinates
            const angle = Math.atan2(z, x);
            const u = (angle + Math.PI) / (2 * Math.PI); // 0-1 around circumference
            const v = (y + thickness / 2) / thickness; // 0-1 along height
            
            uvs[i * 2] = u;
            uvs[i * 2 + 1] = v;
          }
          
          geometry.setAttribute('uv', new BufferAttribute(uvs, 2));
        }
        
        // Determine color: Priority order: custom color > USCS material color > global layer color > default gray
        let layerColor = '#888888'; // default gray
        
        if (layer.customColor) {
          layerColor = layer.customColor;
        } else if (layer.material) {
          const materialProps = getMaterialProperties(layer.material);
          layerColor = materialProps.color;
        } else if (globalLayer?.color) {
          layerColor = globalLayer.color;
        }
        
        // Get material type for texture
        const materialType = layer.material || (globalLayer?.name?.toLowerCase()) || 'unknown';
        
        // Create texture if material type is known and texture settings enabled
        let texture = null;
        if (textureSettings && textureSettings.enabled && materialType && materialType !== 'unknown') {
          texture = textureManager.createSoilTexture(materialType, layerColor, textureSettings);
        }
        
        const material = new MeshLambertMaterial({
          color: layerColor,
          transparent: true,
          opacity: 0.9,
          side: DoubleSide,
          ...(texture && { map: texture })
        });
        
        // Create mesh
        const mesh = new Mesh(geometry, material);
        
        // Force material and geometry updates
        material.needsUpdate = true;
        geometry.computeBoundingSphere();
        mesh.position.set(
          0,
          -layer.from - (thickness / 2), // Position based on layer's from depth
          0
        );
        
        // Determine layer name based on layer type
        let layerName = `Layer ${index + 1}`;
        if (layer.material) {
          // Advanced mode: use USCS material code (GW, SW, CL, etc.)
          layerName = layer.material.toUpperCase(); 
        } else if (globalLayer?.name) {
          // Default mode: use global layer name
          layerName = globalLayer.name;
        }
        
        // Performance optimization: Enable layer 0 (rendering) and layer 2 (hover raycasting)
        mesh.layers.enable(0); // Default rendering layer
        mesh.layers.enable(2); // Hover raycasting layer
        
        // Store layer info for potential interaction
        mesh.userData = {
          layerId: layer.id,
          layerIndex: index,
          thickness: thickness,
          layerName: layerName, // Use the determined layer name
          type: 'borehole_strata_layer',
          boreholeId: borehole.id
        };
        
        
        strataGroup.add(mesh);
        
        // Create label for this strata layer
        if (this.sceneManager) {
          const labelPosition = mesh.position.clone();
          labelPosition.x += radius + 1; // Position label outside the cylinder
          
          const labelId = `borehole-strata-label-${borehole.id}-${index}`;
          
          strataLabels.push({
            id: labelId,
            position: labelPosition,
            text: layerName,
            color: layerColor
          });
        }
        
      });
    }
    
    // Add water table indicator if encountered
    if (borehole.waterTableEncountered && borehole.waterTableDepth !== null && borehole.waterTableDepth !== undefined) {
      const waterTableRing = this.createWaterTableRing(borehole);
      if (waterTableRing) {
        strataGroup.add(waterTableRing);
      }
    }
    
    // Store label info for later creation
    strataGroup.userData.labels = strataLabels;
    
    return strataGroup;
  }

  // Texture creation methods moved to TextureManager for better optimization

  // High-contrast texture creation moved to TextureManager for better optimization and caching

  // Debug texture methods moved to TextureManager for consistency

  // Color utility methods moved to TextureManager for better organization

  /**
   * Creates a water table indicator ring at the specified depth
   * @param {Object} borehole - Borehole data with water table information
   * @returns {Group|null} - Group containing water table visualization or null if no water table data
   */
  createWaterTableRing(borehole) {
    // Only create water table ring if water table was encountered
    if (!borehole.waterTableEncountered || !borehole.waterTableDepth) {
      return null;
    }

    const waterTableGroup = new Group();
    waterTableGroup.name = `water_table_${borehole.id}`;
    waterTableGroup.userData = { type: 'water_table', boreholeId: borehole.id };
    
    // Create clean, professional water table level indicator
    const strataRadius = (borehole.diameter / 2) * 3; // Strata cylinder radius
    const indicatorRadius = strataRadius + 0.4; // Extend beyond strata for visibility
    
    // DESIGN OPTION 1: Clean Water Level Plane (current)
    // Simple horizontal disc representing the water table level
    const waterSurfaceGeometry = new CircleGeometry(indicatorRadius, 32);
    const waterSurfaceMaterial = new MeshLambertMaterial({
      color: '#1976D2', // Clear water blue
      transparent: true,
      opacity: 0.6,
      side: DoubleSide,
      emissive: '#0D47A1',
      emissiveIntensity: 0.15
    });
    
    const waterSurface = new Mesh(waterSurfaceGeometry, waterSurfaceMaterial);
    waterSurface.rotation.x = -Math.PI / 2; // Make it horizontal
    waterSurface.position.set(0, -borehole.waterTableDepth, 0);
    waterSurface.renderOrder = 99;
    waterSurface.material.depthWrite = false;
    waterTableGroup.add(waterSurface);
    
    // Add a clean border ring to define the water level edge
    const borderGeometry = new RingGeometry(
      indicatorRadius - 0.02, 
      indicatorRadius + 0.02, 
      32
    );
    const borderMaterial = new MeshBasicMaterial({
      color: '#0D47A1',
      transparent: true,
      opacity: 0.9,
      side: DoubleSide
    });
    
    const border = new Mesh(borderGeometry, borderMaterial);
    border.rotation.x = -Math.PI / 2;
    border.position.set(0, -borehole.waterTableDepth + 0.005, 0);
    border.renderOrder = 100;
    border.material.depthWrite = false;
    waterTableGroup.add(border);
    
    
    // ALTERNATIVE DESIGN OPTION 2: Technical/Engineering Style (commented out)
    // Uncomment this section and comment out the above design for a different look
    /*
    // Create water level gauge-style indicator
    const gaugeRadius = strataRadius + 0.2;
    
    // Horizontal water level line
    const lineGeometry = new CylinderGeometry(0.01, 0.01, gaugeRadius * 2, 8);
    const lineMaterial = new MeshBasicMaterial({ 
      color: '#1976D2',
      emissive: '#0D47A1',
      emissiveIntensity: 0.3
    });
    const levelLine = new Mesh(lineGeometry, lineMaterial);
    levelLine.rotation.z = Math.PI / 2; // Make it horizontal
    levelLine.position.set(0, -borehole.waterTableDepth, 0);
    levelLine.renderOrder = 99;
    waterTableGroup.add(levelLine);
    
    // Water level measurement marks (like a ruler)
    for (let i = -2; i <= 2; i++) {
      if (i === 0) continue; // Skip center
      const markGeometry = new BoxGeometry(0.02, 0.05, 0.02);
      const markMaterial = new MeshBasicMaterial({ color: '#0D47A1' });
      const mark = new Mesh(markGeometry, markMaterial);
      mark.position.set(i * 0.2, -borehole.waterTableDepth, gaugeRadius);
      mark.renderOrder = 100;
      waterTableGroup.add(mark);
    }
    
    // Central water indicator (like a piezometer reading)
    const centerIndicatorGeometry = new SphereGeometry(0.08, 16, 16);
    const centerIndicatorMaterial = new MeshLambertMaterial({
      color: '#2196F3',
      emissive: '#1976D2',
      emissiveIntensity: 0.4
    });
    const centerIndicator = new Mesh(centerIndicatorGeometry, centerIndicatorMaterial);
    centerIndicator.position.set(0, -borehole.waterTableDepth, 0);
    centerIndicator.renderOrder = 101;
    waterTableGroup.add(centerIndicator);
    */
    
    // Store water table data for potential interaction
    waterTableGroup.userData.waterTableDepth = borehole.waterTableDepth;
    waterTableGroup.userData.waterTableElevation = borehole.waterTableElevation;
    
    // Enable layers for rendering and interaction
    waterTableGroup.traverse(child => {
      if (child instanceof Mesh) {
        child.layers.enable(0); // Default rendering layer
        child.layers.enable(2); // Hover raycasting layer
      }
    });
    
    return waterTableGroup;
  }

  /**
   * Animates object visibility with smooth fade in/out
   * @param {Object3D} object - Object to animate
   * @param {boolean} visible - Target visibility state
   * @param {number} duration - Animation duration in milliseconds
   */
  animateVisibility(object, visible, duration = 300) {
    if (!object) return;
    
    const animationId = `${object.name}_visibility`;
    
    // Cancel existing animation for this object
    if (this.animations.has(animationId)) {
      cancelAnimationFrame(this.animations.get(animationId));
    }
    
    const startTime = performance.now();
    const startOpacity = this.getObjectOpacity(object);
    const targetOpacity = visible ? 1 : 0;
    
    const animate = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Ease in-out curve
      const eased = progress < 0.5
        ? 2 * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 2) / 2;
      
      const currentOpacity = startOpacity + (targetOpacity - startOpacity) * eased;
      
      this.setObjectOpacity(object, currentOpacity);
      
      if (progress < 1) {
        const frameId = requestAnimationFrame(animate);
        this.animations.set(animationId, frameId);
      } else {
        this.animations.delete(animationId);
        object.visible = visible;
        if (!visible) {
          this.setObjectOpacity(object, 1); // Reset opacity for next show
        }
      }
    };
    
    // Start animation
    if (visible) {
      object.visible = true;
      this.setObjectOpacity(object, 0);
    }
    
    requestAnimationFrame(animate);
  }
  
  /**
   * Gets the opacity of an object and its children
   */
  getObjectOpacity(object) {
    if (object.material) {
      return object.material.opacity || 1;
    }
    
    // For groups, get the first child's opacity
    let opacity = 1;
    object.traverse((child) => {
      if (child.material && opacity === 1) {
        opacity = child.material.opacity || 1;
      }
    });
    
    return opacity;
  }
  
  /**
   * Sets the opacity of an object and all its children
   */
  setObjectOpacity(object, opacity) {
    object.traverse((child) => {
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach(mat => {
            mat.transparent = true;
            mat.opacity = opacity;
          });
        } else {
          child.material.transparent = true;
          child.material.opacity = opacity;
        }
      }
    });
  }

  /**
   * Cleanup resources with TextureManager integration
   */
  dispose() {
    // Cancel all active animations
    this.animations.forEach((frameId) => {
      cancelAnimationFrame(frameId);
    });
    this.animations.clear();
    
    // Clean up all borehole pin labels
    if (this.sceneManager) {
      for (let i = 0; i < 100; i++) { // Clean up potential labels
        this.sceneManager.removeCSS3D(`borehole-pin-label-${i}`);
      }
    }
    
    // Clean up geometry pool
    this.geometryPool.cylinders.forEach(geometry => geometry.dispose());
    this.geometryPool.spheres.forEach(geometry => geometry.dispose());
    this.geometryPool.cones.forEach(geometry => geometry.dispose());
    this.geometryPool.cylinders.clear();
    this.geometryPool.spheres.clear();
    this.geometryPool.cones.clear();
    
    // Note: TextureManager handles its own caching and disposal
    // Individual texture disposal is now managed by TextureManager
    this.textureCache.forEach(texture => texture.dispose());
    this.materialCache.forEach(material => material.dispose());
    this.textureCache.clear();
    this.materialCache.clear();
  }
}

export default BoreholeVisualizer;