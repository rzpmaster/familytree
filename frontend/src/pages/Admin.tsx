import { useAuth } from '@/hooks/useAuth';
import { deleteUser, getUsers, updateUserRole } from '@/services/api';
import { User } from '@/types';
import { Shield, ShieldAlert, Trash2, User as UserIcon } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import ConfirmDialog from '../components/ConfirmDialog';

const Admin: React.FC = () => {
    const { t } = useTranslation();
    const { user: currentUser } = useAuth();
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [userToDelete, setUserToDelete] = useState<User | null>(null);

    const fetchUsers = useCallback(async () => {
        try {
            setLoading(true);
            const data = await getUsers();
            setUsers(data);
        } catch (error) {
            console.error("Failed to fetch users", error);
            toast.error(t('admin.load_users_failed', { defaultValue: 'Failed to load users' }));
        } finally {
            setLoading(false);
        }
    }, [t]);

    useEffect(() => {
        fetchUsers();
    }, [fetchUsers]);

    const handleDeleteClick = (user: User) => {
        setUserToDelete(user);
    };

    const handleConfirmDelete = async () => {
        if (!userToDelete) return;
        try {
            await deleteUser(userToDelete.id);
            toast.success(t('admin.user_deleted', { defaultValue: 'User deleted' }));
            setUsers(users.filter(u => u.id !== userToDelete.id));
        } catch (error) {
            console.error("Failed to delete user", error);
            toast.error(t('admin.delete_user_failed', { defaultValue: 'Failed to delete user' }));
        } finally {
            setUserToDelete(null);
        }
    };

    const handleToggleAdmin = async (user: User) => {
        try {
            const newStatus = !user.is_superuser;
            await updateUserRole(user.id, newStatus);
            setUsers(users.map(u => u.id === user.id ? { ...u, is_superuser: newStatus } : u));
            toast.success(t('admin.role_updated', { defaultValue: 'Role updated' }));
        } catch (error) {
            console.error("Failed to update role", error);
            toast.error(t('admin.update_role_failed', { defaultValue: 'Failed to update role' }));
        }
    };

    if (loading) {
        return <div className="p-8 text-center text-gray-500">Loading...</div>;
    }

    return (
        <div className="p-8 max-w-6xl mx-auto">
            <h1 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                <Shield className="text-blue-600" />
                {t('admin.dashboard', { defaultValue: 'Admin Dashboard' })}
            </h1>

            <div className="bg-white rounded-lg shadow overflow-hidden border">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                {t('member.name', { defaultValue: 'Name' })}
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                {t('auth.email', { defaultValue: 'Email' })}
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                {t('family.management', { defaultValue: 'Families' })}
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                {t('admin.role', { defaultValue: 'Role' })}
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                {t('common.created_at', { defaultValue: 'Created At' })}
                            </th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                {t('admin.actions', { defaultValue: 'Actions' })}
                            </th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {users.map((user) => (
                            <tr key={user.id} className="hover:bg-gray-50">
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="flex items-center">
                                        <div className="flex-shrink-0 h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-500">
                                            <UserIcon size={16} />
                                        </div>
                                        <div className="ml-4">
                                            <div className="text-sm font-medium text-gray-900">{user.name}</div>
                                            {user.id === currentUser?.id && (
                                                <span className="text-xs text-blue-600 font-medium">(You)</span>
                                            )}
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="text-sm text-gray-500">{user.email}</div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex flex-col gap-1">
                                        {user.families && user.families.length > 0 && (
                                            <div className="text-xs">
                                                <span className="font-semibold text-gray-600">Owned:</span>
                                                <div className="flex flex-wrap gap-1 mt-1">
                                                    {user.families.map(f => (
                                                        <span key={f.id} className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded border border-blue-100 truncate max-w-[150px]" title={f.family_name}>
                                                            {f.family_name}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                        {user.shared_families && user.shared_families.length > 0 && (
                                            <div className="text-xs mt-1">
                                                <span className="font-semibold text-gray-600">Shared:</span>
                                                <div className="flex flex-wrap gap-1 mt-1">
                                                    {user.shared_families.map(sf => (
                                                        <span key={sf.family_id} className="bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded border border-purple-100 truncate max-w-[150px]">
                                                            Family {sf.family_id.slice(0, 4)} ({sf.role})
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                        {(!user.families?.length && !user.shared_families?.length) && (
                                            <span className="text-xs text-gray-400">-</span>
                                        )}
                                    </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    {user.is_superuser ? (
                                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-purple-100 text-purple-800">
                                            SuperAdmin
                                        </span>
                                    ) : (
                                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                                            User
                                        </span>
                                    )}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {user.created_at ? new Date(user.created_at).toLocaleDateString() : '-'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    {user.id !== currentUser?.id && (
                                        <div className="flex items-center justify-end gap-3">
                                            <button
                                                onClick={() => handleToggleAdmin(user)}
                                                className={`text-sm hover:underline ${
                                                    user.is_superuser 
                                                        ? 'text-orange-600 hover:text-orange-900' 
                                                        : 'text-purple-600 hover:text-purple-900'
                                                }`}
                                                title={user.is_superuser ? "Remove SuperAdmin" : "Make SuperAdmin"}
                                            >
                                                {user.is_superuser ? <ShieldAlert size={18} /> : <Shield size={18} />}
                                            </button>
                                            <button
                                                onClick={() => handleDeleteClick(user)}
                                                className="text-red-600 hover:text-red-900"
                                                title="Delete User"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <ConfirmDialog
                isOpen={!!userToDelete}
                title={t('admin.delete_user', { defaultValue: 'Delete User' })}
                message={t('admin.confirm_delete_user', { name: userToDelete?.name, defaultValue: `Are you sure you want to delete user "${userToDelete?.name}"?` })}
                onConfirm={handleConfirmDelete}
                onCancel={() => setUserToDelete(null)}
            />
        </div>
    );
};

export default Admin;