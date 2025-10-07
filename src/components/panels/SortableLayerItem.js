import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

export const SortableItem = ({
  id,
  layer,
  index,
  isActive,
  onUpdate,
  onRemove,
  validation,
  getValidationState,
  getValidationMessage,
  materialTypes
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1000 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`layer-item ${isDragging ? 'dragging' : ''} ${isActive ? 'drag-source' : ''}`}
    >
      <div className="layer-header">
        <div
          {...attributes}
          {...listeners}
          className="drag-handle"
          title="Drag to reorder"
        >
          <svg className="drag-icon" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M11 18c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2zm-2-8c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0-6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm6 4c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
          </svg>
        </div>
        
        <div className="layer-badge">
          <span className="layer-number">Layer {index + 1}</span>
        </div>
        
        <div className="layer-actions">
          <button
            onClick={onRemove}
            className="remove-button"
            title="Remove layer"
            type="button"
          >
            <svg className="remove-icon" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
            </svg>
          </button>
        </div>
      </div>

      <div className="layer-content">
        <div className="layer-row">
          <div className="field-group">
            <label className="field-label">Material Type</label>
            <div className="material-select-container">
              <select
                value={layer.material}
                onChange={(e) => onUpdate('material', e.target.value)}
                className={`material-select ${getValidationState(index, 'material')}`}
              >
                {Object.entries(materialTypes).map(([key, material]) => (
                  <option key={key} value={key}>
                    {material.name}
                  </option>
                ))}
              </select>
              <div 
                className="material-indicator"
                style={{ backgroundColor: materialTypes[layer.material]?.color }}
              />
            </div>
            {getValidationMessage(index, 'material') && (
              <div className={`validation-message ${getValidationState(index, 'material')}`}>
                {getValidationMessage(index, 'material')}
              </div>
            )}
          </div>

          <div className="depth-fields">
            <div className="field-group">
              <label className="field-label">From (m)</label>
              <input
                type="number"
                value={layer.depthFrom}
                onChange={(e) => onUpdate('depthFrom', parseFloat(e.target.value) || 0)}
                className={`depth-input ${getValidationState(index, 'depthFrom')}`}
                step="0.1"
                min="0"
                placeholder={index > 0 ? "(auto)" : "0.0"}
                disabled={index > 0}
              />
              {getValidationMessage(index, 'depthFrom') && (
                <div className={`validation-message ${getValidationState(index, 'depthFrom')}`}>
                  {getValidationMessage(index, 'depthFrom')}
                </div>
              )}
            </div>

            <div className="depth-arrow">→</div>

            <div className="field-group">
              <label className="field-label">To (m)</label>
              <input
                type="number"
                value={layer.depthTo}
                onChange={(e) => onUpdate('depthTo', parseFloat(e.target.value) || 0)}
                className={`depth-input ${getValidationState(index, 'depthTo')}`}
                step="0.1"
                min="0"
              />
              {getValidationMessage(index, 'depthTo') && (
                <div className={`validation-message ${getValidationState(index, 'depthTo')}`}>
                  {getValidationMessage(index, 'depthTo')}
                </div>
              )}
            </div>
          </div>

          <div className="status-indicator">
            {getValidationState(index, 'overall') === 'error' && (
              <div className="status-icon error" title="Layer has errors">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                </svg>
              </div>
            )}
            {getValidationState(index, 'overall') === 'warning' && (
              <div className="status-icon warning" title="Layer has warnings">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
                </svg>
              </div>
            )}
            {getValidationState(index, 'overall') === 'valid' && (
              <div className="status-icon valid" title="Layer is valid">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                </svg>
              </div>
            )}
          </div>
        </div>

        <div className="layer-description">
          <label className="field-label">Description (Optional)</label>
          <input
            type="text"
            value={layer.description || ''}
            onChange={(e) => onUpdate('description', e.target.value)}
            className="description-input"
            placeholder="Additional notes about this layer..."
          />
        </div>
      </div>
    </div>
  );
};