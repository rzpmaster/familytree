import { cn } from "@/lib/utils";
import { Mars, Trash2, Venus } from "lucide-react";
import { memo } from "react";
import { useTranslation } from "react-i18next";
import { Handle, Position } from "reactflow";
import { MemberNodeProps } from "./MemberNode";

const CompactMemberNode = memo((props: MemberNodeProps) => {
  const {
    data,
    selected,
    width,
    height,
    displayName,
    rawName,
    age,
    opacityClass,
    isMale,
    canDelete,
    onDelete,
  } = props;

  const GenderIcon = isMale ? Mars : Venus;

  const { t } = useTranslation();

  return (
    <div
      style={{ width, height }}
      className={cn(
        "relative group overflow-hidden rounded-xl border-2 bg-white shadow-md transition-all",
        selected ? "border-blue-500 shadow-xl" : "border-gray-200",
        isMale ? "hover:border-blue-300" : "hover:border-pink-300",
        data.is_fuzzy
          ? "border-dashed border-2 border-slate-500 bg-slate-100"
          : "border-solid",
        !data.is_deceased ? "bg-white" : "bg-slate-50",
        opacityClass,
      )}
    >
      {/* subtle gender tint */}
      <div
        className={cn(
          "absolute inset-0 pointer-events-none",
          !data.is_deceased
            ? isMale
              ? "bg-blue-100/60"
              : "bg-pink-100/60"
            : isMale
              ? "bg-blue-50/40"
              : "bg-pink-50/40",
        )}
      />

      {/* Gender icon (top-left) */}
      <div className="absolute left-2 top-2 z-20">
        <div
          className={cn(
            "w-7 h-7 rounded-full bg-white/90 border shadow-sm flex items-center justify-center backdrop-blur",
            isMale ? "text-blue-600" : "text-pink-600",
          )}
          title={t(`member.${data.gender}`)}
        >
          <GenderIcon size={16} />
        </div>
      </div>

      {canDelete && (
        <button
          className="absolute -top-2 -right-2 z-50 rounded-full bg-red-100 p-1 text-red-600 opacity-0 shadow-sm transition-opacity group-hover:opacity-100 nodrag"
          onClick={onDelete}
          onMouseDown={(e) => e.stopPropagation()}
          title={t("delete")}
        >
          <Trash2 size={18} />
        </button>
      )}

      {/* Name (vertical, NOT bold) */}
      <div className="absolute inset-0 flex items-center justify-center p-2">
        <div className="h-full w-full overflow-hidden flex items-center justify-center">
          <div
            className="
            font-normal text-gray-800
            text-[28px]
            [writing-mode:vertical-rl]
            [text-orientation:mixed]
            leading-none
            text-center
            select-none
          "
            title={rawName}
          >
            {displayName}
          </div>
        </div>
      </div>

      {/* Age bottom-right */}
      {age !== null && (
        <div className="absolute right-2 bottom-2 z-20">
          <span
            className="text-[11px] px-2 py-1 rounded-md shadow-sm border bg-white/90 text-gray-700 backdrop-blur"
            title={t("member.age")}
          >
            {age}
            {t("member.age_unit", { defaultValue: "岁" })}
          </span>
        </div>
      )}

      {/* Handles (hover only, bigger, above dashed border) */}
      <Handle
        type="target"
        position={Position.Top}
        className="!z-[60] !w-4 !h-4 !border-2 !opacity-0 group-hover:!opacity-100 transition-opacity"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="!z-[60] !w-4 !h-4 !border-2 !opacity-0 group-hover:!opacity-100 transition-opacity"
      />

      <Handle
        type="source"
        position={Position.Right}
        id="right-source"
        className="!z-[60] !w-4 !h-4 !border-2 !opacity-0 group-hover:!opacity-100 transition-opacity"
      />
      <Handle
        type="target"
        position={Position.Right}
        id="right-target"
        className="!z-[60] !w-4 !h-4 !border-2 !opacity-0 group-hover:!opacity-100 transition-opacity"
      />

      <Handle
        type="source"
        position={Position.Left}
        id="left-source"
        className="!z-[60] !w-4 !h-4 !border-2 !opacity-0 group-hover:!opacity-100 transition-opacity"
      />
      <Handle
        type="target"
        position={Position.Left}
        id="left-target"
        className="!z-[60] !w-4 !h-4 !border-2 !opacity-0 group-hover:!opacity-100 transition-opacity"
      />
    </div>
  );
});

export default CompactMemberNode;
