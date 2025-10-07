/**
 * Depth Scale Generation for Geological Export
 * 
 * Creates professional 3D depth scales for geological model exports,
 * with proper positioning, intervals, and Three.js geometry generation.
 */

import { 
  BufferAttribute, 
  BufferGeometry, 
  Group, 
  Line, 
  LineBasicMaterial, 
  Mesh, 
  MeshStandardMaterial, 
  PlaneGeometry, 
  DoubleSide 
} from 'three';
import { calculateDepthInterval } from '../../utils/depthScaleCalculator.js';

/**
 * Professional depth scale generation for geological model exports
 */
export class DepthScaleGenerator {
  /**
   * Create comprehensive depth scale for geological export
   * Generates professional-grade depth markers with proper positioning
   * @param {Array} soilLayers - Soil layer data
   * @param {Object} strataDimensions - Site dimensions for positioning
   * @param {Array} boreholes - Borehole data for depth calculation
   * @returns {Group} Three.js Group containing complete depth scale
   */
  static createDepthScaleForExport(soilLayers, strataDimensions, boreholes) {
    // Calculate maximum depth from boreholes (matches VolumetricDepthScale component logic)
    let totalDepth = this.calculateTotalDepth(boreholes, soilLayers);
    
    // Ensure we have a minimum depth for display (same as VolumetricDepthScale)
    if (totalDepth <= 0) {
      totalDepth = 10; // Default 10 feet if no depth data
    }
    
    const depthGroup = new Group();
    depthGroup.name = 'depth_scale_export';
    
    // Position depth markers relative to strata dimensions
    const strataWidth = strataDimensions?.width || 131;
    const depthMarkerOffset = strataWidth / 2 + 6.56; // 6.56ft offset from strata edge
    const lineLength = 4.92; // 4.92ft line length
    
    // Add main vertical line
    this.addMainVerticalLine(depthGroup, depthMarkerOffset, totalDepth);
    
    // Calculate and add depth markers
    const depthMarkers = this.calculateDepthMarkers(totalDepth);
    this.addDepthMarkers(depthGroup, depthMarkers, depthMarkerOffset, lineLength);
    
    return depthGroup;
  }

  /**
   * Calculate total depth from boreholes and soil layers
   * @param {Array} boreholes - Borehole data
   * @param {Array} soilLayers - Soil layer data (fallback)
   * @returns {number} Total depth in feet
   */
  static calculateTotalDepth(boreholes, soilLayers = []) {
    let totalDepth = 0;
    
    if (boreholes && boreholes.length > 0) {
      // Use same logic as VolumetricDepthScale component
      let maxBoreholeDepth = 0;
      
      boreholes.forEach(borehole => {
        let boreholeDepth = 0;
        
        // Try different depth sources in order of preference (same as VolumetricDepthScale)
        if (borehole.totalDepth && borehole.totalDepth > 0) {
          boreholeDepth = borehole.totalDepth;
        } else if (borehole.depth && borehole.depth > 0) {
          boreholeDepth = borehole.depth;
        } else if (borehole.layers && borehole.layers.length > 0) {
          // Calculate depth from layers
          boreholeDepth = Math.max(...borehole.layers.map(layer => layer.to || 0));
        }
        
        maxBoreholeDepth = Math.max(maxBoreholeDepth, boreholeDepth);
      });
      
      totalDepth = maxBoreholeDepth;
    } else if (soilLayers && soilLayers.length > 0) {
      // Fallback to soil layers only if no boreholes available
      totalDepth = soilLayers.reduce((sum, layer) => sum + (parseFloat(layer.depth) || 1), 0);
    }
    
    return totalDepth;
  }

  /**
   * Calculate depth marker positions based on total depth
   * @param {number} totalDepth - Total depth in feet
   * @returns {Array} Array of depth values for markers
   */
  static calculateDepthMarkers(totalDepth) {
    // Calculate appropriate interval based on total depth (same as VolumetricDepthScale)
    const interval = calculateDepthInterval(totalDepth);
    
    // Always include surface marker (depth = 0)
    const depthMarkers = [0];
    
    // Add intermediate markers
    let currentDepth = interval;
    while (currentDepth < totalDepth) {
      depthMarkers.push(currentDepth);
      currentDepth += interval;
    }
    
    // Always include bottom depth marker (max borehole depth)
    if (totalDepth > 0 && !depthMarkers.includes(totalDepth)) {
      depthMarkers.push(totalDepth);
    }
    
    return depthMarkers;
  }

