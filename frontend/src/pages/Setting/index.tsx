import { useSettings } from "@/hooks/useSettings";
import { cn } from "@/lib/utils";
import { FocusRelations } from "@/store/settingsSlice";
import { Check, Focus, Globe, LayoutTemplate } from "lucide-react";
import React from "react";
import { useTranslation } from "react-i18next";

const Settings: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { state, actions } = useSettings();
  const { focusModeEnabled, focusRelations } = state;

  const changeLanguage = (lng: string) => {
    actions.setLanguage(lng);
  };

  const toggleRelation = (key: keyof FocusRelations) => {
    if (key === "self") return;
    actions.toggleFocusRelation(key);
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-8 max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-800 mb-8">
        {t("common.settings", { defaultValue: "Settings" })}
      </h1>

      {/* Language Settings */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-gray-800">
          <Globe size={20} className="text-blue-600" />
          {t("settings.language", { defaultValue: "Language" })}
        </h2>

        <div className="flex gap-4">
          <button
            onClick={() => changeLanguage("en")}
            className={cn(
              "btn",
              i18n.language === "en"
                ? "bg-blue-50 border-blue-500 text-blue-700 font-medium"
                : "btn-secondary",
            )}
          >
            English
          </button>
          <button
            onClick={() => changeLanguage("zh")}
            className={cn(
              "btn",
              i18n.language === "zh"
                ? "bg-blue-50 border-blue-500 text-blue-700 font-medium"
                : "btn-secondary",
            )}
          >
            中文 (Chinese)
          </button>
        </div>
      </div>

      {/* Display Settings */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-gray-800">
          <LayoutTemplate size={20} className="text-green-600" />
          {t("settings.display", { defaultValue: "Display Settings" })}
        </h2>

        <div className="space-y-6">
          {/* Privacy Mode */}
          <div className="flex justify-between items-center">
            <div>
              <div className="font-medium text-gray-700">
                {t("settings.privacy_mode", { defaultValue: "Privacy Mode" })}
              </div>
              <div className="text-sm text-gray-500">
                {t("settings.privacy_mode_desc", {
                  defaultValue: "Only show surname on nodes",
                })}
              </div>
            </div>
            <button
              onClick={() => actions.setPrivacyMode(!state.privacyMode)}
              className={cn(
                "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                state.privacyMode ? "bg-green-600" : "bg-gray-200",
              )}
            >
              <span
                className={cn(
                  "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                  state.privacyMode ? "translate-x-6" : "translate-x-1",
                )}
              />
            </button>
          </div>

          {/* Show Living */}
          <div className="flex justify-between items-center">
            <div>
              <div className="font-medium text-gray-700">
                {t("settings.show_living", { defaultValue: "Show Living Members" })}
              </div>
              <div className="text-sm text-gray-500">
                {t("settings.show_living_desc", {
                  defaultValue: "Display members who are currently alive",
                })}
              </div>
            </div>
            <button
              onClick={() => actions.setShowLiving(!state.showLiving)}
              className={cn(
                "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                state.showLiving ? "bg-green-600" : "bg-gray-200",
              )}
            >
              <span
                className={cn(
                  "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                  state.showLiving ? "translate-x-6" : "translate-x-1",
                )}
              />
            </button>
          </div>

          {/* Show Not Living */}
          <div className="flex flex-col gap-3">
            <div className="flex justify-between items-center">
              <div>
                <div className="font-medium text-gray-700">
                  {t("settings.show_not_living", {
                    defaultValue: "Show Not Living",
                  })}
                </div>
                <div className="text-sm text-gray-500">
                  {t("settings.show_not_living_desc", {
                    defaultValue: "Includes deceased and unborn members",
                  })}
                </div>
              </div>
              <button
                onClick={() => actions.setShowNotLiving(!state.showNotLiving)}
                className={cn(
                  "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                  state.showNotLiving ? "bg-green-600" : "bg-gray-200",
                )}
              >
                <span
                  className={cn(
                    "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                    state.showNotLiving ? "translate-x-6" : "translate-x-1",
                  )}
                />
              </button>
            </div>

            {state.showNotLiving && (
              <div className="pl-4 ml-2 border-l-2 border-gray-100 space-y-4">
                {/* Deceased */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-700 font-medium">
                      {t("settings.show_deceased", {
                        defaultValue: "Show Deceased",
                      })}
                    </span>
                    <button
                      onClick={() =>
                        actions.setShowDeceased(!state.showDeceased)
                      }
                      className={cn(
                        "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
                        state.showDeceased ? "bg-green-600" : "bg-gray-200",
                      )}
                    >
                      <span
                        className={cn(
                          "inline-block h-3 w-3 transform rounded-full bg-white transition-transform",
                          state.showDeceased
                            ? "translate-x-5"
                            : "translate-x-1",
                        )}
                      />
                    </button>
                  </div>
                  {state.showDeceased && (
                    <div className="flex justify-between items-center pl-2">
                      <span className="text-sm text-gray-500">
                        {t("settings.dim_deceased", {
                          defaultValue: "Dim Deceased",
                        })}
                      </span>
                      <button
                        onClick={() =>
                          actions.setDimDeceased(!state.dimDeceased)
                        }
                        className={cn(
                          "relative inline-flex h-4 w-7 items-center rounded-full transition-colors",
                          state.dimDeceased ? "bg-blue-500" : "bg-gray-200",
                        )}
                      >
                        <span
                          className={cn(
                            "inline-block h-2 w-2 transform rounded-full bg-white transition-transform",
                            state.dimDeceased
                              ? "translate-x-4"
                              : "translate-x-1",
                          )}
                        />
                      </button>
                    </div>
                  )}
                </div>

                {/* Unborn */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-700 font-medium">
                      {t("settings.show_unborn", {
                        defaultValue: "Show Unborn",
                      })}
                    </span>
                    <button
                      onClick={() => actions.setShowUnborn(!state.showUnborn)}
                      className={cn(
                        "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
                        state.showUnborn ? "bg-green-600" : "bg-gray-200",
                      )}
                    >
                      <span
                        className={cn(
                          "inline-block h-3 w-3 transform rounded-full bg-white transition-transform",
                          state.showUnborn ? "translate-x-5" : "translate-x-1",
                        )}
                      />
                    </button>
                  </div>
                  {state.showUnborn && (
                    <div className="flex justify-between items-center pl-2">
                      <span className="text-sm text-gray-500">
                        {t("settings.dim_unborn", {
                          defaultValue: "Dim Unborn",
                        })}
                      </span>
                      <button
                        onClick={() => actions.setDimUnborn(!state.dimUnborn)}
                        className={cn(
                          "relative inline-flex h-4 w-7 items-center rounded-full transition-colors",
                          state.dimUnborn ? "bg-blue-500" : "bg-gray-200",
                        )}
                      >
                        <span
                          className={cn(
                            "inline-block h-2 w-2 transform rounded-full bg-white transition-transform",
                            state.dimUnborn ? "translate-x-4" : "translate-x-1",
                          )}
                        />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Timeline */}
          <div className="flex justify-between items-center">
            <div>
              <div className="font-medium text-gray-700">
                {t("settings.timeline", { defaultValue: "Timeline Mode" })}
              </div>
              <div className="text-sm text-gray-500">
                {t("settings.timeline_desc", {
                  defaultValue: "Enable timeline slider to view history",
                })}
              </div>
            </div>
            <button
              onClick={() => actions.setTimelineEnabled(!state.timelineEnabled)}
              className={cn(
                "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                state.timelineEnabled ? "bg-green-600" : "bg-gray-200",
              )}
            >
              <span
                className={cn(
                  "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                  state.timelineEnabled ? "translate-x-6" : "translate-x-1",
                )}
              />
            </button>
          </div>

          {/* Compact Mode */}
          <div className="flex justify-between items-center">
            <div>
              <div className="font-medium text-gray-700">
                {t("settings.compact_mode", { defaultValue: "Compact Mode" })}
              </div>
              <div className="text-sm text-gray-500">
                {t("settings.compact_mode_desc", {
                  defaultValue: "Vertical layout for members",
                })}
              </div>
            </div>
            <button
              onClick={() => actions.setCompactMode(!state.compactMode)}
              className={cn(
                "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                state.compactMode ? "bg-green-600" : "bg-gray-200",
              )}
            >
              <span
                className={cn(
                  "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                  state.compactMode ? "translate-x-6" : "translate-x-1",
                )}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Focus Mode Settings */}
      <div className="card p-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2 text-gray-800">
              <Focus size={20} className="text-purple-600" />
              {t("settings.focus_mode", { defaultValue: "Focus Mode" })}
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {t("settings.focus_mode_desc", {
                defaultValue:
                  "Highlight related members when selecting a person",
              })}
            </p>
          </div>
          <div className="flex items-center">
            <button
              onClick={() => actions.setFocusMode(!focusModeEnabled)}
              className={cn(
                "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                focusModeEnabled ? "bg-purple-600" : "bg-gray-200",
              )}
            >
              <span
                className={cn(
                  "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                  focusModeEnabled ? "translate-x-6" : "translate-x-1",
                )}
              />
            </button>
          </div>
        </div>

        {focusModeEnabled && (
          <div className="mt-6 border-t pt-4">
            <h3 className="text-sm font-medium text-gray-700 mb-3">
              {t("settings.focus_relations", {
                defaultValue: "Focus Relationships",
              })}
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {[
                { key: "self", label: "relation.role_self" },
                { key: "father", label: "relation.role_father" },
                { key: "mother", label: "relation.role_mother" },
                { key: "spouse", label: "relation.role_spouse" },
                { key: "son", label: "relation.role_son" },
                { key: "daughter", label: "relation.role_daughter" },
              ].map(({ key, label }) => {
                const isSelf = key === "self";
                const isActive = focusRelations[key as keyof FocusRelations];

                return (
                  <button
                    key={key}
                    onClick={() => toggleRelation(key as keyof FocusRelations)}
                    disabled={isSelf}
                    className={cn(
                      "flex items-center justify-between px-3 py-2 rounded-md border text-sm transition-colors",
                      isActive
                        ? isSelf
                          ? "bg-gray-100 border-gray-300 text-gray-500 cursor-not-allowed" // Disabled style for Self
                          : "bg-purple-50 border-purple-200 text-purple-700"
                        : "bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100",
                    )}
                  >
                    <span>{t(label)}</span>
                    {isActive && <Check size={14} />}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
      </div>
    </div>
  );
};

export default Settings;
