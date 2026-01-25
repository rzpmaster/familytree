import { useSettings } from '@/hooks/useSettings';
import { Check, Focus, Globe } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

const Settings: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { state, actions } = useSettings();
  const { focusModeEnabled, focusRelations } = state;

  const changeLanguage = (lng: string) => {
    actions.setLanguage(lng);
  };

  const toggleRelation = (key: keyof typeof focusRelations) => {
    if (key === 'self') return;
    actions.toggleFocusRelation(key);
  };

  return (
    <div className="p-8 max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-800 mb-8">{t('common.settings', { defaultValue: 'Settings' })}</h1>

      {/* Language Settings */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-gray-800">
            <Globe size={20} className="text-blue-600" />
            {t('settings.language', { defaultValue: 'Language' })}
        </h2>
        
        <div className="flex gap-4">
            <button
                onClick={() => changeLanguage('en')}
                className={`px-4 py-2 rounded-md border transition-colors ${i18n.language === 'en' ? 'bg-blue-50 border-blue-500 text-blue-700 font-medium' : 'hover:bg-gray-50 text-gray-600'}`}
            >
                English
            </button>
            <button
                onClick={() => changeLanguage('zh')}
                className={`px-4 py-2 rounded-md border transition-colors ${i18n.language === 'zh' ? 'bg-blue-50 border-blue-500 text-blue-700 font-medium' : 'hover:bg-gray-50 text-gray-600'}`}
            >
                中文 (Chinese)
            </button>
        </div>
      </div>

      {/* Focus Mode Settings */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex justify-between items-start mb-4">
            <div>
                <h2 className="text-lg font-semibold flex items-center gap-2 text-gray-800">
                    <Focus size={20} className="text-purple-600" />
                    {t('settings.focus_mode', { defaultValue: 'Focus Mode' })}
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                    {t('settings.focus_mode_desc', { defaultValue: 'Highlight related members when selecting a person' })}
                </p>
            </div>
            <div className="flex items-center">
                <button 
                    onClick={() => actions.setFocusMode(!focusModeEnabled)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${focusModeEnabled ? 'bg-purple-600' : 'bg-gray-200'}`}
                >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${focusModeEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
            </div>
        </div>

        {focusModeEnabled && (
            <div className="mt-6 border-t pt-4">
                <h3 className="text-sm font-medium text-gray-700 mb-3">
                    {t('settings.focus_relations', { defaultValue: 'Focus Relationships' })}
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {[
                        { key: 'self', label: 'relation.role_self' },
                        { key: 'father', label: 'relation.role_father' },
                        { key: 'mother', label: 'relation.role_mother' },
                        { key: 'spouse', label: 'relation.role_spouse' },
                        { key: 'son', label: 'relation.role_son' },
                        { key: 'daughter', label: 'relation.role_daughter' },
                    ].map(({ key, label }) => {
                        const isSelf = key === 'self';
                        const isActive = focusRelations[key as keyof typeof focusRelations];
                        
                        return (
                            <button
                                key={key}
                                onClick={() => toggleRelation(key as keyof typeof focusRelations)}
                                disabled={isSelf}
                                className={`flex items-center justify-between px-3 py-2 rounded-md border text-sm transition-colors ${
                                    isActive 
                                        ? isSelf 
                                            ? 'bg-gray-100 border-gray-300 text-gray-500 cursor-not-allowed' // Disabled style for Self
                                            : 'bg-purple-50 border-purple-200 text-purple-700' 
                                        : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100'
                                }`}
                            >
                                <span>{t(label)}</span>
                                {isActive && <Check size={14} />}
                            </button>
                        );
                    })}
                </div>
            </div>
        )}
      </div>
    </div>
  );
};

export default Settings;
