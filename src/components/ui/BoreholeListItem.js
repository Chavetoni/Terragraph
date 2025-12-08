import React, { useState } from 'react';
import { useBoreholes } from '../../contexts/BoreholeContext';
import { BOREHOLE_TYPES } from '../../models/Borehole';
import { formatDepthMetersToFeet, formatDiameterFeetToInches } from '../../utils/unitConverter.js';
import { Logger } from '../../utils/Logger.js';
import './BoreholeListItem.css';

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
      className={`borehole-list-item ${isDeleting ? 'deleting' : ''} ${isSelected ? 'selected' : ''}`}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className="borehole-header-row">
        <div className="borehole-info-section">
          <h4 className="borehole-name">
            {borehole.name}
          </h4>
          <div className="borehole-type-indicator">
            <div
              className="borehole-type-dot"
              style={{ backgroundColor: borehole.color || BOREHOLE_TYPES[borehole.type]?.color || BOREHOLE_TYPES.OTHER.color }}
            />
            {BOREHOLE_TYPES[borehole.type]?.name || 'Custom'}
          </div>
          <div className="borehole-metadata">
            <div className="borehole-metadata-item">
              <span className="borehole-metadata-label">Depth:</span>
              <span className="borehole-metadata-value">{formatDepthMetersToFeet(borehole.depth)}'</span>
            </div>
            <div className="borehole-metadata-item">
              <span className="borehole-metadata-label">Position:</span>
              <span className="borehole-metadata-value">({borehole.x.toFixed(1)}, {borehole.z.toFixed(1)})</span>
            </div>
            <div className="borehole-metadata-item">
              <span className="borehole-metadata-label">Diameter:</span>
              <span className="borehole-metadata-value">{formatDiameterFeetToInches(borehole.diameter)}"</span>
            </div>
          </div>
        </div>

        <div className="borehole-actions">
          <button
            onClick={handleToggleVisibility}
            disabled={!showGlobalVisible}
            className={`borehole-action-btn visibility-icon-button ${
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
            {isIndividualVisible ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="12" cy="12" r="3"/>
                <path d="M2 12c1.5-4 5-7 10-7s8.5 3 10 7c-1.5 4-5 7-10 7s-8.5-3-10-7z"/>
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M3 3l18 18M10.5 10.5a3 3 0 004 4M7 7a8 8 0 0110 10M2 12c1.5-4 5-7 10-7m8 2a13 13 0 012 5c-1.5 4-5 7-10 7"/>
              </svg>
            )}
          </button>

          {borehole.layers && borehole.layers.length > 0 && (
            <button
              onClick={handleToggleStrataVisibility}
              disabled={!showBoreholeStrata || !showGlobalVisible || !isIndividualVisible}
              className={`borehole-action-btn strata-icon-button ${
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
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="4" y1="6" x2="20" y2="6"/>
                <line x1="4" y1="12" x2="20" y2="12"/>
                <line x1="4" y1="18" x2="20" y2="18"/>
              </svg>
            </button>
          )}

          {onEdit && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit(borehole);
              }}
              className="borehole-action-btn edit-button"
              title="Edit borehole"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 3l4 4L7 21H3v-4L17 3z"/>
              </svg>
            </button>
          )}

          {onDelete && (
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className={`borehole-action-btn delete-button ${isDeleting ? 'deleting' : ''}`}
              title={isDeleting ? "Deleting..." : "Delete borehole"}
            >
              {isDeleting ? '⌛' : '×'}
            </button>
          )}
        </div>
      </div>

    </div>
  );
};

export default BoreholeListItem;