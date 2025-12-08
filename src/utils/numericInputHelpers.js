/**
 * Numeric Input Helper Utilities
 *
 * Provides utilities for enhanced numeric input controls including:
 * - Whole-unit scroll wheel behavior
 * - Whole-unit keyboard arrow key behavior
 * - Maintains support for manual decimal entry via typing
 */

/**
 * Handles mouse wheel scroll on numeric inputs with whole-unit increments.
 * Scrolling up increments by 1 unit, scrolling down decrements by 1 unit.
 * The resulting value is rounded to the nearest whole number.
 *
 * @param {WheelEvent} event - The wheel event from the input element
 * @param {Function} onChange - Callback function to update the value (receives new value as number)
 * @param {Object} options - Optional configuration
 * @param {number} options.step - Step size for each scroll (default: 1)
 * @param {number} options.min - Minimum allowed value (default: undefined)
 * @param {number} options.max - Maximum allowed value (default: undefined)
 * @param {boolean} options.allowDecimals - If false, forces rounding (default: false for scroll)
 *
 * @example
 * <input
 *   type="number"
 *   value={depth}
 *   onWheel={(e) => handleWholeUnitScroll(e, (newValue) => setDepth(newValue), { min: 0, max: 100 })}
 * />
 */
export const handleWholeUnitScroll = (event, onChange, options = {}) => {
  const {
    step = 1,
    min = undefined,
    max = undefined,
    allowDecimals = false,
    precision = undefined  // Number of decimal places to round to (e.g., 1 for 0.1, 2 for 0.01)
  } = options;

  // Stop event propagation to prevent parent scrolling
  // Note: We can't preventDefault on passive wheel listeners in React,
  // so the page may scroll slightly - this is expected browser behavior
  event.stopPropagation();

  // Get current value from input
  const input = event.target;
  let currentValue = parseFloat(input.value) || 0;

  // Round current value first if we don't allow decimals
  // This ensures clean transitions from decimal values (e.g., 10.1 → 11, not 10.1 → 11.1 → 11)
  if (!allowDecimals) {
    currentValue = Math.round(currentValue);
  } else if (precision !== undefined) {
    // Round to specified precision to avoid floating point errors
    currentValue = parseFloat(currentValue.toFixed(precision));
  }

  // Determine scroll direction (negative deltaY = scroll up)
  const scrollDirection = event.deltaY < 0 ? 1 : -1;

  // Calculate new value with step
  let newValue = currentValue + (scrollDirection * step);

  // Round to precision if specified (prevents 1.01 instead of 1.1)
  if (precision !== undefined) {
    newValue = parseFloat(newValue.toFixed(precision));
  }

  // Apply min/max constraints
  if (min !== undefined) {
    newValue = Math.max(min, newValue);
  }
  if (max !== undefined) {
    newValue = Math.min(max, newValue);
  }

  // Call onChange callback with new value
  onChange(newValue);

  return false;
};

/**
 * Handles keyboard arrow keys on numeric inputs with whole-unit increments.
 * Up arrow increments by 1 unit, down arrow decrements by 1 unit.
 * The resulting value is rounded to the nearest whole number.
 *
 * @param {KeyboardEvent} event - The keyboard event from the input element
 * @param {Function} onChange - Callback function to update the value (receives new value as number)
 * @param {Object} options - Optional configuration
 * @param {number} options.step - Step size for each arrow press (default: 1)
 * @param {number} options.min - Minimum allowed value (default: undefined)
 * @param {number} options.max - Maximum allowed value (default: undefined)
 * @param {boolean} options.allowDecimals - If false, forces rounding (default: false for arrows)
 *
 * @example
 * <input
 *   type="number"
 *   value={depth}
 *   onKeyDown={(e) => handleWholeUnitKeyboard(e, (newValue) => setDepth(newValue), { min: 0, max: 100 })}
 * />
 */
