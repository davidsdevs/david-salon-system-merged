# 🚀 Quick Fixes Guide
**Immediate improvements you can make today**

---

## 1. Create Logging Utility (30 minutes)

**File:** `src/utils/logger.js`

```javascript
/**
 * Centralized logging utility
 * Prevents console statements in production
 */

const isDevelopment = import.meta.env.DEV;

export const logger = {
  /**
   * Log debug information (development only)
   */
  log: (...args) => {
    if (isDevelopment) {
      console.log('[LOG]', ...args);
    }
  },

  /**
   * Log warnings (development only)
   */
  warn: (...args) => {
    if (isDevelopment) {
      console.warn('[WARN]', ...args);
    }
  },

  /**
   * Log errors (always logged, even in production)
   */
  error: (...args) => {
    console.error('[ERROR]', ...args);
    // TODO: Send to error tracking service (Sentry, etc.)
  },

  /**
   * Log debug information (development only)
   */
  debug: (...args) => {
    if (isDevelopment) {
      console.debug('[DEBUG]', ...args);
    }
  },

  /**
   * Log info messages (development only)
   */
  info: (...args) => {
    if (isDevelopment) {
      console.info('[INFO]', ...args);
    }
  }
};

export default logger;
```

**Usage:**
```javascript
// Replace this:
console.log('Fetched holidays:', holidays);

// With this:
import logger from '../../utils/logger';
logger.log('Fetched holidays:', holidays);
```

---

## 2. Add Error Boundary (1 hour)

**File:** `src/components/ErrorBoundary.jsx`

```javascript
import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import logger from '../utils/logger';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null,
      errorInfo: null 
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    logger.error('Error caught by boundary:', error, errorInfo);
    this.setState({ errorInfo });
    
    // TODO: Send to error tracking service
    // errorTrackingService.captureException(error, { extra: errorInfo });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
          <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6 text-center">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Something went wrong
            </h2>
            <p className="text-gray-600 mb-6">
              We're sorry, but something unexpected happened. Please try refreshing the page.
            </p>
            
            {this.state.error && (
              <details className="mb-4 text-left">
                <summary className="cursor-pointer text-sm text-gray-500 mb-2">
                  Error Details
                </summary>
                <pre className="text-xs bg-gray-100 p-3 rounded overflow-auto max-h-40">
                  {this.state.error.toString()}
                </pre>
              </details>
            )}
            
            <div className="flex gap-3 justify-center">
              <button
                onClick={this.handleReset}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Try Again
              </button>
              <button
                onClick={this.handleReload}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh Page
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
```

**Usage in `src/App.jsx`:**
```javascript
import ErrorBoundary from './components/ErrorBoundary';

function App() {
  return (
    <ErrorBoundary>
      <Router>
        {/* Your routes */}
      </Router>
    </ErrorBoundary>
  );
}
```

---

## 3. Fix CalendarManagement.jsx Console Statements (15 minutes)

**Quick find and replace:**

1. Add import at top:
```javascript
import logger from '../../utils/logger';
```

2. Replace all console statements:
- `console.log` → `logger.log`
- `console.warn` → `logger.warn`
- `console.error` → `logger.error` (keep these, but use logger)
- `console.debug` → `logger.debug`

**Specific lines in CalendarManagement.jsx:**
- Line 240: `console.log(\`Fetched ${holidays.length} holidays...\`)`
- Line 264: `console.log('Schedule configs fetched:', ...)`
- Line 332: `console.log('All branch users found:', ...)`
- Line 369: `console.log('Staff cache created with IDs:', ...)`
- Line 455: `console.log(\`Processing leave for employeeId:...\`)`
- Line 490: `console.log('Leaves map created:', ...)`
- Line 628: `console.log(\`Date: ${targetDateObj}...\`)`
- Line 680-688: Multiple console.warn and console.log statements
- Line 712: `console.log(\`No applicable config for...\`)`

---

## 4. Add ESLint Rule to Prevent Console Statements (5 minutes)

