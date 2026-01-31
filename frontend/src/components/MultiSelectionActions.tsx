import { Region } from "@/types";
import { FolderInput, PlusSquare, Trash2 } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

export interface MultiSelectionActionsProps {
  selectedCount: number;
  onDeleteAll: () => void;
  onCreateRegion: () => void;
  onAddToRegion: (regionId: string) => void;
  regions: Region[];
}

export const MultiSelectionActions: React.FC<MultiSelectionActionsProps> = ({
  // selectedCount,
  onDeleteAll,
  onCreateRegion,
  onAddToRegion,
  regions,
}) => {
  const { t } = useTranslation();
  const [showAddToMenu, setShowAddToMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Click outside to close menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowAddToMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={onCreateRegion}
        className="flex items-center gap-2 w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
      >
        <PlusSquare size={18} />
        {t("region.create", { defaultValue: "Create Region" })}
      </button>

      {regions.length > 0 && (
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setShowAddToMenu(!showAddToMenu)}
            className="flex items-center gap-2 w-full px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
          >
            <FolderInput size={18} />
            {t("region.add_to", { defaultValue: "Add to Exsit Region..." })}
          </button>

          {showAddToMenu && (
            <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg overflow-hidden z-20 max-h-48 overflow-y-auto">
              {regions.map((region) => (
                <button
                  key={region.id}
                  onClick={() => {
                    onAddToRegion(region.id);
                    setShowAddToMenu(false);
                  }}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 truncate"
                >
                  {region.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <button
        onClick={onDeleteAll}
        className="flex items-center gap-2 w-full px-4 py-2 bg-red-100 text-red-600 rounded hover:bg-red-200 transition-colors"
      >
        <Trash2 size={18} />
        {t("region.delete_all", { defaultValue: "Delete All" })}
      </button>
    </div>
  );
};
