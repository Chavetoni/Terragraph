import { useState, useEffect, useCallback } from 'react';

/**
 * Custom hook for tracking geological modeling results and warnings
 * 
 * Provides state management for:
 * - Edge case warnings
 * - Confidence metrics
 * - Interpolation results
 * - Performance tracking
 */
export const useGeologicalModeling = () => {
  const [modelingResults, setModelingResults] = useState({
    warnings: {
      discontinuities: 0,
      lowConfidenceAreas: 0,
      gapsBridged: 0,
      fallbackUsed: false
    },
    confidence: {
      overall: 1.0,
      byMaterial: {},
      lowConfidenceThreshold: 0.7
    },
    performance: {
      interpolationTime: 0,
      meshGenerationTime: 0,
      totalTime: 0
    },
    metadata: {
      lastUpdated: null,
      boreholeCount: 0,
      layerCount: 0
    }
  });

  const [showWarnings, setShowWarnings] = useState(true);

  // Update modeling results from volumetric mesh generation
  const updateModelingResults = useCallback((results) => {
    if (!results) return;

    const warnings = {
      discontinuities: 0,
      lowConfidenceAreas: 0,
      gapsBridged: 0,
      fallbackUsed: false
    };

    const confidence = {
      overall: 1.0,
      byMaterial: {},
      lowConfidenceThreshold: 0.7
    };

    // Process results to extract warnings and confidence metrics
    if (results.volumes) {
      results.volumes.forEach(volume => {
        // Track discontinuities
        if (volume.sequences && volume.sequences.length > 1) {
          warnings.discontinuities += volume.sequences.length - 1;
        }

        // Track confidence levels
        const volumeConfidence = volume.confidence || 1.0;
        confidence.byMaterial[volume.material] = volumeConfidence;
        
        if (volumeConfidence < confidence.lowConfidenceThreshold) {
          warnings.lowConfidenceAreas++;
        }

        // Track gaps bridged
        if (volume.gapsBridged) {
          warnings.gapsBridged++;
        }

        // Track fallback usage
        if (volume.interpolationMethod && volume.interpolationMethod.includes('fallback')) {
          warnings.fallbackUsed = true;
        }
      });

      // Calculate overall confidence
      const confidenceValues = Object.values(confidence.byMaterial);
      if (confidenceValues.length > 0) {
        confidence.overall = confidenceValues.reduce((sum, val) => sum + val, 0) / confidenceValues.length;
      }
    }

    // Update performance metrics
    const performance = {
      interpolationTime: results.timing?.interpolation || 0,
      meshGenerationTime: results.timing?.meshGeneration || 0,
      totalTime: results.timing?.total || 0
    };

    // Update metadata
    const metadata = {
      lastUpdated: new Date().toISOString(),
      boreholeCount: results.boreholeCount || 0,
      layerCount: results.layerCount || 0
    };

    setModelingResults({
      warnings,
      confidence,
      performance,
      metadata
    });

  }, []);


  // Handle warning dismissal
  useEffect(() => {
    const handleDismissWarnings = () => {
      setShowWarnings(false);
    };

    window.addEventListener('dismissGeologicalWarnings', handleDismissWarnings);

    return () => {
      window.removeEventListener('dismissGeologicalWarnings', handleDismissWarnings);
    };
  }, []);

  // Reset warnings when showing them again
  const resetWarnings = useCallback(() => {
    setShowWarnings(true);
    setModelingResults(prev => ({
      ...prev,
      warnings: {
        discontinuities: 0,
        lowConfidenceAreas: 0,
        gapsBridged: 0,
        fallbackUsed: false
      }
    }));
  }, []);

  // Test mode for edge case validation
  const testEdgeCases = useCallback(() => {

    // Simulate edge case warnings
    setModelingResults(prev => ({
      ...prev,
      warnings: {
        discontinuities: 2,
        lowConfidenceAreas: 1,
        gapsBridged: 1,
        fallbackUsed: true
      },
      confidence: {
        ...prev.confidence,
        overall: 0.65,
        byMaterial: {
          'SAND': 0.5,
          'CLAY': 0.8
        }
      }
    }));
    
    setShowWarnings(true);

  }, []);

  return {
    modelingResults: showWarnings ? modelingResults : { ...modelingResults, warnings: {} },
    updateModelingResults,
    showWarnings,
    setShowWarnings,
    resetWarnings,
    testEdgeCases
  };
};

export default useGeologicalModeling;