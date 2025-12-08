/**
 * UI Components Export Index
 *
 * Central export point for all reusable UI components.
 * Import from here for cleaner code: import { PanelSection, LoadingSpinner } from '../ui'
 */

// Panel Components
export { PanelSection, BADGE_VARIANTS } from './PanelSection';
export {
  PanelStack,
  PanelGrid,
  PanelInline,
  PanelDivider,
  PanelFieldGroup,
  PanelCard
} from './PanelLayout';
export { PanelEmptyState } from './PanelEmptyState';

// Loading States
export {
  LoadingSkeleton,
  LoadingSpinner,
  LoadingOverlay,
  StatusIndicator,
  ProgressBar,
  Toast,
  PanelLoader
} from './LoadingStates';

// Legacy Components (for backward compatibility)
export { default as CollapsibleSection } from './CollapsibleSection';
export { default as UnifiedAccordion } from './UnifiedAccordion';
