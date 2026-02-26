import {
  ArrowRight,
  Download,
  Edit2,
  Map,
  Share2,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import React, { useCallback, useState } from "react";
import { toast } from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { cn } from "../../lib/utils";
import { createAccessRequest } from "../../services/api";
import { Family, Member, Region } from "../../types";

interface FamilyCardProps {
  family: Family;
  members: Member[];
  regions?: Region[];
  onEnter: (family: Family) => void;
  onDelete: (id: string) => void;
  onEdit: (family: Family) => void;
  onExport: (family: Family) => void;
  onShare: (family: Family) => void;
  onManageRegions: (family: Family) => void;
  currentUserId?: string;
}

const FamilyCard: React.FC<FamilyCardProps> = ({
  family,
  members,
  regions = [],
  onEnter,
  onDelete,
  onEdit,
  onExport,
  onShare,
  onManageRegions,
  currentUserId,
}) => {
  const { t } = useTranslation();
  const [requestLoading, setRequestLoading] = useState(false);

  const total = members.length;
  const males = members.filter((m) => m.gender === "male").length;
  const females = members.filter((m) => m.gender === "female").length;

  const role = family.current_user_role || "viewer";
  const canEdit = role === "owner" || role === "editor" || role === "admin";
  const isOwner = role === "owner";
  const isAdmin = role === "admin";
  const canManage = isOwner || isAdmin;

  // Age/Date stats
  const sortedByBirth = [...members]
    .filter((m) => m.birth_date)
    .sort((a, b) => {
      const dateA = a.birth_date!;
      const dateB = b.birth_date!;
      const aIsBC = dateA.startsWith("-");
      const bIsBC = dateB.startsWith("-");

      if (aIsBC && bIsBC) {
        // Both BC: Descending string sort puts "-0256" (older) before "-0195" (younger)
        // "-0256" > "-0195" in string. We want -0256 to be "smaller" (return -1)
        return dateB.localeCompare(dateA);
      }
      if (aIsBC) return -1; // A is BC (older), B is AD
      if (bIsBC) return 1; // B is BC (older), A is AD

      // Both AD: Ascending string sort
      // new Date(a).getTime() - new Date(b).getTime() is roughly equivalent to string compare for ISO
      return dateA.localeCompare(dateB);
    });

  const oldest = sortedByBirth.length > 0 ? sortedByBirth[0] : null;
  const youngest =
    sortedByBirth.length > 0 ? sortedByBirth[sortedByBirth.length - 1] : null;

  // Calculate longest living (based on death_date - birth_date)
  const longestLiving = [...members]
    .filter((m) => m.birth_date && m.death_date)
    .sort((a, b) => {
      // Simple approximation: year diff
      // For more precision, we need to parse dates carefully (handling BC)

      const parseYear = (dateStr: string) => {
        // If starts with -, it's BC
        const isBC = dateStr.startsWith("-");
        const parts = dateStr.replace(/^-/, "").split("-");
        const year = parseInt(parts[0]);
        return isBC ? -year : year;
      };

      const ageA = parseYear(a.death_date!) - parseYear(a.birth_date!);
      const ageB = parseYear(b.death_date!) - parseYear(b.birth_date!);
      return ageB - ageA; // Descending
    })[0];

  const handleRequestAccess = useCallback(async () => {
    if (!currentUserId) return;
    try {
      setRequestLoading(true);
      await createAccessRequest(family.id, currentUserId);
      toast.success(t("family.request_sent", { defaultValue: "Request sent" }));
    } catch (error) {
      console.error("Failed to request access", error);
      toast.error(
        t("family.request_failed", { defaultValue: "Request failed" }),
      );
    } finally {
      setRequestLoading(false);
    }
  }, [currentUserId, family.id, t]);

  return (
    <div className="bg-white p-5 rounded-lg shadow-sm border hover:shadow-md transition-shadow relative">
      <div className="flex justify-between items-start mb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-xl font-bold text-gray-800">
              {family.family_name}
            </h3>
            {/* Role Badge */}
            <span
              className={cn(
                "badge",
                isOwner
                  ? "badge-purple"
                  : isAdmin
                    ? "badge-indigo"
                    : canEdit
                      ? "badge-primary"
                      : "badge-gray",
              )}
            >
              {isOwner
                ? t("family.owner", { defaultValue: "Owner" })
                : isAdmin
                  ? t("family.role_admin", { defaultValue: "Admin" })
                  : canEdit
                    ? t("family.role_editor", { defaultValue: "Editor" })
                    : t("family.role_viewer", { defaultValue: "Viewer" })}
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-1">ID: {family.id}</p>
          <p className="text-xs text-gray-400 mt-1">
            {t("common.created_at")}:{" "}
            {new Date(family.created_at).toLocaleDateString()}
          </p>
          {family.description && (
            <p className="text-sm text-gray-600 mt-2 line-clamp-2">
              {family.description}
            </p>
          )}
        </div>
        <div className="flex gap-2 items-center">
          {/* Request Access Button for Viewers */}
          {role === "viewer" && !isOwner && (
            <button
              onClick={handleRequestAccess}
              disabled={requestLoading}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-blue-50 text-blue-600 rounded hover:bg-blue-100 transition-colors disabled:opacity-50"
            >
              <UserPlus size={14} />
              {requestLoading
                ? t("common.processing")
                : t("family.request_access", {
                    defaultValue: "Request Access",
                  })}
            </button>
          )}

          {canManage && (
            <>
              <button
                onClick={() => onShare(family)}
                className="btn-icon text-purple-600 hover:bg-purple-50 tooltip"
                title={t("family.share", { defaultValue: "Share" })}
              >
                <Share2 size={18} />
              </button>
              <button
                onClick={() => onManageRegions(family)}
                className="btn-icon text-green-600 hover:bg-green-50 tooltip"
                title={t("family.manage_regions", {
                  defaultValue: "Manage Regions",
                })}
              >
                <Map size={18} />
              </button>
            </>
          )}
          <button
            onClick={() => onExport(family)}
            className="btn-icon tooltip"
            title={t("family.export_json", { defaultValue: "Export JSON" })}
          >
            <Download size={18} />
          </button>
          {canEdit && (
            <button
              onClick={() => onEdit(family)}
              className="btn-icon text-blue-600 hover:bg-blue-50 tooltip"
              title={t("family.edit", { defaultValue: "Edit" })}
            >
              <Edit2 size={18} />
            </button>
          )}
          <button
            onClick={() => onEnter(family)}
            className="btn-icon text-blue-600 hover:bg-blue-50 tooltip"
            title={t("family.enter", { defaultValue: "Enter" })}
          >
            <ArrowRight size={20} />
          </button>
          {isOwner && (
            <button
              onClick={() => onDelete(family.id)}
              className="btn-icon text-red-600 hover:bg-red-50"
              title={t("family.delete", { defaultValue: "Delete" })}
            >
              <Trash2 size={20} />
            </button>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3">
        <div className="bg-gray-50 rounded-md p-3 grid grid-cols-3 gap-4">
          {/* Total */}
          <div className="flex flex-col">
            <span className="text-xs text-gray-500 uppercase tracking-wider">
              {t("family.members_count", { defaultValue: "Members" })}
            </span>
            <span className="text-lg font-semibold flex items-center gap-1">
              <Users size={16} className="text-blue-600" />
              {total}
            </span>
          </div>

          {/* Gender */}
          <div className="flex flex-col">
            <span className="text-xs text-gray-500 uppercase tracking-wider">
              {t("family.gender_ratio", { defaultValue: "Gender" })}
            </span>
            <div className="flex flex-col text-sm font-medium">
              <span className="text-blue-600">
                {t("member.male")}: {males}
              </span>
              <span className="text-pink-600">
                {t("member.female")}: {females}
              </span>
            </div>
          </div>

          {/* Regions */}
          <div className="flex flex-col">
            <span className="text-xs text-gray-500 uppercase tracking-wider">
              {t("family.regions", { defaultValue: "Regions" })}
            </span>
            <span
              className="text-lg font-semibold flex items-center gap-1"
              title={regions.map((r) => r.name).join(", ")}
            >
              <Map size={16} className="text-green-600" />
              {regions.length}
            </span>
          </div>
        </div>

        <div className="bg-gray-50 rounded-md p-3 grid grid-cols-3 gap-4">
          {/* Oldest */}
          <div className="flex flex-col">
            <span className="text-xs text-gray-500 uppercase tracking-wider">
              {t("family.oldest_member", { defaultValue: "Oldest" })}
            </span>
            <span
              className="text-sm font-medium truncate"
              title={oldest?.name || "-"}
            >
              {oldest ? oldest.name : "-"}
            </span>
            {oldest?.birth_date && (
              <span className="text-xs text-gray-400">{oldest.birth_date}</span>
            )}
          </div>

          {/* Youngest */}
          <div className="flex flex-col">
            <span className="text-xs text-gray-500 uppercase tracking-wider">
              {t("family.youngest_member", { defaultValue: "Youngest" })}
            </span>
            <span
              className="text-sm font-medium truncate"
              title={youngest?.name || "-"}
            >
              {youngest ? youngest.name : "-"}
            </span>
            {youngest?.birth_date && (
              <span className="text-xs text-gray-400">
                {youngest.birth_date}
              </span>
            )}
          </div>

          {/* Longest Living */}
          <div className="flex flex-col">
            <span className="text-xs text-gray-500 uppercase tracking-wider">
              {t("family.longest_living", { defaultValue: "Longest Living" })}
            </span>
            <span
              className="text-sm font-medium truncate"
              title={longestLiving?.name || "-"}
            >
              {longestLiving ? longestLiving.name : "-"}
            </span>
            {longestLiving && (
              <span className="text-xs text-gray-400">
                {/* Calculate age roughly */}
                {parseInt(
                  longestLiving.death_date!.replace(/^-/, "").split("-")[0],
                ) *
                  (longestLiving.death_date!.startsWith("-") ? -1 : 1) -
                  parseInt(
                    longestLiving.birth_date!.replace(/^-/, "").split("-")[0],
                  ) *
                    (longestLiving.birth_date!.startsWith("-") ? -1 : 1)}{" "}
                {t("member.years_old", { defaultValue: "years old" })}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FamilyCard;
