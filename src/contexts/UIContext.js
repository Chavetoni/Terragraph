import React, { useState, useContext, createContext } from 'react';

const UIContext = createContext(null);

export const UIProvider = ({ children }) => {
    const [activePanel, setActivePanel] = useState(null);
    const [isRightPanelOpen, setIsRightPanelOpen] = useState(true);

    const togglePanel = (panel) => setActivePanel(prev => prev === panel ? null : panel);
    const toggleRightPanel = () => setIsRightPanelOpen(prev => !prev);

    const value = { activePanel, togglePanel, isRightPanelOpen, toggleRightPanel };
    return <UIContext.Provider value={value}>{children}</UIContext.Provider>;
};

export const useUI = () => useContext(UIContext);