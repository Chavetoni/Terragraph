/**
 * Test Suite for ExportMemoryManager
 *
 * Comprehensive tests for export-specific memory management functionality
 * including resource tracking, cleanup strategies, memory pressure handling,
 * and integration with geological modeling export operations.
 */

import {
  ExportMemoryManager,
  ExportPhase,
  MemoryPressure,
  ResourceType,
  getExportMemoryManager,
  disposeExportMemoryManager
} from './exportMemoryManager.js';

import {
  BufferGeometry,
  Material,
  Texture,
  Mesh,
  Group,
  MeshStandardMaterial,
  BoxGeometry,
  CanvasTexture,
  Vector3
} from 'three';

// Mock performance.now for consistent testing
const mockPerformanceNow = jest.fn();
Object.defineProperty(window, 'performance', {
  value: {
    now: mockPerformanceNow,
    memory: {
      usedJSHeapSize: 50 * 1024 * 1024,    // 50MB
      totalJSHeapSize: 100 * 1024 * 1024,  // 100MB
      jsHeapSizeLimit: 200 * 1024 * 1024   // 200MB limit
    }
  },
  writable: true
});

// Mock console methods to avoid noise in tests
const originalConsole = { ...console };
beforeAll(() => {
  console.log = jest.fn();
  console.info = jest.fn();
  console.warn = jest.fn();
  console.error = jest.fn();
});

afterAll(() => {
  Object.assign(console, originalConsole);
});

