import { CanvasTexture, NearestFilter, RepeatWrapping } from 'three';
import { getMaterialProperties } from '../utils/materialStandardization';
import { validationLogger } from '../utils/Logger.js';

/**
 * Centralized texture management system for geological materials
 * Provides high-performance texture generation, caching, and pattern rendering
 */
export class TextureManager {
  constructor() {
    // Global texture cache with automatic cleanup
    this.textureCache = new Map();
    this.patternRenderers = new Map();
    this.canvasPool = [];
    this.maxCacheSize = 50;
    this.cacheStats = { hits: 0, misses: 0, size: 0 };
    
    // Pre-compile pattern renderers for better performance
    this.initializePatternRenderers();
  }

  /**
   * Initialize pattern rendering functions for maximum performance
   * @private
   */
  initializePatternRenderers() {
    this.patternRenderers.set('clay', this.renderClayPattern.bind(this));
    this.patternRenderers.set('sand', this.renderSandPattern.bind(this));
    this.patternRenderers.set('gravel', this.renderGravelPattern.bind(this));
    this.patternRenderers.set('rock', this.renderRockPattern.bind(this));
    this.patternRenderers.set('silt', this.renderSiltPattern.bind(this));
    this.patternRenderers.set('organic', this.renderOrganicPattern.bind(this));
    this.patternRenderers.set('fill', this.renderFillPattern.bind(this));
    
    // USCS pattern mappings
    this.patternRenderers.set('horizontal_dashed', this.renderClayPattern.bind(this));
    this.patternRenderers.set('sand_dots', this.renderSandPattern.bind(this));
    this.patternRenderers.set('gravel_circles', this.renderGravelPattern.bind(this));
    this.patternRenderers.set('rock_pattern', this.renderRockPattern.bind(this));
    this.patternRenderers.set('horizontal_lines', this.renderSiltPattern.bind(this));
    this.patternRenderers.set('diagonal_lines', this.renderSiltPattern.bind(this));
    this.patternRenderers.set('organic_irregular', this.renderOrganicPattern.bind(this));
    this.patternRenderers.set('fill_pattern', this.renderFillPattern.bind(this));
  }

  /**
   * Create optimized soil texture with intelligent caching
   * @param {string} materialType - Material type (CLAY, SAND, etc.)
   * @param {string} baseColor - Base color hex string
   * @param {Object} textureSettings - Global texture settings
   * @returns {Texture} Optimized texture with caching
   */
  createSoilTexture(materialType, baseColor, textureSettings = {}) {
    // Normalize inputs for consistent caching
    const normalizedType = this.normalizeMaterialType(materialType);
    const normalizedColor = this.normalizeColor(baseColor);
    const settingsHash = this.hashSettings(textureSettings);
    
    // Generate cache key
    const cacheKey = `${normalizedType}_${normalizedColor}_${settingsHash}`;
    
    // Check cache first
    if (this.textureCache.has(cacheKey)) {
      this.cacheStats.hits++;
      return this.textureCache.get(cacheKey);
    }
    
    this.cacheStats.misses++;
    
    // Create new texture
    const texture = this.generateTexture(normalizedType, normalizedColor, textureSettings);
    
    // Cache management - prevent memory bloat
    if (this.textureCache.size >= this.maxCacheSize) {
      this.evictLeastRecentlyUsed();
    }
    
    // Store in cache
    this.textureCache.set(cacheKey, texture);
    this.cacheStats.size = this.textureCache.size;
    
    return texture;
  }

  /**
   * Generate texture with optimized canvas operations
   * @private
   */
  generateTexture(materialType, color, settings) {
    const canvas = this.getCanvas();
    const ctx = canvas.getContext('2d');
    
    // Performance optimization: clear canvas efficiently
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Apply base color
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Calculate optimized pattern parameters
    const patternParams = this.calculatePatternParameters(settings);
    
    // Render pattern using specialized renderer
    const patternType = this.getPatternType(materialType);
    const renderer = this.patternRenderers.get(patternType) || this.patternRenderers.get('clay');
    
    try {
      renderer(ctx, patternParams, color);
    } catch (error) {
      validationLogger.warn(`Pattern rendering failed for ${materialType}:`, error);
      // Fallback to basic clay pattern
      this.renderClayPattern(ctx, patternParams, color);
    }
    
    // Create optimized texture
    const texture = new CanvasTexture(canvas);
    texture.wrapS = RepeatWrapping;
    texture.wrapT = RepeatWrapping;
    texture.repeat.set(1, 1); // Scale handled in pattern generation
    texture.magFilter = NearestFilter;
    texture.minFilter = NearestFilter;
    texture.needsUpdate = true;
    
    // Store creation metadata for debugging
    texture.userData = {
      materialType,
      color,
      settings: { ...settings },
      createdAt: Date.now()
    };
    
    return texture;
  }

