/**
 * HorizonPreprocessor
 *
 * Preprocesses borehole data to insert zero-thickness marker points where layers
 * are missing. This enables smooth "pinch-out" transitions in geological surfaces
 * instead of abrupt disappearances.
 *
 * Key Features:
 * - Stratigraphic position insertion: Places markers at the boundary between adjacent layers
 * - Confidence tracking: Lower confidence for estimated points
 * - Integration with existing GeologicalSequenceEngine patterns
 *
 * @module HorizonPreprocessor
 */

/**
 * HorizonPoint data structure
 * @typedef {Object} HorizonPoint
 * @property {number} x - East-West coordinate (feet)
 * @property {number} y - North-South coordinate (feet)
 * @property {number} topZ - Top elevation (negative = below surface)
 * @property {number} bottomZ - Bottom elevation (negative = below surface)
 * @property {number} thickness - Layer thickness (topZ - bottomZ), 0 for pinch-outs
 * @property {boolean} isZeroThickness - True if this is an inserted marker point
 * @property {number} stratigraphicIndex - Position in the stratigraphic sequence
 * @property {number} confidence - Confidence score 0-1 (lower for estimated points)
 * @property {string} boreholeId - Source borehole identifier
 * @property {string} material - Material/layer type
 * @property {string} insertionMethod - 'observed' | 'stratigraphic-pinchout' | 'neighbor-estimated'
 * @property {string[]} estimatedFrom - Borehole IDs used for depth estimation (if applicable)
 */

export class HorizonPreprocessor {
  /**
   * Default configuration options
   */
  static DEFAULT_OPTIONS = {
    neighborSearchRadius: 100,      // feet - search radius for IDW estimation fallback
    minNeighborsForEstimate: 2,     // minimum neighbors needed for IDW fallback
    pinchOutThreshold: 0.05,        // feet - below this thickness = effectively pinch-out
    confidenceDecayFactor: 0.7,     // confidence multiplier for estimated points
    useStratigraphicPosition: true  // prefer stratigraphic positioning over IDW
  };

  /**
   * Process all boreholes and insert zero-thickness markers for missing layers
   *
   * @param {Array} boreholes - Array of Borehole objects
   * @param {Array} materials - Ordered list of materials to process (stratigraphic order)
   * @param {Object} options - Configuration options
   * @returns {Map<string, Array<HorizonPoint>>} Material -> HorizonPoints map
   */
  static preprocessHorizons(boreholes, materials, options = {}) {
    const config = { ...this.DEFAULT_OPTIONS, ...options };
    const horizonMap = new Map();

    if (!boreholes || boreholes.length === 0 || !materials || materials.length === 0) {
      return horizonMap;
    }

    // Step 1: Build stratigraphic sequence from all boreholes
    const stratigraphicSequence = this.buildStratigraphicSequence(boreholes, materials);

    // Step 2: Process each material
    for (let stratIndex = 0; stratIndex < materials.length; stratIndex++) {
      const material = materials[stratIndex];
      const horizonPoints = this.processMaterialHorizons(
        boreholes,
        material,
        stratIndex,
        stratigraphicSequence,
        config
      );
      horizonMap.set(material, horizonPoints);
    }

    return horizonMap;
  }

