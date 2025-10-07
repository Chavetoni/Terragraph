/**
 * Centralized Logging System for Geological Modeling Platform
 * 
 * Features:
 * - Environment-aware logging (development vs production)
 * - Multiple log levels (debug, info, warn, error)
 * - Consistent formatting and prefixes
 * - Performance timing utilities
 * - Memory-efficient (no logging in production builds)
 */

// Log levels enumeration
export const LogLevel = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  NONE: 4
};

// Environment detection
const isDevelopment = process.env.NODE_ENV === 'development';
const isTest = process.env.NODE_ENV === 'test';

// Current log level based on environment
const getCurrentLogLevel = () => {
  if (isTest) return LogLevel.ERROR; // Only errors in tests
  if (isDevelopment) return LogLevel.DEBUG; // All logs in development
  return LogLevel.NONE; // No logs in production
};

// Performance timing storage
const performanceTimers = new Map();

/**
 * Logger class with environment-aware logging capabilities
 */
class Logger {
  constructor() {
    this.logLevel = getCurrentLogLevel();
    this.context = '';
  }

  /**
   * Set logging context (e.g., component name, service name)
   */
  setContext(context) {
    this.context = context;
    return this;
  }

  /**
   * Create a new logger instance with specific context
   */
  withContext(context) {
    const logger = new Logger();
    logger.context = context;
    return logger;
  }

  /**
   * Check if a log level should be output
   */
  shouldLog(level) {
    return this.logLevel <= level;
  }

  /**
   * Format log message with timestamp and context
   */
  formatMessage(level, message, data) {
    const timestamp = new Date().toISOString().slice(11, 23); // HH:mm:ss.SSS
    const levelName = Object.keys(LogLevel)[level];
    const contextStr = this.context ? `[${this.context}]` : '';
    
    const prefix = `${timestamp} ${levelName}${contextStr}`;
    
    if (data !== undefined) {
      return [prefix, message, data];
    }
    return [prefix, message];
  }

  /**
   * Debug level logging - detailed information for development
   * Used for: Geological calculations, 3D scene debugging, detailed flow traces
   */
  debug(message, data) {
    if (!this.shouldLog(LogLevel.DEBUG)) return;
    
    const args = this.formatMessage(LogLevel.DEBUG, message, data);
    console.log(...args);
  }

  /**
   * Info level logging - general information
   * Used for: Process completion, status updates, user actions
   */
  info(message, data) {
    if (!this.shouldLog(LogLevel.INFO)) return;
    
    const args = this.formatMessage(LogLevel.INFO, message, data);
    console.info(...args);
  }

  /**
   * Warning level logging - potential issues
   * Used for: Validation warnings, performance concerns, deprecated usage
   */
  warn(message, data) {
    if (!this.shouldLog(LogLevel.WARN)) return;
    
    const args = this.formatMessage(LogLevel.WARN, message, data);
    console.warn(...args);
  }

  /**
   * Error level logging - serious issues
   * Used for: Exceptions, failures, critical problems
   */
  error(message, data) {
    if (!this.shouldLog(LogLevel.ERROR)) return;
    
    const args = this.formatMessage(LogLevel.ERROR, message, data);
    console.error(...args);
  }

  /**
   * Log with custom level
   */
  log(level, message, data) {
    switch (level) {
      case LogLevel.DEBUG:
        this.debug(message, data);
        break;
      case LogLevel.INFO:
        this.info(message, data);
        break;
      case LogLevel.WARN:
        this.warn(message, data);
        break;
      case LogLevel.ERROR:
        this.error(message, data);
        break;
      default:
        this.info(message, data);
        break;
    }
  }

  /**
   * Performance timing utilities
   */
  
  /**
   * Start a performance timer
   */
  startTimer(label) {
    if (!this.shouldLog(LogLevel.DEBUG)) return;
    
    const key = this.context ? `${this.context}:${label}` : label;
    performanceTimers.set(key, performance.now());
    this.debug(`Timer started: ${label}`);
  }

