"use client"

import * as React from "react"
import { CaretSortIcon, CheckIcon, GitHubLogoIcon } from "@radix-ui/react-icons"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
// GARANTIR que NENHUM import de @/components/ui/sidebar está aqui

const versions = [ { label: "Version 2.1", value: "v2.1" }, { label: "Version 1.0", value: "v1.0" } ]

export function VersionSwitcher() {
  const [selectedVersion, setSelectedVersion] = React.useState(versions[0])

  return (
    <div className="px-4 py-2"> {/* Wrapper com padding */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              className="w-full justify-between px-3 h-9 neumorphic-inset" // Estilo inset
            >
              <span className="truncate">{selectedVersion.label}</span>
              <CaretSortIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-[calc(var(--trigger-width))]" style={{ ['--trigger-width' as any]: 'calc(100% - 2rem)' }} align="start"> {/* Ajusta largura */}
              <Command>
                <CommandList>
                   <CommandInput placeholder="Buscar versão..." />
                   <CommandEmpty>Nenhuma versão encontrada.</CommandEmpty>
                   <CommandGroup>
                      {versions.map((version) => (
                        <CommandItem
                            key={version.value} value={version.value}
                            onSelect={(currentValue) => {
                                const newVersion = versions.find(v => v.value === currentValue);
                                if (newVersion) setSelectedVersion(newVersion);
                            }} >
                            {version.label}
                             <CheckIcon className={cn("ml-auto h-4 w-4", selectedVersion.value === version.value ? "opacity-100" : "opacity-0")} />
                        </CommandItem>
                      ))}
                   </CommandGroup>
                </CommandList>
              </Command>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => window.open("https://github.com", "_blank")}>
                 <GitHubLogoIcon className="mr-2 h-4 w-4" />
                 <span>GitHub</span>
              </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
     </div>
  )
}