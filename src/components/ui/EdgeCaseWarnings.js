import React from 'react';

/**
 * EdgeCaseWarnings Component
 * 
 * Displays warnings for geological model edge cases including:
 * - Discontinuous layer sequences
 * - Low confidence interpolation areas
 * - Fallback interpolation usage
 * - Geological gap bridging
 */
const EdgeCaseWarnings = ({ modelingResults, className = '' }) => {
  // Early return if no modeling results or warnings
  if (!modelingResults?.warnings || Object.keys(modelingResults.warnings).length === 0) {
    return null;
  }

  const warnings = modelingResults.warnings;
  const hasWarnings = warnings.discontinuities > 0 || 
                     warnings.lowConfidenceAreas > 0 || 
                     warnings.fallbackUsed ||
                     warnings.gapsBridged > 0;

  if (!hasWarnings) {
    return null;
  }

  const warningCount = (warnings.discontinuities || 0) + 
                      (warnings.lowConfidenceAreas || 0) + 
                      (warnings.fallbackUsed ? 1 : 0) +
                      (warnings.gapsBridged || 0);

  return (
    <div className={`absolute top-4 right-4 bg-yellow-100 border-l-4 border-yellow-500 p-4 max-w-sm rounded-md shadow-lg z-10 ${className}`}>
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        </div>
        <div className="ml-3">
          <h3 className="text-sm font-medium text-yellow-800">
            Geological Model Warnings ({warningCount})
          </h3>
          <div className="mt-2 text-sm text-yellow-700">
            <ul className="list-disc list-inside space-y-1">
              {warnings.discontinuities > 0 && (
                <li>
                  <span className="font-medium">{warnings.discontinuities}</span> discontinuous layer sequence(s) detected
                </li>
              )}
              {warnings.lowConfidenceAreas > 0 && (
                <li>
                  <span className="font-medium">{warnings.lowConfidenceAreas}</span> area(s) with low interpolation confidence
                  <div className="text-xs text-yellow-600 ml-4 mt-1">
                    • Look for yellow edge highlights on 3D model
                    • Semi-transparent rendering indicates uncertainty
                  </div>
                </li>
              )}
              {warnings.gapsBridged > 0 && (
                <li>
                  <span className="font-medium">{warnings.gapsBridged}</span> geological gap(s) bridged using continuity assumptions
                  <div className="text-xs text-yellow-600 ml-4 mt-1">
                    • Gaps > 10ft were connected using geological principles
                  </div>
                </li>
              )}
              {warnings.fallbackUsed && (
                <li>
                  Limited data points - using geological extrapolation
                  <div className="text-xs text-yellow-600 ml-4 mt-1">
                    • Consider adding more boreholes for better accuracy
                    • Horizontal continuity assumptions applied
                  </div>
                </li>
              )}
            </ul>
          </div>
          
          {/* Additional guidance */}
          <div className="mt-3 text-xs text-yellow-600">
            <p className="font-medium">Tips for improvement:</p>
            <ul className="list-disc list-inside mt-1 space-y-0.5">
              <li>Add more boreholes in areas with yellow edges</li>
              <li>Ensure consistent layer depths across boreholes</li>
              <li>Review borehole data for missing or inconsistent layers</li>
            </ul>
          </div>
        </div>
      </div>
      
      {/* Dismiss button */}
      <div className="mt-3 flex justify-end">
        <button
          type="button"
          className="text-xs text-yellow-600 hover:text-yellow-800 font-medium"
          onClick={() => {
            // Hide the warning panel (parent should handle this)
            const event = new CustomEvent('dismissGeologicalWarnings');
            window.dispatchEvent(event);
          }}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
};

export default EdgeCaseWarnings;