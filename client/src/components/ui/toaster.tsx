import { useState, type MouseEvent } from "react"
import { useToast } from "@/hooks/use-toast"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"
import { ChevronDown, ChevronUp, Copy, Check } from "lucide-react"

function TechnicalDetails({ details }: { details: string }) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleCopy = async (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(details)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  return (
    <div className="mt-2 pt-2 border-t border-current/20">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-1 text-xs opacity-70 hover:opacity-100 transition-opacity"
        data-testid="toggle-technical-details"
      >
        {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        {isExpanded ? "Hide" : "Show"} technical details
      </button>
      {isExpanded && (
        <div className="mt-2 relative">
          <pre className="text-xs bg-black/10 dark:bg-white/10 rounded p-2 overflow-x-auto whitespace-pre-wrap break-all max-h-32 overflow-y-auto font-mono">
            {details}
          </pre>
          <button
            onClick={handleCopy}
            className="absolute top-1 right-1 p-1 rounded bg-black/20 dark:bg-white/20 hover:bg-black/30 dark:hover:bg-white/30 transition-colors"
            title="Copy to clipboard"
            data-testid="copy-technical-details"
          >
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          </button>
        </div>
      )}
    </div>
  )
}

export function Toaster() {
  const { toasts } = useToast()

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, technicalDetails, ...props }) {
        return (
          <Toast key={id} {...props}>
            <div className="grid gap-1 flex-1">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && (
                <ToastDescription>{description}</ToastDescription>
              )}
              {technicalDetails && (
                <TechnicalDetails details={technicalDetails} />
              )}
            </div>
            {action}
            <ToastClose />
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}
