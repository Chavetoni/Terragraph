import React, { useEffect, useContext } from 'react';
import Sidebar from './Sidebar';
import MainPanel from './MainPanel';
import RightPanel from './RightPanel';
import LazyThreeJsCanvas from '../canvas/LazyThreeJsCanvas';
import PanelToggleButton from '../ui/PanelToggleButton';
import { useUI } from '../../contexts/UIContext';
import { ThreeJsContext } from '../../contexts/ThreeJsContext';

const AppLayout = () => {
    const { activePanel, togglePanel, isRightPanelOpen, toggleRightPanel } = useUI();
    const { handleResize } = useContext(ThreeJsContext);

    const appContainerClasses = [
        'app-container',
        !activePanel ? 'main-panel-hidden' : '',
        !isRightPanelOpen ? 'right-panel-hidden' : ''
    ].join(' ');

    // Trigger canvas resize when panels toggle with smooth transition
    useEffect(() => {
        if (handleResize) {
            // Immediate resize to start the transition
            handleResize();
            
            // Additional resizes during transition for smoothness
            const intervals = [50, 100, 150, 200, 250, 300];
            const timers = intervals.map(delay => 
                setTimeout(() => handleResize(), delay)
            );
            
            return () => {
                timers.forEach(timer => clearTimeout(timer));
            };
        }
    }, [isRightPanelOpen, activePanel, handleResize]);

    return (
        <div className={appContainerClasses}>
            <Sidebar />
            <MainPanel />
            <div className="content-area">
                <LazyThreeJsCanvas />
            </div>
            <RightPanel />
            <PanelToggleButton
                onClick={() => togglePanel(activePanel || 'sitemap')}
                isPanelOpen={!!activePanel}
                direction="left"
            />
            <PanelToggleButton
                onClick={toggleRightPanel}
                isPanelOpen={isRightPanelOpen}
                direction="right"
            />
        </div>
    );
};

export default AppLayout;