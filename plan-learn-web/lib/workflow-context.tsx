"use client"

import { createContext, useContext, useReducer, useCallback, useEffect, type ReactNode } from "react"

// Types
export type WorkflowPhase = 'idle' | 'recall' | 'plan' | 'execute' | 'learn' | 'complete' | 'error'

export type StepStatus = 'pending' | 'active' | 'complete' | 'failed'

export type Pattern = {
  fact: string
  mention_count: number
  last_mentioned: string | null
}

export type PlanStep = {
  step_number: number
  action: string
  reasoning: string
  expected_outcome: string
  actual_result?: string
  status: StepStatus
  duration_ms?: number
  started_at?: number
  completed_at?: number
}

export type WorkflowState = {
  phase: WorkflowPhase
  recalledPatterns: Pattern[]
  planSteps: PlanStep[]
  currentStepIndex: number
  learnings: string[]
  timing: {
    start: number | null
    phaseStarts: Record<WorkflowPhase, number | null>
    phaseDurations: Record<WorkflowPhase, number | null>
  }
  error: string | null
  successCriteria: string | null
}

// Actions
export type WorkflowAction =
  | { type: 'START_WORKFLOW' }
  | { type: 'SET_PHASE'; payload: WorkflowPhase }
  | { type: 'SET_RECALLED_PATTERNS'; payload: Pattern[] }
  | { type: 'SET_PLAN'; payload: { steps: PlanStep[]; success_criteria?: string } }
  | { type: 'START_STEP'; payload: number }
  | { type: 'UPDATE_STEP'; payload: { stepIndex: number; result: string; status: StepStatus; duration_ms?: number } }
  | { type: 'SET_LEARNINGS'; payload: string[] }
  | { type: 'COMPLETE_WORKFLOW' }
  | { type: 'SET_ERROR'; payload: string }
  | { type: 'RESET_WORKFLOW' }

// Initial state
const initialState: WorkflowState = {
  phase: 'idle',
  recalledPatterns: [],
  planSteps: [],
  currentStepIndex: -1,
  learnings: [],
  timing: {
    start: null,
    phaseStarts: {
      idle: null,
      recall: null,
      plan: null,
      execute: null,
      learn: null,
      complete: null,
      error: null,
    },
    phaseDurations: {
      idle: null,
      recall: null,
      plan: null,
      execute: null,
      learn: null,
      complete: null,
      error: null,
    },
  },
  error: null,
  successCriteria: null,
}

// Reducer
function workflowReducer(state: WorkflowState, action: WorkflowAction): WorkflowState {
  const now = Date.now()

  switch (action.type) {
    case 'START_WORKFLOW':
      return {
        ...initialState,
        phase: 'recall',
        timing: {
          ...initialState.timing,
          start: now,
          phaseStarts: {
            ...initialState.timing.phaseStarts,
            recall: now,
          },
        },
      }

    case 'SET_PHASE': {
      const prevPhase = state.phase
      const prevPhaseStart = state.timing.phaseStarts[prevPhase]
      const phaseDuration = prevPhaseStart ? now - prevPhaseStart : null

      return {
        ...state,
        phase: action.payload,
        timing: {
          ...state.timing,
          phaseStarts: {
            ...state.timing.phaseStarts,
            [action.payload]: now,
          },
          phaseDurations: {
            ...state.timing.phaseDurations,
            [prevPhase]: phaseDuration,
          },
        },
      }
    }

    case 'SET_RECALLED_PATTERNS':
      return {
        ...state,
        recalledPatterns: action.payload,
        phase: 'plan',
        timing: {
          ...state.timing,
          phaseStarts: {
            ...state.timing.phaseStarts,
            plan: now,
          },
          phaseDurations: {
            ...state.timing.phaseDurations,
            recall: state.timing.phaseStarts.recall ? now - state.timing.phaseStarts.recall : null,
          },
        },
      }

    case 'SET_PLAN':
      return {
        ...state,
        planSteps: action.payload.steps.map(step => ({
          ...step,
          status: 'pending' as StepStatus,
        })),
        successCriteria: action.payload.success_criteria || null,
        phase: 'execute',
        currentStepIndex: 0,
        timing: {
          ...state.timing,
          phaseStarts: {
            ...state.timing.phaseStarts,
            execute: now,
          },
          phaseDurations: {
            ...state.timing.phaseDurations,
            plan: state.timing.phaseStarts.plan ? now - state.timing.phaseStarts.plan : null,
          },
        },
      }

    case 'START_STEP':
      return {
        ...state,
        currentStepIndex: action.payload,
        planSteps: state.planSteps.map((step, i) =>
          i === action.payload
            ? { ...step, status: 'active' as StepStatus, started_at: now }
            : step
        ),
      }

    case 'UPDATE_STEP':
      return {
        ...state,
        planSteps: state.planSteps.map((step, i) =>
          i === action.payload.stepIndex
            ? {
                ...step,
                actual_result: action.payload.result,
                status: action.payload.status,
                duration_ms: action.payload.duration_ms,
                completed_at: now,
              }
            : step
        ),
      }

    case 'SET_LEARNINGS':
      return {
        ...state,
        learnings: action.payload,
        phase: 'complete',
        timing: {
          ...state.timing,
          phaseStarts: {
            ...state.timing.phaseStarts,
            complete: now,
          },
          phaseDurations: {
            ...state.timing.phaseDurations,
            learn: state.timing.phaseStarts.learn ? now - state.timing.phaseStarts.learn : null,
          },
        },
      }

    case 'COMPLETE_WORKFLOW':
      return {
        ...state,
        phase: 'complete',
        timing: {
          ...state.timing,
          phaseStarts: {
            ...state.timing.phaseStarts,
            complete: now,
          },
          phaseDurations: {
            ...state.timing.phaseDurations,
            execute: state.timing.phaseStarts.execute ? now - state.timing.phaseStarts.execute : null,
          },
        },
      }

    case 'SET_ERROR':
      return {
        ...state,
        phase: 'error',
        error: action.payload,
      }

    case 'RESET_WORKFLOW':
      return initialState

    default:
      return state
  }
}