  /**
   * End a performance timer and log the duration
   */
  endTimer(label, message) {
    if (!this.shouldLog(LogLevel.DEBUG)) return;
    
    const key = this.context ? `${this.context}:${label}` : label;
    const startTime = performanceTimers.get(key);
    
    if (startTime === undefined) {
      this.warn(`Timer '${label}' was not started`);
      return;
    }
    
    const duration = performance.now() - startTime;
    performanceTimers.delete(key);
    
    const finalMessage = message || `Timer completed: ${label}`;
    this.debug(`${finalMessage} (${duration.toFixed(2)}ms)`);
    
    return duration;
  }

  /**
   * Log execution time of a function
   */
  time(label, fn) {
    if (!this.shouldLog(LogLevel.DEBUG)) {
      return fn(); // Just execute without timing in production
    }
    
    this.startTimer(label);
    try {
      const result = fn();
      this.endTimer(label);
      return result;
    } catch (error) {
      this.endTimer(label, `Timer failed: ${label}`);
      throw error;
    }
  }

  /**
   * Log execution time of an async function
   */
  async timeAsync(label, fn) {
    if (!this.shouldLog(LogLevel.DEBUG)) {
      return await fn(); // Just execute without timing in production
    }
    
    this.startTimer(label);
    try {
      const result = await fn();
      this.endTimer(label);
      return result;
    } catch (error) {
      this.endTimer(label, `Async timer failed: ${label}`);
      throw error;
    }
  }

  /**
   * Geological modeling specific logging methods
   */

  /**
   * Log geological calculation details
   */
  geological(message, data) {
    this.debug(`[GEOLOGICAL] ${message}`, data);
  }

  /**
   * Log 3D scene operations
   */
  scene3d(message, data) {
    this.debug(`[3D_SCENE] ${message}`, data);
  }

  /**
   * Log interpolation process details
   */
  interpolation(message, data) {
    this.debug(`[INTERPOLATION] ${message}`, data);
  }

  /**
   * Log export process details
   */
  export(message, data) {
    this.info(`[EXPORT] ${message}`, data);
  }

  /**
   * Log validation results
   */
  validation(message, data) {
    this.debug(`[VALIDATION] ${message}`, data);
  }

  /**
   * Log performance metrics
   */
  performance(message, data) {
    this.debug(`[PERFORMANCE] ${message}`, data);
  }

  /**
   * Log memory operations
   */
  memory(message, data) {
    this.debug(`[MEMORY] ${message}`, data);
  }

  /**
   * Log water table operations
   */
  waterTable(message, data) {
    this.debug(`[WATER_TABLE] ${message}`, data);
  }
}

// Create and export default logger instance
const logger = new Logger();

// Export both the Logger class and default instance
export { Logger };
export default logger;

// Convenience exports for common geological modeling contexts
export const geologicalLogger = logger.withContext('Geological');
export const scene3dLogger = logger.withContext('3D_Scene');
export const interpolationLogger = logger.withContext('Interpolation');
export const exportLogger = logger.withContext('Export');
export const validationLogger = logger.withContext('Validation');
export const performanceLogger = logger.withContext('Performance');
export const memoryLogger = logger.withContext('Memory');
export const waterTableLogger = logger.withContext('WaterTable');

// Legacy console compatibility (for gradual migration if needed)
export const createLegacyConsole = (context) => {
  const contextLogger = logger.withContext(context);
  return {
    log: (message, ...args) => contextLogger.info(message, args.length === 1 ? args[0] : args),
    info: (message, ...args) => contextLogger.info(message, args.length === 1 ? args[0] : args),
    warn: (message, ...args) => contextLogger.warn(message, args.length === 1 ? args[0] : args),
    error: (message, ...args) => contextLogger.error(message, args.length === 1 ? args[0] : args),
    debug: (message, ...args) => contextLogger.debug(message, args.length === 1 ? args[0] : args)
  };
};