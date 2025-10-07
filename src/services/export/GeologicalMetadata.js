/**
 * Geological Metadata Generation Utilities
 * 
 * Creates comprehensive metadata for geological model exports including
 * interpolation statistics, confidence analysis, and professional documentation.
 */

import { feetToInches } from '../../utils/unitConverter.js';
import { calculateDepthInterval } from '../../utils/depthScaleCalculator.js';

/**
 * Professional geological metadata generation for GLTF/GLB exports
 */
export class GeologicalMetadata {
  /**
   * Create comprehensive metadata for geological models
   * @param {Array} soilLayers - Array of soil layer data
   * @param {Array} boreholes - Array of borehole data
   * @param {Object} siteMap - Site map configuration  
   * @param {Object} displayOptions - Display configuration options
   * @param {Object} strataDimensions - Geological strata dimensions
   * @param {Object} geologicalModel - Geological model with interpolation data
   * @param {Object} waterTableData - Water table measurements
   * @param {Object} textureData - Soil texture configuration
   * @returns {Object} Comprehensive geological metadata
   */
  static createMetadata(soilLayers, boreholes, siteMap, displayOptions, strataDimensions, geologicalModel = null, waterTableData = null, textureData = null) {
    const safeSoilLayers = soilLayers || [];
    const safeBoreholes = boreholes || [];
    
    // Extract interpolation and confidence data from geological model
    let interpolationMetadata = {};
    let confidenceMetadata = {};
    
    if (geologicalModel && geologicalModel.interpolationStats) {
      interpolationMetadata = {
        method: geologicalModel.interpolationStats.interpolationMethod || 'idw',
        useAdvancedInterpolation: geologicalModel.interpolationStats.useAdvancedInterpolation || false,
        enableConfidenceMapping: geologicalModel.interpolationStats.enableConfidenceMapping || false,
        processingTime_ms: geologicalModel.processingTime,
        gridSize: geologicalModel.gridSize
      };
      
      // Add confidence statistics if available
      if (geologicalModel.interpolationStats.overallAvgConfidence !== undefined) {
        confidenceMetadata = {
          overallAvgConfidence: Number(geologicalModel.interpolationStats.overallAvgConfidence.toFixed(3)),
          minLayerConfidence: Number(geologicalModel.interpolationStats.minLayerConfidence.toFixed(3)),
          maxLayerConfidence: Number(geologicalModel.interpolationStats.maxLayerConfidence.toFixed(3)),
          confidenceDescription: this.getConfidenceDescription(geologicalModel.interpolationStats.overallAvgConfidence)
        };
      }
      
      // Add method-specific parameters
      if (geologicalModel.modelingSettings) {
        if (geologicalModel.modelingSettings.krigingVariogramModel) {
          interpolationMetadata.krigingVariogramModel = geologicalModel.modelingSettings.krigingVariogramModel;
        }
        if (geologicalModel.modelingSettings.rbfBasisFunction) {
          interpolationMetadata.rbfBasisFunction = geologicalModel.modelingSettings.rbfBasisFunction;
        }
      }
    }
    
    // Enhanced layer metadata with interpolation quality
    const layerMetadata = safeSoilLayers.map((layer, index) => {
      const baseLayerData = {
        name: layer.name || `Layer ${index + 1}`,
        depth_ft: (parseFloat(layer.depth) || 3.28).toFixed(1),
        color: layer.color || '#888888',
        description: layer.description || '',
        layerIndex: index
      };
      
      // Add interpolation quality if available from geological model
      if (geologicalModel && geologicalModel.layers) {
        const modelLayer = geologicalModel.layers.find(l => l.material === layer.name);
        if (modelLayer && modelLayer.interpolationQuality) {
          baseLayerData.interpolationQuality = {
            avgConfidence: modelLayer.interpolationQuality.avgConfidence ? 
              Number(modelLayer.interpolationQuality.avgConfidence.toFixed(3)) : undefined,
            minConfidence: modelLayer.interpolationQuality.minConfidence ? 
              Number(modelLayer.interpolationQuality.minConfidence.toFixed(3)) : undefined,
            maxConfidence: modelLayer.interpolationQuality.maxConfidence ? 
              Number(modelLayer.interpolationQuality.maxConfidence.toFixed(3)) : undefined,
            interpolationMethod: modelLayer.interpolationQuality.interpolationMethod,
            confidencePoints: modelLayer.interpolationQuality.confidencePoints
          };
        }
      }
      
      return baseLayerData;
    });
    
    // Enhanced borehole metadata with water table information
    const boreholeMetadata = safeBoreholes.map((borehole, index) => {
      const baseMetadata = {
        name: borehole.name || `BH-${index + 1}`,
        coordinates: {
          x_ft: (borehole.x || (index * 16.4)).toFixed(1),
          y_ft: (borehole.y || 0).toFixed(1),
          z_ft: (borehole.z || 0).toFixed(1)
        },
        depth_ft: (borehole.depth || 32.8).toFixed(1),
        diameter_ft: (borehole.diameter || 0.49).toFixed(2),
        diameter_in: feetToInches(borehole.diameter || 0.49).toFixed(1),
        type: borehole.type || 'OTHER',
        layerCount: borehole.layers ? borehole.layers.length : 0,
        layers: borehole.layers ? borehole.layers.map(layer => ({
          name: layer.name,
          thickness_ft: (layer.thickness || 3.28).toFixed(1),
          description: layer.description || ''
        })) : []
      };

      // Add water table information if available
      if (borehole.waterTableEncountered && (borehole.waterTableDepth !== null || borehole.waterTableElevation !== null)) {
        baseMetadata.waterTable = {
          encountered: true,
          depth_ft: borehole.waterTableDepth ? borehole.waterTableDepth.toFixed(1) : null,
          elevation_ft: borehole.waterTableElevation ? borehole.waterTableElevation.toFixed(1) : null,
          surfaceElevation_ft: borehole.surfaceElevation ? borehole.surfaceElevation.toFixed(1) : null
        };
      } else {
        baseMetadata.waterTable = {
          encountered: false
        };
      }

      return baseMetadata;
    });
    
    // Site configuration metadata
    const siteMetadata = {
      dimensions: {
        width_ft: (strataDimensions?.width || 164).toFixed(1),
        depth_ft: (strataDimensions?.depth || 164).toFixed(1),
        area_sqft: ((strataDimensions?.width || 164) * (strataDimensions?.depth || 164)).toFixed(0)
      },
      hasSiteMap: !!(siteMap && siteMap.object),
      displayOptions: displayOptions || {}
    };

    // Water table summary metadata  
    if (waterTableData) {
      const waterTableBoreholes = safeBoreholes.filter(bh => bh.waterTableEncountered && 
        (bh.waterTableDepth !== null || bh.waterTableElevation !== null));
      
      if (waterTableBoreholes.length > 0) {
        const depths = waterTableBoreholes
          .map(bh => bh.waterTableDepth)
          .filter(depth => depth !== null && depth !== undefined);
          
        siteMetadata.waterTable = {
          encountered: true,
          boreholeCount: waterTableBoreholes.length,
          depthRange_ft: depths.length > 0 ? {
            min: Math.min(...depths).toFixed(1),
            max: Math.max(...depths).toFixed(1),
            avg: (depths.reduce((sum, d) => sum + d, 0) / depths.length).toFixed(1)
          } : null
        };
      } else {
        siteMetadata.waterTable = { encountered: false };
      }
    }

    // Texture configuration metadata
    if (textureData) {
      siteMetadata.textureSettings = {
        enabled: textureData.enabled || false,
        globalIntensity: textureData.globalIntensity || 0.7,
        patternScale: textureData.patternScale || 1.0,
        materialPatterns: textureData.materialPatterns || {}
      };
    }

    return {
      export: {
        timestamp: new Date().toISOString(),
        generator: 'Geotech-Visualizer Professional',
        version: '1.0',
        format: 'GLTF 2.0 with geological metadata'
      },
      geological: {
        interpolation: interpolationMetadata,
        confidence: confidenceMetadata,
        layers: layerMetadata,
        boreholes: boreholeMetadata,
        site: siteMetadata,
        depthScale: this.createDepthScaleMetadata(safeSoilLayers, safeBoreholes),
        analysis: {
          spatialCoverage: this.calculateSpatialCoverage(safeBoreholes, strataDimensions),
          modelComplexity: this.calculateModelComplexity(geologicalModel),
          dataQuality: this.assessDataQuality(safeBoreholes, safeSoilLayers)
        }
      }
    };
  }

