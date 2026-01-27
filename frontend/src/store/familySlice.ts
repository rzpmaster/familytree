import { createSlice, PayloadAction } from "@reduxjs/toolkit";

type FamilyState = {
  lastSelectedFamilyId: string | null;
  selectedNodeIds: string[];
};

const initialState: FamilyState = {
  lastSelectedFamilyId: null,
  selectedNodeIds: [],
};

const familySlice = createSlice({
  name: "family",
  initialState,
  reducers: {
    setLastSelectedFamilyId(state, action: PayloadAction<string | null>) {
      state.lastSelectedFamilyId = action.payload;
    },
    setSelectedNodeIds(state, action: PayloadAction<string[]>) {
      state.selectedNodeIds = action.payload;
    },
    toggleNodeSelection(state, action: PayloadAction<string>) {
      const id = action.payload;
      const index = state.selectedNodeIds.indexOf(id);
      if (index !== -1) {
        state.selectedNodeIds.splice(index, 1);
      } else {
        state.selectedNodeIds.push(id);
      }
    },
    clearNodeSelection(state) {
      state.selectedNodeIds = [];
    },
  },
});

export const {
  setLastSelectedFamilyId,
  setSelectedNodeIds,
  toggleNodeSelection,
  clearNodeSelection,
} = familySlice.actions;
export const familyReducer = familySlice.reducer;
