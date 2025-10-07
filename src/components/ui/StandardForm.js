import React, { forwardRef } from 'react';
import PropTypes from 'prop-types';

/**
 * StandardInput Component
 * Standardized form input using the new design system CSS classes
 */
const StandardInput = forwardRef(({
  label,
  required = false,
  error = null,
  success = null,
  helpText = null,
  className = '',
  inline = false,
  ...props
}, ref) => {
  const inputClassName = [
    'form-input-new',
    error ? 'error' : '',
    success ? 'success' : '',
    className
  ].filter(Boolean).join(' ');

  const groupClassName = [
    'form-group-new',
    inline ? 'inline' : ''
  ].filter(Boolean).join(' ');

  return (
    <div className={groupClassName}>
      {label && (
        <label 
          htmlFor={props.id} 
          className={`form-label-new ${required ? 'required' : ''}`}
        >
          {label}
        </label>
      )}
      <input
        ref={ref}
        className={inputClassName}
        {...props}
      />
      {error && (
        <div className="form-error-message">
          <ErrorIcon />
          {error}
        </div>
      )}
      {success && (
        <div className="form-success-message">
          <SuccessIcon />
          {success}
        </div>
      )}
      {helpText && !error && !success && (
        <div className="form-help-text" style={{ 
          fontSize: '12px', 
          color: 'var(--text-secondary)', 
          marginTop: 'var(--spacing-xs)' 
        }}>
          {helpText}
        </div>
      )}
    </div>
  );
});

/**
 * StandardSelect Component
 * Standardized select dropdown using the new design system CSS classes
 */
const StandardSelect = forwardRef(({
  label,
  required = false,
  error = null,
  success = null,
  helpText = null,
  options = [],
  placeholder = 'Select an option...',
  className = '',
  inline = false,
  children,
  ...props
}, ref) => {
  const selectClassName = [
    'form-select-new',
    error ? 'error' : '',
    success ? 'success' : '',
    className
  ].filter(Boolean).join(' ');

  const groupClassName = [
    'form-group-new',
    inline ? 'inline' : ''
  ].filter(Boolean).join(' ');

  return (
    <div className={groupClassName}>
      {label && (
        <label 
          htmlFor={props.id} 
          className={`form-label-new ${required ? 'required' : ''}`}
        >
          {label}
        </label>
      )}
      <select
        ref={ref}
        className={selectClassName}
        {...props}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((option, index) => (
          <option key={index} value={option.value}>
            {option.label}
          </option>
        ))}
        {children}
      </select>
      {error && (
        <div className="form-error-message">
          <ErrorIcon />
          {error}
        </div>
      )}
      {success && (
        <div className="form-success-message">
          <SuccessIcon />
          {success}
        </div>
      )}
      {helpText && !error && !success && (
        <div className="form-help-text" style={{ 
          fontSize: '12px', 
          color: 'var(--text-secondary)', 
          marginTop: 'var(--spacing-xs)' 
        }}>
          {helpText}
        </div>
      )}
    </div>
  );
});

/**
 * StandardTextarea Component
 * Standardized textarea using the new design system CSS classes
 */
const StandardTextarea = forwardRef(({
  label,
  required = false,
  error = null,
  success = null,
  helpText = null,
  className = '',
  inline = false,
  rows = 3,
  ...props
}, ref) => {
  const textareaClassName = [
    'form-textarea-new',
    error ? 'error' : '',
    success ? 'success' : '',
    className
  ].filter(Boolean).join(' ');

  const groupClassName = [
    'form-group-new',
    inline ? 'inline' : ''
  ].filter(Boolean).join(' ');

  return (
    <div className={groupClassName}>
      {label && (
        <label 
          htmlFor={props.id} 
          className={`form-label-new ${required ? 'required' : ''}`}
        >
          {label}
        </label>
      )}
      <textarea
        ref={ref}
        className={textareaClassName}
        rows={rows}
        {...props}
      />
      {error && (
        <div className="form-error-message">
          <ErrorIcon />
          {error}
        </div>
      )}
      {success && (
        <div className="form-success-message">
          <SuccessIcon />
          {success}
        </div>
      )}
      {helpText && !error && !success && (
        <div className="form-help-text" style={{ 
          fontSize: '12px', 
          color: 'var(--text-secondary)', 
          marginTop: 'var(--spacing-xs)' 
        }}>
          {helpText}
        </div>
      )}
    </div>
  );
});

