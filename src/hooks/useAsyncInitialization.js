import { useEffect, useState, useRef } from 'react';
import { Logger } from '../utils/Logger.js';

const logger = new Logger().withContext('useAsyncInitialization');

/**
 * Hook for breaking up long initialization tasks to reduce Total Blocking Time
 * Yields control back to the browser between chunks to keep the UI responsive
 */
export const useAsyncInitialization = (initTasks, dependencies = []) => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [progress, setProgress] = useState(0);
  const abortRef = useRef(false);

  useEffect(() => {
    abortRef.current = false;
    let completed = 0;

    const runTasksAsync = async () => {
      for (const task of initTasks) {
        if (abortRef.current) break;
        
        // Yield to browser to prevent blocking
        await new Promise(resolve => {
          if ('scheduler' in window && 'yield' in window.scheduler) {
            // Use native scheduler.yield if available (Chrome 115+)
            window.scheduler.yield().then(resolve);
          } else if ('requestIdleCallback' in window) {
            // Use requestIdleCallback as fallback
            requestIdleCallback(resolve, { timeout: 50 });
          } else {
            // Final fallback to setTimeout
            setTimeout(resolve, 0);
          }
        });

        if (abortRef.current) break;

        try {
          await task();
          completed++;
          setProgress((completed / initTasks.length) * 100);
        } catch (error) {
          logger.error('Initialization task failed:', error);
        }
      }

      if (!abortRef.current) {
        setIsInitialized(true);
      }
    };

    runTasksAsync();

    return () => {
      abortRef.current = true;
    };
  }, dependencies);

  return { isInitialized, progress };
};

/**
 * Utility to break up array processing into chunks
 * Prevents blocking when processing large datasets
 */
export const processInChunks = async (array, processFunc, chunkSize = 10) => {
  const results = [];
  
  for (let i = 0; i < array.length; i += chunkSize) {
    const chunk = array.slice(i, i + chunkSize);
    const chunkResults = await Promise.all(chunk.map(processFunc));
    results.push(...chunkResults);
    
    // Yield to browser between chunks
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  
  return results;
};

/**
 * Break up heavy synchronous work using generators
 */
export function* chunkWork(items, processFunc, chunkSize = 50) {
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    yield chunk.map(processFunc);
  }
}

/**
 * Run generator with yielding to browser
 */
export const runGenerator = async (generator) => {
  const results = [];
  
  for (const chunk of generator) {
    results.push(...chunk);
    // Yield control to browser
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  
  return results;
};