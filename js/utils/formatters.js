/* ============================================
   StockPulse — Utility Functions
   Formatters for numbers, currency, dates
   ============================================ */

/**
 * Format a number as currency (USD)
 * @param {number} value - The number to format
 * @param {boolean} hideDecimalsIfZero - Whether to omit .00
 * @returns {string} Formatted currency string
 */
function formatCurrency(value, hideDecimalsIfZero = false) {
  if (value === undefined || value === null) return '$0.00';
  
  const options = {
    style: 'currency',
    currency: 'USD',
  };
  
  if (hideDecimalsIfZero && value % 1 === 0) {
    options.minimumFractionDigits = 0;
    options.maximumFractionDigits = 0;
  }
  
  return new Intl.NumberFormat('en-US', options).format(value);
}

/**
 * Format a percentage change
 * @param {number} value - The percentage value (e.g., 5.2)
 * @param {boolean} includeSign - Whether to force a + sign for positive numbers
 * @returns {string} Formatted percentage string
 */
function formatPercent(value, includeSign = true) {
  if (value === undefined || value === null) return '0.00%';
  
  const formatted = Math.abs(value).toFixed(2) + '%';
  
  if (value > 0) {
    return includeSign ? `+${formatted}` : formatted;
  } else if (value < 0) {
    return `-${formatted}`;
  }
  return formatted;
}

/**
 * Format a large number with K, M, B suffixes
 * @param {number} value - The number to format
 * @returns {string} Formatted number string
 */
function formatCompactNumber(value) {
  if (value === undefined || value === null) return '0';
  
  return new Intl.NumberFormat('en-US', {
    notation: "compact",
    compactDisplay: "short"
  }).format(value);
}

/**
 * Format a date string into a readable date
 * @param {string} dateString - ISO date string (YYYY-MM-DD)
 * @param {boolean} short - Whether to use short format
 * @returns {string} Formatted date string
 */
function formatDate(dateString, short = false) {
  if (!dateString) return '';
  
  const date = new Date(dateString);
  
  if (short) {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric'
    }).format(date);
  }
  
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(date);
}

/**
 * Format a datetime string into a readable time/date
 * @param {string} timestampString - ISO timestamp
 * @returns {string} Formatted time string (e.g. "Today at 2:30 PM" or "May 19, 2:30 PM")
 */
function formatTimeRelative(timestampString) {
  if (!timestampString) return '';
  
  const date = new Date(timestampString);
  const now = new Date(); // In a real app, this would be current time. For this demo we'll just format it absolutely.
  
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }).format(date);
}

// Export for module usage
if (typeof window !== 'undefined') {
  window.Formatters = { 
    formatCurrency, 
    formatPercent, 
    formatCompactNumber, 
    formatDate,
    formatTimeRelative
  };
}
