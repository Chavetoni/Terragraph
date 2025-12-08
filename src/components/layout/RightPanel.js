import React, { useState } from 'react';
import { useSelection } from '../../contexts/SelectionContext';
import LegendSection from '../panels/LegendSection';
import ExportSection from '../panels/ExportSection';
import PrototypeControls from '../panels/PrototypeControls';
import PanelSection from '../ui/PanelSection';
import { MapIcon } from '../ui/Icons';
import { useUI } from '../../contexts/UIContext';

const SelectionDetails = ({ details }) => (
    <div className="selection-details">
        <div className="detail-row"><span>Type:</span><strong>{details.type}</strong></div>
        <div className="detail-row"><span>Name:</span><strong>{details.name}</strong></div>
    </div>
);

const RightPanel = ({ className = '' }) => {
    const { selectedObject } = useSelection();
    const { toggleRightPanel } = useUI();
    const [isLegendOpen, setIsLegendOpen] = useState(true);
    const [isExportOpen, setIsExportOpen] = useState(true);
    const [isPrototypeOpen, setIsPrototypeOpen] = useState(true);

    return (
        <div className={`right-panel glass-panel ${className}`}>
            <div className="panel-header">
                <h3>Inspector</h3>
                <button className="close-btn" onClick={toggleRightPanel}>×</button>
            </div>

            <div className="panel-content custom-scrollbar">
                {selectedObject && (
                    <div className="selection-panel">
                        <SelectionDetails details={selectedObject} />
                    </div>
                )}

                <div className="panel-sections">
                    <PanelSection
                        title="Geological Modeling"
                        icon={<MapIcon />}
                        isOpen={isPrototypeOpen}
                        onToggle={() => setIsPrototypeOpen(!isPrototypeOpen)}
                    >
                        <PrototypeControls />
                    </PanelSection>

                    <LegendSection isOpen={isLegendOpen} onToggle={() => setIsLegendOpen(!isLegendOpen)} />
                    <ExportSection isOpen={isExportOpen} onToggle={() => setIsExportOpen(!isExportOpen)} />
                </div>
            </div>

            <style jsx>{`
                .right-panel {
                    width: var(--panel-width);
                    border-left: 1px solid rgba(255, 255, 255, 0.08);
                    background: linear-gradient(135deg, rgba(255, 255, 255, 0.04) 0%, rgba(255, 255, 255, 0.02) 100%);
                    display: flex;
                    flex-direction: column;
                    height: 100%;
                }

                .panel-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 16px 20px;
                    background: rgba(255, 255, 255, 0.05);
                    backdrop-filter: blur(12px);
                    -webkit-backdrop-filter: blur(12px);
                    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
                }

                .panel-header h3 {
                    margin: 0;
                    font-size: 16px;
                    font-weight: 600;
                    color: var(--text-primary);
                }

                .close-btn {
                    background: transparent;
                    border: none;
                    color: var(--text-secondary);
                    font-size: 20px;
                    cursor: pointer;
                    padding: 4px;
                    line-height: 1;
                }

                .close-btn:hover {
                    color: var(--text-primary);
                }

                .panel-content {
                    flex: 1;
                    overflow-y: auto;
                    padding: 0;
                }

                .panel-sections {
                    display: flex;
                    flex-direction: column;
                    gap: 16px;
                    padding: 16px;
                }
            `}</style>

            {/* Global styles to allow full dropdown expansion in right panel */}
            <style jsx global>{`
                /* RIGHT PANEL: Allow all dropdowns to expand fully */
                /* Use large numeric values (not 'none') to preserve CSS transition animations */

                /* PanelSection inner content - large value so ResizeObserver measures full height */
                .right-panel .panel-section__content {
                    max-height: 2000px !important;
                }

                /* Legend content */
                .right-panel .legend-content {
                    max-height: 2000px !important;
                }

                /* Export options */
                .right-panel .export-options {
                    max-height: 2000px !important;
                }

                /* CollapsibleSection (in PrototypeControls) - large value for smooth animation */
                .right-panel .collapsible-section-content-open {
                    max-height: 2000px !important;
                }

                /* UnifiedAccordion (in VolumetricSettings) */
                .right-panel .accordion-content {
                    max-height: 2000px !important;
                }
            `}</style>
        </div>
    );
};

export default RightPanel;