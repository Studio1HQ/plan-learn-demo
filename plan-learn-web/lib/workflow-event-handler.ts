import type { MemoriEvent } from "@/components/memori-visualizer"
import type { WorkflowAction, PlanStep, Pattern, StepStatus } from "./workflow-context"

// Parse plan steps from create_plan tool result
export function parsePlanFromResult(resultPreview: string): { steps: PlanStep[]; success_criteria?: string } | null {
  try {
    const parsed = JSON.parse(resultPreview)

    if (parsed.plan && Array.isArray(parsed.plan.steps)) {
      return {
        steps: parsed.plan.steps.map((step: {
          step_number?: number
          action?: string
          reasoning?: string
          expected_outcome?: string
        }, index: number) => ({
          step_number: step.step_number || index + 1,
          action: step.action || '',
          reasoning: step.reasoning || '',
          expected_outcome: step.expected_outcome || '',
          status: 'pending' as StepStatus,
        })),
        success_criteria: parsed.plan.success_criteria,
      }
    }

    // Alternative format: steps at root level
    if (Array.isArray(parsed.steps)) {
      return {
        steps: parsed.steps.map((step: {
          step_number?: number
          action?: string
          reasoning?: string
          expected_outcome?: string
        }, index: number) => ({
          step_number: step.step_number || index + 1,
          action: step.action || '',
          reasoning: step.reasoning || '',
          expected_outcome: step.expected_outcome || '',
          status: 'pending' as StepStatus,
        })),
        success_criteria: parsed.success_criteria,
      }
    }

    return null
  } catch {
    return null
  }
}

// Parse execute_step result to get step outcome
export function parseStepResult(resultPreview: string): { stepIndex?: number; result: string; success: boolean } | null {
  try {
    const parsed = JSON.parse(resultPreview)

    return {
      stepIndex: parsed.step_number ? parsed.step_number - 1 : undefined,
      result: parsed.result || parsed.output || resultPreview,
      success: parsed.success !== false && parsed.status !== 'failed',
    }
  } catch {
    // If not JSON, treat the whole string as the result
    return {
      result: resultPreview,
      success: true,
    }
  }
}

// Parse patterns from recall complete event
export function parsePatternsFromEvent(event: MemoriEvent): Pattern[] {
  if (!event.data?.facts) return []

  return event.data.facts.map(fact => ({
    fact: fact.fact,
    mention_count: fact.mention_count,
    last_mentioned: fact.last_mentioned,
  }))
}

// Map a Memori event to workflow actions
export function mapEventToActions(
  event: MemoriEvent,
  currentStepIndex: number
): WorkflowAction[] {
  const actions: WorkflowAction[] = []

  switch (event.type) {
    case 'memori_recall_start':
      actions.push({ type: 'START_WORKFLOW' })
      break

    case 'memori_recall_complete': {
      const patterns = parsePatternsFromEvent(event)
      actions.push({ type: 'SET_RECALLED_PATTERNS', payload: patterns })
      break
    }

    case 'memori_llm_start':
      // Planning phase started
      actions.push({ type: 'SET_PHASE', payload: 'plan' })
      break

    case 'tool_execution_start':
      // Could be any tool - check if it's execute_step
      if (event.data?.tools?.includes('execute_step')) {
        actions.push({ type: 'START_STEP', payload: currentStepIndex })
      }
      break

    case 'tool_execution_complete': {
      const results = event.data?.results
      if (!results || results.length === 0) break

      for (const result of results) {
        // Handle create_plan tool
        if (result.tool === 'create_plan') {
          const planData = parsePlanFromResult(result.result_preview)
          if (planData) {
            actions.push({ type: 'SET_PLAN', payload: planData })
          }
        }

        // Handle execute_step tool
        if (result.tool === 'execute_step') {
          const stepResult = parseStepResult(result.result_preview)
          if (stepResult) {
            actions.push({
              type: 'UPDATE_STEP',
              payload: {
                stepIndex: stepResult.stepIndex ?? currentStepIndex,
                result: stepResult.result,
                status: stepResult.success ? 'complete' : 'failed',
              },
            })
          }
        }
      }
      break
    }

    case 'memori_store_start':
      actions.push({ type: 'SET_PHASE', payload: 'learn' })
      break

    case 'memori_store_complete':
      // Extract learnings from message or complete the workflow
      const learningMatch = event.message.match(/Stored (\d+) learning/)
      if (learningMatch) {
        // We don't have the actual learnings in the event, but we know they were stored
        // The learnings will be shown in the patterns panel
        actions.push({ type: 'COMPLETE_WORKFLOW' })
      } else {
        actions.push({ type: 'COMPLETE_WORKFLOW' })
      }
      break

    default:
      break
  }

  return actions
}

// Helper to process a batch of events
export function processEvents(
  events: MemoriEvent[],
  dispatch: React.Dispatch<WorkflowAction>,
  getCurrentStepIndex: () => number
): void {
  for (const event of events) {
    const actions = mapEventToActions(event, getCurrentStepIndex())
    for (const action of actions) {
      dispatch(action)
    }
  }
}
