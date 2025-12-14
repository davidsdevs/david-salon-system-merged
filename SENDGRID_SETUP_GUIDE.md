# SendGrid API Key Setup Guide

This guide will walk you through the process of obtaining a SendGrid API key for email functionality in the David's Salon Management System.

## Overview

SendGrid is used to send transactional emails such as:
- Password reset notifications
- User account creation emails
- Account activation/deactivation notifications
- Promotion emails
- Purchase order emails

---

## Step 1: Create a SendGrid Account

1. **Visit SendGrid Website**
   - Go to [https://sendgrid.com](https://sendgrid.com)
   - Click **"Start for Free"** or **"Sign Up"**

2. **Sign Up Process**
   - Enter your email address
   - Create a password
   - Fill in your company information
   - Verify your email address

3. **Complete Account Setup**
   - SendGrid offers a free tier (100 emails/day forever)
   - For production use, you may need a paid plan

---

## Step 2: Verify Your Sender Identity

Before you can send emails, SendGrid requires you to verify your sender identity:

### Option A: Single Sender Verification (Recommended for Testing)

1. **Navigate to Settings**
   - Go to **Settings** → **Sender Authentication**
   - Click **"Verify a Single Sender"**

2. **Fill in Sender Information**
   - **From Email**: Enter the email address you want to send from (e.g., `noreply@davidsalon.com`)
   - **From Name**: Enter your business name (e.g., "David's Salon")
   - **Reply To**: Enter a valid email for replies
   - **Company Address**: Enter your business address
   - **City, State, ZIP**: Enter your location details
   - **Country**: Select your country

3. **Verify Email**
   - Check the email inbox for the verification email
   - Click the verification link in the email
   - Your sender is now verified

### Option B: Domain Authentication (Recommended for Production)

1. **Navigate to Settings**
   - Go to **Settings** → **Sender Authentication**
   - Click **"Authenticate Your Domain"**

2. **Enter Domain Information**
   - Enter your domain (e.g., `davidsalon.com`)
   - Select your DNS host

3. **Add DNS Records**
   - SendGrid will provide DNS records (CNAME records)
   - Add these records to your domain's DNS settings
   - Wait for verification (can take up to 48 hours)

---

## Step 3: Create an API Key

1. **Navigate to API Keys**
   - Go to **Settings** → **API Keys**
   - Click **"Create API Key"**

2. **Configure API Key**
   - **API Key Name**: Give it a descriptive name (e.g., "David's Salon System")
   - **API Key Permissions**: Select **"Full Access"** (or **"Restricted Access"** with Mail Send permissions)
   - Click **"Create & View"**

3. **Copy Your API Key**
   - ⚠️ **IMPORTANT**: Copy the API key immediately
   - You will NOT be able to see it again after closing this window
   - The API key will look like: `SG.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

---

## Step 4: Configure Environment Variables

1. **Create/Edit `.env` File**
   - In your project root directory, create or edit the `.env` file
   - If the file doesn't exist, create it

2. **Add SendGrid Configuration**
   ```env
   VITE_SENDGRID_API_KEY=SG.your_actual_api_key_here
   VITE_SENDGRID_FROM_EMAIL=noreply@davidsalon.com
   ```

3. **Replace Placeholders**
   - Replace `SG.your_actual_api_key_here` with your actual API key from Step 3
   - Replace `noreply@davidsalon.com` with your verified sender email

4. **Save the File**
   - Make sure to save the `.env` file

---

## Step 5: Restart Your Development Server

After adding environment variables:

1. **Stop your development server** (if running)
   - Press `Ctrl+C` in the terminal

2. **Start the server again**
   ```bash
   npm run dev
   ```

   Environment variables are loaded when the server starts, so you need to restart.

---

## Step 6: Test Email Functionality

1. **Test Password Reset**
   - Go to System Admin → Users
   - Click "Reset Password" for a test user
   - Check the user's email inbox

2. **Check SendGrid Activity**
   - Go to SendGrid Dashboard → **Activity**
   - You should see email delivery status
   - Green checkmarks indicate successful sends

---

## Troubleshooting

### Issue: "SendGrid API key not configured" Warning

**Solution:**
- Check that `.env` file exists in project root
- Verify `VITE_SENDGRID_API_KEY` is spelled correctly
- Make sure you restarted the dev server after adding the key
- Check that the API key starts with `SG.`

### Issue: "Email not sent" or "Failed to send email"

**Possible Causes:**
1. **Unverified Sender**
   - Make sure you verified your sender email/domain in SendGrid
   - Check SendGrid dashboard → Settings → Sender Authentication

2. **Invalid API Key**
   - Verify the API key is correct
   - Check that the API key has "Mail Send" permissions

3. **Rate Limits**
   - Free tier: 100 emails/day
   - Check your usage in SendGrid dashboard

4. **Email Address Issues**
   - Verify the recipient email is valid
   - Check spam/junk folder

### Issue: Emails Going to Spam

**Solutions:**
- Use domain authentication instead of single sender verification
- Set up SPF, DKIM, and DMARC records
- Avoid spam trigger words in subject/content
- Use a professional email address

---

## Security Best Practices

1. **Never Commit API Keys**
   - ⚠️ **NEVER** commit `.env` files to Git
   - Add `.env` to `.gitignore`
   - Use environment variables in production

2. **Rotate API Keys Regularly**
   - Periodically create new API keys
   - Delete old unused keys

3. **Use Restricted Permissions**
   - For production, use "Restricted Access" with only "Mail Send" permission
   - This limits damage if the key is compromised

4. **Monitor API Usage**
   - Regularly check SendGrid dashboard for unusual activity
   - Set up alerts for suspicious activity

---

## Production Deployment

### For Vercel/Netlify:

1. **Add Environment Variables**
   - Go to your deployment platform's dashboard
   - Navigate to Settings → Environment Variables
   - Add:
     - `VITE_SENDGRID_API_KEY`: Your API key
     - `VITE_SENDGRID_FROM_EMAIL`: Your verified email

2. **Redeploy**
   - Trigger a new deployment after adding variables

### For Other Platforms:

- Add the same environment variables in your platform's configuration
- Make sure the variables are prefixed with `VITE_` for Vite projects

---

## SendGrid Pricing

- **Free Tier**: 100 emails/day forever
- **Essentials Plan**: $19.95/month - 50,000 emails/month
- **Pro Plan**: $89.95/month - 100,000 emails/month
- **Premier Plan**: Custom pricing

For most small to medium businesses, the free tier or Essentials plan is sufficient.

---

## Additional Resources

- [SendGrid Documentation](https://docs.sendgrid.com/)
- [SendGrid API Reference](https://docs.sendgrid.com/api-reference)
- [SendGrid Best Practices](https://docs.sendgrid.com/ui/sending-email/best-practices)
- [SendGrid Support](https://support.sendgrid.com/)

---

## Quick Reference

**Environment Variables Needed:**
```env
VITE_SENDGRID_API_KEY=SG.your_api_key_here
VITE_SENDGRID_FROM_EMAIL=your_verified_email@domain.com
```

**Where to Find API Key:**
- SendGrid Dashboard → Settings → API Keys

**Where to Verify Sender:**
- SendGrid Dashboard → Settings → Sender Authentication

---

## Support

If you encounter issues:
1. Check SendGrid dashboard for error messages
2. Review SendGrid activity logs
3. Check browser console for errors
4. Verify environment variables are set correctly
5. Contact SendGrid support if needed

---

**Last Updated:** December 2024