  /**
   * Calculate optimized pattern parameters with consistent scaling
   * @private
   */
  calculatePatternParameters(settings) {
    const intensity = Math.max(0.1, Math.min(1.0, settings.globalIntensity || 0.7));
    const scale = Math.max(0.5, Math.min(2.5, settings.patternScale || 1.0));
    
    return {
      intensity,
      scale,
      patternColor: `rgba(255, 255, 255, ${Math.min(1.0, intensity * 1.2)})`,
      strokeColor: `rgba(0, 0, 0, ${Math.min(1.0, intensity * 0.8)})`,
      lineWidth: Math.max(1, Math.round(3 * intensity * scale)),
      spacing: Math.max(6, Math.round(16 * scale)),
      elementSize: Math.max(2, Math.round(6 * intensity * scale))
    };
  }

  /**
   * Optimized clay pattern renderer with consistent scaling
   * @private
   */
  renderClayPattern(ctx, params, baseColor) {
    const { patternColor, strokeColor, lineWidth, spacing } = params;
    
    // Primary horizontal lines
    ctx.strokeStyle = patternColor;
    ctx.lineWidth = lineWidth;
    
    for (let y = spacing * 0.75; y < 128; y += spacing) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(128, y);
      ctx.stroke();
    }
    
    // Add definition with outlines
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = Math.max(1, lineWidth * 0.5);
    
