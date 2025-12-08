// src/components/panels/LegendSection.js
import React from 'react';
import PanelSection from '../ui/PanelSection';
import LegendItem from '../ui/LegendItem';
import BoreholeLegendItem from '../ui/BoreholeLegendItem';
import { useLayers } from '../../contexts/LayersContext';
import { useBoreholes } from '../../contexts/BoreholeContext';

const LegendSection = ({ isOpen, onToggle }) => {
  const { layers } = useLayers();
  const { boreholes } = useBoreholes();

  // Filter visible layers for legend
  const visibleLayers = layers.filter(l => l.visible !== false);
  const hasItems = visibleLayers.length > 0 || boreholes.length > 0;

  return (
    <PanelSection
      title="Legend"
      isOpen={isOpen}
      onToggle={onToggle}
    >
      {hasItems ? (
        <div className="legend-content">
          {/* Soil Layers Section */}
          {visibleLayers.length > 0 && (
            <div>
              <h4 className="legend-subtitle">Soil Layers</h4>
              {visibleLayers.map((layer, index) => (
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
            <div style={{ marginTop: visibleLayers.length > 0 ? '15px' : '0' }}>
              <h4 className="legend-subtitle">Boreholes</h4>
              {boreholes.map((borehole, index) => (
                <BoreholeLegendItem
                  key={borehole.id || `borehole-legend-${index}`}
                  borehole={borehole}
                  index={index}
                />
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="empty-legend">
          <p className="empty-title">No active layers</p>
          <p className="empty-subtitle">Toggle layers visibility to populate legend</p>
        </div>
      )}

      <style jsx>{`
        .legend-content {
          max-height: 350px;
          overflow-y: auto;
          overflow-x: hidden;
          padding-right: 8px;
          scrollbar-width: thin;
          scrollbar-color: rgba(255, 255, 255, 0.15) transparent;
        }

        .legend-content::-webkit-scrollbar {
          width: 6px;
        }

        .legend-content::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.02);
          border-radius: 3px;
        }

        .legend-content::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.12);
          border-radius: 3px;
        }

        .legend-content::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.25);
        }

        .legend-subtitle {
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--text-secondary);
          margin: 0 0 8px 0;
          position: sticky;
          top: 0;
          background: var(--bg-panel, #1a1a1a);
          padding: 4px 0;
          z-index: 1;
        }

        .empty-legend {
          border: 1px dashed var(--border-highlight);
          border-radius: 8px;
          padding: 32px 16px;
          text-align: center;
          background: rgba(255, 255, 255, 0.02);
          margin: 8px 0;
        }

        .empty-title {
          color: var(--text-secondary);
          font-style: italic;
          margin: 0 0 4px 0;
          font-size: 14px;
        }

        .empty-subtitle {
          color: var(--text-muted);
          font-size: 12px;
          margin: 0;
        }
      `}</style>
    </PanelSection>
  );
};

export default LegendSection;