  /**
   * Build the master stratigraphic sequence from all boreholes
   * Determines the correct ordering of layers based on observed occurrences
   *
   * @param {Array} boreholes - Array of Borehole objects
   * @param {Array} materials - Materials to include in sequence
   * @returns {Object} Stratigraphic data with ordering and depth statistics
   */
  static buildStratigraphicSequence(boreholes, materials) {
    const sequence = {
      order: materials, // Use provided order as stratigraphic order
      materialStats: new Map(),
      boreholeLayerMaps: new Map() // Cache layer lookups per borehole
    };

    // For each material, gather statistics across all boreholes
    for (const material of materials) {
      const stats = {
        material,
        presentIn: [],
        missingFrom: [],
        avgTopZ: 0,
        avgBottomZ: 0,
        avgCenterZ: 0,
        minTopZ: Infinity,
        maxBottomZ: -Infinity,
        totalThickness: 0,
        count: 0
      };

      for (const borehole of boreholes) {
        // Check if this is a unique key (format: MATERIAL_color)
        const isUniqueKey = material.includes('_');
        const baseMaterial = isUniqueKey ? material.split('_')[0] : material;
        const color = isUniqueKey ? material.split('_')[1] : null;

        // Get layer points using appropriate method
        let layerPoints;
        if (isUniqueKey && borehole.getLayerPointsForMaterialAndColor) {
          layerPoints = borehole.getLayerPointsForMaterialAndColor(baseMaterial, color);
        } else if (borehole.getLayerPointsForMaterial) {
          layerPoints = borehole.getLayerPointsForMaterial(material);
        } else {
          layerPoints = [];
        }

        if (layerPoints && layerPoints.length > 0) {
          stats.presentIn.push(borehole.id);

          // Aggregate statistics
          for (const point of layerPoints) {
            stats.avgTopZ += point.topZ;
            stats.avgBottomZ += point.bottomZ;
            stats.avgCenterZ += (point.topZ + point.bottomZ) / 2;
            stats.minTopZ = Math.min(stats.minTopZ, point.topZ);
            stats.maxBottomZ = Math.max(stats.maxBottomZ, point.bottomZ);
            stats.totalThickness += Math.abs(point.topZ - point.bottomZ);
            stats.count++;
          }

          // Cache the layer data for this borehole-material combination
          const cacheKey = `${borehole.id}:${material}`;
          sequence.boreholeLayerMaps.set(cacheKey, layerPoints);
        } else {
          stats.missingFrom.push(borehole.id);
        }
      }

      // Calculate averages
      if (stats.count > 0) {
        stats.avgTopZ /= stats.count;
        stats.avgBottomZ /= stats.count;
        stats.avgCenterZ /= stats.count;
      }

      sequence.materialStats.set(material, stats);
    }

    return sequence;
  }

  /**
   * Process a single material across all boreholes, inserting zero-thickness markers
   *
   * @param {Array} boreholes - Array of Borehole objects
   * @param {string} material - Material to process
   * @param {number} stratIndex - Index in stratigraphic sequence
   * @param {Object} stratigraphicSequence - Pre-computed sequence data
   * @param {Object} config - Configuration options
   * @returns {Array<HorizonPoint>} Array of horizon points including zero-thickness markers
   */
  static processMaterialHorizons(boreholes, material, stratIndex, stratigraphicSequence, config) {
    const horizonPoints = [];
    const materialStats = stratigraphicSequence.materialStats.get(material);

    if (!materialStats) {
      return horizonPoints;
    }

    // Process each borehole
    for (const borehole of boreholes) {
      const cacheKey = `${borehole.id}:${material}`;
      const cachedPoints = stratigraphicSequence.boreholeLayerMaps.get(cacheKey);

      if (cachedPoints && cachedPoints.length > 0) {
        // Layer is PRESENT in this borehole - add observed points
        for (const point of cachedPoints) {
          // DEBUG: Log coordinate mapping
          console.log(`[HorizonPreprocessor] ${borehole.name} ${material}: borehole.z=${borehole.z}, point.z=${point.z} → gridY=${point.z}`);

          horizonPoints.push({
            x: point.x,
            y: point.z,  // CRITICAL FIX: Use z (North-South) not y (elevation) to match grid coordinates
            topZ: point.topZ,
            bottomZ: point.bottomZ,
            thickness: Math.abs(point.topZ - point.bottomZ),
            isZeroThickness: false,
            stratigraphicIndex: stratIndex,
            confidence: 1.0, // Full confidence for observed data
            boreholeId: borehole.id,
            material: material,
            insertionMethod: 'observed',
            estimatedFrom: []
          });
        }
      } else {
        // Layer is MISSING in this borehole - need to insert zero-thickness marker
        const zeroThicknessPoint = this.createZeroThicknessPoint(
          borehole,
          material,
          stratIndex,
          stratigraphicSequence,
          boreholes,
          config
        );

        if (zeroThicknessPoint) {
          horizonPoints.push(zeroThicknessPoint);
        }
      }
    }

    return horizonPoints;
  }

