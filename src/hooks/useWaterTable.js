import { useEffect, useCallback, useMemo } from 'react';
import { useDisplayOptions } from '../contexts/DisplayOptionsContext';
import { useBoreholeData } from './useOptimizedBorehole';
import { useThreeJs } from '../contexts/ThreeJsContext';
import { Logger } from '../utils/Logger.js';

const logger = new Logger().withContext('useWaterTable');

export function useWaterTable() {
  const { showWaterTable } = useDisplayOptions();
  const { boreholes } = useBoreholeData();
  const { scene } = useThreeJs();

  /**
   * Get water table data from boreholes
   */
  const waterTableData = useMemo(() => {
    const waterTableBoreholes = boreholes.filter(bh => 
      bh.waterTableEncountered && 
      (bh.waterTableDepth !== null || bh.waterTableElevation !== null)
    );

    const dataPoints = waterTableBoreholes.map(bh => ({
      id: bh.id,
      x: bh.x || 0,
      y: bh.y || 0,
      z: bh.z || 0,
      depth: bh.waterTableDepth,
      elevation: bh.waterTableElevation,
      name: bh.name
    }));

    const statistics = dataPoints.length > 0 ? {
      count: dataPoints.length,
      minDepth: Math.min(...dataPoints.map(p => p.depth).filter(d => d !== null)),
      maxDepth: Math.max(...dataPoints.map(p => p.depth).filter(d => d !== null)),
      avgDepth: dataPoints.reduce((sum, p) => sum + (p.depth || 0), 0) / dataPoints.length,
      minElevation: Math.min(...dataPoints.map(p => p.elevation).filter(e => e !== null)),
      maxElevation: Math.max(...dataPoints.map(p => p.elevation).filter(e => e !== null))
    } : null;

    return {
      enabled: showWaterTable && dataPoints.length > 0,
      dataPoints,
      statistics,
      hasData: dataPoints.length > 0
    };
  }, [boreholes, showWaterTable]);

  /**
   * Update water table markers visibility in the scene
   */
  const updateWaterTableVisibility = useCallback(() => {
    if (!scene) return;

    let markersFound = 0;
    let markersUpdated = 0;

    scene.traverse((object) => {
      if (object.userData?.type === 'water_table') {
        markersFound++;
        
        const shouldBeVisible = showWaterTable && waterTableData.enabled;
        
        if (object.visible !== shouldBeVisible) {
          object.visible = shouldBeVisible;
          markersUpdated++;
        }
      }
    });

    if (markersUpdated > 0) {

    }
  }, [scene, showWaterTable, waterTableData.enabled]);

  /**
   * Apply water table settings to existing markers
   */
  const updateWaterTableSettings = useCallback((settings = {}) => {
    if (!scene) return;

    const {
      opacity = 0.7,
      color = '#1976D2',
      showContours = true,
      visible = true
    } = settings;

    let markersUpdated = 0;

    scene.traverse((object) => {
      if (object.userData?.type === 'water_table') {
        // Update water surface material
        object.traverse((child) => {
          if (child.isMesh && child.material) {
            if (child.name?.includes('water_surface')) {
              child.material.opacity = opacity;
              child.material.transparent = opacity < 1.0;
              if (child.material.color) {
                child.material.color.setStyle(color);
              }
              child.material.needsUpdate = true;
            }
            
            if (child.name?.includes('level_line') || child.name?.includes('border')) {
              child.visible = showContours;
            }
          }
        });

        object.visible = visible && showWaterTable;
        markersUpdated++;
      }
    });

    if (markersUpdated > 0) {

    }
  }, [scene, showWaterTable]);

  /**
   * Create interpolated water table surface (future enhancement)
   */
  const createWaterTableSurface = useCallback(async (options = {}) => {
    if (!waterTableData.hasData || waterTableData.dataPoints.length < 3) {
      return null;
    }

    const {
      resolution = 20,
      extent = { width: 40, depth: 40 },
      interpolationMethod = 'idw'
    } = options;

    try {
      // This would use spatial interpolation to create a water table surface
      // For now, return a placeholder that indicates the capability exists

      // TODO: Implement water table surface interpolation
      // const surface = await WaterTableInterpolator.createSurface(waterTableData.dataPoints, {
      //   resolution,
      //   extent,
      //   method: interpolationMethod
      // });

      return {
        ready: false,
        message: 'Water table surface interpolation will be implemented in a future update',
        dataPoints: waterTableData.dataPoints.length,
        method: interpolationMethod
      };

    } catch (error) {
      logger.error('Failed to create water table surface:', error);
      return null;
    }
  }, [waterTableData]);

  /**
   * Get water table interpolation recommendations
   */
  const getInterpolationRecommendations = useCallback(() => {
    const { dataPoints, statistics } = waterTableData;
    
    if (!statistics) {
      return {
        canInterpolate: false,
        message: 'No water table data available',
        recommendations: []
      };
    }

    const recommendations = [];
    let canInterpolate = false;

    if (dataPoints.length < 3) {
      recommendations.push(`Need at least 3 boreholes with water table data (currently ${dataPoints.length})`);
    } else if (dataPoints.length >= 3 && dataPoints.length < 5) {
      recommendations.push('3-4 points: Basic triangulation available');
      canInterpolate = true;
    } else if (dataPoints.length >= 5) {
      recommendations.push(`${dataPoints.length} points: Full spatial interpolation available`);
      recommendations.push('Consider using Kriging method for best results');
      canInterpolate = true;
    }

    const depthVariation = statistics.maxDepth - statistics.minDepth;
    if (depthVariation > 5) {
      recommendations.push('High variation in water table depth - check data accuracy');
    } else if (depthVariation < 0.5) {
      recommendations.push('Very consistent water table - suitable for simple interpolation');
    }

    return {
      canInterpolate,
      dataPointCount: dataPoints.length,
      depthVariation: depthVariation.toFixed(2),
      recommendations,
      statistics
    };
  }, [waterTableData]);

  // Update visibility when settings change
  useEffect(() => {
    updateWaterTableVisibility();
  }, [updateWaterTableVisibility]);

  return {
    waterTableData,
    showWaterTable,
    updateWaterTableVisibility,
    updateWaterTableSettings,
    createWaterTableSurface,
    getInterpolationRecommendations
  };
}

export default useWaterTable;