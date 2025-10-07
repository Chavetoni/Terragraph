#!/usr/bin/env node

/**
 * Automatically optimize Three.js imports by replacing wildcard imports
 * with selective imports based on actual usage analysis
 */

const fs = require('fs');
const path = require('path');

// Import analysis results
const analysisResults = require('./threejs-usage-analysis.json');

// Map of files to their required Three.js imports
const importMap = {
  'src/utils/threeJsHelpers.js': [
    'BufferGeometry', 'CanvasTexture', 'CircleGeometry', 'Color', 'DoubleSide',
    'Group', 'Line', 'LineBasicMaterial', 'Mesh', 'MeshBasicMaterial',
    'Sprite', 'SpriteMaterial', 'TextureLoader', 'Vector3'
  ],
  'src/utils/volumetricDisposal.js': ['Object3D', 'Mesh'],
  'src/utils/modelUtils.js': ['Color'],
  'src/utils/optimizedMemoryManagement.js': [
    'BoxGeometry', 'BufferGeometry', 'CanvasTexture', 'CylinderGeometry',
    'Material', 'Mesh', 'MeshBasicMaterial', 'MeshLambertMaterial',
    'MeshPhongMaterial', 'MeshStandardMaterial', 'PlaneGeometry',
    'SphereGeometry', 'Texture', 'WebGLRenderTarget'
  ],
  'src/utils/enhancedMeshBuilder.js': analysisResults['src/utils/enhancedMeshBuilder.js'] || [],
  
  // Service files
  'src/services/VolumetricMeshGenerator.js': [
    'BufferAttribute', 'BufferGeometry', 'Color', 'DoubleSide', 'EdgesGeometry',
    'LineBasicMaterial', 'LineSegments', 'Mesh', 'MeshPhysicalMaterial',
    'MeshStandardMaterial', 'NormalBlending', 'RepeatWrapping', 'SphereGeometry'
  ],
  'src/services/SceneExporter.js': [
    'Box3', 'BoxGeometry', 'BufferAttribute', 'BufferGeometry', 'CanvasTexture',
    'Color', 'CylinderGeometry', 'DirectionalLight', 'DoubleSide',
    'Float32BufferAttribute', 'FrontSide', 'Group', 'Line', 'LineBasicMaterial',
    'Mesh', 'MeshBasicMaterial', 'MeshStandardMaterial', 'Object3D',
    'PlaneGeometry', 'Scene', 'Vector2', 'Vector3'
  ],
  'src/services/SimpleSceneManager.js': [
    'BoxGeometry', 'BufferAttribute', 'BufferGeometry', 'Color', 'CylinderGeometry',
    'DoubleSide', 'Group', 'Line', 'LineBasicMaterial', 'Mesh',
    'MeshBasicMaterial', 'MeshStandardMaterial', 'SphereGeometry', 'Vector3'
  ],
  'src/services/OptimizedSceneManager.js': [
    'BoxGeometry', 'Color', 'CylinderGeometry', 'DoubleSide', 'Group',
    'InstancedMesh', 'Matrix4', 'Mesh', 'MeshBasicMaterial', 'MeshPhongMaterial',
    'MeshStandardMaterial', 'Quaternion', 'SphereGeometry', 'Vector3'
  ],
  'src/services/BoreholeVisualizer.js': [
    'BoxGeometry', 'BufferAttribute', 'CircleGeometry', 'Color', 'ConeGeometry',
    'CylinderGeometry', 'DoubleSide', 'Group', 'Mesh', 'MeshBasicMaterial',
    'MeshLambertMaterial', 'MeshStandardMaterial', 'Object3D', 'RingGeometry',
    'SphereGeometry'
  ],
  'src/services/ThreeJsObjectFactory.js': [
    'Box3', 'BoxGeometry', 'BufferGeometry', 'Color', 'CylinderGeometry',
    'Group', 'Line', 'LineBasicMaterial', 'Mesh', 'MeshStandardMaterial', 'Vector3'
  ],
  'src/services/SceneManager.js': [
    'AmbientLight', 'BoxGeometry', 'DirectionalLight', 'GridHelper', 'MathUtils',
    'Mesh', 'MeshBasicMaterial', 'PerspectiveCamera', 'Plane', 'Raycaster',
    'Scene', 'Vector2', 'Vector3', 'WebGLRenderer'
  ],
  'src/services/TextureManager.js': [
    'CanvasTexture', 'Color', 'NearestFilter', 'RepeatWrapping', 'Texture'
  ],
  'src/services/MultiLevelSurfaceGenerator.js': ['Color'],
  'src/services/OptimizedVolumetricMeshGenerator.js': [
    'BufferGeometry', 'Color', 'DoubleSide', 'Float32BufferAttribute',
    'MeshStandardMaterial'
  ],
  'src/services/GLTFLoader.js': ['Box3', 'Vector3'],
  
  // Context files
  'src/contexts/ThreeJsContext.js': [
    'ACESFilmicToneMapping', 'AmbientLight', 'Color', 'DirectionalLight',
    'GridHelper', 'PCFSoftShadowMap', 'PerspectiveCamera', 'SRGBColorSpace',
    'Scene', 'Vector2', 'WebGLRenderer'
  ],
  'src/contexts/SiteMapContext.js': [
    'MathUtils', 'Mesh', 'MeshBasicMaterial', 'PlaneGeometry', 'TextureLoader'
  ],
  'src/contexts/BoreholeContext.js': [
    'Color', 'Matrix4', 'Mesh', 'MeshBasicMaterial', 'PlaneGeometry',
    'Raycaster', 'SphereGeometry', 'Vector2', 'Vector3'
  ],
  
  // Hook files
  'src/hooks/useSiteMap.js': [
    'MathUtils', 'Mesh', 'MeshBasicMaterial', 'PlaneGeometry', 'TextureLoader'
  ],
  'src/hooks/useSoilTextures.js': ['Color', 'RepeatWrapping'],
  'src/hooks/useWaterTable.js': analysisResults['src/hooks/useWaterTable.js'] || [],
  'src/hooks/useBoreholes.js': ['Plane', 'Raycaster', 'Vector2', 'Vector3'],
  'src/hooks/useThreeJsScene.js': [
    'AmbientLight', 'Color', 'DirectionalLight', 'Fog', 'PerspectiveCamera',
    'Scene', 'WebGLRenderer'
  ],
  
  // Component files
  'src/components/canvas/VolumetricDepthScale.js': [
    'Box3', 'BufferGeometry', 'Group', 'Line', 'LineBasicMaterial',
    'Material', 'Vector3'
  ],
  'src/components/canvas/VolumetricLabels.js': [
    'Box3', 'BufferGeometry', 'Group', 'Line', 'LineBasicMaterial', 'Vector3'
  ],
  'src/components/canvas/VolumetricGeologicalModel.js': [
    'Box3', 'Color', 'DoubleSide', 'Group', 'Mesh', 'Vector3'
  ],
  'src/components/visualization/ConfidenceMappingOverlay.js': [
    'BufferGeometry', 'Color', 'DoubleSide', 'Group', 'Line',
    'LineBasicMaterial', 'Mesh', 'MeshBasicMaterial', 'PlaneGeometry', 'Vector3'
  ]
};

