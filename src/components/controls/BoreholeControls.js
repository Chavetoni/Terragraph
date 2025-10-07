// src/components/controls/BoreholeControls.js
import React from 'react';
import { useBoreholes } from '../../contexts/BoreholeContext';
import { useDisplayOptions } from '../../contexts/DisplayOptionsContext';
import BoreholeListItem from '../ui/BoreholeListItem';
import StandardButton from '../ui/StandardButton';

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
    <div className="space-y-4">
      <StandardButton
        variant={isPlacingBorehole ? 'danger' : 'primary'}
        onClick={() => setIsPlacingBorehole(prev => !prev)}
        fullWidth
      >
        {isPlacingBorehole ? "Cancel Placement (Click Canvas)" : "Place Borehole by Click"}
      </StandardButton>
      
      <p className="text-xs text-gray-600 text-center mx-1 my-2">
        {isPlacingBorehole
          ? "Click on the map/grid to place a borehole."
          : "Toggle 'Place Borehole' then click on the 3D view."}
      </p>
      
      {boreholes.length > 0 && (
        <div className="mb-5">
          <h4 className="editor-sub-section-title">Existing Boreholes</h4>
          <div className="max-h-96 overflow-y-auto pr-1">
            <div className="flex flex-col gap-2">
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