/**
 * Optimized Spatial Interpolation Engine for 3D Geological Modeling
 * Implements high-performance IDW with KD-tree optimization and result caching
 */

import { GeologicalValidator } from './GeologicalValidator';

const EPSILON = 1e-10;
const CACHE_SIZE = 1000; // Maximum cache entries

export class OptimizedSpatialInterpolation {
  // Static caches for performance
  static kdTreeCache = new WeakMap();
  static interpolationCache = new LRUCache(CACHE_SIZE);
  static gridCache = new Map();

  /**
   * Optimized KD-tree building with better memory layout
   */
  static buildKDTree(points) {
    if (!points || points.length === 0) return null;
    
    // Check cache
    if (this.kdTreeCache.has(points)) {
      return this.kdTreeCache.get(points);
    }
    
    // Build tree with iterative approach to avoid stack overflow
    const tree = this.buildTreeIterative(points);
    this.kdTreeCache.set(points, tree);
    return tree;
  }
  
  /**
   * Iterative KD-tree construction for better performance
   */
  static buildTreeIterative(points) {
    if (points.length === 0) return null;
    if (points.length === 1) return { point: points[0], left: null, right: null };
    
    const stack = [];
    const root = {};
    stack.push({ node: root, points: points, depth: 0 });
    
    while (stack.length > 0) {
      const { node, points: currentPoints, depth } = stack.pop();
      
      if (currentPoints.length === 0) continue;
      if (currentPoints.length === 1) {
        node.point = currentPoints[0];
        node.left = null;
        node.right = null;
        continue;
      }
      
      const axis = depth % 2;
      
      // Use quickselect for O(n) median finding instead of O(n log n) sort
      const median = Math.floor(currentPoints.length / 2);
      const medianPoint = this.quickSelect(currentPoints, median, axis);
      
      node.point = medianPoint;
      node.left = {};
      node.right = {};
      
      const leftPoints = [];
      const rightPoints = [];
      
      for (let i = 0; i < currentPoints.length; i++) {
        const p = currentPoints[i];
        if (p === medianPoint) continue;
        
        const value = axis === 0 ? p.x : p.y;
        const medianValue = axis === 0 ? medianPoint.x : medianPoint.y;
        
        if (value < medianValue) {
          leftPoints.push(p);
        } else {
          rightPoints.push(p);
        }
      }
      
      if (leftPoints.length > 0) {
        stack.push({ node: node.left, points: leftPoints, depth: depth + 1 });
      } else {
        node.left = null;
      }
      
      if (rightPoints.length > 0) {
        stack.push({ node: node.right, points: rightPoints, depth: depth + 1 });
      } else {
        node.right = null;
      }
    }
    
    return root;
  }
  
  /**
   * Quickselect algorithm for O(n) median finding
   */
  static quickSelect(points, k, axis) {
    const arr = [...points];
    let left = 0;
    let right = arr.length - 1;
    
    while (left < right) {
      const pivotIndex = this.partition(arr, left, right, axis);
      
      if (pivotIndex === k) {
        return arr[k];
      } else if (pivotIndex < k) {
        left = pivotIndex + 1;
      } else {
        right = pivotIndex - 1;
      }
    }
    
    return arr[k];
  }
  
  /**
   * Partition helper for quickselect
   */
  static partition(arr, left, right, axis) {
    const pivotValue = axis === 0 ? arr[right].x : arr[right].y;
    let i = left;
    
    for (let j = left; j < right; j++) {
      const value = axis === 0 ? arr[j].x : arr[j].y;
      if (value < pivotValue) {
        [arr[i], arr[j]] = [arr[j], arr[i]];
        i++;
      }
    }
    
    [arr[i], arr[right]] = [arr[right], arr[i]];
    return i;
  }
  
