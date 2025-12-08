import React from 'react';
import { X, Upload, FilePlus, Eye, EyeOff, MoreVertical } from 'lucide-react';
import { PanelTab } from '../../types/ui-types';
import './SidePanels.css';

const ControlPanel = ({ activeTab, onClose }) => {

    const renderHeader = (title) => (
        <div className="panel-header">
            <h2 className="panel-title">{title}</h2>
            <button onClick={onClose} className="panel-close-btn">
                <X size={18} />
            </button>
        </div>
    );

    // Main Content Renderer
    const renderContent = () => {
        if (activeTab === PanelTab.PROJECT) {
            return (
                <div className="flex flex-col h-full w-full">
                    {renderHeader('Site Map Controls')}

                    <div className="panel-content custom-scrollbar">

                        {/* Section: Site Map */}
                        <div className="space-y-4">
                            <label className="section-label">Site Map (On Ground)</label>

                            <div className="upload-area group">
                                <div className="upload-icon-circle">
                                    <Upload className="text-blue-400 w-6 h-6 group-hover:text-blue-300" />
                                </div>
                                <p className="upload-text-main">Upload Site Map</p>
                                <p className="upload-text-sub">Supports .DXF, .OBJ, .PNG</p>
                            </div>

                            <div className="flex gap-2 mt-2">
                                <button className="btn-secondary">
                                    <FilePlus size={14} /> Load Preset
                                </button>
                            </div>
                        </div>

                        {/* Section: Coordinates */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <label className="section-label">Reference Point</label>
                            </div>
                            <div className="grid grid-cols-2 gap-4" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div className="input-group">
                                    <span className="input-label">Latitude</span>
                                    <input type="text" className="glass-input" placeholder="0.00" />
                                </div>
                                <div className="input-group">
                                    <span className="input-label">Longitude</span>
                                    <input type="text" className="glass-input" placeholder="0.00" />
                                </div>
                            </div>
                        </div>

                        {/* Section: Recent Files */}
                        <div className="space-y-3">
                            <label className="section-label">Recent Projects</label>
                            <div className="space-y-1">
                                {[1, 2, 3].map(i => (
                                    <div key={i} className="list-item group">
                                        <div className="list-item-content">
                                            <div className="status-dot"></div>
                                            <span className="list-item-text">Survey_Site_A{i}.geo</span>
                                        </div>
                                        <MoreVertical size={14} className="list-item-icon" />
                                    </div>
                                ))}
                            </div>
                        </div>

                    </div>
                </div>
            );
        }

        if (activeTab === PanelTab.LAYERS) {
            return (
                <div className="flex flex-col h-full">
                    {renderHeader('Layer Manager')}
                    <div className="panel-content custom-scrollbar">
                        <div className="space-y-3" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            {['Topography', 'Boreholes', 'Water Table', 'Bedrock'].map((layer, idx) => (
                                <div key={idx} className="layer-item group">
                                    <span className="layer-name">{layer}</span>
                                    <button className="layer-toggle">
                                        {idx % 2 === 0 ? <Eye size={18} /> : <EyeOff size={18} />}
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            );
        }

        return (
            <div className="flex flex-col h-full">
                {renderHeader('Settings')}
                <div className="panel-content">
                    <div className="empty-state">
                        <p className="text-slate-500">Select an option from the sidebar</p>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="glass-panel-container">
            {renderContent()}
        </div>
    );
};

export default ControlPanel;
