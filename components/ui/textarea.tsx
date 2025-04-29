// textarea.tsx
import * as React from "react"
import { cn } from "@/lib/utils"

// Define and EXPORT the props interface
export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

// Define and export the component using the interface
const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        // Use the base 'textarea' class defined in globals.css for neumorphic style
        className={cn(
          "textarea", // This applies the inset neumorphic style
          // Add back some basic structural/sizing classes that might be expected
          "flex min-h-[60px] w-full rounded-md",
          // Font size adjustments
          "text-base md:text-sm",
          // Allow external overrides
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Textarea.displayName = "Textarea"

// Ensure the component itself is exported correctly (named export)
export { Textarea }