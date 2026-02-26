import { cn } from "@/lib/utils";
import { MapPin, Mars, Trash2, User, Venus } from "lucide-react";
import { memo } from "react";
import { useTranslation } from "react-i18next";
import { Handle, Position } from "reactflow";
import { MemberNodeDisplayProps } from "./MemberNode";

const NormalMemberNode = memo((props: MemberNodeDisplayProps) => {
  const {
    data,
    selected,
    width,
    height,
    displayName,
    age,
    status,
    opacityClass,
    isMale,
    canDelete,
    onDelete,
    dimDeceased,
  } = props;

  const { t } = useTranslation();
  const isDeceased = status === "deceased";
  const isDeceasedStyle = isDeceased && dimDeceased;
  const GenderIcon = isMale ? Mars : Venus;

  // Format birth and death dates for compact display
  // Example: 1980 - 2020 (40)
  const getDisplayYear = (dateStr?: string) => {
    if (!dateStr) return "?";
    if (dateStr.startsWith("-")) {
      // BC date: -0200-01-01 -> 前200
      const parts = dateStr.substring(1).split("-");
      const year = parseInt(parts[0], 10);
      return `前${year}`;
    }
    return dateStr.split("-")[0];
  };

  const birthYear = getDisplayYear(data.birth_date);
  const deathYear = data.death_date ? getDisplayYear(data.death_date) : "";
  const timeline = `${birthYear} - ${isDeceased ? (deathYear || "?") : ""}`;

  // Visual styles for NormalMemberNode
  const containerBorder = selected
    ? "border-blue-500 shadow-xl"
    : isDeceasedStyle
      ? "border-slate-300"
      : "border-gray-200";

  const containerBg = isDeceasedStyle
    ? "bg-slate-50"
    : isDeceased
      ? "bg-slate-50" // Subtle gray bg for undimmed deceased
      : "bg-white";

  const headerBg = !isDeceasedStyle
    ? isDeceased
      ? isMale
        ? "bg-blue-50 border-blue-100" // Lighter than living
        : "bg-pink-50 border-pink-100"
      : isMale
        ? "bg-blue-100 border-blue-200" // Standard living header
        : "bg-pink-100 border-pink-200"
    : "bg-slate-100 border-slate-200";

  const headerIconColor = !isDeceasedStyle
    ? isDeceased
      ? isMale
        ? "text-blue-500" // Slightly muted compared to living
        : "text-pink-500"
      : isMale
        ? "text-blue-700" // Standard living color
        : "text-pink-700"
    : "text-slate-400";

  return (
    <div
      style={{ width, height }}
      className={cn(
        "shadow-md rounded-lg border-2 transition-all relative group flex flex-col overflow-hidden",
        containerBorder,
        isMale ? "hover:border-blue-300" : "hover:border-pink-300",
        data.is_fuzzy
          ? "border-dashed border-2 border-slate-500 bg-slate-100"
          : "border-solid",
        containerBg,
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
          <Trash2 size={16} />
        </button>
      )}

      {/* Header: Name and Status - Explicitly colored background */}
      <div
        className={cn(
          "px-2 py-1.5 border-b flex justify-between items-center shrink-0 h-9 z-10",
          headerBg,
        )}
      >
        <div className="flex items-center gap-1.5 overflow-hidden w-full">
          {/* Gender Indicator Line for deceased (optional, to keep gender info visible) */}
          {isDeceased && (
            <div className={cn(
              "w-1 h-3 rounded-full shrink-0",
              isMale ? "bg-blue-300" : "bg-pink-300"
            )} />
          )}
          
          <GenderIcon
            size={14}
            className={cn(
              "shrink-0",
              headerIconColor,
            )}
          />

          <span
            className={cn(
              "font-bold text-sm truncate flex-1",
              isDeceasedStyle ? "text-gray-600" : "text-gray-800"
            )}
            title={data.name}
          >
            {displayName}
          </span>
          {isDeceased && (
            <span className="text-[10px] px-1.5 py-0.5 bg-slate-200 text-slate-500 rounded-full shrink-0 font-medium">
              {t("member.deceased_abbr", "Dec")}
            </span>
          )}
        </div>
      </div>

      {/* Content Body - White background by default */}
      <div className={cn(
        "flex flex-1 p-2 gap-2 overflow-hidden z-10 relative",
        isDeceasedStyle ? "bg-slate-50/50" : "bg-white/50"
      )}>
        
        {/* Left: Avatar / Photo */}
        <div className="shrink-0 z-10">
          <div className={cn(
            "w-12 h-12 rounded-full flex items-center justify-center overflow-hidden border bg-white shadow-sm",
            !isDeceasedStyle 
              ? (isMale ? "border-blue-100" : "border-pink-100")
              : "border-slate-200", 
            isDeceasedStyle && "grayscale", // Grayscale for deceased only if style applied
            data.photo_url ? "border-0" : ""
          )}>
            {data.photo_url ? (
              <img src={data.photo_url} alt={displayName} className="w-full h-full object-cover" />
            ) : (
              <User
                size={20}
                className={isMale ? "text-blue-400" : "text-pink-400"}
              />
            )}
          </div>
        </div>

        {/* Right: Info */}
        <div className="flex-1 flex flex-col gap-1 min-w-0 z-10">
          {/* Timeline & Age */}
          <div className="flex items-baseline gap-1 text-xs text-gray-700">
            <span className="font-mono">{timeline}</span>
            {age !== null && (
              <span className="text-gray-500 scale-90 origin-left">({age})</span>
            )}
          </div>

          {/* Birth Place */}
          {data.birth_place && (
            <div className="flex items-center gap-1 text-[10px] text-gray-500" title={data.birth_place}>
              <MapPin size={10} className="shrink-0" />
              <span className="truncate">{data.birth_place}</span>
            </div>
          )}

          {/* Remark */}
          {data.remark && (
            <div 
              className="text-[10px] text-gray-400 leading-tight line-clamp-2 mt-auto italic"
              title={data.remark}
            >
              {data.remark}
            </div>
          )}
        </div>
      </div>

      {/* Handles */}
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

export default NormalMemberNode;
