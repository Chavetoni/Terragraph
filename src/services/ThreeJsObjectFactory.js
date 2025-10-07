// src/services/ThreeJsObjectFactory.js
import { Box3, BoxGeometry, BufferGeometry, Color, CylinderGeometry, Group, Line, LineBasicMaterial, Mesh, MeshStandardMaterial, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { createDepthMarkers, createGlassmorphismLabel } from '../utils/threeJsHelpers';
import { validationLogger } from '../utils/Logger.js';

class ThreeJsObjectFactory {
  constructor() {
    // Constants for scaling
    this.BASE_DIMENSION_FOR_SCALING = 5;
  }
  
  createSoilCube(layers, options, sceneManager = null) {
    const {
      strataDimensions,
      viewMode,
      verticalSpacing,
      showLabels,
      showDepthMarkers,
      showConnectors
    } = options;
    
    if (!layers || layers.length === 0) return null;
    
    const currentMaxSize = Math.max(
      strataDimensions.width, 
      strataDimensions.depth, 
      this.BASE_DIMENSION_FOR_SCALING
    );
    
    const strataScaleFactor = Math.max(0.5, currentMaxSize / this.BASE_DIMENSION_FOR_SCALING);
    const soilCube = new Group();
    
    const totalActualDepth = layers.reduce(
      (sum, layer) => sum + (parseFloat(layer.depth) || 1), 
      0
    );
    
    const minVisualDimensionForStrata = Math.max(
      strataDimensions.width, 
      strataDimensions.depth, 
      5
    );
    
    const modelVisualHeight = Math.max(minVisualDimensionForStrata, totalActualDepth);
    const totalExplodedSpacing = (viewMode === 'exploded' && layers.length > 1) 
      ? (layers.length - 1) * verticalSpacing 
      : 0;
    
    const adjustedModelHeight = modelVisualHeight + totalExplodedSpacing;
    
    // Clean up existing CSS3D labels first
    if (sceneManager) {
      for (let i = 0; i < 50; i++) {
        sceneManager.removeCSS3D(`depth-marker-${i}`);
        sceneManager.removeCSS3D(`layer-label-${i}`);
      }
    }
    
    if (showDepthMarkers && layers.length > 0) {
      soilCube.add(
        createDepthMarkers(
          adjustedModelHeight,
          totalActualDepth,
          layers,
          strataDimensions.width,
          viewMode,
          verticalSpacing,
          strataScaleFactor,
          sceneManager
        )
      );
    }
    
    const layerPositionsForConnectors = [];
    let currentYPosition = 0;
    
    for (let i = 0; i < layers.length; i++) {
      const currentLayer = layers[i];
      const layerColorStr = currentLayer.color || '#CCCCCC';
      let colorHex = layerColorStr;
      
      try {
        new Color(colorHex);
      } catch (e) {
        colorHex = '#CCCCCC';
      }
      
      const layerColor = new Color(colorHex);
      const layerActualDepth = parseFloat(currentLayer.depth) || 1;
      
      const layerVisualHeight = (totalActualDepth > 0 
        ? (layerActualDepth / totalActualDepth) 
        : (layers.length > 0 ? 1 / layers.length : 0)) * modelVisualHeight;
      
      if (layerVisualHeight <= 0) continue;
      
      const layerGroup = new Group();
      const layerCenterY = currentYPosition - layerVisualHeight / 2;
      
      const geometry = new BoxGeometry(
        strataDimensions.width,
        layerVisualHeight,
        strataDimensions.depth
      );
      
      const material = new MeshStandardMaterial({
        color: layerColor,
        roughness: 0.7,
        metalness: 0.1
      });
      
      const layerMesh = new Mesh(geometry, material);
      layerMesh.position.y = layerCenterY;
      layerGroup.add(layerMesh);
      
      if (viewMode === 'exploded' && layers.length > 1) {
        layerPositionsForConnectors.push({
          top: currentYPosition,
          bottom: currentYPosition - layerVisualHeight
        });
      }
      
      const strataEdgeX = strataDimensions.width / 2;
      const strataEdgeZ = strataDimensions.depth / 2;
      const elementZOffset = 0.1 * strataScaleFactor;
      
      
      if (showLabels && sceneManager) {
        const labelText = `${currentLayer.name || 'Layer ' + (i + 1)}: ${currentLayer.description || 'No description'}`;
        
        // Create glassmorphism label
        const glassLabel = createGlassmorphismLabel(labelText, colorHex, 'layer');
        
        // Position the label much closer to the model - reduce the offset
        const labelGapFromEdge = 0.1 * strataScaleFactor; // Reduced from 0.2
        const labelAttachX = strataEdgeX + labelGapFromEdge;
        
        glassLabel.position.set(
          labelAttachX + 0.3, // Reduced from 1 to 0.3
          layerCenterY,
          strataEdgeZ + elementZOffset
        );
        
        // Add to CSS3D scene
        sceneManager.addCSS3D(`layer-label-${i}`, glassLabel);
        
        // Add connection line
        const lineMaterial = new LineBasicMaterial({color: 0xffffff, opacity: 0.8, transparent: true});
        const lineToElementGap = 0.05 * strataScaleFactor; // Reduced gap
        
        layerGroup.add(new Line(
          new BufferGeometry().setFromPoints([
            new Vector3(strataEdgeX, layerCenterY, strataEdgeZ + elementZOffset * 0.5),
            new Vector3(labelAttachX - lineToElementGap, layerCenterY, strataEdgeZ + elementZOffset * 0.5)
          ]),
          lineMaterial
        ));
      }
      
      soilCube.add(layerGroup);
      currentYPosition = currentYPosition - layerVisualHeight;
      
      if (viewMode === 'exploded' && i < layers.length - 1 && layers.length > 1) {
        currentYPosition -= verticalSpacing;
      }
    }
    
    if (viewMode === 'exploded' && showConnectors && layerPositionsForConnectors.length > 1) {
      this.addLayerConnectors(
        soilCube,
        layerPositionsForConnectors,
        strataDimensions
      );
    }
    
    return soilCube;
  }
  
  positionLayerLabel(layerGroup, labelSprite, strataEdgeX, strataEdgeZ, 
                     layerCenterY, elementZOffset, strataScaleFactor) {
    const labelSpriteWorldWidth = labelSprite.scale.x;
    const lineToElementGap = 0.1 * strataScaleFactor;
    const labelGapFromEdge = 0.2 * strataScaleFactor;
    
    const lineMaterial = new LineBasicMaterial({color: 0xffffff});
    
    const labelAttachX = strataEdgeX + labelGapFromEdge;
    
    // Connect strata edge directly to label
    layerGroup.add(new Line(
      new BufferGeometry().setFromPoints([
        new Vector3(strataEdgeX, layerCenterY, strataEdgeZ + elementZOffset * 0.5),
        new Vector3(labelAttachX - lineToElementGap, layerCenterY, strataEdgeZ + elementZOffset * 0.5)
      ]),
      lineMaterial
    ));
    
    labelSprite.position.set(
      labelAttachX + labelSpriteWorldWidth / 2,
      layerCenterY,
      strataEdgeZ + elementZOffset
    );
    
    layerGroup.add(labelSprite);
  }
  
  addLayerConnectors(soilCube, layerPositions, strataDimensions) {
    const lineMaterial = new LineBasicMaterial({
      color: 0xaaaaaa,
      opacity: 0.7,
      transparent: true
    });
    
    const connectorZ = strataDimensions.depth / 2;
    
    for (let i = 0; i < layerPositions.length - 1; i++) {
      const upperLayer = layerPositions[i];
      const lowerLayer = layerPositions[i+1];
      const connectorStartY = upperLayer.bottom;
      const connectorEndY = lowerLayer.top;
      
      // Right side connector
      soilCube.add(new Line(
        new BufferGeometry().setFromPoints([
          new Vector3(strataDimensions.width / 2, connectorStartY, connectorZ),
          new Vector3(strataDimensions.width / 2, connectorEndY, connectorZ)
        ]),
        lineMaterial
      ));
      
      // Left side connector
      soilCube.add(new Line(
        new BufferGeometry().setFromPoints([
          new Vector3(-strataDimensions.width / 2, connectorStartY, connectorZ),
          new Vector3(-strataDimensions.width / 2, connectorEndY, connectorZ)
        ]),
        lineMaterial
      ));
    }
  }
  
  createBoreholeMarkers(boreholes, sceneManager = null) {
    const group = new Group();
    const markerRadius = 0.25;
    const markerHeight = 1.5;
    const markerMaterial = new MeshStandardMaterial({
      color: 0xff0000,
      roughness: 0.5,
      metalness: 0.1
    });
    
    boreholes.forEach((bh, index) => {
      const geometry = new CylinderGeometry(
        markerRadius,
        markerRadius,
        markerHeight,
        16
      );
      
      const cylinder = new Mesh(geometry, markerMaterial);
      cylinder.position.set(bh.x, bh.y + markerHeight / 2, bh.z);
      
      // Create glassmorphism label for borehole
      if (sceneManager) {
        const glassLabel = createGlassmorphismLabel(bh.name, '#ff0000', 'borehole');
        const yOffsetForLabel = markerHeight + 0.5;
        
        glassLabel.position.set(bh.x, bh.y + yOffsetForLabel, bh.z);
        sceneManager.addCSS3D(`borehole-label-${index}`, glassLabel);
      }
      
      group.add(cylinder);
    });
    
    return group;
  }
  
  loadGLTF(fileContent, onSuccess, onError) {
    const loader = new GLTFLoader();
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('/draco/');
    loader.setDRACOLoader(dracoLoader);
    
    try {
      loader.parse(
        fileContent,
        '',
        (gltf) => {
          if (!gltf || !gltf.scene) {
            if (onError) onError(new Error("Invalid GLTF structure"));
            return;
          }
          
          const modelScene = gltf.scene;
          
          try {
            // Center and scale the model
            modelScene.updateMatrixWorld(true);
            const box = new Box3().setFromObject(modelScene);
            
            if (!box.isEmpty() &&
                box.max instanceof Vector3 &&
                box.min instanceof Vector3 &&
                Number.isFinite(box.max.x) &&
                Number.isFinite(box.min.x)) {
              
              const center = box.getCenter(new Vector3());
              modelScene.position.sub(center);
              modelScene.updateMatrixWorld(true);
            }
          } catch (calcError) {
            validationLogger.error("Error during map processing:", calcError);
          }
          
          if (onSuccess) onSuccess(modelScene);
        },
        (error) => {
          if (onError) onError(error);
        }
      );
    } catch (error) {
      if (onError) onError(error);
    }
  }
}

export default ThreeJsObjectFactory;