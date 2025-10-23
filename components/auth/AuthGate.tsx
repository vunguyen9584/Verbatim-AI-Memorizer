import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { authService } from '../../services/authService';
import { PendingProfile } from '../../types';
import Button from '../common/Button';
import Card from '../common/Card';
import { BrainCircuitIcon } from '../common/Icon';
import { useToast } from '../common/Toast';

type TabType = 'google' | 'email';

const AuthGate: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<TabType>('google');
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [sentToEmail, setSentToEmail] = useState('');

  // Form state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [email, setEmail] = useState('');

  // Validation errors
  const [errors, setErrors] = useState<{
    firstName?: string;
    lastName?: string;
    dateOfBirth?: string;
    email?: string;
  }>({});

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      await authService.signInWithGoogle();
      // Auth state listener will handle navigation
    } catch (error: any) {
      console.error('Google sign-in error:', error);
      showToast({
        type: 'error',
        message: error.message || t('auth.signInError'),
        persistent: true,
      });
    } finally {
      setLoading(false);
    }
  };

  const validateForm = (): boolean => {
    const newErrors: typeof errors = {};

    if (!firstName.trim()) {
      newErrors.firstName = t('auth.firstNameRequired');
    }

    if (!lastName.trim()) {
      newErrors.lastName = t('auth.lastNameRequired');
    }

    if (!dateOfBirth) {
      newErrors.dateOfBirth = t('auth.dateOfBirthRequired');
    } else {
      // Validate age (must be at least 13 years old)
      const birthDate = new Date(dateOfBirth);
      const today = new Date();
      const age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      const actualAge =
        monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())
          ? age - 1
          : age;

      if (actualAge < 13) {
        newErrors.dateOfBirth = t('auth.mustBe13OrOlder');
      }
    }

    if (!email.trim()) {
      newErrors.email = t('auth.emailRequired');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = t('auth.invalidEmail');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      const pendingProfile: PendingProfile = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        dateOfBirth,
        email: email.trim().toLowerCase(),
      };

      await authService.sendEmailLink(pendingProfile.email, pendingProfile);
      
      setEmailSent(true);
      setSentToEmail(pendingProfile.email);
      
      showToast({
        type: 'success',
        message: t('auth.activationLinkSent'),
      });
    } catch (error: any) {
      console.error('Email sign-up error:', error);
      showToast({
        type: 'error',
        message: error.message || t('auth.errorSendingLink'),
        persistent: true,
      });
    } finally {
      setLoading(false);
    }
  };

  if (emailSent) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-teal-900 flex items-center justify-center p-4">
        <Card className="max-w-md w-full bg-gray-800 shadow-2xl">
          <div className="p-8">
            <div className="flex justify-end mb-4">
              <div className="flex items-center gap-2">
                <button onClick={() => i18n.changeLanguage('en')} className={`px-2 py-1 text-xs rounded ${i18n.language === 'en' ? 'bg-teal-500 text-white' : 'bg-gray-700 text-gray-200'}`}>EN</button>
                <button onClick={() => i18n.changeLanguage('vi')} className={`px-2 py-1 text-xs rounded ${i18n.language === 'vi' ? 'bg-teal-500 text-white' : 'bg-gray-700 text-gray-200'}`}>VI</button>
              </div>
            </div>
            <div className="text-center">
            <div className="mb-6">
              <div className="w-20 h-20 bg-teal-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-10 h-10 text-teal-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">
                {t('auth.activationLinkSent')}
              </h2>
              <p className="text-gray-400">
                {t('auth.activationLinkSentDesc', { email: sentToEmail })}
              </p>
            </div>
            <Button
              onClick={() => {
                setEmailSent(false);
                setSentToEmail('');
              }}
              variant="secondary"
              className="w-full"
            >
              {t('lessonForm.close')}
            </Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-teal-900 flex items-center justify-center p-4">
      <Card className="max-w-md w-full bg-gray-800 shadow-2xl">
        <div className="p-8">
          <div className="flex justify-end mb-4">
            <div className="flex items-center gap-2">
              <button onClick={() => i18n.changeLanguage('en')} className={`px-2 py-1 text-xs rounded ${i18n.language === 'en' ? 'bg-teal-500 text-white' : 'bg-gray-700 text-gray-200'}`}>EN</button>
              <button onClick={() => i18n.changeLanguage('vi')} className={`px-2 py-1 text-xs rounded ${i18n.language === 'vi' ? 'bg-teal-500 text-white' : 'bg-gray-700 text-gray-200'}`}>VI</button>
            </div>
          </div>
          {/* Header */}
          <div className="text-center mb-8">
            <BrainCircuitIcon className="w-16 h-16 text-teal-400 mx-auto mb-4" />
            <h1 className="text-3xl font-bold text-white mb-2">
              {t('auth.authGateTitle')}
            </h1>
            <p className="text-gray-400">{t('auth.authGateSubtitle')}</p>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => setActiveTab('google')}
              className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
                activeTab === 'google'
                  ? 'bg-teal-500 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {t('auth.tabGoogle')}
            </button>
            <button
              onClick={() => setActiveTab('email')}
              className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
                activeTab === 'email'
                  ? 'bg-teal-500 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {t('auth.tabEmail')}
            </button>
          </div>

          {/* Tab Content */}
          {activeTab === 'google' ? (
            <div className="space-y-4">
              <Button
                onClick={handleGoogleSignIn}
                disabled={loading}
                variant="secondary"
                className="w-full !bg-white !text-gray-900 hover:!bg-gray-100 flex items-center justify-center gap-3 py-3 border border-gray-300"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                {loading ? t('auth.sending') : t('auth.googleSignIn')}
              </Button>
              <p className="text-xs text-gray-500 text-center">
                {t('auth.authGateSubtitle')}
              </p>
            </div>
          ) : (
            <form onSubmit={handleEmailSignUp} className="space-y-4">
              {/* First Name */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  {t('auth.firstNameLabel')}
                </label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => {
                    setFirstName(e.target.value);
                    if (errors.firstName) {
                      setErrors({ ...errors, firstName: undefined });
                    }
                  }}
                  placeholder={t('auth.firstNamePlaceholder')}
                  className={`w-full px-4 py-2 bg-gray-700 border ${
                    errors.firstName ? 'border-red-500' : 'border-gray-600'
                  } rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500`}
                />
                {errors.firstName && (
                  <p className="text-red-500 text-xs mt-1">{errors.firstName}</p>
                )}
              </div>

              {/* Last Name */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  {t('auth.lastNameLabel')}
                </label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => {
                    setLastName(e.target.value);
                    if (errors.lastName) {
                      setErrors({ ...errors, lastName: undefined });
                    }
                  }}
                  placeholder={t('auth.lastNamePlaceholder')}
                  className={`w-full px-4 py-2 bg-gray-700 border ${
                    errors.lastName ? 'border-red-500' : 'border-gray-600'
                  } rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500`}
                />
                {errors.lastName && (
                  <p className="text-red-500 text-xs mt-1">{errors.lastName}</p>
                )}
              </div>

              {/* Date of Birth */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  {t('auth.dateOfBirthLabel')}
                </label>
                <input
                  type="date"
                  value={dateOfBirth}
                  onChange={(e) => {
                    setDateOfBirth(e.target.value);
                    if (errors.dateOfBirth) {
                      setErrors({ ...errors, dateOfBirth: undefined });
                    }
                  }}
                  className={`w-full px-4 py-2 bg-gray-700 border ${
                    errors.dateOfBirth ? 'border-red-500' : 'border-gray-600'
                  } rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500`}
                />
                {errors.dateOfBirth && (
                  <p className="text-red-500 text-xs mt-1">{errors.dateOfBirth}</p>
                )}
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  {t('auth.emailLabel')}
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (errors.email) {
                      setErrors({ ...errors, email: undefined });
                    }
                  }}
                  placeholder={t('auth.emailPlaceholder')}
                  className={`w-full px-4 py-2 bg-gray-700 border ${
                    errors.email ? 'border-red-500' : 'border-gray-600'
                  } rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500`}
                />
                {errors.email && (
                  <p className="text-red-500 text-xs mt-1">{errors.email}</p>
                )}
              </div>

              <Button type="submit" disabled={loading} className="w-full">
                {loading ? t('auth.sending') : t('auth.sendActivationLink')}
              </Button>
            </form>
          )}
        </div>
      </Card>
    </div>
  );
};

export default AuthGate;

