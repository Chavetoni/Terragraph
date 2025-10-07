import React, { useState, useCallback, useEffect, useMemo, useTransition, useRef } from 'react';
import { BOREHOLE_TYPES } from '../../models/Borehole';
import { validateBoreholeData } from '../../utils/geologicalValidation';
import { STANDARD_MATERIALS, getMaterialProperties } from '../../utils/materialStandardization';
import StandardButton from './StandardButton';
import { 
  StandardInput, 
  StandardSelect, 
  StandardFormGroup
} from './StandardForm';
import TexturePreview from './TexturePreview';
import './BoreholeCreationModal.css';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// USCS Material Types - organized for UI display
const USCS_MATERIAL_GROUPS = {
  'GRAVELS': {
    name: 'Gravels (Coarse-Grained)',
    materials: ['GW', 'GP', 'GM', 'GC']
  },
  'SANDS': {
    name: 'Sands (Coarse-Grained)', 
    materials: ['SW', 'SP', 'SM', 'SC']
  },
  'SILTS_CLAYS_LOW': {
    name: 'Silts & Clays (Low Plasticity)',
    materials: ['ML', 'CL', 'OL']
  },
  'SILTS_CLAYS_HIGH': {
    name: 'Silts & Clays (High Plasticity)',
    materials: ['MH', 'CH', 'OH']
  },
  'ORGANIC': {
    name: 'Highly Organic Soils',
    materials: ['PT']
  },
  'OTHER': {
    name: 'Other Materials',
    materials: ['ROCK', 'FILL', 'TOPSOIL']
  },
  'LEGACY': {
    name: 'General Classifications',
    materials: ['CLAY', 'SAND', 'GRAVEL', 'SILT', 'PEAT']
  }
};

