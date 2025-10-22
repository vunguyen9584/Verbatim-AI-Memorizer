import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { authService } from '../../services/authService';
import { useToast } from '../common/Toast';

const AuthGate: React.FC = () => {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [tab, setTab] = useState<'google' | 'email'>('google');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dob, setDob] = useState('');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleEmailSubmit = async () => {
    if (!firstName || !lastName || !dob || !email) {
      showToast({ type: 'error', message: t('authGate.validationRequired'), persistent: false });
      return;
    }
    setSubmitting(true);
    try {
      authService.savePendingProfile(email, { firstName, lastName, dateOfBirth: dob });
      await authService.sendEmailLink(email);
      showToast({ type: 'success', message: t('auth.emailLink.sent') });
    } catch (err: any) {
      showToast({ type: 'error', message: err?.message || t('authGate.genericError'), persistent: true });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900">
      <div className="w-full max-w-2xl mx-4 bg-gray-800 rounded-2xl shadow-xl p-6">
        <h2 className="text-2xl font-bold text-white mb-4">{t('authGate.title')}</h2>
        <div className="flex gap-2 mb-6">
          <button
            className={`px-3 py-2 rounded ${tab === 'google' ? 'bg-teal-600 text-white' : 'bg-gray-700 text-gray-200'}`}
            onClick={() => setTab('google')}
          >{t('authGate.googleTab')}</button>
          <button
            className={`px-3 py-2 rounded ${tab === 'email' ? 'bg-teal-600 text-white' : 'bg-gray-700 text-gray-200'}`}
            onClick={() => setTab('email')}
          >{t('authGate.emailTab')}</button>
        </div>

        {tab === 'google' && (
          <div className="flex flex-col gap-4">
            <p className="text-gray-300">{t('authGate.googleDescription')}</p>
            <button
              className="px-4 py-2 bg-teal-600 rounded text-white"
              onClick={async () => {
                try { await authService.signInWithGoogle(); }
                catch (e: any) { showToast({ type: 'error', message: e?.message || t('authGate.genericError'), persistent: true }); }
              }}
            >{t('authGate.continueWithGoogle')}</button>
          </div>
        )}

        {tab === 'email' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-300 mb-1">{t('authGate.firstName')}</label>
              <input className="w-full px-3 py-2 bg-gray-700 rounded" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-1">{t('authGate.lastName')}</label>
              <input className="w-full px-3 py-2 bg-gray-700 rounded" value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-1">{t('authGate.dateOfBirth')}</label>
              <input type="date" className="w-full px-3 py-2 bg-gray-700 rounded" value={dob} onChange={(e) => setDob(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-1">{t('authGate.email')}</label>
              <input className="w-full px-3 py-2 bg-gray-700 rounded" placeholder="email@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="md:col-span-2">
              <button
                className="w-full px-4 py-2 bg-teal-600 rounded text-white disabled:opacity-60"
                disabled={submitting}
                onClick={handleEmailSubmit}
              >{submitting ? t('authGate.sending') : t('authGate.sendActivationLink')}</button>
            </div>
            <p className="md:col-span-2 text-xs text-gray-400">{t('authGate.emailLinkHelp')}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AuthGate;


