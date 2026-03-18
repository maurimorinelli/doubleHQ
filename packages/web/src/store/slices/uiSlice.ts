import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';

interface Toast {
    id: string;
    type: 'success' | 'error' | 'info';
    message: string;
}

interface UiState {
    activeClientTabs: Record<string, string>; // clientId → active tab key
    toasts: Toast[];
}

const initialState: UiState = {
    activeClientTabs: {},
    toasts: [],
};

const uiSlice = createSlice({
    name: 'ui',
    initialState,
    reducers: {
        setActiveClientTab(state, action: PayloadAction<{ clientId: string; tab: string }>) {
            state.activeClientTabs[action.payload.clientId] = action.payload.tab;
        },
        addToast(state, action: PayloadAction<Omit<Toast, 'id'>>) {
            state.toasts.push({
                ...action.payload,
                id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
            });
        },
        removeToast(state, action: PayloadAction<string>) {
            state.toasts = state.toasts.filter(t => t.id !== action.payload);
        },
    },
});

export const { setActiveClientTab, addToast, removeToast } = uiSlice.actions;
export default uiSlice.reducer;
