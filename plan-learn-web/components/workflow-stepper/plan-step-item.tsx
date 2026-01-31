"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import type { PlanStep, StepStatus } from "@/lib/workflow-context"

interface PlanStepItemProps {
  step: PlanStep
  isCurrentStep: boolean
}

const STATUS_CONFIG: Record<StepStatus, {
  bg: string
  border: string
  text: string
  icon: string
}> = {
  pending: {
    bg: 'bg-muted/50',
    border: 'border-muted-foreground/20',
    text: 'text-muted-foreground',
    icon: '',
  },
  active: {
    bg: 'bg-orange-50 dark:bg-orange-950/30',
    border: 'border-orange-300 dark:border-orange-700',
    text: 'text-foreground',
    icon: '...',
  },
  complete: {
    bg: 'bg-green-50 dark:bg-green-950/30',
    border: 'border-green-300 dark:border-green-700',
    text: 'text-foreground',
    icon: '✓',
  },
  failed: {
    bg: 'bg-red-50 dark:bg-red-950/30',
    border: 'border-red-300 dark:border-red-700',
    text: 'text-foreground',
    icon: '✕',
  },
}

function formatDuration(ms: number | undefined): string {
  if (!ms) return ''
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

export function PlanStepItem({ step, isCurrentStep }: PlanStepItemProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const config = STATUS_CONFIG[step.status]

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className={`rounded-md border ${config.border} ${config.bg} overflow-hidden`}
    >
      {/* Header */}
      <div
        className={`flex items-center gap-2 px-2 py-1.5 cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 ${config.text}`}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {/* Step number */}
        <div
          className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-medium shrink-0 ${
            step.status === 'complete'
              ? 'bg-green-500 text-white'
              : step.status === 'failed'
              ? 'bg-red-500 text-white'
              : step.status === 'active'
              ? 'bg-orange-500 text-white'
              : 'bg-muted text-muted-foreground'
          }`}
        >
          {step.status === 'complete' ? (
            '✓'
          ) : step.status === 'failed' ? (
            '✕'
          ) : step.status === 'active' ? (
            <motion.span
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
            >
              {step.step_number}
            </motion.span>
          ) : (
            step.step_number
          )}
        </div>

        {/* Action title */}
        <span className={`text-xs flex-1 truncate ${config.text}`}>
          {step.action}
        </span>

        {/* Duration badge */}
        {step.duration_ms && (
          <span className="text-[10px] text-muted-foreground">
            {formatDuration(step.duration_ms)}
          </span>
        )}

        {/* Expand indicator */}
        <motion.span
          animate={{ rotate: isExpanded ? 180 : 0 }}
          className="text-muted-foreground text-[10px]"
        >
          ▼
        </motion.span>
      </div>

      {/* Expanded content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="border-t border-inherit"
          >
            <div className="px-2 py-2 space-y-2 text-xs">
              {/* Reasoning */}
              {step.reasoning && (
                <div>
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-0.5">
                    Reasoning
                  </p>
                  <p className="text-muted-foreground">{step.reasoning}</p>
                </div>
              )}

              {/* Expected outcome */}
              {step.expected_outcome && (
                <div>
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-0.5">
                    Expected Outcome
                  </p>
                  <p className="text-muted-foreground">{step.expected_outcome}</p>
                </div>
              )}

              {/* Actual result */}
              {step.actual_result && (
                <div>
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-0.5">
                    Actual Result
                  </p>
                  <p
                    className={
                      step.status === 'complete'
                        ? 'text-green-600 dark:text-green-400'
                        : step.status === 'failed'
                        ? 'text-red-600 dark:text-red-400'
                        : 'text-muted-foreground'
                    }
                  >
                    {step.actual_result}
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Active step indicator */}
      {isCurrentStep && step.status === 'active' && (
        <motion.div
          className="h-0.5 bg-orange-500"
          initial={{ width: 0 }}
          animate={{ width: '100%' }}
          transition={{ duration: 2, repeat: Infinity }}
        />
      )}
    </motion.div>
  )
}
