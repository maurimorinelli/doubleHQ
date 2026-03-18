import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';

interface CloseWorkflowState {
    /** Active client being worked on */
    activeClientId: string | null;
    /** Current workflow step (0-5 for the 6-step close process) */
    activeStep: number;
    /** Steps that have been completed */
    completedSteps: number[];
}

const initialState: CloseWorkflowState = {
    activeClientId: null,
    activeStep: 0,
    completedSteps: [],
};

const closeWorkflowSlice = createSlice({
    name: 'closeWorkflow',
    initialState,
    reducers: {
        setActiveClient(state, action: PayloadAction<string>) {
            if (state.activeClientId !== action.payload) {
                state.activeClientId = action.payload;
                state.activeStep = 0;
                state.completedSteps = [];
            }
        },
        setActiveStep(state, action: PayloadAction<number>) {
            state.activeStep = action.payload;
        },
        markStepComplete(state, action: PayloadAction<number>) {
            if (!state.completedSteps.includes(action.payload)) {
                state.completedSteps.push(action.payload);
            }
        },
        resetWorkflow() {
            return initialState;
        },
    },
});

export const { setActiveClient, setActiveStep, markStepComplete, resetWorkflow } = closeWorkflowSlice.actions;
export default closeWorkflowSlice.reducer;