  /**
   * Optimized nearest neighbor search with heap-based priority queue
   */
  static findNearestNeighbors(tree, target, k = 8) {
    if (!tree) return [];
    
    const heap = new MinHeap(k);
    const stack = [{ node: tree, depth: 0 }];
    
    while (stack.length > 0) {
      const { node, depth } = stack.pop();
      if (!node) continue;
      
      // Calculate squared distance (avoid sqrt)
      const dx = node.point.x - target.x;
      const dy = node.point.y - target.y;
      const distSq = dx * dx + dy * dy;
      
      heap.insert({ point: node.point, distSq });
      
      const axis = depth % 2;
      const diff = axis === 0 ? target.x - node.point.x : target.y - node.point.y;
      
      // Determine which subtree to search first
      const first = diff < 0 ? node.left : node.right;
      const second = diff < 0 ? node.right : node.left;
      
      if (first) {
        stack.push({ node: first, depth: depth + 1 });
      }
      
      // Only search the other subtree if necessary
      if (second && (heap.size < k || diff * diff < heap.peek().distSq)) {
        stack.push({ node: second, depth: depth + 1 });
      }
    }
    
    return heap.toArray().map(item => item.point);
  }

  /**
   * Generate grid with caching
   */
  static generateGrid(extent, resolution) {
    const cacheKey = `${extent.minX}_${extent.maxX}_${extent.minY}_${extent.maxY}_${resolution}`;
    
    if (this.gridCache.has(cacheKey)) {
      return this.gridCache.get(cacheKey);
    }
    
    const points = [];
    const stepX = (extent.maxX - extent.minX) / (resolution - 1);
    const stepY = (extent.maxY - extent.minY) / (resolution - 1);
    
    // Pre-allocate array
    points.length = resolution * resolution;
    let index = 0;
    
    for (let i = 0; i < resolution; i++) {
      const x = extent.minX + stepX * i;
      for (let j = 0; j < resolution; j++) {
        const y = extent.minY + stepY * j;
        points[index++] = {
          x: x,
          y: y,
          gridIndex: { i, j }
        };
      }
    }
    
    // Cache for reuse
    if (this.gridCache.size > 100) {
      // Clear old entries if cache gets too large
      const firstKey = this.gridCache.keys().next().value;
      this.gridCache.delete(firstKey);
    }
    this.gridCache.set(cacheKey, points);
    
    return points;
  }

  /**
   * Optimized IDW with adaptive power and caching
   */
  static inverseDistanceWeighting(targetPoint, dataPoints, power = 2, maxDistance = null) {
    if (dataPoints.length === 0) return 0;
    if (dataPoints.length === 1) return dataPoints[0].value;
    
    // Check cache
    const cacheKey = `${targetPoint.x}_${targetPoint.y}_${power}_${maxDistance}`;
    const cached = this.interpolationCache.get(cacheKey);
    if (cached !== undefined) return cached;
    
    // Use squared distances to avoid sqrt in inner loop
    const maxDistSq = maxDistance ? maxDistance * maxDistance : Infinity;
    let numerator = 0;
    let denominator = 0;
    let exactMatch = null;
    
    // Process points in batches for better cache locality
    const batchSize = 8;
    for (let batch = 0; batch < dataPoints.length; batch += batchSize) {
      const end = Math.min(batch + batchSize, dataPoints.length);
      
      for (let i = batch; i < end; i++) {
        const point = dataPoints[i];
        const dx = targetPoint.x - point.x;
        const dy = targetPoint.y - point.y;
        const distSq = dx * dx + dy * dy;
        
        // Check for exact match
        if (distSq < EPSILON * EPSILON) {
          exactMatch = point.value;
          break;
        }
        
        // Skip if beyond max distance
        if (distSq > maxDistSq) continue;
        
        // Use optimized power calculation
        const weight = 1 / Math.pow(Math.sqrt(distSq), power);
        numerator += weight * point.value;
        denominator += weight;
      }
      
      if (exactMatch !== null) {
        this.interpolationCache.set(cacheKey, exactMatch);
        return exactMatch;
      }
    }
    
    // Handle edge case
    if (denominator < EPSILON) {
      // Find nearest point
      let minDistSq = Infinity;
      let nearestValue = 0;
      
      for (const point of dataPoints) {
        const dx = targetPoint.x - point.x;
        const dy = targetPoint.y - point.y;
        const distSq = dx * dx + dy * dy;
        
        if (distSq < minDistSq) {
          minDistSq = distSq;
          nearestValue = point.value;
        }
      }
      
      this.interpolationCache.set(cacheKey, nearestValue);
      return nearestValue;
    }
    
    const result = numerator / denominator;
    this.interpolationCache.set(cacheKey, result);
    return result;
  }