// Context
type WorkflowContextType = {
  state: WorkflowState
  dispatch: React.Dispatch<WorkflowAction>
  startWorkflow: () => void
  resetWorkflow: () => void
  getTotalDuration: () => number | null
}

const WorkflowContext = createContext<WorkflowContextType | null>(null)

// Session storage key
const STORAGE_KEY = 'workflow-state'

// Provider
export function WorkflowProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(workflowReducer, initialState)

  // Restore state from sessionStorage on mount
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        // Only restore if workflow was in progress
        if (parsed.phase !== 'idle' && parsed.phase !== 'complete') {
          // Dispatch actions to restore state
          if (parsed.recalledPatterns?.length > 0) {
            dispatch({ type: 'START_WORKFLOW' })
            dispatch({ type: 'SET_RECALLED_PATTERNS', payload: parsed.recalledPatterns })
          }
          if (parsed.planSteps?.length > 0) {
            dispatch({ type: 'SET_PLAN', payload: { steps: parsed.planSteps, success_criteria: parsed.successCriteria } })
          }
          if (parsed.learnings?.length > 0) {
            dispatch({ type: 'SET_LEARNINGS', payload: parsed.learnings })
          }
        }
      }
    } catch {
      // Ignore errors
    }
  }, [])

  // Persist state to sessionStorage
  useEffect(() => {
    if (state.phase !== 'idle') {
      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
          phase: state.phase,
          recalledPatterns: state.recalledPatterns,
          planSteps: state.planSteps,
          learnings: state.learnings,
          successCriteria: state.successCriteria,
        }))
      } catch {
        // Ignore errors
      }
    }
  }, [state])

  const startWorkflow = useCallback(() => {
    dispatch({ type: 'START_WORKFLOW' })
  }, [])

  const resetWorkflow = useCallback(() => {
    dispatch({ type: 'RESET_WORKFLOW' })
    try {
      sessionStorage.removeItem(STORAGE_KEY)
    } catch {
      // Ignore errors
    }
  }, [])

  const getTotalDuration = useCallback(() => {
    if (!state.timing.start) return null
    const end = state.timing.phaseStarts.complete || Date.now()
    return end - state.timing.start
  }, [state.timing])

  return (
    <WorkflowContext.Provider value={{ state, dispatch, startWorkflow, resetWorkflow, getTotalDuration }}>
      {children}
    </WorkflowContext.Provider>
  )
}

// Hook
export function useWorkflow() {
  const context = useContext(WorkflowContext)
  if (!context) {
    throw new Error('useWorkflow must be used within a WorkflowProvider')
  }
  return context
}