  /**
   * Add main vertical line to depth scale group
   * @param {Group} depthGroup - Group to add line to
   * @param {number} depthMarkerOffset - X offset for positioning
   * @param {number} totalDepth - Total depth for line length
   */
  static addMainVerticalLine(depthGroup, depthMarkerOffset, totalDepth) {
    const verticalLineGeometry = new BufferGeometry();
    const verticalPositions = new Float32Array([
      -depthMarkerOffset, 0, 0,
      -depthMarkerOffset, -totalDepth, 0
    ]);
    verticalLineGeometry.setAttribute('position', new BufferAttribute(verticalPositions, 3));
    
    const verticalLineMaterial = new LineBasicMaterial({ 
      color: 0xffffff,
      name: 'depth_scale_main_line'
    });
    const verticalLine = new Line(verticalLineGeometry, verticalLineMaterial);
    verticalLine.name = 'depth_scale_main_line';
    depthGroup.add(verticalLine);
  }

  /**
   * Add depth marker tick marks to depth scale group
   * @param {Group} depthGroup - Group to add markers to
   * @param {Array} depthMarkers - Array of depth values
   * @param {number} depthMarkerOffset - X offset for positioning
   * @param {number} lineLength - Length of tick marks
   */
  static addDepthMarkers(depthGroup, depthMarkers, depthMarkerOffset, lineLength) {
    depthMarkers.forEach(depth => {
      // Create depth marker tick line
      const lineGeometry = new BufferGeometry();
      const positions = new Float32Array([
        -depthMarkerOffset, -depth, 0,
        -depthMarkerOffset - lineLength, -depth, 0
      ]);
      lineGeometry.setAttribute('position', new BufferAttribute(positions, 3));
      
      const lineMaterial = new LineBasicMaterial({ 
        color: 0xffffff,
        name: `depth_marker_${depth}ft`
      });
      const line = new Line(lineGeometry, lineMaterial);
      line.name = `depth_marker_${depth.toFixed(1)}ft`;
      
      // Add depth value as user data for export metadata
      line.userData = {
        type: 'depth_marker',
        depth_ft: depth,
        isDepthMarker: true,
        labelText: `${depth.toFixed(1)}ft`
      };
      
      depthGroup.add(line);
    });
  }

  /**
   * Add depth labels to existing depth scale group from scene
   * Extracts 3D text labels from live scene for export inclusion
   * @param {Group} depthScaleGroup - Depth scale group to enhance
   * @param {Scene} originalScene - Original Three.js scene to extract from
   */
  static addDepthLabelsTo3DGroup(depthScaleGroup, originalScene) {
    // Extract depth positions from the scene's line geometries
    const depthPositions = [];
    
    // Find depth scale lines and extract Y positions
    originalScene.traverse(child => {
      if (child.type === 'Line' && child.geometry && child.geometry.attributes && child.geometry.attributes.position) {
        const positions = child.geometry.attributes.position.array;
        
        // Check if this looks like a depth scale line (horizontal lines at left side)
        if (positions.length >= 6) { // At least 2 points (6 values: x1,y1,z1,x2,y2,z2)
          const y1 = positions[1]; // Y coordinate of first point
          const x1 = positions[0]; // X coordinate of first point
          
          const yPosition = y1;
          if (yPosition !== 0) { // Has a depth position
            // Only include lines on the left side (negative X, where depth scales typically are)
            if (x1 < 0) {
              depthPositions.push({
                y: yPosition,
                x: x1,
                z: positions[2] || 0
              });
            }
          }
        }
      }
    });

    // Remove duplicates and sort by depth (Y position, most negative first = deepest first)
    const uniquePositions = [];
    const tolerance = 0.1; // 0.1 foot tolerance for considering positions the same

    depthPositions.forEach(pos => {
      const existingPos = uniquePositions.find(existing => 
        Math.abs(existing.y - pos.y) < tolerance
      );
      if (!existingPos) {
        uniquePositions.push(pos);
      }
    });

    // Sort by Y position (most negative = deepest first)
    uniquePositions.sort((a, b) => a.y - b.y);

    // Create 3D text labels for each position
    uniquePositions.forEach((pos, index) => {
      const depthValue = Math.abs(pos.y).toFixed(1);
      const labelText = `${depthValue}ft`; // Use feet units consistently
      
      // Create 3D text label
      const textMesh = this.create3DTextLabel(labelText, pos.x - 2, pos.y, pos.z);
      if (textMesh) {
        textMesh.name = `depth_label_${depthValue}ft`;
        textMesh.userData.exportIndex = index;
        depthScaleGroup.add(textMesh);
      }
    });

    return depthScaleGroup;
  }

