import React, { useCallback, useMemo, useTransition, startTransition } from 'react';
import { useUI } from '../../contexts/UIContext';
import { FolderIcon, LayersIcon, PinIcon, EyeIcon } from '../ui/Icons';
import { throttle } from '../../utils/performanceOptimizer';

/**
 * Optimized sidebar component with improved interaction performance
 * Uses React 18 transitions and throttling to improve INP metrics
 */
const OptimizedSidebar = () => {
    const { activePanel, togglePanel } = useUI();
    const [isPending, startTransition] = useTransition();
    
    // Memoize button configuration
    const buttons = useMemo(() => [
        { id: 'sitemap', icon: <FolderIcon />, label: 'Site Map' },
        { id: 'layers', icon: <LayersIcon />, label: 'Layers' },
        { id: 'boreholes', icon: <PinIcon />, label: 'Boreholes' },
        { id: 'display', icon: <EyeIcon />, label: 'Display' },
    ], []);

    // Throttle panel toggle to prevent rapid clicks
    const throttledToggle = useMemo(
        () => throttle((panelId) => {
            // Use transition for non-urgent state updates
            startTransition(() => {
                togglePanel(panelId);
            });
        }, 150), // 150ms throttle to prevent double-clicks
        [togglePanel]
    );

    // Optimized click handler with event.stopPropagation
    const handleButtonClick = useCallback((panelId) => (event) => {
        event.stopPropagation(); // Prevent event bubbling
        throttledToggle(panelId);
    }, [throttledToggle]);

    return (
        <div className="sidebar">
            <div className="sidebar-menu">
                {buttons.map(btn => (
                    <button 
                        key={btn.id} 
                        className={`sidebar-btn ${activePanel === btn.id ? 'active' : ''} ${isPending ? 'pending' : ''}`}
                        onClick={handleButtonClick(btn.id)}
                        title={btn.label}
                        type="button"
                        aria-label={btn.label}
                        aria-pressed={activePanel === btn.id}
                    >
                        {btn.icon}
                    </button>
                ))}
            </div>
            <style jsx>{`
                .sidebar-btn.pending {
                    opacity: 0.7;
                    pointer-events: none;
                }
            `}</style>
        </div>
    );
};

export default OptimizedSidebar;