// card.tsx
import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority"; // Keep cva if variants are needed, though neumorphic base is in globals.css
import { cn } from "@/lib/utils";

// Remove cardVariants if all styling is handled by the base .card class in globals.css
// If you still need variants (like destructive), keep it, but ensure the base style is applied.

const Card = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement> // Remove VariantProps if cva is removed
>(({ className, /* variant, */ ...props }, ref) => (
  <div
    ref={ref}
    // Rely on the base .card class from globals.css for neumorphic style
    // Remove cardVariants if not used
    className={cn(
        "card", // Base neumorphic style from globals.css
        className
    )}
    {...props}
  />
));
Card.displayName = "Card";

const CardHeader = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 p-4 md:p-6", className)} // Consistent padding
    {...props}
  />
));
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<
    HTMLParagraphElement,
    React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    // Ensure title uses appropriate foreground color
    className={cn("text-lg md:text-xl font-semibold leading-none tracking-tight text-foreground", className)}
    {...props}
  />
));
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<
    HTMLParagraphElement,
    React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)} // Uses muted color
    {...props}
  />
));
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("p-4 md:p-6 pt-0", className)} // Consistent padding, remove top padding if header exists
    {...props} />
));
CardContent.displayName = "CardContent";

// *** ADDED CardFooter ***
const CardFooter = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    // Added subtle top border, padding, and flex for content alignment
    className={cn("flex items-center p-4 md:p-6 pt-4 border-t border-[hsl(var(--border))]", className)}
    {...props}
  />
));
CardFooter.displayName = "CardFooter";

// Keep custom Separator if used elsewhere, otherwise remove
const Separator = React.forwardRef<
    HTMLHRElement,
    React.HTMLAttributes<HTMLHRElement>
>(({ className, ...props }, ref) => (
  <hr
    ref={ref}
    // Use the subtle border color variable
    className={cn("border-t border-[hsl(var(--border))]", className)}
    {...props} />
));
Separator.displayName = "Separator";


// *** UPDATED Exports to include CardFooter ***
export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, Separator };