  /**
   * Batch interpolation for multiple points (optimized for cache locality)
   */
  static batchInterpolate(targets, dataPoints, power = 2, maxDistance = null) {
    const results = new Float32Array(targets.length);
    
    // Build KD-tree once for all queries
    const tree = this.buildKDTree(dataPoints);
    
    // Process in batches for better cache performance
    const batchSize = 32;
    for (let batch = 0; batch < targets.length; batch += batchSize) {
      const end = Math.min(batch + batchSize, targets.length);
      
      for (let i = batch; i < end; i++) {
        const target = targets[i];
        
        // Use KD-tree to find nearby points
        const nearby = maxDistance 
          ? this.findNearbyWithinRadius(tree, target, maxDistance)
          : this.findNearestNeighbors(tree, target, 8);
        
        results[i] = this.inverseDistanceWeighting(target, nearby, power, maxDistance);
      }
    }
    
    return results;
  }

  /**
   * Find points within radius using KD-tree
   */
  static findNearbyWithinRadius(tree, target, radius) {
    const radiusSq = radius * radius;
    const results = [];
    const stack = [{ node: tree, depth: 0 }];
    
    while (stack.length > 0) {
      const { node, depth } = stack.pop();
      if (!node) continue;
      
      const dx = node.point.x - target.x;
      const dy = node.point.y - target.y;
      const distSq = dx * dx + dy * dy;
      
      if (distSq <= radiusSq) {
        results.push({
          ...node.point,
          value: node.point.value || node.point.z || 0
        });
      }
      
      const axis = depth % 2;
      const diff = axis === 0 ? target.x - node.point.x : target.y - node.point.y;
      
      if (node.left && (diff < 0 || Math.abs(diff) <= radius)) {
        stack.push({ node: node.left, depth: depth + 1 });
      }
      
      if (node.right && (diff >= 0 || Math.abs(diff) <= radius)) {
        stack.push({ node: node.right, depth: depth + 1 });
      }
    }
    
    return results;
  }

  /**
   * Clear all caches
   */
  static clearCaches() {
    this.kdTreeCache = new WeakMap();
    this.interpolationCache.clear();
    this.gridCache.clear();
  }
}

/**
 * Simple LRU Cache implementation
 */
class LRUCache {
  constructor(maxSize) {
    this.maxSize = maxSize;
    this.cache = new Map();
  }
  
  get(key) {
    if (!this.cache.has(key)) return undefined;
    
    // Move to end (most recently used)
    const value = this.cache.get(key);
    this.cache.delete(key);
    this.cache.set(key, value);
    return value;
  }
  
  set(key, value) {
    // Remove oldest if at capacity
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    
    // Remove and re-add to move to end
    this.cache.delete(key);
    this.cache.set(key, value);
  }
  
  clear() {
    this.cache.clear();
  }
}

/**
 * Min heap for efficient k-nearest neighbor queries
 */
class MinHeap {
  constructor(maxSize) {
    this.maxSize = maxSize;
    this.heap = [];
  }
  
  get size() {
    return this.heap.length;
  }
  
  insert(item) {
    if (this.heap.length < this.maxSize) {
      this.heap.push(item);
      this.bubbleUp(this.heap.length - 1);
    } else if (item.distSq < this.heap[0].distSq) {
      this.heap[0] = item;
      this.bubbleDown(0);
    }
  }
  
  peek() {
    return this.heap[0];
  }
  
  bubbleUp(index) {
    while (index > 0) {
      const parentIndex = Math.floor((index - 1) / 2);
      if (this.heap[index].distSq >= this.heap[parentIndex].distSq) break;
      
      [this.heap[index], this.heap[parentIndex]] = [this.heap[parentIndex], this.heap[index]];
      index = parentIndex;
    }
  }
  
  bubbleDown(index) {
    while (true) {
      const leftChild = 2 * index + 1;
      const rightChild = 2 * index + 2;
      let smallest = index;
      
      if (leftChild < this.heap.length && 
          this.heap[leftChild].distSq < this.heap[smallest].distSq) {
        smallest = leftChild;
      }
      
      if (rightChild < this.heap.length && 
          this.heap[rightChild].distSq < this.heap[smallest].distSq) {
        smallest = rightChild;
      }
      
      if (smallest === index) break;
      
      [this.heap[index], this.heap[smallest]] = [this.heap[smallest], this.heap[index]];
      index = smallest;
    }
  }
  
  toArray() {
    return [...this.heap].sort((a, b) => a.distSq - b.distSq);
  }
}

export default OptimizedSpatialInterpolation;