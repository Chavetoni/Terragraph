import React from 'react';

// Material types definition (matches BoreholeLayerEditor exactly)
const MATERIAL_TYPES = {
  CLAY: { name: 'Clay', color: '#8B4513', description: 'Fine-grained cohesive soil' },
  SAND: { name: 'Sand', color: '#F4A460', description: 'Granular non-cohesive soil' },
  GRAVEL: { name: 'Gravel', color: '#A0522D', description: 'Coarse granular material' },
  ROCK: { name: 'Rock', color: '#708090', description: 'Solid rock formation' },
  SILT: { name: 'Silt', color: '#DEB887', description: 'Fine-grained intermediate soil' },
  ORGANIC: { name: 'Organic', color: '#654321', description: 'Organic rich soil' },
  FILL: { name: 'Fill', color: '#D2691E', description: 'Engineered fill material' }
};

const LayerPreview = ({ layers, totalDepth }) => {
  const depthValue = parseFloat(totalDepth) || 10;
  
  // Calculate layer percentages and handle gaps
  const processedLayers = [];
  let currentDepth = 0;
  
  layers.forEach((layer, index) => {
    const from = layer.from || layer.depthFrom || 0;
    const to = layer.to || layer.depthTo || 0;
    
    // Add gap if there's one
    if (from > currentDepth) {
      processedLayers.push({
        type: 'gap',
        from: currentDepth,
        to: from,
        percentage: ((from - currentDepth) / depthValue) * 100,
        material: 'UNKNOWN'
      });
    }
    
    // Add the actual layer
    if (to > from) {
      processedLayers.push({
        type: 'layer',
        from,
        to,
        percentage: ((to - from) / depthValue) * 100,
        material: layer.material,
        index: index + 1
      });
      currentDepth = to;
    }
  });
  
  // Add final gap if needed
  if (currentDepth < depthValue) {
    processedLayers.push({
      type: 'gap',
      from: currentDepth,
      to: depthValue,
      percentage: ((depthValue - currentDepth) / depthValue) * 100,
      material: 'UNKNOWN'
    });
  }
  
  return (
    <div className="layer-preview-panel-inner">
      <h4 className="preview-title">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" className="preview-icon">
          <path d="M2 2h12v12H2V2zm1 1v10h10V3H3zm2 2h6v1H5V5zm0 2h6v1H5V7zm0 2h6v1H5V9zm0 2h4v1H5v-1z"/>
        </svg>
        Soil Profile Preview
      </h4>
      
      <div className="preview-content">
        {layers.length === 0 ? (
          <div className="preview-empty-state">
            <svg width="64" height="64" viewBox="0 0 64 64" fill="currentColor" opacity="0.2">
              <path d="M16 16h32v4H16zm0 8h32v4H16zm0 8h32v4H16zm0 8h32v4H16z"/>
            </svg>
            <p className="empty-text">No layers defined</p>
            <p className="empty-hint">Add layers to see the soil profile</p>
          </div>
        ) : (
          <div className="preview-container">
            <div className="profile-column">
              {processedLayers.map((layer, index) => {
                const material = layer.material === 'UNKNOWN' ? 
                  { name: 'Gap', color: '#1a1a1a', pattern: 'dashed' } : 
                  MATERIAL_TYPES[layer.material];
                
                return (
                  <div 
                    key={index} 
                    className={`profile-layer ${layer.type}`}
                    style={{ 
                      height: `${layer.percentage}%`,
                      backgroundColor: material.color,
                      borderStyle: material.pattern || 'solid'
                    }}
                    data-tooltip={`${material.name} (${layer.from.toFixed(1)}-${layer.to.toFixed(1)}m)`}
                  >
                    {layer.percentage > 15 && (
                      <div className="layer-info">
                        <span className="layer-material">{material.name}</span>
                        <span className="layer-depth">{(layer.to - layer.from).toFixed(1)}m</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LayerPreview;