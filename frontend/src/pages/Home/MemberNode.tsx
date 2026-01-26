import { getNodeHeight, getNodeWidth } from "@/config/constants";
import { useAuth } from "@/hooks/useAuth";
import { getFamily } from "@/services/api";
import { RootState } from "@/store";
import { Family, Member } from "@/types";
import clsx from "clsx";
import { Trash2, User } from "lucide-react";
import React, { memo, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import { Handle, Position } from "reactflow";
interface MemberNodeProps {
  data: Member;
  selected: boolean;
}

const MemberNode = memo(({ data, selected }: MemberNodeProps) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const width = getNodeWidth();
  const height = getNodeHeight();

  const lastSelectedFamilyId = useSelector(
    (root: RootState) => root.family.lastSelectedFamilyId,
  );

  const [family, setFamily] = useState<Family | null>(null);
  useEffect(() => {
    if (!lastSelectedFamilyId || !user?.id) return;

    const fetchFamily = async () => {
      try {
        const f = await getFamily(String(lastSelectedFamilyId), user.id);
        setFamily(f);
      } catch (e) {
        console.error("getFamily failed", e);
      }
    };

    fetchFamily();
  }, [lastSelectedFamilyId, user?.id]);

  // Only allow delete if user owns the family (checked via context usually, but here we just check generic auth)
  // Ideally we should check if family.user_id === user.id
  // But for now, we just check if logged in.
  const canDelete = () => {
    if (!user) return false;
    if (!family) return false;
    return (
      family.current_user_role === "admin" ||
      family.current_user_role == "owner"
    );
  };

  const isMale = data.gender === "male";

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canDelete()) return;
    // Dispatch custom event that Home.tsx listens to?
    // Or use ReactFlow context?
    // Since we can't easily pass callbacks through ReactFlow nodes without context/store,
    // We'll dispatch a window event or use a global store.
    // For simplicity in this refactor, let's emit a CustomEvent.
    const event = new CustomEvent("request-delete-member", {
      detail: { id: data.id },
    });
    window.dispatchEvent(event);
  };

  return (
    <div
      style={{ width, height }}
      className={clsx(
        "shadow-md rounded-lg border-2 bg-white transition-all relative group flex flex-col",
        selected ? "border-blue-500 shadow-xl" : "border-gray-200",
        isMale ? "hover:border-blue-300" : "hover:border-pink-300",
      )}
    >
      {canDelete() && (
        <button
          className="absolute -top-2 -right-2 bg-red-100 hover:bg-red-200 text-red-600 rounded-full p-1 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity z-50 nodrag"
          onClick={handleDelete}
          onMouseDown={(e) => e.stopPropagation()}
          title={t("delete")}
        >
          <Trash2 size={20} />
        </button>
      )}

      <div
        className={clsx(
          "p-2 border-b flex justify-between items-center rounded-t-md shrink-0",
          isMale ? "bg-blue-50" : "bg-pink-50",
        )}
      >
        <div className="flex items-center gap-2 overflow-hidden">
          <User
            size={16}
            className={clsx(
              "shrink-0",
              isMale ? "text-blue-500" : "text-pink-500",
            )}
          />
          <span
            className="font-bold text-sm text-gray-700 truncate"
            title={data.name}
          >
            {data.name}
          </span>
        </div>
      </div>

      <div className="p-3 text-xs text-gray-500 space-y-1 flex-1 overflow-hidden">
        <div>
          {t("member.gender")}: {t(`member.${data.gender}`)}
        </div>
        {data.birth_date && (
          <div>
            {t("member.birth_date")}: {data.birth_date}
          </div>
        )}
        {data.death_date && (
          <div>
            {t("member.death_date")}: {data.death_date}
          </div>
        )}
        {data.birth_place && (
          <div className="truncate">
            {t("member.birth_place")}: {data.birth_place}
          </div>
        )}
      </div>

      {/* Handles for connecting nodes */}
      <Handle
        type="target"
        position={Position.Top}
        className="w-3 h-3 bg-gray-400 opacity-0 group-hover:opacity-100 transition-opacity !bg-black"
        title={t("relation.parent_child")}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="w-3 h-3 bg-gray-400 opacity-0 group-hover:opacity-100 transition-opacity !bg-black"
        title={t("relation.parent_child")}
      />

      <Handle
        type="source"
        position={Position.Right}
        id="right-source"
        className="w-3 h-3 bg-gray-400 opacity-0 group-hover:opacity-100 transition-opacity !bg-[#ff0072]"
        title={t("relation.spouse")}
        style={{ top: "50%", transform: "translate(50%, -50%)", zIndex: 10 }}
      />
      <Handle
        type="target"
        position={Position.Right}
        id="right-target"
        className="w-3 h-3 bg-gray-400 opacity-0 group-hover:opacity-100 transition-opacity !bg-[#ff0072]"
        title={t("relation.spouse")}
        style={{ top: "50%", transform: "translate(50%, -50%)", zIndex: 1 }}
      />

      <Handle
        type="source"
        position={Position.Left}
        id="left-source"
        className="w-3 h-3 bg-gray-400 opacity-0 group-hover:opacity-100 transition-opacity !bg-[#ff0072]"
        title={t("relation.spouse")}
        style={{ top: "50%", transform: "translate(-50%, -50%)", zIndex: 10 }}
      />
      <Handle
        type="target"
        position={Position.Left}
        id="left-target"
        className="w-3 h-3 bg-gray-400 opacity-0 group-hover:opacity-100 transition-opacity !bg-[#ff0072]"
        title={t("relation.spouse")}
        style={{ top: "50%", transform: "translate(-50%, -50%)", zIndex: 1 }}
      />
    </div>
  );
});

export default MemberNode;
