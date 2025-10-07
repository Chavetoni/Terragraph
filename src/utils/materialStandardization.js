import { validationLogger, geologicalLogger } from './Logger.js';

// Performance optimization: Create lookup maps for faster access
let _materialLookupCache = new Map();
let _aliasLookupCache = new Map();
let _isOptimized = false;

/**
 * Initialize performance optimizations
 * @private
 */
function _initializeOptimizations() {
  if (_isOptimized) return;
  
  // Build lookup caches
  for (const [material, props] of Object.entries(STANDARD_MATERIALS)) {
    _materialLookupCache.set(material.toLowerCase(), material);
    
    // Build alias cache
    if (props.aliases) {
      for (const alias of props.aliases) {
        _aliasLookupCache.set(alias.toLowerCase(), material);
      }
    }
  }
  
  // Build USCS lookup cache
  for (const [code, classification] of Object.entries(USCS_CLASSIFICATIONS)) {
    _materialLookupCache.set(code.toLowerCase(), classification.material);
  }
  
  _isOptimized = true;
}

export const STANDARD_MATERIALS = {
  // COARSE-GRAINED SOILS - GRAVELS (>50% of coarse fraction retained on No. 4 sieve)
  'GW': { 
    color: '#D2691E', 
    density: 2.1, 
    pattern: 'gravel_circles',
    description: 'Well-graded gravel, gravel-sand mixtures, little or no fines',
    category: 'COARSE_GRAINED',
    aliases: ['gw', 'well-graded gravel', 'gravel-sand mixture']
  },
  'GP': { 
    color: '#CD853F', 
    density: 2.0, 
    pattern: 'gravel_circles',
    description: 'Poorly-graded gravel, gravel-sand mixtures, little or no fines',
    category: 'COARSE_GRAINED',
    aliases: ['gp', 'poorly-graded gravel', 'uniform gravel']
  },
  'GM': { 
    color: '#A0522D', 
    density: 2.0, 
    pattern: 'gravel_silt',
    description: 'Silty gravel, gravel-sand-silt mixtures',
    category: 'COARSE_GRAINED',
    aliases: ['gm', 'silty gravel', 'gravel-silt mixture']
  },
  'GC': { 
    color: '#8B4513', 
    density: 2.1, 
    pattern: 'gravel_clay',
    description: 'Clayey gravel, gravel-sand-clay mixtures',
    category: 'COARSE_GRAINED',
    aliases: ['gc', 'clayey gravel', 'gravel-clay mixture']
  },

  // COARSE-GRAINED SOILS - SANDS (50% or more of coarse fraction smaller than No. 4 sieve)
  'SW': { 
    color: '#F4A460', 
    density: 1.7, 
    pattern: 'sand_dots',
    description: 'Well-graded sand, gravelly sand, little or no fines',
    category: 'COARSE_GRAINED',
    aliases: ['sw', 'well-graded sand', 'gravelly sand']
  },
  'SP': { 
    color: '#DEB887', 
    density: 1.6, 
    pattern: 'sand_dots',
    description: 'Poorly-graded sand, gravelly sand, little or no fines',
    category: 'COARSE_GRAINED',
    aliases: ['sp', 'poorly-graded sand', 'uniform sand']
  },
  'SM': { 
    color: '#D2B48C', 
    density: 1.8, 
    pattern: 'sand_silt',
    description: 'Silty sand, sand-silt mixtures',
    category: 'COARSE_GRAINED',
    aliases: ['sm', 'silty sand', 'sand-silt mixture']
  },
  'SC': { 
    color: '#BC8F8F', 
    density: 1.9, 
    pattern: 'sand_clay',
    description: 'Clayey sand, sand-clay mixtures',
    category: 'COARSE_GRAINED',
    aliases: ['sc', 'clayey sand', 'sand-clay mixture']
  },

  // FINE-GRAINED SOILS - SILTS AND CLAYS (Liquid limit less than 50%)
  'ML': { 
    color: '#B8860B', 
    density: 1.6, 
    pattern: 'horizontal_lines',
    description: 'Inorganic silt and very fine sand, rock flour, silty or clayey fine sand or clayey silt with slight plasticity',
    category: 'FINE_GRAINED_LOW',
    aliases: ['ml', 'inorganic silt', 'rock flour', 'very fine sand']
  },
  'CL': { 
    color: '#A0522D', 
    density: 1.9, 
    pattern: 'horizontal_dashed',
    description: 'Inorganic clay of low to medium plasticity, gravelly clay, sandy clay, silty clay, lean clay',
    category: 'FINE_GRAINED_LOW',
    aliases: ['cl', 'lean clay', 'low plasticity clay', 'sandy clay', 'silty clay']
  },
  'OL': { 
    color: '#8B4513', 
    density: 1.4, 
    pattern: 'horizontal_lines_organic',
    description: 'Organic silt and organic silty clay of low plasticity',
    category: 'FINE_GRAINED_LOW',
    aliases: ['ol', 'organic silt', 'organic silty clay']
  },

  // FINE-GRAINED SOILS - SILTS AND CLAYS (Liquid limit 50% or greater)
  'MH': { 
    color: '#696969', 
    density: 1.5, 
    pattern: 'diagonal_lines',
    description: 'Inorganic silt, micaceous or diatomaceous fine sandy or silty soil, elastic silt',
    category: 'FINE_GRAINED_HIGH',
    aliases: ['mh', 'elastic silt', 'micaceous silt', 'diatomaceous silt']
  },
  'CH': { 
    color: '#8B4513', 
    density: 2.0, 
    pattern: 'diagonal_crosshatch',
    description: 'Inorganic clay of high plasticity, fat clay',
    category: 'FINE_GRAINED_HIGH',
    aliases: ['ch', 'fat clay', 'high plasticity clay']
  },
  'OH': { 
    color: '#654321', 
    density: 1.3, 
    pattern: 'diagonal_lines_organic',
    description: 'Organic clay of medium to high plasticity, organic silt',
    category: 'FINE_GRAINED_HIGH',
    aliases: ['oh', 'organic clay', 'high plasticity organic clay']
  },

  // HIGHLY ORGANIC SOILS
  'PT': {
    color: '#2F4F4F',
    density: 1.1,
    pattern: 'organic_irregular',
    description: 'Peat and other highly organic soils',
    category: 'HIGHLY_ORGANIC',
    aliases: ['pt', 'peat', 'highly organic soil', 'muck', 'organic matter']
  },

  // LEGACY MATERIALS (for backward compatibility)
  'CLAY': { 
    color: '#A0522D', 
    density: 1.8, 
    pattern: 'horizontal_dashed',
    description: 'General clay material (maps to CL)',
    category: 'LEGACY',
    aliases: ['clay', 'clayey', 'clay soil'],
    uscsEquivalent: 'CL'
  },
  'SAND': { 
    color: '#F4A460', 
    density: 1.6, 
    pattern: 'sand_dots',
    description: 'General sand material (maps to SW)',
    category: 'LEGACY',
    aliases: ['sand', 'sandy', 'sand soil'],
    uscsEquivalent: 'SW'
  },
  'GRAVEL': { 
    color: '#D2691E', 
    density: 2.0, 
    pattern: 'gravel_circles',
    description: 'General gravel material (maps to GW)',
    category: 'LEGACY',
    aliases: ['gravel', 'gravelly', 'gravel soil'],
    uscsEquivalent: 'GW'
  },
  'SILT': { 
    color: '#B8860B', 
    density: 1.7, 
    pattern: 'horizontal_lines',
    description: 'General silt material (maps to ML)',
    category: 'LEGACY',
    aliases: ['silt', 'silty', 'silt soil'],
    uscsEquivalent: 'ML'
  },
  'ROCK': { 
    color: '#708090', 
    density: 2.5, 
    pattern: 'rock_pattern',
    description: 'Hard bedrock or weathered rock',
    category: 'BEDROCK',
    aliases: ['rock', 'bedrock', 'limestone', 'granite', 'sandstone', 'shale']
  },
  'PEAT': {
    color: '#2F4F4F',
    density: 1.1,
    pattern: 'organic_irregular',
    description: 'Organic soil with high water content (maps to PT)',
    category: 'LEGACY',
    aliases: ['peat', 'organic', 'organic soil', 'muck'],
    uscsEquivalent: 'PT'
  },
  'FILL': {
    color: '#888888',
    density: 1.5,
    pattern: 'fill_pattern',
    description: 'Artificial fill material',
    category: 'ENGINEERED',
    aliases: ['fill', 'artificial fill', 'engineered fill', 'backfill']
  },
  'TOPSOIL': {
    color: '#654321',
    density: 1.4,
    pattern: 'topsoil_organic',
    description: 'Surface soil with organic content',
    category: 'SURFACE',
    aliases: ['topsoil', 'surface soil', 'organic topsoil', 'humus']
  }
};

