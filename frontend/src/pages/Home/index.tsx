import ConfirmDialog from "@/components/ConfirmDialog";
import FamilyManager from "@/components/FamilyManager";
import MemberDetailPanel from "@/components/SidePanel/MemberDetailPanel";
import PropertyPanel from "@/components/SidePanel/PropertyPanel";
import RegionPanel from "@/components/SidePanel/RegionPanel";
import { useAuth } from "@/hooks/useAuth";
import {
  deleteMember,
  deleteParentChildRelationship,
  deleteSpouseRelationship,
  getFamilies,
} from "@/services/api";
import { RootState } from "@/store";
import { setLastSelectedFamilyId } from "@/store/familySlice";
import { Family, GraphEdge, Member, RegionState } from "@/types";
import { Loader2 } from "lucide-react";
import React, { useCallback, useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";
import FamilyTreeCanvas from "./FamilyTreeCanvas";

const Home: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [family, setFamily] = useState<Family | null>(null);
  const [families, setFamilies] = useState<Family[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<GraphEdge | null>(null);
  const [regionState, setRegionState] = useState<RegionState | null>(null);
  const [newMemberPosition, setNewMemberPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);
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

  const dispatch = useDispatch();

  useEffect(() => {
    const familyId = family?.id;
    if (familyId) {
      dispatch(setLastSelectedFamilyId(familyId));
    }
  }, [dispatch, family?.id]);

  const lastSelectedFamilyId = useSelector(
    (root: RootState) => root.family.lastSelectedFamilyId,
  );

  const fetchFamilies = useCallback(async () => {
    try {
      const data = await getFamilies(user?.id);
      setFamilies(data);

      const savedFamilyId = lastSelectedFamilyId;

      if (data.length > 0) {
        // 1. If we have a currently selected family, check if it's still valid
        if (family) {
          const currentStillExists = data.find((f) => f.id === family.id);
          if (currentStillExists) {
            // Update if name changed OR if role is missing (e.g. newly created)
            if (
              currentStillExists.family_name !== family.family_name ||
              !family.current_user_role
            ) {
              setFamily(currentStillExists);
            }
            return;
          }
        }

        // 2. If no current family (or invalid)
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
  }, [family, lastSelectedFamilyId, user?.id]);

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
        toast.error(t("member.delete_failed"));
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

  const handleAddMember = async (position: { x: number; y: number }) => {
    if (!family) return;

    setNewMemberPosition(position);

    // Let's make a dummy member with ID 'new_member'.
    const dummyMember: Member = {
      id: "new_member",
      family_id: family.id,
      name: "",
      gender: "male",
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

  const showSidebar =
    !!selectedMember ||
    !!selectedEdge ||
    (!!regionState && regionState.selectedCount > 1);

  return (
    <div className="h-full w-full flex flex-col overflow-hidden isolate">
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
                onAddMember={handleAddMember}
                readOnly={isReadOnly}
                families={families}
                currentFamily={family}
                onSelectFamily={setFamily}
                onFamilyCreated={handleFamilyCreated}
                onRegionStateChange={setRegionState}
              />
              <div
                className="absolute top-4 left-4 bg-white/80 p-2 rounded text-xs text-gray-500 pointer-events-none"
                dangerouslySetInnerHTML={{ __html: t("relation.instructions") }}
              ></div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-400">
              <div className="flex flex-col items-center gap-4">
                <p>{t("family.not_found")}</p>
                <FamilyManager
                  families={families}
                  currentFamily={family}
                  onSelectFamily={setFamily}
                  onFamilyCreated={handleFamilyCreated}
                />
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div
          className={`transition-all duration-300 ease-in-out ${showSidebar ? "w-80" : "w-0"} overflow-hidden border-l`}
        >
          {selectedMember ? (
            <MemberDetailPanel
              member={selectedMember}
              onClose={() => {
                setSelectedMember(null);
                setNewMemberPosition(null);
              }}
              onUpdate={handleRefresh}
              readOnly={isReadOnly}
              regionState={regionState}
              initialPosition={newMemberPosition || undefined}
            />
          ) : selectedEdge ? (
            <PropertyPanel
              edge={selectedEdge}
              onClose={() => setSelectedEdge(null)}
              onUpdate={handleRefresh}
              readOnly={isReadOnly}
            />
          ) : (
            regionState &&
            regionState.selectedCount > 1 && (
              <RegionPanel
                selectedCount={regionState.selectedCount}
                regions={regionState.regions}
                onDeleteAll={regionState.onDeleteAll}
                onCreateRegion={regionState.onCreateRegion}
                onAddToRegion={regionState.onAddToRegion}
              />
            )
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
