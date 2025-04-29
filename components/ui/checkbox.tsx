// C:\Users\ADM\Desktop\USB MKT PRO V3\components\ui\checkbox.tsx
"use client"

import * as React from "react"
import * as CheckboxPrimitive from "@radix-ui/react-checkbox"
import { Check } from "lucide-react"

import { cn } from "@/lib/utils"

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => {
    const neonColor = '#1E90FF'; // Define neon color
    return (
        <CheckboxPrimitive.Root
            ref={ref}
            className={cn(
                "peer h-4 w-4 shrink-0 rounded-[3px] border border-gray-600", // Base border
                "ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E90FF] focus-visible:ring-offset-2", // Focus ring with neon color
                "disabled:cursor-not-allowed disabled:opacity-50",
                "data-[state=checked]:bg-[#1E90FF]/80 data-[state=checked]:text-white data-[state=checked]:border-[#1E90FF]", // Checked state with neon color
                "transition-all duration-150", // Transition
                // Neumorphic inset effect on unchecked state
                "shadow-[inset_1px_1px_2px_rgba(0,0,0,0.3),inset_-1px_-1px_2px_rgba(255,255,255,0.05)]",
                // Neumorphic pressed effect on checked state
                "data-[state=checked]:shadow-[inset_1px_1px_2px_rgba(0,0,0,0.4),inset_-1px_-1px_2px_rgba(255,255,255,0.1)]",
                className
            )}
            {...props}
        >
            <CheckboxPrimitive.Indicator
                className={cn("flex items-center justify-center text-current")}
            >
                <Check className="h-4 w-4" style={{ filter: `drop-shadow(0 0 3px ${neonColor})` }}/>
            </CheckboxPrimitive.Indicator>
        </CheckboxPrimitive.Root>
    )
})
Checkbox.displayName = CheckboxPrimitive.Root.displayName

export { Checkbox }