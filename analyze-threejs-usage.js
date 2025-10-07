#!/usr/bin/env node


const fs = require('fs');
const path = require('path');

// Files to analyze (excluding test files initially)
const filesToAnalyze = [
  // Utility files (lowest risk)
  'src/utils/threeJsHelpers.js',
  'src/utils/volumetricDisposal.js',
  'src/utils/modelUtils.js',
  'src/utils/optimizedMemoryManagement.js',
  'src/utils/enhancedMeshBuilder.js',
  
  // Service files (medium risk)
  'src/services/VolumetricMeshGenerator.js',
  'src/services/SceneExporter.js',
  'src/services/SimpleSceneManager.js',
  'src/services/OptimizedSceneManager.js',
  'src/services/BoreholeVisualizer.js',
  'src/services/ThreeJsObjectFactory.js',
  'src/services/SceneManager.js',
  'src/services/TextureManager.js',
  'src/services/MultiLevelSurfaceGenerator.js',
  'src/services/OptimizedVolumetricMeshGenerator.js',
  'src/services/GLTFLoader.js',
  
  // Context files
  'src/contexts/ThreeJsContext.js',
  'src/contexts/SiteMapContext.js',
  'src/contexts/BoreholeContext.js',
  
  // Hook files
  'src/hooks/useSiteMap.js',
  'src/hooks/useSoilTextures.js',
  'src/hooks/useWaterTable.js',
  'src/hooks/useBoreholes.js',
  'src/hooks/useThreeJsScene.js',
  
  // Component files (higher risk)
  'src/components/canvas/VolumetricDepthScale.js',
  'src/components/canvas/VolumetricLabels.js',
  'src/components/canvas/VolumetricGeologicalModel.js',
  'src/components/visualization/ConfidenceMappingOverlay.js'
];

// Regular expression to find Three.js usage patterns
const threeUsagePattern = /THREE\.([A-Za-z0-9_]+)/g;

// Store results
const results = {};

// Analyze each file
filesToAnalyze.forEach(filePath => {
  const fullPath = path.join(__dirname, filePath);
  
  if (!fs.existsSync(fullPath)) {
    console.log(`File not found: ${filePath}`);
    return;
  }
  
  const content = fs.readFileSync(fullPath, 'utf8');
  const matches = content.matchAll(threeUsagePattern);
  
  const usedClasses = new Set();
  for (const match of matches) {
    usedClasses.add(match[1]);
  }
  
  if (usedClasses.size > 0) {
    results[filePath] = Array.from(usedClasses).sort();
  }
});

// Generate import statements for each file
console.log('=== Three.js Import Analysis ===\n');

Object.entries(results).forEach(([filePath, classes]) => {
  console.log(`File: ${filePath}`);
  console.log(`Used classes (${classes.length}): ${classes.join(', ')}`);
  
  // Generate optimized import statement
  const importStatement = `import { ${classes.join(', ')} } from 'three';`;
  console.log(`Optimized import: ${importStatement}`);
  console.log('---\n');
});

// Calculate statistics
const allClasses = new Set();
Object.values(results).forEach(classes => {
  classes.forEach(cls => allClasses.add(cls));
});

console.log('=== Statistics ===');
console.log(`Total files analyzed: ${Object.keys(results).length}`);
console.log(`Total unique Three.js classes used: ${allClasses.size}`);
console.log(`Most commonly used: ${Array.from(allClasses).slice(0, 10).join(', ')}`);

// Export results as JSON for further processing
fs.writeFileSync(
  path.join(__dirname, 'threejs-usage-analysis.json'),
  JSON.stringify(results, null, 2)
);

console.log('\nAnalysis complete! Results saved to threejs-usage-analysis.json');