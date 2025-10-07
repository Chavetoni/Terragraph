// src/components/panels/LegendSection.js
import React from 'react';
import UnifiedAccordion from '../ui/UnifiedAccordion';
import LegendItem from '../ui/LegendItem';
import BoreholeLegendItem from '../ui/BoreholeLegendItem';
import { useLayers } from '../../contexts/LayersContext';
import { useBoreholes } from '../../contexts/BoreholeContext';

const LegendSection = ({ isOpen, onToggle }) => {
  const { layers } = useLayers();
  const { boreholes } = useBoreholes();

  return (
    <UnifiedAccordion
      title="Legend"
      isOpen={isOpen}
      onToggle={onToggle}
      badge={`${layers.length + boreholes.length} items`}
      badgeType="optional"
    >
      {/* Soil Layers Section */}
      {layers.length > 0 && (
        <div>
          <h4 className="editor-sub-section-title">Soil Layers</h4>
          {layers.map((layer, index) => (
            <LegendItem 
              key={layer.id || `legend-${index}`} 
              layer={layer} 
              index={index} 
            />
          ))}
        </div>
      )}

      {/* Boreholes Section */}
      {boreholes.length > 0 && (
        <div style={{ marginTop: layers.length > 0 ? '15px' : '0' }}>
          <h4 className="editor-sub-section-title">Boreholes</h4>
          {boreholes.map((borehole, index) => (
            <BoreholeLegendItem 
              key={borehole.id || `borehole-legend-${index}`} 
              borehole={borehole} 
              index={index} 
            />
          ))}
        </div>
      )}

      {/* Empty state */}
      {layers.length === 0 && boreholes.length === 0 && (
        <div style={{ 
          color: 'var(--text-secondary)', 
          textAlign: 'center', 
          padding: '20px',
          fontStyle: 'italic' 
        }}>
          <p style={{ margin: '0' }}>
            No layers or boreholes to display in legend.
          </p>
        </div>
      )}
    </UnifiedAccordion>
  );
};

export default LegendSection;