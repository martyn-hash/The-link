import * as React from "react"

import { cn } from "@/lib/utils"

export interface InputProps extends React.ComponentProps<"input"> {
  fieldState?: 'required-empty' | 'required-filled' | 'optional' | 'error'
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, fieldState, ...props }, ref) => {
    const getFieldStateClasses = () => {
      switch (fieldState) {
        case 'required-empty':
          return "border-2 border-required-empty bg-required-empty/5 focus:ring-required-empty focus:border-required-empty"
        case 'required-filled':
          return "border-2 border-required-filled bg-required-filled/5 focus:ring-required-filled focus:border-required-filled"
        case 'optional':
          return "border border-optional bg-optional/10 focus:ring-optional focus:border-optional"
        case 'error':
          return "border-2 border-destructive bg-destructive/5 focus:ring-destructive focus:border-destructive"
        default:
          return "border border-input bg-background focus:ring-ring"
      }
    }
    
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-md px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm transition-all duration-200",
          getFieldStateClasses(),
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
