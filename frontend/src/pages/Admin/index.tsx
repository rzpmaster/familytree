import {
  deleteUser,
  getFamilyName,
  getUsers,
  removeCollaborator,
  updateCollaboratorRole,
  updateUserRole,
} from "@/services/api";
import { User } from "@/types";
import { Shield, User as UserIcon, Users } from "lucide-react";
import React, { useCallback, useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { cn } from "../../lib/utils";
import FamilyManagement from "./FamilyManagement";
import UserManagement from "./UserManagement";

const Admin: React.FC = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<"users" | "families">("users");
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [familyNames, setFamilyNames] = useState<Record<string, string>>({});

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getUsers();
      setUsers(data);

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

  const handleDeleteUser = async (user: User) => {
    try {
      await deleteUser(user.id);
      toast.success(t("admin.user_deleted", { defaultValue: "User deleted" }));
      setUsers(users.filter((u) => u.id !== user.id));
    } catch (error) {
      console.error("Failed to delete user", error);
      toast.error(
        t("admin.delete_user_failed", {
          defaultValue: "Failed to delete user",
        }),
      );
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

  const handleUpdateRole = async (
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

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-8 max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
          <Shield className="text-blue-600" />
          {t("admin.dashboard", { defaultValue: "Admin Dashboard" })}
        </h1>

        {/* Tab Switcher */}
        <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg w-fit mb-6">
          <button
            onClick={() => setActiveTab("users")}
            className={cn(
              "px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2",
              activeTab === "users"
                ? "bg-white text-blue-600 shadow-sm"
                : "text-gray-500 hover:text-gray-700 hover:bg-gray-200",
            )}
          >
            <UserIcon size={16} />
            {t("admin.users", { defaultValue: "Users" })}
          </button>
          <button
            onClick={() => setActiveTab("families")}
            className={cn(
              "px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2",
              activeTab === "families"
                ? "bg-white text-blue-600 shadow-sm"
                : "text-gray-500 hover:text-gray-700 hover:bg-gray-200",
            )}
          >
            <Users size={16} />
            {t("admin.families", { defaultValue: "Families" })}
          </button>
        </div>

        {activeTab === "users" ? (
          <UserManagement
            users={users}
            loading={loading}
            familyNames={familyNames}
            onDeleteUser={handleDeleteUser}
            onToggleAdmin={handleToggleAdmin}
            onUpdateRole={handleUpdateRole}
            onRemoveCollaborator={handleRemoveCollaborator}
          />
        ) : (
          <FamilyManagement users={users} />
        )}
      </div>
    </div>
  );
};

export default Admin;
