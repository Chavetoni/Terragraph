import React from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from './Icons';

const PanelToggleButton = ({ onClick, isPanelOpen, direction }) => {
    const ariaLabel = direction === 'left' 
        ? (isPanelOpen ? 'Close left panel' : 'Open left panel')
        : (isPanelOpen ? 'Close right panel' : 'Open right panel');
    
    return (
        <button 
            onClick={onClick} 
            className={`panel-toggle-btn ${direction}`}
            aria-label={ariaLabel}
            aria-expanded={isPanelOpen}
            type="button"
        >
            {direction === 'left' ?
                (isPanelOpen ? <ChevronLeftIcon /> : <ChevronRightIcon />) :
                (isPanelOpen ? <ChevronRightIcon /> : <ChevronLeftIcon />)
            }
        </button>
    );
};

export default PanelToggleButton;