export const MATERIAL_CATEGORIES = {
  COARSE_GRAINED: ['GW', 'GP', 'GM', 'GC', 'SW', 'SP', 'SM', 'SC'],
  FINE_GRAINED_LOW: ['ML', 'CL', 'OL'],
  FINE_GRAINED_HIGH: ['MH', 'CH', 'OH'],
  HIGHLY_ORGANIC: ['PT'],
  LEGACY: ['CLAY', 'SAND', 'GRAVEL', 'SILT', 'PEAT'],
  BEDROCK: ['ROCK'],
  ENGINEERED: ['FILL'],
  SURFACE: ['TOPSOIL'],
  
  // Traditional groupings for backward compatibility
  COHESIVE: ['CL', 'CH', 'OL', 'OH', 'CLAY'],
  GRANULAR: ['GW', 'GP', 'GM', 'GC', 'SW', 'SP', 'SM', 'SC', 'SAND', 'GRAVEL'],
  ORGANIC: ['PT', 'OL', 'OH', 'PEAT', 'TOPSOIL']
};

export const USCS_CLASSIFICATIONS = {
  // Coarse-grained soils - Gravels
  'GW': { material: 'GW', description: 'Well-graded gravel, gravel-sand mixtures, little or no fines', category: 'GRAVELS' },
  'GP': { material: 'GP', description: 'Poorly-graded gravel, gravel-sand mixtures, little or no fines', category: 'GRAVELS' },
  'GM': { material: 'GM', description: 'Silty gravel, gravel-sand-silt mixtures', category: 'GRAVELS' },
  'GC': { material: 'GC', description: 'Clayey gravel, gravel-sand-clay mixtures', category: 'GRAVELS' },
  
  // Coarse-grained soils - Sands
  'SW': { material: 'SW', description: 'Well-graded sand, gravelly sand, little or no fines', category: 'SANDS' },
  'SP': { material: 'SP', description: 'Poorly-graded sand, gravelly sand, little or no fines', category: 'SANDS' },
  'SM': { material: 'SM', description: 'Silty sand, sand-silt mixtures', category: 'SANDS' },
  'SC': { material: 'SC', description: 'Clayey sand, sand-clay mixtures', category: 'SANDS' },
  
  // Fine-grained soils - Low plasticity
  'ML': { material: 'ML', description: 'Inorganic silt and very fine sand, rock flour', category: 'SILTS_CLAYS_LOW' },
  'CL': { material: 'CL', description: 'Inorganic clay of low to medium plasticity, lean clay', category: 'SILTS_CLAYS_LOW' },
  'OL': { material: 'OL', description: 'Organic silt and organic silty clay of low plasticity', category: 'SILTS_CLAYS_LOW' },
  
  // Fine-grained soils - High plasticity
  'MH': { material: 'MH', description: 'Inorganic silt, micaceous or diatomaceous fine sand or silt, elastic silt', category: 'SILTS_CLAYS_HIGH' },
  'CH': { material: 'CH', description: 'Inorganic clay of high plasticity, fat clay', category: 'SILTS_CLAYS_HIGH' },
  'OH': { material: 'OH', description: 'Organic clay of medium to high plasticity, organic silt', category: 'SILTS_CLAYS_HIGH' },
  
  // Highly organic soils
  'PT': { material: 'PT', description: 'Peat and other highly organic soils', category: 'HIGHLY_ORGANIC' }
};