// Icon component
const Icon = ({ path, className = "" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={`icon ${className}`}>
    <path fillRule="evenodd" d={path} clipRule="evenodd" />
  </svg>
);

// Accordion Section component - Memoized for performance
const AccordionSection = React.memo(({ title, icon, summary, children, isOpen, setIsOpen }) => (
  <div className="accordion-section-new">
    <button
      type="button"
      onClick={() => setIsOpen(!isOpen)}
      className="accordion-header-new"
    >
      <div className="accordion-header-left">
        <div className="accordion-icon">{icon}</div>
        <span className="accordion-title">{title}</span>
      </div>
      <div className="accordion-summary">
        {summary && <span>{summary}</span>}
        <Icon 
          path={isOpen ? "M5 10h10" : "M10 5.5v9m-4.5-4.5h9"} 
          className={`accordion-chevron ${isOpen ? 'expanded' : ''}`}
        />
      </div>
    </button>
    {isOpen && (
      <div className="accordion-content-new">
        {children}
      </div>
    )}
  </div>
));

// Sortable Layer Item component
const SortableLayerItem = ({ layer, index, onLayerChange, removeLayer, totalDepth, isAutoFrom, getMaterialColor, getLayerStatus, layerCount, onColorPickerOpen }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: layer.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
  };
  
  const thickness = (layer.to || 0) - (layer.from || 0);

  return (
    <div 
      ref={setNodeRef} 
      style={style}
      className={`layer-item ${isDragging ? 'dragging' : ''}`}
    >
      {layerCount > 1 && (
        <StandardButton
          variant="icon"
          onClick={() => removeLayer(index)}
          className="layer-remove-btn-top-right"
          title="Remove Layer"
          icon="×"
        />
      )}
      <div className="layer-header">
        <div className="accordion-header-left">
          <div 
            {...attributes} 
            {...listeners} 
            className="layer-drag-handle"
            title="Drag to reorder"
          >
            ⋮⋮
          </div>
          <div>
            <h4 className="layer-number">
              Layer {index + 1}
            </h4>
            <p className="layer-subtitle">
              {thickness.toFixed(1)}m thick
            </p>
          </div>
        </div>
      </div>

      <div className="layer-form-row">
        {/* Material Control */}
        <StandardFormGroup>
          <label className="form-label-new">
            Material
          </label>
          <div className="color-preview-container" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div 
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onColorPickerOpen('material', layer.id);
              }}
              className="color-preview-swatch"
              style={{
                backgroundColor: getMaterialColor(layer.material, layer.id),
                minWidth: '32px'
              }}
              title="Click to choose custom color"
            >
              <div className="type-badge-indicator" />
            </div>
            <StandardSelect
              value={layer.material}
              onChange={(e) => onLayerChange(index, 'material', e.target.value)}
              className="form-select-new"
              style={{flex: 1}}
            >
              {Object.entries(USCS_MATERIAL_GROUPS).map(([groupKey, group]) => (
                <optgroup key={groupKey} label={group.name}>
                  {group.materials.map(materialKey => {
                    const material = STANDARD_MATERIALS[materialKey];
                    if (!material) return null;
                    return (
                      <option key={materialKey} value={materialKey}>
                        {materialKey} - {material.description}
                      </option>
                    );
                  })}
                </optgroup>
              ))}
            </StandardSelect>
          </div>
        </StandardFormGroup>
        
        {/* Depth Control */}
        <StandardFormGroup>
          <label className="form-label-new">
            Depth Range (ft)
          </label>
          <div className="layer-depth-inputs">
            <StandardInput
              type="number"
              value={layer.from}
              onChange={(e) => onLayerChange(index, 'from', e.target.value)}
              className="depth-input"
              step="0.1" 
              min="0" 
              max={totalDepth}
              disabled={isAutoFrom}
            />
            <span className="depth-arrow">→</span>
            <StandardInput
              type="number"
              value={layer.to}
              onChange={(e) => onLayerChange(index, 'to', e.target.value)}
              className="depth-input"
              step="0.1" 
              min="0" 
              max={totalDepth}
            />
          </div>
        </StandardFormGroup>
      </div>
      
      {/* Validation Messages */}
      {getLayerStatus(index).messages.length > 0 && (
        <div className="layer-validation-messages">
          {getLayerStatus(index).messages.map((msg, i) => (
            <div key={i} className={`layer-status ${getLayerStatus(index).type === 'error' ? 'invalid' : 'warning'}`}>
              <span>⚠</span>
              <span>{msg}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Layer Profile Visualizer component
const LayerProfile = ({ layers, totalDepth, getMaterialColor }) => {
  const definedDepth = layers.reduce((sum, layer) => sum + (layer.to - layer.from), 0);
  const undefinedDepth = totalDepth - definedDepth;

  return (
    <div className="layer-profile-container">
      <h4 className="layer-profile-title">
        Layer Profile
      </h4>
      <div className="layer-profile-chart">
        {layers.map((layer) => {
          const height = totalDepth > 0 ? ((layer.to - layer.from) / totalDepth) * 100 : 0;
          const top = totalDepth > 0 ? (layer.from / totalDepth) * 100 : 0;
          if (height <= 0) return null;

          const layerHeightPx = Math.max(20, (height / 100) * 200); // Assume profile is ~200px tall
          
          return (
            <div 
              key={layer.id} 
              style={{
                position: 'absolute',
                top: `${top}%`,
                height: `${height}%`,
                width: '100%',
                overflow: 'hidden',
                border: '1px solid rgba(255,255,255,0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              {/* Texture background */}
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 0,
                overflow: 'hidden'
              }}>
                <TexturePreview 
                  material={layer.material}
                  width={200}
                  height={layerHeightPx}
                  className="layer-profile-texture"
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover'
                  }}
                />
              </div>
              
              {/* Material label overlay */}
              <div 
                className="material-label-overlay"
                style={{
                  position: 'relative',
                  zIndex: 1,
                  backgroundColor: 'rgba(0,0,0,0.6)',
                  borderRadius: '12px',
                  padding: '2px 8px',
                  fontSize: '11px',
                  fontWeight: '600',
                  color: 'white',
                  opacity: 0,
                  transition: 'opacity 0.2s',
                  pointerEvents: 'none'
                }}
              >
                {layer.material}
              </div>
              
              {/* Depth label */}
              <div style={{
                position: 'absolute',
                left: '-48px',
                top: '0',
                fontSize: '10px',
                color: 'var(--text-secondary)',
                width: '40px',
                textAlign: 'right'
              }}>
                {layer.from.toFixed(1)}m
              </div>
            </div>
          );
        })}

        {undefinedDepth > 0.01 && (
          <div style={{
            position: 'absolute',
            top: `${(definedDepth / totalDepth) * 100}%`,
            height: `${(undefinedDepth / totalDepth) * 100}%`,
            width: '100%',
            background: 'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(255,255,255,0.1) 10px, rgba(255,255,255,0.1) 20px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-secondary)',
            fontSize: '12px'
          }}>
            Undefined
          </div>
        )}
        <div style={{
          position: 'absolute',
          left: '-48px',
          bottom: '0',
          fontSize: '10px',
          color: 'var(--text-secondary)',
          width: '40px',
          textAlign: 'right'
        }}>
          {totalDepth.toFixed(1)}m
        </div>
      </div>
    </div>
  );
};

// Original HSL Color Wheel Component (for boreholes)
const HSLColorWheel = ({ size = 180, onColorSelect, selectedColor = '#ff0000' }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState({ x: size / 2, y: size / 2 });
  const canvasRef = React.useRef(null);

  // Draw traditional HSL color wheel
  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const centerX = size / 2;
    const centerY = size / 2;
    const radius = size / 2 - 10;
    
    // Clear canvas
    ctx.clearRect(0, 0, size, size);
    
    // Draw color wheel
    for (let angle = 0; angle < 360; angle += 1) {
      const startAngle = (angle - 1) * Math.PI / 180;
      const endAngle = angle * Math.PI / 180;
      
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, startAngle, endAngle);
      ctx.lineWidth = 20;
      ctx.strokeStyle = `hsl(${angle}, 100%, 50%)`;
      ctx.stroke();
    }
    
    // Draw inner circle (brightness/saturation)
    const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius - 20);
    gradient.addColorStop(0, 'white');
    gradient.addColorStop(1, 'transparent');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius - 20, 0, 2 * Math.PI);
    ctx.fill();
    
    const gradient2 = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius - 20);
    gradient2.addColorStop(0, 'transparent');
    gradient2.addColorStop(1, 'black');
    ctx.fillStyle = gradient2;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius - 20, 0, 2 * Math.PI);
    ctx.fill();
  }, [size]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleMouseDown = (e) => {
    setIsDragging(true);
    handleMouseMove(e);
  };

  const handleMouseMove = (e) => {
    if (!isDragging && e.type === 'mousemove') return;
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Calculate color based on position
    const centerX = size / 2;
    const centerY = size / 2;
    const dx = x - centerX;
    const dy = y - centerY;
    const angle = Math.atan2(dy, dx) * 180 / Math.PI;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const radius = size / 2 - 30;
    
    if (distance <= radius) {
      const hue = (angle + 360) % 360;
      const saturation = Math.min(distance / radius * 100, 100);
      const lightness = 50;
      const color = hslToHex(hue, saturation, lightness);
      
      setPosition({ x, y });
      onColorSelect(color);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  React.useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <canvas
        ref={canvasRef}
        width={size}
        height={size}
        style={{ cursor: 'crosshair', borderRadius: '50%' }}
        onMouseDown={handleMouseDown}
      />
      <div
        style={{
          position: 'absolute',
          left: position.x - 6,
          top: position.y - 6,
          width: '12px',
          height: '12px',
          border: '2px solid white',
          borderRadius: '50%',
          backgroundColor: selectedColor,
          boxShadow: '0 0 0 1px rgba(0,0,0,0.3)',
          pointerEvents: 'none'
        }}
      />
    </div>
  );
};