  /**
   * Create a zero-thickness marker point for a missing layer
   * Uses stratigraphic position between adjacent layers (preferred) or IDW fallback
   *
   * @param {Object} borehole - The borehole missing the layer
   * @param {string} material - The missing material
   * @param {number} stratIndex - Index in stratigraphic sequence
   * @param {Object} stratigraphicSequence - Pre-computed sequence data
   * @param {Array} boreholes - All boreholes (for IDW fallback)
   * @param {Object} config - Configuration options
   * @returns {HorizonPoint|null} Zero-thickness horizon point, or null if unable to estimate
   */
  static createZeroThicknessPoint(borehole, material, stratIndex, stratigraphicSequence, boreholes, config) {
    // Strategy 1: Stratigraphic Position (preferred)
    if (config.useStratigraphicPosition) {
      const stratPosition = this.estimateStratigraphicPosition(
        borehole,
        material,
        stratIndex,
        stratigraphicSequence
      );

      if (stratPosition !== null) {
        return {
          x: borehole.x,
          y: borehole.z, // Note: borehole.z is N-S coordinate in app coordinate system
          topZ: stratPosition,
          bottomZ: stratPosition, // Same = zero thickness
          thickness: 0,
          isZeroThickness: true,
          stratigraphicIndex: stratIndex,
          confidence: 0.6, // Medium confidence for stratigraphic estimation
          boreholeId: borehole.id,
          material: material,
          insertionMethod: 'stratigraphic-pinchout',
          estimatedFrom: []
        };
      }
    }

    // Strategy 2: IDW from neighboring boreholes (fallback)
    const idwEstimate = this.estimateFromNeighbors(
      borehole,
      material,
      stratigraphicSequence,
      boreholes,
      config
    );

    if (idwEstimate !== null) {
      return {
        x: borehole.x,
        y: borehole.z,
        topZ: idwEstimate.depth,
        bottomZ: idwEstimate.depth,
        thickness: 0,
        isZeroThickness: true,
        stratigraphicIndex: stratIndex,
        confidence: idwEstimate.confidence * config.confidenceDecayFactor,
        boreholeId: borehole.id,
        material: material,
        insertionMethod: 'neighbor-estimated',
        estimatedFrom: idwEstimate.neighbors
      };
    }

    // Unable to estimate - return null (layer won't have a point at this borehole)
    return null;
  }

  /**
   * Estimate the depth of a missing layer using stratigraphic position
   * Finds adjacent layers (above and below in sequence) and places the marker between them
   *
   * @param {Object} borehole - The borehole missing the layer
   * @param {string} material - The missing material
   * @param {number} stratIndex - Index in stratigraphic sequence
   * @param {Object} stratigraphicSequence - Pre-computed sequence data
   * @returns {number|null} Estimated depth, or null if cannot determine
   */
  static estimateStratigraphicPosition(borehole, material, stratIndex, stratigraphicSequence) {
    const materials = stratigraphicSequence.order;

    // Find the nearest layer ABOVE in stratigraphic sequence that exists in this borehole
    let aboveLayerBottom = null;
    for (let i = stratIndex - 1; i >= 0; i--) {
      const aboveMaterial = materials[i];
      const cacheKey = `${borehole.id}:${aboveMaterial}`;
      const abovePoints = stratigraphicSequence.boreholeLayerMaps.get(cacheKey);

      if (abovePoints && abovePoints.length > 0) {
        // Found the layer above - get its bottom elevation
        aboveLayerBottom = Math.min(...abovePoints.map(p => p.bottomZ));
        break;
      }
    }

    // Find the nearest layer BELOW in stratigraphic sequence that exists in this borehole
    let belowLayerTop = null;
    for (let i = stratIndex + 1; i < materials.length; i++) {
      const belowMaterial = materials[i];
      const cacheKey = `${borehole.id}:${belowMaterial}`;
      const belowPoints = stratigraphicSequence.boreholeLayerMaps.get(cacheKey);

      if (belowPoints && belowPoints.length > 0) {
        // Found the layer below - get its top elevation
        belowLayerTop = Math.max(...belowPoints.map(p => p.topZ));
        break;
      }
    }

    // Calculate the insertion depth
    if (aboveLayerBottom !== null && belowLayerTop !== null) {
      // Both adjacent layers exist - insert at midpoint
      return (aboveLayerBottom + belowLayerTop) / 2;
    } else if (aboveLayerBottom !== null) {
      // Only layer above exists - insert just below it
      return aboveLayerBottom - 0.01; // Tiny offset below
    } else if (belowLayerTop !== null) {
      // Only layer below exists - insert just above it
      return belowLayerTop + 0.01; // Tiny offset above
    }

    // No adjacent layers found in this borehole
    return null;
  }

