// src/components/controls/BoreholeControls.js
import React from 'react';
import { useBoreholes } from '../../contexts/BoreholeContext';
import { useDisplayOptions } from '../../contexts/DisplayOptionsContext';
import BoreholeListItem from '../ui/BoreholeListItem';
import StandardButton from '../ui/StandardButton';
import './BoreholeControls.css';

const BoreholeControls = () => {
  const { boreholes, isPlacingBorehole, setIsPlacingBorehole, removeBorehole } = useBoreholes();
  const { 
    showBoreholes, 
    boreholesIndividualVisibility, 
    toggleIndividualBoreholeVisibility,
    showBoreholeStrata,
    getBoreholeStrataVisibility,
    toggleBoreholeStrataVisibility
  } = useDisplayOptions();
  return (
    <div className="borehole-controls-container">
      <div className="placement-button-container">
        <StandardButton
          variant={isPlacingBorehole ? 'danger' : 'primary'}
          onClick={() => setIsPlacingBorehole(prev => !prev)}
          fullWidth
        >
          {isPlacingBorehole ? "Cancel Placement" : "Place New Borehole"}
        </StandardButton>

        <div className={`placement-instruction ${isPlacingBorehole ? 'active' : ''}`}>
          <span className="placement-instruction-icon">{isPlacingBorehole ? '👆' : '💡'}</span>
          {isPlacingBorehole
            ? "Click anywhere on the 3D canvas to place a borehole at that location."
            : "Click the button above, then click on the 3D view to place a borehole."}
        </div>
      </div>

      {boreholes.length > 0 && (
        <div className="borehole-list-section">
          <div className="borehole-section-header">
            <div className="borehole-section-title-container">
              <svg className="borehole-section-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              <h4 className="borehole-section-title">Boreholes</h4>
            </div>
            <span className="borehole-count-badge">{boreholes.length}</span>
          </div>

          <div className="borehole-list-scroll-container">
            <div className="borehole-items-list">
              {boreholes.map(bh => {
                const individualVisible = boreholesIndividualVisibility.get(bh.id);
                const isIndividualVisible = individualVisible !== undefined ? individualVisible : true;
                const isStrataVisible = getBoreholeStrataVisibility(bh.id);

                return (
                  <BoreholeListItem
                    key={bh.id}
                    borehole={bh}
                    onDelete={(borehole) => removeBorehole(borehole.id)}
                    showGlobalVisible={showBoreholes}
                    isIndividualVisible={isIndividualVisible}
                    onToggleVisibility={toggleIndividualBoreholeVisibility}
                    showBoreholeStrata={showBoreholeStrata}
                    isStrataVisible={isStrataVisible}
                    onToggleStrataVisibility={toggleBoreholeStrataVisibility}
                  />
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BoreholeControls;