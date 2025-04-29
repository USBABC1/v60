// components/ui/multi-select-popover.tsx
import * as React from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    CommandSeparator,
} from "@/components/ui/command";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";

interface Option {
    value: string;
    label: string;
}

// *** CORREÇÃO: Adicionado 'export' aqui ***
export interface MultiSelectPopoverProps {
    options: Option[];
    selectedValues?: string[] | null; // Prop original e preferida
    value?: string[] | null;         // Prop alternativa
    onChange: (selected: string[]) => void;
    placeholder?: string;
    className?: string; // Para PopoverContent
    triggerClassName?: string; // Para o botão Trigger
    id?: string;
    name?: string;
}

export function MultiSelectPopover({
    options,
    selectedValues: incomingSelectedValues,
    value: incomingValue,
    onChange,
    placeholder = "Selecione...",
    className,
    triggerClassName,
    id,
    name,
}: MultiSelectPopoverProps) {
    const [open, setOpen] = React.useState(false);

    const currentSelectedValues = incomingSelectedValues ?? incomingValue ?? [];

    const handleSelect = (value: string) => {
        const newSelectedValues = currentSelectedValues.includes(value)
            ? currentSelectedValues.filter((v) => v !== value)
            : [...currentSelectedValues, value];
        onChange(newSelectedValues);
    };

    const selectedLabels = options
        .filter((option) => currentSelectedValues.includes(option.value))
        .map((option) => option.label);

    const internalId = React.useId();
    const triggerId = id || internalId;
    const listId = `${triggerId}-list`;

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild className="w-full">
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    aria-controls={open ? listId : undefined}
                    id={triggerId}
                    name={name}
                    className={cn(
                        "w-full justify-between h-auto min-h-9 px-3 py-2",
                        "bg-[#141414] text-white",
                        "shadow-[inset_2px_2px_4px_rgba(0,0,0,0.3),inset_-2px_-2px_4px_rgba(255,255,255,0.05)]",
                        "border-none",
                        "focus:ring-2 focus:ring-[#1E90FF] focus:ring-offset-2 focus:ring-offset-[#0e1015]",
                        currentSelectedValues.length === 0 && "text-gray-500",
                        triggerClassName
                    )}
                    style={{ textShadow: `0 0 4px #1E90FF` }}
                    type="button"
                >
                    <div className="flex flex-wrap gap-1 flex-grow mr-2 items-center">
                        {currentSelectedValues.length > 0 ? (
                            selectedLabels.length <= 2 ? (
                                <span className="truncate text-white">{selectedLabels.join(", ")}</span>
                            ) : (
                                <Badge
                                    variant="secondary"
                                    className="bg-[#1E90FF]/20 border border-[#1E90FF]/50 text-white"
                                >
                                    {selectedLabels.length} selecionados
                                </Badge>
                            )
                        ) : (
                            <span className="text-gray-500">{placeholder}</span>
                        )}
                    </div>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent
                id={listId}
                className={cn("w-[--radix-popover-trigger-width] p-0 bg-[#1e2128] border-[#1E90FF]/30 text-white", className)}
                aria-multiselectable="true"
            >
                <Command>
                    <CommandInput
                        aria-label="Filtrar opções"
                        placeholder="Pesquisar..."
                        className="text-white placeholder:text-gray-400 border-b border-[#1E90FF]/30 focus:ring-0 focus:border-[#1E90FF]/50 h-8 text-xs"
                    />
                    <CommandList>
                        <CommandEmpty>Nenhuma opção encontrada.</CommandEmpty>
                        <CommandGroup role="group">
                            {options.map((option) => {
                                const isSelected = currentSelectedValues.includes(option.value);
                                const checkboxId = `ms-checkbox-${triggerId}-${option.value}`;
                                return (
                                    <CommandItem
                                        key={option.value}
                                        value={option.label}
                                        onSelect={() => handleSelect(option.value)}
                                        className="flex items-center justify-between cursor-pointer hover:bg-[#1E90FF]/20 data-[selected=true]:bg-[#1E90FF]/10 py-1.5 px-2 text-sm"
                                        role="option"
                                        aria-selected={isSelected}
                                    >
                                        <div className="flex items-center mr-2 flex-grow">
                                            <Checkbox
                                                id={checkboxId}
                                                checked={isSelected}
                                                aria-labelledby={`${checkboxId}-label`}
                                                onCheckedChange={() => handleSelect(option.value)}
                                                className="mr-2 h-4 w-4 rounded-[3px] border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground flex-shrink-0"
                                                tabIndex={-1}
                                            />
                                            <label
                                                id={`${checkboxId}-label`}
                                                htmlFor={checkboxId}
                                                className="text-xs cursor-pointer truncate"
                                            >
                                                {option.label}
                                            </label>
                                        </div>
                                    </CommandItem>
                                );
                            })}
                        </CommandGroup>
                        {currentSelectedValues.length > 0 && (
                            <>
                                <CommandSeparator className="my-1 border-t border-[#1E90FF]/20" />
                                <CommandGroup>
                                    <CommandItem
                                        onSelect={() => onChange([])}
                                        className="justify-center text-center text-xs text-red-400 hover:bg-red-900/30 cursor-pointer py-1.5 px-2 rounded"
                                    >
                                        Limpar seleção
                                    </CommandItem>
                                </CommandGroup>
                            </>
                        )}
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}
