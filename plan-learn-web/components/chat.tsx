"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { api, apiStream } from "@/lib/api"
import { MemoriVisualizer, type MemoriEvent } from "@/components/memori-visualizer"
import { useWorkflow } from "@/lib/workflow-context"
import { mapEventToActions } from "@/lib/workflow-event-handler"

import { MarkdownMessage } from "@/components/markdown-message"
import { ClickableSteps } from "@/components/clickable-steps"

type Message = {
  role: "user" | "assistant"
  content: string
  isWelcome?: boolean
}

// Parse stream content to separate Memori events from text
function parseStreamContent(content: string): { text: string; events: MemoriEvent[] } {
  const events: MemoriEvent[] = []
  // Use a pattern that works without 's' flag - match [MEMORI] followed by any chars until [/MEMORI]
  const memoriRegex = /\[MEMORI\]([\s\S]*?)\[\/MEMORI\]/g

  let text = content
  let match

  while ((match = memoriRegex.exec(content)) !== null) {
    try {
      const eventData = JSON.parse(match[1])
      events.push(eventData as MemoriEvent)
    } catch {
      // Skip invalid JSON
    }
  }

  // Remove all Memori blocks from text
  text = content.replace(memoriRegex, "")

  return { text, events }
}

type UsageInfo = {
  user_id: string
  free_uses: number
  limit: number
  needs_api_key: boolean
}

const userMessage = (content: string): Message => ({
  role: "user",
  content,
})

const assistantMessage = (content = ""): Message => ({
  role: "assistant",
  content,
})

const WELCOME_MESSAGE: Message = {
  role: "assistant",
  content: `Hi! I'm your **Plan and Learn** Agent powered by **Memori**.

I break down complex tasks into steps, execute them, and learn from each success.

**How I Work:**
- **Recall**: Search memory for similar past tasks
- **Plan**: Create step-by-step strategies  
- **Execute**: Work through each step
- **Learn**: Store patterns for future use

**What makes me special:**
- Long-term memory across all conversations
- Pattern recognition and reuse
- Continuous improvement

**Try asking me:**
- "Research REST API best practices"
- "Create a study plan for Python"
- "Analyze this problem"

What task would you like help with?`,
  isWelcome: true
}

interface ChatProps {
  userId: string
  onApiKeyChange?: (apiKey: string) => void
  onWorkflowEvent?: (event: MemoriEvent) => void
}

const MEMORI_SIGNUP_URL = "https://memorilabs.ai"

