"use client"

import { useEffect, useState, useRef } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { motion, AnimatePresence } from "framer-motion"
import { toast } from "sonner"
import { api } from "@/lib/api"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"

type Alert = {
  id: string
  alert_type: string
  severity: string
  title: string
  message: string
  created_at: string | null
  acknowledged_at: string | null
}

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api"

// Query keys
const alertKeys = {
  all: ["alerts"] as const,
  list: (userId: string) => [...alertKeys.all, "list", userId] as const,
}

export function AlertsPanel({
  userId,
  apiKey
}: {
  userId: string
  apiKey?: string
}) {
  const [isConnected, setIsConnected] = useState(false)
  const [newAlertIds, setNewAlertIds] = useState<Set<string>>(new Set())
  const [expandedAlertId, setExpandedAlertId] = useState<string | null>(null)
  const eventSourceRef = useRef<EventSource | null>(null)

  const queryClient = useQueryClient()

  // Fetch alerts
  const { data: alerts = [], isLoading, error } = useQuery({
    queryKey: alertKeys.list(userId),
    queryFn: () => api<Alert[]>(`/alerts/${userId}`),
  })

  // Generate suggestions mutation
  const generateMutation = useMutation({
    mutationFn: () =>
      api<{ suggestions_created: number; alerts: Alert[] }>(
        `/alerts/${userId}/generate`,
        {
          method: "POST",
          body: JSON.stringify({ openai_api_key: apiKey || null })
        }
      ),
    onSuccess: (result) => {
      // Mark new alerts for animation
      const newIds = result.alerts.map(a => a.id)
      setNewAlertIds(ids => new Set([...ids, ...newIds]))
      setTimeout(() => {
        setNewAlertIds(ids => {
          const next = new Set(ids)
          newIds.forEach(id => next.delete(id))
          return next
        })
      }, 2000)

      // Invalidate to refetch with new alerts
      queryClient.invalidateQueries({ queryKey: alertKeys.list(userId) })

      if (result.suggestions_created > 0) {
        toast.success(`${result.suggestions_created} new tip${result.suggestions_created > 1 ? 's' : ''} generated!`)
      } else {
        toast.info("No new tips to generate right now")
      }
    },
    onError: (error) => {
      const errorMessage = error instanceof Error ? error.message : ""
      if (errorMessage.includes("402") || errorMessage.includes("API key")) {
        toast.error("API key required", {
          description: "Add your OpenAI API key in the chat to generate tips."
        })
      } else {
        toast.error("Failed to generate tips", {
          description: "Please try again later."
        })
      }
    },
  })

  // Acknowledge alert mutation
  const acknowledgeMutation = useMutation({
    mutationFn: (alertId: string) =>
      api(`/alerts/${alertId}/acknowledge`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: alertKeys.list(userId) })
    },
  })

  // Set up SSE connection for real-time updates
  useEffect(() => {
    const eventSource = new EventSource(`${BASE_URL}/alerts/${userId}/stream`)
    eventSourceRef.current = eventSource

    eventSource.onopen = () => {
      setIsConnected(true)
    }

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)

        if (data.type === "connected") {
          setIsConnected(true)
        } else if (data.type === "alert") {
          // Mark as new for animation
          setNewAlertIds(ids => new Set([...ids, data.alert.id]))
          setTimeout(() => {
            setNewAlertIds(ids => {
              const next = new Set(ids)
              next.delete(data.alert.id)
              return next
            })
          }, 2000)

          // Invalidate to refetch
          queryClient.invalidateQueries({ queryKey: alertKeys.list(userId) })
        }
      } catch {
        // Ignore parse errors
      }
    }

    eventSource.onerror = () => {
      setIsConnected(false)
    }

    return () => {
      eventSource.close()
      eventSourceRef.current = null
    }
  }, [userId, queryClient])

  const getSeverityVariant = (severity: string, alertType: string) => {
    if (alertType === "suggestion") return "secondary"
    if (severity === "high") return "destructive"
    if (severity === "success") return "default"
    return "secondary"
  }

  const getAlertIcon = (alertType: string, severity: string) => {
    if (alertType === "suggestion") return "💡"
    if (severity === "success") return "✓"
    if (severity === "high") return "⚠"
    return "📊"
  }

  const getAlertBgColor = (alertType: string, isNew: boolean) => {
    if (isNew) return "bg-yellow-50 dark:bg-yellow-950/30 border-yellow-300 dark:border-yellow-700"
    if (alertType === "suggestion") return "bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800"
    return ""
  }

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Learned Patterns</h2>
          <Skeleton className="h-8 w-24" />
        </div>
        <Card className="p-3 flex-1">
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </Card>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col h-full">
        <h2 className="text-lg font-semibold mb-3">Learned Patterns</h2>
        <Card className="p-3 border-destructive flex-1">
          <p className="text-sm text-destructive">Failed to load patterns</p>
        </Card>
      </div>
    )
  }

  const unacknowledgedAlerts = alerts.filter(a => !a.acknowledged_at)
  const acknowledgedAlerts = alerts.filter(a => a.acknowledged_at)

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">Patterns</h2>
          {isConnected && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="w-2 h-2 bg-green-500 rounded-full"
              title="Live updates active"
            />
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => generateMutation.mutate()}
          disabled={generateMutation.isPending}
          className="text-xs h-7"
        >
          {generateMutation.isPending ? (
            <motion.span
              animate={{ opacity: [1, 0.5, 1] }}
              transition={{ repeat: Infinity, duration: 1 }}
            >
              Analyzing...
            </motion.span>
          ) : (
            "✨ Extract Patterns"
          )}
        </Button>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col">
        {unacknowledgedAlerts.length === 0 && acknowledgedAlerts.length === 0 ? (
          <Card className="p-4 bg-muted/50 flex-1 flex items-center justify-center">
            <p className="text-sm text-muted-foreground text-center">
              No patterns learned yet. Complete tasks to build your knowledge base!
            </p>
          </Card>
        ) : (
          <div className="space-y-2 overflow-y-auto flex-1">
            <AnimatePresence mode="popLayout">
              {unacknowledgedAlerts.slice(0, 5).map((a, index) => (
                <motion.div
                  key={a.id}
                  layout
                  initial={{ opacity: 0, y: -20, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95, x: 100 }}
                  transition={{
                    type: "spring",
                    stiffness: 500,
                    damping: 30,
                    delay: index * 0.05
                  }}
                >
                  <Card
                    className={`p-3 transition-all cursor-pointer hover:shadow-md ${getAlertBgColor(a.alert_type, newAlertIds.has(a.id))} ${expandedAlertId === a.id ? "ring-2 ring-primary" : ""}`}
                    onClick={() => setExpandedAlertId(expandedAlertId === a.id ? null : a.id)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <motion.span
                            initial={newAlertIds.has(a.id) ? { scale: 0 } : false}
                            animate={{ scale: 1 }}
                            transition={{ type: "spring", stiffness: 500 }}
                          >
                            {getAlertIcon(a.alert_type, a.severity)}
                          </motion.span>
                          <h3 className="font-medium text-sm truncate">{a.title}</h3>
                          <Badge
                            variant={getSeverityVariant(a.severity, a.alert_type)}
                            className="text-[10px] px-1.5 py-0"
                          >
                            {a.alert_type === "suggestion" ? "tip" : a.severity}
                          </Badge>
                        </div>
                        <AnimatePresence mode="wait">
                          {expandedAlertId === a.id ? (
                            <motion.p
                              key="expanded"
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              exit={{ opacity: 0, height: 0 }}
                              className="mt-2 text-xs text-muted-foreground"
                            >
                              {a.message}
                            </motion.p>
                          ) : (
                            <motion.p
                              key="collapsed"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              className="mt-1 text-xs text-muted-foreground line-clamp-2"
                            >
                              {a.message}
                            </motion.p>
                          )}
                        </AnimatePresence>
                        {expandedAlertId === a.id && (
                          <p className="mt-1 text-[10px] text-muted-foreground/60">
                            Click to collapse
                          </p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-[10px] h-6 px-2 shrink-0"
                        onClick={(e) => {
                          e.stopPropagation()
                          acknowledgeMutation.mutate(a.id)
                        }}
                        disabled={acknowledgeMutation.isPending}
                      >
                        Dismiss
                      </Button>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>

            {acknowledgedAlerts.length > 0 && (
              <details className="group mt-2">
                <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                  {acknowledgedAlerts.length} dismissed
                </summary>
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="mt-2 space-y-1"
                >
                  {acknowledgedAlerts.slice(0, 3).map(a => (
                    <Card key={a.id} className="p-2 opacity-50">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs">{getAlertIcon(a.alert_type, a.severity)}</span>
                        <span className="text-xs truncate">{a.title}</span>
                      </div>
                    </Card>
                  ))}
                </motion.div>
              </details>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
