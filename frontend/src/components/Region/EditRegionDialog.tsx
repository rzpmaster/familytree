import { Member } from '@/types';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface EditRegionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (name: string, description: string, color: string, memberIds: string[]) => void;
  onDelete: () => void;
  initialName: string;
  initialDescription: string;
  initialColor: string;
  currentMemberIds: string[];
  allMembers: Member[];
}

const EditRegionDialog: React.FC<EditRegionDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  onDelete,
  initialName,
  initialDescription,
  initialColor,
  currentMemberIds,
  allMembers,
}) => {
  const { t } = useTranslation();
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [color, setColor] = useState(initialColor || '#EBF8FF');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(currentMemberIds));

  useEffect(() => {
    if (isOpen) {
      setName(initialName);
      setDescription(initialDescription || '');
      setColor(initialColor || '#EBF8FF');
      setSelectedIds(new Set(currentMemberIds));
    }
  }, [isOpen, initialName, initialDescription, initialColor, currentMemberIds]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onConfirm(name, description, color, Array.from(selectedIds));
    }
  };

  const toggleMember = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl p-6 w-[500px] max-h-[80vh] flex flex-col">
        <h2 className="text-xl font-bold mb-4">{t('region.edit_title', { defaultValue: 'Edit Region' })}</h2>
        
        <form onSubmit={handleSubmit} className="flex-1 overflow-hidden flex flex-col">
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
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('region.description', { defaultValue: 'Description' })}
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={2}
            />
          </div>

          <div className="mb-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('region.members', { defaultValue: 'Members' })}
            </label>
          </div>
          
          <div className="flex-1 overflow-y-auto border rounded p-2 mb-4 bg-gray-50">
            {allMembers.map(member => (
              <div key={member.id} className="flex items-center gap-2 py-1 hover:bg-gray-100 px-2 rounded">
                <input
                  type="checkbox"
                  id={`member-${member.id}`}
                  checked={selectedIds.has(member.id)}
                  onChange={() => toggleMember(member.id)}
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor={`member-${member.id}`} className="text-sm cursor-pointer flex-1">
                  {member.name} {member.surname}
                  {member.region_id && !selectedIds.has(member.id) && (
                     <span className="text-xs text-gray-400 ml-2">({t('region.in_another', { defaultValue: 'In another region' })})</span>
                  )}
                </label>
              </div>
            ))}
          </div>

          <div className="flex justify-between items-center pt-4 border-t">
            <button
              type="button"
              onClick={onDelete}
              className="text-red-600 hover:text-red-800 text-sm font-medium"
            >
              {t('region.delete', { defaultValue: 'Delete Region' })}
            </button>
            <div className="flex gap-2">
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
                {t('common.save', { defaultValue: 'Save' })}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditRegionDialog;
