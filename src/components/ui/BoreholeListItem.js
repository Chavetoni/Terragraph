import React, { useState } from 'react';
import { useBoreholes } from '../../contexts/BoreholeContext';
import { BOREHOLE_TYPES } from '../../models/Borehole';
import { formatDepthMetersToFeet, formatDiameterFeetToInches } from '../../utils/unitConverter.js';
import { Logger } from '../../utils/Logger.js';

const logger = new Logger().withContext('BoreholeListItem');

/**
 * BoreholeListItem component displaying individual borehole with visibility controls
 * @component
 * @param {Object} props - Component props
 * @param {Object} props.borehole - Borehole data object
 * @param {Function} [props.onEdit] - Callback for edit action
 * @param {Function} [props.onDelete] - Callback for delete action
 * @param {boolean} props.showGlobalVisible - Global visibility state
 * @param {boolean} props.isIndividualVisible - Individual visibility state for this borehole
 * @param {Function} props.onToggleVisibility - Callback for visibility toggle
 * @param {boolean} props.showBoreholeStrata - Global strata visibility state
 * @param {boolean} props.isStrataVisible - Individual strata visibility state
 * @param {Function} props.onToggleStrataVisibility - Callback for strata visibility toggle
 * @returns {JSX.Element} The borehole list item component
 */
const BoreholeListItem = ({ 
  borehole, 
  onEdit, 
  onDelete, 
  showGlobalVisible, 
  isIndividualVisible, 
  onToggleVisibility,
  showBoreholeStrata,
  isStrataVisible,
  onToggleStrataVisibility 
}) => {
  const { selectedBorehole, selectBorehole, hoverBorehole } = useBoreholes();
  const [isDeleting, setIsDeleting] = useState(false);
  
  const isSelected = selectedBorehole?.id === borehole.id;
  
  const handleClick = () => {
    if (!isDeleting) {
      selectBorehole(borehole.id);
    }
  };

  const handleMouseEnter = () => {
    if (!isDeleting) {
      hoverBorehole(borehole.id);
    }
  };

  const handleMouseLeave = () => {
    if (!isDeleting) {
      hoverBorehole(null);
    }
  };

  /**
   * Handles individual visibility toggle for this borehole
   * @param {Event} e - Click event
   */
  const handleToggleVisibility = (e) => {
    e.stopPropagation();
    if (onToggleVisibility) {
      onToggleVisibility(borehole.id, !isIndividualVisible);
    }
  };

  /**
   * Handles individual strata visibility toggle for this borehole
   * @param {Event} e - Click event
   */
  const handleToggleStrataVisibility = (e) => {
    e.stopPropagation();
    if (onToggleStrataVisibility) {
      onToggleStrataVisibility(borehole.id);
    }
  };

  const handleDelete = async (e) => {
    e.stopPropagation();
    setIsDeleting(true);
    
    try {
      // Add small delay for visual feedback
      await new Promise(resolve => setTimeout(resolve, 200));
      
      if (onDelete) {
        onDelete(borehole);
      }
    } catch (error) {
      logger.error('Error deleting borehole:', error);
      setIsDeleting(false);
    }
  };


  return (
    <div
      className={`borehole-list-item p-3 rounded-lg border transition-all duration-200 ${
        isDeleting 
          ? 'deleting border-red-300 bg-red-50 opacity-60' 
          : isSelected 
            ? 'selected border-blue-500 bg-blue-50' 
            : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
      }`}
      style={{ 
        cursor: isDeleting ? 'not-allowed' : 'pointer',
        pointerEvents: isDeleting ? 'none' : 'auto'
      }}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-semibold text-sm">{borehole.name}</h4>
            <div className="borehole-type-indicator">
              <div 
                className="borehole-type-dot" 
                style={{ backgroundColor: borehole.color || BOREHOLE_TYPES[borehole.type]?.color || BOREHOLE_TYPES.OTHER.color }}
              />
              {BOREHOLE_TYPES[borehole.type]?.name || 'Custom'}
            </div>
          </div>
          <div className="text-xs text-gray-600 mt-1">
            <div>Depth: {formatDepthMetersToFeet(borehole.depth)}'</div>
            <div>Position: ({borehole.x.toFixed(1)}, {borehole.z.toFixed(1)})</div>
            <div>Diameter: {formatDiameterFeetToInches(borehole.diameter)}"</div>
          </div>
        </div>
        
        <div className="borehole-actions flex space-x-2">
          <button
            onClick={handleToggleVisibility}
            disabled={!showGlobalVisible}
            className={`visibility-icon-button ${
              !showGlobalVisible
                ? 'disabled'
                : isIndividualVisible
                  ? 'visible'
                  : 'hidden'
            }`}
            title={
              !showGlobalVisible
                ? 'Enable "Show All Boreholes" first'
                : isIndividualVisible
                  ? 'Hide borehole'
                  : 'Show borehole'
            }
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {isIndividualVisible ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
              )}
            </svg>
          </button>
          
          {borehole.layers && borehole.layers.length > 0 && (
            <button
              onClick={handleToggleStrataVisibility}
              disabled={!showBoreholeStrata || !showGlobalVisible || !isIndividualVisible}
              className={`strata-icon-button ${
                !showBoreholeStrata || !showGlobalVisible || !isIndividualVisible
                  ? 'disabled'
                  : isStrataVisible
                    ? 'visible'
                    : 'hidden'
              }`}
              title={
                !showBoreholeStrata
                  ? 'Enable "Show Borehole Strata" first'
                  : !showGlobalVisible || !isIndividualVisible
                    ? 'Borehole must be visible'
                    : isStrataVisible
                      ? 'Hide strata'
                      : 'Show strata'
              }
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {isStrataVisible ? (
                  // Filled layers icon when visible
                  <g>
                    <rect x="5" y="4" width="14" height="4" strokeWidth={2} fill="currentColor" opacity="0.3" />
                    <rect x="5" y="10" width="14" height="4" strokeWidth={2} fill="currentColor" opacity="0.5" />
                    <rect x="5" y="16" width="14" height="4" strokeWidth={2} fill="currentColor" opacity="0.7" />
                  </g>
                ) : (
                  // Outline layers icon when hidden
                  <g>
                    <rect x="5" y="4" width="14" height="4" strokeWidth={2} />
                    <rect x="5" y="10" width="14" height="4" strokeWidth={2} />
                    <rect x="5" y="16" width="14" height="4" strokeWidth={2} />
                  </g>
                )}
              </svg>
            </button>
          )}
          
          
          {onEdit && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit(borehole);
              }}
              className="edit-button"
              title="Edit borehole"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
          )}
          
          {onDelete && (
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className={`delete-button ${isDeleting ? 'deleting' : ''}`}
              title={isDeleting ? "Deleting..." : "Delete borehole"}
            >
              {isDeleting ? '⌛' : '×'}
            </button>
          )}
        </div>
      </div>
      
      {isSelected && (
        <div className="mt-2 pt-2 border-t border-blue-200">
          <div className="text-xs text-blue-700">
            <div className="font-medium">Selected</div>
            <div>View enhanced visualization in 3D scene</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BoreholeListItem;