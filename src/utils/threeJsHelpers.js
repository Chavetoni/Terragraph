// src/utils/threeJsHelpers.js
import { BufferGeometry, CanvasTexture, CircleGeometry, Color, DoubleSide, Group, Line, LineBasicMaterial, Mesh, MeshBasicMaterial, Sprite, SpriteMaterial, TextureLoader, Vector3 } from 'three';
import { formatDepthMetersToFeet } from './unitConverter.js';
import { CSS3DObject } from 'three/examples/jsm/renderers/CSS3DRenderer';

export function loadTexture(url) {
  return new Promise((resolve, reject) => {
    const loader = new TextureLoader();
    loader.load(url, resolve, undefined, reject);
  });
}

// Constants
const BASE_LABEL_FONT_SIZE = 18;
const BASE_LABEL_PADDING = 8;
const BASE_LABEL_MAX_WIDTH = 220;
const BASE_LABEL_BORDER_RADIUS = 4;
const BASE_SPRITE_SCALE_FACTOR = 0.012;
const BASE_MARKER_RADIUS = 0.20;
const BASE_MARKER_TEXT_CANVAS_SIZE = 64;
const BASE_MARKER_FONT_SIZE = 30;
// Removed unused constants - now using glassmorphism CSS3D labels
const BASE_DEPTH_MARKER_TICK_LENGTH = 0.25;
const BASE_DEPTH_MARKER_TEXT_GAP = 0.08;

export function createTextLabel(text, colorHexInput, strataScaleFactor = 1) {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  
  const scaledFontSize = Math.max(10, Math.min(50, BASE_LABEL_FONT_SIZE * strataScaleFactor));
  const scaledPadding = BASE_LABEL_PADDING * strataScaleFactor * 1.5; // Increased padding for glassmorphism
  const scaledMaxWidth = BASE_LABEL_MAX_WIDTH * strataScaleFactor;
  const scaledLineHeight = scaledFontSize * 1.2;
  const scaledBorderRadius = BASE_LABEL_BORDER_RADIUS * strataScaleFactor * 3; // Increased border radius
  
  context.font = `600 ${scaledFontSize}px system-ui, -apple-system, sans-serif`; // More modern font weight
  
  // Word wrap
  const words = text.split(' ');
  let lines = [];
  let currentLine = '';
  
  for (let i = 0; i < words.length; i++) {
    const testLine = currentLine + words[i] + ' ';
    const metrics = context.measureText(testLine);
    
    if (metrics.width > scaledMaxWidth && i > 0) {
      lines.push(currentLine.trim());
      currentLine = words[i] + ' ';
    } else {
      currentLine = testLine;
    }
  }
  
  lines.push(currentLine.trim());
  
  const textHeight = lines.length * scaledLineHeight;
  const textWidth = Math.max(...lines.map(line => context.measureText(line).width));
  
  canvas.width = textWidth + scaledPadding * 2;
  canvas.height = textHeight + scaledPadding * 2;
  
  // Parse color
  let colorHex = colorHexInput;
  if (typeof colorHex !== 'string' || !colorHex.startsWith('#')) {
    colorHex = '#CCCCCC';
  }
  
  const rgbColor = new Color(colorHex);
  const r = Math.floor(rgbColor.r * 255);
  const g = Math.floor(rgbColor.g * 255);
  const b = Math.floor(rgbColor.b * 255);
  
  // Glassmorphism background with subtle layer color tint
  const createGlassmorphismBackground = () => {
    // Create gradient for depth
    const gradient = context.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, `rgba(255, 255, 255, 0.08)`);
    gradient.addColorStop(1, `rgba(255, 255, 255, 0.04)`);
    
    // Main background
    context.fillStyle = gradient;
    context.beginPath();
    context.moveTo(scaledBorderRadius, 0);
    context.lineTo(canvas.width - scaledBorderRadius, 0);
    context.quadraticCurveTo(canvas.width, 0, canvas.width, scaledBorderRadius);
    context.lineTo(canvas.width, canvas.height - scaledBorderRadius);
    context.quadraticCurveTo(canvas.width, canvas.height, canvas.width - scaledBorderRadius, canvas.height);
    context.lineTo(scaledBorderRadius, canvas.height);
    context.quadraticCurveTo(0, canvas.height, 0, canvas.height - scaledBorderRadius);
    context.lineTo(0, scaledBorderRadius);
    context.quadraticCurveTo(0, 0, scaledBorderRadius, 0);
    context.closePath();
    context.fill();
    
    // Border with subtle layer color tint
    context.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.3)`;
    context.lineWidth = 1;
    context.stroke();
    
    // Inner highlight
    context.strokeStyle = `rgba(255, 255, 255, 0.2)`;
    context.lineWidth = 0.5;
    context.beginPath();
    context.moveTo(scaledBorderRadius, 1);
    context.lineTo(canvas.width - scaledBorderRadius, 1);
    context.quadraticCurveTo(canvas.width - 1, 1, canvas.width - 1, scaledBorderRadius);
    context.stroke();
  };
  
  // Apply glassmorphism background
  createGlassmorphismBackground();
  
  // Text with shadow
  context.font = `600 ${scaledFontSize}px system-ui, -apple-system, sans-serif`;
  context.fillStyle = '#ffffff';
  context.textAlign = 'left';
  context.textBaseline = 'top';
  
  // Text shadow
  context.shadowColor = 'rgba(0, 0, 0, 0.5)';
  context.shadowBlur = 3;
  context.shadowOffsetX = 0;
  context.shadowOffsetY = 1;
  
  let currentY = scaledPadding;
  lines.forEach(line => {
    context.fillText(line, scaledPadding, currentY);
    currentY += scaledLineHeight;
  });
  
  const texture = new CanvasTexture(canvas);
  texture.needsUpdate = true;
  
  const material = new SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    alphaTest: 0.1
  });
  
  const sprite = new Sprite(material);
  sprite.scale.set(
    canvas.width * BASE_SPRITE_SCALE_FACTOR,
    canvas.height * BASE_SPRITE_SCALE_FACTOR,
    1
  );
  
  // Add camera-facing behavior
  sprite.userData = {
    isGlassmorphismLabel: true,
    originalScale: {
      x: canvas.width * BASE_SPRITE_SCALE_FACTOR,
      y: canvas.height * BASE_SPRITE_SCALE_FACTOR,
      z: 1
    }
  };
  
  return sprite;
}

export function createMarker(number, strataScaleFactor = 1) {
  const group = new Group();
  
  const scaledRadius = BASE_MARKER_RADIUS * strataScaleFactor;
  const segments = 32;
  
  const circleGeometry = new CircleGeometry(scaledRadius, segments);
  const circleMaterial = new MeshBasicMaterial({
    color: 0x333333,
    side: DoubleSide
  });
  
  group.add(new Mesh(circleGeometry, circleMaterial));
  
  // Create text label
  const canvas = document.createElement('canvas');
  const textCanvasSize = BASE_MARKER_TEXT_CANVAS_SIZE * Math.sqrt(strataScaleFactor);
  
  canvas.width = textCanvasSize;
  canvas.height = textCanvasSize;
  
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  
  const scaledFontSizeForMarker = Math.max(10, Math.min(48, BASE_MARKER_FONT_SIZE * Math.sqrt(strataScaleFactor)));
  
  ctx.font = `bold ${scaledFontSizeForMarker}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(number.toString(), textCanvasSize / 2, textCanvasSize / 2);
  
  const texture = new CanvasTexture(canvas);
  texture.needsUpdate = true;
  
  const labelMaterial = new MeshBasicMaterial({
    map: texture,
    side: DoubleSide,
    transparent: true,
    depthTest: false
  });
  
  const label = new Mesh(
    new CircleGeometry(scaledRadius, segments),
    labelMaterial
  );
  
  label.position.z = 0.01 * strataScaleFactor;
  group.add(label);
  
  return group;
}

