import { cn } from "@/lib/utils";
import { Mars, Trash2, Venus } from "lucide-react";
import { memo } from "react";
import { useTranslation } from "react-i18next";
import { Handle, Position } from "reactflow";
import { MemberNodeDisplayProps } from "./MemberNode";

const CompactMemberNode = memo((props: MemberNodeDisplayProps) => {
  const {
    data,
    selected,
    width,
    height,
    displayName,
    rawName,
    age,
    status,
    opacityClass,
    isMale,
    canDelete,
    onDelete,
    dimDeceased,
  } = props;

  const GenderIcon = isMale ? Mars : Venus;

  const { t } = useTranslation();
  const isDeceased = status === "deceased" || status === "unborn";
  const isDeceasedStyle = isDeceased && dimDeceased;

  // Visual style variables
  const borderColor = selected
    ? "border-blue-500 shadow-xl"
    : isDeceasedStyle
      ? "border-slate-300"
      : "border-gray-200";

  const hoverBorderColor = !isDeceasedStyle
    ? isMale
      ? "hover:border-blue-300"
      : "hover:border-pink-300"
    : "hover:border-slate-400";

  const bgColor = !isDeceasedStyle
    ? isDeceased
      ? "bg-slate-50" // Subtle gray bg for deceased when NOT dimmed
      : "bg-white"
    : "bg-slate-50";

  const tintColor = !isDeceasedStyle
    ? isDeceased
      ? isMale
        ? "bg-blue-100/50" // Visible but lighter than living
        : "bg-pink-100/50"
      : isMale
        ? "bg-blue-200/60" // Standard living tint
        : "bg-pink-200/60"
    : "bg-slate-100/50";

  const iconColor = !isDeceasedStyle
    ? isDeceased
      ? isMale
        ? "text-blue-500" // Visible but slightly muted compared to living
        : "text-pink-500"
      : isMale
        ? "text-blue-700" // Standard living color
        : "text-pink-700"
    : "text-slate-600";

  return (
    <div
      style={{ width, height }}
      className={cn(
        "relative group overflow-hidden rounded-xl border-2 shadow-md transition-all",
        borderColor,
        hoverBorderColor,
        data.is_fuzzy
          ? "border-dashed border-2 border-slate-500 bg-slate-100"
          : "border-solid",
        bgColor,
        opacityClass,
      )}
    >
      {/* subtle gender tint */}
      <div
        className={cn(
          "absolute inset-0 pointer-events-none",
          tintColor,
        )}
      />

      {/* Gender icon (top-left) */}
      <div className="absolute left-2 top-2 z-20">
        <div
          className={cn(
            "w-7 h-7 rounded-full bg-white/90 border shadow-sm flex items-center justify-center backdrop-blur",
            iconColor,
          )}
          title={t(`member.${data.gender}`)}
        >
          <GenderIcon size={16} />
        </div>
      </div>

      {/* Deceased Label (top-right) */}
      {isDeceased && (
        <div className="absolute right-2 top-2 z-20">
          <span
            className={cn(
              "text-[10px] px-1.5 py-0.5 rounded-full border shadow-sm backdrop-blur font-medium",
              isDeceasedStyle
                ? "bg-slate-200/80 text-slate-600 border-slate-300"
                : "bg-slate-100/80 text-slate-500 border-slate-200",
            )}
            title={t("member.deceased")}
          >
            {t("member.deceased_abbr", "Dec")}
          </span>
        </div>
      )}

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
            className={cn(
              "font-normal text-[28px] [writing-mode:vertical-rl] [text-orientation:mixed] leading-none text-center select-none",
              isDeceasedStyle ? "text-gray-600" : "text-gray-800",
            )}
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
            className={cn(
              "text-[11px] px-2 py-1 rounded-md shadow-sm border bg-white/90 backdrop-blur",
              isDeceasedStyle ? "text-gray-500" : "text-gray-700",
            )}
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
        className="!z-[60] !w-3 !h-3 !border-2 !opacity-0 group-hover:!opacity-100 transition-opacity"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="!z-[60] !w-3 !h-3 !border-2 !opacity-0 group-hover:!opacity-100 transition-opacity"
      />

      <Handle
        type="source"
        position={Position.Right}
        id="right-source"
        className="!z-[60] !w-3 !h-3 !border-2 !opacity-0 group-hover:!opacity-100 transition-opacity !bg-pink-500"
      />
      <Handle
        type="target"
        position={Position.Right}
        id="right-target"
        className="!z-[60] !w-3 !h-3 !border-2 !opacity-0 group-hover:!opacity-100 transition-opacity !bg-pink-500"
      />

      <Handle
        type="source"
        position={Position.Left}
        id="left-source"
        className="!z-[60] !w-3 !h-3 !border-2 !opacity-0 group-hover:!opacity-100 transition-opacity !bg-pink-500"
      />
      <Handle
        type="target"
        position={Position.Left}
        id="left-target"
        className="!z-[60] !w-3 !h-3 !border-2 !opacity-0 group-hover:!opacity-100 transition-opacity !bg-pink-500"
      />
    </div>
  );
});

export default CompactMemberNode;
