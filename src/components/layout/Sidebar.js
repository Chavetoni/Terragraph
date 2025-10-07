import React from 'react';
import { useUI } from '../../contexts/UIContext';
import { FolderIcon, LayersIcon, PinIcon, EyeIcon } from '../ui/Icons';

const Sidebar = () => {
    const { activePanel, togglePanel } = useUI();
    const buttons = [
        { id: 'sitemap', icon: <FolderIcon />, label: 'Site Map' },
        { id: 'layers', icon: <LayersIcon />, label: 'Layers' },
        { id: 'boreholes', icon: <PinIcon />, label: 'Boreholes' },
        { id: 'display', icon: <EyeIcon />, label: 'Display' },
    ];

    return (
        <div className="sidebar">
            <div className="sidebar-menu">
                {buttons.map(btn => (
                    <button key={btn.id} className={`sidebar-btn ${activePanel === btn.id ? 'active' : ''}`} onClick={() => togglePanel(btn.id)} title={btn.label}>
                        {btn.icon}
                    </button>
                ))}
            </div>
        </div>
    );
};

export default Sidebar;