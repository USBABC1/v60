"use client"

import * as React from "react"
import { Input } from "@/components/ui/input" // Usar Input padrão
import { Label } from "@/components/ui/label"
// REMOVER Imports problemáticos - CERTIFIQUE-SE QUE ESTÃO REMOVIDOS
// import {
//   SidebarGroup,
//   SidebarGroupContent,
//   SidebarInput,
// } from "@/components/ui/sidebar"
import { SearchIcon } from "lucide-react"
import { cn } from "@/lib/utils"

export function SearchForm() {
  const [search, setSearch] = React.useState("")

  return (
    // Substituir SidebarGroup por um div simples
    <div className="relative">
      {/* Substituir SidebarGroupContent por div */}
      <div className="relative">
        <Label htmlFor="search" className="sr-only">
          Search
        </Label>
        {/* Substituir SidebarInput por Input padrão */}
        <Input
          id="search"
          placeholder="Pesquisar..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="pl-8 h-9 neumorphic-inset" // Estilo inset e ajuste de padding/altura
        />
        <div
          className={cn(
            "absolute left-2.5 top-1/2 -translate-y-1/2 transform transition-opacity",
            search ? "opacity-0" : "opacity-100"
          )}
        >
          <SearchIcon className="size-4 text-muted-foreground" />
        </div>
      </div>
    </div>
  )
}