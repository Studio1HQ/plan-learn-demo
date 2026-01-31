"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useWorkflow, type WorkflowPhase } from "@/lib/workflow-context"
import { Card } from "@/components/ui/card"
import { PhaseStep } from "@/components/workflow-stepper/phase-step"
import { PlanStepItem } from "@/components/workflow-stepper/plan-step-item"
import { AlertsPanel } from "@/components/alerts-panel"
import { Tasks } from "@/components/tasks"

type TabId = 'pipeline' | 'patterns' | 'history'

interface WorkflowStepperProps {
  userId: string
  apiKey?: string
}

const PHASE_ORDER: WorkflowPhase[] = ['recall', 'plan', 'execute', 'learn', 'complete']

const PHASE_CONFIG: Record<WorkflowPhase, {
  label: string
  description: string
  icon: string
  memoryPhase?: boolean
}> = {
  idle: { label: 'Ready', description: 'Waiting for task', icon: '' },
  recall: { label: 'Memory Recall', description: 'Retrieving patterns from Memori', icon: '', memoryPhase: true },
  plan: { label: 'Plan', description: 'Creating execution strategy', icon: '' },
  execute: { label: 'Execute', description: 'Running plan steps', icon: '' },
  learn: { label: 'Memory Store', description: 'Storing learnings in Memori', icon: '', memoryPhase: true },
  complete: { label: 'Complete', description: 'Workflow finished', icon: '' },
  error: { label: 'Error', description: 'Something went wrong', icon: '' },
}