export const handleWholeUnitKeyboard = (event, onChange, options = {}) => {
  const {
    step = 1,
    min = undefined,
    max = undefined,
    allowDecimals = false,
    precision = undefined  // Number of decimal places to round to (e.g., 1 for 0.1, 2 for 0.01)
  } = options;

  // Only handle arrow up and arrow down keys
  if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') {
    return; // Let other keys work normally (typing numbers, decimals, etc.)
  }

  // Prevent default arrow key behavior (which would increment by the step attribute)
  event.preventDefault();
  event.stopPropagation();

  // Get current value from input
  const input = event.target;
  let currentValue = parseFloat(input.value) || 0;

  // Round current value first if we don't allow decimals
  // This ensures clean transitions from decimal values (e.g., 10.1 → 11, not 10.1 → 11.1 → 11)
  if (!allowDecimals) {
    currentValue = Math.round(currentValue);
  } else if (precision !== undefined) {
    // Round to specified precision to avoid floating point errors
    currentValue = parseFloat(currentValue.toFixed(precision));
  }

  // Determine arrow direction
  const direction = event.key === 'ArrowUp' ? 1 : -1;

  // Calculate new value with step
  let newValue = currentValue + (direction * step);

  // Round to precision if specified (prevents 1.01 instead of 1.1)
  if (precision !== undefined) {
    newValue = parseFloat(newValue.toFixed(precision));
  }

  // Apply min/max constraints
  if (min !== undefined) {
    newValue = Math.max(min, newValue);
  }
  if (max !== undefined) {
    newValue = Math.min(max, newValue);
  }

  // Call onChange callback with new value
  onChange(newValue);

  return false;
};

/**
 * Creates a combined handler for both scroll and keyboard events on numeric inputs.
 * This is a convenience function that returns both handlers pre-configured with the same options.
 *
 * @param {Function} onChange - Callback function to update the value (receives new value as number)
 * @param {Object} options - Configuration options (same as individual handlers)
 * @returns {Object} Object with onWheel and onKeyDown handlers
 *
 * @example
 * const handlers = createWholeUnitHandlers((newValue) => setDepth(newValue), { min: 0, max: 100 });
 *
 * <input
 *   type="number"
 *   value={depth}
 *   {...handlers}
 * />
 */
export const createWholeUnitHandlers = (onChange, options = {}) => {
  return {
    onWheel: (event) => handleWholeUnitScroll(event, onChange, options),
    onKeyDown: (event) => handleWholeUnitKeyboard(event, onChange, options)
  };
};

/**
 * Validates and sanitizes numeric input to ensure it's a valid number.
 * Useful for onChange handlers that accept text input.
 *
 * @param {string|number} value - The input value to validate
 * @param {Object} options - Validation options
 * @param {number} options.min - Minimum allowed value (default: undefined)
 * @param {number} options.max - Maximum allowed value (default: undefined)
 * @param {number} options.defaultValue - Default value if invalid (default: 0)
 * @param {number} options.precision - Number of decimal places to keep (default: undefined = no rounding)
 * @returns {number} The validated and sanitized number
 *
 * @example
 * const handleChange = (e) => {
 *   const value = validateNumericInput(e.target.value, { min: 0, max: 100, precision: 1 });
 *   setDepth(value);
 * };
 */
export const validateNumericInput = (value, options = {}) => {
  const {
    min = undefined,
    max = undefined,
    defaultValue = 0,
    precision = undefined
  } = options;

  // Parse the value
  let numValue = parseFloat(value);

  // If invalid, return default
  if (isNaN(numValue)) {
    return defaultValue;
  }

  // Apply precision rounding if specified
  if (precision !== undefined) {
    numValue = parseFloat(numValue.toFixed(precision));
  }

  // Apply min/max constraints
  if (min !== undefined) {
    numValue = Math.max(min, numValue);
  }
  if (max !== undefined) {
    numValue = Math.min(max, numValue);
  }

  return numValue;
};
