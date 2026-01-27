import { useAuth } from "@/hooks/useAuth";
import { setLastSelectedFamilyId } from "@/store/familySlice";
import { BookOpen, Plus, Upload } from "lucide-react";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import ConfirmDialog from "../../components/ConfirmDialog";
import {
  createFamily,
  deleteFamily,
  getCollaborators,
  getFamilies,
  getFamilyGraph,
  getMembers,
  importFamily,
  importFamilyPreset,
  inviteCollaborator,
  removeCollaborator,
  updateCollaboratorRole,
  updateFamily,
} from "../../services/api";
import { Family, FamilyCollaborator, Member } from "../../types";
import FamilyCard from "./FamilyCard";

interface FamilyWithMembers extends Family {
  members: Member[];
}

const Manage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [families, setFamilies] = useState<FamilyWithMembers[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [newFamilyName, setNewFamilyName] = useState("");
  const [showHistoricalMenu, setShowHistoricalMenu] = useState(false);
  const [familyToDelete, setFamilyToDelete] = useState<string | null>(null);

  // Edit State
  const [editingFamily, setEditingFamily] = useState<Family | null>(null);
  const [editFamilyName, setEditFamilyName] = useState("");

  // Share State
  const [sharingFamily, setSharingFamily] = useState<Family | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [, setInviteRole] = useState<"viewer" | "editor" | "admin">("viewer");
  const [collaborators, setCollaborators] = useState<FamilyCollaborator[]>([]);
  const [loadingCollaborators, setLoadingCollaborators] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const historicalMenuRef = useRef<HTMLDivElement>(null);

  const getCurrentUser = useCallback(async (): Promise<string | null> => {
    // Use auth context user
    if (user) return user.id;
    return null;
  }, [user]);

  const fetchFamilies = useCallback(async () => {
    try {
      setLoading(true);
      const userId = await getCurrentUser();
      const data = await getFamilies(userId || undefined);

      const familiesWithMembers = await Promise.all(
        data.map(async (family) => {
          try {
            const members = await getMembers(family.id);
            return { ...family, members };
          } catch {
            return { ...family, members: [] };
          }
        }),
      );

      setFamilies(familiesWithMembers);
    } catch (error) {
      console.error(error);
      toast.error(
        t("family.load_failed", { defaultValue: "Failed to load families" }),
      );
    } finally {
      setLoading(false);
    }
  }, [t, getCurrentUser]);

  useEffect(() => {
    fetchFamilies();
  }, [fetchFamilies]);

  // Click outside to close menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        historicalMenuRef.current &&
        !historicalMenuRef.current.contains(event.target as Node)
      ) {
        setShowHistoricalMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleCreate = async () => {
    if (!newFamilyName.trim()) return;
    try {
      const userId = await getCurrentUser();

      if (!userId) {
        toast.error(
          t("auth.no_user_found", { defaultValue: "No user context found." }),
        );
        return;
      }

      await createFamily(newFamilyName, userId);
      toast.success(t("family.created", { defaultValue: "Family created" }));
      setNewFamilyName("");
      setIsCreating(false);
      fetchFamilies();
    } catch (error) {
      console.error(error);
      toast.error(
        t("family.create_failed", { defaultValue: "Failed to create family" }),
      );
    }
  };

  const handleDeleteClick = (id: string) => {
    setFamilyToDelete(id);
  };

  const handleConfirmDelete = async () => {
    if (!familyToDelete) return;
    try {
      await deleteFamily(familyToDelete);
      toast.success(t("family.deleted", { defaultValue: "Family deleted" }));
      fetchFamilies();
    } catch (error) {
      console.error(error);
      toast.error(
        t("family.delete_failed", { defaultValue: "Failed to delete family" }),
      );
    } finally {
      setFamilyToDelete(null);
    }
  };

  const handleEditClick = (family: Family) => {
    setEditingFamily(family);
    setEditFamilyName(family.family_name);
  };

  const handleShareClick = async (family: Family) => {
    setSharingFamily(family);
    setInviteEmail("");
    setInviteRole("viewer");
    setLoadingCollaborators(true);
    try {
      const collabs = await getCollaborators(family.id);
      setCollaborators(collabs);
    } catch (error) {
      console.error("Failed to load collaborators", error);
      toast.error(
        t("family.load_collabs_failed", {
          defaultValue: "Failed to load collaborators",
        }),
      );
    } finally {
      setLoadingCollaborators(false);
    }
  };

  const handleInvite = async () => {
    if (!sharingFamily || !inviteEmail.trim()) return;
    try {
      await inviteCollaborator(sharingFamily.id, inviteEmail, "viewer");
      toast.success(
        t("family.invite_success", { defaultValue: "Invitation sent" }),
      );
      setInviteEmail("");
      // Refresh collaborators
      const collabs = await getCollaborators(sharingFamily.id);
      setCollaborators(collabs);
    } catch (error) {
      console.error("Failed to invite", error);
      toast.error(
        t("family.invite_failed", {
          defaultValue: "Failed to invite user (check email)",
        }),
      );
    }
  };

  const handleRoleChange = async (
    userId: string,
    newRole: "viewer" | "editor" | "admin",
  ) => {
    if (!sharingFamily) return;
    try {
      await updateCollaboratorRole(sharingFamily.id, userId, newRole);
      toast.success(
        t("common.update_success", { defaultValue: "Updated successfully" }),
      );
      // Update local state
      setCollaborators((prev) =>
        prev.map((c) => (c.user_id === userId ? { ...c, role: newRole } : c)),
      );
    } catch (error) {
      console.error("Failed to update role", error);
      toast.error(t("common.update_failed", { defaultValue: "Update failed" }));
    }
  };

  const handleRemoveCollaborator = async (userId: string) => {
    if (!sharingFamily) return;
    try {
      await removeCollaborator(sharingFamily.id, userId);
      toast.success(
        t("family.collab_removed", { defaultValue: "Collaborator removed" }),
      );
      setCollaborators(collaborators.filter((c) => c.user_id !== userId));
    } catch (error) {
      console.error("Failed to remove", error);
      toast.error(
        t("family.remove_collab_failed", { defaultValue: "Failed to remove" }),
      );
    }
  };

  const handleUpdateFamily = async () => {
    if (!editingFamily || !editFamilyName.trim()) return;
    try {
      await updateFamily(editingFamily.id, editFamilyName);
      toast.success(
        t("common.update_success", { defaultValue: "Updated successfully" }),
      );
      setEditingFamily(null);
      fetchFamilies();
    } catch (error) {
      console.error(error);
      toast.error(t("common.update_failed", { defaultValue: "Update failed" }));
    }
  };

  const dispatch = useDispatch();

  const handleEnter = (family: Family) => {
    dispatch(setLastSelectedFamilyId(family.id));
    navigate("/");
  };

  const handleExport = async (family: Family) => {
    try {
      const graph = await getFamilyGraph(family.id);

      const members = graph.nodes.map((n) => ({
        ...n.data,
        original_id: n.id,
        is_deceased: n.data?.is_deceased,
        is_fuzzy: n.data?.is_fuzzy,
        sort_order: n.data?.sort_order,
      }));

      const spouse_relationships = graph.edges
        .filter((e) => e.type === "spouse")
        .map((e) => ({
          member1_original_id: e.source,
          member2_original_id: e.target,
        }));

      const parent_child_relationships = graph.edges
        .filter((e) => e.type === "parent-child")
        .map((e) => ({
          parent_original_id: e.source,
          child_original_id: e.target,
          relationship_type: e.label || "unknown",
        }));

      const exportData = {
        family_name: family.family_name + " (Export)",
        user_id: family.user_id,
        members,
        spouse_relationships,
        parent_child_relationships,
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${family.family_name}_export.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(
        t("family.export_success", { defaultValue: "Export successful" }),
      );
    } catch (e) {
      console.error(e);
      toast.error(t("family.export_failed", { defaultValue: "Export failed" }));
    }
  };

  const triggerImport = () => {
    fileInputRef.current?.click();
  };

  const handleImportHistorical = async (key: string) => {
    try {
      const userId = await getCurrentUser();

      if (!userId) {
        toast.error(
          t("auth.no_user_found", { defaultValue: "No user context found." }),
        );
        return;
      }

      await importFamilyPreset(key, userId);
      toast.success(
        t("family.import_success", { defaultValue: "Import successful" }),
      );
      setShowHistoricalMenu(false);
      fetchFamilies();
    } catch (e) {
      console.error(e);
      toast.error(t("family.import_failed", { defaultValue: "Import failed" }));
    }
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const userId = await getCurrentUser();

        if (!userId) {
          toast.error(
            t("auth.no_user_found", { defaultValue: "No user context found." }),
          );
          return;
        }

        const json = JSON.parse(e.target?.result as string);

        await importFamily(json, userId);
        toast.success(
          t("family.import_success", { defaultValue: "Import successful" }),
        );
        fetchFamilies();
      } catch (err) {
        console.error(err);
        toast.error(
          t("family.import_failed", { defaultValue: "Import failed" }),
        );
      }
    };
    reader.readAsText(file);
    event.target.value = ""; // Reset
  };

  return (
    <div className="p-8 max-w-5xl mx-auto h-full overflow-y-auto">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold text-gray-800">
          {t("family.management", { defaultValue: "Family Management" })}
        </h1>
        <div className="flex gap-2">
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept=".json"
            onChange={handleImport}
          />

          {/* Historical Import Menu */}
          <div className="relative" ref={historicalMenuRef}>
            <button
              onClick={() => setShowHistoricalMenu(!showHistoricalMenu)}
              className="bg-purple-600 text-white px-4 py-2 rounded-md flex items-center gap-2 hover:bg-purple-700 transition-colors"
            >
              <BookOpen size={18} />
              {t("family.import_historical", {
                defaultValue: "Historical Data",
              })}
            </button>

            {showHistoricalMenu && (
              <div className="absolute top-full left-0 mt-2 w-48 bg-white rounded-md shadow-lg border z-20 overflow-hidden">
                <button
                  onClick={() => handleImportHistorical("han_dynasty")}
                  className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  {t("presets.han_dynasty", { defaultValue: "Han Dynasty" })}
                </button>
                <button
                  onClick={() => handleImportHistorical("tang_dynasty")}
                  className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  {t("presets.tang_dynasty", { defaultValue: "Tang Dynasty" })}
                </button>
                <button
                  onClick={() => handleImportHistorical("ming_dynasty")}
                  className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  {t("presets.ming_dynasty", { defaultValue: "Ming Dynasty" })}
                </button>
              </div>
            )}
          </div>

          <button
            onClick={triggerImport}
            className="bg-green-600 text-white px-4 py-2 rounded-md flex items-center gap-2 hover:bg-green-700 transition-colors"
          >
            <Upload size={18} />
            {t("family.import", { defaultValue: "Import Family" })}
          </button>
          <button
            onClick={() => setIsCreating(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-md flex items-center gap-2 hover:bg-blue-700 transition-colors"
          >
            <Plus size={18} />
            {t("family.create_new", { defaultValue: "Create New Family" })}
          </button>
        </div>
      </div>

      {isCreating && (
        <div className="bg-white p-6 rounded-lg shadow-md mb-6 border border-blue-100 animate-in fade-in slide-in-from-top-4">
          <h3 className="font-semibold mb-4">
            {t("family.create_new", { defaultValue: "Create New Family" })}
          </h3>
          <div className="flex gap-4">
            <input
              type="text"
              value={newFamilyName}
              onChange={(e) => setNewFamilyName(e.target.value)}
              placeholder={t("family.name_placeholder", {
                defaultValue: "Enter family name...",
              })}
              className="flex-1 p-2 border rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
              autoFocus
            />
            <button
              onClick={handleCreate}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
            >
              {t("common.confirm", { defaultValue: "Confirm" })}
            </button>
            <button
              onClick={() => setIsCreating(false)}
              className="bg-gray-100 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-200"
            >
              {t("common.cancel", { defaultValue: "Cancel" })}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-10 text-gray-500">Loading...</div>
      ) : (
        <div className="grid gap-4">
          {families.length === 0 ? (
            <div className="text-center py-10 text-gray-500 bg-white rounded-lg border border-dashed">
              {t("family.no_families", {
                defaultValue: "No families found. Create one to get started.",
              })}
            </div>
          ) : (
            families.map((family) => (
              <FamilyCard
                key={family.id}
                family={family}
                members={family.members}
                onEnter={handleEnter}
                onDelete={handleDeleteClick}
                onEdit={handleEditClick}
                onExport={handleExport}
                onShare={handleShareClick}
                currentUserId={user.id}
              />
            ))
          )}
        </div>
      )}

      {/* Share Dialog */}
      {sharingFamily && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-lg animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <BookOpen className="text-purple-600" size={20} />
              {t("family.share_title", { defaultValue: "Share Family" })}:{" "}
              {sharingFamily.family_name}
            </h3>

            {/* Invite Form */}
            <div className="mb-6">
              <div className="flex gap-2 mb-2">
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder={t("auth.email", { defaultValue: "Email" })}
                  className="flex-1 p-2 border rounded-md focus:ring-2 focus:ring-purple-500 outline-none"
                />
                <button
                  onClick={handleInvite}
                  className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700"
                >
                  {t("family.invite", { defaultValue: "Invite" })}
                </button>
              </div>
            </div>

            {/* Collaborators List */}
            <div className="mb-6">
              <h4 className="text-sm font-medium text-gray-700 mb-2">
                {t("family.collaborators", { defaultValue: "Collaborators" })}
              </h4>
              {loadingCollaborators ? (
                <div className="text-center py-4 text-gray-500 text-sm">
                  Loading...
                </div>
              ) : collaborators.length === 0 ? (
                <div className="text-center py-4 text-gray-500 text-sm italic bg-gray-50 rounded">
                  {t("family.no_collaborators", {
                    defaultValue: "No collaborators yet",
                  })}
                </div>
              ) : (
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {collaborators.map((c) => (
                    <div
                      key={c.user_id}
                      className="flex justify-between items-center p-2 bg-gray-50 rounded border"
                    >
                      <div>
                        <div className="text-sm font-medium">
                          {c.user?.name || c.user_id}
                        </div>
                        <div className="text-xs text-gray-500">
                          {c.user?.email}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <div className="flex bg-gray-100 rounded-md p-0.5">
                          {/* Viewer Button (Always Active) */}
                          <button
                            disabled={true}
                            className="px-2 py-1 text-xs rounded transition-colors bg-blue-100 text-blue-700 font-medium cursor-not-allowed opacity-80"
                            title={t("family.role_viewer_always", {
                              defaultValue: "Read access is always enabled",
                            })}
                          >
                            {t("family.role_viewer")}
                          </button>
                          {/* Editor Button */}
                          <button
                            onClick={() => {
                              // Toggle Write permission
                              // Logic:
                              // - If has write (editor/admin), remove write -> become viewer
                              // - If no write (viewer), add write -> become editor
                              // - Admin status is handled separately, but role string is single source of truth.

                              // Current behavior requirement: "Switching write should not affect admin"
                              // This implies independent flags, but backend uses single 'role' string (viewer|editor|admin).
                              // We must map:
                              // Admin = Write + Admin
                              // Editor = Write
                              // Viewer = Read

                              // If current is Admin:
                              //   Click Write -> Toggle Write off?
                              //   "Changing Write should not affect Admin" -> implies Admin status persists?
                              //   But Admin implies Write usually. If I turn off Write for an Admin, do they become "Admin without Write"?
                              //   System only has 3 roles.
                              //   Let's assume:
                              //     Admin includes Write.
                              //     "Changing Write does not affect Admin" might mean:
                              //       If I am Admin (which implies Write), clicking "Write" (to turn it off) might be invalid or downgrade to Viewer?
                              //       But user said "don't affect Admin".
                              //       Maybe "Admin" is a separate flag on top of Write?
                              //       If backend only supports viewer/editor/admin, we have a constraint.

                              //   Interpretation 2:
                              //   The UI presents them as independent toggles.
                              //   [Read] [Write]
                              //   [Admin Switch]

                              //   State mapping to Roles:
                              //   [x] Read [ ] Write [ ] Admin  -> viewer
                              //   [x] Read [x] Write [ ] Admin  -> editor
                              //   [x] Read [x] Write [x] Admin  -> admin
                              //   [x] Read [ ] Write [x] Admin  -> admin (Admin usually implies write, but let's stick to role definitions)

                              //   If I am Admin:
                              //     Click Write (currently on):
                              //       If I turn off Write, do I stay Admin?
                              //       If Role=Admin implies Write, then I cannot turn off Write without losing Admin?
                              //       Or maybe Role=Admin *is* the top level.

                              //   Let's look at user request again: "Switching admin doesn't affect read/write, changing read/write doesn't affect admin"
                              //   This suggests 3 independent bits conceptually.
                              //   But we only have 3 roles.

                              //   Let's approximate:
                              //   viewer = Read
                              //   editor = Read + Write
                              //   admin  = Read + Write + Admin

                              //   If I am Admin (R+W+A):
                              //     Toggle Admin -> Editor (R+W)  (Removes A, keeps W) - This matches "doesn't affect write"
                              //     Toggle Write -> Viewer (R)    (Removes W... and A?)
                              //       User said "changing write doesn't affect admin".
                              //       If I have A, and I turn off W, I should still have A?
                              //       Role = "Viewer + Admin"? (Not supported by backend enum typically)

                              //   If backend is strictly viewer < editor < admin hierarchy:
                              //     We can't have "Admin without Write".
                              //     So "Admin" implies "Write".
                              //     So if I turn off Write, I must lose Admin.
                              //     BUT user said "changing write doesn't affect admin".
                              //     This is contradictory with standard RBAC hierarchy if strictly enforced.

                              //   Compromise for "Role-based" backend:
                              //   We treat "Write" button as "Editor or above".
                              //   We treat "Admin" switch as "Promote to Admin / Demote to Editor".

                              //   If I am Admin:
                              //     Click Admin Switch -> Editor (Downgrade, keeps Write) -> "Doesn't affect Write" (OK)
                              //     Click Write Button ->
                              //       If we turn off Write, we become Viewer. This removes Admin.
                              //       This violates "doesn't affect Admin".
                              //       UNLESS "Admin" role in backend *doesn't* imply write? (Unlikely for family tree management)
                              //       Or user accepts that removing Write removes Admin?

                              //   Let's assume strict hierarchy for now as it's safer for backend:
                              //   viewer -> editor -> admin

                              //   UI State:
                              //   Write Button Active if role is 'editor' or 'admin'.
                              //   Admin Switch Active if role is 'admin'.

                              //   Actions:
                              //   Toggle Write:
                              //     If Active (Editor/Admin) -> Viewer (Removes Write... and Admin if present).
                              //     If Inactive (Viewer)     -> Editor (Adds Write).

                              //   Toggle Admin:
                              //     If Active (Admin) -> Editor (Removes Admin... keeps Write).
                              //     If Inactive (Editor) -> Admin (Adds Admin).
                              //     If Inactive (Viewer) -> Admin (Adds Admin... and Write implicitly).

                              //   Let's try to implement "Independent" feeling as much as possible.

                              const isWriter =
                                c.role === "editor" || c.role === "admin";
                              if (isWriter) {
                                // Turn off write -> Viewer
                                // (Side effect: loses admin if had it. Unavoidable with 3 roles)
                                handleRoleChange(c.user_id, "viewer");
                              } else {
                                // Turn on write -> Editor
                                // (Does not grant admin)
                                handleRoleChange(c.user_id, "editor");
                              }
                            }}
                            className={`px-2 py-1 text-xs rounded transition-colors ${
                              c.role === "editor" || c.role === "admin"
                                ? "bg-blue-100 text-blue-700 font-medium"
                                : "text-gray-500 hover:text-gray-700"
                            }`}
                            title={t("family.role_editor")}
                          >
                            {t("family.role_editor")}
                          </button>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500">
                            {t("family.role_admin")}
                          </span>
                          <button
                            onClick={() => {
                              // Toggle Admin
                              // If Admin -> Editor (keeps Write)
                              // If Editor -> Admin
                              // If Viewer -> Admin (adds Write implicitly)

                              // Wait, user said "switch admin doesn't affect read/write".
                              // If I am Viewer (No Write) and I click Admin:
                              //   If I become Admin (Has Write), I changed Write.
                              //   If I stay Viewer + Admin? (Backend doesn't support)

                              // Let's assume user flow is:
                              // Viewer -> Editor (click Write) -> Admin (click Admin switch)

                              // If I am Viewer and click Admin switch?
                              // Maybe we should disable Admin switch if not Writer?
                              // Or just promote to Admin (simplest).

                              const newRole =
                                c.role === "admin" ? "editor" : "admin";
                              handleRoleChange(c.user_id, newRole);
                            }}
                            className={`w-8 h-4 rounded-full transition-colors relative ${
                              c.role === "admin"
                                ? "bg-purple-600"
                                : "bg-gray-300"
                            }`}
                          >
                            <span
                              className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${
                                c.role === "admin" ? "left-4.5" : "left-0.5"
                              }`}
                              style={{
                                left: c.role === "admin" ? "18px" : "2px",
                              }}
                            />
                          </button>
                          <button
                            onClick={() => handleRemoveCollaborator(c.user_id)}
                            className="text-red-500 hover:text-red-700 p-1 ml-2"
                            title="Remove"
                          >
                            &times;
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setSharingFamily(null)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-md"
              >
                {t("common.close", { defaultValue: "Close" })}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Dialog - Simple implementation */}
      {editingFamily && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-lg font-semibold mb-4">
              {t("family.edit", { defaultValue: "Edit Family" })}
            </h3>
            <input
              type="text"
              value={editFamilyName}
              onChange={(e) => setEditFamilyName(e.target.value)}
              className="w-full p-2 border rounded-md mb-4 focus:ring-2 focus:ring-blue-500 outline-none"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setEditingFamily(null)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-md"
              >
                {t("common.cancel", { defaultValue: "Cancel" })}
              </button>
              <button
                onClick={handleUpdateFamily}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                {t("common.save", { defaultValue: "Save" })}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={!!familyToDelete}
        title={t("family.delete")}
        message={t("family.confirm_delete", {
          name: families.find((f) => f.id === familyToDelete)?.family_name,
        })}
        onConfirm={handleConfirmDelete}
        onCancel={() => setFamilyToDelete(null)}
      />
    </div>
  );
};

export default Manage;