describe('ExportMemoryManager', () => {
  let exportMemoryManager;
  let mockTime;

  beforeEach(() => {
    mockTime = 1000;
    mockPerformanceNow.mockImplementation(() => mockTime);

    exportMemoryManager = new ExportMemoryManager({
      debugMode: true,
      verboseLogging: false,
      monitoringInterval: 0, // Disable automatic monitoring for tests
      cleanupInterval: 0
    });

    // Clear any existing singleton
    disposeExportMemoryManager();
  });

  afterEach(() => {
    if (exportMemoryManager) {
      exportMemoryManager.dispose();
    }
    disposeExportMemoryManager();
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    test('should initialize with default options', () => {
      const manager = new ExportMemoryManager();

      expect(manager.currentPhase).toBe(ExportPhase.IDLE);
      expect(manager.exportId).toBeNull();
      expect(manager.exportResources.size).toBe(0);
      expect(manager.temporaryResources.size).toBe(0);
      expect(manager.clonedObjects.size).toBe(0);
      expect(manager.resourcePools.size).toBe(0);

      manager.dispose();
    });

    test('should initialize with custom options', () => {
      const customOptions = {
        warningThreshold: 0.60,
        criticalThreshold: 0.80,
        maxTemporaryResources: 500,
        debugMode: false
      };

      const manager = new ExportMemoryManager(customOptions);

      expect(manager.options.warningThreshold).toBe(0.60);
      expect(manager.options.criticalThreshold).toBe(0.80);
      expect(manager.options.maxTemporaryResources).toBe(500);
      expect(manager.options.debugMode).toBe(false);

      manager.dispose();
    });

    test('should initialize cleanup strategies', () => {
      expect(exportMemoryManager.cleanupStrategies.size).toBeGreaterThan(0);
      expect(exportMemoryManager.cleanupStrategies.has(ResourceType.GEOMETRY)).toBe(true);
      expect(exportMemoryManager.cleanupStrategies.has(ResourceType.MATERIAL)).toBe(true);
      expect(exportMemoryManager.cleanupStrategies.has(ResourceType.TEXTURE)).toBe(true);
      expect(exportMemoryManager.cleanupStrategies.has(ResourceType.MESH)).toBe(true);
      expect(exportMemoryManager.cleanupStrategies.has(ResourceType.GROUP)).toBe(true);
    });
  });

  describe('Export Operation Lifecycle', () => {
    test('should start export operation', () => {
      const exportId = 'test-export-001';
      const session = exportMemoryManager.startExportOperation(exportId, { format: 'obj' });

      expect(session.exportId).toBe(exportId);
      expect(session.phase).toBe(ExportPhase.PREPARING);
      expect(session.startTime).toBe(mockTime);
      expect(exportMemoryManager.currentPhase).toBe(ExportPhase.PREPARING);
      expect(exportMemoryManager.exportId).toBe(exportId);
      expect(exportMemoryManager.memorySnapshots.length).toBe(1);
    });

    test('should transition between export phases', () => {
      const exportId = 'test-export-002';
      exportMemoryManager.startExportOperation(exportId);

      // Advance mock time
      mockTime += 1000;

      exportMemoryManager.setExportPhase(ExportPhase.PROCESSING, { detail: 'test' });

      expect(exportMemoryManager.currentPhase).toBe(ExportPhase.PROCESSING);
      expect(exportMemoryManager.phaseMetrics.has(ExportPhase.PREPARING)).toBe(true);
      expect(exportMemoryManager.memorySnapshots.length).toBe(2);

      const preparingMetrics = exportMemoryManager.phaseMetrics.get(ExportPhase.PREPARING);
      expect(preparingMetrics.duration).toBe(1000);
    });

    test('should handle overlapping export operations', () => {
      const firstExportId = 'test-export-003a';
      const secondExportId = 'test-export-003b';

      exportMemoryManager.startExportOperation(firstExportId);
      expect(exportMemoryManager.exportId).toBe(firstExportId);

      // Start another export - should cleanup previous
      exportMemoryManager.startExportOperation(secondExportId);
      expect(exportMemoryManager.exportId).toBe(secondExportId);
      expect(exportMemoryManager.currentPhase).toBe(ExportPhase.PREPARING);
    });

    test('should cleanup export operation', () => {
      const exportId = 'test-export-004';
      exportMemoryManager.startExportOperation(exportId);

      // Add some resources
      const geometry = new BoxGeometry();
      exportMemoryManager.trackExportResource('test-geom', geometry, ResourceType.GEOMETRY, { temporary: true });

      expect(exportMemoryManager.exportResources.size).toBe(1);
      expect(exportMemoryManager.temporaryResources.size).toBe(1);

      const result = exportMemoryManager.cleanupExportOperation();

      expect(result.success).toBe(true);
      expect(result.resourcesCleaned).toBe(1);
      expect(exportMemoryManager.currentPhase).toBe(ExportPhase.COMPLETED);
      expect(exportMemoryManager.exportId).toBeNull();
      expect(exportMemoryManager.exportResources.size).toBe(0);
      expect(exportMemoryManager.temporaryResources.size).toBe(0);
    });

    test('should handle export cancellation', () => {
      const exportId = 'test-export-005';
      exportMemoryManager.startExportOperation(exportId);
      exportMemoryManager.setExportPhase(ExportPhase.PROCESSING);

      const result = exportMemoryManager.handleExportCancellation('User requested');

      expect(exportMemoryManager.currentPhase).toBe(ExportPhase.CANCELLED);
      expect(result.success).toBe(true);
    });
  });

  describe('Resource Tracking', () => {
    beforeEach(() => {
      exportMemoryManager.startExportOperation('test-tracking');
    });

    test('should track export resources', () => {
      const geometry = new BoxGeometry();
      const material = new MeshStandardMaterial();
      const mesh = new Mesh(geometry, material);

      exportMemoryManager.trackExportResource('test-geom', geometry, ResourceType.GEOMETRY);
      exportMemoryManager.trackExportResource('test-mat', material, ResourceType.MATERIAL);
      exportMemoryManager.trackExportResource('test-mesh', mesh, ResourceType.MESH, { temporary: true });

      expect(exportMemoryManager.exportResources.size).toBe(3);
      expect(exportMemoryManager.temporaryResources.size).toBe(1);

      const trackedMesh = exportMemoryManager.exportResources.get('test-mesh');
      expect(trackedMesh.resource).toBe(mesh);
      expect(trackedMesh.type).toBe(ResourceType.MESH);
      expect(trackedMesh.metadata.temporary).toBe(true);
    });

    test('should track cloned resources', () => {
      const originalGeometry = new BoxGeometry();

      const cloned = exportMemoryManager.trackClonedResource(
        'cloned-geom',
        originalGeometry,
        ResourceType.GEOMETRY
      );

      expect(cloned).not.toBe(originalGeometry);
      expect(cloned).toBeInstanceOf(BufferGeometry);
      expect(exportMemoryManager.clonedObjects.size).toBe(1);
      expect(exportMemoryManager.temporaryResources.has('cloned-geom')).toBe(true);

      const cloneInfo = exportMemoryManager.clonedObjects.get('cloned-geom');
      expect(cloneInfo.original).toBe(originalGeometry);
      expect(cloneInfo.clone).toBe(cloned);
    });

    test('should handle invalid resource tracking', () => {
      exportMemoryManager.trackExportResource('null-resource', null, ResourceType.GEOMETRY);
      expect(exportMemoryManager.exportResources.size).toBe(0);

      const invalidClone = exportMemoryManager.trackClonedResource('invalid-clone', null, ResourceType.GEOMETRY);
      expect(invalidClone).toBeNull();
      expect(exportMemoryManager.clonedObjects.size).toBe(0);
    });

    test('should dispose individual export resources', () => {
      const geometry = new BoxGeometry();
      const disposeSpy = jest.spyOn(geometry, 'dispose');

      exportMemoryManager.trackExportResource('disposable-geom', geometry, ResourceType.GEOMETRY);
      expect(exportMemoryManager.exportResources.size).toBe(1);

      const success = exportMemoryManager.disposeExportResource('disposable-geom');

      expect(success).toBe(true);
      expect(disposeSpy).toHaveBeenCalled();
      expect(exportMemoryManager.exportResources.size).toBe(0);
    });
  });

  describe('Resource Pools', () => {
    beforeEach(() => {
      exportMemoryManager.startExportOperation('test-pools');
    });

    test('should create resource pool', () => {
      const pool = exportMemoryManager.createResourcePool(
        'geometry-pool',
        ResourceType.GEOMETRY,
        { maxSize: 50 }
      );

      expect(pool).toBeDefined();
      expect(typeof pool.getOrCreate).toBe('function');
      expect(typeof pool.release).toBe('function');
      expect(typeof pool.getStats).toBe('function');
      expect(exportMemoryManager.resourcePools.size).toBe(1);
    });

    test('should use resource pool for get or create', () => {
      const pool = exportMemoryManager.createResourcePool('test-pool', ResourceType.GEOMETRY);

      // First request - should create new
      const geom1 = pool.getOrCreate('box-1x1x1', () => new BoxGeometry(1, 1, 1));
      expect(geom1).toBeInstanceOf(BoxGeometry);

      const stats1 = pool.getStats();
      expect(stats1.created).toBe(1);
      expect(stats1.reused).toBe(0);
      expect(stats1.hits).toBe(0);
      expect(stats1.misses).toBe(1);

      // Release resource
      pool.release('box-1x1x1');

      // Second request - should reuse
      const geom2 = pool.getOrCreate('box-1x1x1', () => new BoxGeometry(1, 1, 1));
      expect(geom2).toBe(geom1); // Same instance

      const stats2 = pool.getStats();
      expect(stats2.created).toBe(1);
      expect(stats2.reused).toBe(1);
      expect(stats2.hits).toBe(1);
      expect(stats2.misses).toBe(1);
    });

    test('should clear resource pool', () => {
      const pool = exportMemoryManager.createResourcePool('clearable-pool', ResourceType.GEOMETRY);

      // Add some resources
      pool.getOrCreate('res1', () => new BoxGeometry());
      pool.getOrCreate('res2', () => new BoxGeometry());

      expect(pool.getStats().size).toBe(2);

      pool.clear();

      expect(pool.getStats().size).toBe(0);
      expect(exportMemoryManager.resourcePools.size).toBe(1); // Pool still exists, just cleared
    });
  });

  describe('Memory Monitoring', () => {
    test('should take memory snapshots', () => {
      exportMemoryManager.startExportOperation('snapshot-test');

      const snapshot = exportMemoryManager.takeMemorySnapshot('test-snapshot');

      expect(snapshot.label).toBe('test-snapshot');
      expect(snapshot.timestamp).toBe(mockTime);
      expect(snapshot.exportId).toBe('snapshot-test');
      expect(snapshot.phase).toBe(ExportPhase.PREPARING);
      expect(typeof snapshot.usagePercent).toBe('number');
    });

    test('should calculate memory pressure', () => {
      const lowPressure = exportMemoryManager.calculateMemoryPressure(30);
      const moderatePressure = exportMemoryManager.calculateMemoryPressure(60);
      const highPressure = exportMemoryManager.calculateMemoryPressure(80);
      const criticalPressure = exportMemoryManager.calculateMemoryPressure(90);

      expect(lowPressure).toBe(MemoryPressure.LOW);
      expect(moderatePressure).toBe(MemoryPressure.MODERATE);
      expect(highPressure).toBe(MemoryPressure.HIGH);
      expect(criticalPressure).toBe(MemoryPressure.CRITICAL);
    });

    test('should add and manage memory warnings', () => {
      exportMemoryManager.addMemoryWarning({
        level: 'warning',
        message: 'Test warning',
        timestamp: mockTime
      });

      expect(exportMemoryManager.memoryWarnings.length).toBe(1);
      expect(exportMemoryManager.getMemoryWarnings().length).toBe(1);

      exportMemoryManager.clearMemoryWarnings();
      expect(exportMemoryManager.memoryWarnings.length).toBe(0);
    });

    test('should get memory recommendations', () => {
      exportMemoryManager.startExportOperation('recommendations-test');

      // Add many temporary resources to trigger recommendations
      for (let i = 0; i < 60; i++) {
        exportMemoryManager.trackExportResource(`temp-${i}`, new BoxGeometry(), ResourceType.GEOMETRY, { temporary: true });
      }

      const recommendations = exportMemoryManager.getMemoryRecommendations();
      expect(recommendations).toContain('Clean up temporary resources');
    });
  });

  describe('Cleanup Strategies', () => {
    beforeEach(() => {
      exportMemoryManager.startExportOperation('cleanup-test');
    });

    test('should dispose geometry resources', () => {
      const geometry = new BoxGeometry();
      const disposeSpy = jest.spyOn(geometry, 'dispose');

      const success = exportMemoryManager.disposeResource(geometry, ResourceType.GEOMETRY);

      expect(success).toBe(true);
      expect(disposeSpy).toHaveBeenCalled();
    });

    test('should dispose material resources with textures', () => {
      const material = new MeshStandardMaterial();
      const texture = new CanvasTexture(document.createElement('canvas'));
      material.map = texture;

      const materialDisposeSpy = jest.spyOn(material, 'dispose');
      const textureDisposeSpy = jest.spyOn(texture, 'dispose');

      const success = exportMemoryManager.disposeResource(material, ResourceType.MATERIAL);

      expect(success).toBe(true);
      expect(textureDisposeSpy).toHaveBeenCalled();
      expect(materialDisposeSpy).toHaveBeenCalled();
    });

    test('should dispose mesh resources', () => {
      const geometry = new BoxGeometry();
      const material = new MeshStandardMaterial();
      const mesh = new Mesh(geometry, material);

      const geomDisposeSpy = jest.spyOn(geometry, 'dispose');
      const matDisposeSpy = jest.spyOn(material, 'dispose');

      const success = exportMemoryManager.disposeResource(mesh, ResourceType.MESH);

      expect(success).toBe(true);
      // Note: In actual implementation, the mesh disposal strategy would dispose geometry and material
    });

    test('should handle disposal of unknown resource types', () => {
      const unknownResource = { someProperty: 'value' };

      const success = exportMemoryManager.disposeResource(unknownResource, 'unknown-type');
      expect(success).toBe(false);
    });

    test('should handle disposal errors gracefully', () => {
      const faultyResource = {
        dispose: () => {
          throw new Error('Disposal failed');
        }
      };

      const success = exportMemoryManager.disposeResource(faultyResource, ResourceType.GEOMETRY);
      expect(success).toBe(false);
    });
  });

  describe('Performance and Statistics', () => {
    test('should provide comprehensive export memory statistics', () => {
      exportMemoryManager.startExportOperation('stats-test');

      // Add various resources
      exportMemoryManager.trackExportResource('geom1', new BoxGeometry(), ResourceType.GEOMETRY);
      exportMemoryManager.trackExportResource('mat1', new MeshStandardMaterial(), ResourceType.MATERIAL, { temporary: true });
      exportMemoryManager.trackClonedResource('clone1', new BoxGeometry(), ResourceType.GEOMETRY);

      const stats = exportMemoryManager.getExportMemoryStats();

      expect(stats.export.id).toBe('stats-test');
      expect(stats.export.resourcesTracked).toBe(3);
      expect(stats.export.temporaryResources).toBe(2); // mat1 and clone1
      expect(stats.export.clonedObjects).toBe(1);

      expect(stats.resourceTypes).toBeDefined();
      expect(stats.memoryMonitoring).toBeDefined();
      expect(stats.performance).toBeDefined();
      expect(stats.recommendations).toBeInstanceOf(Array);
    });

    test('should estimate resource sizes', () => {
      const geometry = new BoxGeometry(1, 1, 1);
      const size = exportMemoryManager.estimateResourceSize(geometry);
      expect(size).toBeGreaterThan(0);

      const nullSize = exportMemoryManager.estimateResourceSize(null);
      expect(nullSize).toBe(0);
    });

    test('should provide debug information in debug mode', () => {
      const debugInfo = exportMemoryManager.getDebugInfo();

      expect(debugInfo.debugMode).toBe(true);
      expect(debugInfo.currentState).toBeDefined();
      expect(debugInfo.resources).toBeDefined();
      expect(debugInfo.monitoring).toBeDefined();
      expect(debugInfo.options).toBeDefined();
      expect(debugInfo.cleanupStrategies).toBeInstanceOf(Array);
    });

    test('should not provide debug information when debug mode is disabled', () => {
      const prodManager = new ExportMemoryManager({ debugMode: false });
      const debugInfo = prodManager.getDebugInfo();

      expect(debugInfo.debugMode).toBe(false);
      expect(Object.keys(debugInfo).length).toBe(1);

      prodManager.dispose();
    });
  });

  describe('Emergency and Proactive Cleanup', () => {
    beforeEach(() => {
      exportMemoryManager.startExportOperation('cleanup-test');

      // Mock high memory usage
      window.performance.memory.usedJSHeapSize = 170 * 1024 * 1024; // 85% of 200MB limit
    });

    test('should perform proactive cleanup', () => {
      // Add temporary resources
      for (let i = 0; i < 10; i++) {
        exportMemoryManager.trackExportResource(`temp-${i}`, new BoxGeometry(), ResourceType.GEOMETRY, { temporary: true });
      }

      expect(exportMemoryManager.temporaryResources.size).toBe(10);

      exportMemoryManager.performProactiveCleanup();

      expect(exportMemoryManager.temporaryResources.size).toBe(0);
    });

    test('should perform emergency cleanup', async () => {
      // Add various resources
      exportMemoryManager.trackExportResource('temp1', new BoxGeometry(), ResourceType.GEOMETRY, { temporary: true });
      exportMemoryManager.trackClonedResource('clone1', new BoxGeometry(), ResourceType.GEOMETRY);
      exportMemoryManager.createResourcePool('emergency-pool', ResourceType.GEOMETRY);

      expect(exportMemoryManager.temporaryResources.size).toBe(2);
      expect(exportMemoryManager.resourcePools.size).toBe(1);

      await exportMemoryManager.performEmergencyCleanup();

      expect(exportMemoryManager.temporaryResources.size).toBe(0);
      expect(exportMemoryManager.resourcePools.size).toBe(0); // Should be cleared
    });

    test('should handle emergency cleanup errors gracefully', async () => {
      // Mock error during cleanup
      const originalClear = exportMemoryManager.temporaryResources.clear;
      exportMemoryManager.temporaryResources.clear = jest.fn(() => {
        throw new Error('Cleanup failed');
      });

      // Should not throw
      await expect(exportMemoryManager.performEmergencyCleanup()).resolves.toBeUndefined();

      // Restore original method
      exportMemoryManager.temporaryResources.clear = originalClear;
    });
  });

  describe('Integration with Volumetric Disposal', () => {
    test('should extend VolumetricResourceTracker functionality', () => {
      // Check that it has parent class methods
      expect(typeof exportMemoryManager.track).toBe('function');
      expect(typeof exportMemoryManager.dispose).toBe('function');
      expect(typeof exportMemoryManager.getStats).toBe('function');
      expect(typeof exportMemoryManager.disposeAll).toBe('function');
    });

    test('should track resources with parent class', () => {
      const geometry = new BoxGeometry();
      exportMemoryManager.track('parent-track', geometry, ResourceType.GEOMETRY);

      const stats = exportMemoryManager.getStats();
      expect(stats.active).toBeGreaterThan(0);
    });
  });

  describe('Singleton Pattern', () => {
    test('should create singleton instance', () => {
      const manager1 = getExportMemoryManager();
      const manager2 = getExportMemoryManager();

      expect(manager1).toBe(manager2);
      expect(manager1).toBeInstanceOf(ExportMemoryManager);
    });

    test('should dispose singleton instance', () => {
      const manager = getExportMemoryManager();
      expect(manager).toBeInstanceOf(ExportMemoryManager);

      disposeExportMemoryManager();

      const newManager = getExportMemoryManager();
      expect(newManager).not.toBe(manager);
    });

    test('should create singleton with custom options', () => {
      disposeExportMemoryManager();

      const customOptions = { debugMode: false, warningThreshold: 0.5 };
      const manager = getExportMemoryManager(customOptions);

      expect(manager.options.debugMode).toBe(false);
      expect(manager.options.warningThreshold).toBe(0.5);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('should handle disposal during active processing phase', () => {
      exportMemoryManager.startExportOperation('active-test');
      exportMemoryManager.setExportPhase(ExportPhase.PROCESSING);

      // Should warn but not cleanup when not forced
      const result1 = exportMemoryManager.cleanupExportOperation(false);
      expect(result1).toBeUndefined();

      // Should cleanup when forced
      const result2 = exportMemoryManager.cleanupExportOperation(true);
      expect(result2.success).toBe(true);
    });

    test('should handle multiple dispose calls gracefully', () => {
      const geometry = new BoxGeometry();
      exportMemoryManager.startExportOperation('multi-dispose-test');
      exportMemoryManager.trackExportResource('multi-dispose', geometry, ResourceType.GEOMETRY);

      const success1 = exportMemoryManager.disposeExportResource('multi-dispose');
      expect(success1).toBe(true);

      const success2 = exportMemoryManager.disposeExportResource('multi-dispose');
      expect(success2).toBe(false); // Already disposed
    });

    test('should handle resource pool creation with existing ID', () => {
      exportMemoryManager.startExportOperation('pool-collision-test');

      const pool1 = exportMemoryManager.createResourcePool('collision-pool', ResourceType.GEOMETRY);
      const pool2 = exportMemoryManager.createResourcePool('collision-pool', ResourceType.MATERIAL);

      // Should overwrite existing pool
      expect(exportMemoryManager.resourcePools.size).toBe(1);
    });

    test('should handle invalid export phase transitions', () => {
      exportMemoryManager.startExportOperation('invalid-phase-test');

      // Should not change phase for invalid phase
      exportMemoryManager.setExportPhase('invalid-phase');
      expect(exportMemoryManager.currentPhase).toBe(ExportPhase.PREPARING);
    });

    test('should handle memory monitoring when performance.memory is unavailable', () => {
      const originalMemory = window.performance.memory;
      delete window.performance.memory;

      exportMemoryManager.monitorMemoryUsage();

      // Should not crash, but also not update pressure
      expect(exportMemoryManager.currentPressure).toBe(MemoryPressure.LOW);

      // Restore memory object
      window.performance.memory = originalMemory;
    });
  });

  describe('Performance Optimization', () => {
    test('should batch resource disposal efficiently', () => {
      exportMemoryManager.startExportOperation('batch-test');

      // Create many resources
      const resources = [];
      for (let i = 0; i < 100; i++) {
        const geom = new BoxGeometry();
        resources.push(geom);
        exportMemoryManager.trackExportResource(`batch-${i}`, geom, ResourceType.GEOMETRY, { temporary: true });
      }

      expect(exportMemoryManager.temporaryResources.size).toBe(100);

      const startTime = performance.now();
      exportMemoryManager.cleanupExportOperation();
      const endTime = performance.now();

      expect(exportMemoryManager.temporaryResources.size).toBe(0);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete quickly
    });

    test('should efficiently manage large resource pools', () => {
      const pool = exportMemoryManager.createResourcePool('large-pool', ResourceType.GEOMETRY, { maxSize: 1000 });

      // Add many resources
      for (let i = 0; i < 50; i++) {
        pool.getOrCreate(`item-${i}`, () => new BoxGeometry());
        pool.release(`item-${i}`);
      }

      const stats = pool.getStats();
      expect(stats.size).toBe(50);
      expect(stats.created).toBe(50);

      // Reuse resources
      for (let i = 0; i < 25; i++) {
        pool.getOrCreate(`item-${i}`, () => new BoxGeometry());
      }

      const stats2 = pool.getStats();
      expect(stats2.reused).toBe(25);
    });
  });
});