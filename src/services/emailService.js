/**
 * Email Service
 * Handles email notifications via Brevo (formerly Sendinblue)
 * 
 * To use this service, configure Brevo API key in environment variables:
 * VITE_BREVO_API_KEY=your_api_key_here
 * VITE_BREVO_FROM_EMAIL=noreply@davidsalon.com (optional)
 * VITE_BREVO_FROM_NAME=David's Salon (optional)
 */

/**
 * Send email via Brevo
 * @param {Object} emailData - Email data
 * @param {string} emailData.to - Recipient email
 * @param {string} emailData.subject - Email subject
 * @param {string} emailData.text - Plain text content
 * @param {string} emailData.html - HTML content (optional)
 * @returns {Promise<Object>} Send result
 */
export const sendEmail = async ({ to, subject, text, html }) => {
  const apiKey = import.meta.env.VITE_BREVO_API_KEY;
  const fromEmail = import.meta.env.VITE_BREVO_FROM_EMAIL || import.meta.env.VITE_SENDER_EMAIL || 'noreply@davidsalon.com';
  const fromName = import.meta.env.VITE_BREVO_FROM_NAME || import.meta.env.VITE_SENDER_NAME || 'David\'s Salon';
  
  if (!apiKey) {
    console.warn('Brevo API key not configured. Email not sent.');
    return {
      success: false,
      error: 'Brevo API key not configured'
    };
  }

  try {
    const requestBody = {
      sender: {
        name: fromName,
        email: fromEmail
      },
      to: [
        {
          email: to
        }
      ],
      subject: subject,
      textContent: text,
      ...(html ? { htmlContent: html } : {})
    };

    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });
    
    if (!response.ok) {
      const errorData = await response.text();
      let errorMessage = `Brevo API error: ${response.status}`;
      try {
        const errorJson = JSON.parse(errorData);
        errorMessage = errorJson.message || errorMessage;
      } catch (e) {
        errorMessage += ` - ${errorData}`;
      }
      throw new Error(errorMessage);
    }
    
    return {
      success: true,
      message: 'Email sent successfully'
    };
  } catch (error) {
    console.error('Error sending email:', error);
    return {
      success: false,
      error: error.message || 'Failed to send email'
    };
  }
};

/**
 * Send purchase order email to supplier
 * @param {Object} orderData - Purchase order data
 * @param {Object} supplierData - Supplier data
 * @returns {Promise<Object>} Send result
 */
