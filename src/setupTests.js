// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

// Mock WebGL context for Three.js testing
const mockWebGLContext = {
  DEPTH_BUFFER_BIT: 0x00000100,
  STENCIL_BUFFER_BIT: 0x00000400,
  COLOR_BUFFER_BIT: 0x00004000,
  POINTS: 0x0000,
  LINES: 0x0001,
  TRIANGLES: 0x0004,
  getExtension: () => null,
  getParameter: (param) => {
    switch(param) {
      case 0x1F00: return 'WebGL Mock';
      case 0x1F01: return 'Mock Renderer';
      case 0x1F02: return '1.0';
      case 0x8B8C: return 16;
      default: return null;
    }
  },
  createShader: () => ({}),
  createProgram: () => ({}),
  attachShader: () => {},
  linkProgram: () => {},
  useProgram: () => {},
  createBuffer: () => ({}),
  bindBuffer: () => {},
  bufferData: () => {},
  createTexture: () => ({}),
  bindTexture: () => {},
  texImage2D: () => {},
  texParameteri: () => {},
  createFramebuffer: () => ({}),
  bindFramebuffer: () => {},
  framebufferTexture2D: () => {},
  viewport: () => {},
  clear: () => {},
  drawElements: () => {},
  drawArrays: () => {},
  getUniformLocation: () => ({}),
  uniform1f: () => {},
  uniform1i: () => {},
  uniform3fv: () => {},
  uniformMatrix4fv: () => {},
  getAttribLocation: () => 0,
  enableVertexAttribArray: () => {},
  vertexAttribPointer: () => {},
  enable: () => {},
  disable: () => {},
  depthFunc: () => {},
  blendFunc: () => {},
  cullFace: () => {},
  frontFace: () => {},
  clearColor: () => {},
  clearDepth: () => {},
  canvas: {
    width: 300,
    height: 150,
    style: {},
    addEventListener: () => {},
    removeEventListener: () => {},
    clientWidth: 300,
    clientHeight: 150
  }
};

// Mock HTMLCanvasElement.getContext to return our mock WebGL context
HTMLCanvasElement.prototype.getContext = jest.fn((contextType) => {
  if (contextType === 'webgl' || contextType === 'webgl2') {
    return mockWebGLContext;
  }
  if (contextType === '2d') {
    return {
      fillRect: () => {},
      clearRect: () => {},
      getImageData: () => ({ data: new Array(4) }),
      putImageData: () => {},
      createImageData: () => [],
      setTransform: () => {},
      drawImage: () => {},
      save: () => {},
      fillText: () => {},
      restore: () => {},
      beginPath: () => {},
      moveTo: () => {},
      lineTo: () => {},
      closePath: () => {},
      stroke: () => {},
      translate: () => {},
      scale: () => {},
      rotate: () => {},
      arc: () => {},
      fill: () => {},
      measureText: () => ({ width: 0 }),
      font: '',
      fillStyle: '',
      strokeStyle: ''
    };
  }
  return null;
});

// Mock WebGLRenderingContext for Three.js
global.WebGLRenderingContext = function() {};
global.WebGL2RenderingContext = function() {};

// Three.js Core Classes (actual implementations for math)
class MockVector3 {
  constructor(x = 0, y = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
  }
  set(x, y, z) {
    this.x = x;
    this.y = y;
    this.z = z;
    return this;
  }
  copy(v) {
    this.x = v.x;
    this.y = v.y;
    this.z = v.z;
    return this;
  }
  clone() {
    return new MockVector3(this.x, this.y, this.z);
  }
  add(v) {
    this.x += v.x;
    this.y += v.y;
    this.z += v.z;
    return this;
  }
  sub(v) {
    this.x -= v.x;
    this.y -= v.y;
    this.z -= v.z;
    return this;
  }
  normalize() {
    const length = Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
    if (length !== 0) {
      this.x /= length;
      this.y /= length;
      this.z /= length;
    }
    return this;
  }
  length() {
    return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
  }
}

class MockVector2 {
  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
  }
  set(x, y) {
    this.x = x;
    this.y = y;
    return this;
  }
}

class MockEuler {
  constructor(x = 0, y = 0, z = 0, order = 'XYZ') {
    this.x = x;
    this.y = y;
    this.z = z;
    this.order = order;
  }
}

class MockMatrix4 {
  constructor() {
    this.elements = new Array(16).fill(0);
    this.identity();
  }
  identity() {
    this.elements = [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1];
    return this;
  }
}

class MockQuaternion {
  constructor(x = 0, y = 0, z = 0, w = 1) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.w = w;
  }
}

// Note: Mock implementations for setupTests must avoid using jest.fn() directly
// as it's not available in the module scope. Use simple functions instead.
const mockFn = (returnValue) => {
  const fn = (...args) => {
    if (typeof returnValue === 'function') {
      return returnValue(...args);
    }
    return returnValue;
  };
  return fn;
};

// Make mock implementations available globally for any modules that need them
global.mockThreeClasses = {
  Vector3: MockVector3,
  Vector2: MockVector2,
  Euler: MockEuler,
  Matrix4: MockMatrix4,
  Quaternion: MockQuaternion,
  mockFn
};

// Mock OrbitControls
global.OrbitControls = function() {
  return {
    enableDamping: true,
    dampingFactor: 0.1,
    addEventListener: mockFn(),
    removeEventListener: mockFn(),
    update: mockFn(),
    dispose: mockFn()
  };
};

// Mock ResizeObserver
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Mock requestAnimationFrame
global.requestAnimationFrame = jest.fn((cb) => setTimeout(cb, 16));
global.cancelAnimationFrame = jest.fn();
