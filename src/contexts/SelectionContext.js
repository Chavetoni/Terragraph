import React, { useState, useContext, createContext } from 'react';

const SelectionContext = createContext(null);

export const SelectionProvider = ({ children }) => {
    const [selectedObject, setSelectedObject] = useState(null);
    const value = { selectedObject, setSelectedObject };
    return <SelectionContext.Provider value={value}>{children}</SelectionContext.Provider>;
};

export const useSelection = () => useContext(SelectionContext);