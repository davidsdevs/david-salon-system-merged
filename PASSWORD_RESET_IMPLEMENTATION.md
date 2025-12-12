# Password Reset Implementation
**Custom Password Reset System for Role Passwords**

## Overview

This implementation provides a password reset system that updates `rolePasswords` in Firestore (not Firebase Auth). When users reset their password, all their role passwords are updated with the new password.

---

## How It Works

### 1. **User Requests Password Reset**
- User enters email on `/forgot-password` page
- System generates a secure 64-character token
- Token is stored in Firestore `password_reset_tokens` collection
- Email is sent with reset link containing the token

### 2. **User Clicks Reset Link**
- User clicks link: `/reset-password?token=XXXXX`
- System validates token (checks expiration, usage, user status)
- If valid, shows password reset form

### 3. **User Sets New Password**
- User enters new password (with validation)
- System validates password meets requirements:
  - Minimum 8 characters
  - At least one number
  - At least one special character
- Password is hashed separately for each role (using bcrypt)
- All `rolePasswords` in Firestore are updated
- Token is marked as used and deleted
- User is redirected to login

---

## Files Created/Modified

### New Files:
1. **`src/services/passwordResetService.js`**
   - `createPasswordResetToken()` - Creates token and sends email
   - `verifyResetToken()` - Validates token
   - `resetPasswordWithToken()` - Updates rolePasswords
   - `cleanupExpiredTokens()` - Cleanup utility

2. **`src/pages/public/ResetPassword.jsx`**
   - Password reset page with token validation
   - Password strength validation
   - Success/error states

### Modified Files:
1. **`src/pages/public/ForgotPassword.jsx`**
   - Now uses `createPasswordResetToken()` instead of Firebase Auth
   - Sends custom reset email with token link

2. **`src/services/userService.js`**
   - `resetUserPassword()` now uses new password reset service
   - Removed Firebase Auth dependency

3. **`src/routes/AppRoutes.jsx`**
   - Added route: `/reset-password`

---

## Token Storage

Tokens are stored in Firestore collection: `password_reset_tokens`

**Document Structure:**
```javascript
{
  userId: "user_id_here",
  email: "user@example.com",
  createdAt: Timestamp,
  expiresAt: Timestamp, // 1 hour from creation
  used: false
}
```

**Security Features:**
- Tokens expire after 1 hour
- Tokens can only be used once
- Expired tokens are automatically cleaned up
- Tokens are deleted after successful use

---

## Password Update Process

When password is reset:

1. **Get User Roles**: Fetches all roles from user document
2. **Hash Separately**: Each role password is hashed separately (unique salts)
3. **Update Firestore**: Updates `rolePasswords` field:
   ```javascript
   rolePasswords: {
     branchManager: "$2b$10$...",
     stylist: "$2b$10$...",
     receptionist: "$2b$10$...",
     // ... all user roles
   }
   ```
4. **Update Metadata**: Sets `updatedAt` and `updatedBy` fields

---

## Email Template

The reset email includes:
- Professional HTML template
- Reset button with link
- Plain text fallback
- Security warnings
- Expiration notice (1 hour)

**Email Subject:** "Reset Your Password - David's Salon"

---

## Password Requirements

The new password must meet:
- ✅ Minimum 8 characters
- ✅ At least one number (0-9)
- ✅ At least one special character (!@#$%^&*...)

These are validated both client-side and server-side.

---

## Routes

- **`/forgot-password`** - Request password reset
- **`/reset-password?token=XXXXX`** - Reset password with token

Both routes redirect logged-in users to their dashboard.

---

## Usage Examples

### Request Password Reset:
```javascript
import { createPasswordResetToken } from '../services/passwordResetService';

const result = await createPasswordResetToken('user@example.com');
if (result.success) {
  // Email sent successfully
}
```

### Reset Password:
```javascript
import { resetPasswordWithToken } from '../services/passwordResetService';

const result = await resetPasswordWithToken(token, 'NewPassword123!');
if (result.success) {
  // Password reset successfully
  // All rolePasswords updated
}
```

---

## Security Features

1. **Token Security:**
   - 64-character random tokens
   - Stored securely in Firestore
   - Expires after 1 hour
   - Single-use only

2. **Password Security:**
   - Bcrypt hashing (10 salt rounds)
   - Separate hash for each role
   - Strong password requirements
   - No plain text storage

3. **Validation:**
   - Token expiration check
   - User account status check
   - Password strength validation
   - Token usage tracking

4. **Activity Logging:**
   - Logs password reset requests
   - Logs password reset completions
   - Tracks which roles were updated

---

## Testing

### Test Scenarios:

1. **Valid Reset Flow:**
   - Request reset → Receive email → Click link → Set password → Success

2. **Expired Token:**
   - Request reset → Wait >1 hour → Click link → Error: "Expired"

3. **Used Token:**
   - Request reset → Use token → Try again → Error: "Already used"

4. **Invalid Token:**
   - Random token → Error: "Invalid token"

5. **Weak Password:**
   - Try password without number → Validation error
   - Try password without special char → Validation error
   - Try password <8 chars → Validation error

---

## Firestore Rules

Ensure Firestore rules allow:
- Read/write to `password_reset_tokens` collection
- Update to `users` collection `rolePasswords` field

---

## Cleanup

Expired tokens can be cleaned up periodically:
```javascript
import { cleanupExpiredTokens } from '../services/passwordResetService';

const deletedCount = await cleanupExpiredTokens();
console.log(`Cleaned up ${deletedCount} expired tokens`);
```

---

## Notes

- This system updates `rolePasswords` in Firestore, NOT Firebase Auth passwords
- All user roles get the same new password (but with different hashes)
- The system works independently of Firebase Auth
- Email service must be configured (SendGrid API key)

---

**Implementation Date:** December 2024  
**Status:** ✅ Complete and Ready for Testing