// Helper function to convert HSL to HEX
function hslToHex(h, s, l) {
  l /= 100;
  const a = s * Math.min(l, 1 - l) / 100;
  const f = n => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

// Specialized Soil Color Wheel Component (for materials) - Memoized for performance
const SoilColorWheel = React.memo(({ size = 180, onColorSelect, selectedColor = '#8B4513' }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState({ x: size / 2, y: size / 2 });
  const canvasRef = React.useRef(null);
  
  // Performance optimization - use RAF to throttle mouse events
  const mouseMoveRef = useRef(null);
  
  // Pre-compute color lookup map for performance
  const colorLookupMapRef = useRef(new Map());

  // Organized soil color palette - grouped by soil type in logical order
  const soilColorRings = useMemo(() => [
    // Inner ring - Sandy & Light soils (12 o'clock starting with lightest sands)
    [
      '#F5DEB3', // Light sand (Wheat) - 12 o'clock
      '#F4E4BC', // Beach sand (Cream) - 1 o'clock
      '#D2B48C', // Medium sand (Tan) - 2 o'clock  
      '#DDD6C0', // Sandy clay (Light clay) - 3 o'clock
      '#E0D5C7', // Sandy loam (Beige) - 4 o'clock
      '#D3C7B8', // Fine sand (Light sandy) - 5 o'clock
      '#C9A96E', // Coarse sand (Light earth) - 6 o'clock
      '#C8B99C'  // Sandy silt (Light brown) - 7-11 o'clock
    ],
    // Middle ring - Clay & Loam soils (grouped by clay content)
    [
      '#CD853F', // Light clay (Peru) - 12 o'clock
      '#BC9A6A', // Silty clay (Medium clay) - 1 o'clock
      '#A0522D', // Medium clay (Sienna) - 2 o'clock
      '#8B4513', // Heavy clay (Saddle brown) - 3 o'clock
      '#D2691E', // Clay loam (Chocolate) - 4 o'clock
      '#B87333', // Sandy clay loam (Wood brown) - 5 o'clock
      '#9C6B2E', // Loam (Medium loam) - 6 o'clock
      '#A0785A', // Silty loam (Medium earth) - 7 o'clock
      '#906B54', // Clay-rich loam (Medium brown) - 8 o'clock
      '#C17817', // Iron-rich clay (Golden brown) - 9 o'clock
      '#B8860B', // Weathered clay (Dark goldenrod) - 10 o'clock
      '#8FBC8F'  // Organic clay (Dark sea green) - 11 o'clock
    ],
    // Outer ring - Dark & Organic soils (grouped from organic to rocky)
    [
      '#556B2F', // Rich organic (Dark olive green) - 12 o'clock
      '#2F4F4F', // Peat/organic matter (Dark slate gray) - 1 o'clock
      '#654321', // Humus-rich (Dark brown) - 2 o'clock
      '#5C4033', // Forest soil (Dark earth) - 3 o'clock
      '#4E342E', // Very organic (Dark coffee) - 4 o'clock
      '#3C2414', // Deep organic (Very dark brown) - 5 o'clock
      '#6F4E37', // Coffee soil (Coffee) - 6 o'clock
      '#5D4037', // Weathered organic (Brown) - 7 o'clock
      '#704214', // Iron-stained (Raw umber) - 8 o'clock
      '#4A4238', // Heavy organic clay (Dark clay) - 9 o'clock
      '#8B7355', // Weathered rock (Dark khaki) - 10 o'clock
      '#708090', // Decomposed rock (Slate gray) - 11 o'clock
      '#696969', // Rocky soil (Dim gray) - 12 o'clock
      '#36454F', // Bedrock (Charcoal) - 1 o'clock
      '#463E3F', // Shale (Dark taupe) - 2 o'clock
      '#36454F'  // Hard rock (Charcoal) - 3 o'clock
    ]
  ], []); // Static array, no dependencies

  // Draw specialized soil color wheel
  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const centerX = size / 2;
    const centerY = size / 2;
    const outerRadius = size / 2 - 5;
    
    // Clear canvas
    ctx.clearRect(0, 0, size, size);
    
    // Draw concentric rings of soil colors
    const ringWidth = outerRadius / soilColorRings.length;
    
    soilColorRings.forEach((ring, ringIndex) => {
      const innerRadius = ringIndex * ringWidth;
      const currentOuterRadius = (ringIndex + 1) * ringWidth;
      const angleStep = (2 * Math.PI) / ring.length;
      
      ring.forEach((color, colorIndex) => {
        const startAngle = colorIndex * angleStep;
        const endAngle = (colorIndex + 1) * angleStep;
        
        // Create gradient for each segment
        const gradient = ctx.createRadialGradient(
          centerX, centerY, innerRadius,
          centerX, centerY, currentOuterRadius
        );
        gradient.addColorStop(0, lightenColor(color, 0.2));
        gradient.addColorStop(1, color);
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(centerX, centerY, currentOuterRadius, startAngle, endAngle);
        ctx.arc(centerX, centerY, innerRadius, endAngle, startAngle, true);
        ctx.closePath();
        ctx.fill();
        
        // Add subtle border
        ctx.strokeStyle = 'rgba(255,255,255,0.1)';
        ctx.lineWidth = 0.5;
        ctx.stroke();
      });
    });
    
    // Add center circle with common soil color
    const centerGradient = ctx.createRadialGradient(
      centerX, centerY, 0,
      centerX, centerY, ringWidth * 0.7
    );
    centerGradient.addColorStop(0, '#DEB887'); // Burlywood
    centerGradient.addColorStop(1, '#CD853F'); // Peru
    
    ctx.fillStyle = centerGradient;
    ctx.beginPath();
    ctx.arc(centerX, centerY, ringWidth * 0.7, 0, 2 * Math.PI);
    ctx.fill();
    
    // Center border
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 1;
    ctx.stroke();
    
  }, [size]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleMouseDown = (e) => {
    setIsDragging(true);
    handleMouseMove(e);
  };

  // Performance-optimized mouse move handler using RAF
  const handleMouseMove = useCallback((e) => {
    if (!isDragging && e.type === 'mousemove') return;
    
    // Cancel previous RAF to prevent queuing
    if (mouseMoveRef.current) {
      cancelAnimationFrame(mouseMoveRef.current);
    }
    
    // Use requestAnimationFrame to throttle expensive calculations
    mouseMoveRef.current = requestAnimationFrame(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      const centerX = size / 2;
      const centerY = size / 2;
      const dx = x - centerX;
      const dy = y - centerY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const outerRadius = size / 2 - 5;
      
      if (distance <= outerRadius) {
        // Create lookup key for caching
        const lookupKey = `${Math.floor(distance)}-${Math.floor(Math.atan2(dy, dx) * 100)}`;
        
        // Check cache first
        if (colorLookupMapRef.current.has(lookupKey)) {
          const cachedResult = colorLookupMapRef.current.get(lookupKey);
          setPosition({ x, y });
          onColorSelect(cachedResult.color);
          return;
        }
        
        // Calculate color if not cached
        let selectedColor = '#8B4513'; // Default
        const ringWidth = outerRadius / soilColorRings.length;
        const ringIndex = Math.min(Math.floor(distance / ringWidth), soilColorRings.length - 1);
        
        // Handle center circle
        if (distance < ringWidth * 0.7) {
          selectedColor = '#CD853F'; // Center color
        } else if (ringIndex < soilColorRings.length) {
          const ring = soilColorRings[ringIndex];
          const angle = Math.atan2(dy, dx);
          const normalizedAngle = angle < 0 ? angle + 2 * Math.PI : angle;
          const segmentIndex = Math.floor((normalizedAngle / (2 * Math.PI)) * ring.length);
          selectedColor = ring[segmentIndex] || ring[0];
        }
        
        // Cache the result
        colorLookupMapRef.current.set(lookupKey, { color: selectedColor });
        
        // Limit cache size to prevent memory leaks
        if (colorLookupMapRef.current.size > 100) {
          const firstKey = colorLookupMapRef.current.keys().next().value;
          colorLookupMapRef.current.delete(firstKey);
        }
        
        setPosition({ x, y });
        onColorSelect(selectedColor);
      }
    });
  }, [isDragging, size, soilColorRings, onColorSelect]);

  const handleMouseUp = () => {
    setIsDragging(false);
    // Cancel any pending animation frames
    if (mouseMoveRef.current) {
      cancelAnimationFrame(mouseMoveRef.current);
    }
  };

  React.useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      // Cancel any pending animation frames on cleanup
      if (mouseMoveRef.current) {
        cancelAnimationFrame(mouseMoveRef.current);
      }
    };
  }, [isDragging, handleMouseMove]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <canvas
        ref={canvasRef}
        width={size}
        height={size}
        style={{ cursor: 'crosshair', borderRadius: '50%' }}
        onMouseDown={handleMouseDown}
      />
      <div
        style={{
          position: 'absolute',
          left: position.x - 8,
          top: position.y - 8,
          width: '16px',
          height: '16px',
          border: '3px solid white',
          borderRadius: '50%',
          backgroundColor: selectedColor,
          boxShadow: '0 0 0 1px rgba(0,0,0,0.5), 0 2px 4px rgba(0,0,0,0.2)',
          pointerEvents: 'none'
        }}
      />
      
      {/* Organized Legend */}
      <div style={{
        position: 'absolute',
        bottom: '-50px',
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '2px',
        fontSize: '9px',
        color: 'var(--text-secondary)',
        whiteSpace: 'nowrap',
        textAlign: 'center'
      }}>
        <div style={{display: 'flex', gap: '6px'}}>
          <span>Sandy</span>
          <span>•</span>
          <span>Clay & Loam</span>
          <span>•</span>
          <span>Organic & Rock</span>
        </div>
        <div style={{fontSize: '8px', opacity: 0.8}}>
          (Organized clockwise by soil type)
        </div>
      </div>
    </div>
  );
});

