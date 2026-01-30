"use client"

import { useState, useCallback } from "react"
import Image from "next/image"

import { motion, AnimatePresence } from "framer-motion"
import { AlertsPanel } from "@/components/alerts-panel"
import { Chat } from "@/components/chat"
import { Tasks } from "@/components/tasks"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { api } from "@/lib/api"

const MEMORI_DOCS_URL = "https://memorilabs.ai/docs/"
const MEMORI_REPO_URL = "https://github.com/MemoriLabs/memori-cookbook"
const MEMORI_SITE_URL = "https://memorilabs.ai"

function Navbar() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b bg-background/95 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
        {/* Logo */}
        <a
          href={MEMORI_SITE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 hover:opacity-80 transition-opacity"
        >
          <Image
            src="/logo-light.webp"
            alt="Memori"
            width={100}
            height={32}
            className="rounded"
          />
        </a>

        {/* Nav Links */}
        <div className="flex items-center gap-1 sm:gap-2">
          <a
            href={MEMORI_DOCS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Docs
          </a>
          <a
            href={MEMORI_REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.17 6.839 9.49.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.604-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.167 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
            </svg>
            <span className="hidden sm:inline">GitHub</span>
          </a>
          <a
            href={MEMORI_DOCS_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button size="sm" className="ml-2">
              Get Started
            </Button>
          </a>
        </div>
      </div>
    </nav>
  )
}

function PoweredByMemori() {
  return (
    <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
      <span>Powered by</span>
      <a
        href={MEMORI_SITE_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1.5 hover:text-foreground transition-colors"
      >
        <Image
          src="/logo-light.webp"
          alt="Memori"
          width={18}
          height={18}
          className="rounded"
        />
        <span className="font-medium">Memori</span>
      </a>
      <span className="text-muted-foreground/50">|</span>
      <a
        href={MEMORI_DOCS_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="hover:text-foreground transition-colors underline-offset-2 hover:underline"
      >
        Docs
      </a>
      <a
        href={MEMORI_REPO_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="hover:text-foreground transition-colors underline-offset-2 hover:underline"
      >
        GitHub
      </a>
    </div>
  )
}

export default function Home() {
  const [userId, setUserId] = useState("")
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [inputValue, setInputValue] = useState("")
  const [apiKey, setApiKey] = useState("")
  const [isResetting, setIsResetting] = useState(false)
  const [showResetConfirm, setShowResetConfirm] = useState(false)

  const handleLogin = () => {
    if (inputValue.trim()) {
      setUserId(inputValue.trim().toLowerCase())
      setIsLoggedIn(true)
    }
  }

  const handleApiKeyChange = useCallback((key: string) => {
    setApiKey(key)
  }, [])

  const handleReset = async () => {
    setIsResetting(true)
    try {
      await api(`/sample-data/${userId}`, { method: "DELETE" })
      window.location.reload()
    } catch (error) {
      console.error("Failed to reset data:", error)
    } finally {
      setIsResetting(false)
      setShowResetConfirm(false)
    }
  }

  if (!isLoggedIn) {
    return (
      <>
        <Navbar />
        <main className="min-h-screen flex flex-col items-center justify-center p-4 pt-20">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="w-full max-w-md"
          >
            <Card className="p-6 space-y-6">
              {/* Header with Memori branding */}
              <div className="text-center space-y-3">
                <div className="flex items-center justify-center gap-2">
                  <Image
                    src="/logo-light.webp"
                    alt="Memori"
                    width={48}
                    height={100}
                    className="rounded"
                  />
                </div>
                <div>
                  <h1 className="text-2xl font-bold">Plan & Learn Agent</h1>
                  <p className="text-muted-foreground text-sm mt-1">
                    Self-learning research agent with long-term memory
                  </p>
                </div>
              </div>

              {/* Login Form */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Enter your name or ID</label>
                  <Input
                    placeholder="e.g., john, david, user123"
                    value={inputValue}
                    onChange={e => setInputValue(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleLogin()}
                  />
                  <p className="text-xs text-muted-foreground">
                    This is used to save your learned patterns and conversation history
                  </p>
                </div>

                <Button className="w-full" onClick={handleLogin} disabled={!inputValue.trim()}>
                  Get Started
                </Button>
              </div>

              {/* Features */}
              <div className="border-t pt-4 space-y-3">
                <p className="text-center text-xs text-muted-foreground">
                  Agent Features
                </p>
                <div className="flex flex-wrap gap-2 justify-center">
                  <Badge variant="outline">3 free messages</Badge>
                  <Badge variant="outline">Pattern learning</Badge>
                  <Badge variant="outline">Task planning</Badge>
                  <Badge variant="outline">Long-term memory</Badge>
                </div>
              </div>

              {/* Powered by Memori */}
              <div className="border-t pt-4">
                <PoweredByMemori />
              </div>
            </Card>

            {/* Additional info below card */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="mt-6 text-center"
            >
              <p className="text-xs text-muted-foreground mb-3">
                Built with Memori - The memory fabric for enterprise AI
              </p>
              <div className="flex items-center justify-center gap-4">
                <a
                  href={MEMORI_DOCS_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline"
                >
                  Read the docs
                </a>
                <a
                  href={MEMORI_REPO_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline"
                >
                  View on GitHub
                </a>
              </div>
            </motion.div>
          </motion.div>
        </main>
      </>
    )
  }

  return (
    <main className="h-screen flex flex-col overflow-hidden">
      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="shrink-0 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
      >
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <a
              href={MEMORI_SITE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 hover:opacity-80 transition-opacity"
            >
              <Image
                src="/logo-light.webp"
                alt="Memori"
                width={32}
                height={100}
                className="rounded"
              />
            </a>
            <div>
              <h1 className="text-lg font-bold">Plan & Learn Agent</h1>
              <p className="text-muted-foreground text-xs">Self-learning research agent</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">
              <strong>{userId}</strong>
            </span>
            <AnimatePresence mode="wait">
              {showResetConfirm ? (
                <motion.div
                  key="confirm"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="flex gap-2"
                >
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleReset}
                    disabled={isResetting}
                  >
                    {isResetting ? "..." : "Confirm"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowResetConfirm(false)}
                  >
                    Cancel
                  </Button>
                </motion.div>
              ) : (
                <motion.div
                  key="actions"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="flex gap-2"
                >
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowResetConfirm(true)}
                  >
                    Reset
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setIsLoggedIn(false)
                      setInputValue("")
                      setApiKey("")
                    }}
                  >
                    Switch User
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.header>

      {/* Main content - fills remaining viewport */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full max-w-7xl mx-auto p-4">
          <div className="h-full grid gap-4 lg:grid-cols-[1fr_320px]">
            {/* Chat - main area */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className="h-full overflow-hidden"
            >
              <Chat userId={userId} onApiKeyChange={handleApiKeyChange} />
            </motion.div>

            {/* Right sidebar - Patterns & Tasks */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="h-full flex flex-col gap-4 overflow-hidden"
            >
              {/* Patterns panel - takes ~50% */}
              <div className="flex-1 min-h-0 overflow-hidden">
                <AlertsPanel userId={userId} apiKey={apiKey} />
              </div>

              {/* Tasks panel - takes ~50% */}
              <div className="flex-1 min-h-0 overflow-hidden">
                <Tasks userId={userId} />
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Footer with Powered by Memori */}
      <div className="shrink-0 border-t py-2 bg-muted/30">
        <PoweredByMemori />
      </div>
    </main>
  )
}