export function Chat({ userId, onApiKeyChange, onWorkflowEvent }: ChatProps) {
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE])
  const [input, setInput] = useState("")
  const [apiKey, setApiKey] = useState("")
  const [apiKeyInput, setApiKeyInput] = useState("")
  const [memoriApiKey, setMemoriApiKey] = useState("")
  const [memoriApiKeyInput, setMemoriApiKeyInput] = useState("")
  const [needsApiKey, setNeedsApiKey] = useState(false)
  const [showApiKeyInput, setShowApiKeyInput] = useState(false)
  const [activeKeyTab, setActiveKeyTab] = useState<"openai" | "memori">("openai")
  const [isValidatingKey, setIsValidatingKey] = useState(false)
  const [isTyping, setIsTyping] = useState(false)
  const [usageInfo, setUsageInfo] = useState<UsageInfo | null>(null)
  const [isLoadingUsage, setIsLoadingUsage] = useState(true)
  const [memoriEvents, setMemoriEvents] = useState<MemoriEvent[]>([])
  const [showMemoriVisualizer, setShowMemoriVisualizer] = useState(false)
  const [processedEventIds, setProcessedEventIds] = useState<Set<string>>(new Set())

  const abortRef = useRef<AbortController | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const apiKeyInputRef = useRef<HTMLInputElement>(null)
  const memoriKeyInputRef = useRef<HTMLInputElement>(null)

  // Get workflow context for dispatching events
  const { state: workflowState, dispatch: workflowDispatch, startWorkflow, resetWorkflow } = useWorkflow()

  // Process workflow events
  const processWorkflowEvent = useCallback((event: MemoriEvent) => {
    // Create a unique ID for the event to avoid duplicate processing
    const eventId = `${event.type}-${event.message}-${Date.now()}`
    if (processedEventIds.has(eventId)) return

    setProcessedEventIds(prev => new Set([...prev, eventId]))

    // Map the event to workflow actions and dispatch them
    const actions = mapEventToActions(event, workflowState.currentStepIndex)
    for (const action of actions) {
      workflowDispatch(action)
    }

    // Also call the onWorkflowEvent callback if provided
    onWorkflowEvent?.(event)
  }, [workflowState.currentStepIndex, workflowDispatch, onWorkflowEvent, processedEventIds])

  // Fetch usage info
  async function refreshUsage() {
    try {
      const usage = await api<UsageInfo>(`/usage/${userId}`)
      setUsageInfo(usage)
      if (usage.needs_api_key) {
        setNeedsApiKey(true)
      }
      return usage
    } catch {
      return null
    }
  }

  // Check usage on mount
  useEffect(() => {
    async function checkUsage() {
      setIsLoadingUsage(true)
      await refreshUsage()
      setIsLoadingUsage(false)
    }
    checkUsage()
  }, [userId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, isTyping])

  useEffect(() => {
    onApiKeyChange?.(apiKey)
  }, [apiKey, onApiKeyChange])

  useEffect(() => {
    if (showApiKeyInput || needsApiKey) {
      setTimeout(() => apiKeyInputRef.current?.focus(), 100)
    }
  }, [showApiKeyInput, needsApiKey])

  function isValidApiKeyFormat(key: string): boolean {
    return key.startsWith("sk-") && key.length >= 20
  }

  function isValidMemoriKeyFormat(key: string): boolean {
    return key.length >= 10
  }

  async function saveMemoriApiKey() {
    const key = memoriApiKeyInput.trim()

    if (!key) {
      toast.error("Please enter a Memori API key")
      return
    }

    if (!isValidMemoriKeyFormat(key)) {
      toast.error("Invalid Memori API key format", {
        description: "Please check your API key and try again."
      })
      return
    }

    setMemoriApiKey(key)
    setMemoriApiKeyInput("")
    setShowApiKeyInput(false)
    toast.success("Memori API key saved!", {
      description: "Your Memori key is now active."
    })
  }

  async function saveApiKey() {
    const key = apiKeyInput.trim()

    if (!key) {
      toast.error("Please enter an API key")
      return
    }

    if (!isValidApiKeyFormat(key)) {
      toast.error("Invalid API key format", {
        description: "OpenAI API keys start with 'sk-' and are at least 20 characters long."
      })
      return
    }

    setIsValidatingKey(true)

    try {
      const res = await apiStream("/chat", {
        method: "POST",
        body: JSON.stringify({
          user_id: userId,
          message: "test",
          openai_api_key: key,
        }),
      })

      if (res.ok || res.status !== 401) {
        setApiKey(key)
        setApiKeyInput("")
        setNeedsApiKey(false)
        setShowApiKeyInput(false)
        toast.success("API key saved!", {
          description: "You can now continue chatting without limits."
        })
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error"

      if (errorMessage.includes("401") || errorMessage.includes("Unauthorized") || errorMessage.includes("invalid")) {
        toast.error("Invalid API key", {
          description: "Please check your API key and try again. Make sure it's an active OpenAI API key."
        })
      } else if (errorMessage.includes("429")) {
        toast.error("Rate limit exceeded", {
          description: "Your API key has hit rate limits. Please try again later."
        })
      } else if (errorMessage.includes("insufficient_quota")) {
        toast.error("Insufficient quota", {
          description: "Your API key has run out of credits. Please add credits to your OpenAI account."
        })
      } else {
        setApiKey(key)
        setApiKeyInput("")
        setNeedsApiKey(false)
        setShowApiKeyInput(false)
        toast.success("API key saved!")
      }
    } finally {
      setIsValidatingKey(false)
    }
  }

  async function sendMessage(content: string) {
    if (!content.trim() || isTyping) return

    // Reset Memori state for new message
    setMemoriEvents([])
    setShowMemoriVisualizer(true)
    setProcessedEventIds(new Set())

    // Reset and start workflow tracking
    resetWorkflow()
    startWorkflow()

    setMessages(prev => [
      ...prev,
      userMessage(content),
      assistantMessage(),
    ])

    setIsTyping(true)

    const controller = new AbortController()
    abortRef.current = controller

    let res: Response

    try {
      // Build conversation history (exclude welcome message and current empty assistant message)
      const conversationHistory = messages
        .slice(1) // Skip welcome message
        .filter(m => m.content.trim() !== "") // Skip empty messages
        .map(m => ({ role: m.role, content: m.content }))

      res = await apiStream("/chat", {
        method: "POST",
        signal: controller.signal,
        body: JSON.stringify({
          user_id: userId,
          message: content,
          openai_api_key: apiKey || undefined,
          conversation_history: conversationHistory,
        }),
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : ""

      if (errorMessage.includes("402") || errorMessage.includes("Free usage limit")) {
        setNeedsApiKey(true)
        setUsageInfo(prev => prev ? { ...prev, needs_api_key: true } : null)
        toast.info("Free messages used up", {
          description: "Enter your OpenAI API key to continue chatting."
        })
      } else if (errorMessage.includes("401") || errorMessage.includes("Unauthorized")) {
        toast.error("API key error", {
          description: "Your API key is invalid or has expired. Please update it."
        })
        setApiKey("")
        setNeedsApiKey(true)
      } else if (errorMessage.includes("429")) {
        toast.error("Rate limit exceeded", {
          description: "Too many requests. Please wait a moment and try again."
        })
      } else if (errorMessage.includes("500") || errorMessage.includes("503")) {
        toast.error("Server error", {
          description: "Something went wrong. Please try again."
        })
      } else {
        toast.error("Failed to send message", {
          description: errorMessage || "Please check your connection and try again."
        })
      }

      setIsTyping(false)
      setShowMemoriVisualizer(false)
      setMessages(prev => prev.slice(0, -1))
      return
    }

    const reader = res.body?.getReader()
    if (!reader) {
      setIsTyping(false)
      setShowMemoriVisualizer(false)
      return
    }

    const decoder = new TextDecoder()
    let rawContent = "" // Accumulate raw content for parsing

    try {
      while (true) {
        const { value, done } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        rawContent += chunk

        // Parse the accumulated content to extract Memori events and text
        const { text, events } = parseStreamContent(rawContent)

        // Update Memori events and dispatch to workflow
        if (events.length > 0) {
          setMemoriEvents(events)
          // Process each new event for workflow tracking
          for (const event of events) {
            processWorkflowEvent(event)
          }
        }

        // Update message with clean text (no Memori blocks)
        setMessages(prev => {
          const updated = [...prev]
          const last = updated[updated.length - 1]

          if (last.role === "assistant") {
            updated[updated.length - 1] = assistantMessage(text)
          }

          return updated
        })
      }

      // Refresh usage count after successful message
      await refreshUsage()

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : ""
      if (!errorMessage.includes("abort")) {
        toast.error("Connection lost", {
          description: "The response was interrupted. Please try again."
        })
      }
    }

    setIsTyping(false)
    // Keep visualizer visible for a moment after completion, then hide
    setTimeout(() => setShowMemoriVisualizer(false), 2000)
    abortRef.current = null
  }

  // Wrapper for sending input field content
  async function send() {
    if (!input.trim()) return
    const content = input
    setInput("")
    await sendMessage(content)
  }

  function stop() {
    abortRef.current?.abort()
    setIsTyping(false)
  }

  function removeApiKey() {
    setApiKey("")
    setApiKeyInput("")
    toast.info("OpenAI API key removed", {
      description: "You'll use free messages until they run out."
    })
  }

  function removeMemoriApiKey() {
    setMemoriApiKey("")
    setMemoriApiKeyInput("")
    toast.info("Memori API key removed")
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  const handleApiKeyInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault()
      saveApiKey()
    }
    if (e.key === "Escape") {
      if (!needsApiKey) {
        setShowApiKeyInput(false)
        setApiKeyInput("")
      }
    }
  }

  // Calculate remaining messages
  const remainingMessages = usageInfo ? usageInfo.limit - usageInfo.free_uses : 0

  return (
    <div className="h-full flex flex-col">
      <h2 className="text-lg font-semibold mb-3 shrink-0">Chat</h2>
      <div className="relative flex-1 border rounded-lg flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((m, i) => (
            <Card
              key={i}
              className={`p-3 ${
                m.role === "user"
                  ? "ml-auto bg-primary text-primary-foreground max-w-[80%]"
                  : "mr-auto max-w-[85%] bg-card"
              }`}
            >
              {m.role === "assistant" ? (
                <>
                  <MarkdownMessage content={m.content} />
                  {/* Show clickable steps for assistant messages (skip welcome message) */}
                  {!isTyping && i === messages.length - 1 && m.role === "assistant" && !m.isWelcome && (
                    <ClickableSteps 
                      content={m.content} 
                      onStepClick={(stepText) => {
                        sendMessage(stepText)
                      }}
                    />
                  )}
                </>
              ) : (
                <span className="whitespace-pre-wrap">{m.content}</span>
              )}
            </Card>
          ))}

          {/* Memori Visualization */}
          {showMemoriVisualizer && memoriEvents.length > 0 && (
            <MemoriVisualizer events={memoriEvents} isActive={isTyping} />
          )}

          {isTyping && messages[messages.length - 1]?.content === "" && (
            <Card className="mr-auto p-3 flex items-center gap-2">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
              <span className="text-sm text-muted-foreground">Thinking...</span>
            </Card>
          )}

          <div ref={bottomRef} />
        </div>

        <AnimatePresence>
          {(needsApiKey || showApiKeyInput) && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="border-t bg-muted overflow-hidden"
            >
              <div className="p-4 space-y-3">
                {needsApiKey ? (
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
                      <span className="text-lg">🔑</span>
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-sm">Free messages used up</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Enter your API key to continue chatting without limits.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-sm">Use your own API key</p>
                    <button
                      onClick={() => {
                        setShowApiKeyInput(false)
                        setApiKeyInput("")
                        setMemoriApiKeyInput("")
                      }}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      Cancel
                    </button>
                  </div>
                )}

                {/* Tab selector for API key type */}
                <div className="flex gap-1 border-b pb-2">
                  <button
                    onClick={() => setActiveKeyTab("openai")}
                    className={`px-3 py-1.5 text-xs rounded-t transition-colors ${
                      activeKeyTab === "openai"
                        ? "bg-background border border-b-0 font-medium"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    OpenAI Key
                  </button>
                  <button
                    onClick={() => setActiveKeyTab("memori")}
                    className={`px-3 py-1.5 text-xs rounded-t transition-colors ${
                      activeKeyTab === "memori"
                        ? "bg-background border border-b-0 font-medium"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Memori Key
                  </button>
                </div>

                {activeKeyTab === "openai" ? (
                  <>
                    <div className="flex gap-2">
                      <Input
                        ref={apiKeyInputRef}
                        type="password"
                        placeholder="sk-proj-..."
                        value={apiKeyInput}
                        onChange={e => setApiKeyInput(e.target.value)}
                        onKeyDown={handleApiKeyInputKeyDown}
                        disabled={isValidatingKey}
                        className="font-mono text-sm"
                      />
                      <Button
                        size="sm"
                        onClick={saveApiKey}
                        disabled={!apiKeyInput.trim() || isValidatingKey}
                      >
                        {isValidatingKey ? (
                          <motion.span
                            animate={{ opacity: [1, 0.5, 1] }}
                            transition={{ repeat: Infinity, duration: 1 }}
                          >
                            Validating...
                          </motion.span>
                        ) : (
                          "Save"
                        )}
                      </Button>
                    </div>
                    <div className="flex items-start gap-2 text-xs text-muted-foreground">
                      <span className="shrink-0">💡</span>
                      <p>
                        Get your API key from{" "}
                        <a
                          href="https://platform.openai.com/api-keys"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        >
                          platform.openai.com/api-keys
                        </a>
                        . Your key is only used for this session.
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex gap-2">
                      <Input
                        ref={memoriKeyInputRef}
                        type="password"
                        placeholder="Your Memori API key..."
                        value={memoriApiKeyInput}
                        onChange={e => setMemoriApiKeyInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault()
                            saveMemoriApiKey()
                          }
                        }}
                        className="font-mono text-sm"
                      />
                      <Button
                        size="sm"
                        onClick={saveMemoriApiKey}
                        disabled={!memoriApiKeyInput.trim()}
                      >
                        Save
                      </Button>
                    </div>
                    <div className="flex items-start gap-2 text-xs text-muted-foreground">
                      <span className="shrink-0">💡</span>
                      <p>
                        Get your Memori API key by{" "}
                        <a
                          href={MEMORI_SIGNUP_URL}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        >
                          signing up at memorilabs.ai
                        </a>
                        . Enables long-term memory features.
                      </p>
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {!needsApiKey && !showApiKeyInput && !apiKey && (
          <div className="border-t px-3 py-2 bg-muted/50 flex items-center justify-between">
            {isLoadingUsage ? (
              <Skeleton className="h-4 w-32" />
            ) : remainingMessages > 0 ? (
              <p className="text-xs text-muted-foreground">
                {remainingMessages} free message{remainingMessages !== 1 ? 's' : ''}
              </p>
            ) : <span />}
            <button
              onClick={() => setShowApiKeyInput(true)}
              className="text-xs text-primary hover:underline"
            >
              Use your own API key
            </button>
          </div>
        )}

        {(apiKey || memoriApiKey) && (
          <div className="border-t px-3 py-2 bg-green-50 dark:bg-green-950/20 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {apiKey && (
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-500 rounded-full" />
                  <p className="text-xs text-green-600 dark:text-green-400">
                    OpenAI key active
                  </p>
                  <button
                    onClick={removeApiKey}
                    className="text-[10px] text-muted-foreground hover:text-foreground underline"
                  >
                    remove
                  </button>
                </div>
              )}
              {memoriApiKey && (
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-blue-500 rounded-full" />
                  <p className="text-xs text-blue-600 dark:text-blue-400">
                    Memori key active
                  </p>
                  <button
                    onClick={removeMemoriApiKey}
                    className="text-[10px] text-muted-foreground hover:text-foreground underline"
                  >
                    remove
                  </button>
                </div>
              )}
            </div>
            {!apiKey && !needsApiKey && (
              <button
                onClick={() => setShowApiKeyInput(true)}
                className="text-xs text-primary hover:underline"
              >
                Add OpenAI key
              </button>
            )}
          </div>
        )}

        <div className="border-t p-3 flex gap-2 bg-background shrink-0">
          <Textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe a task to plan and execute… (Enter to send)"
            className="resize-none min-h-[40px] text-sm"
            rows={1}
            disabled={needsApiKey && !apiKey}
          />
          {isTyping ? (
            <Button variant="destructive" size="sm" onClick={stop}>
              Stop
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={send}
              disabled={!input.trim() || (needsApiKey && !apiKey)}
            >
              Send
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}