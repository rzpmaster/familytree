import { ChevronLeft, ChevronRight, Search, Trash2, Users } from "lucide-react";
import React, { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { useTranslation } from "react-i18next";
import ConfirmDialog from "../../components/ConfirmDialog";
import { cn } from "../../lib/utils";
import { deleteFamily, getFamilies } from "../../services/api";
import { Family, User } from "../../types";

interface FamilyManagementProps {
  users: User[];
}

const FamilyManagement: React.FC<FamilyManagementProps> = ({ users }) => {
  const { t } = useTranslation();
  const [families, setFamilies] = useState<Family[]>([]);
  const [loading, setLoading] = useState(true);
  const [filteredFamilies, setFilteredFamilies] = useState<Family[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [familyToDelete, setFamilyToDelete] = useState<Family | null>(null);

  useEffect(() => {
    const fetchFamilies = async () => {
      try {
        setLoading(true);
        const data = await getFamilies();
        setFamilies(data);
        setFilteredFamilies(data);
      } catch (error) {
        console.error("Failed to fetch families", error);
        toast.error(
          t("admin.load_families_failed", {
            defaultValue: "Failed to load families",
          }),
        );
      } finally {
        setLoading(false);
      }
    };

    fetchFamilies();
  }, [t]);

  // Filter logic
  useEffect(() => {
    const lowerTerm = searchTerm.toLowerCase();
    const filtered = families.filter(
      (f) =>
        f.family_name.toLowerCase().includes(lowerTerm) ||
        f.id.toLowerCase().includes(lowerTerm),
    );
    setFilteredFamilies(filtered);
    setCurrentPage(1);
  }, [searchTerm, families]);

  const getUserName = (userId: string) => {
    const user = users.find((u) => u.id === userId);
    return user ? user.name : userId;
  };

  // Pagination logic
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentFamilies = filteredFamilies.slice(
    indexOfFirstItem,
    indexOfLastItem,
  );
  const totalPages = Math.ceil(filteredFamilies.length / itemsPerPage);

  const handleDeleteClick = (family: Family) => {
    setFamilyToDelete(family);
  };

  const handleConfirmDelete = async () => {
    if (!familyToDelete) return;
    try {
      await deleteFamily(familyToDelete.id);
      toast.success(
        t("admin.family_deleted", { defaultValue: "Family deleted" }),
      );
      setFamilies(families.filter((f) => f.id !== familyToDelete.id));
    } catch (error) {
      console.error("Failed to delete family", error);
      toast.error(
        t("admin.delete_family_failed", {
          defaultValue: "Failed to delete family",
        }),
      );
    } finally {
      setFamilyToDelete(null);
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
            placeholder={t("admin.search_family_placeholder", {
              defaultValue: "Search by name or ID...",
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
                {t("family.name", { defaultValue: "Family Name" })}
              </th>
              <th className="table-header">
                {t("family.owner", { defaultValue: "Owner" })}
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
            {currentFamilies.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="px-6 py-10 text-center text-gray-500"
                >
                  {t("admin.no_families_found", {
                    defaultValue: "No families found matching your search.",
                  })}
                </td>
              </tr>
            ) : (
              currentFamilies.map((family) => (
                <tr key={family.id} className="hover:bg-gray-50">
                  <td className="table-cell">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-8 w-8 rounded bg-blue-100 flex items-center justify-center text-blue-500">
                        <Users size={16} />
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">
                          {family.family_name}
                        </div>
                        <div className="text-xs text-gray-400">{family.id}</div>
                      </div>
                    </div>
                  </td>
                  <td className="table-cell">
                    <div className="text-sm text-gray-600">
                      {getUserName(family.user_id)}
                    </div>
                  </td>
                  <td className="table-cell text-gray-500">
                    {new Date(family.created_at).toLocaleDateString()}
                  </td>
                  <td className="table-cell text-right font-medium">
                    <button
                      onClick={() => handleDeleteClick(family)}
                      className="text-red-600 hover:text-red-900"
                      title="Delete Family"
                    >
                      <Trash2 size={18} />
                    </button>
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
                    {Math.min(indexOfLastItem, filteredFamilies.length)}
                  </span>{" "}
                  {t("admin.of", { defaultValue: "of" })}{" "}
                  <span className="font-medium">{filteredFamilies.length}</span>{" "}
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
                        aria-current={currentPage === page ? "page" : undefined}
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
        isOpen={!!familyToDelete}
        title={t("admin.delete_family", { defaultValue: "Delete Family" })}
        message={t("admin.confirm_delete_family", {
          name: familyToDelete?.family_name,
          defaultValue: `Are you sure you want to delete family "${familyToDelete?.family_name}"?`,
        })}
        onConfirm={handleConfirmDelete}
        onCancel={() => setFamilyToDelete(null)}
      />
    </div>
  );
};

export default FamilyManagement;
