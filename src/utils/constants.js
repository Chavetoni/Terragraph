// src/utils/constants.js

// Rendering constants
export const BASE_DIMENSION_FOR_SCALING = 5;
export const GROUND_GRID_SIZE = 100;
export const GROUND_GRID_DIVISIONS = 50;

// Label styling constants
export const BASE_LABEL_FONT_SIZE = 18;
export const BASE_LABEL_PADDING = 8;
export const BASE_LABEL_MAX_WIDTH = 220;
export const BASE_LABEL_BORDER_RADIUS = 4;
export const BASE_SPRITE_SCALE_FACTOR = 0.012;

// Marker styling constants
export const BASE_MARKER_RADIUS = 0.20;
export const BASE_MARKER_TEXT_CANVAS_SIZE = 64;
export const BASE_MARKER_FONT_SIZE = 30;

// Depth marker constants
export const BASE_DEPTH_LABEL_FONT_SIZE = 18;
export const BASE_DEPTH_LABEL_PADDING = 4;
export const BASE_DEPTH_LABEL_PLANE_SCALE = 0.012;
export const BASE_DEPTH_MARKER_MAIN_LINE_OFFSET = 0.5;
export const BASE_DEPTH_MARKER_TICK_LENGTH = 0.25;
export const BASE_DEPTH_MARKER_TEXT_GAP = 0.08;

// Default soil types
export const DEFAULT_SOIL_TYPES = [
  {
    name: "Topsoil",
    color: "#3b2e1e",
    description: "Dark, fertile surface layer with organic matter"
  },
  {
    name: "Clay Layer",
    color: "#5e4b37",
    description: "Dense, water-retaining layer with fine particles"
  },
  {
    name: "Sandy Layer",
    color: "#9b8569",
    description: "Loose, granular texture with good drainage"
  },
  {
    name: "Bedrock",
    color: "#c4c4c4",
    description: "Solid rock layer beneath soil horizons"
  },
  {
    name: "Gravelly Soil",
    color: "#a1917e",
    description: "Contains many small stones and pebbles"
  }
];

// View modes
export const VIEW_MODES = {
  NORMAL: 'normal',
  EXPLODED: 'exploded'
};

// Default values
export const DEFAULT_VERTICAL_SPACING = 0.5;
export const DEFAULT_STRATA_DIMENSIONS = { width: 5, depth: 5 };
export const DEFAULT_LAYER_DEPTH = 1.0;
export const MAX_LAYERS = 20;