/**
 * Normalize material name with performance optimizations
 * @param {string} input - Raw material name input
 * @returns {string} Standardized material name
 */
export function normalizeMaterialName(input) {
  // Input validation
  if (!input || typeof input !== 'string') {
    validationLogger.warn('Invalid input for normalizeMaterialName:', input);
    return 'UNKNOWN';
  }
  
  // Initialize optimizations on first use
  _initializeOptimizations();

  const cleanInput = input.trim().toLowerCase();
  
  // Quick exit for empty string
  if (!cleanInput) {
    return 'UNKNOWN';
  }
  
  // Fast lookup in material cache
  const directMatch = _materialLookupCache.get(cleanInput);
  if (directMatch) {
    return directMatch;
  }
  
  // Fast lookup in alias cache
  const aliasMatch = _aliasLookupCache.get(cleanInput);
  if (aliasMatch) {
    return aliasMatch;
  }
  
  // Fallback to substring matching (slower but comprehensive)
  const substringMatches = [
    { pattern: 'clay', material: 'CLAY' },
    { pattern: 'sand', material: 'SAND' },
    { pattern: 'gravel', material: 'GRAVEL' },
    { pattern: 'silt', material: 'SILT' },
    { pattern: 'rock', material: 'ROCK' },
    { pattern: 'stone', material: 'ROCK' },
    { pattern: 'peat', material: 'PEAT' },
    { pattern: 'organic', material: 'PEAT' },
    { pattern: 'fill', material: 'FILL' },
    { pattern: 'topsoil', material: 'TOPSOIL' },
    { pattern: 'soil', material: 'TOPSOIL' }
  ];
  
  for (const { pattern, material } of substringMatches) {
    if (cleanInput.includes(pattern)) {
      // Cache the result for future lookups
      _aliasLookupCache.set(cleanInput, material);
      return material;
    }
  }
  
  validationLogger.warn('Unknown material type:', input);
  return 'UNKNOWN';
}