  /**
   * Estimate the depth of a missing layer using IDW from neighboring boreholes
   * Fallback method when stratigraphic positioning is not possible
   *
   * @param {Object} borehole - The borehole missing the layer
   * @param {string} material - The missing material
   * @param {Object} stratigraphicSequence - Pre-computed sequence data
   * @param {Array} boreholes - All boreholes
   * @param {Object} config - Configuration options
   * @returns {Object|null} {depth, confidence, neighbors} or null if cannot estimate
   */
  static estimateFromNeighbors(borehole, material, stratigraphicSequence, boreholes, config) {
    const materialStats = stratigraphicSequence.materialStats.get(material);

    if (!materialStats || materialStats.presentIn.length < config.minNeighborsForEstimate) {
      return null;
    }

    // Find nearby boreholes that HAVE this layer
    const neighbors = [];
    for (const candidateId of materialStats.presentIn) {
      const candidate = boreholes.find(bh => bh.id === candidateId);
      if (!candidate || candidate.id === borehole.id) continue;

      const dx = borehole.x - candidate.x;
      const dy = borehole.z - candidate.z; // z is N-S coordinate
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance <= config.neighborSearchRadius && distance > 0) {
        const cacheKey = `${candidate.id}:${material}`;
        const points = stratigraphicSequence.boreholeLayerMaps.get(cacheKey);

        if (points && points.length > 0) {
          // Use center elevation of the layer
          const centerZ = (points[0].topZ + points[0].bottomZ) / 2;
          neighbors.push({
            boreholeId: candidate.id,
            distance,
            centerZ
          });
        }
      }
    }

    if (neighbors.length < config.minNeighborsForEstimate) {
      return null;
    }

    // Sort by distance (closest first)
    neighbors.sort((a, b) => a.distance - b.distance);

    // Apply IDW to estimate depth
    let numerator = 0;
    let denominator = 0;
    const power = 2;

    for (const neighbor of neighbors) {
      const weight = 1 / Math.pow(neighbor.distance, power);
      numerator += weight * neighbor.centerZ;
      denominator += weight;
    }

    if (denominator === 0) {
      return null;
    }

    const estimatedDepth = numerator / denominator;

    // Calculate confidence based on neighbor distance and count
    const avgDistance = neighbors.reduce((sum, n) => sum + n.distance, 0) / neighbors.length;
    const distanceConfidence = Math.exp(-avgDistance / config.neighborSearchRadius);
    const neighborConfidence = Math.min(neighbors.length / 4, 1.0);
    const confidence = distanceConfidence * neighborConfidence;

    return {
      depth: estimatedDepth,
      confidence,
      neighbors: neighbors.slice(0, 4).map(n => n.boreholeId) // Top 4 contributing neighbors
    };
  }

  /**
   * Convenience method to get augmented layer points for a specific material
   * Returns the original layer points plus zero-thickness markers
   *
   * @param {Map} horizonMap - Result from preprocessHorizons()
   * @param {string} material - Material to retrieve
   * @returns {Array<HorizonPoint>} Augmented horizon points
   */
  static getAugmentedLayerPoints(horizonMap, material) {
    return horizonMap.get(material) || [];
  }

  /**
   * Get statistics about the preprocessing results
   * Useful for debugging and confidence assessment
   *
   * @param {Map} horizonMap - Result from preprocessHorizons()
   * @returns {Object} Summary statistics
   */
  static getPreprocessingStats(horizonMap) {
    const stats = {
      totalMaterials: horizonMap.size,
      materials: []
    };

    for (const [material, points] of horizonMap) {
      const observed = points.filter(p => p.insertionMethod === 'observed');
      const stratPinchouts = points.filter(p => p.insertionMethod === 'stratigraphic-pinchout');
      const neighborEstimated = points.filter(p => p.insertionMethod === 'neighbor-estimated');

      stats.materials.push({
        material,
        totalPoints: points.length,
        observedPoints: observed.length,
        stratigraphicPinchouts: stratPinchouts.length,
        neighborEstimated: neighborEstimated.length,
        avgConfidence: points.length > 0
          ? points.reduce((sum, p) => sum + p.confidence, 0) / points.length
          : 0
      });
    }

    return stats;
  }
}

export default HorizonPreprocessor;
