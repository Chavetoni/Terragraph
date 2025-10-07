import React from 'react';

/**
 * Generic Error Boundary for catching and handling React errors
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null
    };
  }

  static getDerivedStateFromError(error) {
    return { 
      hasError: true,
      errorId: Date.now() + Math.random()
    };
  }

  componentDidCatch(error, errorInfo) {
    // Store error details
    this.setState({
      error,
      errorInfo
    });

    // Log error for development
    if (process.env.NODE_ENV === 'development') {
      console.error('Error Boundary caught error:', error);
      console.error('Component stack:', errorInfo.componentStack);
    }

    // Report error in production (if reporting service available)
    if (process.env.NODE_ENV === 'production' && window.errorReporting) {
      window.errorReporting.captureException(error, {
        tags: {
          component: this.props.name || 'Unknown',
          errorBoundary: true
        },
        extra: {
          componentStack: errorInfo.componentStack,
          errorId: this.state.errorId
        }
      });
    }
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null
    });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary p-6 m-4 bg-red-50 border border-red-200 rounded-lg max-w-4xl">
          <div className="flex items-center mb-4">
            <div className="flex-shrink-0">
              <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-lg font-medium text-red-800">
                {this.props.title || 'Something went wrong'}
              </h3>
              <p className="text-red-700 mt-1">
                {this.props.message || 'An unexpected error occurred in this component.'}
              </p>
            </div>
          </div>

          <div className="bg-red-100 rounded p-3 mb-4">
            <p className="text-sm text-red-600">
              <strong>Error ID:</strong> {this.state.errorId}
            </p>
            <p className="text-sm text-red-600 mt-1">
              <strong>Component:</strong> {this.props.name || 'Unknown'}
            </p>
          </div>

          {process.env.NODE_ENV === 'development' && this.state.error && (
            <details className="mb-4">
              <summary className="cursor-pointer text-red-700 font-medium mb-2">
                Developer Information (Development Mode)
              </summary>
              <div className="bg-red-200 p-3 rounded text-xs overflow-auto">
                <div className="mb-2">
                  <strong>Error:</strong>
                  <pre className="mt-1 text-red-800">{this.state.error.toString()}</pre>
                </div>
                {this.state.errorInfo?.componentStack && (
                  <div>
                    <strong>Component Stack:</strong>
                    <pre className="mt-1 text-red-800">{this.state.errorInfo.componentStack}</pre>
                  </div>
                )}
              </div>
            </details>
          )}

          <div className="flex space-x-3">
            <button
              onClick={this.handleRetry}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
            >
              Try Again
            </button>
            
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center px-4 py-2 border border-red-300 text-sm font-medium rounded-md text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
            >
              Reload Page
            </button>
          </div>

          {this.props.showTips !== false && (
            <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded p-4">
              <h4 className="text-sm font-medium text-yellow-800 mb-2">Troubleshooting Tips:</h4>
              <ul className="text-sm text-yellow-700 space-y-1">
                <li>• Try refreshing the page</li>
                <li>• Clear your browser cache</li>
                <li>• Check your internet connection</li>
                <li>• Try again in a few minutes</li>
              </ul>
            </div>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;