/**
 * Get material properties with error handling and fallbacks
 * @param {string} material - Material name
 * @returns {Object} Material properties object
 */
export function getMaterialProperties(material) {
  // Input validation
  if (!material || typeof material !== 'string') {
    validationLogger.warn('Invalid material input for getMaterialProperties:', material);
    return getDefaultMaterialProperties();
  }
  
  const normalizedMaterial = material.toUpperCase();
  const standardMaterial = STANDARD_MATERIALS[normalizedMaterial];
  
  if (standardMaterial) {
    // Return a deep copy to prevent mutations
    return {
      color: standardMaterial.color,
      density: standardMaterial.density,
      pattern: standardMaterial.pattern,
      description: standardMaterial.description,
      category: standardMaterial.category,
      aliases: [...(standardMaterial.aliases || [])],
      uscsEquivalent: standardMaterial.uscsEquivalent
    };
  }
  
  validationLogger.warn('Unknown material type, using defaults:', material);
  return getDefaultMaterialProperties();
}

/**
 * Get default material properties for unknown materials
 * @returns {Object} Default material properties
 * @private
 */
function getDefaultMaterialProperties() {
  return {
    color: '#CCCCCC',
    density: 1.8,
    pattern: 'horizontal_lines',
    description: 'Unknown material type',
    category: 'UNKNOWN',
    aliases: []
  };
}

/**
 * Validate geological material sequence with comprehensive error handling
 * @param {Array} layers - Array of layer objects with material, from, and to properties
 * @returns {Object} Validation result with isValid, warnings, and errors
 */
