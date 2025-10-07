/**
 * TexturePreview Component
 * 
 * Renders small preview canvases showing USCS material texture patterns
 * Used in material selection and layer profile visualization
 */

import React, { useRef, useEffect, useState } from 'react';
import { getMaterialProperties } from '../../utils/materialStandardization';

/**
 * Small canvas component that renders USCS texture patterns
 */
function TexturePreview({ 
  material, 
  width = 48, 
  height = 48, 
  className = '',
  showLabel = false,
  style = {} 
}) {
  const canvasRef = useRef(null);
  const [isRendered, setIsRendered] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !material) return;

    const ctx = canvas.getContext('2d');
    const materialProps = getMaterialProperties(material);
    
    // Set canvas size
    canvas.width = width;
    canvas.height = height;
    
    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    
    // Fill background with material color
    ctx.fillStyle = materialProps.color;
    ctx.fillRect(0, 0, width, height);
    
    // Render texture pattern
    try {
      renderTexturePattern(ctx, materialProps.pattern, {
        patternColor: getDarkerColor(materialProps.color, 0.3),
        strokeColor: getDarkerColor(materialProps.color, 0.5),
        adjustedSpacing: Math.max(4, width * 0.15),
        scale: width / 48, // Scale based on preview size
        width,
        height
      });
      setIsRendered(true);
    } catch (error) {
      // Fall back to solid color
      setIsRendered(true);
    }
  }, [material, width, height]);

  const materialProps = getMaterialProperties(material);

  return (
    <div 
      className={`texture-preview ${className}`}
      style={{ 
        display: 'inline-block',
        position: 'relative',
        ...style 
      }}
    >
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{
          border: '1px solid #ddd',
          borderRadius: '4px',
          display: 'block',
          backgroundColor: materialProps.color
        }}
        title={`${material} - ${materialProps.description}`}
      />
      {showLabel && (
        <div 
          style={{
            fontSize: '10px',
            textAlign: 'center',
            marginTop: '2px',
            color: '#666',
            fontWeight: '500'
          }}
        >
          {material}
        </div>
      )}
      {!isRendered && (
        <div 
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            fontSize: '10px',
            color: '#999'
          }}
        >
          ...
        </div>
      )}
    </div>
  );
}

/**
 * Get a darker version of a color for pattern rendering
 */
function getDarkerColor(hexColor, amount = 0.3) {
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  
  const darkR = Math.max(0, Math.round(r * (1 - amount)));
  const darkG = Math.max(0, Math.round(g * (1 - amount)));
  const darkB = Math.max(0, Math.round(b * (1 - amount)));
  
  return `rgb(${darkR}, ${darkG}, ${darkB})`;
}

/**
 * Render USCS texture patterns on canvas (optimized for small previews)
 */
function renderTexturePattern(ctx, pattern, options) {
  const { patternColor, strokeColor, adjustedSpacing, scale, width, height } = options;
  
  ctx.strokeStyle = patternColor;
  ctx.fillStyle = patternColor;
  ctx.lineWidth = Math.max(0.5, scale);
  
  switch (pattern) {
    case 'gravel_circles':
      renderPreviewGravelCircles(ctx, { patternColor, strokeColor, spacing: adjustedSpacing, scale, width, height });
      break;
    case 'gravel_silt':
      renderPreviewGravelSilt(ctx, { patternColor, strokeColor, spacing: adjustedSpacing, scale, width, height });
      break;
    case 'gravel_clay':
      renderPreviewGravelClay(ctx, { patternColor, strokeColor, spacing: adjustedSpacing, scale, width, height });
      break;
    case 'sand_dots':
      renderPreviewSandDots(ctx, { patternColor, strokeColor, spacing: adjustedSpacing, scale, width, height });
      break;
    case 'sand_silt':
      renderPreviewSandSilt(ctx, { patternColor, strokeColor, spacing: adjustedSpacing, scale, width, height });
      break;
    case 'sand_clay':
      renderPreviewSandClay(ctx, { patternColor, strokeColor, spacing: adjustedSpacing, scale, width, height });
      break;
    case 'horizontal_lines':
      renderPreviewHorizontalLines(ctx, { patternColor, strokeColor, spacing: adjustedSpacing, scale, width, height });
      break;
    case 'horizontal_dashed':
      renderPreviewHorizontalDashed(ctx, { patternColor, strokeColor, spacing: adjustedSpacing, scale, width, height });
      break;
    case 'horizontal_lines_organic':
      renderPreviewHorizontalLinesOrganic(ctx, { patternColor, strokeColor, spacing: adjustedSpacing, scale, width, height });
      break;
    case 'diagonal_lines':
      renderPreviewDiagonalLines(ctx, { patternColor, strokeColor, spacing: adjustedSpacing, scale, width, height });
      break;
    case 'diagonal_crosshatch':
      renderPreviewDiagonalCrosshatch(ctx, { patternColor, strokeColor, spacing: adjustedSpacing, scale, width, height });
      break;
    case 'diagonal_lines_organic':
      renderPreviewDiagonalLinesOrganic(ctx, { patternColor, strokeColor, spacing: adjustedSpacing, scale, width, height });
      break;
    case 'organic_irregular':
      renderPreviewOrganicIrregular(ctx, { patternColor, strokeColor, spacing: adjustedSpacing, scale, width, height });
      break;
    case 'rock_pattern':
      renderPreviewRockPattern(ctx, { patternColor, strokeColor, spacing: adjustedSpacing, scale, width, height });
      break;
    case 'fill_pattern':
      renderPreviewFillPattern(ctx, { patternColor, strokeColor, spacing: adjustedSpacing, scale, width, height });
      break;
    case 'topsoil_organic':
      renderPreviewTopsoilOrganic(ctx, { patternColor, strokeColor, spacing: adjustedSpacing, scale, width, height });
      break;
    // Legacy patterns
    case 'horizontal-lines':
      renderPreviewHorizontalLines(ctx, { patternColor, strokeColor, spacing: adjustedSpacing, scale, width, height });
      break;
    case 'dots':
      renderPreviewSandDots(ctx, { patternColor, strokeColor, spacing: adjustedSpacing, scale, width, height });
      break;
    case 'circles':
      renderPreviewGravelCircles(ctx, { patternColor, strokeColor, spacing: adjustedSpacing, scale, width, height });
      break;
    case 'cross-hatch':
      renderPreviewRockPattern(ctx, { patternColor, strokeColor, spacing: adjustedSpacing, scale, width, height });
      break;
    case 'diagonal-lines':
      renderPreviewDiagonalLines(ctx, { patternColor, strokeColor, spacing: adjustedSpacing, scale, width, height });
      break;
    default:
      // Default to horizontal lines for unknown patterns
      renderPreviewHorizontalLines(ctx, { patternColor, strokeColor, spacing: adjustedSpacing, scale, width, height });
      break;
  }
}

