import {
  getCompactNodeHeight,
  getCompactNodeWidth,
  getNodeHeight,
  getNodeWidth,
} from "@/config/constants";
import { useFamily } from "@/contexts/FamilyContext";
import { useAuth } from "@/hooks/useAuth";
import { getAge, getMemberStatus, getSurname } from "@/lib/utils";
import { RootState } from "@/store";
import { Member } from "@/types";
import React, { memo } from "react";
import { useSelector } from "react-redux";
import { NodeProps } from "reactflow";
import CompactMemberNode from "./CompactMemberNode";
import NormalMemberNode from "./NormalMemberNode";

// Props passed to the display components (Normal/Compact)
export interface MemberNodeDisplayProps {
  data: Member;
  selected: boolean;
  width: number;
  height: number;
  displayName: string;
  rawName: string;
  age: number | null;
  status: "alive" | "deceased" | "unborn" | string;
  opacityClass: string;
  isMale: boolean;
  canDelete: boolean;
  onDelete: (e: React.MouseEvent) => void;
}

const MemberNode = memo(({ data, selected }: NodeProps<Member>) => {
  const { user } = useAuth();

  const {
    privacyMode,
    showLiving,
    showNotLiving,
    showDeceased,
    dimDeceased,
    showUnborn,
    dimUnborn,
    timelineEnabled,
    timelineYear,
    compactMode,
  } = useSelector((state: RootState) => state.settings);

  const width = compactMode ? getCompactNodeWidth() : getNodeWidth();
  const height = compactMode ? getCompactNodeHeight() : getNodeHeight();

  const family = useFamily();

  const canDelete =
    !!user &&
    !!family &&
    (family.current_user_role === "admin" ||
      family.current_user_role === "owner") &&
    !data.isLinked;

  const onDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canDelete) return;
    window.dispatchEvent(
      new CustomEvent("request-delete-member", { detail: { id: data.id } }),
    );
  };

  // ===== status / age =====
  const effectiveYear =
    timelineEnabled && timelineYear !== null ? timelineYear : undefined;
  const status = getMemberStatus(data, effectiveYear);
  const age = getAge(data.birth_date, data.death_date, effectiveYear);

  let opacityClass = "";
  if (status === "living") {
    if (!showLiving) {
      opacityClass = "opacity-0 pointer-events-none";
    }
  } else if (status === "deceased") {
    if (!showNotLiving || !showDeceased) {
      opacityClass = "opacity-0 pointer-events-none";
    } else if (dimDeceased) {
      opacityClass = "opacity-60 grayscale";
    }
  } else if (status === "unborn") {
    if (!showNotLiving || !showUnborn) {
      opacityClass = "opacity-0 pointer-events-none";
    } else if (dimUnborn) {
      opacityClass = "opacity-30 border-dashed";
    }
  }

  const rawName = privacyMode
    ? data.surname || getSurname(data.name)
    : data.name;

  // Compact mode: replace spaces so vertical text looks clean
  const displayName = compactMode ? rawName.replace(/\s+/g, "·") : rawName;

  const isMale = data.gender === "male";

  const viewProps: MemberNodeDisplayProps = {
    data,
    selected: !!selected,
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
  };

  return compactMode ? (
    <CompactMemberNode {...viewProps} />
  ) : (
    <NormalMemberNode {...viewProps} />
  );
});

export default MemberNode;