export const sendPurchaseOrderEmail = async (orderData, supplierData) => {
  if (!supplierData.email) {
    return {
      success: false,
      error: 'Supplier email not found'
    };
  }
  
  const { formatDate } = await import('../utils/helpers');
  
  // Format order items
  const itemsList = orderData.items.map((item, index) => `
    <tr>
      <td style="padding: 8px; border-bottom: 1px solid #ddd;">${index + 1}</td>
      <td style="padding: 8px; border-bottom: 1px solid #ddd;">${item.itemName || 'Item'}</td>
      <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">${item.quantity} ${item.unit || ''}</td>
      <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">₱${(item.unitCost || 0).toFixed(2)}</td>
      <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">₱${((item.quantity || 0) * (item.unitCost || 0)).toFixed(2)}</td>
    </tr>
  `).join('');
  
  const expectedDeliveryDate = orderData.expectedDeliveryDate 
    ? formatDate(orderData.expectedDeliveryDate instanceof Date ? orderData.expectedDeliveryDate : orderData.expectedDeliveryDate.toDate())
    : 'TBD';

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #2563eb; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background-color: #f9fafb; }
        .order-info { background-color: white; padding: 15px; border-radius: 5px; margin: 15px 0; }
        table { width: 100%; border-collapse: collapse; margin: 15px 0; }
        th { background-color: #f3f4f6; padding: 10px; text-align: left; border-bottom: 2px solid #ddd; }
        td { padding: 8px; border-bottom: 1px solid #ddd; }
        .total { font-weight: bold; font-size: 1.1em; text-align: right; padding-top: 10px; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 0.9em; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Purchase Order</h1>
          <p>David's Salon Management System</p>
        </div>
        <div class="content">
          <p>Dear ${supplierData.name || 'Supplier'},</p>
          
          <p>We are pleased to submit the following purchase order:</p>
          
          <div class="order-info">
            <p><strong>PO Number:</strong> ${orderData.poNumber}</p>
            <p><strong>Order Date:</strong> ${formatDate(orderData.createdAt instanceof Date ? orderData.createdAt : orderData.createdAt.toDate())}</p>
            <p><strong>Expected Delivery:</strong> ${expectedDeliveryDate}</p>
            ${orderData.branchName ? `<p><strong>Branch:</strong> ${orderData.branchName}</p>` : ''}
          </div>

          <h3>Order Items:</h3>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Item</th>
                <th style="text-align: right;">Quantity</th>
                <th style="text-align: right;">Unit Price</th>
                <th style="text-align: right;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemsList}
            </tbody>
            <tfoot>
              <tr>
                <td colspan="4" class="total">Total Amount:</td>
                <td class="total">₱${(orderData.totalAmount || 0).toFixed(2)}</td>
              </tr>
            </tfoot>
          </table>
          
          ${orderData.notes ? `<p><strong>Notes:</strong><br>${orderData.notes}</p>` : ''}
          
          <p>Please confirm receipt of this purchase order and inform us of the delivery date.</p>
          
          <p>Thank you for your continued partnership.</p>
          
          <p>Best regards,<br>
          ${orderData.createdByName || 'Inventory Team'}<br>
          David's Salon</p>
        </div>
        <div class="footer">
          <p>This is an automated email. Please do not reply directly to this message.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const textContent = `
    PURCHASE ORDER - ${orderData.poNumber}
    David's Salon Management System
    
    Dear ${supplierData.name || 'Supplier'},
    
    We are pleased to submit the following purchase order:
    
    PO Number: ${orderData.poNumber}
    Order Date: ${formatDate(orderData.createdAt instanceof Date ? orderData.createdAt : orderData.createdAt.toDate())}
    Expected Delivery: ${expectedDeliveryDate}
    ${orderData.branchName ? `Branch: ${orderData.branchName}\n` : ''}
    
    Order Items:
    ${orderData.items.map((item, index) => 
      `${index + 1}. ${item.itemName || 'Item'} - ${item.quantity} ${item.unit || ''} @ ₱${(item.unitCost || 0).toFixed(2)} = ₱${((item.quantity || 0) * (item.unitCost || 0)).toFixed(2)}`
    ).join('\n')}
    
    Total Amount: ₱${(orderData.totalAmount || 0).toFixed(2)}
    
    ${orderData.notes ? `Notes:\n${orderData.notes}\n` : ''}
    
    Please confirm receipt of this purchase order and inform us of the delivery date.
    
    Thank you for your continued partnership.
    
    Best regards,
    ${orderData.createdByName || 'Inventory Team'}
    David's Salon
  `;
  
  return await sendEmail({
    to: supplierData.email,
    subject: `Purchase Order ${orderData.poNumber} - David's Salon`,
    text: textContent,
    html: htmlContent
  });
};

/**
 * Send welcome email to new user
 * @param {Object} userData - User data
 * @param {string} userData.email - User email
 * @param {string} userData.displayName - User display name
 * @param {string} userData.role - User role
 * @returns {Promise<Object>} Send result
 */
export const sendWelcomeEmail = async ({ email, displayName, role }) => {
  if (!email) {
    return {
      success: false,
      error: 'Email is required'
    };
  }

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #2563eb; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { padding: 30px; background-color: #f9fafb; border-radius: 0 0 8px 8px; }
        .button { display: inline-block; padding: 12px 24px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 0.9em; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Welcome to David's Salon!</h1>
        </div>
        <div class="content">
          <p>Dear ${displayName || 'Valued Customer'},</p>
          
          <p>Welcome to <strong>David's Salon Management System</strong>! We're thrilled to have you join our community.</p>
          
          <p>Your account has been successfully created with the role of <strong>${role || 'Client'}</strong>.</p>
          
          <p>Here's what you can do next:</p>
          <ul>
            <li>Verify your email address by clicking the verification link we sent</li>
            <li>Complete your profile</li>
            <li>Book your first appointment</li>
            <li>Explore our services and offerings</li>
          </ul>
          
          <p>If you have any questions or need assistance, please don't hesitate to contact our support team.</p>
          
          <p>We look forward to serving you!</p>
          
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
    Welcome to David's Salon!
    
    Dear ${displayName || 'Valued Customer'},
    
    Welcome to David's Salon Management System! We're thrilled to have you join our community.
    
    Your account has been successfully created with the role of ${role || 'Client'}.
    
    Here's what you can do next:
    - Verify your email address by clicking the verification link we sent
    - Complete your profile
    - Book your first appointment
    - Explore our services and offerings
    
    If you have any questions or need assistance, please don't hesitate to contact our support team.
    
    We look forward to serving you!
    
    Best regards,
    The David's Salon Team
    
    ---
    This is an automated email. Please do not reply directly to this message.
    © ${new Date().getFullYear()} David's Salon. All rights reserved.
  `;

  return await sendEmail({
    to: email,
    subject: 'Welcome to David\'s Salon Management System',
    text: textContent,
    html: htmlContent
  });
};

/**
 * Send account activation email to user
 * @param {Object} userData - User data
 * @param {string} userData.email - User email
 * @param {string} userData.displayName - User display name
 * @returns {Promise<Object>} Send result
 */
export const sendAccountActivatedEmail = async ({ email, displayName }) => {
  if (!email) {
    return {
      success: false,
      error: 'Email is required'
    };
  }

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #10b981; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { padding: 30px; background-color: #f9fafb; border-radius: 0 0 8px 8px; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 0.9em; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Account Activated!</h1>
        </div>
        <div class="content">
          <p>Dear ${displayName || 'User'},</p>
          
          <p>Great news! Your account has been <strong>activated</strong> and you can now access the David's Salon Management System.</p>
          
          <p>You can now log in and start using the system.</p>
          
          <p>If you have any questions or need assistance, please don't hesitate to contact our support team.</p>
          
          <p>Welcome aboard!</p>
          
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
    Account Activated!
    
    Dear ${displayName || 'User'},
    
    Great news! Your account has been activated and you can now access the David's Salon Management System.
    
    You can now log in and start using the system.
    
    If you have any questions or need assistance, please don't hesitate to contact our support team.
    
    Welcome aboard!
    
    Best regards,
    The David's Salon Team
    
    ---
    This is an automated email. Please do not reply directly to this message.
    © ${new Date().getFullYear()} David's Salon. All rights reserved.
  `;

  return await sendEmail({
    to: email,
    subject: 'Account Activated - David\'s Salon',
    text: textContent,
    html: htmlContent
  });
};

/**
 * Send account deactivation email to user
 * @param {Object} userData - User data
 * @param {string} userData.email - User email
 * @param {string} userData.displayName - User display name
 * @param {string} userData.reason - Reason for deactivation (optional)
 * @returns {Promise<Object>} Send result
 */
export const sendAccountDeactivatedEmail = async ({ email, displayName, reason }) => {
  if (!email) {
    return {
      success: false,
      error: 'Email is required'
    };
  }

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #ef4444; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { padding: 30px; background-color: #f9fafb; border-radius: 0 0 8px 8px; }
        .warning { background-color: #fee2e2; border-left: 4px solid #ef4444; padding: 15px; margin: 20px 0; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 0.9em; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Account Deactivated</h1>
        </div>
        <div class="content">
          <p>Dear ${displayName || 'User'},</p>
          
          <div class="warning">
            <p><strong>Your account has been deactivated.</strong></p>
            <p>You will no longer be able to access the David's Salon Management System.</p>
          </div>
          
          ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
          
          <p>If you believe this is an error or have any questions, please contact our support team.</p>
          
          <p>Thank you for using our system.</p>
          
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
    Account Deactivated
    
    Dear ${displayName || 'User'},
    
    Your account has been deactivated. You will no longer be able to access the David's Salon Management System.
    
    ${reason ? `Reason: ${reason}\n` : ''}
    
    If you believe this is an error or have any questions, please contact our support team.
    
    Thank you for using our system.
    
    Best regards,
    The David's Salon Team
    
    ---
    This is an automated email. Please do not reply directly to this message.
    © ${new Date().getFullYear()} David's Salon. All rights reserved.
  `;

  return await sendEmail({
    to: email,
    subject: 'Account Deactivated - David\'s Salon',
    text: textContent,
    html: htmlContent
  });
};

/**
 * Send user creation notification email
 * @param {Object} userData - User data
 * @param {string} userData.email - User email
 * @param {string} userData.displayName - User display name
 * @param {string} userData.role - User role
 * @param {string} userData.temporaryPassword - Temporary password (optional)
 * @returns {Promise<Object>} Send result
 */
export const sendUserCreatedEmail = async ({ email, displayName, role, temporaryPassword }) => {
  if (!email) {
    return {
      success: false,
      error: 'Email is required'
    };
  }

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #2563eb; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { padding: 30px; background-color: #f9fafb; border-radius: 0 0 8px 8px; }
        .credentials { background-color: #eff6ff; border-left: 4px solid #2563eb; padding: 15px; margin: 20px 0; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 0.9em; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Account Created</h1>
        </div>
        <div class="content">
          <p>Dear ${displayName || 'User'},</p>
          
          <p>An account has been created for you in the <strong>David's Salon Management System</strong>.</p>
          
          <div class="credentials">
            <p><strong>Account Details:</strong></p>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Role:</strong> ${role || 'Not specified'}</p>
            ${temporaryPassword ? `<p><strong>Temporary Password:</strong> ${temporaryPassword}</p>` : ''}
          </div>
          
          ${temporaryPassword ? '<p><strong>Please change your password after your first login.</strong></p>' : ''}
          
          <p>You can now log in using your email address and password.</p>
          
          <p>If you have any questions or need assistance, please contact our support team.</p>
          
          <p>Welcome to the team!</p>
          
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
    Account Created - David's Salon Management System
    
    Dear ${displayName || 'User'},
    
    An account has been created for you in the David's Salon Management System.
    
    Account Details:
    Email: ${email}
    Role: ${role || 'Not specified'}
    ${temporaryPassword ? `Temporary Password: ${temporaryPassword}` : ''}
    
    ${temporaryPassword ? 'Please change your password after your first login.\n' : ''}
    
    You can now log in using your email address and password.
    
    If you have any questions or need assistance, please contact our support team.
    
    Welcome to the team!
    
    Best regards,
    The David's Salon Team
    
    ---
    This is an automated email. Please do not reply directly to this message.
    © ${new Date().getFullYear()} David's Salon. All rights reserved.
  `;

  return await sendEmail({
    to: email,
    subject: 'Account Created - David\'s Salon Management System',
    text: textContent,
    html: htmlContent
  });
};

/**
 * Send password reset notification email
 * @param {Object} userData - User data
 * @param {string} userData.email - User email
 * @param {string} userData.displayName - User display name
 * @returns {Promise<Object>} Send result
 */
export const sendPasswordResetNotification = async ({ email, displayName }) => {
  if (!email) {
    return {
      success: false,
      error: 'Email is required'
    };
  }

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #f59e0b; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { padding: 30px; background-color: #f9fafb; border-radius: 0 0 8px 8px; }
        .info { background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 0.9em; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Password Reset Request</h1>
        </div>
        <div class="content">
          <p>Dear ${displayName || 'User'},</p>
          
          <p>We received a request to reset your password for your David's Salon Management System account.</p>
          
          <div class="info">
            <p>A password reset email has been sent to your email address (${email}).</p>
            <p>Please check your inbox and follow the instructions to reset your password.</p>
          </div>
          
          <p><strong>If you did not request this password reset, please ignore this email or contact our support team immediately.</strong></p>
          
          <p>For security reasons, the password reset link will expire in 1 hour.</p>
          
          <p>If you have any questions or need assistance, please don't hesitate to contact our support team.</p>
          
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
    Password Reset Request - David's Salon Management System
    
    Dear ${displayName || 'User'},
    
    We received a request to reset your password for your David's Salon Management System account.
    
    A password reset email has been sent to your email address (${email}).
    Please check your inbox and follow the instructions to reset your password.
    
    If you did not request this password reset, please ignore this email or contact our support team immediately.
    
    For security reasons, the password reset link will expire in 1 hour.
    
    If you have any questions or need assistance, please don't hesitate to contact our support team.
    
    Best regards,
    The David's Salon Team
    
    ---
    This is an automated email. Please do not reply directly to this message.
    © ${new Date().getFullYear()} David's Salon. All rights reserved.
  `;

  return await sendEmail({
    to: email,
    subject: 'Password Reset Request - David\'s Salon',
    text: textContent,
    html: htmlContent
  });
};

/**
 * Send promotion email to client
 * @param {Object} promotion - Promotion data
 * @param {Object} clientData - Client data with email
 * @returns {Promise<Object>} - Result of email sending
 */
export const sendPromotionEmail = async (promotion, clientData) => {
  try {
    if (!clientData.email) {
      return {
        success: false,
        message: 'Client email not found'
      };
    }

    const clientName = clientData.firstName && clientData.lastName
      ? `${clientData.firstName} ${clientData.lastName}`.trim()
      : clientData.name || 'Valued Client';

    // Fetch branch name
    let branchName = 'Unknown Branch';
    if (promotion.branchId) {
      try {
        const { doc, getDoc } = await import('firebase/firestore');
        const { db } = await import('../config/firebase');
        const branchDoc = await getDoc(doc(db, 'branches', promotion.branchId));
        if (branchDoc.exists()) {
          branchName = branchDoc.data().name || branchDoc.data().branchName || 'Unknown Branch';
        }
      } catch (err) {
        console.warn('Could not fetch branch name:', err);
      }
    }

    // Format dates
    const startDate = promotion.startDate?.toDate 
      ? promotion.startDate.toDate() 
      : new Date(promotion.startDate);
    const endDate = promotion.endDate?.toDate 
      ? promotion.endDate.toDate() 
      : new Date(promotion.endDate);

    const startDateFormatted = startDate.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
    const endDateFormatted = endDate.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });

    // Build applicable to text
    let applicableText = '';
    if (promotion.applicableTo === 'services') {
      applicableText = 'Valid on all services';
    } else if (promotion.applicableTo === 'products') {
      applicableText = 'Valid on all products';
    } else if (promotion.applicableTo === 'specific') {
      const serviceCount = promotion.specificServices?.length || 0;
      const productCount = promotion.specificProducts?.length || 0;
      const items = [];
      if (serviceCount > 0) items.push(`${serviceCount} service${serviceCount > 1 ? 's' : ''}`);
      if (productCount > 0) items.push(`${productCount} product${productCount > 1 ? 's' : ''}`);
      applicableText = `Valid on ${items.join(' and ')}`;
    } else {
      applicableText = 'Valid on all services and products';
    }

    // Build usage information
    let usageInfo = '';
    if (promotion.usageType === 'one-time') {
      usageInfo = 'Usage: One-time use per client';
    } else if (promotion.usageType === 'repeating') {
      if (promotion.maxUses) {
        usageInfo = `Usage: Can be used up to ${promotion.maxUses} time${promotion.maxUses > 1 ? 's' : ''}`;
      } else {
        usageInfo = 'Usage: Unlimited uses';
      }
    }

    // Build promotion code info
    const promotionCodeText = promotion.promotionCode 
      ? `Promotion Code: ${promotion.promotionCode}`
      : '';

    const discountText = promotion.discountType === 'percentage' 
      ? `${promotion.discountValue}% OFF`
      : `₱${promotion.discountValue} OFF`;

    // Create email content
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #160B53, #12094A); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { padding: 30px; background: white; border: 1px solid #e0e0e0; border-radius: 0 0 10px 10px; }
          .promotion-box { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .discount { font-size: 24px; font-weight: bold; color: #28a745; margin: 10px 0; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 0.9em; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0; font-size: 24px;">🎉 Special Promotion</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">David's Salon</p>
          </div>
          <div class="content">
            <h2 style="color: #160B53; margin-top: 0;">Hello ${clientName},</h2>
            <p>We have an exciting promotion just for you!</p>
            <div class="promotion-box">
              <h3 style="color: #160B53; margin-top: 0;">${promotion.title}</h3>
              <p>${promotion.description || 'No description provided.'}</p>
              <div class="discount">${discountText}</div>
              <p><strong>${applicableText}</strong></p>
              ${promotionCodeText ? `<p><strong>${promotionCodeText}</strong></p>` : ''}
              <p>${usageInfo}</p>
            </div>
            <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <h4 style="margin-top: 0; color: #856404;">Validity Period:</h4>
              <p style="margin: 0; color: #856404;">
                <strong>Valid from:</strong> ${startDateFormatted}<br>
                <strong>Valid until:</strong> ${endDateFormatted}
              </p>
            </div>
            <p><strong>Branch:</strong> ${branchName}</p>
            <p>Don't miss out on this amazing offer! Visit us soon to take advantage of this promotion.</p>
            <p>We look forward to seeing you!</p>
            <div class="footer">
              <p>This is an automated email from David's Salon Management System.<br>
              Please do not reply to this email.</p>
              <p>© ${new Date().getFullYear()} David's Salon. All rights reserved.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    const textContent = `
Hello ${clientName},

🎉 Special Promotion: ${promotion.title}

${promotion.description || 'No description provided.'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

DISCOUNT DETAILS:
Discount: ${discountText}
${applicableText}
${promotionCodeText ? promotionCodeText + '\n' : ''}${usageInfo}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

VALIDITY PERIOD:
Valid from: ${startDateFormatted}
Valid until: ${endDateFormatted}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Branch: ${branchName}

Don't miss out on this amazing offer! Visit us soon to take advantage of this promotion.

We look forward to seeing you!

---
David's Salon
    `;

    const result = await sendEmail({
      to: clientData.email,
      subject: `Special Promotion: ${promotion.title}`,
      text: textContent,
      html: htmlContent
    });

    return {
      success: result.success,
      message: result.success ? 'Promotion email sent successfully' : result.error || 'Failed to send email',
      email: clientData.email
    };
  } catch (error) {
    console.error('Error sending promotion email:', error);
    return {
      success: false,
      message: 'Failed to send promotion email',
      error: error.message
    };
  }
};

/**
 * Send appointment reminder email to client
 * @param {Object} appointmentData - Appointment data
 * @param {Object} branchData - Branch data
 * @returns {Promise<Object>} Send result
 */
export const sendAppointmentReminderEmail = async (appointmentData, branchData) => {
  if (!appointmentData.clientEmail) {
    return {
      success: false,
      error: 'Client email not found'
    };
  }

  const { formatDate, formatTime } = await import('../utils/helpers');
  
  // Format appointment date and time
  const appointmentDate = appointmentData.appointmentDate 
    ? (appointmentData.appointmentDate instanceof Date 
        ? appointmentData.appointmentDate 
        : appointmentData.appointmentDate.toDate?.() || new Date(appointmentData.appointmentDate))
    : null;
  
  if (!appointmentDate) {
    return {
      success: false,
      error: 'Appointment date not found'
    };
  }

  const formattedDate = formatDate(appointmentDate, 'MMMM dd, yyyy');
  const formattedTime = formatTime(appointmentDate);
  const dayOfWeek = appointmentDate.toLocaleDateString('en-US', { weekday: 'long' });
  
  // Get service names
  let serviceNames = [];
  if (appointmentData.services && Array.isArray(appointmentData.services)) {
    serviceNames = appointmentData.services.map(s => s.serviceName || s.name || 'Service').filter(Boolean);
  } else if (appointmentData.serviceName) {
    serviceNames = [appointmentData.serviceName];
  }
  const servicesText = serviceNames.length > 0 ? serviceNames.join(', ') : 'Service';
  
  // Get stylist name
  let stylistName = 'TBA';
  if (appointmentData.services && Array.isArray(appointmentData.services) && appointmentData.services.length > 0) {
    const assignedStylist = appointmentData.services.find(s => s.stylistName);
    if (assignedStylist) {
      stylistName = assignedStylist.stylistName;
    }
  } else if (appointmentData.stylistName) {
    stylistName = appointmentData.stylistName;
  }
  
  const branchName = branchData?.branchName || branchData?.name || 'David\'s Salon';
  const branchAddress = branchData?.address || '';
  const branchPhone = branchData?.phoneNumber || branchData?.phone || '';
  
  const clientName = appointmentData.clientName || 'Valued Client';

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #2D1B4E 0%, #3d2a5f 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { padding: 30px; background-color: #f9fafb; border-radius: 0 0 8px 8px; }
        .appointment-box { background: white; border: 2px solid #2D1B4E; border-radius: 8px; padding: 20px; margin: 20px 0; }
        .appointment-detail { margin: 10px 0; padding: 8px 0; border-bottom: 1px solid #e5e7eb; }
        .appointment-detail:last-child { border-bottom: none; }
        .label { font-weight: 600; color: #2D1B4E; display: inline-block; min-width: 120px; }
        .value { color: #333; }
        .reminder-note { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 4px; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 0.9em; }
        .button { display: inline-block; padding: 12px 24px; background-color: #2D1B4E; color: white; text-decoration: none; border-radius: 6px; margin: 10px 5px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>📅 Appointment Reminder</h1>
          <p style="margin: 10px 0 0 0; font-size: 1.1em;">See you tomorrow!</p>
        </div>
        <div class="content">
          <p>Dear ${clientName},</p>
          
          <p>This is a friendly reminder that you have an appointment scheduled for <strong>tomorrow</strong>.</p>
          
          <div class="appointment-box">
            <div class="appointment-detail">
              <span class="label">📅 Date:</span>
              <span class="value">${dayOfWeek}, ${formattedDate}</span>
            </div>
            <div class="appointment-detail">
              <span class="label">🕐 Time:</span>
              <span class="value">${formattedTime}</span>
            </div>
            <div class="appointment-detail">
              <span class="label">✂️ Service:</span>
              <span class="value">${servicesText}</span>
            </div>
            <div class="appointment-detail">
              <span class="label">👤 Stylist:</span>
              <span class="value">${stylistName}</span>
            </div>
            <div class="appointment-detail">
              <span class="label">📍 Branch:</span>
              <span class="value">${branchName}</span>
            </div>
            ${branchAddress ? `
            <div class="appointment-detail">
              <span class="label">📍 Address:</span>
              <span class="value">${branchAddress}</span>
            </div>
            ` : ''}
            ${branchPhone ? `
            <div class="appointment-detail">
              <span class="label">📞 Phone:</span>
              <span class="value">${branchPhone}</span>
            </div>
            ` : ''}
          </div>
          
          <div class="reminder-note">
            <strong>💡 Reminder:</strong> Please arrive 10-15 minutes before your scheduled time. If you need to reschedule or cancel, please contact us as soon as possible.
          </div>
          
          <p>We look forward to seeing you tomorrow!</p>
          
          <p>Best regards,<br>
          <strong>The ${branchName} Team</strong><br>
          David's Salon</p>
        </div>
        <div class="footer">
          <p>This is an automated reminder. Please do not reply directly to this message.</p>
          <p>&copy; ${new Date().getFullYear()} David's Salon. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const textContent = `
    Appointment Reminder - David's Salon
    
    Dear ${clientName},
    
    This is a friendly reminder that you have an appointment scheduled for TOMORROW.
    
    Appointment Details:
    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    Date: ${dayOfWeek}, ${formattedDate}
    Time: ${formattedTime}
    Service: ${servicesText}
    Stylist: ${stylistName}
    Branch: ${branchName}
    ${branchAddress ? `Address: ${branchAddress}\n` : ''}
    ${branchPhone ? `Phone: ${branchPhone}\n` : ''}
    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    
    💡 Reminder: Please arrive 10-15 minutes before your scheduled time. If you need to reschedule or cancel, please contact us as soon as possible.
    
    We look forward to seeing you tomorrow!
    
    Best regards,
    The ${branchName} Team
    David's Salon
    
    ---
    This is an automated reminder. Please do not reply directly to this message.
    © ${new Date().getFullYear()} David's Salon. All rights reserved.
  `;

  const result = await sendEmail({
    to: appointmentData.clientEmail,
    subject: `Appointment Reminder: ${formattedDate} at ${formattedTime} - ${branchName}`,
    text: textContent,
    html: htmlContent
  });

  return {
    success: result.success,
    message: result.success ? 'Appointment reminder email sent successfully' : result.error || 'Failed to send email',
    email: appointmentData.clientEmail
  };
};

/**
 * Send password reset email with role passwords
 * @param {Object} userData - User data
 * @param {string} userData.email - User email
 * @param {string} userData.firstName - User first name
 * @param {string} userData.lastName - User last name
 * @param {Object} userData.rolePasswords - Object with role passwords {role: password}
 * @returns {Promise<Object>} Send result
 */
export const sendPasswordResetEmail = async ({ email, firstName, lastName, rolePasswords }) => {
  if (!email) {
    return {
      success: false,
      error: 'Email is required'
    };
  }

  const displayName = `${firstName || ''} ${lastName || ''}`.trim() || 'User';
  
  // Format role passwords
  const rolePasswordsList = Object.entries(rolePasswords || {})
    .map(([role, password]) => {
      const roleLabel = role.charAt(0).toUpperCase() + role.slice(1).replace(/_/g, ' ');
      return `<tr><td style="padding: 8px; font-weight: 600;">${roleLabel}:</td><td style="padding: 8px; font-family: monospace;">${password}</td></tr>`;
    })
    .join('');

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #2D1B4E 0%, #3d2a5f 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { padding: 30px; background-color: #f9fafb; border-radius: 0 0 8px 8px; }
        .password-box { background: white; border: 2px solid #2D1B4E; border-radius: 8px; padding: 20px; margin: 20px 0; }
        .password-table { width: 100%; border-collapse: collapse; }
        .password-table td { padding: 8px; border-bottom: 1px solid #e5e7eb; }
        .password-table tr:last-child td { border-bottom: none; }
        .warning { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 4px; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 0.9em; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🔑 Password Reset</h1>
        </div>
        <div class="content">
          <p>Dear ${displayName},</p>
          
          <p>Your password has been reset. Here are your new role-specific passwords:</p>
          
          <div class="password-box">
            <table class="password-table">
              ${rolePasswordsList}
            </table>
          </div>
          
          <div class="warning">
            <strong>⚠️ Important Security Notice:</strong>
            <ul style="margin: 10px 0; padding-left: 20px;">
              <li>Please change these passwords after your first login</li>
              <li>Do not share these passwords with anyone</li>
              <li>Keep your passwords secure and confidential</li>
            </ul>
          </div>
          
          <p>You can now log in to the David's Salon Management System using your email and the appropriate role password.</p>
          
          <p>If you did not request this password reset, please contact our support team immediately.</p>
          
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
    Password Reset - David's Salon Management System
    
    Dear ${displayName},
    
    Your password has been reset. Here are your new role-specific passwords:
    
    ${Object.entries(rolePasswords || {}).map(([role, password]) => {
      const roleLabel = role.charAt(0).toUpperCase() + role.slice(1).replace(/_/g, ' ');
      return `${roleLabel}: ${password}`;
    }).join('\n')}
    
    ⚠️ Important Security Notice:
    - Please change these passwords after your first login
    - Do not share these passwords with anyone
    - Keep your passwords secure and confidential
    
    You can now log in to the David's Salon Management System using your email and the appropriate role password.
    
    If you did not request this password reset, please contact our support team immediately.
    
    Best regards,
    The David's Salon Team
    
    ---
    This is an automated email. Please do not reply directly to this message.
    © ${new Date().getFullYear()} David's Salon. All rights reserved.
  `;

  const result = await sendEmail({
    to: email,
    subject: 'Password Reset - David\'s Salon Management System',
    text: textContent,
    html: htmlContent
  });

  return {
    success: result.success,
    message: result.success ? 'Password reset email sent successfully' : result.error || 'Failed to send email',
    email: email
  };
};

/**
 * Send profile update notification email
 * @param {Object} userData - User data
 * @param {string} userData.email - User email
 * @param {string} userData.firstName - User first name
 * @param {string} userData.lastName - User last name
 * @param {Array} userData.changes - Array of change descriptions
 * @param {Array} userData.changedFields - Array of changed field names
 * @returns {Promise<Object>} Send result
 */
export const sendProfileUpdateEmail = async ({ email, firstName, lastName, changes, changedFields }) => {
  if (!email) {
    return {
      success: false,
      error: 'Email is required'
    };
  }

  const displayName = `${firstName || ''} ${lastName || ''}`.trim() || 'User';
  
  // Format changes list
  const changesList = (changes || []).map(change => `<li>${change}</li>`).join('');

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #2D1B4E 0%, #3d2a5f 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { padding: 30px; background-color: #f9fafb; border-radius: 0 0 8px 8px; }
        .changes-box { background: white; border: 2px solid #2D1B4E; border-radius: 8px; padding: 20px; margin: 20px 0; }
        .changes-box ul { margin: 10px 0; padding-left: 20px; }
        .changes-box li { margin: 5px 0; }
        .info { background: #dbeafe; border-left: 4px solid #3b82f6; padding: 15px; margin: 20px 0; border-radius: 4px; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 0.9em; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>📝 Profile Updated</h1>
        </div>
        <div class="content">
          <p>Dear ${displayName},</p>
          
          <p>Your profile has been updated in the David's Salon Management System.</p>
          
          ${changes && changes.length > 0 ? `
          <div class="changes-box">
            <h3 style="margin-top: 0; color: #2D1B4E;">Changes Made:</h3>
            <ul>
              ${changesList}
            </ul>
          </div>
          ` : ''}
          
          <div class="info">
            <p><strong>ℹ️ Note:</strong> If you did not make these changes or notice any suspicious activity, please contact our support team immediately.</p>
          </div>
          
          <p>You can view your updated profile by logging into the system.</p>
          
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
    Profile Updated - David's Salon Management System
    
    Dear ${displayName},
    
    Your profile has been updated in the David's Salon Management System.
    
    ${changes && changes.length > 0 ? `Changes Made:\n${changes.map(change => `- ${change}`).join('\n')}\n` : ''}
    
    ℹ️ Note: If you did not make these changes or notice any suspicious activity, please contact our support team immediately.
    
    You can view your updated profile by logging into the system.
    
    Best regards,
    The David's Salon Team
    
    ---
    This is an automated email. Please do not reply directly to this message.
    © ${new Date().getFullYear()} David's Salon. All rights reserved.
  `;

  const result = await sendEmail({
    to: email,
    subject: 'Profile Updated - David\'s Salon',
    text: textContent,
    html: htmlContent
  });

  return {
    success: result.success,
    message: result.success ? 'Profile update email sent successfully' : result.error || 'Failed to send email',
    email: email
  };
};
