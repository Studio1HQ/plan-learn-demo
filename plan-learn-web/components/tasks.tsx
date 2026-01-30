"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { motion, AnimatePresence } from "framer-motion"
import { toast } from "sonner"
import { api } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

type TaskType = "research" | "planning" | "analysis" | "writing" | "coding"

type Task = {
  id: string
  date: string
  name: string
  score: number  // success score (1-10)
  task_type: string
  type?: TaskType
  created_at?: string
}

type SampleTask = {
  id: string
  date: string
  name: string
  score: number
  task_type: string
  type?: TaskType
}

const TASK_CATEGORIES = [
  { id: "research", label: "Research" },
  { id: "planning", label: "Planning" },
  { id: "analysis", label: "Analysis" },
  { id: "writing", label: "Writing" },
  { id: "coding", label: "Coding" },
]

type TaskResponse = {
  status: string
  ingested: number
  task_ids: string[]
  tasks: Task[]
}

type TaskOutcome = "success" | "learning"

// Query keys
const taskKeys = {
  all: ["tasks"] as const,
  list: (userId: string) => [...taskKeys.all, "list", userId] as const,
  samples: ["sample-tasks"] as const,
}

export function Tasks({ userId }: { userId: string }) {
  const [score, setScore] = useState("")
  const [taskName, setTaskName] = useState("")
  const [taskOutcome, setTaskOutcome] = useState<TaskOutcome>("success")
  const [taskType, setTaskType] = useState("")
  const [activeTab, setActiveTab] = useState<"list" | "add">("list")

  const queryClient = useQueryClient()

  // Fetch user's tasks
  const { data: tasks = [], isLoading } = useQuery({
    queryKey: taskKeys.list(userId),
    queryFn: () => api<Task[]>(`/tasks/${userId}`),
  })

  // Fetch sample tasks
  const { data: sampleTasks = [] } = useQuery({
    queryKey: taskKeys.samples,
    queryFn: () => api<SampleTask[]>("/sample-tasks"),
  })

  // Add task mutation
  const addTaskMutation = useMutation({
    mutationFn: (taskData: { date: string; name: string; score: number; task_type: string }[]) =>
      api<TaskResponse>("/tasks", {
        method: "POST",
        body: JSON.stringify({
          user_id: userId,
          tasks: taskData,
        }),
      }),
    onSuccess: (data) => {
      // Invalidate and refetch tasks
      queryClient.invalidateQueries({ queryKey: taskKeys.list(userId) })

      const count = data.ingested || 1
      toast.success(
        count > 1
          ? `${count} tasks logged`
          : "Task logged",
        { duration: 2000 }
      )
    },
    onError: (error) => {
      toast.error("Failed to log task", {
        description: error instanceof Error ? error.message : "Please try again."
      })
    },
  })

  async function submit() {
    if (!taskName || !score || !taskType) return

    const numScore = Math.abs(Number(score))
    // Success is positive, learning (failure) is shown differently
    const finalScore = taskOutcome === "success" ? numScore : numScore

    await addTaskMutation.mutateAsync([
      {
        date: new Date().toISOString().slice(0, 10),
        name: taskName,
        score: finalScore,
        task_type: taskType,
      },
    ])

    setScore("")
    setTaskName("")
    setTaskType("")
    setTaskOutcome("success")
    setActiveTab("list")
  }

  async function addSampleTask(task: SampleTask) {
    await addTaskMutation.mutateAsync([
      {
        date: task.date,
        name: task.name,
        score: task.score,
        task_type: task.task_type,
      },
    ])
  }

  async function loadAllSampleData() {
    await addTaskMutation.mutateAsync(
      sampleTasks.slice(0, 10).map(task => ({
        date: task.date,
        name: task.name,
        score: task.score,
        task_type: task.task_type,
      }))
    )
    setActiveTab("list")
  }

  const isSubmitting = addTaskMutation.isPending

  const getTaskTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      research: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
      planning: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
      analysis: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
      writing: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
      coding: "bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-400",
      default: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
    }
    return colors[type] || colors.default
  }

  // Calculate average success score
  const avgScore = tasks.length > 0
    ? tasks.reduce((sum, task) => sum + Math.abs(task.score), 0) / tasks.length
    : 0

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-lg font-semibold">Task History</h2>
          {tasks.length > 0 && (
            <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
              {tasks.length} tasks completed • Avg score: {avgScore.toFixed(1)}
            </p>
          )}
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => setActiveTab("list")}
            className={`px-2 py-1 text-xs rounded ${
              activeTab === "list"
                ? "bg-primary text-primary-foreground"
                : "bg-muted hover:bg-muted/80"
            }`}
          >
            History
          </button>
          <button
            onClick={() => setActiveTab("add")}
            className={`px-2 py-1 text-xs rounded ${
              activeTab === "add"
                ? "bg-primary text-primary-foreground"
                : "bg-muted hover:bg-muted/80"
            }`}
          >
            + Log
          </button>
        </div>
      </div>

      {activeTab === "add" ? (
        <Card className="p-3 space-y-3 flex-1 overflow-auto">
          {/* Load all sample data button */}
          <div className="pb-3 border-b">
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={loadAllSampleData}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <motion.span
                  animate={{ opacity: [1, 0.5, 1] }}
                  transition={{ repeat: Infinity, duration: 1 }}
                >
                  Loading...
                </motion.span>
              ) : (
                "Load 10 Sample Tasks"
              )}
            </Button>
            <p className="text-[10px] text-muted-foreground text-center mt-1">
              Quick way to populate your task history with demo data
            </p>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-medium">Log task manually</p>

            {/* Outcome selector */}
            <div className="flex gap-1">
              <button
                onClick={() => {
                  setTaskOutcome("success")
                  setTaskType("")
                }}
                className={`flex-1 px-2 py-1.5 text-xs rounded ${
                  taskOutcome === "success"
                    ? "bg-emerald-500 text-white"
                    : "bg-muted hover:bg-muted/80"
                }`}
              >
                Success
              </button>
              <button
                onClick={() => {
                  setTaskOutcome("learning")
                  setTaskType("")
                }}
                className={`flex-1 px-2 py-1.5 text-xs rounded ${
                  taskOutcome === "learning"
                    ? "bg-amber-500 text-white"
                    : "bg-muted hover:bg-muted/80"
                }`}
              >
                Learning
              </button>
            </div>

            {/* Task type selector */}
            <div className="flex flex-wrap gap-1">
              {TASK_CATEGORIES.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setTaskType(cat.id)}
                  className={`px-2 py-1 text-[10px] rounded ${
                    taskType === cat.id
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted/50 hover:bg-muted"
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            <div className="flex gap-2">
              <Input
                placeholder="Task name"
                value={taskName}
                onChange={e => setTaskName(e.target.value)}
                disabled={isSubmitting}
                className="text-sm"
              />
              <Input
                placeholder="1-10"
                type="number"
                min="1"
                max="10"
                value={score}
                onChange={e => setScore(e.target.value)}
                disabled={isSubmitting}
                className="w-16 text-sm"
              />
              <Button size="sm" onClick={submit} disabled={isSubmitting || !taskName || !score || !taskType}>
                Log
              </Button>
            </div>
          </div>

          <div className="border-t pt-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium">Or add one by one</p>
              <p className="text-xs text-muted-foreground">Tap to add</p>
            </div>
            <div className="space-y-1.5 max-h-[100px] overflow-y-auto">
              {sampleTasks.slice(0, 6).map(task => (
                <motion.button
                  key={task.id}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={() => addSampleTask(task)}
                  disabled={isSubmitting}
                  className="w-full flex items-center justify-between p-2 rounded bg-muted/50 hover:bg-muted transition-colors text-left disabled:opacity-50"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs">{task.name}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${getTaskTypeColor(task.task_type)}`}>
                      {task.task_type}
                    </span>
                  </div>
                  <span className={`text-xs font-medium ${task.score >= 7 ? "text-emerald-600" : task.score >= 4 ? "text-amber-600" : "text-red-600"}`}>
                    {task.score}/10
                  </span>
                </motion.button>
              ))}
            </div>
          </div>
        </Card>
      ) : (
        <Card className="p-3 flex-1 overflow-hidden flex flex-col">
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="flex items-center justify-between p-2 rounded bg-muted/50">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-12" />
                </div>
              ))}
            </div>
          ) : tasks.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
              <p className="text-sm text-muted-foreground mb-2">No tasks completed yet</p>
              <Button size="sm" variant="outline" onClick={() => setActiveTab("add")}>
                Log a task
              </Button>
            </div>
          ) : (
            <div className="space-y-1.5 overflow-y-auto flex-1">
              <AnimatePresence mode="popLayout">
                {tasks.slice(0, 15).map((task, index) => (
                  <motion.div
                    key={task.id}
                    layout
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ delay: index * 0.03 }}
                    className="flex items-center justify-between p-2 rounded bg-muted/50"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs truncate">{task.name}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 ${getTaskTypeColor(task.task_type)}`}>
                        {task.task_type}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-xs font-medium ${task.score >= 7 ? "text-emerald-600 dark:text-emerald-400" : task.score >= 4 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400"}`}>
                        {task.score}/10
                      </span>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </Card>
      )}
    </div>
  )
}
