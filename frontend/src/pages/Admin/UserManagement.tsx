import { useAuth } from "@/hooks/useAuth";
import {
  ChevronLeft,
  ChevronRight,
  Search,
  Shield,
  ShieldAlert,
  Trash2,
  User as UserIcon,
} from "lucide-react";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import ConfirmDialog from "../../components/ConfirmDialog";
import { cn } from "../../lib/utils";
import { User } from "../../types";
import SharedFamilyRow from "./SharedFamilyRow";

interface UserManagementProps {
  users: User[];
  loading: boolean;
  familyNames: Record<string, string>;
  onDeleteUser: (user: User) => void;
  onToggleAdmin: (user: User) => void;
  onUpdateRole: (familyId: string, userId: string, role: "viewer" | "editor" | "admin") => void;
  onRemoveCollaborator: (familyId: string, userId: string) => void;
}

const UserManagement: React.FC<UserManagementProps> = ({
  users,
  loading,
  familyNames,
  onDeleteUser,
  onToggleAdmin,
  onUpdateRole,
  onRemoveCollaborator,
}) => {
  const { t } = useTranslation();
  const { user: currentUser } = useAuth();
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);

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

  const handleConfirmDelete = () => {
    if (userToDelete) {
      onDeleteUser(userToDelete);
      setUserToDelete(null);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Loading...</div>;
  }

  return (
    <div>
      <div className="mb-6 flex justify-between items-center">
        <div className="relative max-w-sm w-full">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            className={cn("input pl-10")}
            placeholder={t("admin.search_placeholder", {
              defaultValue: "Search by name or email...",
            })}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="table-container">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="table-header">
                {t("member.name", { defaultValue: "Name" })}
              </th>
              <th className="table-header">
                {t("auth.email", { defaultValue: "Email" })}
              </th>
              <th className="table-header">
                {t("family.management", { defaultValue: "Families" })}
              </th>
              <th className="table-header">
                {t("admin.role", { defaultValue: "Role" })}
              </th>
              <th className="table-header">
                {t("common.created_at", { defaultValue: "Created At" })}
              </th>
              <th className="table-header text-right">
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
                  <td className="table-cell">
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
                  <td className="table-cell">
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
                                className="badge badge-primary truncate max-w-[150px]"
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
                                  onUpdateRole={async (familyId, role) => onUpdateRole(familyId, user.id, role)
                                  }
                                  onRemove={async (familyId) => onRemoveCollaborator(familyId, user.id)
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
                  <td className="table-cell">
                    {user.is_superuser ? (
                      <span className="badge badge-purple">SuperAdmin</span>
                    ) : (
                      <span className="badge badge-success">User</span>
                    )}
                  </td>
                  <td className="table-cell text-gray-500">
                    {user.created_at
                      ? new Date(user.created_at).toLocaleDateString()
                      : "-"}
                  </td>
                  <td className="table-cell text-right font-medium">
                    {user.id !== currentUser?.id && (
                      <div className="flex items-center justify-end gap-3">
                        <button
                          onClick={() => onToggleAdmin(user)}
                          className={cn(
                            "text-sm hover:underline",
                            user.is_superuser
                              ? "text-orange-600 hover:text-orange-900"
                              : "text-purple-600 hover:text-purple-900",
                          )}
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
                onClick={() =>
                  setCurrentPage((prev) => Math.max(prev - 1, 1))
                }
                disabled={currentPage === 1}
                className="btn btn-secondary"
              >
                {t("common.previous", { defaultValue: "Previous" })}
              </button>
              <button
                onClick={() =>
                  setCurrentPage((prev) => Math.min(prev + 1, totalPages))
                }
                disabled={currentPage === totalPages}
                className="btn btn-secondary ml-3"
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

                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                    (page) => (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        aria-current={
                          currentPage === page ? "page" : undefined
                        }
                        className={cn(
                          "relative inline-flex items-center px-4 py-2 border text-sm font-medium",
                          currentPage === page
                            ? "z-10 bg-blue-50 border-blue-500 text-blue-600"
                            : "bg-white border-gray-300 text-gray-500 hover:bg-gray-50",
                        )}
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

export default UserManagement;