  /**
   * Create depth scale metadata for geological models
   * @param {Array} soilLayers - Soil layer data
   * @param {Array} boreholes - Borehole data
   * @returns {Object} Depth scale configuration metadata
   */
  static createDepthScaleMetadata(soilLayers, boreholes) {
    // Calculate total depth from boreholes (same logic as SceneExporter)
    let totalDepth = 32.8; // Default depth in feet

    if (boreholes && boreholes.length > 0) {
      const boreholeDepths = boreholes
        .map(borehole => {
          if (borehole.totalDepth && borehole.totalDepth > 0) return borehole.totalDepth;
          if (borehole.depth && borehole.depth > 0) return borehole.depth;
          if (borehole.layers && borehole.layers.length > 0) {
            return Math.max(...borehole.layers.map(layer => layer.to || 0));
          }
          return 0;
        })
        .filter(depth => depth > 0);

      if (boreholeDepths.length > 0) {
        totalDepth = Math.max(...boreholeDepths);
      }
    }

    if (totalDepth <= 0) {
      totalDepth = 32.8; // Fallback
    }

    // Calculate depth interval and markers
    const interval = calculateDepthInterval(totalDepth);
    
    const depthMarkers = [0];
    let currentDepth = interval;
    
    while (currentDepth < totalDepth) {
      depthMarkers.push(currentDepth);
      currentDepth += interval;
    }

    if (totalDepth > 0 && !depthMarkers.includes(totalDepth)) {
      depthMarkers.push(totalDepth);
    }

    return {
      totalDepth_ft: totalDepth.toFixed(1),
      interval_ft: interval.toFixed(1),
      markerCount: depthMarkers.length,
      markers_ft: depthMarkers.map(d => d.toFixed(1)),
      boreholeBasedDepth: boreholes && boreholes.length > 0,
      configuration: {
        scaleType: 'geological_depth',
        units: 'feet',
        positioning: 'left_of_model',
        labelFormat: 'depth_value_with_units'
      }
    };
  }

