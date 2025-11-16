/**
 * Client Registration Page
 * Public page for client self-registration
 */

import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, AlertCircle, CheckCircle } from 'lucide-react';
import { createUserWithEmailAndPassword, sendEmailVerification, updateProfile } from 'firebase/auth';
import { doc, setDoc, Timestamp } from 'firebase/firestore';
import { auth, db } from '../../config/firebase';
import { logActivity } from '../../services/activityService';
import { sendWelcomeEmail } from '../../services/emailService';
import { processReferral, validateReferralCode } from '../../services/referralService';
import { USER_ROLES } from '../../utils/constants';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import Navigation from '../../components/landing/Navigation';
import Footer from '../../components/landing/Footer';

const Register = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  // Get referral code from URL params (if shared via referral link)
  const urlReferralCode = searchParams.get('ref');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [formData, setFormData] = useState({
    firstName: '',
    middleName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    referralCode: ''
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear error when user starts typing
    if (error) {
      setError('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate passwords match
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    // Validate password strength (FR5 requirement)
    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    // Check for at least one number
    if (!/\d/.test(formData.password)) {
      setError('Password must contain at least one number');
      return;
    }

    // Check for at least one special character
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(formData.password)) {
      setError('Password must contain at least one special character');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    // Validate referral code BEFORE creating account
    const referralCodeToProcess = formData.referralCode || urlReferralCode;
    if (referralCodeToProcess) {
      try {
        const validationResult = await validateReferralCode(referralCodeToProcess);
        if (!validationResult.valid) {
          setError(validationResult.message || 'Invalid referral code. Please check and try again.');
          setLoading(false);
          return;
        }
      } catch (validationError) {
        console.error('Error validating referral code:', validationError);
        setError('Error validating referral code. Please try again.');
        setLoading(false);
        return;
      }
    }

    try {
      // Create Firebase Auth account
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        formData.email,
        formData.password
      );

      const user = userCredential.user;

      // Build full name for Firebase Auth
      const fullName = `${formData.firstName}${formData.middleName ? ' ' + formData.middleName.charAt(0) + '.' : ''} ${formData.lastName}`.trim();

      // Update display name in Firebase Auth
      await updateProfile(user, {
        displayName: fullName
      });

      // Send email verification
      await sendEmailVerification(user);

      // Create Firestore user document
      await setDoc(doc(db, 'users', user.uid), {
        email: formData.email,
        firstName: formData.firstName,
        middleName: formData.middleName || '',
        lastName: formData.lastName,
        phone: formData.phone,
        roles: [USER_ROLES.CLIENT], // Use roles array instead of single role
        branchId: null,
        isActive: true,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      });

      // Process referral code if provided (branch ID is automatically determined from referral code)
      const referralCodeToProcess = formData.referralCode || urlReferralCode;
      
      if (referralCodeToProcess) {
        try {
          // processReferral will automatically find the branch ID from the referral code
          const referralResult = await processReferral(
            user.uid,
            referralCodeToProcess,
            null, // branchId will be determined from referral code
            { uid: user.uid, displayName: fullName }
          );
          
          if (referralResult.success) {
            console.log('✅ Referral processed successfully:', referralResult);
          } else {
            console.warn('⚠️ Referral processing failed:', referralResult.message);
            // Don't fail registration if referral fails
          }
        } catch (referralError) {
          console.error('Error processing referral:', referralError);
          // Don't fail registration if referral fails
        }
      }

      // Send custom welcome email (async, don't wait)
      sendWelcomeEmail({
        email: formData.email,
        displayName: fullName,
        role: 'Client'
      }).catch(err => console.error('Welcome email error:', err));

      setSuccess('Account created successfully! Please check your email to verify your account.');
      
      // Redirect to login after a short delay
      setTimeout(() => {
        navigate('/login');
      }, 3000);

    } catch (error) {
      console.error('Registration error:', error);

      if (error.code === 'auth/email-already-in-use') {
        setError('Email address is already registered');
      } else if (error.code === 'auth/weak-password') {
        setError('Password is too weak');
      } else if (error.code === 'auth/invalid-email') {
        setError('Invalid email address');
      } else {
        setError('Registration failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white pt-[122px]">
      {/* Header */}
      <Navigation />

      {/* Main Content */}
      <div className="flex items-center justify-center pt-8 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <h2 className="mt-6 text-center text-3xl font-extrabold text-[#160B53]">
            Create Your Account
            </h2>
            <p className="mt-2 text-center text-sm text-gray-600">
            Join David's Salon Management System
          </p>
        </div>

          <Card className="p-8 border-0" style={{ boxShadow: '0 2px 15px 0 rgba(0, 0, 0, 0.25)' }}>
            <form className="space-y-6" onSubmit={handleSubmit}>
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-md p-4">
                  <div className="flex">
                    <AlertCircle className="h-5 w-5 text-red-400" />
                    <div className="ml-3">
                      <p className="text-sm text-red-800">{error}</p>
                    </div>
                  </div>
                </div>
              )}

              {success && (
                <div className="bg-green-50 border border-green-200 rounded-md p-4">
                  <div className="flex">
                    <CheckCircle className="h-5 w-5 text-green-400" />
                    <div className="ml-3">
                      <p className="text-sm text-green-800">{success}</p>
                    </div>
                  </div>
                </div>
              )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-2">
                    First Name *
                </label>
                  <Input
                    id="firstName"
                    name="firstName"
                    type="text"
                    autoComplete="given-name"
                    required
                    placeholder="First name"
                    value={formData.firstName}
                    onChange={handleChange}
                  />
              </div>

              <div>
                <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-2">
                    Last Name *
                </label>
                  <Input
                    id="lastName"
                    name="lastName"
                    type="text"
                    autoComplete="family-name"
                    required
                    placeholder="Last name"
                    value={formData.lastName}
                    onChange={handleChange}
                  />
              </div>
            </div>

            <div>
              <label htmlFor="middleName" className="block text-sm font-medium text-gray-700 mb-2">
                Middle Name <span className="text-gray-400 text-xs">(Optional)</span>
              </label>
                <Input
                  id="middleName"
                  name="middleName"
                  type="text"
                  autoComplete="additional-name"
                  placeholder="Middle name"
                  value={formData.middleName}
                  onChange={handleChange}
                />
            </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email Address
              </label>
                  <Input
                  id="email"
                  name="email"
                    type="email"
                    autoComplete="email"
                    required
                    placeholder="Enter your email"
                  value={formData.email}
                  onChange={handleChange}
                />
            </div>

            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
                Phone Number
              </label>
                  <Input
                  id="phone"
                  name="phone"
                    type="tel"
                    placeholder="Enter your phone number"
                  value={formData.phone}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <div className="relative">
                  <Input
                  id="password"
                  name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    required
                    placeholder="Enter your password"
                  value={formData.password}
                  onChange={handleChange}
                    className="pr-12"
                />
                <button
                  type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                      <EyeOff className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                  ) : (
                      <Eye className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                  )}
                </button>
              </div>
                <p className="mt-1 text-xs text-gray-500">
                  Password must be at least 8 characters long
                </p>
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
                Confirm Password
              </label>
              <div className="relative">
                  <Input
                  id="confirmPassword"
                  name="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    required
                    placeholder="Confirm your password"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                    className="pr-12"
                />
                <button
                  type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? (
                      <EyeOff className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                  ) : (
                      <Eye className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                  )}
                </button>
              </div>
            </div>

            {/* Referral Code Field (Optional) */}
            <div>
              <label htmlFor="referralCode" className="block text-sm font-medium text-gray-700 mb-2">
                Referral Code <span className="text-gray-400 text-xs">(Optional)</span>
              </label>
              <Input
                id="referralCode"
                name="referralCode"
                type="text"
                placeholder="Enter referral code"
                value={formData.referralCode || urlReferralCode || ''}
                onChange={handleChange}
                className="uppercase"
              />
              <p className="mt-1 text-xs text-gray-500">
                Have a referral code? Enter it here to earn bonus points! The branch will be automatically determined from the code.
              </p>
            </div>

              <div>
                <Button
              type="submit"
                  className="w-full bg-[#160B53] hover:bg-[#160B53]/90 text-white"
              disabled={loading}
                >
                  {loading ? 'Creating account...' : 'Create account'}
                </Button>
              </div>

              <div className="text-center">
            <p className="text-sm text-gray-600">
              Already have an account?{' '}
              <Link
                to="/login"
                    className="font-medium text-[#160B53] hover:text-[#160B53]/80"
              >
                Sign in
              </Link>
            </p>
          </div>

              {/* Terms */}
              <p className="text-xs text-gray-500 text-center">
                By creating an account, you agree to our{' '}
                <a href="#" className="text-[#160B53] hover:underline">
                  Terms of Service
                </a>{' '}
                and{' '}
                <a href="#" className="text-[#160B53] hover:underline">
                  Privacy Policy
                </a>
              </p>
            </form>
          </Card>
        </div>
      </div>

      {/* Footer */}
      <Footer />
    </div>
  );
};

export default Register;