// Helper function to lighten colors
function lightenColor(color, amount) {
  const hex = color.replace('#', '');
  const r = Math.min(255, parseInt(hex.substr(0, 2), 16) + Math.round(255 * amount));
  const g = Math.min(255, parseInt(hex.substr(2, 2), 16) + Math.round(255 * amount));
  const b = Math.min(255, parseInt(hex.substr(4, 2), 16) + Math.round(255 * amount));
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}


// Color Picker Component - Memoized for performance
const ColorPicker = React.memo(({ onClose, onColorSelect, currentColor, colorPickerType = 'material' }) => {
  const [selectedColor, setSelectedColor] = useState(currentColor || '#8B4513');
  
  const handleWheelColorSelect = (color) => {
    setSelectedColor(color);
  };


  return (
    <div 
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000
      }}
      onClick={onClose}
    >
      <div 
        style={{
          background: 'var(--bg-panel)',
          border: '1px solid var(--border-color)',
          borderRadius: '12px',
          padding: '20px',
          minWidth: '280px',
          maxWidth: '320px'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px'
        }}>
          <h3 style={{color: 'var(--text-primary)', margin: 0, fontSize: '18px', fontWeight: '600'}}>
            {colorPickerType === 'borehole' ? '🎯 Choose Borehole Color' : '🌱 Choose Soil Color'}
          </h3>
          <StandardButton
            variant="icon"
            onClick={onClose}
            icon="×"
            className="modal-close-new"
          />
        </div>
        
        {/* Color Wheel - Different types based on context */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
          {colorPickerType === 'borehole' ? (
            <HSLColorWheel 
              size={180} 
              onColorSelect={handleWheelColorSelect}
              selectedColor={selectedColor}
            />
          ) : (
            <SoilColorWheel 
              size={180} 
              onColorSelect={handleWheelColorSelect}
              selectedColor={selectedColor}
            />
          )}
        </div>
        
        {/* Hex Color Input */}
        <StandardFormGroup>
          <div className="color-preview-container">
            <div
              className="color-preview-swatch"
              style={{
                backgroundColor: selectedColor,
                width: '48px',
                height: '48px'
              }}
            />
            <StandardInput
              type="text"
              value={selectedColor}
              onChange={(e) => {
                const value = e.target.value;
                if (/^#[0-9A-Fa-f]{0,6}$/.test(value) || value === '') {
                  setSelectedColor(value);
                }
              }}
              className="color-hex-input"
              placeholder="#8B4513"
              maxLength={7}
            />
          </div>
        </StandardFormGroup>
        
        {/* Actions */}
        <div className="modal-actions">
          <StandardButton 
            variant="secondary"
            onClick={onClose}
          >
            Cancel
          </StandardButton>
          <StandardButton 
            variant="primary"
            onClick={() => onColorSelect(selectedColor)}
          >
            Apply Color
          </StandardButton>
        </div>
      </div>
    </div>
  );
});

