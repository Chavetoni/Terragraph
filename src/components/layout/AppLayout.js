import React from 'react';
import Sidebar from './Sidebar';
import MainPanel from './MainPanel';
import RightPanel from './RightPanel';
import LazyThreeJsCanvas from '../canvas/LazyThreeJsCanvas';
import PanelToggleButton from '../ui/PanelToggleButton';
import { useUI } from '../../contexts/UIContext';

const AppLayout = () => {
    const { activePanel, togglePanel, isRightPanelOpen, toggleRightPanel } = useUI();

    const appContainerClasses = 'app-container';

    // Helper to determine if main panel should be visible
    const isMainPanelVisible = !!activePanel;

    return (
        <div className={appContainerClasses}>
            {/* Background Canvas */}
            <div className="content-area">
                <LazyThreeJsCanvas />
            </div>

            {/* Floating Sidebar */}
            <Sidebar className="glass-panel" />

            {/* Floating Main Panel */}
            <div className={`main-panel glass-panel ${!isMainPanelVisible ? 'hidden' : ''}`}>
                <MainPanel className="" />
            </div>

            {/* Floating Right Panel (Inspector with Geological Modeling) */}
            {isRightPanelOpen && (
                <RightPanel className="" />
            )}

            {/* Toggles */}
            <PanelToggleButton
                onClick={() => togglePanel(activePanel || 'sitemap')}
                isPanelOpen={isMainPanelVisible}
                direction="left"
                className={`panel-toggle-btn left ${isMainPanelVisible ? 'open' : ''}`}
            />
            <PanelToggleButton
                onClick={toggleRightPanel}
                isPanelOpen={isRightPanelOpen}
                direction="right"
                className={`panel-toggle-btn right ${isRightPanelOpen ? 'open' : ''}`}
            />
        </div>
    );
};

export default AppLayout;