export function createDepthMarkers(
  adjustedModelHeight,
  totalActualDepth,
  layerData,
  currentCubeWidth,
  viewMode,
  verticalSpacing,
  strataScaleFactor = 1,
  sceneManager = null
) {
  if (adjustedModelHeight <= 0) return new Group();
  
  const group = new Group();
  const markerMaterial = new LineBasicMaterial({ color: 0xffffff });
  
  // Position relative to strata edge with smaller offset
  const depthMarkerOffset = currentCubeWidth / 2 + (0.2 * strataScaleFactor); // Reduced from 0.5m to 0.2m
  const lineXPosition = -depthMarkerOffset;
  const scaledTickLength = BASE_DEPTH_MARKER_TICK_LENGTH * strataScaleFactor;
  
  // Add main vertical line
  group.add(new Line(
    new BufferGeometry().setFromPoints([
      new Vector3(lineXPosition, 0, 0),
      new Vector3(lineXPosition, -adjustedModelHeight, 0)
    ]),
    markerMaterial
  ));
  
  // Calculate positions for depth markers
  const depthPositions = [];
  let currentYForMarker = 0;
  let runningActualDepth = 0;
  
  depthPositions.push({ depth: 0, yPosition: currentYForMarker });
  
  const totalExplodedSpacingForCalc = (viewMode === 'exploded' && layerData.length > 1)
    ? (layerData.length - 1) * verticalSpacing
    : 0;
    
  const modelHeightWithoutSpacing = adjustedModelHeight - totalExplodedSpacingForCalc;
  
  for (let i = 0; i < layerData.length; i++) {
    const layerActualDepth = parseFloat(layerData[i]?.depth) || 1;
    
    const layerVisualHeight = (totalActualDepth > 0
      ? (layerActualDepth / totalActualDepth)
      : (layerData.length > 0 ? 1 / layerData.length : 0)) * modelHeightWithoutSpacing;
      
    currentYForMarker -= layerVisualHeight;
    runningActualDepth += layerActualDepth;
    
    depthPositions.push({
      depth: parseFloat(runningActualDepth.toFixed(1)),
      yPosition: currentYForMarker
    });
    
    if (viewMode === 'exploded' && i < layerData.length - 1) {
      currentYForMarker -= verticalSpacing;
    }
  }
  
  // Special case handling for edge cases
  if (layerData.length === 0 && adjustedModelHeight > 0 && depthPositions.length === 1) {
    depthPositions.push({ depth: 0, yPosition: -adjustedModelHeight });
  } else if (layerData.length > 0 && Math.abs(currentYForMarker - (-adjustedModelHeight)) > 0.01) {
    if (Math.abs(depthPositions[depthPositions.length - 1].yPosition - (-adjustedModelHeight)) > 0.01) {
      depthPositions.push({
        depth: parseFloat(totalActualDepth.toFixed(1)),
        yPosition: -adjustedModelHeight
      });
    }
  }
  
  // Create tick marks and labels for all depth positions
  depthPositions.forEach((item, index) => {
    // Add tick mark
    group.add(new Line(
      new BufferGeometry().setFromPoints([
        new Vector3(lineXPosition, item.yPosition, 0),
        new Vector3(lineXPosition - scaledTickLength, item.yPosition, 0)
      ]),
      markerMaterial
    ));
    
    // Create glassmorphism depth label
    if (sceneManager) {
      const depthInFeet = formatDepthMetersToFeet(item.depth);
      const text = `${depthInFeet}'`;
      const glassLabel = createGlassmorphismLabel(text, '#ffffff', 'depth');
      
      const scaledGapFromTick = BASE_DEPTH_MARKER_TEXT_GAP * strataScaleFactor;
      
      glassLabel.position.set(
        lineXPosition - scaledTickLength - scaledGapFromTick - 0.15, // Reduced from 0.5 to 0.15
        item.yPosition,
        0
      );
      
      sceneManager.addCSS3D(`depth-marker-${index}`, glassLabel);
    }
  });
  
  return group;
}

