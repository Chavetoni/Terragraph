import React from 'react';

/**
 * Specialized Error Boundary for Geological Modeling Components
 * Handles 3D rendering errors, WebGL issues, and geological calculation failures
 */
class GeologicalErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      errorType: null,
      error: null,
      errorInfo: null,
      webGLSupported: true,
      retryCount: 0,
      lastErrorTime: null
    };
  }

  componentDidMount() {
    // Check WebGL support on mount
    this.checkWebGLSupport();
    
    // Listen for WebGL context loss/restore
    if (typeof window !== 'undefined') {
      window.addEventListener('webglcontextlost', this.handleContextLost);
      window.addEventListener('webglcontextrestored', this.handleContextRestored);
    }
  }

  componentWillUnmount() {
    if (typeof window !== 'undefined') {
      window.removeEventListener('webglcontextlost', this.handleContextLost);
      window.removeEventListener('webglcontextrestored', this.handleContextRestored);
    }
  }

  checkWebGLSupport = () => {
    try {
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      this.setState({ webGLSupported: !!context });
      
      if (context) {
        // Check for common WebGL extensions
        const debugInfo = context.getExtension('WEBGL_debug_renderer_info');
        if (debugInfo) {
          const renderer = context.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
          // Check for software rendering which might cause issues
          if (renderer && renderer.toLowerCase().includes('software')) {
            console.warn('WebGL is using software rendering, performance may be limited');
          }
        }
      }
    } catch (e) {
      this.setState({ webGLSupported: false });
    }
  };

  handleContextLost = (event) => {
    event.preventDefault();
    this.setState({
      hasError: true,
      errorType: 'webgl_context_lost',
      error: new Error('WebGL context was lost')
    });
  };

  handleContextRestored = () => {
    this.setState({
      hasError: false,
      errorType: null,
      error: null
    });
  };

  static getDerivedStateFromError(error) {
    // Categorize the error type
    let errorType = 'general';
    const message = error.message?.toLowerCase() || '';
    const stack = error.stack?.toLowerCase() || '';

    if (message.includes('webgl') || message.includes('three') || stack.includes('three')) {
      errorType = 'webgl_rendering';
    } else if (message.includes('memory') || message.includes('out of memory')) {
      errorType = 'memory';
    } else if (message.includes('interpolation') || message.includes('geological') || message.includes('borehole')) {
      errorType = 'geological_calculation';
    } else if (message.includes('network') || message.includes('fetch')) {
      errorType = 'network';
    }

    return {
      hasError: true,
      errorType,
      lastErrorTime: Date.now()
    };
  }

  componentDidCatch(error, errorInfo) {
    this.setState(prevState => ({
      error,
      errorInfo,
      retryCount: prevState.retryCount + 1
    }));

    // Log geological-specific error details
    if (process.env.NODE_ENV === 'development') {
      console.error('Geological Error Boundary:', error);
      console.error('Error Type:', this.state.errorType);
      console.error('Component Stack:', errorInfo.componentStack);
    }

    // Attempt cleanup for rendering errors
    if (this.state.errorType === 'webgl_rendering' || this.state.errorType === 'memory') {
      this.cleanupThreeJSResources();
    }

    // Report to error tracking service
    if (process.env.NODE_ENV === 'production' && window.errorReporting) {
      window.errorReporting.captureException(error, {
        tags: {
          errorBoundary: 'geological',
          errorType: this.state.errorType,
          webglSupported: this.state.webGLSupported
        },
        extra: {
          componentStack: errorInfo.componentStack,
          retryCount: this.state.retryCount
        }
      });
    }
  }

  cleanupThreeJSResources = () => {
    try {
      // Attempt to clean up Three.js resources
      if (window.THREE && window.scene) {
        window.scene.traverse((object) => {
          if (object.geometry) object.geometry.dispose();
          if (object.material) {
            if (Array.isArray(object.material)) {
              object.material.forEach(material => material.dispose());
            } else {
              object.material.dispose();
            }
          }
          if (object.texture) object.texture.dispose();
        });
      }
    } catch (cleanupError) {
      console.warn('Failed to cleanup Three.js resources:', cleanupError);
    }
  };

  handleRetry = () => {
    this.setState({
      hasError: false,
      errorType: null,
      error: null,
      errorInfo: null
    });
  };

  handleReduceComplexity = () => {
    // Signal to parent components to reduce complexity
    if (this.props.onReduceComplexity) {
      this.props.onReduceComplexity();
    }
    this.handleRetry();
  };

  renderErrorContent() {
    const { errorType, retryCount, webGLSupported } = this.state;

    if (!webGLSupported) {
      return (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <div className="flex items-center">
            <svg className="w-6 h-6 text-yellow-400 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <h3 className="text-lg font-medium text-yellow-800">WebGL Not Supported</h3>
          </div>
          <p className="text-yellow-700 mt-2">
            Your browser or graphics card doesn't support WebGL, which is required for 3D geological visualization.
          </p>
          <p className="text-yellow-600 mt-2 text-sm">
            Please try using a modern browser like Chrome, Firefox, or Edge, or update your graphics drivers.
          </p>
        </div>
      );
    }

    const errorMessages = {
      webgl_rendering: {
        title: '3D Rendering Error',
        description: 'An error occurred in the 3D geological visualization engine.',
        suggestions: [
          'Update your graphics drivers',
          'Try reducing the model complexity',
          'Close other graphics-intensive applications',
          'Restart your browser'
        ]
      },
      memory: {
        title: 'Memory Error',
        description: 'The application ran out of memory while processing geological data.',
        suggestions: [
          'Reduce the number of boreholes',
          'Lower the interpolation grid resolution',
          'Close other browser tabs',
          'Restart your browser'
        ]
      },
      geological_calculation: {
        title: 'Geological Calculation Error',
        description: 'An error occurred during geological modeling or interpolation.',
        suggestions: [
          'Check your borehole data for inconsistencies',
          'Try using a different interpolation method',
          'Reduce the model complexity',
          'Verify coordinate system settings'
        ]
      },
      webgl_context_lost: {
        title: 'Graphics Context Lost',
        description: 'The graphics context was lost, possibly due to system graphics reset.',
        suggestions: [
          'Wait a moment and try again',
          'Close graphics-intensive applications',
          'Update graphics drivers',
          'Restart your browser if the problem persists'
        ]
      },
      network: {
        title: 'Network Error',
        description: 'A network error occurred while loading geological data.',
        suggestions: [
          'Check your internet connection',
          'Try refreshing the page',
          'Contact support if the problem persists'
        ]
      },
      general: {
        title: 'Geological Model Error',
        description: 'An unexpected error occurred in the geological modeling system.',
        suggestions: [
          'Try refreshing the page',
          'Check your input data',
          'Contact support if the problem persists'
        ]
      }
    };

    const errorConfig = errorMessages[errorType] || errorMessages.general;

    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="flex items-center mb-4">
          <svg className="w-6 h-6 text-red-400 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <h3 className="text-lg font-medium text-red-800">{errorConfig.title}</h3>
        </div>

        <p className="text-red-700 mb-4">{errorConfig.description}</p>

        <div className="flex space-x-3 mb-6">
          <button
            onClick={this.handleRetry}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors font-medium"
          >
            Try Again
          </button>
          
          {(errorType === 'webgl_rendering' || errorType === 'memory') && (
            <button
              onClick={this.handleReduceComplexity}
              className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 transition-colors font-medium"
            >
              Reduce Complexity & Retry
            </button>
          )}
        </div>

        <div className="bg-red-100 rounded p-4">
          <h4 className="font-medium text-red-800 mb-2">Troubleshooting Suggestions:</h4>
          <ul className="text-red-700 text-sm space-y-1">
            {errorConfig.suggestions.map((suggestion, idx) => (
              <li key={idx}>• {suggestion}</li>
            ))}
          </ul>
        </div>

        {retryCount > 2 && (
          <div className="mt-4 bg-yellow-100 border border-yellow-300 rounded p-3">
            <p className="text-yellow-800 text-sm font-medium">
              Multiple errors detected ({retryCount} attempts)
            </p>
            <p className="text-yellow-700 text-sm mt-1">
              Consider refreshing the page or reducing model complexity if problems persist.
            </p>
          </div>
        )}

        {process.env.NODE_ENV === 'development' && this.state.error && (
          <details className="mt-4">
            <summary className="cursor-pointer text-red-700 font-medium">
              Developer Details
            </summary>
            <div className="mt-2 bg-red-200 p-3 rounded text-xs overflow-auto">
              <pre className="text-red-800">{this.state.error.toString()}</pre>
              {this.state.errorInfo?.componentStack && (
                <pre className="mt-2 text-red-800">{this.state.errorInfo.componentStack}</pre>
              )}
            </div>
          </details>
        )}
      </div>
    );
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="geological-error-boundary p-6 m-4 max-w-4xl">
          {this.renderErrorContent()}
        </div>
      );
    }

    return this.props.children;
  }
}

export default GeologicalErrorBoundary;