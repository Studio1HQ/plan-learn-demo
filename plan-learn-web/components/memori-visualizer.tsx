"use client"

import { motion, AnimatePresence } from "framer-motion"
import { Card } from "@/components/ui/card"

export type MemoriEventType =
  | "memori_recall_start"
  | "memori_recall_complete"
  | "memori_llm_start"
  | "tool_execution_start"
  | "tool_execution_complete"
  | "memori_store_start"
  | "memori_store_complete"

export type MemoriEvent = {
  type: MemoriEventType
  status: "retrieving" | "complete" | "processing" | "executing" | "storing"
  message: string
  data?: {
    facts?: Array<{
      fact: string
      mention_count: number
      last_mentioned: string | null
    }>
    session_info?: {
      total_sessions: number
      total_messages: number
    }
    recall_time_ms?: number
    tools?: string[]
    results?: Array<{
      tool: string
      result_preview: string
    }>
  }
}

interface MemoriVisualizerProps {
  events: MemoriEvent[]
  isActive: boolean
}

const STATUS_CONFIG: Record<string, { icon: string; color: string; bgColor: string; borderColor: string }> = {
  retrieving: { 
    icon: "[M]", 
    color: "text-blue-600", 
    bgColor: "bg-blue-50 dark:bg-blue-950/30",
    borderColor: "border-blue-200 dark:border-blue-800"
  },
  complete: { 
    icon: "[ok]", 
    color: "text-green-600", 
    bgColor: "bg-green-50 dark:bg-green-950/30",
    borderColor: "border-green-200 dark:border-green-800"
  },
  processing: { 
    icon: "[~]", 
    color: "text-purple-600", 
    bgColor: "bg-purple-50 dark:bg-purple-950/30",
    borderColor: "border-purple-200 dark:border-purple-800"
  },
  executing: { 
    icon: "[>]", 
    color: "text-orange-600", 
    bgColor: "bg-orange-50 dark:bg-orange-950/30",
    borderColor: "border-orange-200 dark:border-orange-800"
  },
  storing: { 
    icon: "[s]", 
    color: "text-indigo-600", 
    bgColor: "bg-indigo-50 dark:bg-indigo-950/30",
    borderColor: "border-indigo-200 dark:border-indigo-800"
  },
}

function getStepLabel(type: MemoriEventType): string {
  switch (type) {
    case "memori_recall_start":
    case "memori_recall_complete":
      return "Memory Recall"
    case "memori_llm_start":
      return "Planning & Reasoning"
    case "tool_execution_start":
    case "tool_execution_complete":
      return "Task Execution"
    case "memori_store_start":
    case "memori_store_complete":
      return "Learning Storage"
    default:
      return "Processing"
  }
}

function ProgressDots({ isActive }: { isActive: boolean }) {
  if (!isActive) return null

  return (
    <div className="flex gap-1 ml-2">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="w-1.5 h-1.5 bg-current rounded-full"
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
        />
      ))}
    </div>
  )
}

type FactItem = {
  fact: string
  mention_count: number
  last_mentioned: string | null
}

type ToolResultItem = {
  tool: string
  result_preview: string
}

function FactsList({ facts }: { facts: FactItem[] | undefined }) {
  if (!facts || facts.length === 0) return null

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      className="mt-2 space-y-1"
    >
      <p className="text-xs font-medium text-blue-700 dark:text-blue-300 mb-1 flex items-center gap-1">
        Patterns & Knowledge Retrieved:
      </p>
      <div className="space-y-1 max-h-32 overflow-y-auto">
        {facts.slice(0, 5).map((fact: FactItem, i: number) => (
          <motion.div
            key={i}
            initial={{ x: -10, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: i * 0.1 }}
            className="text-xs bg-blue-100/50 dark:bg-blue-900/20 rounded px-2 py-1.5 border border-blue-200/50 dark:border-blue-800/50"
          >
            <span className="text-foreground">{fact.fact}</span>
            {fact.mention_count > 1 && (
              <span className="ml-2 text-blue-600 dark:text-blue-400 text-[10px]">
                (used {fact.mention_count} times)
              </span>
            )}
          </motion.div>
        ))}
        {facts.length > 5 && (
          <p className="text-xs text-blue-600 dark:text-blue-400">
            +{facts.length - 5} more patterns from memory
          </p>
        )}
      </div>
    </motion.div>
  )
}