export function createGlassmorphismLabel(text, colorHex = '#ffffff', type = 'layer') {
  // Create HTML element for the label
  const labelElement = document.createElement('div');
  labelElement.textContent = text;
  
  // Apply glassmorphism styling based on type
  switch (type) {
    case 'layer':
      labelElement.className = 'glass-label';
      break;
    case 'depth':
      labelElement.className = 'glass-depth-label';
      break;
    case 'borehole':
      labelElement.className = 'glass-borehole-label';
      break;
    case 'borehole-pin':
      labelElement.className = 'glass-borehole-pin';
      break;
    default:
      labelElement.className = 'glass-label';
  }
  
  // Apply dynamic styling based on layer color (subtle tint)
  if (colorHex && colorHex !== '#ffffff') {
    const color = new Color(colorHex);
    const rgbValues = `${Math.floor(color.r * 255)}, ${Math.floor(color.g * 255)}, ${Math.floor(color.b * 255)}`;
    
    // Add subtle color tint to the glassmorphism effect
    labelElement.style.boxShadow = `0 8px 32px 0 rgba(${rgbValues}, 0.1), 0 4px 16px 0 rgba(31, 38, 135, 0.37)`;
    labelElement.style.borderColor = `rgba(${rgbValues}, 0.2)`;
  }
  
  // Create CSS3DObject for the label
  const labelObject = new CSS3DObject(labelElement);
  
  // Set initial scale based on label type for better proportions
  let scaleValue = 0.04; // Default scale - increased for better visibility
  if (type === 'borehole-pin') {
    scaleValue = 0.025; // Increased scale for compact borehole pin labels
  } else if (type === 'depth') {
    scaleValue = 0.03; // Increased scale for depth markers
  } else if (type === 'borehole') {
    scaleValue = 0.035; // Increased scale for borehole labels
  } else if (type === 'layer') {
    scaleValue = 0.04; // Good scale for layer labels
  }
  
  labelObject.scale.set(scaleValue, scaleValue, scaleValue);
  
  // Add metadata for identification
  labelObject.userData = {
    isGlassmorphismLabel: true,
    labelType: type,
    originalText: text
  };
  
  return labelObject;
}

