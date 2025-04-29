// components/ui/badge.tsx
import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority" // Importar cva
import { cn } from "@/lib/utils"

// Definir variantes de estilo para o Badge
const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: // Estilo para 'active'
          "border-transparent bg-primary text-primary-foreground shadow hover:bg-primary/80",
        secondary: // Estilo para 'draft' ou outros
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive: // Estilo opcional para erros/etc
          "border-transparent bg-destructive text-destructive-foreground shadow hover:bg-destructive/80",
        outline: "text-foreground", // Estilo outline padrão
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

// Definir props incluindo variantes
export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {} // Incluir VariantProps

// Atualizar o componente Badge para usar cva
function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }