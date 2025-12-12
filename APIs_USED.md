# APIs ACTUALLY USED in David's Salon Management System

This document lists only the APIs that are **actively being used** in the codebase.

---

## 🔥 1. Firebase Services (Primary Backend)

**Status**: ✅ **ACTIVELY USED** - Core infrastructure

### Services Used:
- **Firebase Authentication** - User login/authentication
- **Cloud Firestore** - Primary database for all data
- **Firebase Storage** - File storage (if used)

**Configuration**: `src/config/firebase.js`

**Where Used**: 
- Throughout the entire application
- All service files interact with Firestore
- Authentication via `src/context/AuthContext.jsx`

---

## 🤖 2. OpenAI API

**Status**: ✅ **ACTIVELY USED** - Optional feature (requires API key)

**Base URL**: `https://api.openai.com/v1`

**Service File**: `src/services/openaiService.js`

**Where Used**:

1. **Branch Manager → Inventory Page** (`src/pages/branch-manager/Inventory.jsx`)
   - Function: `generateProductSalesInsights()`
   - Purpose: Generate AI insights for product sales analytics
   - Line: ~553

2. **Branch Manager → Promotions Page** (`src/pages/branch-manager/Promotions.jsx`)
   - Function: `generatePromotionRecommendations()`
   - Purpose: Generate AI-powered promotion suggestions
   - Line: ~244

**Environment Variable**: `VITE_OPENAI_API_KEY`

**Model Used**: `gpt-4o-mini`

**Note**: Feature is optional - checks `openaiService.isConfigured()` before use

---

## 📧 3. SendGrid API

**Status**: ✅ **ACTIVELY USED** - Email notifications

**Base URL**: `https://api.sendgrid.com/v3`

**Endpoint**: `/mail/send`

**Service File**: `src/services/emailService.js`

**Where Used**:

1. **Branch Manager → Promotions Page** (`src/pages/branch-manager/Promotions.jsx`)
   - Function: `sendPromotionEmail()`
   - Purpose: Send promotion emails to clients
   - Lines: ~448, ~584

2. **User Service** (`src/services/userService.js`)
   - Functions:
     - `sendUserCreatedEmail()` - Welcome email when user account is created
     - `sendAccountActivatedEmail()` - Account activation notification
     - `sendAccountDeactivatedEmail()` - Account deactivation notification
     - `sendPasswordResetNotification()` - Password reset emails

3. **Public Registration** (`src/pages/public/Register.jsx`)
   - Function: `sendWelcomeEmail()`
   - Purpose: Send welcome email to new users
   - Line: ~13

**Email Types Sent**:
- Welcome emails
- Promotion emails to clients
- Purchase order emails to suppliers
- Account activation/deactivation emails
- User creation notifications
- Password reset notifications

**Environment Variables**: 
- `VITE_SENDGRID_API_KEY`
- `VITE_SENDGRID_FROM_EMAIL`

---

## 🖼️ 4. Cloudinary API

**Status**: ✅ **ACTIVELY USED** - Image upload and management

**Base URL**: `https://api.cloudinary.com/v1_1/{cloudName}/image/upload`

**Service Files**: 
- `src/services/cloudinaryService.js`
- `src/services/imageService.js`

**Where Used**:

1. **Branch Manager → Deposits Page** (`src/pages/branch-manager/Deposits.jsx`)
   - Function: `cloudinaryService.uploadImage()`
   - Purpose: Upload receipt images for bank deposits
   - Line: ~434, ~446

2. **Branch Manager → Branch Products Page** (`src/pages/branch-manager/BranchProducts.jsx`)
   - Function: `uploadToCloudinary()`
   - Purpose: Upload product icons
   - Line: ~913

3. **System Admin → Master Products Page** (`src/pages/system-admin/MasterProducts.jsx`)
   - Function: `cloudinaryService.uploadImage()`
   - Purpose: Upload product images
   - Line: ~625

4. **Common → Profile Page** (`src/pages/common/Profile.jsx`)
   - Function: `uploadToCloudinary()`
   - Purpose: Upload profile pictures
   - Line: ~104

5. **Service Modal Component** (`src/components/service/ServiceModal.jsx`)
   - Function: `uploadToCloudinary()`
   - Purpose: Upload service images
   - Line: ~167

6. **Branch Manager → Services Management** (`src/pages/branch-manager/ServicesManagement.jsx`)
   - Function: `uploadToCloudinary()`
   - Purpose: Upload service icons
   - Line: ~550

7. **System Admin → Homepage Content Management** (`src/pages/system-admin/HomepageContentManagement.jsx`)
   - Function: `cloudinaryService.uploadImage()`
   - Purpose: Upload content images
   - Line: ~151

**Cloud Name**: `dn0jgdjts`

**Upload Preset**: `daviddevs_images`

**Environment Variables**:
- `VITE_CLOUDINARY_CLOUD_NAME`
- `VITE_CLOUDINARY_UPLOAD_PRESET`

---

## 📅 5. Nager.Date API (Public Holidays)

**Status**: ✅ **ACTIVELY USED** - Holiday verification

**Base URL**: `https://date.nager.at/api/v3`

**Endpoint**: `/PublicHolidays/{year}/{countryCode}`

**Service File**: `src/services/holidaysApiService.js`

**Where Used**:

1. **Branch Manager → Calendar Management** (`src/pages/branch-manager/CalendarManagement.jsx`)
   - Function: `getPublicHolidays()`
   - Purpose: Fetch and display Philippine public holidays in calendar
   - Line: ~204

2. **Operational Manager → Calendar** (`src/pages/operational-manager/Calendar.jsx`)
   - Function: `getPublicHolidays()`
   - Purpose: Fetch holidays for calendar view
   - Line: ~143

3. **Operational Manager → Calendar Approval** (`src/pages/operational-manager/CalendarApproval.jsx`)
   - Function: `getPublicHolidays()`
   - Purpose: Verify if dates are public holidays before approval
   - Line: ~137

**Country Code**: Default is `'PH'` (Philippines)

**Note**: Free API, no API key required

---

## 📄 6. Tesseract.js (OCR Library - Client-Side)

**Status**: ✅ **ACTIVELY USED** - Receipt text extraction

**Type**: JavaScript Library (not a REST API)

**Service File**: `src/utils/ocrService.js`

**Where Used**:

1. **Branch Manager → Deposits Page** (`src/pages/branch-manager/Deposits.jsx`)
   - Function: `extractAmountFromReceipt()`
   - Purpose: Extract amount from receipt images automatically
   - Lines: ~238, ~301
   - Function: `validateExtractedAmount()`
   - Purpose: Validate extracted amount against expected daily sales total

**Features**:
- Extracts text from receipt images
- Extracts monetary amounts from receipts
- Validates extracted amounts against expected totals
- Uses English language model

**How It Works**:
- Runs OCR on receipt image upload
- Automatically extracts amount when image is uploaded
- Validates against daily sales total for deposit verification

---

## 📊 Summary

### **External APIs Used: 5**

1. ✅ **Firebase** (Auth, Firestore, Storage) - Core backend
2. ✅ **OpenAI API** - AI insights (2 pages)
3. ✅ **SendGrid API** - Email notifications (multiple uses)
4. ✅ **Cloudinary API** - Image uploads (7+ locations)
5. ✅ **Nager.Date API** - Public holidays (3 pages)

### **Client-Side Libraries: 1**

1. ✅ **Tesseract.js** - OCR for receipt scanning (1 page)

---

## 🔑 Required Environment Variables

```env
# Firebase (Required)
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_MEASUREMENT_ID=

# SendGrid (Required for emails)
VITE_SENDGRID_API_KEY=
VITE_SENDGRID_FROM_EMAIL=

# Cloudinary (Required for image uploads)
VITE_CLOUDINARY_CLOUD_NAME=
VITE_CLOUDINARY_UPLOAD_PRESET=

# OpenAI (Optional - for AI features)
VITE_OPENAI_API_KEY=
```

---

## 📝 Notes

- **Firebase** is the primary backend - all data operations go through Firestore
- **SendGrid** is required if you want email functionality
- **Cloudinary** is required for image uploads (profile pics, receipts, products, etc.)
- **OpenAI** is optional - features gracefully degrade if not configured
- **Nager.Date** is free and doesn't require authentication
- **Tesseract.js** runs entirely client-side (no API calls)















