import React from 'react';
import PropTypes from 'prop-types';

/**
 * StandardButton Component
 * Standardized button component using the new design system CSS classes
 * Supports multiple variants, sizes, and states
 */
const StandardButton = ({
  variant = 'primary',
  size = 'default',
  fullWidth = false,
  disabled = false,
  loading = false,
  icon = null,
  iconPosition = 'left',
  onClick,
  onFocus,
  onBlur,
  className = '',
  children,
  ...props
}) => {
  // Determine the base CSS class based on variant
  const getVariantClass = () => {
    switch (variant) {
      case 'primary':
        return 'btn-primary-new';
      case 'secondary':
        return 'btn-secondary-new';
      case 'danger':
        return 'btn-danger-new';
      case 'success':
        return 'btn-success-new';
      case 'icon':
        return 'btn-icon-new';
      default:
        return 'btn-primary-new';
    }
  };

  // Determine size class
  const getSizeClass = () => {
    switch (size) {
      case 'small':
        return 'btn-sm';
      case 'large':
        return 'btn-lg';
      default:
        return '';
    }
  };

  // Build the complete className
  const buttonClassName = [
    getVariantClass(),
    getSizeClass(),
    fullWidth ? 'btn-full' : '',
    loading ? 'loading' : '',
    className
  ].filter(Boolean).join(' ');

  // Handle click events
  const handleClick = (event) => {
    if (!disabled && !loading && onClick) {
      onClick(event);
    }
  };

  // Render icon if provided
  const renderIcon = () => {
    if (loading) {
      return <LoadingSpinner size={variant === 'icon' ? 16 : 14} />;
    }
    
    if (icon) {
      return (
        <span 
          className="btn-icon" 
          style={{ 
            display: 'inline-flex', 
            alignItems: 'center',
            fontSize: variant === 'icon' ? '16px' : '14px'
          }}
        >
          {icon}
        </span>
      );
    }
    
    return null;
  };

  return (
    <button
      className={buttonClassName}
      disabled={disabled || loading}
      onClick={handleClick}
      onFocus={onFocus}
      onBlur={onBlur}
      aria-label={props['aria-label']}
      title={props.title}
      type={props.type || 'button'}
      {...props}
    >
      {iconPosition === 'left' && renderIcon()}
      {variant !== 'icon' && children && (
        <span className="btn-text">{children}</span>
      )}
      {iconPosition === 'right' && renderIcon()}
    </button>
  );
};

/**
 * Loading Spinner Component
 * Simple spinning icon for loading states
 */
const LoadingSpinner = ({ size = 14 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{
      animation: 'spin 1s linear infinite',
    }}
  >
    <path d="M21 12a9 9 0 11-6.219-8.56" />
  </svg>
);

// PropTypes for type checking
StandardButton.propTypes = {
  variant: PropTypes.oneOf(['primary', 'secondary', 'danger', 'success', 'icon']),
  size: PropTypes.oneOf(['small', 'default', 'large']),
  fullWidth: PropTypes.bool,
  disabled: PropTypes.bool,
  loading: PropTypes.bool,
  icon: PropTypes.node,
  iconPosition: PropTypes.oneOf(['left', 'right']),
  onClick: PropTypes.func,
  onFocus: PropTypes.func,
  onBlur: PropTypes.func,
  className: PropTypes.string,
  children: PropTypes.node,
  'aria-label': PropTypes.string,
  title: PropTypes.string,
  type: PropTypes.oneOf(['button', 'submit', 'reset'])
};

// Add the spin animation to the CSS if it doesn't exist
const addSpinAnimation = () => {
  if (typeof document !== 'undefined') {
    const styleId = 'standard-button-animations';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `;
      document.head.appendChild(style);
    }
  }
};

// Add animation on component load
if (typeof window !== 'undefined') {
  addSpinAnimation();
}

export default StandardButton;