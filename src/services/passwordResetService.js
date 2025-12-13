/**
 * Password Reset Service
 * Handles password reset tokens and role password updates (not Firebase Auth)
 * Stores reset tokens in Firestore and updates rolePasswords field
 */

import { 
  collection, 
  doc, 
  getDoc, 
  setDoc, 
  deleteDoc, 
  query, 
  where, 
  getDocs,
  Timestamp 
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { hashPassword } from './rolePasswordService';
import { sendEmail } from './emailService';
import { logActivity } from './activityService';
import toast from 'react-hot-toast';

const RESET_TOKENS_COLLECTION = 'password_reset_tokens';
const TOKEN_EXPIRY_HOURS = 1; // Token expires in 1 hour

/**
 * Generate a secure random token
 * @returns {string} Random token string
 */
const generateToken = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 64; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
};

/**
 * Create a password reset token for a user
 * @param {string} email - User email
 * @returns {Promise<{success: boolean, token?: string, error?: string}>}
 */
export const createPasswordResetToken = async (email) => {
  try {
    // Normalize email (trim and lowercase) for consistency
    const normalizedEmail = email.trim().toLowerCase();
    
    // Find user by email
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('email', '==', normalizedEmail));
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      return {
        success: false,
        error: 'No account found with this email address'
      };
    }
    
    const userDoc = snapshot.docs[0];
    const userData = userDoc.data();
    const userId = userDoc.id;
    
    // Check if user is active
    if (userData.isActive === false) {
      return {
        success: false,
        error: 'Account is deactivated. Please contact administrator.'
      };
    }
    
    // Generate token
    const token = generateToken();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + TOKEN_EXPIRY_HOURS);
    
    // Store token in Firestore
    const tokenRef = doc(db, RESET_TOKENS_COLLECTION, token);
    await setDoc(tokenRef, {
      userId,
      email: normalizedEmail,
      createdAt: Timestamp.now(),
      expiresAt: Timestamp.fromDate(expiresAt),
      used: false
    });
    
    // Get base URL for reset link
    const baseUrl = window.location.origin;
    const resetLink = `${baseUrl}/reset-password?token=${token}`;
    
    // Send email with reset link (use normalized email for consistency)
    const emailResult = await sendPasswordResetEmail(normalizedEmail, userData.firstName || userData.displayName || 'User', resetLink);
    
    if (!emailResult.success) {
      // Delete token if email failed
      await deleteDoc(tokenRef);
      return {
        success: false,
        error: emailResult.error || 'Failed to send reset email'
      };
    }
    
    // Log activity
    try {
      await logActivity({
        action: 'password_reset_requested',
        performedBy: userId,
        targetUser: userId,
        metadata: {
          email: normalizedEmail,
          method: 'email'
        }
      });
    } catch (logError) {
      console.error('Error logging password reset activity:', logError);
    }
    
    return {
      success: true,
      token // Return token for testing purposes (not sent to user)
    };
  } catch (error) {
    console.error('Error creating password reset token:', error);
    return {
      success: false,
      error: error.message || 'Failed to create reset token'
    };
  }
};

/**
 * Verify and get reset token data
 * @param {string} token - Reset token
 * @returns {Promise<{valid: boolean, userId?: string, email?: string, error?: string}>}
 */
export const verifyResetToken = async (token) => {
  try {
    if (!token) {
      return {
        valid: false,
        error: 'Reset token is required'
      };
    }
    
    const tokenRef = doc(db, RESET_TOKENS_COLLECTION, token);
    const tokenDoc = await getDoc(tokenRef);
    
    if (!tokenDoc.exists()) {
      return {
        valid: false,
        error: 'Invalid or expired reset token'
      };
    }
    
    const tokenData = tokenDoc.data();
    
    // Check if token is already used
    if (tokenData.used === true) {
      return {
        valid: false,
        error: 'This reset link has already been used'
      };
    }
    
    // Check if token is expired
    const expiresAt = tokenData.expiresAt?.toDate();
    if (!expiresAt || expiresAt < new Date()) {
      // Delete expired token
      await deleteDoc(tokenRef);
      return {
        valid: false,
        error: 'Reset link has expired. Please request a new one.'
      };
    }
    
    // Verify user still exists and is active
    const userRef = doc(db, 'users', tokenData.userId);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      await deleteDoc(tokenRef);
      return {
        valid: false,
        error: 'User account not found'
      };
    }
    
    const userData = userDoc.data();
    if (userData.isActive === false) {
      return {
        valid: false,
        error: 'Account is deactivated. Please contact administrator.'
      };
    }
    
    return {
      valid: true,
      userId: tokenData.userId,
      email: tokenData.email
    };
  } catch (error) {
    console.error('Error verifying reset token:', error);
    return {
      valid: false,
      error: error.message || 'Failed to verify reset token'
    };
  }
};

