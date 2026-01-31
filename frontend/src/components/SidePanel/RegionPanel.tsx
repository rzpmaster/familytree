import { Region } from "@/types";
import React from "react";
import { useTranslation } from "react-i18next";
import { MultiSelectionActions } from "../MultiSelectionActions";

interface RegionPanelProps {
  selectedCount: number;
  onDeleteAll: () => void;
  onCreateRegion: () => void;
  onAddToRegion: (regionId: string) => void;
  regions: Region[];
}

const RegionPanel: React.FC<RegionPanelProps> = (props) => {
  const { t } = useTranslation();
  const { selectedCount } = props;

  // If 1 member selected, MemberDetailPanel handles it.
  // If 0, nothing.
  // The parent component should handle visibility logic now to prevent flickering
  // if (selectedCount < 2) return null;

  return (
    <div className="h-full w-full flex flex-col bg-white">
      <div className="p-4 border-b flex justify-between items-center bg-gray-50">
        <h2 className="text-lg font-semibold">多选</h2>
      </div>
      <div className="p-4">
        {t("region.selected_nodes", {
          count: selectedCount,
          defaultValue: `Selected ${selectedCount} nodes`,
        })}
      </div>
      <div className="p-3 bg-blue-50 border border-blue-100 rounded-md">
        <h3 className="text-sm font-semibold text-blue-900 mb-2">
          {t("region.actions", { defaultValue: "Region Actions" })}
        </h3>
        <MultiSelectionActions {...props} />
      </div>
    </div>
  );
};

export default RegionPanel;
