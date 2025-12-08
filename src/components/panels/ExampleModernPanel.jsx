/**
 * Example Modern Panel Component
 *
 * Comprehensive demonstration of the new panel design patterns.
 * Use this as a reference when building or refactoring panels.
 *
 * Demonstrates:
 * - PanelSection with badges and icons
 * - Layout components (Grid, Stack, Inline, Divider)
 * - Empty states
 * - Loading states
 * - Status indicators
 * - Field groups
 * - Proper state management
 */

import { useState } from 'react';
import {
  PanelSection,
  BADGE_VARIANTS,
  PanelStack,
  PanelGrid,
  PanelInline,
  PanelDivider,
  PanelFieldGroup,
  PanelCard,
  PanelEmptyState,
  LoadingSkeleton,
  LoadingSpinner,
  LoadingOverlay,
  StatusIndicator,
  ProgressBar,
  Toast
} from '../ui';

export function ExampleModernPanel() {
  const [expandedSections, setExpandedSections] = useState({
    basic: true,
    advanced: false,
    features: false,
    loading: false
  });

  const [isLoading, setIsLoading] = useState(false);
  const [hasData, setHasData] = useState(true);
  const [showToast, setShowToast] = useState(false);
  const [progress, setProgress] = useState(45);

  const toggleSection = (section) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // Example settings state
  const [settings, setSettings] = useState({
    quality: 'high',
    resolution: 50,
    enableFeature: true
  });

  // Icon components (using inline SVG for demonstration)
  const SettingsIcon = (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
      <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
    </svg>
  );

  const StarIcon = (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
    </svg>
  );

  return (
    <div className="example-modern-panel">
      {/* ===== BASIC SECTION ===== */}
      <PanelSection
        title="Basic Settings"
        subtitle="Essential configuration options"
        icon={SettingsIcon}
        badge="Required"
        badgeVariant={BADGE_VARIANTS.required}
        isOpen={expandedSections.basic}
        onToggle={() => toggleSection('basic')}
      >
        <PanelStack spacing="lg">
          <PanelFieldGroup label="Quality Mode" hint="Higher quality requires more processing" required>
            <select
              value={settings.quality}
              onChange={(e) => setSettings({ ...settings, quality: e.target.value })}
              className="input-glass"
              style={{ width: '100%', padding: '10px 12px' }}
            >
              <option value="low">Low - Fast performance</option>
              <option value="medium">Medium - Balanced</option>
              <option value="high">High - Best quality</option>
            </select>
          </PanelFieldGroup>

          <PanelFieldGroup
            label="Grid Resolution"
            hint="Number of grid points (higher = more detail, slower)"
          >
            <PanelInline align="space-between" gap="md">
              <input
                type="range"
                min="10"
                max="100"
                value={settings.resolution}
                onChange={(e) => setSettings({ ...settings, resolution: e.target.value })}
                style={{ flex: 1 }}
              />
              <span style={{ color: 'var(--text-primary)', minWidth: '40px', textAlign: 'right' }}>
                {settings.resolution}
              </span>
            </PanelInline>
          </PanelFieldGroup>

          <PanelDivider spacing="md" />

          <PanelGrid columns={2} gap="md">
            <PanelCard variant="default" title="Performance">
              <StatusIndicator status="success" label="Optimal" pulse />
            </PanelCard>
            <PanelCard variant="highlight" title="Memory">
              <StatusIndicator status="warning" label="75% Used" pulse={false} />
            </PanelCard>
          </PanelGrid>
        </PanelStack>
      </PanelSection>

      {/* ===== ADVANCED SECTION WITH FEATURES ===== */}
      <PanelSection
        title="Advanced Features"
        icon={StarIcon}
        badge="Professional"
        badgeVariant={BADGE_VARIANTS.professional}
        isOpen={expandedSections.advanced}
        onToggle={() => toggleSection('advanced')}
      >
        <PanelStack spacing="md">
          <PanelFieldGroup label="Enable Advanced Mode">
            <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={settings.enableFeature}
                onChange={(e) => setSettings({ ...settings, enableFeature: e.target.checked })}
              />
              <span style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
                Enable experimental features
              </span>
            </label>
          </PanelFieldGroup>

          <PanelDivider text="Status" spacing="lg" />

          <PanelInline align="space-between">
            <StatusIndicator status="active" label="System Active" size="md" />
            <StatusIndicator status="loading" label="Processing" size="md" pulse />
            <StatusIndicator status="idle" label="Idle" size="md" pulse={false} />
          </PanelInline>
        </PanelStack>
      </PanelSection>

      {/* ===== LOADING STATES DEMONSTRATION ===== */}
      <PanelSection
        title="Loading States"
        badge="Examples"
        badgeVariant={BADGE_VARIANTS.info}
        isOpen={expandedSections.loading}
        onToggle={() => toggleSection('loading')}
      >
        <PanelStack spacing="lg">
          <PanelInline align="space-between">
            <button className="btn-glass" onClick={() => setIsLoading(!isLoading)}>
              Toggle Loading
            </button>
            <button className="btn-glass" onClick={() => setHasData(!hasData)}>
              Toggle Data
            </button>
            <button className="btn-primary" onClick={() => setShowToast(!showToast)}>
              Show Toast
            </button>
          </PanelInline>

          <PanelDivider spacing="md" />

          {isLoading ? (
            <div style={{ position: 'relative', minHeight: '120px' }}>
              <LoadingSkeleton count={3} height="40px" />
            </div>
          ) : hasData ? (
            <>
              <PanelFieldGroup label="Progress Example">
                <ProgressBar value={progress} max={100} variant="default" />
              </PanelFieldGroup>

              <PanelInline align="center" gap="lg">
                <LoadingSpinner size="sm" color="primary" />
                <LoadingSpinner size="md" color="success" />
                <LoadingSpinner size="lg" color="warning" />
              </PanelInline>
            </>
          ) : (
            <PanelEmptyState
              icon="default"
              title="No data available"
              description="Toggle the data switch above to see content"
              actionLabel="Add Data"
              onAction={() => setHasData(true)}
            />
          )}
        </PanelStack>
      </PanelSection>

      {/* ===== EMPTY STATE EXAMPLES ===== */}
      <PanelSection
        title="Empty State Examples"
        badge="Visual"
        badgeVariant={BADGE_VARIANTS.visual}
        isOpen={expandedSections.features}
        onToggle={() => toggleSection('features')}
      >
        <PanelStack spacing="xl">
          <PanelCard variant="default">
            <PanelEmptyState
              icon="layers"
              title="No layers defined"
              description="Add your first geological layer to get started"
              actionLabel="Add Layer"
              onAction={() => console.log('Add layer clicked')}
            />
          </PanelCard>

          <PanelCard variant="default">
            <PanelEmptyState
              icon="boreholes"
              title="No boreholes imported"
              description="Import borehole data from CSV or Excel files"
            />
          </PanelCard>
        </PanelStack>
      </PanelSection>

      {/* ===== TOAST NOTIFICATION ===== */}
      {showToast && (
        <div style={{ position: 'fixed', top: '20px', right: '20px', zIndex: 9999 }}>
          <Toast
            type="success"
            message="Settings saved successfully!"
            icon={
              <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
            }
            onClose={() => setShowToast(false)}
          />
        </div>
      )}
    </div>
  );
}

export default ExampleModernPanel;
