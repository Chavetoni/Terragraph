// src/utils/scaleConstants.js

// Unified scaling system for geological visualization
// Base unit: 1 Three.js unit = 1 foot in real world
// Display units: All measurements shown to users are in feet

export const SCALE = {
  // Grid and site boundaries
  SITE_SIZE: 164,             // 164ft x 164ft site area (50m)
  GRID_DIVISIONS: 50,         // Grid line every 3.28ft (1m)
  
  // Strata layers
  DEFAULT_STRATA_WIDTH: 131,  // 131ft wide (40m)
  DEFAULT_STRATA_DEPTH: 131,  // 131ft deep (40m)
  MIN_LAYER_THICKNESS: 1.64,  // Minimum 1.64ft thick layers (0.5m)
  
  // Boreholes
  BOREHOLE_DIAMETER: 0.49,    // 0.49ft diameter (15cm - realistic)
  SURFACE_MARKER_RADIUS: 1.31, // 1.31ft radius marker (40cm)
  SURFACE_MARKER_HEIGHT: 2.62, // 2.62ft tall marker (80cm)
  
  // Labels and UI
  LABEL_SIZE: 6.56,           // 6.56ft wide labels (2m)
  LABEL_HEIGHT: 1.64,         // 1.64ft tall labels (0.5m)
  DEPTH_MARKER_SIZE: 4.92,    // 4.92ft wide depth markers (1.5m)
  DEPTH_MARKER_HEIGHT: 0.98,  // 0.98ft tall depth markers (0.3m)
  
  // Depth scale
  DEPTH_SCALE_INTERVAL: 16.4, // Mark every 16.4ft depth (5m)
  DEPTH_SCALE_LINE_LENGTH: 4.92, // 4.92ft long lines (1.5m)
  DEPTH_SCALE_OFFSET: 82,     // 82ft from center (25m)
  
  // Layer markers
  LAYER_MARKER_RADIUS: 0.33,  // 0.33ft radius markers (10cm)
  LAYER_MARKER_SPACING: 6.56,  // Every 6.56ft around perimeter (2m)
  
  // Camera and view
  CAMERA_DISTANCE: 197,       // 197ft from origin (60m)
  CAMERA_HEIGHT: 98,          // 98ft above ground (30m)
};

// Helper functions for consistent scaling
export const getStrataDimensions = () => ({
  width: SCALE.DEFAULT_STRATA_WIDTH,
  depth: SCALE.DEFAULT_STRATA_DEPTH,
  height: SCALE.MIN_LAYER_THICKNESS
});

export const getBoreholeDimensions = () => ({
  diameter: SCALE.BOREHOLE_DIAMETER,
  markerRadius: SCALE.SURFACE_MARKER_RADIUS,
  markerHeight: SCALE.SURFACE_MARKER_HEIGHT
});

export const getLabelDimensions = () => ({
  width: SCALE.LABEL_SIZE,
  height: SCALE.LABEL_HEIGHT
});

export const getDepthMarkerDimensions = () => ({
  width: SCALE.DEPTH_MARKER_SIZE,
  height: SCALE.DEPTH_MARKER_HEIGHT,
  lineLength: SCALE.DEPTH_SCALE_LINE_LENGTH,
  offset: SCALE.DEPTH_SCALE_OFFSET,
  interval: SCALE.DEPTH_SCALE_INTERVAL
});