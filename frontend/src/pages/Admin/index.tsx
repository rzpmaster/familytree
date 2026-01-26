import { useAuth } from "@/hooks/useAuth";
import {
	deleteUser,
	getFamilyName,
	getUsers,
	removeCollaborator,
	updateCollaboratorRole,
	updateUserRole,
} from "@/services/api";
import { User } from "@/types";
import {
	ChevronLeft,
	ChevronRight,
	Search,
	Shield,
	ShieldAlert,
	Trash2,
	User as UserIcon,
} from "lucide-react";
import React, { useCallback, useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { useTranslation } from "react-i18next";
import ConfirmDialog from "../../components/ConfirmDialog";
import SharedFamilyRow from "./SharedFamilyRow";

const Admin: React.FC = () => {
  const { t } = useTranslation();
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [familyNames, setFamilyNames] = useState<Record<string, string>>({});

  // Pagination & Search
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getUsers();
      setUsers(data);
      setFilteredUsers(data);

      // Collect all unique family IDs from shared_families
      const sharedFamilyIds = new Set<string>();
      data.forEach((u) => {
        u.shared_families?.forEach((sf) => sharedFamilyIds.add(sf.family_id));
      });

      // Fetch names for unknown families
      const names: Record<string, string> = {};
      await Promise.all(
        Array.from(sharedFamilyIds).map(async (fid) => {
          const name = await getFamilyName(fid);
          if (name) {
            names[fid] = name;
          }
        }),
      );

      setFamilyNames(names);
    } catch (error) {
      console.error("Failed to fetch users", error);
      toast.error(
        t("admin.load_users_failed", { defaultValue: "Failed to load users" }),
      );
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Filter logic
  useEffect(() => {
    const lowerTerm = searchTerm.toLowerCase();
    const filtered = users.filter(
      (u) =>
        u.name.toLowerCase().includes(lowerTerm) ||
        u.email.toLowerCase().includes(lowerTerm),
    );
    setFilteredUsers(filtered);
    setCurrentPage(1); // Reset to first page on search
  }, [searchTerm, users]);

  // Pagination logic
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentUsers = filteredUsers.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);

  const handleDeleteClick = (user: User) => {
    setUserToDelete(user);
  };

  const handleConfirmDelete = async () => {
    if (!userToDelete) return;
    try {
      await deleteUser(userToDelete.id);
      toast.success(t("admin.user_deleted", { defaultValue: "User deleted" }));
      const newUsers = users.filter((u) => u.id !== userToDelete.id);
      setUsers(newUsers);
    } catch (error) {
      console.error("Failed to delete user", error);
      toast.error(
        t("admin.delete_user_failed", {
          defaultValue: "Failed to delete user",
        }),
      );
    } finally {
      setUserToDelete(null);
    }
  };

  const handleToggleAdmin = async (user: User) => {
    try {
      const newStatus = !user.is_superuser;
      await updateUserRole(user.id, newStatus);
      setUsers(
        users.map((u) =>
          u.id === user.id ? { ...u, is_superuser: newStatus } : u,
        ),
      );
      toast.success(t("admin.role_updated", { defaultValue: "Role updated" }));
    } catch (error) {
      console.error("Failed to update role", error);
      toast.error(
        t("admin.update_role_failed", {
          defaultValue: "Failed to update role",
        }),
      );
    }
  };

  const handleRoleUpdate = async (
    familyId: string,
    userId: string,
    newRole: "viewer" | "editor" | "admin",
  ) => {
    try {
      await updateCollaboratorRole(familyId, userId, newRole);
      toast.success(t("admin.role_updated", { defaultValue: "Role updated" }));

      // Update local state
      setUsers(
        users.map((u) => {
          if (u.id === userId) {
            return {
              ...u,
              shared_families: u.shared_families?.map((sf) =>
                sf.family_id === familyId ? { ...sf, role: newRole } : sf,
              ),
            };
          }
          return u;
        }),
      );
    } catch (error) {
      console.error("Failed to update role", error);
      toast.error(
        t("admin.update_role_failed", {
          defaultValue: "Failed to update role",
        }),
      );
    }
  };

  const handleRemoveCollaborator = async (familyId: string, userId: string) => {
    try {
      await removeCollaborator(familyId, userId);
      toast.success(
        t("admin.collaborator_removed", {
          defaultValue: "Collaborator removed",
        }),
      );
      // Update local state
      setUsers(
        users.map((u) => {
          if (u.id === userId) {
            return {
              ...u,
              shared_families: u.shared_families?.filter(
                (sf) => sf.family_id !== familyId,
              ),
            };
          }
          return u;
        }),
      );
    } catch (error) {
      console.error("Failed to remove collaborator", error);
      toast.error(
        t("admin.remove_collaborator_failed", {
          defaultValue: "Failed to remove collaborator",
        }),
      );
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Loading...</div>;
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
        <Shield className="text-blue-600" />
        {t("admin.dashboard", { defaultValue: "Admin Dashboard" })}
      </h1>

      <div className="mb-6 flex justify-between items-center">
        <div className="relative max-w-sm w-full">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:border-blue-300 focus:ring focus:ring-blue-200 sm:text-sm transition duration-150 ease-in-out"
            placeholder={t("admin.search_placeholder", {
              defaultValue: "Search by name or email...",
            })}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden border">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {t("member.name", { defaultValue: "Name" })}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {t("auth.email", { defaultValue: "Email" })}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {t("family.management", { defaultValue: "Families" })}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {t("admin.role", { defaultValue: "Role" })}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {t("common.created_at", { defaultValue: "Created At" })}
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                {t("admin.actions", { defaultValue: "Actions" })}
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {currentUsers.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-6 py-10 text-center text-gray-500"
                >
                  {t("admin.no_users_found", {
                    defaultValue: "No users found matching your search.",
                  })}
                </td>
              </tr>
            ) : (
              currentUsers.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-500">
                        <UserIcon size={16} />
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">
                          {user.name}
                        </div>
                        {user.id === currentUser?.id && (
                          <span className="text-xs text-blue-600 font-medium">
                            (You)
                          </span>
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
                          <span className="font-semibold text-gray-600">
                            Owned:
                          </span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {user.families.map((f) => (
                              <span
                                key={f.id}
                                className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded border border-blue-100 truncate max-w-[150px]"
                                title={f.family_name}
                              >
                                {f.family_name}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {user.shared_families &&
                        user.shared_families.length > 0 && (
                          <div className="text-xs mt-1">
                            <span className="font-semibold text-gray-600">
                              Shared:
                            </span>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {user.shared_families.map((sf) => (
                                <SharedFamilyRow
                                  key={sf.family_id}
                                  collaborator={sf}
                                  familyName={familyNames[sf.family_id]}
                                  onUpdateRole={(familyId, role) =>
                                    handleRoleUpdate(familyId, user.id, role)
                                  }
                                  onRemove={(familyId) =>
                                    handleRemoveCollaborator(familyId, user.id)
                                  }
                                />
                              ))}
                            </div>
                          </div>
                        )}
                      {!user.families?.length &&
                        !user.shared_families?.length && (
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
                    {user.created_at
                      ? new Date(user.created_at).toLocaleDateString()
                      : "-"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    {user.id !== currentUser?.id && (
                      <div className="flex items-center justify-end gap-3">
                        <button
                          onClick={() => handleToggleAdmin(user)}
                          className={`text-sm hover:underline ${
                            user.is_superuser
                              ? "text-orange-600 hover:text-orange-900"
                              : "text-purple-600 hover:text-purple-900"
                          }`}
                          title={
                            user.is_superuser
                              ? "Remove SuperAdmin"
                              : "Make SuperAdmin"
                          }
                        >
                          {user.is_superuser ? (
                            <ShieldAlert size={18} />
                          ) : (
                            <Shield size={18} />
                          )}
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
              ))
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
            <div className="flex-1 flex justify-between sm:hidden">
              <button
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                {t("common.previous", { defaultValue: "Previous" })}
              </button>
              <button
                onClick={() =>
                  setCurrentPage((prev) => Math.min(prev + 1, totalPages))
                }
                disabled={currentPage === totalPages}
                className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                {t("common.next", { defaultValue: "Next" })}
              </button>
            </div>
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-gray-700">
                  {t("admin.showing", { defaultValue: "Showing" })}{" "}
                  <span className="font-medium">{indexOfFirstItem + 1}</span>{" "}
                  {t("admin.to", { defaultValue: "to" })}{" "}
                  <span className="font-medium">
                    {Math.min(indexOfLastItem, filteredUsers.length)}
                  </span>{" "}
                  {t("admin.of", { defaultValue: "of" })}{" "}
                  <span className="font-medium">{filteredUsers.length}</span>{" "}
                  {t("admin.results", { defaultValue: "results" })}
                </p>
              </div>
              <div>
                <nav
                  className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px"
                  aria-label="Pagination"
                >
                  <button
                    onClick={() =>
                      setCurrentPage((prev) => Math.max(prev - 1, 1))
                    }
                    disabled={currentPage === 1}
                    className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                  >
                    <span className="sr-only">Previous</span>
                    <ChevronLeft className="h-5 w-5" aria-hidden="true" />
                  </button>

                  {/* Page numbers logic could be improved for many pages, simplified here */}
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                    (page) => (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        aria-current={currentPage === page ? "page" : undefined}
                        className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium
                                                ${
                                                  currentPage === page
                                                    ? "z-10 bg-blue-50 border-blue-500 text-blue-600"
                                                    : "bg-white border-gray-300 text-gray-500 hover:bg-gray-50"
                                                }`}
                      >
                        {page}
                      </button>
                    ),
                  )}

                  <button
                    onClick={() =>
                      setCurrentPage((prev) => Math.min(prev + 1, totalPages))
                    }
                    disabled={currentPage === totalPages}
                    className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                  >
                    <span className="sr-only">Next</span>
                    <ChevronRight className="h-5 w-5" aria-hidden="true" />
                  </button>
                </nav>
              </div>
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        isOpen={!!userToDelete}
        title={t("admin.delete_user", { defaultValue: "Delete User" })}
        message={t("admin.confirm_delete_user", {
          name: userToDelete?.name,
          defaultValue: `Are you sure you want to delete user "${userToDelete?.name}"?`,
        })}
        onConfirm={handleConfirmDelete}
        onCancel={() => setUserToDelete(null)}
      />
    </div>
  );
};

export default Admin;
