import { format, parseISO, isValid } from 'date-fns';

/**
 * Format a date object or ISO string to a readable format
 * @param {Date|string} date - Date to format
 * @param {string} formatStr - Format string (default: 'MMM dd, yyyy')
 * @returns {string} Formatted date string
 */
export const formatDate = (date, formatStr = 'MMM dd, yyyy') => {
  if (!date) return 'N/A';
  
  try {
    // Handle Firestore Timestamp
    let dateObj;
    if (date && typeof date === 'object' && 'toDate' in date) {
      dateObj = date.toDate(); // Firestore Timestamp
    } else if (typeof date === 'string') {
      // Try parsing as ISO first
      dateObj = parseISO(date);
      
      // If invalid, try parsing as standard date string (RFC format from Firebase Auth)
      if (!isValid(dateObj)) {
        dateObj = new Date(date);
      }
    } else if (date instanceof Date) {
      dateObj = date;
    } else {
      return 'Invalid date';
    }
    
    if (!isValid(dateObj)) return 'Invalid date';
    return format(dateObj, formatStr);
  } catch (error) {
    console.error('Date formatting error:', error);
    return 'Invalid date';
  }
};

/**
 * Format a date object or ISO string to time format
 * @param {Date|string} date - Date to format
 * @returns {string} Formatted time string
 */
export const formatTime = (date) => {
  return formatDate(date, 'hh:mm a');
};

/**
 * Format a date object or ISO string to datetime format
 * @param {Date|string} date - Date to format
 * @returns {string} Formatted datetime string
 */
export const formatDateTime = (date) => {
  return formatDate(date, 'MMM dd, yyyy hh:mm a');
};

/**
 * Capitalize the first letter of a string
 * @param {string} str - String to capitalize
 * @returns {string} Capitalized string
 */
export const capitalize = (str) => {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
};

/**
 * Convert snake_case to Title Case
 * @param {string} str - String in snake_case
 * @returns {string} String in Title Case
 */
export const snakeToTitleCase = (str) => {
  if (!str) return '';
  return str
    .split('_')
    .map(word => capitalize(word))
    .join(' ');
};

/**
 * Format currency value
 * @param {number} amount - Amount to format
 * @param {string} currency - Currency code (default: 'PHP')
 * @returns {string} Formatted currency string
 */
export const formatCurrency = (amount, currency = 'PHP') => {
  if (typeof amount !== 'number') return 'N/A';
  
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: currency,
  }).format(amount);
};

/**
 * Truncate text to a specified length
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string} Truncated text
 */