  /**
   * Create 3D text label for depth markers
   * @param {string} text - Text content for label
   * @param {number} x - X position
   * @param {number} y - Y position  
   * @param {number} z - Z position
   * @returns {Mesh} Three.js mesh representing text label
   */
  static create3DTextLabel(text, x, y, z) {
    // For now, create a simple plane with text-like appearance
    const geometry = new PlaneGeometry(text.length * 0.3, 0.5);
    const material = new MeshStandardMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.9,
      side: DoubleSide
    });
    
    const textMesh = new Mesh(geometry, material);
    textMesh.position.set(x, y, z);
    textMesh.userData = {
      isDepthLabel: true,
      labelText: text,
      type: 'depth_label'
    };
    
    return textMesh;
  }

  /**
   * Verify depth scale values against borehole data
   * @param {Group} depthGroup - Depth scale group to verify
   * @param {Array} boreholes - Borehole data for validation
   * @returns {Object} Verification result with diagnostics
   */
  static verifyDepthScaleValues(depthGroup, boreholes) {
    let expectedMaxDepth = 0;
    
    if (boreholes && boreholes.length > 0) {
      // Calculate expected maximum depth from boreholes
      boreholes.forEach(borehole => {
        if (borehole.totalDepth && borehole.totalDepth > 0) {
          expectedMaxDepth = Math.max(expectedMaxDepth, borehole.totalDepth);
        } else if (borehole.depth && borehole.depth > 0) {
          expectedMaxDepth = Math.max(expectedMaxDepth, borehole.depth);
        }
      });
    }

    if (expectedMaxDepth <= 0) {
      return {
        isValid: false,
        message: 'No valid borehole depths found for verification',
        expectedMaxDepth: 0,
        actualValues: []
      };
    }

    // Extract actual depth values from the depth group
    const actualDepthValues = [];
    depthGroup.traverse(node => {
      if (node.userData?.isDepthLabel && node.userData?.labelText) {
        const depthText = node.userData.labelText;
        const depthValue = parseFloat(depthText.replace("'", ""));
        if (!isNaN(depthValue)) {
          actualDepthValues.push({
            value: depthValue,
            label: depthText,
            position: node.position.clone()
          });
        }
      }
    });

    const maxActualDepth = actualDepthValues.length > 0 ? Math.max(...actualDepthValues.map(d => d.value)) : 0;

    // Verify consistency
    const depthDifference = Math.abs(maxActualDepth - expectedMaxDepth);
    const isValid = depthDifference < 0.5; // Within 0.5 feet tolerance

    return {
      isValid,
      expectedMaxDepth: expectedMaxDepth.toFixed(1),
      maxActualDepth: maxActualDepth.toFixed(1),
      depthDifference: depthDifference.toFixed(1),
      actualValues: actualDepthValues,
      message: isValid 
        ? `Depth scale valid (${maxActualDepth.toFixed(1)}ft matches expected ${expectedMaxDepth.toFixed(1)}ft)`
        : `Depth scale mismatch: actual ${maxActualDepth.toFixed(1)}ft vs expected ${expectedMaxDepth.toFixed(1)}ft`
    };
  }

  /**
   * Extract live depth scale from existing scene
   * @param {Scene} originalScene - Scene to extract from
   * @returns {Group|null} Extracted depth scale group or null
   */
  static extractLiveDepthScaleFromScene(originalScene) {
    let liveDepthScale = null;

    // Look for existing depth scale components
    originalScene.traverse(child => {
      if (child.name && (
        child.name === 'VolumetricDepthScale' || 
        child.name === 'DepthScale' ||
        child.name.includes('depth') ||
        child.name.includes('DepthScale')
      )) {
        
        if (!liveDepthScale) {
          liveDepthScale = new Group();
          liveDepthScale.name = 'ExtractedDepthScale';
        }

        // Clone and add the depth scale component
        const clonedDepthChild = this.safeCloneMesh(child);
        if (clonedDepthChild) {
          liveDepthScale.add(clonedDepthChild);
        }
      }

      // Also look for individual tick marks that might be depth markers
      if (child.isMesh && child.material && child.geometry) {
        // Simple heuristic: small box geometries positioned to the left could be tick marks
        const isTickMark = child.geometry.type === 'BoxGeometry' && 
                          child.scale.x < 1 && child.scale.y < 1 && child.scale.z < 1;
                          
        if (isTickMark && child.position.x < 0) { // Depth scales are usually positioned to the left
          if (!liveDepthScale) {
            liveDepthScale = new Group();
            liveDepthScale.name = 'ExtractedDepthScale';
          }
          
          const clonedTick = this.safeCloneMesh(child);
          if (clonedTick) {
            liveDepthScale.add(clonedTick);
          }
        }
      }
    });

    if (liveDepthScale) {
      liveDepthScale.userData = {
        type: 'extracted_depth_scale',
        source: 'live_scene_extraction'
      };
    }

    return liveDepthScale;
  }

  /**
   * Safe mesh cloning utility (simplified version for depth scale components)
   * @param {Object3D} mesh - Mesh to clone safely
   * @returns {Object3D|null} Cloned mesh or null if failed
   */
  static safeCloneMesh(mesh) {
    if (!mesh) return null;

    try {
      return mesh.clone();
    } catch (error) {
      // Silently fail cloning - this is expected for some mesh types
      return null;
    }
  }
}