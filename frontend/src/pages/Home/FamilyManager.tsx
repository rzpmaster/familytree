import ConfirmDialog from "@/components/ConfirmDialog";
import { createFamily, deleteFamily, getUsers } from "@/services/api";
import { Family } from "@/types";
import { Check, ChevronDown, Plus, Trash2 } from "lucide-react";
import React, { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";

interface FamilyManagerProps {
  families: Family[];
  currentFamily: Family | null;
  onSelectFamily: (family: Family) => void;
  onFamilyCreated: () => void;
}

const FamilyManager: React.FC<FamilyManagerProps> = ({
  families,
  currentFamily,
  onSelectFamily,
  onFamilyCreated,
}) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newFamilyName, setNewFamilyName] = useState("");
  const [users, setUsers] = useState<
    { id: string; name: string; email: string }[]
  >([]);
  const [selectedUserId, setSelectedUserId] = useState<string>("");

  // Delete confirm
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [familyToDelete, setFamilyToDelete] = useState<Family | null>(null);

  useEffect(() => {
    if (isCreating) {
      getUsers().then((data) => {
        setUsers(data);
        if (data.length > 0) setSelectedUserId(data[0].id);
      });
    }
  }, [isCreating]);

  const handleCreate = async () => {
    if (!newFamilyName.trim()) {
      toast.error(t("family_name_required") || "Family name is required");
      return;
    }
    if (!selectedUserId) {
      toast.error(t("user_required") || "User is required");
      return;
    }

    try {
      const newFamily = await createFamily(newFamilyName, selectedUserId);
      toast.success(t("family_created") || "Family created successfully");
      setNewFamilyName("");
      setIsCreating(false);
      setIsOpen(false);
      onFamilyCreated();

      // Auto select new family
      onSelectFamily(newFamily);
    } catch (error) {
      console.error(error);
      toast.error(t("failed_to_create_family") || "Failed to create family");
    }
  };

  const handleDeleteClick = (e: React.MouseEvent, family: Family) => {
    e.stopPropagation(); // Prevent selection
    setFamilyToDelete(family);
    setDeleteConfirmOpen(true);
    setIsOpen(false); // Close dropdown
  };

  const handleConfirmDelete = async () => {
    if (!familyToDelete) return;

    try {
      await deleteFamily(familyToDelete.id);
      toast.success(t("family_deleted") || "Family deleted successfully");
      setDeleteConfirmOpen(false);
      setFamilyToDelete(null);

      // Refresh list
      onFamilyCreated(); // Re-fetch

      // If deleted family was selected, parent component will handle re-selection (Home.tsx logic selects first if current invalid)
    } catch (error) {
      console.error(error);
      toast.error(t("failed_to_delete_family") || "Failed to delete family");
    }
  };

  return (
    <div className="relative">
      {/* Backdrop to close */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => {
            setIsOpen(false);
            setIsCreating(false);
          }}
        ></div>
      )}

      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 font-bold text-xl text-gray-800 hover:bg-gray-100 px-2 py-1 rounded transition-colors relative z-50"
      >
        {currentFamily ? currentFamily.family_name : t("family.select")}
        <ChevronDown
          size={20}
          className={`transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-72 bg-white rounded-lg shadow-lg border p-2 z-50">
          {!isCreating ? (
            <>
              <div className="max-h-60 overflow-y-auto mb-2">
                {families.map((family) => (
                  <div
                    key={family.id}
                    onClick={() => {
                      onSelectFamily(family);
                      setIsOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 rounded flex items-center justify-between hover:bg-gray-50 cursor-pointer group ${currentFamily?.id === family.id ? "bg-blue-50 text-blue-600" : "text-gray-700"}`}
                  >
                    <div className="flex items-center gap-2 truncate flex-1">
                      <span className="truncate">{family.family_name}</span>
                      {currentFamily?.id === family.id && <Check size={16} />}
                    </div>

                    <button
                      onClick={(e) => handleDeleteClick(e, family)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-all"
                      title={t("family.delete") || "Delete Family"}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
              <button
                onClick={() => setIsCreating(true)}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded border border-dashed border-blue-200"
              >
                <Plus size={16} />
                {t("family.create_new") || "Create New Family"}
              </button>
            </>
          ) : (
            <div className="p-1 space-y-3">
              <h3 className="font-medium text-gray-900">
                {t("family.create_new") || "Create New Family"}
              </h3>
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  {t("family_name") || "Family Name"}
                </label>
                <input
                  type="text"
                  value={newFamilyName}
                  onChange={(e) => setNewFamilyName(e.target.value)}
                  className="w-full px-2 py-1.5 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. Smith Family"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  {t("owner") || "Owner"}
                </label>
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className="w-full px-2 py-1.5 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name} ({user.email})
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => setIsCreating(false)}
                  className="flex-1 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded"
                >
                  {t("cancel") || "Cancel"}
                </button>
                <button
                  onClick={handleCreate}
                  className="flex-1 px-3 py-1.5 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded"
                >
                  {t("create") || "Create"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        isOpen={deleteConfirmOpen}
        title={t("family.delete") || "Delete Family"}
        message={
          t("family.confirm_delete", { name: familyToDelete?.family_name }) ||
          `Are you sure you want to delete family '${familyToDelete?.family_name}'?`
        }
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteConfirmOpen(false)}
      />
    </div>
  );
};

export default FamilyManager;