export const truncateText = (text, maxLength = 50) => {
  if (!text || text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};

/**
 * Get full name from name parts
 * @param {Object} user - User object with firstName, middleName, lastName
 * @returns {string} Formatted full name (e.g., "John M. Doe")
 */
export const getFullName = (user) => {
  if (!user) return 'Unknown User';
  
  // Handle legacy displayName field
  if (user.displayName && !user.firstName) {
    return user.displayName;
  }
  
  const { firstName, middleName, lastName } = user;
  
  if (!firstName && !lastName) return 'Unknown User';
  
  let fullName = firstName || '';
  
  // Add middle initial if middle name exists
  if (middleName) {
    fullName += ` ${middleName.charAt(0).toUpperCase()}.`;
  }
  
  if (lastName) {
    fullName += ` ${lastName}`;
  }
  
  return fullName.trim();
};

/**
 * Generate initials from name parts or full name
 * @param {Object|string} nameOrUser - User object or full name string
 * @returns {string} Initials (e.g., "JD" for "John Doe")
 */
export const getInitials = (nameOrUser) => {
  if (!nameOrUser) return '?';
  
  // If it's an object with firstName/lastName
  if (typeof nameOrUser === 'object') {
    const { firstName, lastName, displayName } = nameOrUser;
    
    if (firstName && lastName) {
      return (firstName.charAt(0) + lastName.charAt(0)).toUpperCase();
    }
    
    if (firstName) {
      return firstName.charAt(0).toUpperCase();
    }
    
    // Fallback to displayName if exists
    if (displayName) {
      nameOrUser = displayName;
    } else {
      return '?';
    }
  }
  
  // Handle string name
  const parts = nameOrUser.trim().split(/\s+/);
  
  if (parts.length === 1) {
    return parts[0].charAt(0).toUpperCase();
  }
  
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
};

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {boolean} True if valid
 */
export const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validate phone number format (Philippine format)
 * @param {string} phone - Phone number to validate
 * @returns {boolean} True if valid
 */
export const isValidPhone = (phone) => {
  const phoneRegex = /^(\+63|0)?9\d{9}$/;
  return phoneRegex.test(phone.replace(/\s|-/g, ''));
};

/**
 * Generate a random color for avatars
 * @param {string} str - String to generate color from
 * @returns {string} Hex color code
 */
export const stringToColor = (str) => {
  if (!str) return '#6b21a8';
  
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  const color = Math.floor(Math.abs((Math.sin(hash) * 16777215) % 1) * 16777215);
  return '#' + color.toString(16).padStart(6, '0');
};

/**
 * Check if user has a specific role
 * @param {Object|Array} userOrRoles - User object with roles array or roles array directly
 * @param {string} roleToCheck - Role to check for
 * @returns {boolean} True if user has the role
 */
export const hasRole = (userOrRoles, roleToCheck) => {
  if (!userOrRoles) return false;
  
  // If it's a user object, get the roles array
  const roles = Array.isArray(userOrRoles) ? userOrRoles : userOrRoles.roles;
  
  // Handle legacy single role field
  if (!roles && userOrRoles.role) {
    return userOrRoles.role === roleToCheck;
  }
  
  return Array.isArray(roles) && roles.includes(roleToCheck);
};

/**
 * Check if user has any of the specified roles
 * @param {Object|Array} userOrRoles - User object with roles array or roles array directly
 * @param {Array<string>} rolesToCheck - Array of roles to check
 * @returns {boolean} True if user has at least one of the roles
 */
export const hasAnyRole = (userOrRoles, rolesToCheck) => {
  if (!userOrRoles || !Array.isArray(rolesToCheck)) return false;
  
  return rolesToCheck.some(role => hasRole(userOrRoles, role));
};

/**
 * Check if user has all of the specified roles
 * @param {Object|Array} userOrRoles - User object with roles array or roles array directly
 * @param {Array<string>} rolesToCheck - Array of roles to check
 * @returns {boolean} True if user has all the roles
 */
export const hasAllRoles = (userOrRoles, rolesToCheck) => {
  if (!userOrRoles || !Array.isArray(rolesToCheck)) return false;
  
  return rolesToCheck.every(role => hasRole(userOrRoles, role));
};

/**
 * Get user's roles as array (handles legacy single role)
 * @param {Object} user - User object
 * @returns {Array<string>} Array of role strings
 */
export const getUserRoles = (user) => {
  if (!user) return [];
  
  // New format: roles array
  if (Array.isArray(user.roles)) {
    return user.roles;
  }
  
  // Legacy format: single role string
  if (user.role) {
    return [user.role];
  }
  
  return [];
};

/**
 * Check if a role can have multiple roles (all except client)
 * @param {string} role - Role to check
 * @returns {boolean} True if role can have multiple roles
 */
export const canHaveMultipleRoles = (role) => {
  return role !== 'client';
};

/**
 * Convert 24-hour time to 12-hour format with AM/PM
 * @param {string} time - Time in 24-hour format (e.g., "14:30")
 * @returns {string} Time in 12-hour format (e.g., "2:30 PM")
 */
/**
 * Generate default password based on role
 * Format: [Role]123[specialChar] (e.g., Stylist123!, Branchmanager123@)
 * @param {string} role - User role (e.g., 'stylist', 'branch_manager')
 * @returns {string} Generated default password with capitalized first letter
 */
export const generateDefaultPassword = (role) => {
  if (!role) {
    role = 'user';
  }
  
  // Convert role to lowercase and remove underscores/spaces
  let roleName = role.toLowerCase().replace(/[_\s]/g, '');
  
  // Capitalize first letter
  roleName = roleName.charAt(0).toUpperCase() + roleName.slice(1);
  
  // Special characters pool
  const specialChars = '!@#$%^&*()_+-=[]{}|;:,.<>?';
  
  // Generate random special character
  const randomSpecialChar = specialChars.charAt(
    Math.floor(Math.random() * specialChars.length)
  );
  
  // Combine: Role + "123" + specialChar (e.g., "Stylist123!", "Branchmanager123@")
  return `${roleName}123${randomSpecialChar}`;
};

/**
 * Generate default password for user (uses primary role)
 * @param {Object} user - User object with roles
 * @returns {string} Generated default password
 */
export const generateDefaultPasswordForUser = (user) => {
  const userRoles = getUserRoles(user);
  const primaryRole = userRoles[0] || 'user';
  return generateDefaultPassword(primaryRole);
};

export const formatTime12Hour = (time) => {
  if (!time) return '';
  
  const [hours, minutes] = time.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const hours12 = hours % 12 || 12; // Convert 0 to 12 for midnight
  
  return `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`;
};

/**
 * Get relative time indicator (e.g., "just now", "1 min ago", "1 hr ago")
 * @param {Date|string|Timestamp} date - Date to compare
 * @returns {string} Relative time string
 */
export const getTimeAgo = (date) => {
  if (!date) return '';
  
  try {
    let dateObj;
    // Handle Firestore Timestamp
    if (date && typeof date === 'object' && 'toDate' in date) {
      dateObj = date.toDate();
    } else if (typeof date === 'string') {
      dateObj = parseISO(date);
      if (!isValid(dateObj)) {
        dateObj = new Date(date);
      }
    } else if (date instanceof Date) {
      dateObj = date;
    } else {
      return '';
    }
    
    if (!isValid(dateObj)) return '';
    
    const now = new Date();
    const diffMs = now - dateObj;
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffSeconds < 60) {
      return 'just now';
    } else if (diffMinutes < 60) {
      return `${diffMinutes} ${diffMinutes === 1 ? 'min' : 'mins'} ago`;
    } else if (diffHours < 24) {
      return `${diffHours} ${diffHours === 1 ? 'hr' : 'hrs'} ago`;
    } else if (diffDays < 7) {
      return `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`;
    } else {
      return formatDate(dateObj, 'MMM dd, yyyy');
    }
  } catch (error) {
    console.error('Error calculating time ago:', error);
    return '';
  }
};