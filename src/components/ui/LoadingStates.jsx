/**
 * Loading States Components
 *
 * Professional loading indicators, skeletons, and status feedback
 * for async operations and state transitions.
 */

import React from 'react';
import './LoadingStates.css';

/**
 * LoadingSkeleton - Shimmer loading placeholder
 */
export function LoadingSkeleton({ width = '100%', height = '20px', variant = 'text', count = 1, className = '' }) {
  const skeletons = Array.from({ length: count }, (_, i) => (
    <div
      key={i}
      className={`loading-skeleton loading-skeleton--${variant} ${className}`}
      style={{ width, height }}
    />
  ));

  return count > 1 ? <div className="loading-skeleton-group">{skeletons}</div> : skeletons[0];
}

/**
 * LoadingSpinner - Circular spinner
 */
export function LoadingSpinner({ size = 'md', color = 'primary', className = '' }) {
  return (
    <div className={`loading-spinner loading-spinner--${size} loading-spinner--${color} ${className}`}>
      <svg className="loading-spinner__svg" viewBox="0 0 50 50">
        <circle
          className="loading-spinner__circle"
          cx="25"
          cy="25"
          r="20"
          fill="none"
          strokeWidth="4"
        />
      </svg>
    </div>
  );
}

/**
 * LoadingOverlay - Full panel loading overlay
 */
export function LoadingOverlay({ message = 'Loading...', transparent = false, className = '' }) {
  return (
    <div className={`loading-overlay ${transparent ? 'loading-overlay--transparent' : ''} ${className}`}>
      <div className="loading-overlay__content">
        <LoadingSpinner size="lg" />
        {message && <div className="loading-overlay__message">{message}</div>}
      </div>
    </div>
  );
}

/**
 * StatusIndicator - Status dot with pulse animation
 */
export function StatusIndicator({ status = 'idle', label, size = 'sm', pulse = true, className = '' }) {
  return (
    <div className={`status-indicator status-indicator--${size} ${className}`}>
      <span
        className={`status-indicator__dot status-indicator__dot--${status} ${pulse ? 'status-indicator__dot--pulse' : ''}`}
      />
      {label && <span className="status-indicator__label">{label}</span>}
    </div>
  );
}

/**
 * ProgressBar - Animated progress bar
 */
export function ProgressBar({ value = 0, max = 100, showPercentage = true, variant = 'default', className = '' }) {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));

  return (
    <div className={`progress-bar progress-bar--${variant} ${className}`}>
      <div className="progress-bar__track">
        <div
          className="progress-bar__fill"
          style={{ width: `${percentage}%` }}
          role="progressbar"
          aria-valuenow={value}
          aria-valuemin={0}
          aria-valuemax={max}
        />
      </div>
      {showPercentage && (
        <div className="progress-bar__label">{Math.round(percentage)}%</div>
      )}
    </div>
  );
}

/**
 * Toast - Temporary notification
 */
export function Toast({ type = 'info', message, icon, onClose, className = '' }) {
  return (
    <div className={`toast toast--${type} ${className}`}>
      <div className="toast__content">
        {icon && <div className="toast__icon">{icon}</div>}
        <div className="toast__message">{message}</div>
      </div>
      {onClose && (
        <button className="toast__close" onClick={onClose} aria-label="Close">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M4.646 4.646a.5.5 0 01.708 0L8 7.293l2.646-2.647a.5.5 0 01.708.708L8.707 8l2.647 2.646a.5.5 0 01-.708.708L8 8.707l-2.646 2.647a.5.5 0 01-.708-.708L7.293 8 4.646 5.354a.5.5 0 010-.708z" />
          </svg>
        </button>
      )}
    </div>
  );
}

/**
 * PanelLoader - Full panel loading state with skeleton
 */
export function PanelLoader({ variant = 'form', className = '' }) {
  if (variant === 'form') {
    return (
      <div className={`panel-loader ${className}`}>
        <LoadingSkeleton width="60%" height="16px" variant="text" />
        <LoadingSkeleton width="100%" height="40px" variant="input" />
        <LoadingSkeleton width="60%" height="16px" variant="text" />
        <LoadingSkeleton width="100%" height="40px" variant="input" />
        <LoadingSkeleton width="80%" height="36px" variant="button" />
      </div>
    );
  }

  if (variant === 'list') {
    return (
      <div className={`panel-loader ${className}`}>
        <LoadingSkeleton width="100%" height="60px" variant="card" count={3} />
      </div>
    );
  }

  return (
    <div className={`panel-loader ${className}`}>
      <LoadingSkeleton width="100%" height="120px" variant="card" />
    </div>
  );
}

export default {
  Skeleton: LoadingSkeleton,
  Spinner: LoadingSpinner,
  Overlay: LoadingOverlay,
  Status: StatusIndicator,
  Progress: ProgressBar,
  Toast,
  PanelLoader
};