/**
 * Replace wildcard import with selective imports
 */
function optimizeFile(filePath, requiredImports) {
  const fullPath = path.join(__dirname, filePath);
  
  if (!fs.existsSync(fullPath)) {
    console.log(`Skipping ${filePath} - file not found`);
    return false;
  }
  
  if (!requiredImports || requiredImports.length === 0) {
    console.log(`Skipping ${filePath} - no imports defined`);
    return false;
  }
  
  let content = fs.readFileSync(fullPath, 'utf8');
  const originalContent = content;
  
  // Check if already optimized
  if (!content.includes('import * as THREE from')) {
    console.log(`Already optimized: ${filePath}`);
    return false;
  }
  
  // Create the new import statement
  const newImport = `import { ${requiredImports.join(', ')} } from 'three';`;
  
  // Replace the wildcard import
  content = content.replace(/import\s+\*\s+as\s+THREE\s+from\s+['"]three['"];?/g, newImport);
  
  // Replace all THREE. references with direct references
  requiredImports.forEach(className => {
    // Use word boundary to avoid partial replacements
    const regex = new RegExp(`THREE\\.${className}\\b`, 'g');
    content = content.replace(regex, className);
  });
  
  // Write the optimized file
  if (content !== originalContent) {
    fs.writeFileSync(fullPath, content, 'utf8');
    console.log(`✓ Optimized: ${filePath}`);
    console.log(`  Imports: ${requiredImports.length} classes`);
    return true;
  }
  
  return false;
}

/**
 * Main optimization process
 */
function main() {
  console.log('=== Three.js Import Optimization ===\n');
  
  let optimizedCount = 0;
  let skippedCount = 0;
  
  // Process files in order: utilities → services → contexts/hooks → components
  const fileOrder = [
    // Utilities first (lowest risk)
    ...Object.keys(importMap).filter(f => f.includes('/utils/')),
    // Services
    ...Object.keys(importMap).filter(f => f.includes('/services/')),
    // Contexts and hooks
    ...Object.keys(importMap).filter(f => f.includes('/contexts/') || f.includes('/hooks/')),
    // Components last (highest risk)
    ...Object.keys(importMap).filter(f => f.includes('/components/'))
  ];
  
  // Remove duplicates
  const uniqueFiles = [...new Set(fileOrder)];
  
  uniqueFiles.forEach(filePath => {
    if (optimizeFile(filePath, importMap[filePath])) {
      optimizedCount++;
    } else {
      skippedCount++;
    }
  });
  
  console.log('\n=== Summary ===');
  console.log(`Files optimized: ${optimizedCount}`);
  console.log(`Files skipped: ${skippedCount}`);
  console.log(`Total processed: ${optimizedCount + skippedCount}`);
  
  if (optimizedCount > 0) {
    console.log('\n✅ Optimization complete!');
    console.log('Next steps:');
    console.log('1. Run tests to ensure everything still works');
    console.log('2. Build the project to measure bundle size reduction');
    console.log('3. Test 3D functionality in the browser');
  }
}

// Run the optimization
main();