**File:** `.eslintrc.js` (or create if doesn't exist)

```javascript
module.exports = {
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended'
  ],
  rules: {
    'no-console': ['warn', { 
      allow: ['warn', 'error'] // Only allow console.warn and console.error
    }],
    'no-debugger': 'error',
  },
  settings: {
    react: {
      version: 'detect'
    }
  }
};
```

---

## 5. Create Centralized Error Handler (30 minutes)

**File:** `src/utils/errorHandler.js`

```javascript
import toast from 'react-hot-toast';
import logger from './logger';

/**
 * Firebase error code mappings to user-friendly messages
 */
const ERROR_MESSAGES = {
  // Authentication errors
  'auth/user-not-found': 'No account found with this email address.',
  'auth/wrong-password': 'Incorrect password. Please try again.',
  'auth/email-already-in-use': 'An account with this email already exists.',
  'auth/weak-password': 'Password should be at least 6 characters.',
  'auth/invalid-email': 'Invalid email address format.',
  'auth/too-many-requests': 'Too many failed attempts. Please try again later.',
  'auth/user-disabled': 'This account has been disabled.',
  'auth/network-request-failed': 'Network error. Please check your connection.',
  
  // Firestore errors
  'permission-denied': 'You do not have permission to perform this action.',
  'unavailable': 'Service temporarily unavailable. Please try again.',
  'deadline-exceeded': 'Request timed out. Please try again.',
  'failed-precondition': 'Operation cannot be completed. Please check your data.',
  'not-found': 'The requested resource was not found.',
  'already-exists': 'This item already exists.',
  'invalid-argument': 'Invalid data provided. Please check your input.',
  
  // Generic
  'network-error': 'Network error. Please check your internet connection.',
  'unknown-error': 'An unexpected error occurred. Please try again.',
};

/**
 * Handles errors consistently across the application
 * @param {Error} error - The error object
 * @param {string} context - Context where error occurred (e.g., 'fetchCalendar')
 * @param {Object} options - Additional options
 * @param {boolean} options.showToast - Whether to show toast notification (default: true)
 * @param {string} options.customMessage - Custom error message to show
 * @returns {string} User-friendly error message
 */
export const handleError = (error, context = '', options = {}) => {
  const { showToast = true, customMessage } = options;
  
  // Extract error code and message
  const errorCode = error?.code || error?.error?.code || 'unknown-error';
  const errorMessage = error?.message || error?.error?.message || 'An unexpected error occurred';
  
  // Get user-friendly message
  let userMessage = customMessage || ERROR_MESSAGES[errorCode] || errorMessage;
  
  // Log error for debugging
  logger.error(`Error in ${context}:`, {
    code: errorCode,
    message: errorMessage,
    error: error,
    context
  });
  
  // Show toast notification
  if (showToast) {
    toast.error(userMessage);
  }
  
  // TODO: Send to error tracking service in production
  // if (import.meta.env.PROD) {
  //   errorTrackingService.captureException(error, { extra: { context } });
  // }
  
  return userMessage;
};

/**
 * Wraps async functions with error handling
 * @param {Function} fn - Async function to wrap
 * @param {string} context - Context name for error logging
 * @returns {Function} Wrapped function
 */
export const withErrorHandling = (fn, context) => {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (error) {
      handleError(error, context);
      throw error; // Re-throw for caller to handle if needed
    }
  };
};

export default handleError;
```

**Usage:**
```javascript
import handleError from '../../utils/errorHandler';

// In CalendarManagement.jsx
const fetchCalendar = async () => {
  try {
    setLoading(true);
    // ... fetch logic
  } catch (error) {
    handleError(error, 'fetchCalendar');
  } finally {
    setLoading(false);
  }
};
```

---

## 6. Quick CalendarManagement.jsx Improvements

### Extract Helper Functions

**Create:** `src/utils/calendarHelpers.js`

```javascript
/**
 * Calendar helper functions
 */

/**
 * Formats date as YYYY-MM-DD
 */
export const formatDateKey = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().split('T')[0];
};

/**
 * Checks if a holiday is "All Saints' Day"
 */
export const isAllSaintsDay = (holiday) => {
  if (!holiday) return false;
  const holidayName = (holiday.name || '').toLowerCase();
  const holidayLocalName = (holiday.localName || '').toLowerCase();
  const combined = `${holidayName} ${holidayLocalName}`.toLowerCase();
  
  const allSaintsPatterns = [
    'all saints',
    'araw ng mga san',
    'araw ng mga santo',
    'araw ng mga santos',
    'undas',
    'all souls',
    'araw ng mga kaluluwa'
  ];
  
  return allSaintsPatterns.some(pattern => 
    holidayName.includes(pattern) || 
    holidayLocalName.includes(pattern) ||
    combined.includes(pattern)
  );
};

/**
 * Categorizes Philippine holidays
 */
export const categorizePhilippineHoliday = (holiday) => {
  // ... move the categorization logic here
};
```

Then import in CalendarManagement.jsx:
```javascript
import { formatDateKey, isAllSaintsDay, categorizePhilippineHoliday } from '../../utils/calendarHelpers';
```

---

## 7. Add Loading Skeleton Component (20 minutes)

**File:** `src/components/ui/LoadingSkeleton.jsx`

```javascript
const LoadingSkeleton = ({ lines = 3, className = '' }) => {
  return (
    <div className={`animate-pulse space-y-3 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="h-4 bg-gray-200 rounded w-full" />
      ))}
    </div>
  );
};

export default LoadingSkeleton;
```

---

## Summary

**Total Time:** ~3-4 hours  
**Impact:** High  
**Files to Create:** 4  
**Files to Modify:** 1 (CalendarManagement.jsx)

**Priority Order:**
1. ✅ Create logger utility (30 min)
2. ✅ Add Error Boundary (1 hour)
3. ✅ Replace console statements (15 min)
4. ✅ Create error handler (30 min)
5. ✅ Extract calendar helpers (30 min)
6. ✅ Add ESLint rule (5 min)

These quick fixes will immediately improve:
- ✅ Code quality
- ✅ Error handling
- ✅ Production readiness
- ✅ Maintainability













