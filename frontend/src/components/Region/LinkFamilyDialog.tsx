import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../hooks/useAuth";
import { getFamilies } from "../../services/api";
import { Family } from "../../types";

interface LinkFamilyDialogProps {
  isOpen: boolean;
  currentFamilyId: string;
  onClose: () => void;
  onConfirm: (family: Family) => void;
}

const LinkFamilyDialog: React.FC<LinkFamilyDialogProps> = ({
  isOpen,
  currentFamilyId,
  onClose,
  onConfirm,
}) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [families, setFamilies] = useState<Family[]>([]);
  const [selectedFamilyId, setSelectedFamilyId] = useState<string>("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && user) {
      setLoading(true);
      getFamilies(user.id)
        .then((data) => {
          const available = data.filter((f) => f.id !== currentFamilyId);
          setFamilies(available);
          if (available.length > 0) {
            setSelectedFamilyId(available[0].id);
          }
        })
        .finally(() => setLoading(false));
    }
  }, [isOpen, user, currentFamilyId]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const family = families.find((f) => f.id === selectedFamilyId);
    if (family) {
      onConfirm(family);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl p-6 w-96">
        <h2 className="text-xl font-bold mb-4">
          {t("region.link_family_title", {
            defaultValue: "Link Existing Family",
          })}
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          {t("region.link_family_desc", {
            defaultValue: "Select a family to link as a region.",
          })}
        </p>

        {loading ? (
          <div className="text-center py-4">Loading...</div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t("family.select", { defaultValue: "Select Family" })}
              </label>
              <select
                value={selectedFamilyId}
                onChange={(e) => setSelectedFamilyId(e.target.value)}
                className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                {families.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.family_name}
                  </option>
                ))}
              </select>
              {families.length === 0 && (
                <p className="text-red-500 text-sm mt-1">
                  No other families available.
                </p>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded"
              >
                {t("common.cancel", { defaultValue: "Cancel" })}
              </button>
              <button
                type="submit"
                disabled={families.length === 0}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-300"
              >
                {t("common.confirm", { defaultValue: "Confirm" })}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default LinkFamilyDialog;
