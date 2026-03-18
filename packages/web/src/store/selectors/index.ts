import { createSelector } from '@reduxjs/toolkit';
import type { RootState } from '../store';

/**
 * Memoized selectors — prevent unnecessary re-renders by computing
 * derived state only when inputs change.
 */

/** Dashboard filter selectors */
const selectDashboardFilters = (state: RootState) => state.dashboardFilters;

export const selectActiveFilterCount = createSelector(
    selectDashboardFilters,
    (filters) => {
        let count = filters.statusFilters.length;
        if (filters.assignee) count++;
        if (filters.period) count++;
        if (filters.sort !== 'health') count++;
        return count;
    },
);

export const selectHasActiveFilters = createSelector(
    selectActiveFilterCount,
    (count) => count > 0,
);

export const selectDashboardFilterSummary = createSelector(
    selectDashboardFilters,
    (filters) => ({
        statusFilters: filters.statusFilters,
        hasStatusFilter: filters.statusFilters.length > 0,
        assignee: filters.assignee,
        sort: filters.sort,
        period: filters.period,
    }),
);

/** UI selectors */
const selectUi = (state: RootState) => state.ui;

export const selectClientActiveTab = (clientId: string) =>
    createSelector(
        selectUi,
        (ui) => ui.activeClientTabs[clientId] || 'overview',
    );

export const selectToastCount = createSelector(
    selectUi,
    (ui) => ui.toasts.length,
);

/** Close workflow selectors */
const selectCloseWorkflow = (state: RootState) => state.closeWorkflow;

export const selectWorkflowProgress = createSelector(
    selectCloseWorkflow,
    (workflow) => ({
        activeStep: workflow.activeStep,
        completedSteps: workflow.completedSteps,
        totalSteps: 6,
        progressPercent: Math.round((workflow.completedSteps.length / 6) * 100),
    }),
);
