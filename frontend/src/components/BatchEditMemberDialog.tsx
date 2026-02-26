import { Save, X } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { updateMember } from '../services/api';
import { Member } from '../types';

interface BatchEditMemberDialogProps {
  isOpen: boolean;
  onClose: () => void;
  members: Member[];
  onUpdate: () => void;
}

const BatchEditMemberDialog: React.FC<BatchEditMemberDialogProps> = ({
  isOpen,
  onClose,
  members,
  onUpdate,
}) => {
  const { t } = useTranslation();
  const [editedMembers, setEditedMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setEditedMembers(JSON.parse(JSON.stringify(members)));
    }
  }, [isOpen, members]);

  const handleChange = (id: string, field: keyof Member, value: string | boolean) => {
    setEditedMembers((prev) =>
      prev.map((m) => (m.id === id ? { ...m, [field]: value } : m))
    );
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      // Identify changed members
      const updates = [];
      for (const edited of editedMembers) {
        const original = members.find((m) => m.id === edited.id);
        if (!original) continue;

        const changes: Partial<Member> = {};
        let hasChanges = false;

        // Check fields
        const fields: (keyof Member)[] = [
          'name',
          'surname',
          'gender',
          'birth_date',
          'death_date',
          'is_deceased',
          'is_fuzzy',
          'remark',
          'birth_place'
        ];

        fields.forEach((field) => {
          if (edited[field] !== original[field]) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (changes as any)[field] = edited[field];
            hasChanges = true;
          }
        });

        if (hasChanges) {
          updates.push(updateMember(edited.id, changes));
        }
      }

      await Promise.all(updates);
      toast.success(t('member.save_success'));
      onUpdate();
      onClose();
    } catch (error) {
      console.error(error);
      toast.error(t('member.save_failed'));
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-lg shadow-xl w-[90vw] h-[90vh] flex flex-col">
        <div className="p-4 border-b flex justify-between items-center bg-gray-50">
          <h2 className="text-xl font-bold">{t('member.batch_edit_title')}</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full">
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-4">
          <div className="min-w-max">
            <table className="w-full text-sm text-left border-collapse">
              <thead className="text-xs text-gray-700 uppercase bg-gray-50 sticky top-0 z-10 shadow-sm">
                <tr>
                  <th className="px-4 py-3 border bg-gray-50 min-w-[120px]">{t('member.name')}</th>
                  <th className="px-4 py-3 border bg-gray-50 w-24">{t('member.surname')}</th>
                  <th className="px-4 py-3 border bg-gray-50 w-24">{t('member.gender')}</th>
                  <th className="px-4 py-3 border bg-gray-50 min-w-[120px]">{t('member.birth_date')}</th>
                  <th className="px-4 py-3 border bg-gray-50 min-w-[120px]">{t('member.death_date')}</th>
                  <th className="px-4 py-3 border bg-gray-50 w-24 text-center">{t('member.is_deceased')}</th>
                  <th className="px-4 py-3 border bg-gray-50 w-24 text-center">{t('member.is_fuzzy')}</th>
                  <th className="px-4 py-3 border bg-gray-50 min-w-[200px]">{t('member.remark')}</th>
                </tr>
              </thead>
              <tbody>
                {editedMembers.map((member) => (
                  <tr key={member.id} className="bg-white border-b hover:bg-gray-50">
                    <td className="px-2 py-2 border">
                      <input
                        type="text"
                        value={member.name}
                        onChange={(e) => handleChange(member.id, 'name', e.target.value)}
                        className="w-full bg-transparent outline-none p-1 focus:bg-blue-50 rounded"
                      />
                    </td>
                    <td className="px-2 py-2 border">
                      <input
                        type="text"
                        value={member.surname || ''}
                        onChange={(e) => handleChange(member.id, 'surname', e.target.value)}
                        className="w-full bg-transparent outline-none p-1 focus:bg-blue-50 rounded"
                      />
                    </td>
                    <td className="px-2 py-2 border">
                      <select
                        value={member.gender}
                        onChange={(e) => handleChange(member.id, 'gender', e.target.value)}
                        className="w-full bg-transparent outline-none p-1 focus:bg-blue-50 rounded cursor-pointer"
                      >
                        <option value="male">{t('member.male')}</option>
                        <option value="female">{t('member.female')}</option>
                      </select>
                    </td>
                    <td className="px-2 py-2 border">
                      <input
                        type="text"
                        value={member.birth_date || ''}
                        onChange={(e) => handleChange(member.id, 'birth_date', e.target.value)}
                        className="w-full bg-transparent outline-none p-1 focus:bg-blue-50 rounded"
                        placeholder="YYYY-MM-DD"
                      />
                    </td>
                    <td className="px-2 py-2 border">
                      <input
                        type="text"
                        value={member.death_date || ''}
                        onChange={(e) => handleChange(member.id, 'death_date', e.target.value)}
                        className="w-full bg-transparent outline-none p-1 focus:bg-blue-50 rounded"
                        placeholder="YYYY-MM-DD"
                      />
                    </td>
                    <td className="px-2 py-2 border text-center">
                      <input
                        type="checkbox"
                        checked={member.is_deceased || false}
                        onChange={(e) => handleChange(member.id, 'is_deceased', e.target.checked)}
                        className="w-4 h-4 cursor-pointer"
                      />
                    </td>
                    <td className="px-2 py-2 border text-center">
                      <input
                        type="checkbox"
                        checked={member.is_fuzzy || false}
                        onChange={(e) => handleChange(member.id, 'is_fuzzy', e.target.checked)}
                        className="w-4 h-4 cursor-pointer"
                      />
                    </td>
                    <td className="px-2 py-2 border">
                      <input
                        type="text"
                        value={member.remark || ''}
                        onChange={(e) => handleChange(member.id, 'remark', e.target.value)}
                        className="w-full bg-transparent outline-none p-1 focus:bg-blue-50 rounded"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="p-4 border-t bg-gray-50 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-white border rounded hover:bg-gray-100 transition-colors"
          >
            {t('common.cancel', { defaultValue: 'Cancel' })}
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="px-4 py-2 text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2 transition-colors shadow-sm"
          >
            <Save size={16} />
            {loading ? t('common.saving', { defaultValue: 'Saving...' }) : t('common.save', { defaultValue: 'Save' })}
          </button>
        </div>
      </div>
    </div>
  );
};

export default BatchEditMemberDialog;
