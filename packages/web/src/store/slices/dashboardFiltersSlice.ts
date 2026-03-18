import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { HealthStatus } from '@doublehq/shared';

interface DashboardFiltersState {
    statusFilters: HealthStatus[];
    assignee: string | null;
    sort: string;
    period: string | null;
}

const initialState: DashboardFiltersState = {
    statusFilters: [],
    assignee: null,
    sort: 'health',
    period: null,
};

const dashboardFiltersSlice = createSlice({
    name: 'dashboardFilters',
    initialState,
    reducers: {
        toggleStatusFilter(state, action: PayloadAction<HealthStatus>) {
            const status = action.payload;
            const idx = state.statusFilters.indexOf(status);
            if (idx >= 0) {
                state.statusFilters.splice(idx, 1);
            } else {
                state.statusFilters.push(status);
            }
        },
        setAssignee(state, action: PayloadAction<string | null>) {
            state.assignee = action.payload;
        },
        setSort(state, action: PayloadAction<string>) {
            state.sort = action.payload;
        },
        setPeriod(state, action: PayloadAction<string | null>) {
            state.period = action.payload;
        },
        resetFilters() {
            return initialState;
        },
    },
});

export const { toggleStatusFilter, setAssignee, setSort, setPeriod, resetFilters } = dashboardFiltersSlice.actions;
export default dashboardFiltersSlice.reducer;