/**
 * StandardFormGroup Component
 * Container for form elements with consistent spacing
 */
const StandardFormGroup = ({ 
  children, 
  inline = false, 
  className = '',
  ...props 
}) => {
  const groupClassName = [
    'form-group-new',
    inline ? 'inline' : '',
    className
  ].filter(Boolean).join(' ');

  return (
    <div className={groupClassName} {...props}>
      {children}
    </div>
  );
};

/**
 * GeologicalMaterialSelect Component
 * Specialized select component for geological materials with color previews
 */
const GeologicalMaterialSelect = forwardRef(({
  label = 'Material Type',
  materials = {},
  showColorPreview = true,
  ...props
}, ref) => {
  const materialOptions = Object.entries(materials).map(([key, material]) => ({
    value: key,
    label: material.name,
    color: material.color,
    description: material.description
  }));

  return (
    <StandardSelect
      ref={ref}
      label={label}
      options={materialOptions}
      className="geological-material-select"
      {...props}
    >
      {showColorPreview && materialOptions.map((material) => (
        <option 
          key={material.value} 
          value={material.value}
          style={{ 
            backgroundColor: material.color + '20',
            color: 'var(--text-primary)'
          }}
        >
          {material.label} - {material.description}
        </option>
      ))}
    </StandardSelect>
  );
});

/**
 * Icon Components for form feedback
 */
const ErrorIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10"/>
    <line x1="15" y1="9" x2="9" y2="15"/>
    <line x1="9" y1="9" x2="15" y2="15"/>
  </svg>
);

const SuccessIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="m9 12 2 2 4-4"/>
    <circle cx="12" cy="12" r="10"/>
  </svg>
);

// PropTypes
StandardInput.propTypes = {
  label: PropTypes.string,
  required: PropTypes.bool,
  error: PropTypes.string,
  success: PropTypes.string,
  helpText: PropTypes.string,
  className: PropTypes.string,
  inline: PropTypes.bool,
  id: PropTypes.string
};

StandardSelect.propTypes = {
  label: PropTypes.string,
  required: PropTypes.bool,
  error: PropTypes.string,
  success: PropTypes.string,
  helpText: PropTypes.string,
  options: PropTypes.arrayOf(PropTypes.shape({
    value: PropTypes.any.isRequired,
    label: PropTypes.string.isRequired
  })),
  placeholder: PropTypes.string,
  className: PropTypes.string,
  inline: PropTypes.bool,
  children: PropTypes.node,
  id: PropTypes.string
};

StandardTextarea.propTypes = {
  label: PropTypes.string,
  required: PropTypes.bool,
  error: PropTypes.string,
  success: PropTypes.string,
  helpText: PropTypes.string,
  className: PropTypes.string,
  inline: PropTypes.bool,
  rows: PropTypes.number,
  id: PropTypes.string
};

StandardFormGroup.propTypes = {
  children: PropTypes.node,
  inline: PropTypes.bool,
  className: PropTypes.string
};

GeologicalMaterialSelect.propTypes = {
  label: PropTypes.string,
  materials: PropTypes.object,
  showColorPreview: PropTypes.bool
};

// Set display names for debugging
StandardInput.displayName = 'StandardInput';
StandardSelect.displayName = 'StandardSelect';  
StandardTextarea.displayName = 'StandardTextarea';
GeologicalMaterialSelect.displayName = 'GeologicalMaterialSelect';

export {
  StandardInput,
  StandardSelect,
  StandardTextarea,
  StandardFormGroup,
  GeologicalMaterialSelect
};