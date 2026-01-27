import { cn } from "@/lib/utils";
import { Mars, Trash2, Venus } from "lucide-react";
import { memo } from "react";
import { Handle, Position } from "reactflow";
import type { MemberNodeViewProps } from "./MemberNode";

const CompactMemberNode = memo((props: MemberNodeViewProps) => {
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
    t,
  } = props;

  const GenderIcon = isMale ? Mars : Venus;

  return (
    <div
      style={{ width, height }}
      className={cn(
        "relative group overflow-hidden rounded-xl border-2 bg-white shadow-md transition-all",
        selected ? "border-blue-500 shadow-xl" : "border-gray-200",
        isMale ? "hover:border-blue-300" : "hover:border-pink-300",
        data.is_fuzzy ? "border-dashed border-4 bg-slate-50" : "border-solid",
        opacityClass,
      )}
    >
      {/* subtle gender tint */}
      <div
        className={cn(
          "absolute inset-0 pointer-events-none",
          isMale ? "bg-blue-50/50" : "bg-pink-50/50",
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
              text-[20px]
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

      {/* Handles */}
      <Handle type="target" position={Position.Top} />
      <Handle type="source" position={Position.Bottom} />

      <Handle type="source" position={Position.Right} id="right-source" />
      <Handle type="target" position={Position.Right} id="right-target" />

      <Handle type="source" position={Position.Left} id="left-source" />
      <Handle type="target" position={Position.Left} id="left-target" />
    </div>
  );
});

export default CompactMemberNode;
