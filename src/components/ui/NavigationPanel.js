import React, { useState } from 'react';

const NavigationPanel = () => {
  const [isVisible, setIsVisible] = useState(true);

  const toggleVisibility = () => {
    setIsVisible(prev => !prev);
  };

  return (
    <div className="navigation-panel">
      <button 
        className="navigation-toggle" 
        onClick={toggleVisibility}
        title={isVisible ? "Hide Navigation" : "Show Navigation"}
      >
        {isVisible ? '×' : '?'}
      </button>
      
      {isVisible && (
        <div className="navigation-content">
          <div className="navigation-title">Navigation</div>
          <div className="navigation-grid">
            <div>L-Click+Drag:</div>
            <div>Rotate</div>
            <div>R-Click+Drag:</div>
            <div>Pan</div>
            <div>Scroll:</div>
            <div>Zoom</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NavigationPanel;