  /**
   * Get confidence description from numerical confidence value
   * @param {number} confidence - Confidence value (0-1)
   * @returns {string} Human-readable confidence description
   */
  static getConfidenceDescription(confidence) {
    if (confidence >= 0.8) return 'High - Excellent interpolation reliability';
    if (confidence >= 0.6) return 'Medium-High - Good interpolation reliability';
    if (confidence >= 0.4) return 'Medium - Acceptable interpolation reliability';
    if (confidence >= 0.2) return 'Low - Limited interpolation reliability';
    return 'Very Low - Use with caution';
  }

  /**
   * Calculate spatial coverage quality metric
   * @param {Array} boreholes - Array of borehole data
   * @param {Object} dimensions - Site dimensions
   * @returns {string} Spatial coverage assessment
   */
  static calculateSpatialCoverage(boreholes, dimensions) {
    if (boreholes.length < 3) return 'Insufficient';
    
    const area = (dimensions?.width || 40) * (dimensions?.depth || 40);
    const density = boreholes.length / area;
    
    if (density >= 0.1) return 'Excellent';
    if (density >= 0.05) return 'Good';
    if (density >= 0.025) return 'Adequate';
    return 'Sparse';
  }

  /**
   * Calculate model complexity metric
   * @param {Object} geologicalModel - Geological model data
   * @returns {string} Model complexity assessment
   */
  static calculateModelComplexity(geologicalModel) {
    if (!geologicalModel) return 'Basic';
    
    const layerCount = geologicalModel.layers?.length || 0;
    const vertexCount = geologicalModel.statistics?.totalVertices || 0;
    const useAdvanced = geologicalModel.interpolationStats?.useAdvancedInterpolation || false;
    
    if (useAdvanced && layerCount >= 5 && vertexCount >= 10000) return 'High Detail Professional';
    if (useAdvanced && layerCount >= 3) return 'Professional';
    if (layerCount >= 5) return 'Detailed';
    if (layerCount >= 3) return 'Standard';
    return 'Simple';
  }

