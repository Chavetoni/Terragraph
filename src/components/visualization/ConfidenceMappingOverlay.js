import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useGeologicalModeling } from '../../contexts/GeologicalModelingContext';
import { BufferGeometry, Color, DoubleSide, Group, Line, LineBasicMaterial, Mesh, MeshBasicMaterial, PlaneGeometry, Vector3 } from 'three';
import { Logger } from '../../utils/Logger.js';

const logger = new Logger().withContext('ConfidenceMappingOverlay');

export function ConfidenceMappingOverlay({ geologicalModel, scene, enabled = true }) {
  const { modelingSettings } = useGeologicalModeling();
  const [confidenceOverlay, setConfidenceOverlay] = useState(null);
  const [confidenceStats, setConfidenceStats] = useState(null);
  const [overlayMode, setOverlayMode] = useState('heatmap'); // 'heatmap', 'contours', 'discrete'
  const [selectedLayer, setSelectedLayer] = useState('all');

  // Confidence level thresholds and colors
  const confidenceThresholds = useMemo(() => ({
    excellent: { min: 0.9, color: '#22c55e', label: 'Excellent (>90%)' },
    high: { min: 0.8, color: '#84cc16', label: 'High (80-90%)' },
    good: { min: 0.6, color: '#eab308', label: 'Good (60-80%)' },
    medium: { min: 0.4, color: '#f97316', label: 'Medium (40-60%)' },
    low: { min: 0.2, color: '#ef4444', label: 'Low (20-40%)' },
    poor: { min: 0.0, color: '#991b1b', label: 'Poor (<20%)' }
  }), []);

  // Calculate confidence statistics
  const calculateConfidenceStats = useCallback((model) => {
    if (!model || !model.interpolationStats?.enableConfidenceMapping) {
      return null;
    }

    const stats = {
      totalPoints: 0,
      averageConfidence: 0,
      confidenceDistribution: {
        excellent: 0,
        high: 0,
        good: 0,
        medium: 0,
        low: 0,
        poor: 0
      },
      layerStats: new Map()
    };

    let totalConfidence = 0;
    let pointCount = 0;

    // Process each layer
    if (model.layers) {
      model.layers.forEach(layer => {
        if (layer.interpolationQuality && layer.interpolationQuality.avgConfidence !== undefined) {
          const layerStats = {
            avgConfidence: layer.interpolationQuality.avgConfidence,
            minConfidence: layer.interpolationQuality.minConfidence,
            maxConfidence: layer.interpolationQuality.maxConfidence,
            confidencePoints: layer.interpolationQuality.confidencePoints || 0
          };

          stats.layerStats.set(layer.material, layerStats);

          // Add to overall statistics
          totalConfidence += layer.interpolationQuality.avgConfidence * layerStats.confidencePoints;
          pointCount += layerStats.confidencePoints;

          // Categorize confidence level
          const confidence = layer.interpolationQuality.avgConfidence;
          if (confidence >= 0.9) stats.confidenceDistribution.excellent++;
          else if (confidence >= 0.8) stats.confidenceDistribution.high++;
          else if (confidence >= 0.6) stats.confidenceDistribution.good++;
          else if (confidence >= 0.4) stats.confidenceDistribution.medium++;
          else if (confidence >= 0.2) stats.confidenceDistribution.low++;
          else stats.confidenceDistribution.poor++;
        }
      });
    }

    if (pointCount > 0) {
      stats.totalPoints = pointCount;
      stats.averageConfidence = totalConfidence / pointCount;
    }

    return stats;
  }, []);

  // Create confidence overlay visualization
  const createConfidenceOverlay = useCallback((model, mode) => {
    if (!model || !scene || !enabled) return null;

    const overlayGroup = new Group();
    overlayGroup.name = 'ConfidenceMappingOverlay';

    try {
      switch (mode) {
        case 'heatmap':
          return createHeatmapOverlay(model, overlayGroup);
        case 'contours':
          return createContoursOverlay(model, overlayGroup);
        case 'discrete':
          return createDiscreteOverlay(model, overlayGroup);
        default:
          return createHeatmapOverlay(model, overlayGroup);
      }
    } catch (error) {
      logger.error('Failed to create confidence overlay:', error);
      return null;
    }
  }, [scene, enabled, confidenceThresholds]);

  // Create heatmap-style confidence overlay
  const createHeatmapOverlay = useCallback((model, overlayGroup) => {
    if (!model.siteExtent) return overlayGroup;

    const { minX, maxX, minY, maxY } = model.siteExtent;
    const gridSize = 20; // 20x20 grid for smooth visualization
    const cellWidth = (maxX - minX) / gridSize;
    const cellHeight = (maxY - minY) / gridSize;

    // Create confidence grid
    for (let i = 0; i < gridSize; i++) {
      for (let j = 0; j < gridSize; j++) {
        const x = minX + (i + 0.5) * cellWidth;
        const z = minY + (j + 0.5) * cellHeight;

        // Calculate confidence at this grid point
        const confidence = calculateConfidenceAtPoint(x, z, model);

        if (confidence !== null) {
          const color = getConfidenceColor(confidence);
          const geometry = new PlaneGeometry(cellWidth * 0.9, cellHeight * 0.9);
          const material = new MeshBasicMaterial({
            color: new Color(color),
            transparent: true,
            opacity: 0.6,
            side: DoubleSide
          });

          const mesh = new Mesh(geometry, material);
          mesh.position.set(x, 0.1, z); // Slightly above ground
          mesh.rotation.x = -Math.PI / 2; // Lay flat
          mesh.userData = {
            type: 'confidenceCell',
            confidence: confidence,
            confidenceLevel: getConfidenceLevel(confidence)
          };

          overlayGroup.add(mesh);
        }
      }
    }

    return overlayGroup;
  }, [confidenceThresholds]);

  // Create contour-style confidence overlay
  const createContoursOverlay = useCallback((model, overlayGroup) => {
    // Implementation for contour lines at confidence levels
    // This is a simplified version - full implementation would use marching squares

    const contourLevels = [0.2, 0.4, 0.6, 0.8, 0.9];

    contourLevels.forEach(level => {
      const color = getConfidenceColor(level);
      const contourGeometry = createContourGeometry(model, level);

      if (contourGeometry) {
        const material = new LineBasicMaterial({
          color: new Color(color),
          linewidth: 2,
          transparent: true,
          opacity: 0.8
        });

        const contourLine = new Line(contourGeometry, material);
        contourLine.userData = {
          type: 'confidenceContour',
          confidenceLevel: level
        };

        overlayGroup.add(contourLine);
      }
    });

    return overlayGroup;
  }, []);

  // Create discrete zone confidence overlay
  const createDiscreteOverlay = useCallback((model, overlayGroup) => {
    if (!model.siteExtent) return overlayGroup;

    // Create discrete confidence zones
    Object.entries(confidenceThresholds).forEach(([level, config]) => {
      const zoneGeometry = createConfidenceZoneGeometry(model, config.min);

      if (zoneGeometry) {
        const material = new MeshBasicMaterial({
          color: new Color(config.color),
          transparent: true,
          opacity: 0.4,
          side: DoubleSide
        });

        const zoneMesh = new Mesh(zoneGeometry, material);
        zoneMesh.position.y = 0.1;
        zoneMesh.userData = {
          type: 'confidenceZone',
          confidenceLevel: level,
          threshold: config.min
        };

        overlayGroup.add(zoneMesh);
      }
    });

    return overlayGroup;
  }, [confidenceThresholds]);

  // Helper function to calculate confidence at a point
  const calculateConfidenceAtPoint = useCallback((x, z, model) => {
    if (!model.layers) return null;

    // Find the closest interpolated points and average their confidence
    let totalConfidence = 0;
    let validLayers = 0;

    model.layers.forEach(layer => {
      if (layer.interpolationQuality?.avgConfidence !== undefined) {
        // In a real implementation, this would interpolate confidence from the mesh data
        // For now, use the layer average as a proxy
        totalConfidence += layer.interpolationQuality.avgConfidence;
        validLayers++;
      }
    });

    return validLayers > 0 ? totalConfidence / validLayers : null;
  }, []);

  // Get confidence color based on value
  const getConfidenceColor = useCallback((confidence) => {
    for (const [level, config] of Object.entries(confidenceThresholds)) {
      if (confidence >= config.min) {
        return config.color;
      }
    }
    return confidenceThresholds.poor.color;
  }, [confidenceThresholds]);

  // Get confidence level description
  const getConfidenceLevel = useCallback((confidence) => {
    for (const [level, config] of Object.entries(confidenceThresholds)) {
      if (confidence >= config.min) {
        return level;
      }
    }
    return 'poor';
  }, [confidenceThresholds]);

  // Simplified contour geometry creation
  const createContourGeometry = useCallback((model, level) => {
    // This is a placeholder - real implementation would use marching squares algorithm
    const points = [];

    // For demonstration, create a simple circular contour
    const centerX = (model.siteExtent.minX + model.siteExtent.maxX) / 2;
    const centerZ = (model.siteExtent.minY + model.siteExtent.maxY) / 2;
    const radius = Math.min(model.siteExtent.maxX - model.siteExtent.minX,
      model.siteExtent.maxY - model.siteExtent.minY) * 0.3 * level;

    for (let i = 0; i <= 32; i++) {
      const angle = (i / 32) * Math.PI * 2;
      points.push(new Vector3(
        centerX + Math.cos(angle) * radius,
        0.15, // Slightly above heatmap
        centerZ + Math.sin(angle) * radius
      ));
    }

    if (points.length > 0) {
      const geometry = new BufferGeometry().setFromPoints(points);
      return geometry;
    }

    return null;
  }, []);

  // Simplified confidence zone geometry creation
  const createConfidenceZoneGeometry = useCallback((model, threshold) => {
    // This is a placeholder - real implementation would create polygons based on confidence data
    // For now, return null to skip discrete zones
    return null;
  }, []);

  // Update overlay when model or settings change
  useEffect(() => {
    if (geologicalModel && enabled && modelingSettings.enableConfidenceMapping) {
      const stats = calculateConfidenceStats(geologicalModel);
      setConfidenceStats(stats);

      const overlay = createConfidenceOverlay(geologicalModel, overlayMode);
      setConfidenceOverlay(overlay);

      // Add to scene
      if (overlay && scene) {
        // Remove existing overlay
        const existingOverlay = scene.getObjectByName('ConfidenceMappingOverlay');
        if (existingOverlay) {
          scene.remove(existingOverlay);
        }

        scene.add(overlay);

      }
    } else {
      // Remove overlay if disabled
      if (scene) {
        const existingOverlay = scene.getObjectByName('ConfidenceMappingOverlay');
        if (existingOverlay) {
          scene.remove(existingOverlay);

        }
      }
      setConfidenceOverlay(null);
      setConfidenceStats(null);
    }
  }, [geologicalModel, enabled, modelingSettings.enableConfidenceMapping, overlayMode, scene, calculateConfidenceStats, createConfidenceOverlay]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (scene) {
        const existingOverlay = scene.getObjectByName('ConfidenceMappingOverlay');
        if (existingOverlay) {
          scene.remove(existingOverlay);
        }
      }
    };
  }, [scene]);

  if (!enabled || !modelingSettings.enableConfidenceMapping || !geologicalModel) {
    return null;
  }

  return (
    <div className="confidence-mapping-overlay">
      {/* Confidence Controls */}
      <div className="confidence-controls">
        <div className="control-group">
          <label>Visualization Mode:</label>
          <select
            value={overlayMode}
            onChange={(e) => setOverlayMode(e.target.value)}
            className="mode-select"
          >
            <option value="heatmap">Heatmap</option>
            <option value="contours">Contour Lines</option>
            <option value="discrete">Discrete Zones</option>
          </select>
        </div>

        {geologicalModel.layers && geologicalModel.layers.length > 1 && (
          <div className="control-group">
            <label>Layer:</label>
            <select
              value={selectedLayer}
              onChange={(e) => setSelectedLayer(e.target.value)}
              className="layer-select"
            >
              <option value="all">All Layers</option>
              {geologicalModel.layers.map(layer => (
                <option key={layer.material} value={layer.material}>
                  {layer.material}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Confidence Legend */}
      <div className="confidence-legend">
        <h4>Interpolation Confidence</h4>
        <div className="legend-items">
          {Object.entries(confidenceThresholds).map(([level, config]) => (
            <div key={level} className="legend-item">
              <div
                className="legend-color"
                style={{ backgroundColor: config.color }}
              ></div>
              <span>{config.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Confidence Statistics */}
      {confidenceStats && (
        <div className="confidence-statistics">
          <h4>Confidence Statistics</h4>
          <div className="stats-grid">
            <div className="stat-item">
              <span>Overall Confidence:</span>
              <span>{(confidenceStats.averageConfidence * 100).toFixed(1)}%</span>
            </div>
            <div className="stat-item">
              <span>Data Points:</span>
              <span>{confidenceStats.totalPoints.toLocaleString()}</span>
            </div>
            <div className="stat-item">
              <span>High Confidence Areas:</span>
              <span>{confidenceStats.confidenceDistribution.excellent + confidenceStats.confidenceDistribution.high} layers</span>
            </div>
            <div className="stat-item">
              <span>Low Confidence Areas:</span>
              <span>{confidenceStats.confidenceDistribution.low + confidenceStats.confidenceDistribution.poor} layers</span>
            </div>
          </div>
        </div>
      )}

      {/* Professional Interpretation */}
      {confidenceStats && (
        <div className="confidence-interpretation">
          <h4>Professional Interpretation</h4>
          <div className="interpretation-content">
            {confidenceStats.averageConfidence >= 0.8 ? (
              <div className="interpretation-item good">
                <strong>Excellent Model Reliability:</strong> High confidence across most areas.
                Model suitable for engineering design decisions.
              </div>
            ) : confidenceStats.averageConfidence >= 0.6 ? (
              <div className="interpretation-item medium">
                <strong>Good Model Reliability:</strong> Acceptable confidence levels.
                Consider additional borings in low-confidence areas for critical structures.
              </div>
            ) : (
              <div className="interpretation-item warning">
                <strong>Limited Model Reliability:</strong> Low confidence in many areas.
                Additional site investigation strongly recommended before design.
              </div>
            )}

            {confidenceStats.confidenceDistribution.poor > 0 && (
              <div className="interpretation-item warning">
                <strong>Areas of Concern:</strong> {confidenceStats.confidenceDistribution.poor} layer(s)
                with poor confidence. Additional borings recommended in these areas.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default ConfidenceMappingOverlay;