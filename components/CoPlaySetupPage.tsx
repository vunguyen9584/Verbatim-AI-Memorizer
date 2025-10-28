import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Button from './common/Button';
import { ArrowLeftIcon } from './common/Icon';
import { CoPlayModeType, CoPlayModeOption } from '../types';
import { parseSentences } from '../utils/sentenceParser';

interface CoPlaySetupPageProps {
  text: string;
  tokens: string[];
}

const CoPlaySetupPage: React.FC<CoPlaySetupPageProps> = ({ tokens }) => {
  const { t } = useTranslation();
  const totalSentences = useMemo(() => parseSentences(tokens).length, [tokens]);
  const [modeOption, setModeOption] = useState<CoPlayModeOption>({
    type: CoPlayModeType.AppFirstN,
    appSentences: 1,
    userSentences: 1,
    startSentence: 1,
    endSentence: totalSentences || 1,
  });

  const goBack = () => { window.location.hash = ''; };

  const handleModeChange = (type: CoPlayModeType) => {
    setModeOption(prev => ({ ...prev, type }));
  };

  const handleAppChange = (v: string) => {
    const n = parseInt(v, 10);
    setModeOption(prev => ({ ...prev, appSentences: Number.isFinite(n) && n > 0 ? n : 1 }));
  };
  const handleUserChange = (v: string) => {
    const n = parseInt(v, 10);
    setModeOption(prev => ({ ...prev, userSentences: Number.isFinite(n) && n > 0 ? n : 1 }));
  };
  const toggleAppAll = () => {
    setModeOption(prev => ({ ...prev, appSentences: prev.appSentences === 'all' ? 1 : 'all' }));
  };
  const toggleUserAll = () => {
    setModeOption(prev => ({ ...prev, userSentences: prev.userSentences === 'all' ? 1 : 'all' }));
  };
  const setStart = (v: string) => {
    const n = Math.max(1, parseInt(v, 10) || 1);
    setModeOption(prev => ({ ...prev, startSentence: Math.min(n, prev.endSentence) }));
  };
  const setEnd = (v: string) => {
    const n = Math.max(1, parseInt(v, 10) || 1);
    setModeOption(prev => ({ ...prev, endSentence: Math.max(n, prev.startSentence) }));
  };

  const handleStart = () => {
    const params = new URLSearchParams();
    params.set('type', modeOption.type);
    params.set('start', String(modeOption.startSentence));
    params.set('end', String(modeOption.endSentence));
    params.set('app', String(modeOption.appSentences));
    params.set('user', String(modeOption.userSentences));
    window.location.hash = `#/co-play?${params.toString()}`;
  };

  return (
    <div className="min-h-dvh bg-gray-900 text-gray-100 flex flex-col">
      <div className="sticky top-0 z-10 bg-gray-900/80 backdrop-blur border-b border-gray-800 p-3">
        <Button variant="secondary" size="sm" onClick={goBack} className="gap-2">
          <ArrowLeftIcon className="w-4 h-4" aria-hidden="true" />
          {t('coPlay.backToModes')}
        </Button>
      </div>
      <div className="flex-1 p-4 md:p-6">
        <h2 className="text-2xl font-bold text-teal-400 mb-4">{t('coPlay.setupTitle')}</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-gray-300 mb-2">{t('coPlay.selectMode')}</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Button onClick={() => handleModeChange(CoPlayModeType.AppFirstN)} variant={modeOption.type === CoPlayModeType.AppFirstN ? 'primary' : 'secondary'}>{t('coPlay.appFirst')}</Button>
              <Button onClick={() => handleModeChange(CoPlayModeType.UserFirstN)} variant={modeOption.type === CoPlayModeType.UserFirstN ? 'primary' : 'secondary'}>{t('coPlay.userFirst')}</Button>
              <Button onClick={() => handleModeChange(CoPlayModeType.AppFirstRandom)} variant={modeOption.type === CoPlayModeType.AppFirstRandom ? 'primary' : 'secondary'}>{t('coPlay.appFirstRandom')}</Button>
              <Button onClick={() => handleModeChange(CoPlayModeType.UserFirstRandom)} variant={modeOption.type === CoPlayModeType.UserFirstRandom ? 'primary' : 'secondary'}>{t('coPlay.userFirstRandom')}</Button>
            </div>
          </div>
          {[CoPlayModeType.AppFirstN, CoPlayModeType.UserFirstN].includes(modeOption.type) && (
            <div className="space-y-4">
              <div className="border-b border-gray-700 pb-4">
                <h3 className="text-lg font-semibold text-gray-300 mb-3">{t('coPlay.sentenceRange')}</h3>
                <div className="flex flex-wrap items-end gap-2">
                  <div>
                    <label htmlFor="start-sentence" className="block text-gray-300 mb-1 text-sm">{t('coPlay.fromSentence')}</label>
                    <input id="start-sentence" type="number" min="1" max={totalSentences} value={modeOption.startSentence} onChange={e => setStart(e.target.value)} className="w-24 bg-gray-800 border border-gray-600 rounded p-2" />
                  </div>
                  <div>
                    <label htmlFor="end-sentence" className="block text-gray-300 mb-1 text-sm">{t('coPlay.toSentence')}</label>
                    <input id="end-sentence" type="number" min="1" max={totalSentences} value={modeOption.endSentence} onChange={e => setEnd(e.target.value)} className="w-24 bg-gray-800 border border-gray-600 rounded p-2" />
                  </div>
                  <div className="text-sm text-gray-400 w-full sm:w-auto pt-1 sm:pt-0 sm:pb-1 sm:ml-auto text-left sm:text-right">({t('coPlay.totalSentences', { total: totalSentences })})</div>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="app-sentences" className="block text-gray-300 mb-1">{t('coPlay.appSentences')}</label>
                  <div className="flex items-center gap-3">
                    <input id="app-sentences" type="number" min="1" value={modeOption.appSentences === 'all' ? '' : modeOption.appSentences} onChange={e => handleAppChange(e.target.value)} disabled={modeOption.appSentences === 'all'} placeholder={modeOption.appSentences === 'all' ? t('coPlay.allSentences') : undefined} className="w-28 bg-gray-800 border border-gray-600 rounded p-2 disabled:opacity-70" />
                    <label className="flex items-center gap-2 text-sm text-gray-400">
                      <input type="checkbox" className="accent-teal-500" checked={modeOption.appSentences === 'all'} onChange={toggleAppAll} />
                      {t('coPlay.all')}
                    </label>
                  </div>
                </div>
                <div>
                  <label htmlFor="user-sentences" className="block text-gray-300 mb-1">{t('coPlay.userSentences')}</label>
                  <div className="flex items-center gap-3">
                    <input id="user-sentences" type="number" min="1" value={modeOption.userSentences === 'all' ? '' : modeOption.userSentences} onChange={e => handleUserChange(e.target.value)} disabled={modeOption.userSentences === 'all'} placeholder={modeOption.userSentences === 'all' ? t('coPlay.allSentences') : undefined} className="w-28 bg-gray-800 border border-gray-600 rounded p-2 disabled:opacity-70" />
                    <label className="flex items-center gap-2 text-sm text-gray-400">
                      <input type="checkbox" className="accent-teal-500" checked={modeOption.userSentences === 'all'} onChange={toggleUserAll} />
                      {t('coPlay.all')}
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}
          <Button onClick={handleStart} variant="primary" size="lg">{t('coPlay.start')}</Button>
        </div>
      </div>
    </div>
  );
};

export default CoPlaySetupPage;
