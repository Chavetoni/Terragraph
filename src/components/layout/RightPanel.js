import React, { useState } from 'react';
import { useSelection } from '../../contexts/SelectionContext';
import LegendSection from '../panels/LegendSection';
import ExportSection from '../panels/ExportSection';
import PrototypeControls from '../panels/PrototypeControls';
import UnifiedAccordion from '../ui/UnifiedAccordion';

const SelectionDetails = ({ details }) => (
    <>
        <h4>Selection Details</h4>
        <div className="card">
            <div className="detail-row"><span>Type:</span><strong>{details.type}</strong></div>
            <div className="detail-row"><span>Name:</span><strong>{details.name}</strong></div>
            <div className="detail-row"><span>X:</span><strong>{details.point.x.toFixed(2)}</strong></div>
            <div className="detail-row"><span>Y:</span><strong>{details.point.y.toFixed(2)}</strong></div>
            <div className="detail-row"><span>Z:</span><strong>{details.point.z.toFixed(2)}</strong></div>
        </div>
    </>
);

const RightPanel = () => {
    const { selectedObject } = useSelection();
    const [isLegendOpen, setIsLegendOpen] = useState(true);
    const [isExportOpen, setIsExportOpen] = useState(false);
    const [isPrototypeOpen, setIsPrototypeOpen] = useState(true);
    
    const handleLegendToggle = () => {
        setIsLegendOpen(prev => !prev);
    };
    
    const handleExportToggle = () => {
        setIsExportOpen(prev => !prev);
    };
    
    const handlePrototypeToggle = () => {
        setIsPrototypeOpen(prev => !prev);
    };
    
    return (
        <div className="right-panel">
            <div className="panel-content">
                {selectedObject ? (
                    <SelectionDetails details={selectedObject} />
                ) : (
                    <>
                        <UnifiedAccordion
                            title="Geological Modeling"
                            isOpen={isPrototypeOpen}
                            onToggle={handlePrototypeToggle}
                        >
                            <PrototypeControls />
                        </UnifiedAccordion>
                        <LegendSection isOpen={isLegendOpen} onToggle={handleLegendToggle} />
                        <ExportSection isOpen={isExportOpen} onToggle={handleExportToggle} />
                    </>
                )}
            </div>
        </div>
    );
};

export default RightPanel;