const BoreholeCreationModal = ({ isOpen, onClose, onConfirm, defaultName, pendingCoordinates }) => {
  const [boreholeName, setBoreholeName] = useState('');
  const [totalDepth, setTotalDepth] = useState(32.8);
  const [boreholeType, setBoreholeType] = useState('BUILDING');
  const [layers, setLayers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [formErrors, setFormErrors] = useState({});
  const [isLayersOpen, setIsLayersOpen] = useState(true);
  const [isAdvancedMode, setIsAdvancedMode] = useState(false);
  const [customLayerColors, setCustomLayerColors] = useState({}); // Per-layer colors
  const [customBoreholeColor, setCustomBoreholeColor] = useState(null);
  const [showColorPicker, setShowColorPicker] = useState({ type: null, id: null });
  
  // Performance optimization - use transitions for Advanced Mode toggle
  const [isPending, startTransition] = useTransition();
  
  // Water table state
  const [hasWaterTable, setHasWaterTable] = useState(false);
  const [waterTableDepth, setWaterTableDepth] = useState(16.4);

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Performance-optimized Advanced Mode toggle handler
  const handleAdvancedModeToggle = useCallback(() => {
    startTransition(() => {
      setIsAdvancedMode(prev => !prev);
    });
  }, []);


  // Derived State & Memos
  const definedDepth = useMemo(() => layers.reduce((sum, layer) => sum + (layer.to - layer.from), 0), [layers]);
  const layersSummary = `${layers.length} layers, ${definedDepth.toFixed(1)}ft of ${totalDepth.toFixed(1)}ft defined`;

  // Initialize default layer
  useEffect(() => {
    if (layers.length === 0) {
      setLayers([{ id: `default-${Date.now()}`, from: 0, to: totalDepth, material: 'CLAY' }]);
    }
  }, [totalDepth, layers.length]);
  

  // Update name when defaultName changes
  useEffect(() => {
    setBoreholeName(defaultName || '');
  }, [defaultName]);

  // Helper functions
  const getMaterialColor = useCallback((material, layerId = null) => {
    // Check if there's a custom color for this specific layer
    if (layerId && customLayerColors[layerId]) {
      return customLayerColors[layerId];
    }
    // Otherwise use USCS material color
    const materialProps = getMaterialProperties(material);
    return materialProps.color || '#CCCCCC';
  }, [customLayerColors]);

  const getBoreholeColor = useCallback(() => {
    if (boreholeType === 'OTHER' && customBoreholeColor) {
      return customBoreholeColor;
    }
    return BOREHOLE_TYPES[boreholeType]?.color || BOREHOLE_TYPES.OTHER.color;
  }, [boreholeType, customBoreholeColor]);

  const handleColorPickerOpen = useCallback((type, id) => {
    setShowColorPicker({ type, id });
  }, []);

  const handleColorChange = useCallback((color) => {
    const { type, id } = showColorPicker;
    
    if (type === 'material') {
      // id is now the layer ID, not the material type
      setCustomLayerColors(prev => ({
        ...prev,
        [id]: color
      }));
    } else if (type === 'borehole') {
      setCustomBoreholeColor(color);
    }
    
    // Close color picker
    setShowColorPicker({ type: null, id: null });
  }, [showColorPicker]);

  const getLayerStatus = useCallback((index) => {
    const layer = layers[index];
    const prevLayer = layers[index - 1];
    const messages = [];
    let type = 'valid';

    if (layer.from < 0 || layer.to < 0) messages.push("Depths cannot be negative.");
    if (layer.to <= layer.from) messages.push("'To' depth must be greater than 'From' depth.");
    if (layer.to > totalDepth) messages.push(`Layer extends beyond total borehole depth of ${totalDepth}m.`);
    if (prevLayer && layer.from < prevLayer.to) messages.push("Layer overlaps with the one above.");
    
    if (messages.length > 0) type = 'error';
    return { type, messages };
  }, [layers, totalDepth]);

  // Event handlers
  const handleLayerChange = useCallback((index, field, value) => {
    let newLayers = [...layers];
    const layer = { ...newLayers[index] };
    const numValue = parseFloat(value);

    if (field === 'material') {
      layer.material = value;
      newLayers[index] = layer;
    } else if ((field === 'from' || field === 'to') && !isNaN(numValue)) {
      layer[field] = numValue;
      newLayers[index] = layer;
      
      // Auto-adjust subsequent layers to maintain continuity
      if (field === 'to' && index < newLayers.length - 1) {
        // Update all subsequent layers to maintain continuity
        let currentDepth = numValue;
        for (let i = index + 1; i < newLayers.length; i++) {
          const thickness = newLayers[i].to - newLayers[i].from;
          newLayers[i] = {
            ...newLayers[i],
            from: currentDepth,
            to: currentDepth + thickness
          };
          currentDepth += thickness;
        }
      } else if (field === 'from' && index > 0) {
        // If changing 'from' of a non-first layer, update previous layer's 'to'
        newLayers[index - 1] = {
          ...newLayers[index - 1],
          to: numValue
        };
      }
    }

    setLayers(newLayers);
  }, [layers]);

  const addLayer = useCallback(() => {
    setLayers(currentLayers => {
      if (currentLayers.length === 0) {
        return [{ id: `layer-${Date.now()}`, from: 0, to: totalDepth, material: 'CLAY' }];
      }

      const lastLayer = currentLayers[currentLayers.length - 1];
      
      if (lastLayer.to <= lastLayer.from) {
        return currentLayers;
      }

      const splitPoint = lastLayer.from + (lastLayer.to - lastLayer.from) / 2;

      const newLayer = {
        id: `layer-${Date.now()}`,
        from: splitPoint,
        to: lastLayer.to,
        material: 'SAND',
      };

      const updatedLastLayer = { ...lastLayer, to: splitPoint };

      return [...currentLayers.slice(0, -1), updatedLastLayer, newLayer];
    });
  }, [totalDepth]);

  const removeLayer = useCallback((indexToRemove) => {
    setLayers(currentLayers => {
      if (currentLayers.length <= 1) {
        return currentLayers;
      }

      // Remove the layer
      const removedLayer = currentLayers[indexToRemove];
      const removedThickness = removedLayer.to - removedLayer.from;
      let newLayers = currentLayers.filter((_, index) => index !== indexToRemove);

      // Adjust depths to maintain continuity
      if (indexToRemove === 0) {
        // If removing first layer, ensure next layer starts at 0
        if (newLayers.length > 0) {
          const thickness = newLayers[0].to - newLayers[0].from;
          newLayers[0] = { ...newLayers[0], from: 0, to: thickness };
        }
      } else if (indexToRemove < currentLayers.length - 1) {
        // If removing a middle layer, close the gap by shifting subsequent layers up
        for (let i = indexToRemove - 1; i < newLayers.length; i++) {
          if (i === indexToRemove - 1) {
            // Don't change the previous layer's 'from' and 'to'
            continue;
          }
          newLayers[i] = {
            ...newLayers[i],
            from: newLayers[i].from - removedThickness,
            to: newLayers[i].to - removedThickness
          };
        }
      }
      // If removing last layer, no adjustment needed
      
      return newLayers;
    });
  }, []);

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (active.id !== over?.id) {
      setLayers((items) => {
        const oldIndex = items.findIndex(item => item.id === active.id);
        const newIndex = items.findIndex(item => item.id === over.id);
        
        // First, reorder the layers
        const reorderedLayers = arrayMove(items, oldIndex, newIndex);
        
        // Then, recalculate depths to maintain continuity
        let currentDepth = 0;
        const adjustedLayers = reorderedLayers.map((layer, index) => {
          // Calculate thickness (preserve original thickness)
          const thickness = layer.to - layer.from;
          
          // Update from/to based on new position
          const updatedLayer = {
            ...layer,
            from: currentDepth,
            to: currentDepth + thickness
          };
          
          currentDepth += thickness;
          return updatedLayer;
        });
        
        return adjustedLayers;
      });
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    setFormErrors({});
    
    const selectedType = BOREHOLE_TYPES[boreholeType];
    // Use custom borehole color if available, otherwise use type default
    const finalColor = customBoreholeColor || (selectedType ? selectedType.color : BOREHOLE_TYPES.OTHER.color);
    
    const boreholeData = {
      name: boreholeName.trim() || defaultName,
      depth: totalDepth,
      totalDepth: totalDepth,
      type: boreholeType,
      color: finalColor,
      layers: layers.length > 0 ? layers.map(layer => ({
        ...layer,
        customColor: customLayerColors[layer.id] // Add custom color to each layer
      })) : [],
      // Add water table data
      waterTableEncountered: hasWaterTable,
      waterTableDepth: hasWaterTable ? waterTableDepth : null,
      ...(pendingCoordinates && {
        x: pendingCoordinates.x,
        y: pendingCoordinates.y,
        z: pendingCoordinates.z
      })
    };
    
    const validationResult = validateBoreholeData(boreholeData);
    
    if (!validationResult.isValid) {
      setFormErrors({ general: validationResult.errors });
      return;
    }
    
    setLoading(true);
    
    if (isAdvancedMode) {
      // Advanced mode: Use detailed layer data from the modal
      const formData = {
        name: boreholeName.trim() || defaultName,
        depth: totalDepth,
        totalDepth: totalDepth,
        type: boreholeType,
        color: finalColor,
        layers: layers.length > 0 ? layers.map(layer => ({
          ...layer,
          customColor: customLayerColors[layer.id] // Add custom color to each layer
        })) : [],
        customLayerColors: customLayerColors, // Pass custom colors
        // Add water table data
        waterTableEncountered: hasWaterTable,
        waterTableDepth: hasWaterTable ? waterTableDepth : null
      };
      
      setTimeout(() => {
        onConfirm(formData);
        resetForm();
        setLoading(false);
      }, 1000);
    } else {
      // Default mode: Use the existing addSimpleBorehole system with global soil layers
      const simpleData = {
        name: boreholeName.trim() || defaultName,
        depth: totalDepth,
        type: boreholeType,
        color: finalColor,
        useGlobalLayers: true,  // Flag to indicate using global soil layers system
        // Add water table data
        waterTableEncountered: hasWaterTable,
        waterTableDepth: hasWaterTable ? waterTableDepth : null
      };
      
      setTimeout(() => {
        onConfirm(simpleData);
        resetForm();
        setLoading(false);
      }, 1000);
    }
  };

  const resetForm = () => {
    setBoreholeName('');
    setTotalDepth(10.0);
    setBoreholeType('BUILDING');
    setLayers([]);
    setIsLayersOpen(true);
    setIsAdvancedMode(false);
    setCustomLayerColors({});
    setCustomBoreholeColor(null);
    setShowColorPicker({ type: null, id: null });
    setFormErrors({});
    // Reset water table state
    setHasWaterTable(false);
    setWaterTableDepth(5.0);
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-container-new">
        {/* Header */}
        <div className="modal-header-new">
          <h1 className="modal-title-new"> Create Borehole</h1>
          <StandardButton
            variant="icon"
            onClick={onClose}
            className="modal-close-new"
            icon="×"
          />
        </div>

        <form onSubmit={handleSubmit} className="modal-form-new">
          {/* Basic Info Section */}
          <StandardFormGroup>
            <h3 className="form-section-title">Basic Information</h3>
            
            <StandardInput
              id="boreholeName"
              label="Borehole Name/ID"
              value={boreholeName}
              onChange={(e) => setBoreholeName(e.target.value)}
              placeholder={defaultName}
            />
            
            <StandardInput
              id="totalDepth"
              label="Total Depth (ft)"
              type="number"
              value={totalDepth}
              onChange={(e) => setTotalDepth(parseFloat(e.target.value) || 0)}
              step="0.1"
              min="0.1"
            />
            
            {/* Water Table Section */}
            <StandardFormGroup>
              <div className="water-table-header">
                <label className="form-label-new">
                  💧 Water Table
                </label>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={hasWaterTable}
                    onChange={(e) => setHasWaterTable(e.target.checked)}
                    className="checkbox-input"
                  />
                  Water Table Encountered
                </label>
              </div>
              
              {hasWaterTable && (
                <div className="water-table-input-section">
                  <StandardInput
                    id="waterTableDepth"
                    label="Water Table Depth (ft)"
                    type="number"
                    value={waterTableDepth}
                    onChange={(e) => setWaterTableDepth(parseFloat(e.target.value) || 0)}
                    step="0.1"
                    min="0"
                    max={totalDepth}
                    helpText={`Water table at ${waterTableDepth.toFixed(1)}ft depth • ${(totalDepth - waterTableDepth).toFixed(1)}ft from bottom`}
                  />
                </div>
              )}
            </StandardFormGroup>
            
            <StandardFormGroup>
              <label className="form-label-new">
                Borehole Type
              </label>
              <div className="borehole-type-container">
                <div 
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (boreholeType === 'OTHER') {
                      handleColorPickerOpen('borehole', 'type');
                    }
                  }}
                  className="borehole-color-indicator"
                  style={{
                    backgroundColor: getBoreholeColor(),
                    cursor: boreholeType === 'OTHER' ? 'pointer' : 'default'
                  }}
                  title={boreholeType === 'OTHER' ? 'Click to choose custom color' : ''}
                >
                  {boreholeType === 'OTHER' && (
                    <div className="color-picker-badge" />
                  )}
                </div>
                <StandardSelect 
                  id="boreholeType" 
                  value={boreholeType} 
                  onChange={(e) => setBoreholeType(e.target.value)} 
                  className="borehole-type-select"
                >
                  {Object.entries(BOREHOLE_TYPES).map(([key, {name}]) => (
                    <option key={key} value={key}>{name}</option>
                  ))}
                </StandardSelect>
              </div>
            </StandardFormGroup>
          </StandardFormGroup>

          {/* Advanced Mode Toggle */}
          <div className="advanced-mode-toggle">
            <div className="advanced-mode-container">
              <div className="advanced-mode-info">
                <h4 className="advanced-mode-title">
                  Geological Layer Configuration
                </h4>
                <p className="advanced-mode-description">
                  {isAdvancedMode ? 'Custom layer configuration enabled' : 'Using global soil layers (recommended)'}
                </p>
              </div>
              <StandardButton
                variant={isAdvancedMode ? 'primary' : 'secondary'}
                size="small"
                onClick={handleAdvancedModeToggle}
                disabled={isPending}
                className={isPending ? 'transitioning' : ''}
              >
                {isPending ? 'Loading...' : (isAdvancedMode ? 'Switch to Basic' : 'Advanced Mode')}
              </StandardButton>
            </div>
          </div>

          {/* Soil Layers Section - Only show in advanced mode */}
          {isAdvancedMode && (
            <AccordionSection
              title="Soil Layers (Advanced)"
              icon={<Icon path="M3 4.5A1.5 1.5 0 014.5 3h11A1.5 1.5 0 0117 4.5V15a1.5 1.5 0 01-1.5 1.5h-11A1.5 1.5 0 013 15V4.5zM6.25 6a.75.75 0 000 1.5h7.5a.75.75 0 000-1.5h-7.5zM6.25 9a.75.75 0 000 1.5h7.5a.75.75 0 000-1.5h-7.5zM6.25 12a.75.75 0 000 1.5h3.5a.75.75 0 000-1.5h-3.5z" />}
              summary={layersSummary}
              isOpen={isLayersOpen}
              setIsOpen={setIsLayersOpen}
            >
            <div style={{display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px'}}>
              <div>
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext items={layers.map(l => l.id)} strategy={verticalListSortingStrategy}>
                    {layers.map((layer, index) => (
                      <SortableLayerItem
                        key={layer.id}
                        id={layer.id}
                        layer={layer}
                        index={index}
                        onLayerChange={handleLayerChange}
                        removeLayer={removeLayer}
                        totalDepth={totalDepth}
                        isAutoFrom={index > 0}
                        getMaterialColor={getMaterialColor}
                        getLayerStatus={getLayerStatus}
                        layerCount={layers.length}
                        onColorPickerOpen={handleColorPickerOpen}
                      />
                    ))}
                  </SortableContext>
                </DndContext>
                
                <StandardButton
                  variant="secondary"
                  fullWidth
                  onClick={addLayer}
                  className="add-layer-btn"
                  icon={<Icon path="M12 4.5v11m-5.5-5.5h11" />}
                >
                  Add New Layer
                </StandardButton>
              </div>
              
              <div>
                <LayerProfile layers={layers} totalDepth={totalDepth} getMaterialColor={getMaterialColor} />
              </div>
            </div>
          </AccordionSection>
          )}

          {/* Error Display */}
          {formErrors.general && (
            <div className="error-message">
              {formErrors.general.map((error, index) => (
                <p key={index}>{error}</p>
              ))}
            </div>
          )}

          {/* Footer Actions */}
          <div className="modal-actions">
            <StandardButton 
              variant="secondary"
              onClick={onClose}
            >
              Cancel
            </StandardButton>
            <StandardButton 
              type="submit"
              variant="primary"
              loading={loading}
              disabled={loading}
            >
              {loading ? 'Creating...' : '+ Create Borehole'}
            </StandardButton>
          </div>
        </form>
        
        
        {/* Color Picker Modal */}
        {showColorPicker.type && (
          <ColorPicker
            onColorSelect={handleColorChange}
            onClose={() => setShowColorPicker({ type: null, id: null })}
            colorPickerType={showColorPicker.type}
            currentColor={customBoreholeColor || (showColorPicker.type === 'borehole' ? BOREHOLE_TYPES[boreholeType]?.color : null)}
          />
        )}
      </div>
    </div>
  );
};

export default BoreholeCreationModal;