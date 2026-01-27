import { Save, X } from "lucide-react";
import React, { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { cn, getSurname } from "../lib/utils";
import { createMember, updateMember } from "../services/api";
import { Member } from "../types";

interface MemberDetailProps {
  member: Member;
  onClose: () => void;
  onUpdate: () => void; // Trigger refresh
  readOnly?: boolean;
}

const MemberDetail: React.FC<MemberDetailProps> = ({
  member,
  onClose,
  onUpdate,
  readOnly = false,
}) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState<Partial<Member>>({});
  const isNewMember = member.id === "new_member";

  useEffect(() => {
    setFormData({
      name: member.name,
      surname: member.surname,
      gender: member.gender,
      birth_date: member.birth_date,
      death_date: member.death_date,
      is_deceased: member.is_deceased,
      is_fuzzy: member.is_fuzzy,
      remark: member.remark,
      birth_place: member.birth_place,
      sort_order: member.sort_order,
    });
  }, [member]);

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >,
  ) => {
    if (readOnly) return;
    const { name, value, type } = e.target;

    console.log(name, value, type);

    if (type === "checkbox") {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData((prev) => ({ ...prev, [name]: checked }));
      return;
    }

    if (type === "number") {
      const numVal = value === "" ? 0 : Number(value);
      setFormData((prev) => ({ ...prev, [name]: numVal }));
      return;
    }

    setFormData((prev) => {
      const newData = { ...prev, [name]: value };

      // Auto-identify surname if name changes and surname is empty (or new member)
      if (name === "name" && (!prev.surname || isNewMember)) {
        newData.surname = getSurname(value);
      }
      return newData;
    });
  };

  const handleSave = async () => {
    try {
      if (isNewMember) {
        // Create new member
        await createMember({
          name: formData.name || "",
          surname: formData.surname,
          gender: formData.gender || "male",
          birth_date: formData.birth_date,
          death_date: formData.death_date,
          is_deceased: formData.is_deceased,
          is_fuzzy: formData.is_fuzzy,
          remark: formData.remark,
          birth_place: formData.birth_place,
          photo_url: formData.photo_url,
          family_id: member.family_id,
          position_x: member.position_x,
          position_y: member.position_y,
          sort_order: formData.sort_order,
        });
        toast.success("Member added successfully");
      } else {
        // Update existing
        await updateMember(member.id, formData);
        toast.success("Member updated successfully");
      }
      onUpdate();
      onClose();
    } catch (e) {
      console.error(e);
      toast.error(t("member.add_failed").replace("add", "save"));
    }
  };

  return (
    <div className="h-full flex flex-col bg-white shadow-xl border-l w-80">
      <div className="p-4 border-b flex justify-between items-center bg-gray-50">
        <h2 className="text-lg font-semibold">
          {isNewMember ? t("member.add") : t("member.details")}
        </h2>
        <button onClick={onClose} className="p-1 hover:bg-gray-200 rounded">
          <X size={20} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Fields */}
        <div>
          <label className="block text-sm font-medium text-gray-700">
            {t("member.name")}
          </label>
          <input
            type="text"
            name="name"
            value={formData.name || ""}
            onChange={handleChange}
            readOnly={readOnly}
            className={cn(
              "input mt-1",
              readOnly && "bg-gray-100 cursor-not-allowed",
            )}
            placeholder={t("member.name")}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            {t("member.surname", { defaultValue: "Surname" })}
          </label>
          <input
            type="text"
            name="surname"
            value={formData.surname || ""}
            onChange={handleChange}
            readOnly={readOnly}
            className={cn(
              "input mt-1",
              readOnly && "bg-gray-100 cursor-not-allowed",
            )}
            placeholder={t("member.surname", { defaultValue: "Surname" })}
          />
          <p className="text-xs text-gray-400 mt-1">
            {t("member.surname_auto_hint", {
              defaultValue: "Auto-filled from first character if empty",
            })}
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            {t("member.gender")}
          </label>
          <select
            name="gender"
            value={formData.gender || "male"}
            onChange={handleChange}
            disabled={readOnly}
            className={cn(
              "input mt-1",
              readOnly && "bg-gray-100 cursor-not-allowed",
            )}
          >
            <option value="male">{t("member.male")}</option>
            <option value="female">{t("member.female")}</option>
          </select>
        </div>

        {/* Status Flags */}
        <div className="flex flex-col gap-2 p-3 bg-gray-50 rounded-md border">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              name="is_fuzzy"
              checked={formData.is_fuzzy || false}
              onChange={handleChange}
              disabled={readOnly}
              className="rounded text-blue-600"
            />
            <span className="text-sm text-gray-700">
              {t("member.is_fuzzy", { defaultValue: "Fuzzy Node (Dashed)" })}
            </span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              name="is_deceased"
              checked={formData.is_deceased || false}
              onChange={handleChange}
              disabled={readOnly}
              className="rounded text-blue-600"
            />
            <span className="text-sm text-gray-700">
              {t("member.is_deceased", {
                defaultValue: "Deceased (Unknown Date)",
              })}
            </span>
          </label>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            {t("member.birth_date")}
          </label>
          <input
            type="date"
            name="birth_date"
            value={formData.birth_date || ""}
            onChange={handleChange}
            readOnly={readOnly}
            className={cn(
              "input mt-1",
              readOnly && "bg-gray-100 cursor-not-allowed",
            )}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            {t("member.death_date")}
          </label>
          <input
            type="date"
            name="death_date"
            value={formData.death_date || ""}
            onChange={handleChange}
            readOnly={readOnly}
            className={cn(
              "input mt-1",
              readOnly && "bg-gray-100 cursor-not-allowed",
            )}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            {t("member.birth_place")}
          </label>
          <input
            type="text"
            name="birth_place"
            value={formData.birth_place || ""}
            onChange={handleChange}
            readOnly={readOnly}
            className={cn(
              "input mt-1",
              readOnly && "bg-gray-100 cursor-not-allowed",
            )}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            {t("member.sort_order", { defaultValue: "Sort Order (Peer)" })}
          </label>
          <input
            type="number"
            name="sort_order"
            value={formData.sort_order ?? ""}
            onChange={handleChange}
            readOnly={readOnly}
            className={cn(
              "input mt-1",
              readOnly && "bg-gray-100 cursor-not-allowed",
            )}
            placeholder="0"
          />
          <p className="text-xs text-gray-400 mt-1">
            {t("member.sort_order_hint", {
              defaultValue: "Smaller number appears first when no birth date",
            })}
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            {t("member.remark", { defaultValue: "Remark" })}
          </label>
          <textarea
            name="remark"
            value={formData.remark || ""}
            onChange={handleChange}
            readOnly={readOnly}
            rows={3}
            className={cn(
              "input mt-1",
              readOnly && "bg-gray-100 cursor-not-allowed",
            )}
            placeholder={t("member.remark_placeholder", {
              defaultValue: "Add remarks...",
            })}
          />
        </div>
      </div>

      {!readOnly && (
        <div className="p-4 border-t bg-gray-50 flex gap-2">
          <button
            onClick={handleSave}
            className={cn("btn btn-primary flex-1 gap-2")}
          >
            <Save size={16} /> {t("common.save")}
          </button>
        </div>
      )}
    </div>
  );
};

export default MemberDetail;
