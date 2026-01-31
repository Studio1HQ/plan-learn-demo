"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import type { WorkflowPhase, StepStatus } from "@/lib/workflow-context"

interface PhaseStepProps {
  phase: WorkflowPhase
  label: string
  description: string
  icon: string
  status: StepStatus
  duration?: number | null
  isExpanded?: boolean
  children?: React.ReactNode
}

const STATUS_STYLES: Record<StepStatus, {
  indicator: string
  text: string
  bg: string
}> = {
  pending: {
    indicator: 'bg-muted border-2 border-muted-foreground/30',
    text: 'text-muted-foreground',
    bg: 'bg-muted/30',
  },
  active: {
    indicator: 'bg-blue-500 border-2 border-blue-500',
    text: 'text-foreground',
    bg: 'bg-blue-50 dark:bg-blue-950/30',
  },
  complete: {
    indicator: 'bg-green-500 border-2 border-green-500',
    text: 'text-foreground',
    bg: 'bg-green-50 dark:bg-green-950/30',
  },
  failed: {
    indicator: 'bg-red-500 border-2 border-red-500',
    text: 'text-foreground',
    bg: 'bg-red-50 dark:bg-red-950/30',
  },
}

function formatDuration(ms: number | null | undefined): string {
  if (!ms) return ''
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

export function PhaseStep({
  label,
  description,
  icon,
  status,
  duration,
  isExpanded: defaultExpanded = false,
  children,
}: PhaseStepProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)
  const styles = STATUS_STYLES[status]
  const hasContent = !!children

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative"
    >
      {/* Phase indicator and content */}
      <div
        className={`flex gap-3 p-2 rounded-lg transition-colors ${
          hasContent ? 'cursor-pointer hover:bg-muted/50' : ''
        } ${status === 'active' ? styles.bg : ''}`}
        onClick={() => hasContent && setIsExpanded(!isExpanded)}
      >
        {/* Status indicator */}
        <div className="relative shrink-0">
          <motion.div
            className={`w-8 h-8 rounded-full flex items-center justify-center ${styles.indicator}`}
            animate={status === 'active' ? { scale: [1, 1.05, 1] } : {}}
            transition={status === 'active' ? { duration: 1.5, repeat: Infinity } : {}}
          >
            {status === 'complete' ? (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="text-white text-sm"
              >
                ✓
              </motion.span>
            ) : status === 'failed' ? (
              <span className="text-white text-sm">✕</span>
            ) : status === 'active' ? (
              <motion.span
                animate={{ opacity: [1, 0.5, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
                className="text-white text-sm"
              >
                {icon}
              </motion.span>
            ) : (
              <span className={`text-sm ${styles.text}`}>{icon}</span>
            )}
          </motion.div>

          {/* Pulse animation for active state */}
          {status === 'active' && (
            <motion.div
              className="absolute inset-0 rounded-full bg-blue-500"
              animate={{ scale: [1, 1.4], opacity: [0.4, 0] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h4 className={`text-sm font-medium ${styles.text}`}>{label}</h4>
            <div className="flex items-center gap-2">
              {duration !== null && duration !== undefined && (
                <span className="text-[10px] text-muted-foreground">
                  {formatDuration(duration)}
                </span>
              )}
              {hasContent && (
                <motion.span
                  animate={{ rotate: isExpanded ? 180 : 0 }}
                  className="text-muted-foreground text-xs"
                >
                  ▼
                </motion.span>
              )}
            </div>
          </div>
          <p className={`text-xs ${styles.text} opacity-70 truncate`}>{description}</p>
        </div>
      </div>

      {/* Expandable content */}
      <AnimatePresence>
        {isExpanded && children && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="ml-11 pl-2 border-l-2 border-muted">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
