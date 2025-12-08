import React from 'react';
import { Layers, Globe, Activity } from 'lucide-react';
import { useDisplayOptions } from '../../contexts/DisplayOptionsContext';
import { useLayers } from '../../contexts/LayersContext';
import { useBoreholes } from '../../contexts/BoreholeContext';
import { useGeologicalModeling } from '../../contexts/GeologicalModelingContext';
import './DisplayOptions.css';

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
    showWaterTable, setShowWaterTable,
    showSiteMap, setShowSiteMap
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
    <div className="display-options-container">
      {/* Global Settings Card */}
      <div className="display-card">
        <h4 className="display-card-header">
          <Globe size={18} className="header-icon" />
          <span>Global View</span>
        </h4>
        <div className="display-options-list">
          <label className="display-option-item">
            <span className="option-label">Ground Grid</span>
            <div className={`toggle-switch ${showGroundGrid ? 'active' : ''}`} onClick={() => setShowGroundGrid(!showGroundGrid)}>
              <div className="toggle-thumb"></div>
            </div>
          </label>

          <label className="display-option-item">
            <span className="option-label">Site Map</span>
            <div className={`toggle-switch ${showSiteMap ? 'active' : ''}`} onClick={() => setShowSiteMap(!showSiteMap)}>
              <div className="toggle-thumb"></div>
            </div>
          </label>
        </div>
      </div>

      {/* Geological Model Card */}
      <div className={`display-card ${!hasStrataData ? 'disabled' : ''}`}>
        <h4 className="display-card-header">
          <Layers size={18} className="header-icon" />
          <span>Geological Model</span>
        </h4>
        <div className="display-options-list">
          <label className="display-option-item">
            <span className="option-label">Strata Layers</span>
            <div className={`toggle-switch ${showStrata ? 'active' : ''}`} onClick={() => setShowStrata(!showStrata)}>
              <div className="toggle-thumb"></div>
            </div>
          </label>

          <label className="display-option-item">
            <span className="option-label">Layer Labels</span>
            <div className={`toggle-switch ${showLabels ? 'active' : ''}`} onClick={() => setShowLabels(!showLabels)}>
              <div className="toggle-thumb"></div>
            </div>
          </label>

          <label className="display-option-item">
            <span className="option-label">Depth Scale</span>
            <div className={`toggle-switch ${showDepthMarkers ? 'active' : ''}`} onClick={() => setShowDepthMarkers(!showDepthMarkers)}>
              <div className="toggle-thumb"></div>
            </div>
          </label>
        </div>
      </div>

      {/* Borehole Data Card */}
      <div className={`display-card ${!hasBoreholes ? 'disabled' : ''}`}>
        <h4 className="display-card-header">
          <Activity size={18} className="header-icon" />
          <span>Borehole Data</span>
        </h4>
        <div className="display-options-list">
          <label className="display-option-item">
            <span className="option-label">Borehole Markers</span>
            <div className={`toggle-switch ${showBoreholes ? 'active' : ''}`} onClick={() => toggleGlobalBoreholeVisibility(!showBoreholes)}>
              <div className="toggle-thumb"></div>
            </div>
          </label>

          <label className="display-option-item">
            <span className="option-label">Borehole Strata</span>
            <div className={`toggle-switch ${showBoreholeStrata ? 'active' : ''}`} onClick={() => setShowBoreholeStrata(!showBoreholeStrata)}>
              <div className="toggle-thumb"></div>
            </div>
          </label>

          <label className="display-option-item">
            <span className="option-label">Water Table</span>
            <div className={`toggle-switch ${showWaterTable ? 'active' : ''}`} onClick={() => setShowWaterTable(!showWaterTable)}>
              <div className="toggle-thumb"></div>
            </div>
          </label>
        </div>
      </div>
    </div>
  );
};

export default DisplayOptions;