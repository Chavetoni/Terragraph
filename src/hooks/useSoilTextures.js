/**
 * Soil Textures Hook
 * 
 * Provides real-time texture updates for geological materials
 * when texture settings change through the UI controls.
 */

import { useEffect, useCallback } from 'react';
import { Color, RepeatWrapping } from 'three';
import { useDisplayOptions } from '../contexts/DisplayOptionsContext';
import { scene3dLogger } from '../utils/Logger.js';
import { useThreeJs } from '../contexts/ThreeJsContext';
import VolumetricMeshGenerator from '../services/VolumetricMeshGenerator';

export function useSoilTextures() {
  const { textureSettings } = useDisplayOptions();
  const { scene } = useThreeJs();

  /**
   * Update all geological materials in the scene with new texture settings
   */
  const updateSceneTextures = useCallback(() => {
    if (!scene || !textureSettings) return;

    let updatedCount = 0;
    let texturedCount = 0;
    let solidCount = 0;

    // Traverse the scene to find all geological materials
    scene.traverse((object) => {
      if (object.isMesh && object.material && object.userData?.type === 'VolumetricGeologicalLayer') {
        const materialType = object.userData.materialType || 'UNKNOWN';
        const materialColor = object.material.color?.clone() || new Color(0x888888);

        try {
          // Get material-specific settings
          const materialSettings = textureSettings.materialOverrides?.[materialType.toUpperCase()] || {};
          const materialTextureOptions = textureSettings.enabled ? {
            enabled: textureSettings.enabled && materialSettings.enabled !== false,
            intensity: materialSettings.intensity !== undefined ? materialSettings.intensity : textureSettings.globalIntensity,
            scale: materialSettings.scale !== undefined ? materialSettings.scale : textureSettings.patternScale,
            pattern: materialSettings.pattern,
            blendMode: textureSettings.blendWithColor ? 'multiply' : 'normal'
          } : { enabled: false };

          // Create new texture with current settings
          const newTexture = VolumetricMeshGenerator.createSimpleSoilTexture(
            materialType, 
            materialColor, 
            materialTextureOptions
          );

          // Apply texture or remove it based on settings
          if (newTexture && textureSettings.enabled && materialSettings.enabled !== false) {
            // Dispose of old texture to prevent memory leaks
            if (object.material.map) {
              object.material.map.dispose();
            }

            // Apply new texture with proper scaling
            object.material.map = newTexture;
            
            // Apply texture scaling based on material type
            const textureScale = VolumetricMeshGenerator.getMaterialTextureScale(materialType);
            newTexture.wrapS = RepeatWrapping;
            newTexture.wrapT = RepeatWrapping;
            newTexture.repeat.set(
              Math.max(0.5, Math.min(4.0, textureScale.horizontal * (materialSettings.scale || 1.0))),
              Math.max(0.5, Math.min(4.0, textureScale.vertical * (materialSettings.scale || 1.0)))
            );

            object.material.needsUpdate = true;
            texturedCount++;
          } else {
            // Remove texture (solid color mode)
            if (object.material.map) {
              object.material.map.dispose();
              object.material.map = null;
              object.material.needsUpdate = true;
            }
            solidCount++;
          }

          updatedCount++;

        } catch (error) {
          scene3dLogger.warn(`Failed to update texture for ${materialType}:`, error);
        }
      }
    });

  }, [scene, textureSettings]);

  // Apply texture updates when settings change
  useEffect(() => {
    if (scene && textureSettings) {
      // Debounce updates to avoid excessive re-rendering
      const timeoutId = setTimeout(() => {
        updateSceneTextures();
      }, 100); // 100ms debounce

      return () => clearTimeout(timeoutId);
    }
  }, [updateSceneTextures]);

  /**
   * Force immediate texture update (for manual triggers)
   */
  const forceTextureUpdate = useCallback(() => {
    updateSceneTextures();
  }, [updateSceneTextures]);

  /**
   * Reset all textures to defaults
   */
  const resetAllTextures = useCallback(() => {
    if (!scene) return;

    scene.traverse((object) => {
      if (object.isMesh && object.material && object.userData?.type === 'VolumetricGeologicalLayer') {
        if (object.material.map) {
          object.material.map.dispose();
          object.material.map = null;
          object.material.needsUpdate = true;
        }
      }
    });

    // Trigger rebuild with default settings
    setTimeout(updateSceneTextures, 50);
  }, [scene, updateSceneTextures]);

  /**
   * Get texture statistics for debugging
   */
  const getTextureStats = useCallback(() => {
    if (!scene) return { totalMaterials: 0, texturedMaterials: 0, materialTypes: {} };

    let totalMaterials = 0;
    let texturedMaterials = 0;
    const materialTypes = {};

    scene.traverse((object) => {
      if (object.isMesh && object.material && object.userData?.type === 'VolumetricGeologicalLayer') {
        const materialType = object.userData.materialType || 'UNKNOWN';
        totalMaterials++;
        
        if (object.material.map) {
          texturedMaterials++;
        }

        materialTypes[materialType] = (materialTypes[materialType] || 0) + 1;
      }
    });

    return {
      totalMaterials,
      texturedMaterials,
      materialTypes,
      textureEnabled: textureSettings?.enabled || false
    };
  }, [scene, textureSettings]);

  return {
    textureSettings,
    updateSceneTextures,
    forceTextureUpdate,
    resetAllTextures,
    getTextureStats
  };
}

export default useSoilTextures;