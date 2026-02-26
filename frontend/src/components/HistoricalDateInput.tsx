import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "../lib/utils";

interface HistoricalDateInputProps {
  value?: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
  className?: string;
  placeholder?: string;
}

/**
 * A specialized date input for historical/genealogy data.
 * Supports:
 * - Year, Month, Day inputs
 * - Flexible formatting (yyyy-MM-dd or -yyyy-MM-dd)
 * - Negative years support directly in year input
 */
export const HistoricalDateInput: React.FC<HistoricalDateInputProps> = ({
  value,
  onChange,
  readOnly = false,
  className,
}) => {
  const { t } = useTranslation();

  // Internal state for the parts
  const [year, setYear] = useState<string>("");
  const [month, setMonth] = useState<string>("");
  const [day, setDay] = useState<string>("");

  // Parse the value when it changes
  useEffect(() => {
    if (!value) {
      setYear("");
      setMonth("");
      setDay("");
      return;
    }

    // Check for BC dates (start with '-')
    // Format: -0091-09-08 or 1368-01-23
    // Regex to split: ^(-?\d+)(?:-(\d{1,2}))?(?:-(\d{1,2}))?$
    const match = value.match(/^(-?\d+)(?:-(\d{1,2}))?(?:-(\d{1,2}))?$/);
    
    if (match) {
        setYear(match[1]);
        setMonth(match[2] || "");
        setDay(match[3] || "");
    } else {
        // Fallback for simple split if regex fails (though regex is robust for ISOish)
        const parts = value.split("-");
        // Handling negative year split is tricky: "-0091-09-08" -> ["", "0091", "09", "08"]
        if (value.startsWith("-")) {
            if (parts.length >= 2) setYear(`-${parts[1]}`);
            if (parts.length >= 3) setMonth(parts[2]);
            if (parts.length >= 4) setDay(parts[3]);
        } else {
            if (parts.length >= 1) setYear(parts[0]);
            if (parts.length >= 2) setMonth(parts[1]);
            if (parts.length >= 3) setDay(parts[2]);
        }
    }
  }, [value]);

  const updateValue = (newYear: string, newMonth: string, newDay: string) => {
    if (!newYear || newYear === "-" || newYear === "-0" || newYear === "-00" || newYear === "-000") {
        // Don't emit partial negative signs or empty years immediately if we want to support typing
        // But the parent needs value to update state. 
        // Let's emit what we have, but be careful. 
        // If year is just "-", maybe don't emit or emit as is?
        // Actually, if we emit "-", parseDate might fail or return invalid.
        // Let's wait for at least one digit if it's negative? 
        // No, standard is to update state so UI reflects typing.
        // We'll rely on the parent/utils to handle invalid dates gracefully if needed, 
        // or just pass the raw string.
    }
    
    if (!newYear) {
      onChange("");
      return;
    }

    // Pad month and day with leading zeros if needed
    const pad = (n: string) => n.padStart(2, "0");
    
    // For year, we usually want 4 digits, but for negative inputs user might be typing.
    // If we force padStart(4, '0') on "-1", it becomes "-001" which is weird. 
    // Usually it's -0001. 
    // Let's just pass what the user types for the year, maybe pad if it's complete?
    // To be safe and consistent with backend, let's try to pad positive years to 4 digits
    // and negative years to -000X format IF they are "done" typing? 
    // Actually, controlled inputs are hard to auto-format while typing.
    // Let's just build the string as is.
    
    let result = newYear;
    
    if (newMonth) {
      result += `-${pad(newMonth)}`;
      if (newDay) {
        result += `-${pad(newDay)}`;
      }
    }

    onChange(result);
  };

  const handleYearChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    // Allow digits and a leading minus sign
    if (/^-?\d{0,4}$/.test(val)) {
        setYear(val);
        updateValue(val, month, day);
    }
  };

  const handleMonthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, "");
    if (parseInt(val) > 12) val = "12";
    if (val === "00") val = "01";
    setMonth(val);
    updateValue(year, val, day);
  };

  const handleDayChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, "");
    if (parseInt(val) > 31) val = "31"; 
    if (val === "00") val = "01";
    setDay(val);
    updateValue(year, month, val);
  };

  return (
    <div className={cn("flex gap-1 items-center", className)}>
      <input
        type="text"
        value={year}
        onChange={handleYearChange}
        placeholder={t("date.year", { defaultValue: "YYYY" })}
        readOnly={readOnly}
        className={cn(
          "input min-w-[70px] px-2 py-1 text-center",
          readOnly && "bg-gray-100 cursor-not-allowed"
        )}
        // maxLength removed to allow -yyyy
      />
      <span className="text-gray-400">-</span>
      <input
        type="text"
        value={month}
        onChange={handleMonthChange}
        placeholder={t("date.month", { defaultValue: "MM" })}
        readOnly={readOnly}
        className={cn(
          "input w-14 px-2 py-1 text-center",
          readOnly && "bg-gray-100 cursor-not-allowed"
        )}
        maxLength={2}
      />
      <span className="text-gray-400">-</span>
      <input
        type="text"
        value={day}
        onChange={handleDayChange}
        placeholder={t("date.day", { defaultValue: "DD" })}
        readOnly={readOnly}
        className={cn(
          "input w-14 px-2 py-1 text-center",
          readOnly && "bg-gray-100 cursor-not-allowed"
        )}
        maxLength={2}
      />
    </div>
  );
};