    for (let y = spacing * 0.75; y < 128; y += spacing) {
      const offset = Math.max(1, lineWidth * 0.3);
      ctx.beginPath();
      ctx.moveTo(0, y - offset);
      ctx.lineTo(128, y - offset);
      ctx.moveTo(0, y + offset);
      ctx.lineTo(128, y + offset);
      ctx.stroke();
    }
  }

  /**
   * Optimized sand pattern renderer with consistent scaling
   * @private
   */
  renderSandPattern(ctx, params, baseColor) {
    const { patternColor, strokeColor, elementSize, spacing } = params;
    
    // Primary dot grid
    ctx.fillStyle = patternColor;
    
    for (let x = spacing; x < 128; x += spacing) {
      for (let y = spacing; y < 128; y += spacing) {
        ctx.beginPath();
        ctx.arc(x, y, elementSize, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    
    // Add outlines for definition
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = Math.max(1, elementSize * 0.3);
    
    for (let x = spacing; x < 128; x += spacing) {
      for (let y = spacing; y < 128; y += spacing) {
        ctx.beginPath();
        ctx.arc(x, y, elementSize, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }

  /**
   * Optimized gravel pattern renderer with consistent scaling
   * @private
   */
  renderGravelPattern(ctx, params, baseColor) {
    const { patternColor, strokeColor, elementSize, spacing } = params;
    
    // Random but deterministic gravel particles
    const particles = this.generateDeterministicParticles(8, spacing);
    
    // Fill particles
    ctx.fillStyle = patternColor;
    particles.forEach(particle => {
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size * elementSize * 0.8, 0, Math.PI * 2);
      ctx.fill();
    });
    
    // Outline particles
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = Math.max(1, elementSize * 0.25);
    particles.forEach(particle => {
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size * elementSize * 0.8, 0, Math.PI * 2);
      ctx.stroke();
    });
  }

  /**
   * Optimized rock pattern renderer with consistent scaling
   * @private
   */
  renderRockPattern(ctx, params, baseColor) {
    const { patternColor, strokeColor, lineWidth, spacing } = params;
    
    // Large irregular rock formations
    const formations = this.generateDeterministicFormations(6, spacing);
    
    ctx.strokeStyle = patternColor;
    ctx.lineWidth = lineWidth;
    
    formations.forEach(formation => {
      ctx.beginPath();
      ctx.arc(formation.x, formation.y, formation.size, 0, Math.PI * 2);
      ctx.stroke();
    });
    
    // Add definition
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = Math.max(1, lineWidth * 0.4);
    
    formations.forEach(formation => {
      ctx.beginPath();
      ctx.arc(formation.x, formation.y, formation.size * 1.1, 0, Math.PI * 2);
      ctx.stroke();
    });
  }

  /**
   * Optimized silt pattern renderer with consistent scaling
   * @private
   */
  renderSiltPattern(ctx, params, baseColor) {
    const { patternColor, strokeColor, lineWidth, spacing } = params;
    
    // Diagonal lines pattern
    ctx.strokeStyle = patternColor;
    ctx.lineWidth = lineWidth;
    
    for (let i = -64; i < 192; i += spacing) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + 128, 128);
      ctx.stroke();
    }
    
    // Add definition with offset lines
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = Math.max(1, lineWidth * 0.4);
    
    for (let i = -64; i < 192; i += spacing) {
      const offset = lineWidth * 0.5;
      ctx.beginPath();
      ctx.moveTo(i - offset, 0);
      ctx.lineTo(i + 128 - offset, 128);
      ctx.moveTo(i + offset, 0);
      ctx.lineTo(i + 128 + offset, 128);
      ctx.stroke();
    }
  }

  /**
   * Optimized organic pattern renderer with consistent scaling
   * @private
   */
  renderOrganicPattern(ctx, params, baseColor) {
    const { patternColor, strokeColor, elementSize, spacing } = params;
    
    // Irregular organic shapes
    const organics = this.generateDeterministicOrganics(12, spacing);
    
    ctx.fillStyle = patternColor;
    organics.forEach(organic => {
      ctx.beginPath();
      ctx.ellipse(
        organic.x, organic.y,
        organic.width * elementSize * 0.8,
        organic.height * elementSize * 0.6,
        organic.rotation, 0, 2 * Math.PI
      );
      ctx.fill();
    });
    
    // Add some horizontal layering
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = Math.max(1, elementSize * 0.3);
    
    for (let y = spacing * 2; y < 128; y += spacing * 2.5) {
      ctx.beginPath();
      ctx.moveTo(0, y + Math.sin(y * 0.1) * 3);
      ctx.lineTo(128, y + Math.sin((y + 128) * 0.1) * 3);
      ctx.stroke();
    }
  }

  /**
   * Optimized fill pattern renderer with consistent scaling
   * @private
   */
  renderFillPattern(ctx, params, baseColor) {
    const { patternColor, strokeColor, lineWidth, spacing, elementSize } = params;
    
    // Random angular fragments
    const fragments = this.generateDeterministicFragments(15, spacing);
    
    ctx.strokeStyle = patternColor;
    ctx.lineWidth = lineWidth;
    
    fragments.forEach(fragment => {
      ctx.beginPath();
      const sides = fragment.sides;
      const radius = fragment.size * elementSize;
      
      for (let i = 0; i <= sides; i++) {
        const angle = (i * 2 * Math.PI) / sides;
        const x = fragment.x + radius * Math.cos(angle);
        const y = fragment.y + radius * Math.sin(angle);
        
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
    });
    
    // Add systematic pattern lines
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = Math.max(1, lineWidth * 0.4);
    ctx.setLineDash([spacing * 0.6, spacing * 0.3]);
    
    for (let y = spacing * 1.5; y < 128; y += spacing * 1.8) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(128, y);
      ctx.stroke();
    }
    
    ctx.setLineDash([]);
  }

  /**
   * Generate deterministic pseudo-random particles for consistent patterns
   * @private
   */
  generateDeterministicParticles(count, spacing) {
    const particles = [];
    const seed = 12345; // Fixed seed for consistency
    
    for (let i = 0; i < count; i++) {
      const x = 20 + ((seed + i * 1234) % 88);
      const y = 20 + ((seed + i * 5678) % 88);
      const size = 0.8 + ((seed + i * 9012) % 100) / 500; // 0.8 to 1.0
      
      particles.push({ x, y, size });
    }
    
    return particles;
  }

  /**
   * Generate deterministic rock formations
   * @private
   */
  generateDeterministicFormations(count, spacing) {
    const formations = [];
    const seed = 54321;
    
    for (let i = 0; i < count; i++) {
      const x = 25 + ((seed + i * 2345) % 78);
      const y = 25 + ((seed + i * 6789) % 78);
      const size = spacing * 0.4 + ((seed + i * 3456) % (spacing * 0.6));
      
      formations.push({ x, y, size });
    }
    
    return formations;
  }

  /**
   * Generate deterministic organic shapes
   * @private
   */
  generateDeterministicOrganics(count, spacing) {
    const organics = [];
    const seed = 98765;
    
    for (let i = 0; i < count; i++) {
      const x = 15 + ((seed + i * 1357) % 98);
      const y = 15 + ((seed + i * 2468) % 98);
      const width = 0.8 + ((seed + i * 3579) % 100) / 250;
      const height = 0.6 + ((seed + i * 4680) % 100) / 300;
      const rotation = ((seed + i * 5791) % 360) * Math.PI / 180;
      
      organics.push({ x, y, width, height, rotation });
    }
    
    return organics;
  }

  /**
   * Generate deterministic angular fragments for fill
   * @private
   */
  generateDeterministicFragments(count, spacing) {
    const fragments = [];
    const seed = 13579;
    
    for (let i = 0; i < count; i++) {
      const x = 15 + ((seed + i * 2468) % 98);
      const y = 15 + ((seed + i * 3579) % 98);
      const size = 0.6 + ((seed + i * 4680) % 100) / 250;
      const sides = 3 + ((seed + i * 5791) % 4); // 3-6 sides
      
      fragments.push({ x, y, size, sides });
    }
    
    return fragments;
  }

  /**
   * Get optimized canvas from pool
   * @private
   */
  getCanvas() {
    if (this.canvasPool.length > 0) {
      return this.canvasPool.pop();
    }
    
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    return canvas;
  }

  /**
   * Return canvas to pool for reuse
   * @private
   */
  returnCanvas(canvas) {
    if (this.canvasPool.length < 5) { // Limit pool size
      this.canvasPool.push(canvas);
    }
  }

  /**
   * Normalize material type for consistent processing
   * @private
   */
  normalizeMaterialType(materialType) {
    if (!materialType) return 'clay';
    return materialType.toString().toLowerCase().trim();
  }

  /**
   * Normalize color for consistent caching
   * @private
   */
  normalizeColor(color) {
    if (!color) return '#888888';
    
    // Ensure we have a string to work with
    let colorStr = color;
    
    // Handle Color objects
    if (color && typeof color === 'object' && typeof color.getHexString === 'function') {
      colorStr = `#${color.getHexString()}`;
    }
    
    // Handle other object types by converting to string
    if (typeof colorStr !== 'string') {
      colorStr = String(colorStr);
    }
    
    // Convert to consistent hex format
    if (colorStr.startsWith('#')) {
      return colorStr.toLowerCase();
    }
    
    // Convert rgb/rgba to hex
    const match = colorStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (match) {
      const r = parseInt(match[1]).toString(16).padStart(2, '0');
      const g = parseInt(match[2]).toString(16).padStart(2, '0');
      const b = parseInt(match[3]).toString(16).padStart(2, '0');
      return `#${r}${g}${b}`;
    }
    
    // Handle named colors or other formats - fallback to gray
    if (colorStr === 'default' || colorStr.length === 0) {
      return '#888888';
    }
    
    return colorStr.toLowerCase();
  }

  /**
   * Hash settings for cache key generation
   * @private
   */
  hashSettings(settings) {
    const key = JSON.stringify({
      intensity: Math.round((settings.globalIntensity || 0.7) * 100),
      scale: Math.round((settings.patternScale || 1.0) * 100),
      enabled: settings.enabled !== false
    });
    
    // Simple hash function
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      hash = ((hash << 5) - hash + key.charCodeAt(i)) & 0xffffffff;
    }
    return hash.toString(36);
  }

  /**
   * Get pattern type from material type with USCS mapping
   * @private
   */
  getPatternType(materialType) {
    // Try to get USCS pattern first
    try {
      const materialProps = getMaterialProperties(materialType);
      if (materialProps && materialProps.pattern) {
        const patternMap = {
          'gravel_circles': 'gravel',
          'gravel_silt': 'gravel',
          'gravel_clay': 'gravel',
          'sand_dots': 'sand',
          'sand_silt': 'sand',
          'sand_clay': 'sand',
          'horizontal_lines': 'silt',
          'horizontal_dashed': 'clay',
          'diagonal_lines': 'silt',
          'diagonal_crosshatch': 'silt',
          'diagonal_lines_organic': 'organic',
          'rock_pattern': 'rock',
          'organic_irregular': 'organic',
          'topsoil_organic': 'organic',
          'horizontal_lines_organic': 'organic',
          'fill_pattern': 'fill'
        };
        
        return patternMap[materialProps.pattern] || materialType;
      }
    } catch (error) {
      // Fall back to material type
    }
    
    // Direct material type mapping
    const typeMap = {
      'clay': 'clay',
      'sand': 'sand',
      'gravel': 'gravel',
      'rock': 'rock',
      'stone': 'rock',
      'silt': 'silt',
      'organic': 'organic',
      'fill': 'fill',
      'topsoil': 'organic',
      'peat': 'organic',
      'unknown': 'clay' // Add explicit mapping for unknown
    };
    
    return typeMap[materialType] || 'clay';
  }

  /**
   * Evict least recently used texture to manage memory
   * @private
   */
  evictLeastRecentlyUsed() {
    // Simple LRU implementation - remove oldest texture
    const firstKey = this.textureCache.keys().next().value;
    if (firstKey) {
      const texture = this.textureCache.get(firstKey);
      texture.dispose();
      this.textureCache.delete(firstKey);
    }
  }

  /**
   * Get cache statistics for monitoring
   */
  getCacheStats() {
    return { ...this.cacheStats };
  }

  /**
   * Clear all cached textures and reset
   */
  clearCache() {
    this.textureCache.forEach(texture => texture.dispose());
    this.textureCache.clear();
    this.cacheStats = { hits: 0, misses: 0, size: 0 };
  }

  /**
   * Dispose of all resources
   */
  dispose() {
    this.clearCache();
    this.canvasPool = [];
    this.patternRenderers.clear();
  }
}

// Export singleton instance for global use
export const textureManager = new TextureManager();
export default TextureManager;