function ToolResults({ results }: { results: ToolResultItem[] | undefined }) {
  if (!results || results.length === 0) return null

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      className="mt-2 space-y-1"
    >
      <p className="text-xs font-medium text-orange-700 dark:text-orange-300 mb-1">
        Tool Results:
      </p>
      {results.map((result: ToolResultItem, i: number) => (
        <motion.div
          key={i}
          initial={{ x: -10, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: i * 0.1 }}
          className="text-xs bg-orange-100/50 dark:bg-orange-900/20 rounded px-2 py-1 border border-orange-200/50 dark:border-orange-800/50"
        >
          <span className="font-medium text-orange-600 dark:text-orange-400">
            {result.tool}
          </span>
          <span className="text-muted-foreground ml-1">
            → {result.result_preview.length > 100
              ? result.result_preview.slice(0, 100) + "..."
              : result.result_preview}
          </span>
        </motion.div>
      ))}
    </motion.div>
  )
}

export function MemoriVisualizer({ events, isActive }: MemoriVisualizerProps) {
  if (events.length === 0 && !isActive) return null

  // Get the latest event for each step
  const latestEvents = new Map<string, MemoriEvent>()
  events.forEach(event => {
    const stepKey = getStepLabel(event.type)
    latestEvents.set(stepKey, event)
  })

  // Get current step
  const currentEvent = events[events.length - 1]
  const isInProgress = currentEvent && !currentEvent.type.endsWith("_complete")

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className="mb-3"
      >
        <Card className="p-3 border-2 border-blue-200 dark:border-blue-800 bg-gradient-to-r from-blue-50/80 via-purple-50/50 to-indigo-50/80 dark:from-blue-950/30 dark:via-purple-950/20 dark:to-indigo-950/30">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center">
              <span className="text-[10px] text-white font-bold">M</span>
            </div>
            <span className="text-sm font-semibold bg-gradient-to-r from-blue-700 to-purple-700 dark:from-blue-300 dark:to-purple-300 bg-clip-text text-transparent">
              Memori
            </span>
            <span className="text-xs text-muted-foreground">
              Long-term Memory Pipeline
            </span>
            {isActive && isInProgress && (
              <span className="ml-auto text-xs text-muted-foreground flex items-center">
                Processing
                <ProgressDots isActive={true} />
              </span>
            )}
          </div>

          {/* Progress Steps */}
          <div className="space-y-2">
            {Array.from(latestEvents.entries()).map(([stepName, event], index) => {
              const config = STATUS_CONFIG[event.status] || STATUS_CONFIG.processing
              const isCurrentStep = event === currentEvent && isInProgress
              const isMemoryStep = stepName === "Memory Recall" || stepName === "Learning Storage"

              return (
                <motion.div
                  key={stepName}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className={`rounded-md p-2 ${config.bgColor} ${config.borderColor} border ${isMemoryStep ? 'ring-1 ring-blue-200 dark:ring-blue-800' : ''}`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`text-sm ${isMemoryStep ? 'animate-pulse' : ''}`}>{config.icon}</span>
                    <span className={`text-xs font-medium ${config.color}`}>
                      {stepName}
                    </span>
                    {isMemoryStep && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300">
                        memory
                      </span>
                    )}
                    {isCurrentStep && <ProgressDots isActive={true} />}
                    {event.data?.recall_time_ms && (
                      <span className="ml-auto text-[10px] text-muted-foreground">
                        {event.data.recall_time_ms}ms
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 ml-6">
                    {event.message}
                  </p>

                  {/* Show facts if available */}
                  {event.data?.facts && event.data.facts.length > 0 && (
                    <div className="ml-6">
                      <FactsList facts={event.data.facts} />
                    </div>
                  )}

                  {/* Show tool results if available */}
                  {event.data?.results && event.data.results.length > 0 && (
                    <div className="ml-6">
                      <ToolResults results={event.data.results} />
                    </div>
                  )}

                  {/* Show session info if available */}
                  {event.data?.session_info && (
                    <div className="ml-6 mt-1 text-[10px] text-blue-600 dark:text-blue-400">
                      Memory: {event.data.session_info.total_sessions} sessions, {event.data.session_info.total_messages} messages stored
                    </div>
                  )}
                </motion.div>
              )
            })}
          </div>
        </Card>
      </motion.div>
    </AnimatePresence>
  )
}

// Compact version for inline display
export function MemoriStatus({ event, isActive }: { event: MemoriEvent | null; isActive: boolean }) {
  if (!event && !isActive) return null

  const config = event ? STATUS_CONFIG[event.status] || STATUS_CONFIG.processing : STATUS_CONFIG.processing

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs ${config.bgColor} ${config.color}`}
    >
      <span>{config.icon}</span>
      <span>{event?.message || "Processing..."}</span>
      {isActive && <ProgressDots isActive={true} />}
    </motion.div>
  )
}
