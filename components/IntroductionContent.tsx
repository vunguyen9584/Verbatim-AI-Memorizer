import React from 'react';
import { useTranslation, Trans } from 'react-i18next';

const IntroductionContent: React.FC<{ compact?: boolean }>= ({ compact = false }) => {
  const { t } = useTranslation();

  return (
    <section className={`w-full ${compact ? 'max-w-4xl' : 'max-w-5xl'} mx-auto text-gray-100`}> 
      <div className="bg-gray-800/60 rounded-2xl shadow-lg p-6 md:p-8">
        <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">
          {t('introduction.title')}
        </h2>
        <p className="text-gray-300 mb-6">{t('introduction.subtitle')}</p>

        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-xl font-semibold text-teal-400 mb-2">{t('introduction.whoTitle')}</h3>
            <ul className="list-disc list-inside text-gray-300 space-y-1">
              <li>{t('introduction.who1')}</li>
              <li>{t('introduction.who2')}</li>
              <li>{t('introduction.who3')}</li>
              <li>{t('introduction.who4')}</li>
              <li>{t('introduction.who5')}</li>
            </ul>
          </div>

          <div>
            <h3 className="text-xl font-semibold text-teal-400 mb-2">{t('introduction.howTitle')}</h3>
            <ol className="list-decimal list-inside text-gray-300 space-y-1">
              <li>{t('introduction.how1')}</li>
              <li>{t('introduction.how2')}</li>
              <li>{t('introduction.how3')}</li>
              <li>{t('introduction.how4')}</li>
            </ol>
          </div>
        </div>

        <div className="mt-6 grid md:grid-cols-2 gap-6">
          <div className="bg-gray-900/50 rounded-xl p-5">
            <h4 className="text-lg font-semibold text-white">{t('introduction.modes.quiz.title')}</h4>
            <p className="text-gray-400 mb-2">{t('introduction.modes.quiz.desc')}</p>
            <ul className="text-gray-300 list-disc list-inside space-y-1">
              <li>{t('introduction.modes.quiz.b1')}</li>
              <li>{t('introduction.modes.quiz.b2')}</li>
              <li>{t('introduction.modes.quiz.b3')}</li>
            </ul>
          </div>
          <div className="bg-gray-900/50 rounded-xl p-5">
            <h4 className="text-lg font-semibold text-white">{t('introduction.modes.play.title')}</h4>
            <p className="text-gray-400">{t('introduction.modes.play.desc')}</p>
          </div>
          <div className="bg-gray-900/50 rounded-xl p-5">
            <h4 className="text-lg font-semibold text-white">{t('introduction.modes.coPlay.title')}</h4>
            <p className="text-gray-400">{t('introduction.modes.coPlay.desc')}</p>
          </div>
          <div className="bg-gray-900/50 rounded-xl p-5">
            <h4 className="text-lg font-semibold text-white">{t('introduction.modes.memoryTips.title')}</h4>
            <p className="text-gray-400">{t('introduction.modes.memoryTips.desc')}</p>
          </div>
        </div>

        <div className="mt-6">
          <h3 className="text-xl font-semibold text-teal-400 mb-2">{t('introduction.manageTitle')}</h3>
          <ul className="list-disc list-inside text-gray-300 space-y-1">
            <li>{t('introduction.manage1')}</li>
            <li>{t('introduction.manage2')}</li>
            <li>{t('introduction.manage3')}</li>
          </ul>
        </div>

        <div className="mt-6 text-gray-400">
          <Trans i18nKey="introduction.footer">
            Data syncs securely to your account. You can practice on any device.
          </Trans>
        </div>
      </div>
    </section>
  );
};

export default IntroductionContent;
