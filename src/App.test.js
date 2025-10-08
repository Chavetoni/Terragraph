import { render, screen } from '@testing-library/react';
import { BoreholeProvider } from './contexts/BoreholeContext';
import { UIProvider } from './contexts/UIContext';

jest.mock('three', () => {
  const mockCanvas = {
    width: 300,
    height: 150,
    style: {},
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    clientWidth: 300,
    clientHeight: 150
  };

  const mockObject3D = {
    add: jest.fn(),
    remove: jest.fn(),
    children: [],
    position: { set: jest.fn(), x: 0, y: 0, z: 0 },
    rotation: { set: jest.fn(), x: 0, y: 0, z: 0 },
    scale: { set: jest.fn(), x: 1, y: 1, z: 1 }
  };

  return {
    Scene: jest.fn(() => mockObject3D),
    PerspectiveCamera: jest.fn(() => ({ ...mockObject3D, lookAt: jest.fn() })),
    WebGLRenderer: jest.fn(() => ({ 
      setSize: jest.fn(), 
      setClearColor: jest.fn(),
      domElement: mockCanvas,
      render: jest.fn(),
      dispose: jest.fn()
    })),
    Vector2: jest.fn(() => ({ x: 0, y: 0, set: jest.fn(), copy: jest.fn() })),
    Vector3: jest.fn(() => ({ x: 0, y: 0, z: 0, set: jest.fn(), copy: jest.fn() })),
    Quaternion: jest.fn(() => ({ x: 0, y: 0, z: 0, w: 1, set: jest.fn() })),
    Matrix4: jest.fn(() => ({ elements: new Array(16).fill(0) })),
    Euler: jest.fn(() => ({ x: 0, y: 0, z: 0 })),
    Color: jest.fn(() => ({ r: 1, g: 1, b: 1, setHex: jest.fn() })),
    DirectionalLight: jest.fn(() => mockObject3D),
    AmbientLight: jest.fn(() => mockObject3D),
    GridHelper: jest.fn(() => mockObject3D),
    AxesHelper: jest.fn(() => mockObject3D),
    Mesh: jest.fn(() => mockObject3D),
    Group: jest.fn(() => mockObject3D),
    Object3D: jest.fn(() => mockObject3D),
    BoxGeometry: jest.fn(),
    CylinderGeometry: jest.fn(),
    PlaneGeometry: jest.fn(),
    MeshStandardMaterial: jest.fn(),
    MeshBasicMaterial: jest.fn(),
    TextureLoader: jest.fn(() => ({ load: jest.fn() })),
    Raycaster: jest.fn(() => {
      const mockParams = {
        Points: { threshold: 0.1 },
        Line: { threshold: 0.1 }
      };
      return {
        setFromCamera: jest.fn(), 
        intersectObjects: jest.fn(() => []),
        far: 1000,
        params: mockParams,
        layers: { mask: 1 }
      };
    }),
    MOUSE: { LEFT: 0, MIDDLE: 1, RIGHT: 2 },
    TOUCH: { ROTATE: 0, PAN: 1, DOLLY_PAN: 2, DOLLY_ROTATE: 3 }
  };
});

jest.mock('three/examples/jsm/controls/OrbitControls', () => ({
  OrbitControls: jest.fn(() => ({
    enableDamping: true,
    dampingFactor: 0.05,
    update: jest.fn(),
    dispose: jest.fn()
  }))
}));

jest.mock('three/examples/jsm/renderers/CSS3DRenderer', () => ({
  CSS3DRenderer: jest.fn(() => ({
    setSize: jest.fn(),
    domElement: { style: {} },
    render: jest.fn()
  })),
  CSS3DObject: jest.fn(() => ({
    position: { set: jest.fn() },
    rotation: { set: jest.fn() }
  }))
}));

jest.mock('./contexts/ThreeJsContext', () => {
  const mockContext = {
    scene: null,
    camera: null,
    renderer: null,
    sceneManager: null,
    isInitialized: false
  };
  return {
    ThreeJsContext: require('react').createContext(mockContext),
    ThreeJsProvider: ({ children }) => children,
    useThreeJsScene: () => mockContext
  };
});

jest.mock('./contexts/LayersContext', () => ({
  LayersProvider: ({ children }) => children,
  useLayers: () => ({ layers: [] })
}));

jest.mock('./contexts/DisplayOptionsContext', () => ({
  DisplayOptionsProvider: ({ children }) => children,
  useDisplayOptions: () => ({ displayOptions: {} })
}));

jest.mock('./utils/scaleConstants', () => ({
  getBoreholeDimensions: () => ({ diameter: 0.15, length: 10 })
}));

jest.mock('./services/BoreholeVisualizer', () => ({
  BoreholeVisualizer: jest.fn()
}));

jest.mock('./utils/threeJsHelpers', () => ({
  createGlassmorphismLabel: jest.fn()
}));

jest.mock('./contexts/GeologicalModelingContext', () => ({
  GeologicalModelingProvider: ({ children }) => children,
  useGeologicalModeling: () => ({
    updateCapabilities: jest.fn(),
    modelingMode: 'conceptual',
    capabilities: {
      canUseDataDriven: false,
      boreholeCount: 0,
      hasLayerData: false,
      hasSpatialData: false
    }
  })
}));

jest.mock('./contexts/BoreholeContext', () => ({
  BoreholeProvider: ({ children }) => children,
  useBoreholes: () => ({
    boreholes: [],
    selectedBorehole: null,
    addBorehole: jest.fn(),
    removeBorehole: jest.fn(),
    selectBorehole: jest.fn()
  })
}));

describe('App Component', () => {
  test('renders app layout components', () => {
    const MockApp = () => (
      <UIProvider>
        <BoreholeProvider>
          <div data-testid="app-container">
            <div data-testid="sidebar">Sidebar</div>
            <div data-testid="main-panel">Main Panel</div>
            <div data-testid="right-panel">Right Panel</div>
          </div>
        </BoreholeProvider>
      </UIProvider>
    );

    render(<MockApp />);
    expect(screen.getByTestId('app-container')).toBeInTheDocument();
    expect(screen.getByTestId('sidebar')).toBeInTheDocument();
    expect(screen.getByTestId('main-panel')).toBeInTheDocument();
    expect(screen.getByTestId('right-panel')).toBeInTheDocument();
  });

  test('context providers are available', () => {
    const TestComponent = () => {
      return <div data-testid="context-test">Context Test</div>;
    };

    const WrappedComponent = () => (
      <UIProvider>
        <BoreholeProvider>
          <TestComponent />
        </BoreholeProvider>
      </UIProvider>
    );

    render(<WrappedComponent />);
    expect(screen.getByTestId('context-test')).toBeInTheDocument();
  });
});
