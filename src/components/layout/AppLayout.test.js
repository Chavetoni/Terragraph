import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock window.matchMedia for responsive design testing
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock ResizeObserver
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Simple responsive layout component for testing
const ResponsiveLayoutTest = () => {
  const [isMobile, setIsMobile] = React.useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false);

  React.useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return (
    <div 
      data-testid="layout-container" 
      className={`layout ${isMobile ? 'mobile' : 'desktop'}`}
      style={{ display: 'flex', width: '100%' }}
    >
      <div 
        data-testid="sidebar"
        className={`sidebar ${sidebarCollapsed ? 'collapsed' : 'expanded'}`}
        style={{ 
          width: isMobile ? '100%' : sidebarCollapsed ? '60px' : '240px',
          backgroundColor: '#f0f0f0',
          transition: 'width 0.3s'
        }}
      >
        <button 
          data-testid="sidebar-toggle"
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          style={{ padding: '10px' }}
        >
          {sidebarCollapsed ? '→' : '←'}
        </button>
        {!sidebarCollapsed && (
          <div data-testid="sidebar-content">
            <h3>Navigation</h3>
            <ul>
              <li>Boreholes</li>
              <li>Soil Layers</li>
              <li>Site Map</li>
            </ul>
          </div>
        )}
      </div>

      <div 
        data-testid="main-content"
        className="main-content"
        style={{ 
          flex: 1,
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row'
        }}
      >
        <div 
          data-testid="main-panel"
          style={{ 
            flex: isMobile ? '1' : '2',
            padding: '20px',
            backgroundColor: '#ffffff'
          }}
        >
          <h2>Main Panel</h2>
          <div data-testid="borehole-creation-modal" className="modal">
            <div 
              className="modal-content"
              style={{ 
                width: isMobile ? '95vw' : '600px',
                maxWidth: isMobile ? '100%' : '90vw',
                height: isMobile ? '80vh' : 'auto',
                overflow: isMobile ? 'auto' : 'visible'
              }}
            >
              <h3>Borehole Creation</h3>
              <div className="color-wheels" data-testid="color-wheels">
                <div 
                  className="geological-colors"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: isMobile ? 'repeat(3, 1fr)' : 'repeat(5, 1fr)',
                    gap: '10px'
                  }}
                  data-testid="geological-color-grid"
                >
                  {[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15].map(i => (
                    <div key={i} data-testid={`color-${i}`} style={{ 
                      width: isMobile ? '30px' : '40px', 
                      height: isMobile ? '30px' : '40px',
                      backgroundColor: `hsl(${i * 24}, 70%, 50%)`
                    }} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {!isMobile && (
          <div 
            data-testid="right-panel"
            style={{ 
              flex: '1',
              padding: '20px',
              backgroundColor: '#f9f9f9'
            }}
          >
            <h3>Controls</h3>
            <div data-testid="display-controls">
              <label>
                <input type="checkbox" />
                Show Grid
              </label>
              <label>
                <input type="checkbox" />
                Show Labels
              </label>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

describe('Responsive Design', () => {
  // Mock window dimensions
  const mockWindowDimensions = (width, height) => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: width,
    });
    Object.defineProperty(window, 'innerHeight', {
      writable: true,
      configurable: true,
      value: height,
    });
  };

  beforeEach(() => {
    // Reset to desktop size
    mockWindowDimensions(1024, 768);
  });

  test('adapts layout for desktop screens (1024px+)', () => {
    mockWindowDimensions(1024, 768);
    render(<ResponsiveLayoutTest />);
    
    const container = screen.getByTestId('layout-container');
    const sidebar = screen.getByTestId('sidebar');
    const mainContent = screen.getByTestId('main-content');
    const rightPanel = screen.getByTestId('right-panel');
    
    expect(container).toHaveClass('desktop');
    expect(sidebar).toHaveStyle('width: 240px');
    expect(rightPanel).toBeInTheDocument(); // Right panel visible on desktop
    expect(mainContent).toHaveStyle('flex-direction: row');
  });

  test('adapts layout for tablet screens (768px - 1023px)', () => {
    mockWindowDimensions(800, 600);
    render(<ResponsiveLayoutTest />);
    
    const container = screen.getByTestId('layout-container');
    const sidebar = screen.getByTestId('sidebar');
    const colorGrid = screen.getByTestId('geological-color-grid');
    
    expect(container).toHaveClass('desktop'); // Still desktop layout
    expect(sidebar).toHaveStyle('width: 240px');
    // Color grid should adapt
    expect(colorGrid).toHaveStyle('grid-template-columns: repeat(5, 1fr)');
  });

  test('adapts layout for mobile screens (<768px)', () => {
    mockWindowDimensions(400, 800);
    
    // Trigger resize event
    render(<ResponsiveLayoutTest />);
    fireEvent.resize(window);
    
    const container = screen.getByTestId('layout-container');
    const sidebar = screen.getByTestId('sidebar');
    const mainContent = screen.getByTestId('main-content');
    const colorGrid = screen.getByTestId('geological-color-grid');
    
    expect(container).toHaveClass('mobile');
    expect(sidebar).toHaveStyle('width: 100%'); // Full width on mobile
    expect(mainContent).toHaveStyle('flex-direction: column');
    expect(colorGrid).toHaveStyle('grid-template-columns: repeat(3, 1fr)');
    
    // Right panel should be hidden on mobile
    expect(screen.queryByTestId('right-panel')).not.toBeInTheDocument();
  });

  test('borehole creation modal adapts to screen size', () => {
    // Desktop
    mockWindowDimensions(1024, 768);
    const { rerender } = render(<ResponsiveLayoutTest />);
    
    let modal = screen.getByTestId('borehole-creation-modal');
    let modalContent = modal.querySelector('.modal-content');
    expect(modalContent).toHaveStyle('width: 600px');
    
    // Mobile
    mockWindowDimensions(400, 800);
    rerender(<ResponsiveLayoutTest />);
    fireEvent.resize(window);
    
    modal = screen.getByTestId('borehole-creation-modal');
    modalContent = modal.querySelector('.modal-content');
    expect(modalContent).toHaveStyle('width: 95vw');
    expect(modalContent).toHaveStyle('height: 80vh');
  });

  test('sidebar can be collapsed and expanded', () => {
    render(<ResponsiveLayoutTest />);
    
    const sidebar = screen.getByTestId('sidebar');
    const toggleButton = screen.getByTestId('sidebar-toggle');
    const sidebarContent = screen.getByTestId('sidebar-content');
    
    // Initially expanded
    expect(sidebar).toHaveStyle('width: 240px');
    expect(sidebarContent).toBeInTheDocument();
    expect(toggleButton).toHaveTextContent('←');
    
    // Click to collapse
    fireEvent.click(toggleButton);
    expect(sidebar).toHaveStyle('width: 60px');
    expect(screen.queryByTestId('sidebar-content')).not.toBeInTheDocument();
    expect(toggleButton).toHaveTextContent('→');
    
    // Click to expand
    fireEvent.click(toggleButton);
    expect(sidebar).toHaveStyle('width: 240px');
    expect(screen.getByTestId('sidebar-content')).toBeInTheDocument();
    expect(toggleButton).toHaveTextContent('←');
  });

  test('color grid adapts number of columns based on screen size', () => {
    // Desktop: 5 columns
    mockWindowDimensions(1024, 768);
    const { rerender } = render(<ResponsiveLayoutTest />);
    
    let colorGrid = screen.getByTestId('geological-color-grid');
    expect(colorGrid).toHaveStyle('grid-template-columns: repeat(5, 1fr)');
    
    // Mobile: 3 columns
    mockWindowDimensions(400, 800);
    rerender(<ResponsiveLayoutTest />);
    fireEvent.resize(window);
    
    colorGrid = screen.getByTestId('geological-color-grid');
    expect(colorGrid).toHaveStyle('grid-template-columns: repeat(3, 1fr)');
  });

  test('color swatches resize for touch interaction on mobile', () => {
    // Desktop: larger swatches
    mockWindowDimensions(1024, 768);
    const { rerender } = render(<ResponsiveLayoutTest />);
    
    let colorSwatch = screen.getByTestId('color-1');
    expect(colorSwatch).toHaveStyle('width: 40px');
    expect(colorSwatch).toHaveStyle('height: 40px');
    
    // Mobile: smaller but touch-friendly swatches
    mockWindowDimensions(400, 800);
    rerender(<ResponsiveLayoutTest />);
    fireEvent.resize(window);
    
    colorSwatch = screen.getByTestId('color-1');
    expect(colorSwatch).toHaveStyle('width: 30px');
    expect(colorSwatch).toHaveStyle('height: 30px');
  });

  test('handles orientation changes on mobile devices', () => {
    // Portrait mobile
    mockWindowDimensions(400, 800);
    render(<ResponsiveLayoutTest />);
    
    expect(screen.getByTestId('layout-container')).toHaveClass('mobile');
    
    // Landscape tablet (above mobile breakpoint)
    mockWindowDimensions(800, 400);
    fireEvent.resize(window);
    
    // Wait a bit for state update and rerender
    expect(screen.getByTestId('layout-container')).toHaveClass('desktop');
  });
});