export function validateMaterialSequence(layers) {
  const warnings = [];
  const errors = [];
  
  // Input validation
  if (!layers) {
    errors.push('Layer array is null or undefined');
    return { isValid: false, warnings: [], errors };
  }
  
  if (!Array.isArray(layers)) {
    errors.push('Expected array of layers, got ' + typeof layers);
    return { isValid: false, warnings: [], errors };
  }
  
  if (layers.length === 0) {
    return { isValid: true, warnings: [], errors: [] };
  }
  
  // Validate layer structure
  for (let i = 0; i < layers.length; i++) {
    const layer = layers[i];
    if (!layer || typeof layer !== 'object') {
      errors.push(`Layer ${i + 1}: Invalid layer object`);
      continue;
    }
    
    if (!layer.material || typeof layer.material !== 'string') {
      errors.push(`Layer ${i + 1}: Missing or invalid material property`);
    }
    
    if (typeof layer.from !== 'number' || typeof layer.to !== 'number') {
      errors.push(`Layer ${i + 1}: Missing or invalid depth properties (from/to)`);
    }
    
    if (layer.from >= layer.to) {
      errors.push(`Layer ${i + 1}: Invalid depth range (from >= to)`);
    }
  }
  
  // Return early if structural errors found
  if (errors.length > 0) {
    return { isValid: false, warnings, errors };
  }
  
  // Sort layers by depth for geological validation
  const sortedLayers = [...layers].sort((a, b) => a.from - b.from);
  
  try {
    for (let i = 1; i < sortedLayers.length; i++) {
      const prevLayer = sortedLayers[i - 1];
      const currentLayer = sortedLayers[i];
      
      // Check for geologically unlikely sequences
      const prevCategory = getMaterialCategory(prevLayer.material);
      const currentCategory = getMaterialCategory(currentLayer.material);
      
      // Rock over softer materials is unlikely
      if (prevCategory === 'BEDROCK' && currentCategory !== 'BEDROCK') {
        warnings.push(
          `Layer ${i + 1}: ${currentLayer.material} found below ${prevLayer.material} - unusual geological sequence`
        );
      }
      
      // Organic materials at significant depth
      if (currentCategory === 'ORGANIC' && currentLayer.from > 5) {
        warnings.push(
          `Layer ${i + 1}: Organic material at depth ${currentLayer.from}m - verify geological context`
        );
      }
      
      // Check for layer gaps or overlaps
      if (Math.abs(prevLayer.to - currentLayer.from) > 0.1) {
        if (prevLayer.to < currentLayer.from) {
          warnings.push(
            `Layer gap detected between layers ${i} and ${i + 1} (${prevLayer.to}m to ${currentLayer.from}m)`
          );
        } else {
          errors.push(
            `Layer overlap detected between layers ${i} and ${i + 1}`
          );
        }
      }
      
      // Rapid alternation between very different materials
      if (i > 1) {
        const prevPrevLayer = sortedLayers[i - 2];
        const prevPrevCategory = getMaterialCategory(prevPrevLayer.material);
        
        if (prevPrevCategory === currentCategory && 
            prevPrevCategory !== prevCategory &&
            (currentLayer.to - prevPrevLayer.from) < 2) {
          warnings.push(
            `Layers ${i - 1}-${i + 1}: Rapid alternation between ${prevPrevCategory} and ${prevCategory} materials in thin layers`
          );
        }
      }
    }
  } catch (error) {
    geologicalLogger.error('Error during geological validation:', error);
    errors.push('Internal validation error: ' + error.message);
  }
  
  return {
    isValid: errors.length === 0,
    warnings,
    errors
  };
}

export function getMaterialCategory(material) {
  for (const [category, materials] of Object.entries(MATERIAL_CATEGORIES)) {
    if (materials.includes(material)) {
      return category;
    }
  }
  return 'UNKNOWN';
}

export function getSuggestedMaterials(input = '') {
  const cleanInput = input.toLowerCase().trim();
  
  if (!cleanInput) {
    return Object.keys(STANDARD_MATERIALS);
  }
  
  const suggestions = [];
  
  // Exact matches first
  Object.keys(STANDARD_MATERIALS).forEach(material => {
    if (material.toLowerCase().includes(cleanInput)) {
      suggestions.push(material);
    }
  });
  
  // Alias matches
  Object.entries(STANDARD_MATERIALS).forEach(([material, props]) => {
    if (suggestions.includes(material)) return; // Already added
    
    if (props.aliases.some(alias => alias.includes(cleanInput))) {
      suggestions.push(material);
    }
  });
  
  // USCS classification matches
  Object.entries(USCS_CLASSIFICATIONS).forEach(([code, classification]) => {
    if (code.toLowerCase().includes(cleanInput) && !suggestions.includes(classification.material)) {
      suggestions.push(classification.material);
    }
  });
  
  return suggestions.slice(0, 8); // Limit to 8 suggestions
}

export function exportMaterialMapping() {
  return {
    standardMaterials: STANDARD_MATERIALS,
    uscsClassifications: USCS_CLASSIFICATIONS,
    materialCategories: MATERIAL_CATEGORIES,
    exportedAt: new Date().toISOString()
  };
}

export function importCustomMaterials(customMaterials) {
  // Validate and merge custom materials with standards
  const validatedMaterials = {};
  const errors = [];
  
  for (const [name, props] of Object.entries(customMaterials)) {
    if (!name || typeof name !== 'string') {
      errors.push('Material name must be a non-empty string');
      continue;
    }
    
    if (!props.color || !props.density) {
      errors.push(`Material ${name}: missing required properties (color, density)`);
      continue;
    }
    
    validatedMaterials[name.toUpperCase()] = {
      color: props.color,
      density: props.density,
      pattern: props.pattern || 'solid',
      description: props.description || 'Custom material',
      aliases: props.aliases || []
    };
  }
  
  return {
    success: errors.length === 0,
    errors,
    materials: validatedMaterials
  };
}