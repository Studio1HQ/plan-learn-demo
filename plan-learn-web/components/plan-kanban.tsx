"use client"

import { motion } from "framer-motion"
import { Card } from "@/components/ui/card"
import { useWorkflow, type PlanStep } from "@/lib/workflow-context"

type StepStatus = "pending" | "active" | "complete" | "failed"

interface PlanKanbanProps {
  compact?: boolean
}

const STATUS_COLUMNS = [
  { id: "pending" as StepStatus, label: "To Do", color: "bg-slate-100 dark:bg-slate-900/50", borderColor: "border-slate-200 dark:border-slate-800" },
  { id: "active" as StepStatus, label: "In Progress", color: "bg-blue-50 dark:bg-blue-950/30", borderColor: "border-blue-200 dark:border-blue-800" },
  { id: "complete" as StepStatus, label: "Done", color: "bg-green-50 dark:bg-green-950/30", borderColor: "border-green-200 dark:border-green-800" },
]

function StepCard({ step, index, compact }: { step: PlanStep; index: number; compact?: boolean }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className={`bg-white dark:bg-card rounded-lg border shadow-sm p-3 cursor-default ${
        step.status === "active" ? "ring-2 ring-blue-400 dark:ring-blue-600" : ""
      }`}
    >
      <div className="flex items-start gap-2">
        <span className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
          step.status === "complete" ? "bg-green-500 text-white" :
          step.status === "active" ? "bg-blue-500 text-white" :
          step.status === "failed" ? "bg-red-500 text-white" :
          "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400"
        }`}>
          {step.step_number}
        </span>
        <div className="flex-1 min-w-0">
          <p className={`font-medium ${compact ? "text-xs" : "text-sm"} truncate`}>
            {step.action}
          </p>
          {!compact && step.reasoning && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
              {step.reasoning}
            </p>
          )}
          {!compact && step.expected_outcome && (
            <p className="text-[10px] text-muted-foreground mt-1 italic">
              Expected: {step.expected_outcome}
            </p>
          )}
          {step.actual_result && (
            <p className={`text-xs mt-1 ${step.status === "failed" ? "text-red-600" : "text-green-600"}`}>
              {step.status === "failed" ? "[x] " : "[ok] "}{step.actual_result.slice(0, 100)}
              {step.actual_result.length > 100 ? "..." : ""}
            </p>
          )}
        </div>
      </div>
    </motion.div>
  )
}

export function PlanKanban({ compact }: PlanKanbanProps) {
  const { state } = useWorkflow()
  
  const steps = state.planSteps
  
  if (steps.length === 0) {
    return (
      <Card className={`${compact ? "p-3" : "p-6"} flex flex-col items-center justify-center text-center`}>
        <div className={`${compact ? "w-10 h-10" : "w-16 h-16"} rounded-full bg-muted flex items-center justify-center mb-2`}>
          <span className={compact ? "text-lg" : "text-2xl"}>-</span>
        </div>
        <h3 className={`font-semibold ${compact ? "text-sm" : ""}`}>No Active Plan</h3>
        <p className={`text-muted-foreground ${compact ? "text-[10px]" : "text-sm"} mt-1`}>
          Ask the agent to create a plan to see it here
        </p>
      </Card>
    )
  }

  const completedSteps = steps.filter(s => s.status === "complete").length
  const progress = Math.round((completedSteps / steps.length) * 100)

  if (compact) {
    return (
      <div className="space-y-2">
        {/* Progress bar */}
        <div className="flex items-center gap-2 mb-2">
          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-blue-500 to-green-500"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
          <span className="text-[10px] text-muted-foreground">
            {completedSteps}/{steps.length}
          </span>
        </div>

        {/* Steps list */}
        <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
          {steps.map((step, i) => (
            <StepCard key={i} step={step} index={i} compact />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header with progress */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Plan Board</h3>
          <p className="text-xs text-muted-foreground">
            {completedSteps} of {steps.length} steps completed
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{progress}%</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-gradient-to-r from-blue-500 to-green-500"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.5 }}
        />
      </div>

      {/* Kanban Board */}
      <div className="grid grid-cols-3 gap-3">
        {STATUS_COLUMNS.map((column) => {
          const columnSteps = steps.filter((step) => step.status === column.id)
          
          return (
            <div
              key={column.id}
              className={`rounded-lg border ${column.borderColor} ${column.color} p-2`}
            >
              {/* Column header */}
              <div className="flex items-center justify-between mb-2 px-1">
                <span className="text-xs font-medium">
                  {column.label}
                </span>
                <span className="text-[10px] bg-white dark:bg-slate-800 px-1.5 py-0.5 rounded-full">
                  {columnSteps.length}
                </span>
              </div>

              {/* Steps */}
              <div className="space-y-2 min-h-[60px]">
                {columnSteps.map((step, i) => (
                  <StepCard key={`${step.step_number}-${i}`} step={step} index={i} />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Mini version for inline display in chat or headers
export function PlanMiniProgress({ className }: { className?: string }) {
  const { state } = useWorkflow()
  const steps = state.planSteps
  
  if (steps.length === 0) return null
  
  const completedSteps = steps.filter(s => s.status === "complete").length
  const progress = Math.round((completedSteps / steps.length) * 100)
  
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden w-20">
        <div
          className="h-full bg-green-500 transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
      <span className="text-[10px] text-muted-foreground">
        {completedSteps}/{steps.length}
      </span>
    </div>
  )
}
