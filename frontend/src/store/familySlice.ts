// src/store/familySlice.ts
import { createSlice, PayloadAction } from "@reduxjs/toolkit";

type FamilyState = {
  lastSelectedFamilyId: string | null;
};

const initialState: FamilyState = {
  lastSelectedFamilyId: null,
};

const familySlice = createSlice({
  name: "family",
  initialState,
  reducers: {
    setLastSelectedFamilyId(state, action: PayloadAction<string | null>) {
      state.lastSelectedFamilyId = action.payload;
    },
  },
});

export const { setLastSelectedFamilyId } = familySlice.actions;
export const familyReducer = familySlice.reducer;