  /**
   * Assess overall data quality for geological modeling
   * @param {Array} boreholes - Borehole data
   * @param {Array} soilLayers - Soil layer data
   * @returns {Object} Data quality assessment
   */
  static assessDataQuality(boreholes, soilLayers) {
    const warnings = [];
    let overallScore = 1.0;

    // Check borehole count
    if (boreholes.length < 3) {
      warnings.push('Insufficient boreholes for reliable interpolation (minimum 3 recommended)');
      overallScore *= 0.6;
    } else if (boreholes.length < 5) {
      warnings.push('Limited borehole coverage - consider additional data points');
      overallScore *= 0.8;
    }

    // Check layer consistency
    if (soilLayers.length === 0) {
      warnings.push('No soil layers defined');
      overallScore *= 0.5;
    }

    // Check for water table data completeness
    const waterTableCount = boreholes.filter(bh => bh.waterTableEncountered).length;
    if (waterTableCount > 0 && waterTableCount < boreholes.length / 2) {
      warnings.push('Inconsistent water table data - some boreholes missing water table information');
      overallScore *= 0.9;
    }

    // Check for depth consistency
    const depths = boreholes.map(bh => bh.depth || bh.totalDepth || 0).filter(d => d > 0);
    if (depths.length > 0) {
      const avgDepth = depths.reduce((sum, d) => sum + d, 0) / depths.length;
      const hasShallowBoreholes = depths.some(d => d < avgDepth * 0.5);
      const hasDeepBoreholes = depths.some(d => d > avgDepth * 2);
      
      if (hasShallowBoreholes && hasDeepBoreholes) {
        warnings.push('Significant depth variation between boreholes may affect interpolation quality');
        overallScore *= 0.95;
      }
    }

    let qualityLevel = 'Excellent';
    if (overallScore < 0.9) qualityLevel = 'Good';
    if (overallScore < 0.8) qualityLevel = 'Adequate';
    if (overallScore < 0.7) qualityLevel = 'Poor';
    if (overallScore < 0.5) qualityLevel = 'Insufficient';

    return {
      overallScore: Number(overallScore.toFixed(2)),
      qualityLevel,
      warnings: warnings,
      recommendations: this.generateDataQualityRecommendations(warnings, boreholes.length)
    };
  }

  /**
   * Generate recommendations based on data quality analysis
   * @param {Array} warnings - List of data quality warnings
   * @param {number} boreholeCount - Number of boreholes
   * @returns {Array} Recommendations for improving data quality
   */
  static generateDataQualityRecommendations(warnings, boreholeCount) {
    const recommendations = [];

    if (boreholeCount < 5) {
      recommendations.push('Add more boreholes to improve spatial coverage and interpolation accuracy');
    }

    if (warnings.some(w => w.includes('water table'))) {
      recommendations.push('Complete water table measurements for all boreholes where encountered');
    }

    if (warnings.some(w => w.includes('depth variation'))) {
      recommendations.push('Consider depth standardization or weighted interpolation for variable depth boreholes');
    }

    if (warnings.some(w => w.includes('soil layers'))) {
      recommendations.push('Define soil layer classifications for consistent geological interpretation');
    }

    if (recommendations.length === 0) {
      recommendations.push('Data quality is good - consider advanced interpolation methods for enhanced modeling');
    }

    return recommendations;
  }

  /**
   * Generate filename for export metadata
   * @param {string} prefix - Filename prefix
   * @returns {string} Formatted metadata filename with timestamp
   */
  static generateMetadataFilename(prefix = 'geotech_export') {
    const now = new Date();
    const timestamp = now.toISOString()
      .replace(/[:.]/g, '-')
      .replace('T', '_')
      .substring(0, 19);
    
    return `${prefix}_metadata_${timestamp}.json`;
  }

  /**
   * Generate filename for geological model export
   * @param {string} prefix - Filename prefix
   * @returns {string} Formatted export filename with timestamp
   */
  static generateExportFilename(prefix = 'geotech_export') {
    const now = new Date();
    const timestamp = now.toISOString()
      .replace(/[:.]/g, '-')
      .replace('T', '_')
      .substring(0, 19);
    
    return `${prefix}_${timestamp}`;
  }
}