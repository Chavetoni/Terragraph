import { validateMaterialSequence } from './materialStandardization';

export function validateBoreholeData(borehole) {
  const errors = [];
  const warnings = [];

  // Basic borehole validation
  if (!borehole.name || borehole.name.trim().length === 0) {
    errors.push('Borehole name is required');
  }

  if (!borehole.totalDepth || borehole.totalDepth <= 0) {
    errors.push('Total depth must be greater than 0');
  }

  if (borehole.totalDepth > 1000) {
    warnings.push('Borehole depth exceeds 1000m - verify depth is correct');
  }

  // Position validation
  if (typeof borehole.x !== 'number' || typeof borehole.y !== 'number') {
    errors.push('Borehole position coordinates must be numbers');
  }

  // Layer validation
  if (borehole.layers && borehole.layers.length > 0) {
    const layerValidation = validateLayers(borehole.layers, borehole.totalDepth);
    errors.push(...layerValidation.errors);
    warnings.push(...layerValidation.warnings);

    // Geological sequence validation
    const sequenceValidation = validateMaterialSequence(borehole.layers);
    warnings.push(...sequenceValidation.warnings);
    errors.push(...sequenceValidation.errors);
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

export function validateLayers(layers, totalDepth) {
  const errors = [];
  const warnings = [];

  if (!Array.isArray(layers)) {
    errors.push('Layers must be an array');
    return { isValid: false, errors, warnings };
  }

  const sortedLayers = [...layers].sort((a, b) => a.from - b.from);

  // Check each layer individually
  sortedLayers.forEach((layer, index) => {
    const layerNumber = index + 1;

    // Required fields
    if (typeof layer.from !== 'number') {
      errors.push(`Layer ${layerNumber}: 'from' depth must be a number`);
    }
    if (typeof layer.to !== 'number') {
      errors.push(`Layer ${layerNumber}: 'to' depth must be a number`);
    }
    if (!layer.material || typeof layer.material !== 'string') {
      errors.push(`Layer ${layerNumber}: material must be specified`);
    }

    // Depth logic
    if (layer.from >= layer.to) {
      errors.push(`Layer ${layerNumber}: 'from' depth must be less than 'to' depth`);
    }
    if (layer.from < 0) {
      errors.push(`Layer ${layerNumber}: 'from' depth cannot be negative`);
    }
    if (layer.to > totalDepth) {
      errors.push(`Layer ${layerNumber}: 'to' depth exceeds borehole total depth`);
    }

    // Thickness validation
    const thickness = layer.to - layer.from;
    if (thickness < 0.01) {
      warnings.push(`Layer ${layerNumber}: very thin layer (${thickness.toFixed(3)}m)`);
    }
    if (thickness > totalDepth * 0.8) {
      warnings.push(`Layer ${layerNumber}: very thick layer (${thickness.toFixed(1)}m), consider subdividing`);
    }
  });

  // Check for overlaps and gaps
  for (let i = 1; i < sortedLayers.length; i++) {
    const prevLayer = sortedLayers[i - 1];
    const currentLayer = sortedLayers[i];

    if (currentLayer.from < prevLayer.to) {
      errors.push(`Layer ${i + 1}: overlaps with layer ${i}`);
    } else if (currentLayer.from > prevLayer.to) {
      const gap = currentLayer.from - prevLayer.to;
      if (gap > 0.01) {
        warnings.push(`Gap between layer ${i} and ${i + 1}: ${gap.toFixed(2)}m`);
      }
    }
  }

  // Check total coverage
  if (sortedLayers.length > 0) {
    const firstLayer = sortedLayers[0];
    const lastLayer = sortedLayers[sortedLayers.length - 1];

    if (firstLayer.from > 0.01) {
      warnings.push(`Layers don't start at surface (first layer starts at ${firstLayer.from}m)`);
    }

    if (Math.abs(lastLayer.to - totalDepth) > 0.01) {
      if (lastLayer.to < totalDepth) {
        warnings.push(`Layers don't reach total depth (end at ${lastLayer.to}m, total depth ${totalDepth}m)`);
      } else {
        errors.push(`Layers exceed total depth (end at ${lastLayer.to}m, total depth ${totalDepth}m)`);
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

export function validateLayerData(layerData) {
  const errors = [];
  const warnings = [];

  // Required properties
  const requiredProps = ['from', 'to', 'material'];
  requiredProps.forEach(prop => {
    if (layerData[prop] === undefined || layerData[prop] === null) {
      errors.push(`Missing required property: ${prop}`);
    }
  });

  // Type validation
  if (typeof layerData.from !== 'number') {
    errors.push('Property "from" must be a number');
  }
  if (typeof layerData.to !== 'number') {
    errors.push('Property "to" must be a number');
  }
  if (typeof layerData.material !== 'string') {
    errors.push('Property "material" must be a string');
  }

  // Value validation
  if (layerData.from >= layerData.to) {
    errors.push('"from" depth must be less than "to" depth');
  }
  if (layerData.from < 0) {
    errors.push('"from" depth cannot be negative');
  }

  const thickness = layerData.to - layerData.from;
  if (thickness < 0.01) {
    warnings.push(`Very thin layer: ${thickness.toFixed(3)}m`);
  }
  if (thickness > 50) {
    warnings.push(`Very thick layer: ${thickness.toFixed(1)}m - consider subdividing`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

export function validateImportData(importData) {
  const errors = [];
  const warnings = [];

  if (!importData || typeof importData !== 'object') {
    errors.push('Import data must be an object');
    return { isValid: false, errors, warnings };
  }

  // Check required fields
  if (!importData.layers || !Array.isArray(importData.layers)) {
    errors.push('Import data must contain a "layers" array');
    return { isValid: false, errors, warnings };
  }

  // Validate total depth if provided
  if (importData.totalDepth && typeof importData.totalDepth !== 'number') {
    errors.push('Total depth must be a number');
  }
  if (importData.totalDepth && importData.totalDepth <= 0) {
    errors.push('Total depth must be greater than 0');
  }

  // Validate each layer
  importData.layers.forEach((layer, index) => {
    const layerValidation = validateLayerData(layer);
    layerValidation.errors.forEach(error => {
      errors.push(`Layer ${index + 1}: ${error}`);
    });
    layerValidation.warnings.forEach(warning => {
      warnings.push(`Layer ${index + 1}: ${warning}`);
    });
  });

  // Validate layer sequence
  if (errors.length === 0) {
    const totalDepth = importData.totalDepth || Math.max(...importData.layers.map(l => l.to));
    const layerValidation = validateLayers(importData.layers, totalDepth);
    errors.push(...layerValidation.errors);
    warnings.push(...layerValidation.warnings);
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

export function generateValidationReport(borehole) {
  const validation = validateBoreholeData(borehole);
  
  const report = {
    boreholeId: borehole.id,
    boreholeName: borehole.name,
    validatedAt: new Date().toISOString(),
    isValid: validation.isValid,
    summary: {
      totalErrors: validation.errors.length,
      totalWarnings: validation.warnings.length,
      layerCount: borehole.layers ? borehole.layers.length : 0,
      totalDepth: borehole.totalDepth
    },
    details: {
      errors: validation.errors,
      warnings: validation.warnings
    }
  };

  // Add recommendations based on validation results
  const recommendations = [];
  
  if (validation.warnings.some(w => w.includes('Gap'))) {
    recommendations.push('Consider adding intermediate layers to fill gaps in the geological sequence');
  }
  
  if (validation.warnings.some(w => w.includes('very thin'))) {
    recommendations.push('Very thin layers may indicate insufficient sampling - verify layer boundaries');
  }
  
  if (validation.warnings.some(w => w.includes('very thick'))) {
    recommendations.push('Consider subdividing thick layers based on additional data or sampling');
  }
  
  if (validation.warnings.some(w => w.includes('unusual geological sequence'))) {
    recommendations.push('Review geological sequence for consistency with local stratigraphy');
  }

  report.recommendations = recommendations;
  
  return report;
}

export function autoFixLayerIssues(layers, totalDepth, options = {}) {
  const {
    fillGaps = false,
    adjustToTotalDepth = true,
    minimumThickness = 0.1
  } = options;

  let fixedLayers = [...layers].sort((a, b) => a.from - b.from);
  const fixes = [];

  // Remove layers that are too thin
  fixedLayers = fixedLayers.filter(layer => {
    const thickness = layer.to - layer.from;
    if (thickness < minimumThickness) {
      fixes.push(`Removed layer with material ${layer.material} (thickness ${thickness.toFixed(3)}m < minimum ${minimumThickness}m)`);
      return false;
    }
    return true;
  });

  // Fill gaps if requested
  if (fillGaps && fixedLayers.length > 1) {
    const newLayers = [];
    
    for (let i = 0; i < fixedLayers.length - 1; i++) {
      newLayers.push(fixedLayers[i]);
      
      const currentLayer = fixedLayers[i];
      const nextLayer = fixedLayers[i + 1];
      
      if (nextLayer.from > currentLayer.to) {
        const gapLayer = {
          id: `gap_${Date.now()}_${Math.random()}`,
          from: currentLayer.to,
          to: nextLayer.from,
          material: 'UNKNOWN',
          thickness: nextLayer.from - currentLayer.to
        };
        newLayers.push(gapLayer);
        fixes.push(`Added gap-filling layer from ${gapLayer.from}m to ${gapLayer.to}m`);
      }
    }
    
    newLayers.push(fixedLayers[fixedLayers.length - 1]);
    fixedLayers = newLayers;
  }

  // Adjust to total depth if requested
  if (adjustToTotalDepth && fixedLayers.length > 0) {
    const lastLayer = fixedLayers[fixedLayers.length - 1];
    
    if (lastLayer.to !== totalDepth) {
      const originalTo = lastLayer.to;
      lastLayer.to = totalDepth;
      lastLayer.thickness = lastLayer.to - lastLayer.from;
      fixes.push(`Adjusted last layer from ${originalTo}m to ${totalDepth}m to match total depth`);
    }
  }

  return {
    fixedLayers,
    fixes,
    success: true
  };
}