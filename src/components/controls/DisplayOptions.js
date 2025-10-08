
import React from 'react';
import { useDisplayOptions } from '../../contexts/DisplayOptionsContext';
import { useLayers } from '../../contexts/LayersContext';
import { useBoreholes } from '../../contexts/BoreholeContext';
import { useGeologicalModeling } from '../../contexts/OptimizedGeologicalModelingContext';
import { StandardFormGroup } from '../ui/StandardForm';

/**
 * DisplayOptions component providing visibility controls for 3D scene elements
 * @component
 * @returns {JSX.Element} The display options control panel
 */
const DisplayOptions = () => {
  const {
    showGroundGrid, setShowGroundGrid,
    showStrata, setShowStrata,
    showLabels, setShowLabels,
    showDepthMarkers, setShowDepthMarkers,
    showBoreholes, toggleGlobalBoreholeVisibility,
    showBoreholeStrata, setShowBoreholeStrata,
    showWaterTable, setShowWaterTable
  } = useDisplayOptions();
  
  const { layers } = useLayers();
  const { boreholes } = useBoreholes();
  const { prototypeResult } = useGeologicalModeling();
  
  // Check for either basic layers OR volumetric model data
  const hasLayers = layers.length > 0;
  const hasVolumetricModel = prototypeResult?.type === 'volumetric' && prototypeResult?.volumes?.length > 0;
  const hasStrataData = hasLayers || hasVolumetricModel;
  const hasBoreholes = boreholes.length > 0;

  return (
    <div className="space-y-3">
      <StandardFormGroup>
        <label className="checkbox-label flex items-center gap-2">
          <input
            type="checkbox"
            checked={showGroundGrid}
            onChange={(e) => setShowGroundGrid(e.target.checked)}
            className="checkbox"
            aria-label="Show ground grid checkbox"
          />
          <span className="text-sm">Show Ground Grid</span>
        </label>
      </StandardFormGroup>
      
      <StandardFormGroup>
        <label className={`checkbox-label flex items-center gap-2 ${!hasStrataData ? 'opacity-50' : ''}`}>
          <input
            type="checkbox"
            checked={showStrata}
            onChange={(e) => setShowStrata(e.target.checked)}
            className="checkbox"
            aria-label="Show strata model checkbox"
            disabled={!hasStrataData}
            title={!hasStrataData ? "Create layers or generate volumetric model first" : ""}
          />
          <span className="text-sm">Show Strata Model</span>
        </label>
      </StandardFormGroup>
      
      <StandardFormGroup>
        <label className={`checkbox-label flex items-center gap-2 ${!hasStrataData ? 'opacity-50' : ''}`}>
          <input
            type="checkbox"
            checked={showLabels}
            onChange={(e) => setShowLabels(e.target.checked)}
            className="checkbox"
            aria-label="Show layer labels checkbox"
            disabled={!hasStrataData}
            title={!hasStrataData ? "Create layers or generate volumetric model first" : ""}
          />
          <span className="text-sm">Show Layer Labels</span>
        </label>
      </StandardFormGroup>
      
      <StandardFormGroup>
        <label className={`checkbox-label flex items-center gap-2 ${!hasStrataData ? 'opacity-50' : ''}`}>
          <input
            type="checkbox"
            checked={showDepthMarkers}
            onChange={(e) => setShowDepthMarkers(e.target.checked)}
            className="checkbox"
            aria-label="Show depth scale checkbox"
            disabled={!hasStrataData}
            title={!hasStrataData ? "Create layers or generate volumetric model first" : ""}
          />
          <span className="text-sm">Show Depth Scale</span>
        </label>
      </StandardFormGroup>
      
      <StandardFormGroup>
        <label className={`checkbox-label flex items-center gap-2 ${!hasBoreholes ? 'opacity-50' : ''}`}>
          <input
            type="checkbox"
            checked={showBoreholes}
            onChange={(e) => toggleGlobalBoreholeVisibility(e.target.checked)}
            className="checkbox"
            aria-label="Show all boreholes checkbox"
            disabled={!hasBoreholes}
            title={!hasBoreholes ? "No boreholes to display" : ""}
          />
          <span className="text-sm">Show All Boreholes</span>
        </label>
      </StandardFormGroup>
      
      <StandardFormGroup>
        <label className={`checkbox-label flex items-center gap-2 ${!hasBoreholes || !hasStrataData ? 'opacity-50' : ''}`}>
          <input
            type="checkbox"
            checked={showBoreholeStrata}
            onChange={(e) => setShowBoreholeStrata(e.target.checked)}
            className="checkbox"
            aria-label="Show borehole strata checkbox"
            disabled={!hasBoreholes || !hasStrataData}
            title={!hasBoreholes ? "No boreholes to display" : !hasStrataData ? "Create layers or generate volumetric model first" : "Toggle soil strata visualization around boreholes"}
          />
          <span className="text-sm">Show Borehole Strata</span>
        </label>
      </StandardFormGroup>
      
      <StandardFormGroup>
        <label className={`checkbox-label flex items-center gap-2 ${!hasBoreholes ? 'opacity-50' : ''}`}>
          <input
            type="checkbox"
            checked={showWaterTable}
            onChange={(e) => setShowWaterTable(e.target.checked)}
            className="checkbox"
            aria-label="Show water table indicators checkbox"
            disabled={!hasBoreholes}
            title={!hasBoreholes ? "No boreholes to display" : "Toggle water table indicators for boreholes"}
          />
          <span className="text-sm">Show Water Table</span>
        </label>
      </StandardFormGroup>
    </div>
  );
};

export default DisplayOptions;