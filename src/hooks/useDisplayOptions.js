// src/hooks/useDisplayOptions.js
import { useState, useCallback } from 'react';

export const useDisplayOptions = () => {
  const [showLayerPanel, setShowLayerPanel] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const [showMarkers, setShowMarkers] = useState(true);
  const [showDepthMarkers, setShowDepthMarkers] = useState(true);
  const [showConnectors, setShowConnectors] = useState(true);
  const [showStrata, setShowStrata] = useState(true);
  const [showGroundGrid, setShowGroundGrid] = useState(true);
  const [openSections, setOpenSections] = useState({
    siteMap: true,
    strataModel: true,
    layerEditor: true,
    boreholes: false,
    displayOptions: false,
    legend: false
  });

  const toggleSection = useCallback((sectionName) => {
    setOpenSections(prev => ({
      ...prev,
      [sectionName]: !prev[sectionName]
    }));
  }, []);

  const toggleOption = useCallback((option, value) => {
    switch (option) {
      case 'showLayerPanel':
        setShowLayerPanel(value !== undefined ? value : !showLayerPanel);
        break;
      case 'showLabels':
        setShowLabels(value !== undefined ? value : !showLabels);
        break;
      case 'showMarkers':
        setShowMarkers(value !== undefined ? value : !showMarkers);
        break;
      case 'showDepthMarkers':
        setShowDepthMarkers(value !== undefined ? value : !showDepthMarkers);
        break;
      case 'showConnectors':
        setShowConnectors(value !== undefined ? value : !showConnectors);
        break;
      case 'showStrata':
        setShowStrata(value !== undefined ? value : !showStrata);
        break;
      case 'showGroundGrid':
        setShowGroundGrid(value !== undefined ? value : !showGroundGrid);
        break;
      default:
        // Unknown option
    }
  }, [
    showLayerPanel,
    showLabels,
    showMarkers,
    showDepthMarkers,
    showConnectors,
    showStrata,
    showGroundGrid
  ]);

  const resetOptions = useCallback(() => {
    setShowLabels(true);
    setShowMarkers(true);
    setShowDepthMarkers(true);
    setShowConnectors(true);
    setShowStrata(true);
    setShowGroundGrid(true);
  }, []);

  return {
    showLayerPanel,
    setShowLayerPanel,
    showLabels,
    setShowLabels,
    showMarkers,
    setShowMarkers,
    showDepthMarkers,
    setShowDepthMarkers,
    showConnectors,
    setShowConnectors,
    showStrata,
    setShowStrata,
    showGroundGrid,
    setShowGroundGrid,
    openSections,
    toggleSection,
    toggleOption,
    resetOptions
  };
};

export default useDisplayOptions;