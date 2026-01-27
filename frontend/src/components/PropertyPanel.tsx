import { cn } from '@/lib/utils';
import { Calendar, Save, X } from 'lucide-react';
import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { updateSpouseRelationship } from '../services/api';
import { GraphEdge } from '../types';

interface PropertyPanelProps {
  edge: GraphEdge;
  onClose: () => void;
  onUpdate: () => void;
  readOnly?: boolean;
}

const PropertyPanel: React.FC<PropertyPanelProps> = ({ edge, onClose, onUpdate, readOnly = false }) => {
  const { t } = useTranslation();
  const [marriageDate, setMarriageDate] = useState('');
  const [loading, setLoading] = useState(false);

  // ...

  const handleSave = async () => {
    if (readOnly) return;
    try {
      setLoading(true);
      await updateSpouseRelationship(edge.id, { marriage_date: marriageDate || undefined });
      toast.success(t('common.update_success', { defaultValue: 'Updated successfully' }));
      onUpdate();
    } catch (error) {
      console.error('Failed to update relationship', error);
      toast.error(t('common.update_failed', { defaultValue: 'Update failed' }));
    } finally {
      setLoading(false);
    }
  };

  if (edge.type !== 'spouse') return null;

  return (
    <div className="h-full bg-white flex flex-col shadow-xl">
      <div className="p-4 border-b flex justify-between items-center bg-gray-50">
        <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
           {t('relation.properties', { defaultValue: 'Relationship Details' })}
        </h2>
        <button onClick={onClose} className="btn-ghost p-1 rounded">
          <X size={20} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Relationship Info */}
        <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
            <div className="text-sm text-blue-800 font-medium mb-1">
                {t('relation.spouse_relationship', { defaultValue: 'Spouse Relationship' })}
            </div>
            <div className="text-xs text-blue-600">
                ID: {edge.id}
            </div>
        </div>

        {/* Marriage Date */}
        <div>
          <label className="form-label flex items-center gap-2">
            <Calendar size={14} />
            {t('relation.marriage_date', { defaultValue: 'Marriage Date' })}
          </label>
          <input
            type="date"
            value={marriageDate}
            onChange={(e) => setMarriageDate(e.target.value)}
            readOnly={readOnly}
            className={cn(
              "input transition-all",
              readOnly && "bg-gray-100 cursor-not-allowed"
            )}
          />
          {!readOnly && (
            <p className="mt-1 text-xs text-gray-400">
                {t('common.leave_empty_if_unknown', { defaultValue: 'Leave empty if unknown' })}
            </p>
          )}
        </div>
      </div>

      {!readOnly && (
        <div className="p-4 border-t bg-gray-50 flex gap-3">
            <button
            onClick={handleSave}
            disabled={loading}
            className="btn btn-primary flex-1 gap-2 shadow-sm"
            >
            <Save size={16} />
            {loading ? t('common.saving', { defaultValue: 'Saving...' }) : t('common.save', { defaultValue: 'Save' })}
            </button>
        </div>
      )}
    </div>
  );
};

export default PropertyPanel;
