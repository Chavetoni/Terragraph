// src/components/ui/LegendItem.js
import React from 'react';

const LegendItem = ({ layer, index }) => {
  return (
    <div className="legend-item">
      <div
        className="legend-color-box"
        style={{ backgroundColor: layer.color }}
      />
      <div className="legend-text-container">
        <div className="legend-layer-name">
          {layer.name || `Layer ${index + 1}`}
        </div>
        <div className="legend-layer-description">
          {layer.description || 'No description'}
        </div>
        <div className="legend-layer-depth">
          Depth: {(parseFloat(layer.depth) || 1).toFixed(1)} ft
        </div>
      </div>
    </div>
  );
};

export default LegendItem;