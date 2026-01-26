import ConfirmDialog from "@/components/ConfirmDialog";
import MemberDetail from "@/components/MemberDetail";
import PropertyPanel from "@/components/PropertyPanel";
import { Loader2, Plus } from "lucide-react";
import React, { useCallback, useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../hooks/useAuth";
import {
    deleteMember,
    deleteParentChildRelationship,
    deleteSpouseRelationship,
    getFamilies,
} from "../../services/api";
import { Family, GraphEdge, Member } from "../../types";
import FamilyManager from "./FamilyManager";
import FamilyTreeCanvas from "./FamilyTreeCanvas";

const Home: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [family, setFamily] = useState<Family | null>(null);
  const [families, setFamilies] = useState<Family[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<GraphEdge | null>(null);
  const [refreshKey, setRefreshKey] = useState(0); // to force refresh canvas
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    memberId: string | null;
    edgeId?: string | null;
    edgeType?: string | null;
  }>({
    isOpen: false,
    memberId: null,
  });

  const role = family?.current_user_role || "viewer";
  const isReadOnly = role === "viewer";

  // Save selected family ID to local storage
  useEffect(() => {
    const familyId = family?.id;
    if (familyId) {
      localStorage.setItem("lastSelectedFamilyId", familyId);
    }
  }, [family?.id]);

  const fetchFamilies = useCallback(async () => {
    try {
      const data = await getFamilies(user?.id);
      setFamilies(data);

      // Always try to respect localStorage first on initial load or if current family is invalid
      const savedFamilyId = localStorage.getItem("lastSelectedFamilyId");

      if (data.length > 0) {
        // 1. If we have a currently selected family, check if it's still valid
        if (family) {
          const currentStillExists = data.find((f) => f.id === family.id);
          if (currentStillExists) {
            if (currentStillExists.family_name !== family.family_name) {
              setFamily(currentStillExists);
            }
            return;
          }
        }

        // 2. If no current family (or invalid), try localStorage
        if (savedFamilyId) {
          const target = data.find((f) => f.id === savedFamilyId);
          if (target) {
            setFamily(target);
            return;
          }
        }

        // 3. Fallback to first
        setFamily(data[0]);
      } else {
        setFamily(null);
      }
    } catch (e) {
      console.error("Fetch families failed", e);
      toast.error("Failed to load family data");
    }
  }, [family, user]);

  // Re-fetch when navigating back to home (optional, but good for sync)
  useEffect(() => {
    // If we have no families loaded yet, fetch.
    if (!loading && families.length === 0) {
      fetchFamilies();
    }
  }, [loading, families.length, fetchFamilies]);

  // Initial load
  useEffect(() => {
    const init = async () => {
      //   console.log("Home init");
      setLoading(true);
      await fetchFamilies();
      setLoading(false);
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run on mount! Removing fetchFamilies from deps to avoid loop

  const handleFamilyCreated = useCallback(async () => {
    await fetchFamilies();
  }, [fetchFamilies]);

  // Listen for member deletion requests from MemberNode
  useEffect(() => {
    const handleRequestDelete = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail) {
        if (customEvent.detail.id) {
          setConfirmState({
            isOpen: true,
            memberId: customEvent.detail.id,
          });
        } else if (customEvent.detail.edgeId) {
          // Handle edge deletion request
          setConfirmState({
            isOpen: true,
            memberId: null,
            edgeId: customEvent.detail.edgeId,
            edgeType: customEvent.detail.edgeType,
          });
        }
      }
    };

    window.addEventListener("request-delete-member", handleRequestDelete);
    return () => {
      window.removeEventListener("request-delete-member", handleRequestDelete);
    };
  }, []);

  const handleRefresh = useCallback(() => {
    // We don't want to force refresh the canvas if it just updates data without layout changes.
    // But adding/removing nodes requires refresh.
    // The issue is ReactFlow instance reset.
    // Actually, we can just let FamilyTreeCanvas fetch data internally without remounting.
    // We can pass a refresh signal to FamilyTreeCanvas instead of key.
    setRefreshKey((prev) => prev + 1);
  }, []);

  const handleConfirmDelete = async () => {
    if (confirmState.memberId) {
      try {
        await deleteMember(confirmState.memberId);
        setConfirmState({ isOpen: false, memberId: null });
        handleRefresh();
        if (selectedMember && selectedMember.id === confirmState.memberId) {
          setSelectedMember(null);
        }
        toast.success("Member deleted successfully");
      } catch (e) {
        console.error("Failed to delete member", e);
        toast.error(t("member.add_failed").replace("add", "delete"));
      }
    } else if (confirmState.edgeId && confirmState.edgeType) {
      try {
        const { edgeId, edgeType } = confirmState;

        if (edgeType === "spouse") {
          await deleteSpouseRelationship(edgeId);
        } else if (edgeType === "parent-child") {
          await deleteParentChildRelationship(edgeId);
        }

        setConfirmState({
          isOpen: false,
          memberId: null,
          edgeId: null,
          edgeType: null,
        });
        handleRefresh();
        toast.success(t("relation.deleted"));
      } catch (e) {
        console.error("Failed to delete relationship", e);
        toast.error(t("relation.delete_failed"));
      }
    }
  };

  const handleCancelDelete = () => {
    setConfirmState({
      isOpen: false,
      memberId: null,
      edgeId: null,
      edgeType: null,
    });
  };

  const handleAddMember = async () => {
    if (!family) return;

    // Create a temporary member object for the UI to display in the sidebar.
    // We won't save it to backend yet.
    // But MemberDetail expects a Member object with an ID.
    // We can generate a temporary ID.
    // Or we can create a "new" mode in MemberDetail.
    // For simplicity with existing types, let's create a fake Member object.
    // And we need to tell MemberDetail that this is a NEW member, so handleSave calls createMember instead of updateMember.
    // But MemberDetail currently only takes `member` and `onUpdate`.

    // Actually, sticking to the current flow (create empty -> edit) is much easier for the codebase structure.
    // If user wants "click add -> fill info -> save to create", we can:
    // 1. Open sidebar with empty form.
    // 2. On save, call createMember.

    // Let's modify Home to support "isNewMember" state.
    // But `selectedMember` is just a Member.

    // Alternative:
    // When "Add Member" is clicked:
    // 1. Do NOT call createMember.
    // 2. Create a dummy member object locally.
    // 3. Set selectedMember to this dummy.
    // 4. Pass a flag or check if ID is "new" in MemberDetail?
    //    Or better, pass a `isNew` prop to MemberDetail?
    //    But MemberDetail is rendered based on selectedMember.

    // Let's make a dummy member with ID 'new_member'.
    const dummyMember: Member = {
      id: "new_member",
      family_id: family.id,
      name: "",
      gender: "male",
      position_x: Math.round(100 + Math.random() * 200),
      position_y: Math.round(100 + Math.random() * 200),
      created_at: "",
      updated_at: "",
    };

    setSelectedMember(dummyMember);
  };

  if (loading) {
    return (
      <div className="h-full w-full flex items-center justify-center">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-full w-full flex flex-col overflow-hidden isolate">
      {/* Header */}
      <div className="h-14 bg-white border-b flex items-center px-4 justify-between shrink-0 z-10 shadow-sm relative pointer-events-auto">
        <FamilyManager
          families={families}
          currentFamily={family}
          onSelectFamily={setFamily}
          onFamilyCreated={handleFamilyCreated}
        />
        <div className="flex gap-2">
          {family && !isReadOnly && (
            <button
              onClick={handleAddMember}
              className="flex items-center gap-2 bg-blue-600 text-white px-3 py-1.5 rounded-md hover:bg-blue-700 transition-colors"
            >
              <Plus size={18} /> {t("member.add")}
            </button>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden relative z-0">
        <div className="flex-1 relative flex flex-col">
          {family ? (
            <>
              {/* Pass refreshKey as a prop, NOT key, to avoid unmounting */}
              <FamilyTreeCanvas
                refreshTrigger={refreshKey}
                familyId={family.id}
                onNodeSelect={(member) => {
                  setSelectedMember(member);
                  setSelectedEdge(null);
                }}
                onEdgeSelect={(edge) => {
                  setSelectedEdge(edge);
                  setSelectedMember(null);
                }}
                readOnly={isReadOnly}
              />
              <div
                className="absolute top-4 left-4 bg-white/80 p-2 rounded text-xs text-gray-500 pointer-events-none"
                dangerouslySetInnerHTML={{ __html: t("relation.instructions") }}
              ></div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-400">
              {t("family.not_found")}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div
          className={`transition-all duration-300 ease-in-out ${selectedMember || selectedEdge ? "w-80" : "w-0"} overflow-hidden border-l`}
        >
          {selectedMember && (
            <MemberDetail
              member={selectedMember}
              onClose={() => setSelectedMember(null)}
              onUpdate={handleRefresh}
              readOnly={isReadOnly}
            />
          )}
          {selectedEdge && (
            <PropertyPanel
              edge={selectedEdge}
              onClose={() => setSelectedEdge(null)}
              onUpdate={handleRefresh}
              readOnly={isReadOnly}
            />
          )}
        </div>
      </div>
      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={confirmState.isOpen}
        title={t("common.delete")}
        message={
          confirmState.edgeId
            ? t("relation.confirm_delete")
            : t("member.confirm_delete")
        }
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
      />
    </div>
  );
};

export default Home;
