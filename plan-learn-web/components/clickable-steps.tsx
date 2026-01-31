"use client"

import { motion } from "framer-motion"
import { cn } from "@/lib/utils"

interface ClickableStepsProps {
  content: string
  onStepClick: (stepText: string) => void
}

interface StepItem {
  number: number
  text: string
  fullMatch: string
}

// Parse numbered list items from markdown content
function parseSteps(content: string): { steps: StepItem[]; hasSteps: boolean } {
  // Skip if content looks like documentation/how-it-works (has "How I Work" or similar headers)
  const docHeaders = ['how i work', 'how it works', 'what makes me special', 'features', 'try asking me']
  const lowerContent = content.toLowerCase()
  for (const header of docHeaders) {
    if (lowerContent.includes(header)) {
      return { steps: [], hasSteps: false }
    }
  }
  
  // Match patterns like "1. Step text", "2. Another step", etc.
  // Look for actionable plan steps (longer text that describes doing something)
  const stepRegex = /^(\d+)[.\)]\s+(.+?)(?=\n\d+[.\)]|\n*$)/gm
  
  const steps: StepItem[] = []
  let match
  
  while ((match = stepRegex.exec(content)) !== null) {
    const stepText = match[2].trim().replace(/\n+/g, " ")
    // Only include if it looks like a substantial step (not just a label)
    if (stepText.length > 15) {
      steps.push({
        number: parseInt(match[1]),
        text: stepText,
        fullMatch: match[0]
      })
    }
  }
  
  // Also try alternative: look for lines starting with number
  if (steps.length === 0) {
    const lineRegex = /^(\d+)[.\)]\s*(.+)$/gm
    while ((match = lineRegex.exec(content)) !== null) {
      const text = match[2].trim()
      // Only include if it looks like a real step (longer text)
      if (text.length > 15 && text.length < 300) {
        steps.push({
          number: parseInt(match[1]),
          text: text,
          fullMatch: match[0]
        })
      }
    }
  }
  
  return { steps, hasSteps: steps.length >= 2 }
}

export function ClickableSteps({ content, onStepClick }: ClickableStepsProps) {
  const { steps, hasSteps } = parseSteps(content)
  
  if (!hasSteps) return null
  
  return (
    <div className="mt-4 pt-4 border-t border-border/50">
      <p className="text-xs text-muted-foreground mb-2">
        Click a step to start:
      </p>
      <div className="space-y-2">
        {steps.map((step, index) => (
          <motion.button
            key={step.number}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            onClick={() => onStepClick(`Help me with step ${step.number}: ${step.text}`)}
            className={cn(
              "w-full text-left p-3 rounded-lg border transition-all",
              "bg-card hover:bg-accent/50 hover:border-primary/50",
              "group cursor-pointer"
            )}
          >
            <div className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-medium flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                {step.number}
              </span>
              <span className="text-sm text-foreground group-hover:text-foreground/90 line-clamp-2">
                {step.text}
              </span>
            </div>
          </motion.button>
        ))}
      </div>
      
      {/* Quick action buttons */}
      <div className="flex gap-2 mt-3">
        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: steps.length * 0.1 }}
          onClick={() => onStepClick("Start with step 1")}
          className="flex-1 px-3 py-2 text-xs bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
        >
          Start with Step 1
        </motion.button>
        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: steps.length * 0.1 + 0.05 }}
          onClick={() => onStepClick("Tell me more about this plan")}
          className="flex-1 px-3 py-2 text-xs bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/90 transition-colors"
        >
          Explain Plan
        </motion.button>
      </div>
    </div>
  )
}

// Hook to detect if content has clickable steps
export function useHasClickableSteps(content: string): boolean {
  const { hasSteps } = parseSteps(content)
  return hasSteps
}