// ========== PREVIEW PATTERN RENDERING METHODS ==========
// Optimized versions of USCS patterns for small preview canvases

function renderPreviewGravelCircles(ctx, { patternColor, spacing, scale, width, height }) {
  ctx.fillStyle = patternColor;
  const circleSpacing = Math.max(8, spacing * 1.2);
  
  for (let x = circleSpacing/2; x < width; x += circleSpacing) {
    for (let y = circleSpacing/2; y < height; y += circleSpacing) {
      const size = Math.max(1, 3 * scale);
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function renderPreviewGravelSilt(ctx, options) {
  renderPreviewGravelCircles(ctx, options);
  renderPreviewHorizontalLines(ctx, { ...options, spacing: options.spacing * 1.5 });
}

function renderPreviewGravelClay(ctx, options) {
  renderPreviewGravelCircles(ctx, options);
  const { patternColor, scale, width, height } = options;
  
  ctx.fillStyle = patternColor;
  ctx.globalAlpha = 0.3;
  for (let x = 4; x < width; x += 12) {
    for (let y = 4; y < height; y += 12) {
      ctx.fillRect(x, y, 2 * scale, 2 * scale);
    }
  }
  ctx.globalAlpha = 1.0;
}

function renderPreviewSandDots(ctx, { patternColor, spacing, scale, width, height }) {
  ctx.fillStyle = patternColor;
  const dotSpacing = Math.max(4, spacing * 0.8);
  const dotSize = Math.max(0.5, 1.5 * scale);
  
  for (let x = dotSpacing/2; x < width; x += dotSpacing) {
    for (let y = dotSpacing/2; y < height; y += dotSpacing) {
      ctx.beginPath();
      ctx.arc(x, y, dotSize, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function renderPreviewSandSilt(ctx, options) {
  renderPreviewSandDots(ctx, options);
  renderPreviewHorizontalLines(ctx, { ...options, spacing: options.spacing * 1.3 });
}

function renderPreviewSandClay(ctx, options) {
  renderPreviewSandDots(ctx, options);
  const { patternColor, scale, width, height } = options;
  
  ctx.fillStyle = patternColor;
  ctx.globalAlpha = 0.2;
  for (let x = 3; x < width; x += 8) {
    for (let y = 3; y < height; y += 8) {
      ctx.fillRect(x, y, 1.5 * scale, 1.5 * scale);
    }
  }
  ctx.globalAlpha = 1.0;
}

function renderPreviewHorizontalLines(ctx, { patternColor, spacing, scale, width, height }) {
  ctx.strokeStyle = patternColor;
  ctx.lineWidth = Math.max(0.5, scale);
  const lineSpacing = Math.max(3, spacing);
  
  for (let y = lineSpacing/2; y < height; y += lineSpacing) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
}

function renderPreviewHorizontalDashed(ctx, { patternColor, spacing, scale, width, height }) {
  ctx.strokeStyle = patternColor;
  ctx.lineWidth = Math.max(0.5, scale);
  ctx.setLineDash([4 * scale, 2 * scale]);
  const lineSpacing = Math.max(4, spacing);
  
  for (let y = lineSpacing/2; y < height; y += lineSpacing) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
  ctx.setLineDash([]);
}

function renderPreviewHorizontalLinesOrganic(ctx, options) {
  renderPreviewHorizontalLines(ctx, options);
  const { patternColor, scale, width, height } = options;
  
  ctx.fillStyle = patternColor;
  ctx.globalAlpha = 0.4;
  for (let x = 6; x < width; x += 12) {
    for (let y = 6; y < height; y += 12) {
      ctx.beginPath();
      ctx.arc(x, y, 1.5 * scale, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1.0;
}

function renderPreviewDiagonalLines(ctx, { patternColor, spacing, scale, width, height }) {
  ctx.strokeStyle = patternColor;
  ctx.lineWidth = Math.max(0.5, scale);
  const lineSpacing = Math.max(4, spacing);
  
  for (let i = -height; i < width + height; i += lineSpacing) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + height, height);
    ctx.stroke();
  }
}

function renderPreviewDiagonalCrosshatch(ctx, { patternColor, spacing, scale, width, height }) {
  ctx.strokeStyle = patternColor;
  ctx.lineWidth = Math.max(0.5, scale * 0.8);
  const lineSpacing = Math.max(4, spacing);
  
  // Diagonal lines (/)
  for (let i = -height; i < width + height; i += lineSpacing) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + height, height);
    ctx.stroke();
  }
  
  // Diagonal lines (\)
  for (let i = -height; i < width + height; i += lineSpacing) {
    ctx.beginPath();
    ctx.moveTo(i + height, 0);
    ctx.lineTo(i, height);
    ctx.stroke();
  }
}

function renderPreviewDiagonalLinesOrganic(ctx, options) {
  renderPreviewDiagonalLines(ctx, options);
  const { patternColor, scale, width, height } = options;
  
  ctx.fillStyle = patternColor;
  ctx.globalAlpha = 0.3;
  for (let x = 8; x < width; x += 14) {
    for (let y = 8; y < height; y += 14) {
      ctx.beginPath();
      ctx.arc(x, y, 2 * scale, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1.0;
}

function renderPreviewOrganicIrregular(ctx, { patternColor, scale, width, height }) {
  ctx.fillStyle = patternColor;
  
  for (let x = 4; x < width; x += 8) {
    for (let y = 4; y < height; y += 8) {
      const size = Math.max(0.8, (2 + Math.sin(x * 0.3) * 1) * scale);
      const offsetX = Math.sin(y * 0.2) * 2;
      const offsetY = Math.cos(x * 0.2) * 2;
      
      ctx.beginPath();
      ctx.arc(x + offsetX, y + offsetY, size, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function renderPreviewRockPattern(ctx, { patternColor, spacing, scale, width, height }) {
  // Base cross-hatch
  ctx.strokeStyle = patternColor;
  ctx.lineWidth = Math.max(0.5, scale * 0.7);
  const lineSpacing = Math.max(3, spacing * 0.7);
  
  // Vertical lines
  for (let x = lineSpacing/2; x < width; x += lineSpacing) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  
  // Horizontal lines
  for (let y = lineSpacing/2; y < height; y += lineSpacing) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
}

function renderPreviewFillPattern(ctx, { patternColor, scale, width, height }) {
  ctx.fillStyle = patternColor;
  
  for (let x = 2; x < width; x += 6) {
    for (let y = 2; y < height; y += 6) {
      const patternType = Math.floor((x + y) / 4) % 3;
      
      switch (patternType) {
        case 0: // Dots
          ctx.beginPath();
          ctx.arc(x, y, scale, 0, Math.PI * 2);
          ctx.fill();
          break;
        case 1: // Small circles
          ctx.beginPath();
          ctx.arc(x, y, 1.5 * scale, 0, Math.PI * 2);
          ctx.fill();
          break;
        case 2: // Small rectangles
          ctx.fillRect(x - scale, y - scale, 2 * scale, 2 * scale);
          break;
        default:
          // Fallback to dots for unexpected pattern types
          ctx.beginPath();
          ctx.arc(x, y, scale, 0, Math.PI * 2);
          ctx.fill();
          break;
      }
    }
  }
}

function renderPreviewTopsoilOrganic(ctx, options) {
  renderPreviewHorizontalLines(ctx, { ...options, spacing: options.spacing * 1.2 });
  const { patternColor, scale, width, height } = options;
  
  ctx.fillStyle = patternColor;
  ctx.globalAlpha = 0.6;
  for (let x = 6; x < width; x += 10) {
    for (let y = 6; y < height; y += 10) {
      ctx.beginPath();
      ctx.arc(x, y, scale, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1.0;
}

export default TexturePreview;