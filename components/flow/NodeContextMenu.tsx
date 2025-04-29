// NodeContextMenu.tsx
// C:\Users\ADM\Desktop\v13-main\components\flow\NodeContextMenu.tsx
import React from 'react';
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Trash2 as IconTrash, Copy as IconCopy } from 'lucide-react';
import { NodeContextMenuProps } from '@/types/zap'; // Importar o tipo
import { baseButtonSelectStyle, popoverContentStyle, NEON_COLOR } from './utils'; // Importar estilos e cor

interface Props extends NodeContextMenuProps {
    onClose: () => void;
    onDelete: (id: string) => void;
    onDuplicate: (id: string) => void;
}

const NodeContextMenu: React.FC<Props> = ({ id, top, left, nodeType, onClose, onDelete, onDuplicate }) => {
    const style = { top: `${top}px`, left: `${left}px`, };

    // Ensure the menu closes on click outside or on any menu item click
    const handleMenuItemClick = (action: () => void) => {
        action();
        onClose(); // Close the menu after action
    };

    return (
        <div
            style={style}
            className={cn(popoverContentStyle, "absolute z-50 w-40 rounded-md p-1 shadow-lg")}
            // Add onMouseLeave to close menu if mouse leaves its area (optional, can be finicky)
            // onMouseLeave={onClose}
        >
            <button
                onClick={() => handleMenuItemClick(() => onDuplicate(id))}
                className={cn(baseButtonSelectStyle, "context-menu-button w-full text-left px-2 py-1 text-xs rounded hover:!bg-[${NEON_COLOR}]/30")}
            >
                <IconCopy className="context-menu-icon h-3 w-3 mr-1.5 inline-block align-middle" style={{ filter: `drop-shadow(0 0 2px ${NEON_COLOR}99)` }} /> Duplicar Nó
            </button>
            <button
                onClick={() => handleMenuItemClick(() => onDelete(id))}
                className={cn(baseButtonSelectStyle, "context-menu-button w-full text-left px-2 py-1 text-xs rounded mt-1 !text-red-400 hover:!bg-red-500/30")}
            >
                <IconTrash className="context-menu-icon h-3 w-3 mr-1.5 inline-block align-middle" style={{ filter: `drop-shadow(0 0 2px #ef444499)` }} /> Deletar Nó
            </button>
             {/* Add other context menu items here if needed */}
             {/* Example: */}
             {/* {nodeType === 'textMessage' && (
                 <button
                    onClick={() => handleMenuItemClick(() => alert('Edit text (simulated)'))}
                    className={cn(baseButtonSelectStyle, "context-menu-button w-full text-left px-2 py-1 text-xs rounded mt-1 hover:!bg-[${NEON_COLOR}]/30")}
                 >
                    <Pencil className="context-menu-icon h-3 w-3 mr-1.5 inline-block align-middle" /> Editar Texto
                 </button>
             )} */}
        </div>
    );
};

export default NodeContextMenu;