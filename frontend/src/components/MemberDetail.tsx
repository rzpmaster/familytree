import { Save, X } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { createMember, updateMember } from '../services/api';
import { Member } from '../types';

interface MemberDetailProps {
  member: Member;
  onClose: () => void;
  onUpdate: () => void; // Trigger refresh
  readOnly?: boolean;
}

const MemberDetail: React.FC<MemberDetailProps> = ({ member, onClose, onUpdate, readOnly = false }) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState<Partial<Member>>({});
  const isNewMember = member.id === 'new_member';

  useEffect(() => {
      setFormData({
        name: member.name,
        gender: member.gender,
        birth_date: member.birth_date,
        death_date: member.death_date,
        birth_place: member.birth_place,
      });
  }, [member]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    if (readOnly) return;
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
      try {
        if (isNewMember) {
            // Create new member
            await createMember({
                name: formData.name || '',
                gender: formData.gender || 'male',
                birth_date: formData.birth_date,
                death_date: formData.death_date,
                birth_place: formData.birth_place,
                photo_url: formData.photo_url,
                family_id: member.family_id,
                position_x: member.position_x,
                position_y: member.position_y
            });
            toast.success("Member added successfully");
        } else {
            // Update existing
            await updateMember(member.id, formData);
            toast.success("Member updated successfully");
        }
        onUpdate();
        onClose(); 
      } catch (e) {
        console.error(e);
        toast.error(t('member.add_failed').replace('add', 'save'));
      }
    };

  return (
    <div className="h-full flex flex-col bg-white shadow-xl border-l w-80">
      <div className="p-4 border-b flex justify-between items-center bg-gray-50">
        <h2 className="text-lg font-semibold">{isNewMember ? t('member.add') : t('member.details')}</h2>
        <button onClick={onClose} className="p-1 hover:bg-gray-200 rounded">
          <X size={20} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Fields */}
        <div>
          <label className="block text-sm font-medium text-gray-700">{t('member.name')}</label>
          <input
            type="text"
            name="name"
            value={formData.name || ''}
            onChange={handleChange}
            readOnly={readOnly}
            className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2 ${readOnly ? 'bg-gray-100 cursor-not-allowed' : ''}`}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">{t('member.gender')}</label>
          <select
            name="gender"
            value={formData.gender || 'male'}
            onChange={handleChange}
            disabled={readOnly}
            className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2 ${readOnly ? 'bg-gray-100 cursor-not-allowed' : ''}`}
          >
            <option value="male">{t('member.male')}</option>
            <option value="female">{t('member.female')}</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">{t('member.birth_date')}</label>
          <input
            type="date"
            name="birth_date"
            value={formData.birth_date || ''}
            onChange={handleChange}
            readOnly={readOnly}
            className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2 ${readOnly ? 'bg-gray-100 cursor-not-allowed' : ''}`}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">{t('member.death_date')}</label>
          <input
            type="date"
            name="death_date"
            value={formData.death_date || ''}
            onChange={handleChange}
            readOnly={readOnly}
            className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2 ${readOnly ? 'bg-gray-100 cursor-not-allowed' : ''}`}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">{t('member.birth_place')}</label>
          <input
            type="text"
            name="birth_place"
            value={formData.birth_place || ''}
            onChange={handleChange}
            readOnly={readOnly}
            className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2 ${readOnly ? 'bg-gray-100 cursor-not-allowed' : ''}`}
          />
        </div>
      </div>

      {!readOnly && (
        <div className="p-4 border-t bg-gray-50 flex gap-2">
            <button
            onClick={handleSave}
            className="flex-1 flex justify-center items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
            <Save size={16} /> {t('common.save')}
            </button>
        </div>
      )}
    </div>
  );
};

export default MemberDetail;
