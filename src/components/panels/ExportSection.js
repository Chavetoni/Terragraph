// src/components/panels/ExportSection.js
import React, { useState } from 'react';
import { useThreeJs } from '../../contexts/ThreeJsContext';
import { useLayers } from '../../contexts/LayersContext';
import { useBoreholes } from '../../contexts/BoreholeContext';
import { useSiteMap } from '../../contexts/SiteMapContext';
import { useDisplayOptions } from '../../contexts/DisplayOptionsContext';
import { useTransformation } from '../../contexts/TransformationContext';
import { useRevitExport } from '../../hooks/useRevitExport';
import SceneExporter from '../../services/SceneExporter';
import UnifiedAccordion from '../ui/UnifiedAccordion';
import StandardButton from '../ui/StandardButton';
import { StandardFormGroup, StandardSelect } from '../ui/StandardForm';

const ExportSection = ({ isOpen, onToggle }) => {
  const { scene, renderer, camera } = useThreeJs();
  const { layers } = useLayers();
  const { boreholes } = useBoreholes();
  const { siteMap } = useSiteMap();
  const { displayOptions } = useDisplayOptions();
  const transformationContext = useTransformation();
  
  const [isExporting, setIsExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState('');
  const [exportProgress, setExportProgress] = useState(0);
  const [exportType, setExportType] = useState('3d'); // '3d', 'image', 'multiview', 'bim'

  // BIM export state
  const [bimFormat, setBimFormat] = useState('revit-obj');
  const [bimSettings, setBimSettings] = useState({
    unitSystem: 'imperial',
    detailLevel: 'medium',
    includeTextures: true,
    includeMaterials: true,
    includeMetadata: true,
    includeWaterTable: true,
    generateInstructions: true,
    includeBoreholesAsColumns: false
  });

  const sceneExporter = new SceneExporter();

  // Initialize Revit export functionality
  const {
    exportToRevit,
    isExporting: isRevitExporting,
    progress: revitProgress,
    error: revitError,
    result: revitResult,
    cancelExport: cancelRevitExport,
    exportCapabilities,
    canExport: canRevitExport,
    validateExportData
  } = useRevitExport();

  // Helper function to extract texture settings from display options and scene
  const extractTextureSettings = (scene, displayOptions) => {
    // Start with display options texture settings if available
    if (displayOptions?.textureSettings) {
      return {
        enabled: displayOptions.textureSettings.enabled,
        globalIntensity: displayOptions.textureSettings.globalIntensity,
        patternScale: displayOptions.textureSettings.patternScale,
        blendWithColor: displayOptions.textureSettings.blendWithColor,
        materialOverrides: displayOptions.textureSettings.materialOverrides || {}
      };
    }
    
    // Fallback: extract from scene materials
    const textureSettings = {
      enabled: true,
      globalIntensity: 0.7,
      patternScale: 1.0,
      materialOverrides: {}
    };
    
    if (!scene) return textureSettings;
    
    scene.traverse((child) => {
      if (child.isMesh && child.material) {
        const material = Array.isArray(child.material) ? child.material[0] : child.material;
        
        if (material.map && material.userData?.hasTexture && material.userData?.materialType) {
          const materialType = material.userData.materialType;
          if (!textureSettings.materialOverrides[materialType]) {
            textureSettings.materialOverrides[materialType] = {
              pattern: materialType.toLowerCase(),
              intensity: material.userData?.textureIntensity || 0.7,
              scale: material.userData?.textureScale || 1.0,
              enabled: true,
              hasTexture: true
            };
          }
        }
      }
    });

    return textureSettings;
  };

  // BIM export settings handler
  const handleBimSettingChange = (setting, value) => {
    setBimSettings(prev => ({
      ...prev,
      [setting]: value
    }));
  };

  // BIM export handler
  const handleBimExport = async () => {
    try {
      setIsExporting(true);
      setExportStatus('Validating geological data for BIM export...');
      setExportProgress(5);

      // Validate export data first
      const validation = validateExportData();
      if (!validation.isValid) {
        throw new Error(validation.errors.join(', '));
      }

      setExportStatus('Starting BIM export...');
      setExportProgress(10);

      // Execute BIM export
      await exportToRevit(bimFormat, bimSettings);

      setExportStatus('BIM export completed successfully!');
      setExportProgress(100);

      // Reset status after 3 seconds
      setTimeout(() => {
        setExportStatus('');
        setExportProgress(0);
      }, 3000);

    } catch (error) {
      // Error already logged by the export service
      setExportStatus(`BIM export failed: ${error.message}`);
      setExportProgress(0);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExport = async () => {
    if (exportType === 'bim') {
      return handleBimExport();
    }

    if (!scene || !renderer || !camera) {
      setExportStatus('Error: Scene, renderer, or camera not available for export');
      return;
    }

    setIsExporting(true);
    setExportStatus('Preparing export...');
    setExportProgress(10);

    try {
      // Collect all scene data including texture and water table information
      const sceneData = {
        scene,
        soilLayers: layers || [],
        boreholes: boreholes || [],
        siteMap: siteMap || null,
        displayOptions: {
          showBoreholes: displayOptions?.showBoreholes !== false,
          showBoreholeStrata: displayOptions?.showBoreholeStrata !== false,
          showWaterTable: displayOptions?.showWaterTable !== false,
          showStrata: displayOptions?.showStrata !== false,
          showDepthMarkers: displayOptions?.showDepthMarkers !== false,
          showLabels: displayOptions?.showLabels !== false,
          showGroundGrid: displayOptions?.showGroundGrid !== false,
          textureSettings: displayOptions?.textureSettings || {},
          ...displayOptions
        },
        strataDimensions: displayOptions?.strataDimensions || { width: 40, depth: 40 },
        // Extract geological model data from scene if available
        geologicalModel: scene?.userData?.geologicalModel || null,
        // Extract water table data from boreholes
        waterTableData: {
          enabled: boreholes?.some(b => b.waterTableEncountered) || false,
          settings: {
            opacity: 0.7,
            color: '#1976D2',
            showContours: true,
            contourInterval: 'medium',
            visible: true,
            interpolationMethod: 'auto'
          }
        },
        // Extract texture data from display options and scene
        textureData: {
          enabled: displayOptions?.textureSettings?.enabled !== false,
          ready: true,
          settings: extractTextureSettings(scene, displayOptions)
        },
        // Include transformation context for accurate export positioning
        transformationContext: transformationContext
      };

      if (exportType === '3d') {
        // 3D Model Export
        setExportStatus('Collecting scene geometry...');
        setExportProgress(30);

        // Export to GLTF with transformation context (ASYNC to prevent UI blocking)
        const exportData = await new Promise((resolve, reject) => {
          // Break GLTF processing into async chunks
          const scheduleWork = (callback) => {
            if (window.requestIdleCallback) {
              window.requestIdleCallback(callback, { timeout: 150 });
            } else {
              setTimeout(callback, 0);
            }
          };
          
          scheduleWork(async () => {
            try {
              setExportStatus('Processing 3D geometry...');
              const result = await sceneExporter.exportToGLTF(sceneData, {
                binary: true,
                includeCustomExtensions: true,
                onlyVisible: true,
                // Include transformation information in export options
                preserveTransformations: true
              });
              resolve(result);
            } catch (error) {
              reject(error);
            }
          });
        });

        setExportStatus('Generating files...');
        setExportProgress(70);

        // Generate filenames
        const gltfFilename = sceneExporter.generateExportFilename('geotech_model');
        const metadataFilename = sceneExporter.generateMetadataFilename('geotech_model');

        setExportStatus('Downloading files...');
        setExportProgress(90);

        // Download the GLB file
        sceneExporter.downloadFile(exportData.gltfData, gltfFilename, 'application/octet-stream');

        // Download the metadata file
        sceneExporter.downloadMetadata(exportData.metadata, metadataFilename);

      } else if (exportType === 'image') {
        // High-resolution image export
        setExportStatus('Capturing high-resolution image...');
        setExportProgress(50);

        const imageData = await sceneExporter.exportToImage(renderer, scene, camera, {
          width: 3840,
          height: 2160,
          format: 'png',
          quality: 0.95
        });

        setExportStatus('Downloading image...');
        setExportProgress(80);

        const imageFilename = sceneExporter.generateImageFilename('geotech_view', 'png');
        sceneExporter.downloadImage(imageData.dataURL, imageFilename);

        // Also download metadata
        const metadata = sceneExporter.createMetadata(layers, boreholes, siteMap, displayOptions, sceneData.strataDimensions);
        const metadataFilename = sceneExporter.generateMetadataFilename('geotech_image');
        sceneExporter.downloadMetadata(metadata, metadataFilename);

      } else if (exportType === 'multiview') {
        // Multiple view export
        setExportStatus('Capturing multiple views...');
        setExportProgress(30);

        const metadata = sceneExporter.createMetadata(layers, boreholes, siteMap, displayOptions, sceneData.strataDimensions);
        const views = await sceneExporter.exportMultipleViews(renderer, scene, camera, metadata, {
          includeTopView: true,
          includeSideView: true,
          includeIsometricView: true,
          resolution: { width: 1920, height: 1080 }
        });

        setExportStatus('Downloading view files...');
        setExportProgress(70);

        // Download each view
        views.forEach((view, index) => {
          const filename = sceneExporter.generateImageFilename(`geotech_${view.name.toLowerCase().replace(' ', '_')}`, 'png');
          sceneExporter.downloadImage(view.data.dataURL, filename);
        });

        // Download metadata
        const metadataFilename = sceneExporter.generateMetadataFilename('geotech_multiview');
        sceneExporter.downloadMetadata(metadata, metadataFilename);
      }

      setExportStatus('Export completed successfully!');
      setExportProgress(100);

      // Reset status after 3 seconds
      setTimeout(() => {
        setExportStatus('');
        setExportProgress(0);
      }, 3000);

    } catch (error) {
      // Error already logged by the export service
      setExportStatus(`Export failed: ${error.message}`);
      setExportProgress(0);
    } finally {
      setIsExporting(false);
    }
  };

  const getExportSummary = () => {
    const layerCount = layers?.length || 0;
    const boreholeCount = boreholes?.length || 0;
    const hasSiteMap = !!(siteMap && siteMap.object);
    const hasWaterTable = boreholes?.some(b => b.waterTableEncountered || typeof b.waterTableDepth === 'number') || false;
    const hasTextureSettings = displayOptions?.textureSettings?.enabled !== false;
    const hasGeologicalModel = !!exportCapabilities?.hasGeologicalModel;

    return {
      layerCount,
      boreholeCount,
      hasSiteMap,
      hasWaterTable,
      hasTextureSettings,
      hasGeologicalModel,
      totalElements: layerCount + boreholeCount + (hasSiteMap ? 1 : 0),
      bimCapabilities: {
        canExportToBim: canRevitExport,
        recommendedFormat: exportCapabilities?.recommendedFormat,
        materialCount: exportCapabilities?.materialCount || 0,
        interpolationMethod: exportCapabilities?.hasGeologicalModel ? 'Available' : 'N/A'
      }
    };
  };

  const summary = getExportSummary();

  return (
    <UnifiedAccordion
      title="Export Scene"
      isOpen={isOpen}
      onToggle={onToggle}
      badge={summary.totalElements > 0 ? `${summary.totalElements} elements` : 'No data'}
      badgeType={summary.totalElements > 0 ? "advanced" : "optional"}
    >
      <div className="space-y-6">
        <StandardFormGroup>
          <h4 className="form-label-new text-base font-semibold mb-3">Export Summary</h4>
          <div className="grid grid-cols-2 gap-3 text-sm mb-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Soil Layers:</span>
              <span className="font-medium">{summary.layerCount}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Boreholes:</span>
              <span className="font-medium">{summary.boreholeCount}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Site Map:</span>
              <span className="font-medium">{summary.hasSiteMap ? 'Yes' : 'No'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Water Table:</span>
              <span className="font-medium">{summary.hasWaterTable ? 'Yes' : 'No'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Textures:</span>
              <span className="font-medium">{summary.hasTextureSettings ? 'Yes' : 'No'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Geological Model:</span>
              <span className="font-medium">{summary.hasGeologicalModel ? 'Yes' : 'No'}</span>
            </div>
          </div>

          {exportType === 'bim' && (
            <div className="bg-blue-50 border border-blue-200 rounded-md p-3 text-sm">
              <h5 className="font-semibold text-blue-900 mb-2">BIM Export Capabilities</h5>
              <div className="grid grid-cols-2 gap-2 text-blue-800">
                <div className="flex justify-between items-center">
                  <span>Materials:</span>
                  <span className="font-medium">{summary.bimCapabilities.materialCount}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>BIM Ready:</span>
                  <span className="font-medium">{summary.bimCapabilities.canExportToBim ? 'Yes' : 'No'}</span>
                </div>
                <div className="col-span-2">
                  <div className="flex justify-between items-center">
                    <span>Recommended:</span>
                    <span className="font-medium text-xs">
                      {summary.bimCapabilities.recommendedFormat === 'revit-obj' ? 'OBJ (Plugin Required)' : 'Analyze data'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </StandardFormGroup>

        <StandardFormGroup>
          <h4 className="form-label-new text-base font-semibold mb-3">Export Type</h4>
          <div className="grid grid-cols-2 gap-2 mb-3">
            <StandardButton
              variant={exportType === '3d' ? 'primary' : 'secondary'}
              onClick={() => setExportType('3d')}
              disabled={isExporting || isRevitExporting}
              size="small"
            >
              3D Model
            </StandardButton>
            <StandardButton
              variant={exportType === 'image' ? 'primary' : 'secondary'}
              onClick={() => setExportType('image')}
              disabled={isExporting || isRevitExporting}
              size="small"
            >
              High-Res Image
            </StandardButton>
            <StandardButton
              variant={exportType === 'multiview' ? 'primary' : 'secondary'}
              onClick={() => setExportType('multiview')}
              disabled={isExporting || isRevitExporting}
              size="small"
            >
              Multiple Views
            </StandardButton>
            <StandardButton
              variant={exportType === 'bim' ? 'primary' : 'secondary'}
              onClick={() => setExportType('bim')}
              disabled={isExporting || isRevitExporting}
              size="small"
            >
              BIM Export
            </StandardButton>
          </div>
        </StandardFormGroup>

        {exportType === 'bim' && (
          <>
            <StandardFormGroup>
              <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-4">
                <h5 className="font-semibold text-red-900 mb-2 flex items-center">
                  ⚠️ CRITICAL COMPATIBILITY WARNING
                </h5>
                <div className="text-sm text-red-800 space-y-2">
                  <p><strong>Revit does NOT natively support OBJ files!</strong></p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>You must purchase third-party plugins ($$$) to import OBJ files</li>
                    <li>Most plugins do NOT support material (.mtl) files</li>
                    <li>Geological materials and textures will likely be lost</li>
                    <li>Manual material reassignment required in Revit</li>
                  </ul>
                  <p className="font-medium">Consider exporting as 3D Model (GLB) instead for better compatibility.</p>
                </div>
              </div>
            </StandardFormGroup>

            <StandardFormGroup>
              <h4 className="form-label-new text-base font-semibold mb-3">BIM Export Settings</h4>

              <div className="space-y-4">
              <StandardSelect
                label="Format"
                value={bimFormat}
                onChange={(e) => setBimFormat(e.target.value)}
                options={[
                  { value: 'revit-obj', label: 'OBJ + MTL (⚠️ Requires Plugin)' }
                  // IFC option removed - not implemented yet
                ]}
                helpText="⚠️ CRITICAL: OBJ export requires paid Revit plugins. Materials may not import properly."
              />

              <div className="grid grid-cols-2 gap-3">
                <StandardSelect
                  label="Unit System"
                  value={bimSettings.unitSystem}
                  onChange={(e) => handleBimSettingChange('unitSystem', e.target.value)}
                  options={[
                    { value: 'imperial', label: 'Imperial (ft)' },
                    { value: 'metric', label: 'Metric (m)' }
                  ]}
                />

                <StandardSelect
                  label="Detail Level"
                  value={bimSettings.detailLevel}
                  onChange={(e) => handleBimSettingChange('detailLevel', e.target.value)}
                  options={[
                    { value: 'low', label: 'Low (Fast)' },
                    { value: 'medium', label: 'Medium (Balanced)' },
                    { value: 'high', label: 'High (Detailed)' }
                  ]}
                />
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                <h5 className="font-semibold text-blue-900 text-sm mb-2">Include Options</h5>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {[
                    { key: 'includeTextures', label: 'Soil Textures' },
                    { key: 'includeMaterials', label: 'Material Properties' },
                    { key: 'includeMetadata', label: 'Geological Metadata' },
                    { key: 'includeWaterTable', label: 'Water Table Data' },
                    { key: 'generateInstructions', label: 'Revit Instructions' },
                    { key: 'includeBoreholesAsColumns', label: 'Boreholes as Columns' }
                  ].map(({ key, label }) => (
                    <label key={key} className="flex items-center space-x-2 text-blue-800">
                      <input
                        type="checkbox"
                        checked={bimSettings[key]}
                        onChange={(e) => handleBimSettingChange(key, e.target.checked)}
                        className="w-4 h-4 text-blue-600 border-blue-300 rounded focus:ring-blue-500"
                      />
                      <span className="text-xs">{label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            </StandardFormGroup>
          </>
        )}

        <StandardFormGroup>
          <div className="bg-gray-50 p-3 rounded-md text-sm">
            {exportType === '3d' && (
              <p><strong>GLB Format:</strong> Clean geological strata with original designated colors, optimized for 3D viewers</p>
            )}
            {exportType === 'image' && (
              <p><strong>4K PNG:</strong> High-resolution image (3840x2160) with metadata</p>
            )}
            {exportType === 'multiview' && (
              <p><strong>Multiple Views:</strong> Current, Top, Side, and Isometric perspectives</p>
            )}
            {exportType === 'bim' && (
              <div>
                <p><strong>BIM Export:</strong> Professional geological model export for Revit and other BIM applications</p>
                <div className="mt-2 text-xs text-gray-600">
                  <div className="flex justify-between">
                    <span>Format:</span>
                    <span className="font-medium">{bimFormat === 'revit-obj' ? 'OBJ + MTL' : 'IFC-JSON'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Units:</span>
                    <span className="font-medium">{bimSettings.unitSystem === 'imperial' ? 'Imperial (ft)' : 'Metric (m)'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Quality:</span>
                    <span className="font-medium capitalize">{bimSettings.detailLevel}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </StandardFormGroup>

        <StandardFormGroup>
          <StandardButton
            variant={exportType === 'bim' && !summary.bimCapabilities.canExportToBim ? 'danger' :
                     summary.totalElements === 0 ? 'danger' : 'success'}
            onClick={handleExport}
            disabled={
              isExporting ||
              isRevitExporting ||
              summary.totalElements === 0 ||
              (exportType === 'bim' && !summary.bimCapabilities.canExportToBim)
            }
            loading={isExporting || isRevitExporting}
            fullWidth
          >
            {isExporting || isRevitExporting ? 'Exporting...' :
             exportType === 'bim' && !summary.bimCapabilities.canExportToBim ? 'Insufficient BIM Data' :
             summary.totalElements === 0 ? 'No Data to Export' :
              exportType === '3d' ? 'Export 3D Model' :
              exportType === 'image' ? 'Export High-Res Image' :
              exportType === 'multiview' ? 'Export Multiple Views' :
              exportType === 'bim' ? `Export to ${bimFormat === 'revit-obj' ? 'Revit (OBJ)' : 'IFC-JSON'}` : 'Export'}
          </StandardButton>

          {(isExporting || isRevitExporting) && (
            <div className="mt-4">
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-green-600 h-2 rounded-full transition-all duration-300"
                  style={{
                    width: `${isRevitExporting ? revitProgress.progress || 0 : exportProgress}%`
                  }}
                />
              </div>
              <div className="text-xs text-gray-600 mt-1 text-center">
                {isRevitExporting ? revitProgress.progress || 0 : exportProgress}% complete
              </div>
              {isRevitExporting && revitProgress.message && (
                <div className="text-xs text-gray-500 mt-1 text-center">
                  {revitProgress.message}
                </div>
              )}
            </div>
          )}

          {/* Cancel button for BIM exports */}
          {isRevitExporting && revitProgress.canCancel && (
            <StandardButton
              variant="danger"
              size="small"
              onClick={cancelRevitExport}
              className="mt-2"
              fullWidth
            >
              Cancel BIM Export
            </StandardButton>
          )}

          {/* Export status messages */}
          {(exportStatus || revitError) && (
            <div className={`mt-3 p-3 rounded-md text-sm ${
              (exportStatus && (exportStatus.includes('Error') || exportStatus.includes('failed'))) || revitError
                ? 'bg-red-50 text-red-800 border border-red-200'
                : (exportStatus && exportStatus.includes('completed')) || revitResult
                ? 'bg-green-50 text-green-800 border border-green-200'
                : 'bg-yellow-50 text-yellow-800 border border-yellow-200'
            }`}>
              {revitError || exportStatus}
            </div>
          )}

          {/* BIM export result with download links */}
          {revitResult && exportType === 'bim' && (
            <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-md">
              <h5 className="font-semibold text-green-900 text-sm mb-2">BIM Export Complete</h5>
              <div className="text-sm text-green-800 space-y-1">
                <div className="flex justify-between">
                  <span>Format:</span>
                  <span className="font-medium">{revitResult.format}</span>
                </div>
                <div className="flex justify-between">
                  <span>Files Generated:</span>
                  <span className="font-medium">{revitResult.files?.length || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span>Total Size:</span>
                  <span className="font-medium">{revitResult.totalSize || 'N/A'}</span>
                </div>
                {revitResult.downloadUrl && (
                  <StandardButton
                    variant="success"
                    size="small"
                    className="mt-2"
                    fullWidth
                    onClick={() => window.open(revitResult.downloadUrl, '_blank')}
                  >
                    Download BIM Files
                  </StandardButton>
                )}
              </div>
            </div>
          )}

          {/* BIM-specific validation warnings */}
          {exportType === 'bim' && !summary.bimCapabilities.canExportToBim && (
            <div className="mt-3 p-3 bg-orange-50 border border-orange-200 rounded-md text-sm">
              <h5 className="font-semibold text-orange-900 mb-2">BIM Export Requirements</h5>
              <div className="text-orange-800 space-y-1">
                {!exportCapabilities?.hasBoreholes && (
                  <div className="flex items-center space-x-1">
                    <span className="text-red-500">✗</span>
                    <span>Need borehole data for BIM export</span>
                  </div>
                )}
                {!exportCapabilities?.hasGeologicalModel && (
                  <div className="flex items-center space-x-1">
                    <span className="text-yellow-500">!</span>
                    <span>No geological model - only borehole data will be exported</span>
                  </div>
                )}
                {exportCapabilities?.materialCount === 0 && (
                  <div className="flex items-center space-x-1">
                    <span className="text-yellow-500">!</span>
                    <span>No geological materials identified</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </StandardFormGroup>
      </div>
    </UnifiedAccordion>
  );
};

export default ExportSection;