/**
 * Reset password using token (updates rolePasswords for all user roles)
 * @param {string} token - Reset token
 * @param {string} newPassword - New password (plain text)
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const resetPasswordWithToken = async (token, newPassword) => {
  try {
    // Validate password
    if (!newPassword || newPassword.length < 8) {
      return {
        success: false,
        error: 'Password must be at least 8 characters long'
      };
    }
    
    if (!/\d/.test(newPassword)) {
      return {
        success: false,
        error: 'Password must contain at least one number'
      };
    }
    
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(newPassword)) {
      return {
        success: false,
        error: 'Password must contain at least one special character'
      };
    }
    
    // Verify token
    const tokenVerification = await verifyResetToken(token);
    if (!tokenVerification.valid) {
      return {
        success: false,
        error: tokenVerification.error || 'Invalid reset token'
      };
    }
    
    const { userId } = tokenVerification;
    
    // Get user data to get all roles
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      return {
        success: false,
        error: 'User not found'
      };
    }
    
    const userData = userDoc.data();
    const userRoles = userData.roles || (userData.role ? [userData.role] : []);
    
    if (userRoles.length === 0) {
      return {
        success: false,
        error: 'User has no roles assigned'
      };
    }
    
    // Update all role passwords with the new password
    // Hash separately for each role to ensure unique hashes (better security)
    const rolePasswords = userData.rolePasswords || {};
    
    // Hash password separately for each role (ensures unique hashes)
    for (const role of userRoles) {
      rolePasswords[role] = await hashPassword(newPassword);
    }
    
    await updateDoc(userRef, {
      rolePasswords,
      updatedAt: Timestamp.now(),
      updatedBy: userId
    });
    
    // Mark token as used
    const tokenRef = doc(db, RESET_TOKENS_COLLECTION, token);
    await setDoc(tokenRef, {
      used: true,
      usedAt: Timestamp.now()
    }, { merge: true });
    
    // Delete token after use (cleanup)
    await deleteDoc(tokenRef);
    
    // Log activity
    try {
      await logActivity({
        action: 'password_reset_completed',
        performedBy: userId,
        targetUser: userId,
        metadata: {
          method: 'email_token',
          rolesUpdated: userRoles
        }
      });
    } catch (logError) {
      console.error('Error logging password reset activity:', logError);
    }
    
    return {
      success: true
    };
  } catch (error) {
    console.error('Error resetting password:', error);
    return {
      success: false,
      error: error.message || 'Failed to reset password'
    };
  }
};

/**
 * Send password reset email with reset link
 * @param {string} email - User email
 * @param {string} displayName - User display name
 * @param {string} resetLink - Password reset link
 * @returns {Promise<{success: boolean, error?: string}>}
 */
const sendPasswordResetEmail = async (email, displayName, resetLink) => {
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #160B53; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { padding: 30px; background-color: #f9fafb; border-radius: 0 0 8px 8px; }
        .button { display: inline-block; padding: 12px 30px; background-color: #160B53; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        .button:hover { background-color: #12094A; }
        .info { background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 0.9em; }
        .link { word-break: break-all; color: #160B53; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Reset Your Password</h1>
        </div>
        <div class="content">
          <p>Dear ${displayName || 'User'},</p>
          
          <p>We received a request to reset your password for your David's Salon Management System account.</p>
          
          <p>Click the button below to reset your password:</p>
          
          <div style="text-align: center;">
            <a href="${resetLink}" class="button">Reset Password</a>
          </div>
          
          <p>Or copy and paste this link into your browser:</p>
          <p class="link">${resetLink}</p>
          
          <div class="info">
            <p><strong>Important:</strong></p>
            <ul>
              <li>This link will expire in ${TOKEN_EXPIRY_HOURS} hour(s)</li>
              <li>This link can only be used once</li>
              <li>If you did not request this password reset, please ignore this email</li>
            </ul>
          </div>
          
          <p>For security reasons, if you did not request this password reset, please contact our support team immediately.</p>
          
          <p>Best regards,<br>
          <strong>The David's Salon Team</strong></p>
        </div>
        <div class="footer">
          <p>This is an automated email. Please do not reply directly to this message.</p>
          <p>&copy; ${new Date().getFullYear()} David's Salon. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const textContent = `
    Reset Your Password - David's Salon Management System
    
    Dear ${displayName || 'User'},
    
    We received a request to reset your password for your David's Salon Management System account.
    
    Click the link below to reset your password:
    ${resetLink}
    
    Important:
    - This link will expire in ${TOKEN_EXPIRY_HOURS} hour(s)
    - This link can only be used once
    - If you did not request this password reset, please ignore this email
    
    For security reasons, if you did not request this password reset, please contact our support team immediately.
    
    Best regards,
    The David's Salon Team
    
    ---
    This is an automated email. Please do not reply directly to this message.
    © ${new Date().getFullYear()} David's Salon. All rights reserved.
  `;

  return await sendEmail({
    to: email,
    subject: 'Reset Your Password - David\'s Salon',
    text: textContent,
    html: htmlContent
  });
};

/**
 * Clean up expired tokens (can be called periodically)
 * @returns {Promise<number>} Number of tokens deleted
 */
export const cleanupExpiredTokens = async () => {
  try {
    const tokensRef = collection(db, RESET_TOKENS_COLLECTION);
    const snapshot = await getDocs(tokensRef);
    const now = new Date();
    let deletedCount = 0;
    
    const deletePromises = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      const expiresAt = data.expiresAt?.toDate();
      
      if (expiresAt && expiresAt < now) {
        deletePromises.push(deleteDoc(doc.ref));
        deletedCount++;
      }
    });
    
    await Promise.all(deletePromises);
    return deletedCount;
  } catch (error) {
    console.error('Error cleaning up expired tokens:', error);
    return 0;
  }
};

