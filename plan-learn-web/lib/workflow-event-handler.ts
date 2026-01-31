import type { MemoriEvent } from "@/components/memori-visualizer"
import type { WorkflowAction, PlanStep, Pattern, StepStatus } from "./workflow-context"

// Parse plan steps from create_plan tool result
export function parsePlanFromResult(resultPreview: string): { steps: PlanStep[]; success_criteria?: string } | null {
  console.log("[parsePlanFromResult] Parsing:", resultPreview.substring(0, 200))
  
  try {
    const parsed = JSON.parse(resultPreview)
    console.log("[parsePlanFromResult] Parsed keys:", Object.keys(parsed))

    // Backend format: { plan: { steps: [...], success_criteria: "..." } }
    if (parsed.plan && Array.isArray(parsed.plan.steps)) {
      console.log("[parsePlanFromResult] Found plan.steps with", parsed.plan.steps.length, "steps")
      return {
        steps: parsed.plan.steps.map((step: {
          step_number?: number
          action?: string
          description?: string
          reasoning?: string
          expected_outcome?: string
        }, index: number) => ({
          step_number: step.step_number || index + 1,
          action: step.action || step.description || `Step ${index + 1}`,
          reasoning: step.reasoning || '',
          expected_outcome: step.expected_outcome || '',
          status: 'pending' as StepStatus,
        })),
        success_criteria: parsed.plan.success_criteria,
      }
    }

    // Alternative format: steps at root level
    if (Array.isArray(parsed.steps)) {
      console.log("[parsePlanFromResult] Found steps at root level with", parsed.steps.length, "steps")
      return {
        steps: parsed.steps.map((step: {
          step_number?: number
          action?: string
          description?: string
          reasoning?: string
          expected_outcome?: string
        }, index: number) => ({
          step_number: step.step_number || index + 1,
          action: step.action || step.description || `Step ${index + 1}`,
          reasoning: step.reasoning || '',
          expected_outcome: step.expected_outcome || '',
          status: 'pending' as StepStatus,
        })),
        success_criteria: parsed.success_criteria,
      }
    }

    console.log("[parsePlanFromResult] No valid steps found in result")
    return null
  } catch (e) {
    console.error("[parsePlanFromResult] Failed to parse:", e)
    console.error("[parsePlanFromResult] Raw result:", resultPreview)
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
  
  console.log("[mapEventToActions] Event type:", event.type, "- Message:", event.message)

  switch (event.type) {
    case 'memori_recall_start':
      actions.push({ type: 'START_WORKFLOW' })
      break

    case 'memori_recall_complete': {
      const patterns = parsePatternsFromEvent(event)
      console.log("[mapEventToActions] Recalled patterns:", patterns.length)
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
      console.log("[mapEventToActions] Tool execution complete with", results?.length || 0, "results")
      
      if (!results || results.length === 0) break

      for (const result of results) {
        console.log("[mapEventToActions] Processing tool:", result.tool)
        
        // Handle create_plan tool
        if (result.tool === 'create_plan') {
          console.log("[mapEventToActions] Found create_plan tool, parsing...")
          const planData = parsePlanFromResult(result.result_preview)
          if (planData) {
            console.log("[mapEventToActions] Plan parsed successfully with", planData.steps.length, "steps")
            actions.push({ type: 'SET_PLAN', payload: planData })
          } else {
            console.error("[mapEventToActions] Failed to parse plan data")
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
      actions.push({ type: 'COMPLETE_WORKFLOW' })
      break

    default:
      break
  }
  
  console.log("[mapEventToActions] Returning", actions.length, "actions")
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