function formatDuration(ms: number | null): string {
  if (!ms) return ''
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 px-3 py-2 text-xs font-medium transition-colors relative ${
        active
          ? 'text-foreground border-b-2 border-primary'
          : 'text-muted-foreground hover:text-foreground border-b-2 border-transparent'
      }`}
    >
      {children}
    </button>
  )
}

export function WorkflowStepper({ userId, apiKey }: WorkflowStepperProps) {
  const [activeTab, setActiveTab] = useState<TabId>('pipeline')
  const { state, getTotalDuration, resetWorkflow } = useWorkflow()

  const isActive = state.phase !== 'idle' && state.phase !== 'complete' && state.phase !== 'error'
  const showWorkflow = state.phase !== 'idle'

  // Get phase index for progress indication
  const currentPhaseIndex = PHASE_ORDER.indexOf(state.phase)

  return (
    <div className="flex flex-col h-full">
      {/* Tab Bar */}
      <div className="flex border-b mb-3 shrink-0">
        <TabButton
          active={activeTab === 'pipeline'}
          onClick={() => setActiveTab('pipeline')}
        >
          Pipeline
          {isActive && (
            <motion.span
              className="ml-1 w-1.5 h-1.5 bg-blue-500 rounded-full inline-block"
              animate={{ opacity: [1, 0.4, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
          )}
        </TabButton>
        <TabButton
          active={activeTab === 'patterns'}
          onClick={() => setActiveTab('patterns')}
        >
          Patterns
        </TabButton>
        <TabButton
          active={activeTab === 'history'}
          onClick={() => setActiveTab('history')}
        >
          History
        </TabButton>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        <AnimatePresence mode="wait">
          {activeTab === 'pipeline' && (
            <motion.div
              key="pipeline"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="h-full flex flex-col"
            >
              {!showWorkflow ? (
                <Card className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                  <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
                    <span className="text-2xl">-</span>
                  </div>
                  <h3 className="font-semibold mb-2">No Active Workflow</h3>
                  <p className="text-sm text-muted-foreground max-w-[200px]">
                    Start a conversation to see the Plan and Learn workflow in action.
                  </p>
                </Card>
              ) : (
                <>
                  {/* Phase Timeline */}
                  <div className="flex-1 overflow-y-auto pr-1">
                    <div className="relative">
                      {/* Vertical connecting line */}
                      <div className="absolute left-[15px] top-6 bottom-6 w-0.5 bg-border" />

                      {/* Phases */}
                      <div className="space-y-1">
                        {/* Recall Phase */}
                        <PhaseStep
                          phase="recall"
                          label={PHASE_CONFIG.recall.label}
                          description={PHASE_CONFIG.recall.description}
                          icon={PHASE_CONFIG.recall.icon}
                          highlight={true}
                          status={
                            state.phase === 'recall'
                              ? 'active'
                              : currentPhaseIndex > 0
                              ? 'complete'
                              : 'pending'
                          }
                          duration={state.timing.phaseDurations.recall}
                          isExpanded={state.phase === 'recall' || state.recalledPatterns.length > 0}
                        >
                          {state.recalledPatterns.length > 0 ? (
                            <div className="space-y-1 mt-2">
                              <p className="text-xs font-medium text-blue-700 dark:text-blue-300 flex items-center gap-1">
                                <span>*</span> {state.recalledPatterns.length} pattern{state.recalledPatterns.length !== 1 ? 's' : ''} from memory:
                              </p>
                              <div className="space-y-1 max-h-24 overflow-y-auto">
                                {state.recalledPatterns.slice(0, 3).map((pattern, i) => (
                                  <motion.div
                                    key={i}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: i * 0.1 }}
                                    className="text-xs bg-blue-50 dark:bg-blue-950/30 rounded px-2 py-1 border border-blue-200 dark:border-blue-800"
                                  >
                                    {pattern.fact}
                                    {pattern.mention_count > 1 && (
                                      <span className="ml-1 text-blue-600 dark:text-blue-400">
                                        (used {pattern.mention_count} times)
                                      </span>
                                    )}
                                  </motion.div>
                                ))}
                                {state.recalledPatterns.length > 3 && (
                                  <p className="text-[10px] text-blue-600 dark:text-blue-400 pl-2">
                                    +{state.recalledPatterns.length - 3} more from memory
                                  </p>
                                )}
                              </div>
                            </div>
                          ) : currentPhaseIndex > 0 && (
                            <p className="text-[10px] text-muted-foreground mt-2">
                              No previous patterns found - this is a new learning opportunity!
                            </p>
                          )}
                        </PhaseStep>

                        {/* Plan Phase */}
                        <PhaseStep
                          phase="plan"
                          label={PHASE_CONFIG.plan.label}
                          description={PHASE_CONFIG.plan.description}
                          icon={PHASE_CONFIG.plan.icon}
                          status={
                            state.phase === 'plan'
                              ? 'active'
                              : currentPhaseIndex > 1
                              ? 'complete'
                              : 'pending'
                          }
                          duration={state.timing.phaseDurations.plan}
                          isExpanded={state.phase === 'plan' || state.planSteps.length > 0}
                        >
                          {state.planSteps.length > 0 && (
                            <div className="space-y-1 mt-2">
                              <p className="text-xs font-medium text-muted-foreground">
                                {state.planSteps.length} step{state.planSteps.length !== 1 ? 's' : ''} planned:
                              </p>
                              <div className="space-y-1">
                                {state.planSteps.map((step, i) => (
                                  <PlanStepItem
                                    key={i}
                                    step={step}
                                    isCurrentStep={i === state.currentStepIndex && state.phase === 'execute'}
                                  />
                                ))}
                              </div>
                              {state.successCriteria && (
                                <p className="text-[10px] text-muted-foreground mt-2 pl-2 border-l-2 border-green-300 dark:border-green-700">
                                  Success: {state.successCriteria}
                                </p>
                              )}
                            </div>
                          )}
                        </PhaseStep>

                        {/* Execute Phase */}
                        <PhaseStep
                          phase="execute"
                          label={PHASE_CONFIG.execute.label}
                          description={
                            state.phase === 'execute' && state.currentStepIndex >= 0
                              ? `Step ${state.currentStepIndex + 1} of ${state.planSteps.length}`
                              : PHASE_CONFIG.execute.description
                          }
                          icon={PHASE_CONFIG.execute.icon}
                          status={
                            state.phase === 'execute'
                              ? 'active'
                              : currentPhaseIndex > 2
                              ? 'complete'
                              : 'pending'
                          }
                          duration={state.timing.phaseDurations.execute}
                          isExpanded={state.phase === 'execute'}
                        >
                          {state.phase === 'execute' && state.currentStepIndex >= 0 && (
                            <div className="mt-2">
                              <div className="flex items-center gap-2 mb-1">
                                <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                                  <motion.div
                                    className="h-full bg-orange-500"
                                    initial={{ width: 0 }}
                                    animate={{
                                      width: `${((state.currentStepIndex + 1) / state.planSteps.length) * 100}%`,
                                    }}
                                    transition={{ duration: 0.3 }}
                                  />
                                </div>
                                <span className="text-[10px] text-muted-foreground">
                                  {state.currentStepIndex + 1}/{state.planSteps.length}
                                </span>
                              </div>
                              {state.planSteps[state.currentStepIndex] && (
                                <p className="text-xs text-muted-foreground truncate">
                                  {state.planSteps[state.currentStepIndex].action}
                                </p>
                              )}
                            </div>
                          )}
                        </PhaseStep>

                        {/* Learn Phase */}
                        <PhaseStep
                          phase="learn"
                          label={PHASE_CONFIG.learn.label}
                          description={PHASE_CONFIG.learn.description}
                          icon={PHASE_CONFIG.learn.icon}
                          highlight={true}
                          status={
                            state.phase === 'learn'
                              ? 'active'
                              : currentPhaseIndex > 3
                              ? 'complete'
                              : 'pending'
                          }
                          duration={state.timing.phaseDurations.learn}
                          isExpanded={state.phase === 'learn' || state.learnings.length > 0}
                        >
                          {state.learnings.length > 0 && (
                            <div className="space-y-1 mt-2">
                              <p className="text-xs font-medium text-indigo-700 dark:text-indigo-300 flex items-center gap-1">
                                <span>*</span> Stored in Memori for future tasks:
                              </p>
                              <div className="space-y-1">
                                {state.learnings.map((learning, i) => (
                                  <motion.div
                                    key={i}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: i * 0.1 }}
                                    className="text-xs bg-indigo-50 dark:bg-indigo-950/30 rounded px-2 py-1 border border-indigo-200 dark:border-indigo-800"
                                  >
                                    {learning}
                                  </motion.div>
                                ))}
                              </div>
                            </div>
                          )}
                        </PhaseStep>

                        {/* Complete Phase */}
                        {(state.phase === 'complete' || state.phase === 'error') && (
                          <PhaseStep
                            phase={state.phase}
                            label={PHASE_CONFIG[state.phase].label}
                            description={PHASE_CONFIG[state.phase].description}
                            icon={PHASE_CONFIG[state.phase].icon}
                            status={state.phase === 'error' ? 'failed' : 'complete'}
                            isExpanded={true}
                          >
                            {state.error && (
                              <p className="text-xs text-red-600 dark:text-red-400 mt-2">
                                {state.error}
                              </p>
                            )}
                          </PhaseStep>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Status Footer */}
                  <div className="shrink-0 pt-3 mt-3 border-t">
                    <div className="flex items-center justify-between">
                      <div className="text-xs text-muted-foreground">
                        {isActive ? (
                          <span className="flex items-center gap-1.5">
                            <motion.span
                              className="w-2 h-2 bg-blue-500 rounded-full"
                              animate={{ opacity: [1, 0.4, 1] }}
                              transition={{ duration: 1.5, repeat: Infinity }}
                            />
                            In progress...
                          </span>
                        ) : state.phase === 'complete' ? (
                          <span className="flex items-center gap-1.5">
                            <span className="w-2 h-2 bg-green-500 rounded-full" />
                            Complete
                            {getTotalDuration() && (
                              <span className="text-muted-foreground">
                                ({formatDuration(getTotalDuration())})
                              </span>
                            )}
                          </span>
                        ) : state.phase === 'error' ? (
                          <span className="flex items-center gap-1.5">
                            <span className="w-2 h-2 bg-red-500 rounded-full" />
                            Failed
                          </span>
                        ) : null}
                      </div>
                      {(state.phase === 'complete' || state.phase === 'error') && (
                        <button
                          onClick={resetWorkflow}
                          className="text-xs text-primary hover:underline"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </div>
                </>
              )}
            </motion.div>
          )}

          {activeTab === 'patterns' && (
            <motion.div
              key="patterns"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="h-full"
            >
              <AlertsPanel userId={userId} apiKey={apiKey} compact />
            </motion.div>
          )}

          {activeTab === 'history' && (
            <motion.div
              key="history"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="h-full"
            >
              <Tasks userId={userId} compact />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
