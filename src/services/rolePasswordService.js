/**
 * Role Password Service - Handles role-specific password hashing and verification
 * Allows one account to have different passwords per role
 */

import bcrypt from 'bcryptjs';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

/**
 * Hash a password for secure storage
 * @param {string} password - Plain text password
 * @returns {Promise<string>} Hashed password
 */
export const hashPassword = async (password) => {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
};

/**
 * Verify a password against a hash
 * @param {string} password - Plain text password to verify
 * @param {string} hashedPassword - Stored hash to compare against
 * @returns {Promise<boolean>} True if password matches
 */
export const verifyPassword = async (password, hashedPassword) => {
  if (!hashedPassword) return false;
  return bcrypt.compare(password, hashedPassword);
};

/**
 * Get role-specific password hash from Firestore
 * @param {string} userId - User ID
 * @param {string} role - Role to get password for
 * @returns {Promise<string|null>} Hashed password or null if not set
 */
export const getRolePassword = async (userId, role) => {
  try {
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (!userDoc.exists()) return null;
    
    const userData = userDoc.data();
    const rolePasswords = userData.rolePasswords || {};
    return rolePasswords[role] || null;
  } catch (error) {
    console.error('Error getting role password:', error);
    return null;
  }
};

/**
 * Set or update a role-specific password
 * @param {string} userId - User ID
 * @param {string} role - Role to set password for
 * @param {string} password - Plain text password (will be hashed)
 * @returns {Promise<void>}
 */
export const setRolePassword = async (userId, role, password) => {
  try {
    const hashedPassword = await hashPassword(password);
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      throw new Error('User not found');
    }
    
    const userData = userDoc.data();
    const rolePasswords = userData.rolePasswords || {};
    rolePasswords[role] = hashedPassword;
    
    await updateDoc(userRef, {
      rolePasswords,
      updatedAt: new Date()
    });
  } catch (error) {
    console.error('Error setting role password:', error);
    throw error;
  }
};

/**
 * Verify role-specific password
 * @param {string} userId - User ID
 * @param {string} role - Role to verify password for
 * @param {string} password - Plain text password to verify
 * @returns {Promise<boolean>} True if password is correct
 */
export const verifyRolePassword = async (userId, role, password) => {
  try {
    const hashedPassword = await getRolePassword(userId, role);
    
    if (!hashedPassword) {
      // If no role password is set, fall back to Firebase Auth password
      // This allows backward compatibility
      return null; // Return null to indicate no role password set
    }
    
    return verifyPassword(password, hashedPassword);
  } catch (error) {
    console.error('Error verifying role password:', error);
    return false;
  }
};

/**
 * Initialize role passwords for a user (set all role passwords to the same value)
 * @param {string} userId - User ID
 * @param {Array<string>} roles - Array of roles
 * @param {string} password - Plain text password to set for all roles
 * @returns {Promise<void>}
 */
export const initializeRolePasswords = async (userId, roles, password) => {
  try {
    const hashedPassword = await hashPassword(password);
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      throw new Error('User not found');
    }
    
    const rolePasswords = {};
    roles.forEach(role => {
      rolePasswords[role] = hashedPassword;
    });
    
    await updateDoc(userRef, {
      rolePasswords,
      updatedAt: new Date()
    });
  } catch (error) {
    console.error('Error initializing role passwords:', error);
    throw error;
  }
};





