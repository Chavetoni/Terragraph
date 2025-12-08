import React, { useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, Download, RefreshCw, HelpCircle, X } from 'lucide-react';
import { ViewMode } from '../../types/ui-types';
import './SidePanels.css';

const InspectorPanel = ({ onClose }) => {
    const [expandedSections, setExpandedSections] = useState({
        modeling: true,
        legend: true,
        export: false
    });

    const toggleSection = (section) => {
        setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
    };

    const SectionHeader = ({ title, sectionKey }) => (
        <button
            onClick={() => toggleSection(sectionKey)}
            className="section-header"
        >
            <span className="section-title">{title}</span>
            {expandedSections[sectionKey] ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
        </button>
    );

    return (
        <div className="glass-panel-container">

            {/* Top Bar */}
            <div className="panel-header compact">
                <div className="flex items-center gap-2" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <h3 className="panel-title">Inspector</h3>
                    <HelpCircle size={14} className="text-slate-500 cursor-pointer hover:text-slate-300 transition-colors" />
                </div>
                <button onClick={onClose} className="panel-close-btn">
                    <X size={18} />
                </button>
            </div>

            <div className="panel-content no-padding custom-scrollbar">

                {/* Modeling Section */}
                <div>
                    <SectionHeader title="Geological Modeling" sectionKey="modeling" />

                    {expandedSections.modeling && (
                        <div className="section-content">

                            <div className="flex items-center justify-between" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <span className="section-label" style={{ marginBottom: 0 }}>Engine Mode</span>
                                <div className="prototype-badge">
                                    PROTOTYPE
                                </div>
                            </div>

                            {/* Mode Select */}
                            <div className="input-group">
                                <label className="input-label">Interpolation Method</label>
                                <div className="glass-select-wrapper">
                                    <select className="glass-input glass-select">
                                        <option value={ViewMode.CONCEPTUAL}>Conceptual (Nearest Neighbor)</option>
                                        <option value={ViewMode.GEOSPATIAL}>Kriging (Geospatial)</option>
                                        <option value={ViewMode.VOLUMETRIC}>Volumetric Mesh</option>
                                    </select>
                                    <ChevronDown className="select-arrow" size={16} />
                                </div>
                            </div>

                            {/* Warning Box */}
                            <div className="warning-box">
                                <AlertTriangle className="warning-icon" size={18} />
                                <div>
                                    <h4 className="warning-title">Insufficient Data</h4>
                                    <p className="warning-text">
                                        At least 3 validated boreholes are required to generate a volumetric hull. Please import more data points.
                                    </p>
                                </div>
                            </div>

                            {/* Primary Action */}
                            <button
                                disabled
                                className="btn-generate"
                            >
                                <RefreshCw size={16} />
                                Generate Model
                            </button>

                        </div>
                    )}
                </div>

                {/* Legend Section */}
                <div>
                    <SectionHeader title="Legend" sectionKey="legend" />
                    {expandedSections.legend && (
                        <div className="section-content">
                            <div className="empty-state">
                                <span className="text-slate-500 text-sm italic mb-2">No active layers</span>
                                <p className="text-xs text-slate-600">Toggle layers visibility to populate legend</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Export Section */}
                <div>
                    <SectionHeader title="Export Scene" sectionKey="export" />
                    {expandedSections.export && (
                        <div className="section-content">
                            <button className="btn-secondary justify-between" style={{ justifyContent: 'space-between' }}>
                                <span className="text-slate-300 group-hover:text-white transition-colors">Export as OBJ</span>
                                <Download size={16} className="text-slate-500 group-hover:text-white transition-colors" />
                            </button>
                            <button className="btn-secondary justify-between" style={{ justifyContent: 'space-between' }}>
                                <span className="text-slate-300 group-hover:text-white transition-colors">Export Report (PDF)</span>
                                <Download size={16} className="text-slate-500 group-hover:text-white transition-colors" />
                            </button>
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
};

export default InspectorPanel;
