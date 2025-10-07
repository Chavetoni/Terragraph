import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

// Performance and Accessibility Test Component
const PerformanceTestComponent = () => {
  const [colors, setColors] = React.useState([]);
  
  // Track renders for performance testing (just for display, not triggering updates)
  const renderCountRef = React.useRef(0);
  renderCountRef.current += 1;

  // Memoized color generation
  const geologicalColors = React.useMemo(() => ({
    'Sandy': ['#F4A460', '#DEB887', '#D2B48C', '#DDBF94', '#E5D4B1', '#F5DEB3', '#FAEBD7', '#FFF8DC'],
    'Clay/Loam': ['#8B4513', '#A0522D', '#CD853F', '#D2691E', '#B8860B', '#DAA520', '#BDB76B', '#BC9A6A'],
    'Organic/Rock': ['#2F4F4F', '#696969', '#556B2F', '#6B8E23', '#8B7355', '#A0522D', '#8FBC8F', '#9ACD32']
  }), []);

  // Optimized HSL color generation with useMemo
  const hslColors = React.useMemo(() => {
    const colors = [];
    for (let h = 0; h < 360; h += 15) {
      colors.push(`hsl(${h}, 70%, 50%)`);
    }
    return colors;
  }, []);

  // Optimized color selection with useCallback
  const handleColorSelect = React.useCallback((color) => {
    setColors(prev => [...prev, color]);
  }, []);

  return (
    <div data-testid="performance-container">
      <div data-testid="render-count">Renders: {renderCountRef.current}</div>
      
      {/* Geological Colors with proper accessibility */}
      <section 
        aria-label="Geological soil layer color selection"
        data-testid="geological-section"
      >
        <h2>Soil Layer Colors</h2>
        {Object.entries(geologicalColors).map(([category, categoryColors]) => (
          <div key={category} role="group" aria-labelledby={`${category.toLowerCase()}-heading`}>
            <h3 id={`${category.toLowerCase()}-heading`}>{category}</h3>
            <div 
              className="color-grid"
              role="listbox"
              aria-label={`${category} soil colors`}
              data-testid={`${category.toLowerCase().replace('/', '-')}-colors`}
            >
              {categoryColors.map((color, index) => (
                <button
                  key={`${category}-${color}`}
                  data-testid={`color-${color.replace('#', '')}`}
                  role="option"
                  aria-selected="false"
                  aria-label={`${category} soil color ${color}`}
                  className="color-swatch"
                  style={{ 
                    backgroundColor: color,
                    width: '40px',
                    height: '40px',
                    border: '2px solid #ccc',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                  onClick={() => handleColorSelect(color)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleColorSelect(color);
                    }
                  }}
                  tabIndex={0}
                />
              ))}
            </div>
          </div>
        ))}
      </section>

      {/* HSL Colors with accessibility */}
      <section 
        aria-label="Borehole color selection"
        data-testid="hsl-section"
      >
        <h2>Borehole Colors</h2>
        <div 
          className="color-wheel"
          role="listbox"
          aria-label="HSL color wheel"
          data-testid="hsl-color-wheel"
        >
          {hslColors.map((color, index) => (
            <button
              key={index}
              data-testid={`hsl-${index}`}
              role="option"
              aria-selected="false"
              aria-label={`HSL color at ${index * 15} degrees: ${color}`}
              className="color-swatch"
              style={{
                backgroundColor: color,
                width: '30px',
                height: '30px',
                border: '2px solid #333',
                borderRadius: '50%',
                cursor: 'pointer',
                margin: '2px'
              }}
              onClick={() => handleColorSelect(color)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleColorSelect(color);
                }
              }}
              tabIndex={0}
            />
          ))}
        </div>
      </section>

      {/* Selected colors display */}
      <section data-testid="selected-colors" aria-live="polite">
        <h3>Selected Colors ({colors.length})</h3>
        <div role="list" aria-label="Selected colors">
          {colors.slice(-5).map((color, index) => (
            <div key={index} role="listitem" aria-label={`Selected color ${color}`}>
              {color}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

describe('Performance & Accessibility', () => {
  test('renders 40+ earth tones efficiently', () => {
    const { container } = render(<PerformanceTestComponent />);
    
    // Count all color swatches
    const colorButtons = container.querySelectorAll('.color-swatch');
    expect(colorButtons.length).toBeGreaterThanOrEqual(40);
    
    // Verify geological colors are present
    const sandySection = screen.getByTestId('sandy-colors');
    const claySection = screen.getByTestId('clay-loam-colors');
    const organicSection = screen.getByTestId('organic-rock-colors');
    
    expect(sandySection).toBeInTheDocument();
    expect(claySection).toBeInTheDocument();
    expect(organicSection).toBeInTheDocument();
  });

  test('uses React performance optimizations', () => {
    render(<PerformanceTestComponent />);
    
    const renderCountElement = screen.getByTestId('render-count');
    const initialRenderCount = parseInt(renderCountElement.textContent.match(/\d+/)[0]);
    
    // Click a color - should trigger minimal rerenders due to useCallback
    const colorButton = screen.getByTestId('color-F4A460');
    fireEvent.click(colorButton);
    
    // Should have incremented by minimal amount (ideally just 1-2 renders)
    const newRenderCount = parseInt(renderCountElement.textContent.match(/\d+/)[0]);
    expect(newRenderCount - initialRenderCount).toBeLessThanOrEqual(3);
  });

  test('provides proper keyboard navigation support', () => {
    render(<PerformanceTestComponent />);
    
    // Test tabbing to color swatches
    const colorButton = screen.getByTestId('color-F4A460');
    expect(colorButton).toHaveAttribute('tabIndex', '0');
    
    // Test keyboard activation
    colorButton.focus();
    fireEvent.keyDown(colorButton, { key: 'Enter' });
    
    // Should add color to selected colors
    const selectedColors = screen.getByTestId('selected-colors');
    expect(selectedColors).toHaveTextContent('#F4A460');
    
    // Test space key activation
    const hslButton = screen.getByTestId('hsl-0');
    hslButton.focus();
    fireEvent.keyDown(hslButton, { key: ' ', preventDefault: jest.fn() });
    
    expect(selectedColors).toHaveTextContent('hsl(0, 70%, 50%)');
  });

  test('includes comprehensive accessibility attributes', () => {
    render(<PerformanceTestComponent />);
    
    // Test section labels
    const geologicalSection = screen.getByTestId('geological-section');
    expect(geologicalSection).toHaveAttribute('aria-label', 'Geological soil layer color selection');
    
    const hslSection = screen.getByTestId('hsl-section');
    expect(hslSection).toHaveAttribute('aria-label', 'Borehole color selection');
    
    // Test role attributes
    const sandyColors = screen.getByTestId('sandy-colors');
    expect(sandyColors).toHaveAttribute('role', 'listbox');
    expect(sandyColors).toHaveAttribute('aria-label', 'Sandy soil colors');
    
    // Test color button accessibility
    const colorButton = screen.getByTestId('color-F4A460');
    expect(colorButton).toHaveAttribute('role', 'option');
    expect(colorButton).toHaveAttribute('aria-label', 'Sandy soil color #F4A460');
    expect(colorButton).toHaveAttribute('aria-selected', 'false');
    
    // Test HSL color accessibility
    const hslButton = screen.getByTestId('hsl-0');
    expect(hslButton).toHaveAttribute('aria-label', 'HSL color at 0 degrees: hsl(0, 70%, 50%)');
  });

  test('provides live updates for selected colors', () => {
    render(<PerformanceTestComponent />);
    
    const selectedSection = screen.getByTestId('selected-colors');
    expect(selectedSection).toHaveAttribute('aria-live', 'polite');
    
    // Initially shows 0 selected colors
    expect(selectedSection).toHaveTextContent('Selected Colors (0)');
    
    // Click a color
    const colorButton = screen.getByTestId('color-F4A460');
    fireEvent.click(colorButton);
    
    // Should update count
    expect(selectedSection).toHaveTextContent('Selected Colors (1)');
  });

  test('supports efficient color organization for geological workflow', () => {
    render(<PerformanceTestComponent />);
    
    // Test logical color grouping
    const sandyColors = screen.getByTestId('sandy-colors');
    const sandyButtons = sandyColors.querySelectorAll('.color-swatch');
    expect(sandyButtons.length).toBeGreaterThanOrEqual(8); // Sandy earth tones
    
    const clayColors = screen.getByTestId('clay-loam-colors');
    const clayButtons = clayColors.querySelectorAll('.color-swatch');
    expect(clayButtons.length).toBeGreaterThanOrEqual(8); // Brown earth tones
    
    const organicColors = screen.getByTestId('organic-rock-colors');
    const organicButtons = organicColors.querySelectorAll('.color-swatch');
    expect(organicButtons.length).toBeGreaterThanOrEqual(8); // Dark earth tones
  });

  test('provides full spectrum HSL colors for custom borehole types', () => {
    render(<PerformanceTestComponent />);
    
    const hslWheel = screen.getByTestId('hsl-color-wheel');
    const hslButtons = hslWheel.querySelectorAll('.color-swatch');
    
    // Should have 360/15 = 24 colors spanning full spectrum
    expect(hslButtons.length).toBe(24);
    
    // Test that we have colors across the spectrum
    expect(screen.getByTestId('hsl-0')).toBeInTheDocument(); // Red
    expect(screen.getByTestId('hsl-8')).toBeInTheDocument(); // Green area
    expect(screen.getByTestId('hsl-16')).toBeInTheDocument(); // Blue area
  });

  test('maintains performance with large color sets', () => {
    const startTime = performance.now();
    render(<PerformanceTestComponent />);
    const renderTime = performance.now() - startTime;
    
    // Rendering should be fast (under 100ms for color wheels)
    expect(renderTime).toBeLessThan(100);
    
    // Test rapid color selection performance
    const colorButtons = screen.getAllByRole('option');
    expect(colorButtons.length).toBeGreaterThanOrEqual(40);
    
    // Click multiple colors rapidly
    const clickStartTime = performance.now();
    for (let i = 0; i < 5; i++) {
      fireEvent.click(colorButtons[i]);
    }
    const clickTime = performance.now() - clickStartTime;
    
    // Should handle rapid clicks efficiently
    expect(clickTime).toBeLessThan(50);
  });

  test('follows WCAG accessibility guidelines', () => {
    render(<PerformanceTestComponent />);
    
    // Test heading hierarchy
    const mainHeading = screen.getByRole('heading', { level: 2, name: 'Soil Layer Colors' });
    expect(mainHeading).toBeInTheDocument();
    
    const subHeadings = screen.getAllByRole('heading', { level: 3 });
    expect(subHeadings.length).toBeGreaterThanOrEqual(3); // Sandy, Clay/Loam, Organic/Rock
    
    // Test color contrast (buttons should have visible borders)
    const colorButton = screen.getByTestId('color-F4A460');
    const styles = window.getComputedStyle(colorButton);
    expect(styles.border).toBeTruthy();
    
    // Test grouping and labeling
    const groups = screen.getAllByRole('group');
    expect(groups.length).toBe(3); // One for each geological category
    
    // Test list semantics
    const listboxes = screen.getAllByRole('listbox');
    expect(listboxes.length).toBe(4); // 3 geological + 1 HSL
  });
});