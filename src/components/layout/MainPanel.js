import React, { useState } from 'react';
import { useUI } from '../../contexts/UIContext';
import SiteMapSection from '../panels/SiteMapSection';
import LayerEditorSection from '../panels/LayerEditorSection';
import BoreholeSection from '../panels/BoreholeSection';
import DisplayOptionsSection from '../panels/DisplayOptionsSection';

const MainPanel = () => {
    const { activePanel } = useUI();
    const [openSections, setOpenSections] = useState({
        siteMap: true,
        layerEditor: true,
        boreholes: true,
        displayOptions: true
    });

    const handleToggle = (sectionKey) => {
        setOpenSections(prev => ({
            ...prev,
            [sectionKey]: !prev[sectionKey]
        }));
    };

    const panels = {
        sitemap: { 
            title: 'Site Map Controls', 
            content: <SiteMapSection isOpen={openSections.siteMap} onToggle={handleToggle} /> 
        },
        layers: { 
            title: 'Layer Properties', 
            content: <LayerEditorSection isOpen={openSections.layerEditor} onToggle={handleToggle} /> 
        },
        boreholes: { 
            title: 'Borehole Markers', 
            content: <BoreholeSection isOpen={openSections.boreholes} onToggle={handleToggle} /> 
        },
        display: { 
            title: 'Display Options', 
            content: <DisplayOptionsSection isOpen={openSections.displayOptions} onToggle={handleToggle} /> 
        },
    };

    const current = activePanel ? panels[activePanel] : null;

    return (
        <div className="main-panel">
            {current && (
                <>
                    <h3>{current.title}</h3>
                    <div className="panel-content">{current.content}</div>
                </>
            )}
        </div>
    );
};

export default MainPanel;