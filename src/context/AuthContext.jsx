import { createContext, useContext, useState, useEffect } from 'react';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';
import toast from 'react-hot-toast';
import { getUserRoles, hasRole } from '../utils/helpers';
import { USER_ROLES } from '../utils/constants';

const AuthContext = createContext({});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [userRole, setUserRole] = useState(null); // Deprecated: kept for backward compatibility
  const [userRoles, setUserRoles] = useState([]); // New: array of all user roles
  const [activeRole, setActiveRole] = useState(null); // Currently active role for dashboard
  const [userBranch, setUserBranch] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Clear session data (uses sessionStorage for tab-specific sessions)
  const clearSession = () => {
    // Get current session to clear role-specific storage
    const sessionData = sessionStorage.getItem('userSession');
    if (sessionData) {
      try {
        const session = JSON.parse(sessionData);
        const userId = session.userId;
        // Clear role-specific storage for this user (use sessionStorage for tab-specific)
        if (userId) {
          sessionStorage.removeItem(`activeRole_${userId}`);
        }
      } catch (error) {
        console.error('Error parsing session data during clear:', error);
      }
    }
    
    // Clear main session (sessionStorage is tab-specific, allowing multiple simultaneous sessions)
    sessionStorage.removeItem('userSession');
    setCurrentUser(null);
    setUserRole(null);
    setUserRoles([]);
    setActiveRole(null);
    setUserBranch(null);
    setUserData(null);
  };

  // Fetch user role and additional data from Firestore
  const fetchUserData = async (userId, showToast = true) => {
    try {
      const userDoc = await getDoc(doc(db, 'users', userId));
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        
        // Check if user account is active
        if (!userData.isActive) {
          // Clear session if account is deactivated
          clearSession();
          // Only show toast if explicitly requested (e.g., during login)
          if (showToast) {
            toast.error('Your account has been deactivated. Please contact administrator.');
          }
          throw new Error('ACCOUNT_DEACTIVATED');
        }
        
        // Get roles array (handles both new and legacy format)
        const roles = getUserRoles(userData);
        
        setUserRole(userData.role || roles[0]); // Legacy: first role
        setUserRoles(roles); // New: all roles
        
        // Restore active role from sessionStorage or default to first role
        const savedActiveRole = sessionStorage.getItem(`activeRole_${userId}`);
        const initialActiveRole = (savedActiveRole && roles.includes(savedActiveRole)) 
          ? savedActiveRole 
          : roles[0];
        setActiveRole(initialActiveRole);
        
        setUserBranch(userData.branchId || null);
        // Add uid to userData for compatibility
        const userDataWithUid = { ...userData, uid: userId };
        setUserData(userDataWithUid);
        
        // Create a simple user object for compatibility
        const userObj = {
          uid: userId,
          email: userData.email,
          displayName: `${userData.firstName} ${userData.lastName}`.trim()
        };
        setCurrentUser(userObj);
        
        return userData;
      } else {
        // Clear session if no user document
        clearSession();
        if (showToast) {
          toast.error('User profile not found. Please contact admin.');
        }
        throw new Error('USER_NOT_FOUND');
      }
    } catch (error) {
      // Only log and show toast for unexpected errors (not our custom errors)
      if (error.message !== 'ACCOUNT_DEACTIVATED' && error.message !== 'USER_NOT_FOUND') {
        console.error('Error fetching user data:', error);
        if (showToast) {
          toast.error('Failed to load user data');
        }
      }
      throw error;
    }
  };

  // Sign in function - uses only Firestore and role passwords (no Firebase Auth)
  const login = async (email, password, requiredRole = null) => {
    try {
      // Note: We don't clear session here anymore - sessionStorage is tab-specific
      // This allows multiple simultaneous sessions (e.g., Branch Manager in one tab, System Admin in another)
      
      // Normalize email (trim and lowercase) to match how emails are stored/queried
      const normalizedEmail = email.trim().toLowerCase();
      
      // Find user by email
      const usersQuery = query(collection(db, 'users'), where('email', '==', normalizedEmail));
      const usersSnapshot = await getDocs(usersQuery);
      
      if (usersSnapshot.empty) {
        toast.error('Invalid email or password');
        throw new Error('USER_NOT_FOUND');
      }
      
      const userDoc = usersSnapshot.docs[0];
      const userId = userDoc.id;
      const userData = userDoc.data();
      const roles = getUserRoles(userData);
      
      // If role-specific login, check role
      if (requiredRole) {
        if (!roles.includes(requiredRole)) {
          toast.error(`Access denied. This login page is for ${requiredRole} only.`);
          throw new Error('INVALID_ROLE');
        }
      }
      
      // Check role-specific password from Firestore
      const { verifyRolePassword, getRolePassword, setRolePassword } = await import('../services/rolePasswordService');
      
      // For role-specific login, use that role's password
      // For general login, use first role's password
      const roleToCheck = requiredRole || roles[0];
      let hasRolePassword = await getRolePassword(userId, roleToCheck);
      let passwordValidated = false;
      
      // If no role password exists, try Firebase Auth as fallback (backward compatibility)
      // This handles existing users who registered before role passwords were implemented
      if (!hasRolePassword) {
        // Try Firebase Auth fallback for all roles
        try {
          const { signInWithEmailAndPassword, signOut } = await import('firebase/auth');
          const { auth } = await import('../config/firebase');
          
          // Try to authenticate with Firebase Auth
          const userCredential = await signInWithEmailAndPassword(auth, normalizedEmail, password);
          
          // Authentication successful - set up role password for future logins
          await setRolePassword(userId, roleToCheck, password);
          
          // Sign out from Firebase Auth (we use session-based auth, not Firebase Auth)
          await signOut(auth);
          
          // Password is validated via Firebase Auth, no need to verify role password
          passwordValidated = true;
          toast.success('Password migrated successfully. Future logins will use the new system.');
        } catch (firebaseAuthError) {
          // Firebase Auth failed - invalid password
          toast.error('Invalid email or password');
          throw new Error('INVALID_ROLE_PASSWORD');
        }
      }
      
      // If role password exists and hasn't been validated yet, verify it
      if (hasRolePassword && !passwordValidated) {
        const rolePasswordValid = await verifyRolePassword(userId, roleToCheck, password);
        
        if (!rolePasswordValid) {
          // If role password verification fails, try Firebase Auth as fallback
          // This helps users who might have their password in Firebase Auth but not properly synced
          try {
            const { signInWithEmailAndPassword, signOut } = await import('firebase/auth');
            const { auth } = await import('../config/firebase');
            
            // Try to authenticate with Firebase Auth
            const userCredential = await signInWithEmailAndPassword(auth, normalizedEmail, password);
            
            // Authentication successful - update role password to match
            await setRolePassword(userId, roleToCheck, password);
            
            // Sign out from Firebase Auth
            await signOut(auth);
            
            // Password is validated via Firebase Auth
            passwordValidated = true;
            toast.success('Password synced successfully.');
          } catch (firebaseAuthError) {
            // Both role password and Firebase Auth failed - invalid password
            toast.error('Invalid password');
            throw new Error('INVALID_ROLE_PASSWORD');
          }
        } else {
          passwordValidated = true;
        }
      }
      
      // Password is correct - create session
      const activeRole = requiredRole || roles[0];
      
      // Store session in sessionStorage (tab-specific, allows multiple simultaneous sessions)
      const sessionData = {
        userId,
        email: normalizedEmail,
        activeRole,
        timestamp: Date.now()
      };
      sessionStorage.setItem('userSession', JSON.stringify(sessionData));
      sessionStorage.setItem(`activeRole_${userId}`, activeRole);
      
      // Fetch and set user data
      await fetchUserData(userId, true);
      setActiveRole(activeRole);
      
      // Log login activity
      try {
        const { logActivity } = await import('../services/activityService');
        await logActivity({
          action: 'user_login',
          performedBy: userId,
          targetUser: userId,
          branchId: userData?.branchId || null
        });
      } catch (logError) {
        console.error('Error logging login activity:', logError);
      }
      
      toast.success('Successfully logged in!');
      return { userData, userId };
    } catch (error) {
      // If login failed, ensure session is cleared (in case partial session was created)
      clearSession();
      
      // Don't log or show error for account issues already handled
      if (error.message === 'ACCOUNT_DEACTIVATED' || error.message === 'USER_NOT_FOUND' || error.message === 'INVALID_ROLE' || error.message === 'INVALID_ROLE_PASSWORD' || error.message === 'NO_ROLE_PASSWORD') {
        throw error;
      }
      
      console.error('Login error:', error);
      toast.error('Failed to login. Please try again.');
      throw error;
    }
  };

  // Sign out function
  const logout = async () => {
    try {
      const userId = currentUser?.uid || userData?.uid;
      const branchId = userData?.branchId || userBranch || null;
      
      // Log logout activity before signing out
      if (userId) {
        try {
          const { logActivity } = await import('../services/activityService');
          await logActivity({
            action: 'user_logout',
            performedBy: userId,
            targetUser: userId,
            branchId: branchId
          });
        } catch (logError) {
          console.error('Error logging logout activity:', logError);
        }
      }
      
      clearSession();
      toast.success('Successfully logged out');
    } catch (error) {
      console.error('Logout error:', error);
      toast.error('Failed to logout');
      throw error;
    }
  };

  // Reset password function (placeholder - implement with email service)
  const resetPassword = async (email) => {
    try {
      // TODO: Implement password reset with email service
      toast.error('Password reset not yet implemented. Please contact administrator.');
      throw new Error('NOT_IMPLEMENTED');
    } catch (error) {
      console.error('Password reset error:', error);
      throw error;
    }
  };

  // Update user profile (placeholder - update Firestore instead)
  const updateUserProfile = async (displayName, photoURL) => {
    try {
      // TODO: Update user profile in Firestore
      toast.error('Profile update not yet implemented.');
      throw new Error('NOT_IMPLEMENTED');
    } catch (error) {
      console.error('Profile update error:', error);
      throw error;
    }
  };

  // Check if user has specific role
  const hasRole = (role) => {
    return userRole === role;
  };

  // Check if user has any of the specified roles
  const hasAnyRole = (roles) => {
    return roles.includes(userRole);
  };

  // Check for existing session on mount (uses sessionStorage for tab-specific sessions)
  useEffect(() => {
    const checkSession = async () => {
      try {
        const sessionData = sessionStorage.getItem('userSession');
        
        if (sessionData) {
          const session = JSON.parse(sessionData);
          const { userId, activeRole } = session;
          
          // Check if session is still valid (24 hours)
          const sessionAge = Date.now() - session.timestamp;
          const maxAge = 24 * 60 * 60 * 1000; // 24 hours
          
          if (sessionAge > maxAge) {
            // Session expired
            clearSession();
            setLoading(false);
            return;
          }
          
          // Restore user data
          await fetchUserData(userId, false);
          if (activeRole) {
            setActiveRole(activeRole);
          }
        }
      } catch (error) {
        console.error('Error checking session:', error);
        clearSession();
      } finally {
        setLoading(false);
      }
    };
    
    checkSession();
  }, []);

  // Switch active role (for users with multiple roles)
  const switchRole = (newRole) => {
    if (userRoles.includes(newRole)) {
      setActiveRole(newRole);
      // Store in sessionStorage for tab-specific persistence
      const userId = currentUser?.uid || userData?.uid;
      if (userId) {
        sessionStorage.setItem(`activeRole_${userId}`, newRole);
        // Update session data
        const sessionData = sessionStorage.getItem('userSession');
        if (sessionData) {
          const session = JSON.parse(sessionData);
          session.activeRole = newRole;
          sessionStorage.setItem('userSession', JSON.stringify(session));
        }
      }
      // Note: Toast message is shown by the caller (RoleSwitcher)
      return true;
    }
    toast.error('You do not have access to this role');
    return false;
  };

  const value = {
    currentUser,
    userRole, // Deprecated: for backward compatibility
    userRoles, // New: array of all roles
    activeRole, // New: currently active role
    userBranch,
    userData,
    loading,
    login,
    logout,
    resetPassword,
    updateUserProfile,
    switchRole, // New: function to switch between roles
    hasRole: (role) => hasRole(userData, role), // Helper function
    hasAnyRole: (roles) => roles.some(r => hasRole(userData, r)), // Helper function
  };

  return (
    <AuthContext.Provider value={value}>
      {loading ? (
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          height: '100vh',
          fontSize: '24px'
        }}>
          Loading...
        </div>
      ) : (
        children
      )}
    </AuthContext.Provider>
  );
};
