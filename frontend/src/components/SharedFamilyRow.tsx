import { FamilyCollaborator } from '@/types';
import { X } from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import ConfirmDialog from './ConfirmDialog';

interface SharedFamilyRowProps {
    collaborator: FamilyCollaborator;
    familyName: string;
    onUpdateRole: (familyId: string, role: 'viewer' | 'editor' | 'admin') => Promise<void>;
    onRemove: (familyId: string) => Promise<void>;
}

const SharedFamilyRow: React.FC<SharedFamilyRowProps> = ({ 
    collaborator: sf, 
    familyName, 
    onUpdateRole, 
    onRemove 
}) => {
    const { t } = useTranslation();
    const [isRemoveDialogOpen, setIsRemoveDialogOpen] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);

    const handleRoleChange = async (newRole: 'viewer' | 'editor' | 'admin') => {
        if (isUpdating) return;
        setIsUpdating(true);
        try {
            await onUpdateRole(sf.family_id, newRole);
        } finally {
            setIsUpdating(false);
        }
    };

    const handleRemoveClick = () => {
        setIsRemoveDialogOpen(true);
    };

    const handleConfirmRemove = async () => {
        setIsRemoveDialogOpen(false);
        await onRemove(sf.family_id);
    };

    return (
        <>
            <div className="flex items-center justify-between w-full bg-purple-50 rounded border border-purple-100 px-2 py-2 mb-1 last:mb-0">
                <span className="text-purple-700 truncate mr-2 text-xs flex-1" title={familyName || sf.family_id}>
                    {familyName || `Family ${sf.family_id.slice(0, 4)}`}
                </span>
                
                <div className="flex items-center gap-3">
                    {/* Viewer/Editor Toggle Group */}
                    <div className="flex bg-blue-100/50 rounded-md p-0.5 border border-blue-100">
                        <button
                            disabled={true}
                            className="px-2 py-0.5 text-[10px] rounded transition-all bg-blue-500 text-white shadow-sm font-medium cursor-not-allowed opacity-90"
                            title={t('family.role_viewer_always', { defaultValue: 'Read access is always enabled' })}
                        >
                            {t('family.role_viewer', { defaultValue: 'Read' })}
                        </button>
                        <button
                            onClick={() => {
                                const newRole = (sf.role === 'editor' || sf.role === 'admin') ? 'viewer' : 'editor';
                                handleRoleChange(newRole);
                            }}
                            disabled={isUpdating}
                            className={`px-2 py-0.5 text-[10px] rounded transition-all ${
                                (sf.role === 'editor' || sf.role === 'admin')
                                    ? 'bg-blue-500 text-white shadow-sm font-medium' 
                                    : 'text-gray-600 hover:text-blue-600 hover:bg-white/50'
                            }`}
                        >
                            {t('family.role_editor', { defaultValue: 'Write' })}
                        </button>
                    </div>

                    {/* Admin Toggle */}
                    <div className="flex items-center gap-1">
                        <span className="text-[10px] text-gray-500">{t('family.role_admin', { defaultValue: 'Admin' })}</span>
                        <button 
                            onClick={() => handleRoleChange(sf.role === 'admin' ? 'editor' : 'admin')}
                            disabled={isUpdating}
                            className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors focus:outline-none focus:ring-1 focus:ring-blue-500 focus:ring-offset-1 ${
                                sf.role === 'admin' ? 'bg-blue-600' : 'bg-gray-200'
                            }`}
                        >
                            <span
                                className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                                    sf.role === 'admin' ? 'translate-x-3.5' : 'translate-x-0.5'
                                }`}
                            />
                        </button>
                    </div>

                    {/* Remove Button */}
                    <button 
                        onClick={handleRemoveClick}
                        className="text-gray-400 hover:text-red-500 transition-colors p-1 hover:bg-red-50 rounded"
                        title={t('common.remove', { defaultValue: 'Remove' })}
                    >
                        <X size={14} />
                    </button>
                </div>
            </div>

            <ConfirmDialog
                isOpen={isRemoveDialogOpen}
                title={t('family.remove_collaborator', { defaultValue: 'Remove Collaborator' })}
                message={t('family.confirm_remove_collaborator', { defaultValue: 'Are you sure you want to remove this collaborator?' })}
                onConfirm={handleConfirmRemove}
                onCancel={() => setIsRemoveDialogOpen(false)}
                confirmText={t('common.remove', { defaultValue: 'Remove' })}
                cancelText={t('common.cancel', { defaultValue: 'Cancel' })}
                variant="danger"
            />
        </>
    );
};

export default SharedFamilyRow;
