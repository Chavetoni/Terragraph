// src/components/ui/BoreholeLegendItem.js
import React, { useState } from 'react';
import { useBoreholes } from '../../contexts/BoreholeContext';
import { metersToFeet, feetToMeters, formatDepthMetersToFeet } from '../../utils/unitConverter.js';
import { Logger } from '../../utils/Logger.js';

const logger = new Logger().withContext('BoreholeLegendItem');

const BoreholeLegendItem = ({ borehole, index }) => {
  const { updateBoreholeDynamic, removeBorehole } = useBoreholes();
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(borehole.name || '');
  const [editDepth, setEditDepth] = useState(borehole.depth || 10);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleEdit = () => {
    setIsEditing(true);
    setEditName(borehole.name || '');
    setEditDepth(borehole.depth || 10);
  };

  const handleSave = async () => {
    setIsSaving(true);
    
    try {
      // Add small delay to show loading state
      await new Promise(resolve => setTimeout(resolve, 300));
      
      updateBoreholeDynamic(borehole.id, {
        name: editName,
        depth: parseFloat(editDepth) || 10
      });
      
      setSaveSuccess(true);
      
      // Show success state for a moment before closing
      setTimeout(() => {
        setIsEditing(false);
        setIsSaving(false);
        setSaveSuccess(false);
      }, 500);
      
    } catch (error) {
      logger.error('Error saving borehole:', error);
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditName(borehole.name || '');
    setEditDepth(borehole.depth || 10);
    setIsSaving(false);
    setSaveSuccess(false);
  };

  const handleDelete = (e) => {
    e.stopPropagation();
    if (window.confirm(`Are you sure you want to delete borehole "${borehole.name}"?`)) {
      removeBorehole(borehole.id);
    }
  };

  if (isEditing) {
    return (
      <div className="legend-item legend-item-edit">
        <div className="legend-edit-group">
          <label className="legend-edit-label">Name:</label>
          <input
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            className="legend-edit-input"
          />
        </div>
        <div className="legend-edit-group">
          <label className="legend-edit-label">Depth (ft):</label>
          <input
            type="number"
            value={metersToFeet(editDepth).toFixed(1)}
            onChange={(e) => setEditDepth(feetToMeters(parseFloat(e.target.value) || 0))}
            className="legend-edit-input"
            step="0.1"
            min="0.1"
          />
        </div>
        <div className="legend-edit-actions">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className={`legend-edit-button legend-edit-button-save ${
              saveSuccess ? 'success' : (isSaving ? 'saving' : '')
            }`}
          >
            {saveSuccess ? '✓ Saved' : (isSaving ? 'Saving...' : 'Save')}
          </button>
          <button
            onClick={handleCancel}
            disabled={isSaving}
            className="legend-edit-button legend-edit-button-cancel"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            className="legend-edit-button legend-edit-button-delete"
            title="Delete borehole"
          >
            ×
          </button>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="legend-item legend-item-clickable" 
      onClick={handleEdit}
      title="Click to edit borehole properties"
    >
      <div
        className="borehole-color-indicator"
        title="Borehole marker (blue modern design)"
      >
        <div className="borehole-color-indicator-inner" />
      </div>
      <div className="legend-text-container" style={{ flex: 1 }}>
        <div className="legend-layer-name">
          {borehole.name || `BH-${index + 1}`}
        </div>
        <div className="legend-layer-description">
          Position: ({borehole.x?.toFixed(1)}, {borehole.z?.toFixed(1)})
        </div>
        <div className="legend-layer-depth">
          Depth: {formatDepthMetersToFeet(parseFloat(borehole.depth) || 10)}' • Elevation: {formatDepthMetersToFeet(parseFloat(borehole.y) || 0)}'
        </div>
      </div>
      
      {/* Delete button in normal view */}
      <button
        onClick={handleDelete}
        className="legend-delete-button"
        title="Delete borehole"
      >
        ×
      </button>
    </div>
  );
};

export default BoreholeLegendItem;