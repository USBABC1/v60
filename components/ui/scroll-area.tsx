import * as React from "react";
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area";
import { cn } from "@/lib/utils";

const ScrollArea = React.forwardRef<
  React.ElementRef<typeof ScrollAreaPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.Root>
>(({ className, children, ...props }, ref) => (
  <ScrollAreaPrimitive.Root
    ref={ref}
    className={cn("relative overflow-hidden", className)}
    {...props}
  >
    <ScrollAreaPrimitive.Viewport className="h-full w-full rounded-[inherit]">
      {children}
    </ScrollAreaPrimitive.Viewport>
    <ScrollAreaPrimitive.Scrollbar
      orientation="vertical"
      className="flex select-none touch-none p-0.5 bg-muted transition-colors duration-150 ease-out hover:bg-muted-dark w-2.5 border-l border-l-transparent"
    >
      <ScrollAreaPrimitive.Thumb className="relative flex-1 bg-muted-foreground rounded-full" />
    </ScrollAreaPrimitive.Scrollbar>
    <ScrollAreaPrimitive.Scrollbar
      orientation="horizontal"
      className="flex select-none touch-none p-0.5 bg-muted transition-colors duration-150 ease-out hover:bg-muted-dark h-2.5 border-t border-t-transparent"
    >
      <ScrollAreaPrimitive.Thumb className="relative flex-1 bg-muted-foreground rounded-full" />
    </ScrollAreaPrimitive.Scrollbar>
    <ScrollAreaPrimitive.Corner />
  </ScrollAreaPrimitive.Root>
));
ScrollArea.displayName = ScrollAreaPrimitive.Root.displayName;

export { ScrollArea };