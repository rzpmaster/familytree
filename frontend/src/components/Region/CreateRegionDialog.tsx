import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

interface CreateRegionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (name: string, description: string, color: string) => void;
  selectedCount: number;
}

const CreateRegionDialog: React.FC<CreateRegionDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  selectedCount,
}) => {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#EBF8FF');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onConfirm(name, description, color);
      setName('');
      setDescription('');
      setColor('#EBF8FF');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl p-6 w-96">
        <h2 className="text-xl font-bold mb-4">{t('region.create_title', { defaultValue: 'Create Region' })}</h2>
        <p className="text-sm text-gray-500 mb-4">
          {t('region.create_desc', { count: selectedCount, defaultValue: `Create a region for ${selectedCount} selected members.` })}
        </p>
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('region.name', { defaultValue: 'Name' })}
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
              autoFocus
            />
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('region.color', { defaultValue: 'Color' })}
            </label>
            <div className="flex gap-2">
               <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="h-9 w-16 p-0 border rounded cursor-pointer"
               />
               <input 
                 type="text"
                 value={color}
                 onChange={(e) => setColor(e.target.value)}
                 className="flex-1 border rounded px-3 py-2 text-sm uppercase"
               />
            </div>
          </div>
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('region.description', { defaultValue: 'Description' })}
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded"
            >
              {t('common.cancel', { defaultValue: 'Cancel' })}
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              {t('common.confirm', { defaultValue: 'Confirm' })}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateRegionDialog;
