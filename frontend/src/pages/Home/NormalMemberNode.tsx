import { cn } from "@/lib/utils";
import { Trash2, User } from "lucide-react";
import { memo } from "react";
import { useTranslation } from "react-i18next";
import { Handle, Position } from "reactflow";
import { MemberNodeProps } from "./MemberNode";

const NormalMemberNode = memo((props: MemberNodeProps) => {
  const {
    data,
    selected,
    width,
    height,
    displayName,
    age,
    // status,
    opacityClass,
    isMale,
    canDelete,
    onDelete,
  } = props;

  const { t } = useTranslation();

  return (
    <div
      style={{ width, height }}
      className={cn(
        "shadow-md rounded-lg border-2 bg-white transition-all relative group flex flex-col overflow-hidden",
        selected ? "border-blue-500 shadow-xl" : "border-gray-200",
        isMale ? "hover:border-blue-300" : "hover:border-pink-300",
        data.is_fuzzy
          ? "border-dashed border-2 border-slate-500 bg-slate-100"
          : "border-solid",
        opacityClass,
      )}
    >
      {canDelete && (
        <button
          className="absolute -top-2 -right-2 bg-red-100 hover:bg-red-200 text-red-600 rounded-full p-1 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity z-50 nodrag"
          onClick={onDelete}
          onMouseDown={(e) => e.stopPropagation()}
          title={t("delete")}
        >
          <Trash2 size={20} />
        </button>
      )}

      {/* Header */}
      <div
        className={cn(
          "p-2 border-b flex justify-between items-center shrink-0",
          isMale ? "bg-blue-50" : "bg-pink-50",
          "rounded-t-md",
        )}
      >
        <div className="flex items-center gap-2 overflow-hidden">
          <User
            size={16}
            className={cn(
              "shrink-0",
              isMale ? "text-blue-500" : "text-pink-500",
            )}
          />
          <span
            className="font-bold text-sm text-gray-700 truncate"
            title={data.name}
          >
            {displayName}
          </span>
        </div>
      </div>

      {/* Content */}
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
        {age !== null && (
          <div>
            {t("member.age")}: {age}
          </div>
        )}
        {data.remark && (
          <div className="italic text-gray-400 truncate" title={data.remark}>
            {data.remark}
          </div>
        )}

        {/* Optional: status hint (keep as you like)
        {status === "deceased" && (
          <div className="text-[11px] text-gray-400">
            {t("member.deceased")}
          </div>
        )} */}
      </div>

      {/* Handles */}
      <Handle
        type="target"
        position={Position.Top}
        className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity !bg-black"
        title={t("relation.parent_child")}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity !bg-black"
        title={t("relation.parent_child")}
      />

      <Handle
        type="source"
        position={Position.Right}
        id="right-source"
        className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity !bg-[#ff0072]"
        title={t("relation.spouse")}
        style={{ top: "50%", transform: "translate(50%, -50%)", zIndex: 10 }}
      />
      <Handle
        type="target"
        position={Position.Right}
        id="right-target"
        className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity !bg-[#ff0072]"
        title={t("relation.spouse")}
        style={{ top: "50%", transform: "translate(50%, -50%)", zIndex: 1 }}
      />

      <Handle
        type="source"
        position={Position.Left}
        id="left-source"
        className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity !bg-[#ff0072]"
        title={t("relation.spouse")}
        style={{ top: "50%", transform: "translate(-50%, -50%)", zIndex: 10 }}
      />
      <Handle
        type="target"
        position={Position.Left}
        id="left-target"
        className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity !bg-[#ff0072]"
        title={t("relation.spouse")}
        style={{ top: "50%", transform: "translate(-50%, -50%)", zIndex: 1 }}
      />
    </div>
  );
});

export default NormalMemberNode;
