// components/EditorToolbar.tsx
import React from 'react';
import { Editor } from '@tiptap/react';
import { Bold, Italic, Heading1, Heading2, Pilcrow, List, ListOrdered, Image as ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button'; // Usa seu componente Button

interface EditorToolbarProps {
  editor: Editor | null;
}

// Estilo base para botões da toolbar (neumorfico outset)
const toolbarButtonStyle = cn(
    "button-neumorphic", // Classe base neumorfica de globals.css (ou defina aqui)
    "h-8 w-8 p-0", // Tamanho menor, sem padding interno (ícone centraliza)
    "text-[var(--text-color-muted)] data-[active=true]:text-[var(--primary-color)]" // Cor ícone
);
const toolbarButtonActiveStyle = cn(
    "!shadow-[var(--shadow-pressed)] !scale-[0.97] brightness-95", // Estilo pressionado
    // A cor do ícone ativo já é definida acima
);


const EditorToolbar: React.FC<EditorToolbarProps> = ({ editor }) => {
  if (!editor) {
    return null;
  }

  // Exemplo: Função para adicionar imagem (precisa de lógica de upload/URL)
  const addImage = () => {
    const url = window.prompt('URL da Imagem:');
    if (url) {
      editor.chain().focus().setImage({ src: url }).run();
    }
  };

  return (
    // Container da Toolbar (neumorfico inset)
    <div className={cn(
        "p-2 mb-3 rounded-md flex flex-wrap items-center gap-1",
        "bg-[var(--input-bg-color)] shadow-[var(--shadow-inset)] border border-[var(--border-color)]" // Estilo Inset
    )}>
      <Button
        onClick={() => editor.chain().focus().toggleBold().run()}
        disabled={!editor.can().chain().focus().toggleBold().run()}
        data-active={editor.isActive('bold')}
        className={cn(toolbarButtonStyle, editor.isActive('bold') ? toolbarButtonActiveStyle : '')}
        title="Negrito"
      >
        <Bold className="h-4 w-4" />
      </Button>
      <Button
        onClick={() => editor.chain().focus().toggleItalic().run()}
        disabled={!editor.can().chain().focus().toggleItalic().run()}
        data-active={editor.isActive('italic')}
        className={cn(toolbarButtonStyle, editor.isActive('italic') ? toolbarButtonActiveStyle : '')}
         title="Itálico"
      >
        <Italic className="h-4 w-4" />
      </Button>
      <Button
        onClick={() => editor.chain().focus().setParagraph().run()}
        data-active={editor.isActive('paragraph')}
        className={cn(toolbarButtonStyle, editor.isActive('paragraph') ? toolbarButtonActiveStyle : '')}
         title="Parágrafo"
      >
        <Pilcrow className="h-4 w-4" />
      </Button>
      <Button
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        data-active={editor.isActive('heading', { level: 1 })}
        className={cn(toolbarButtonStyle, editor.isActive('heading', { level: 1 }) ? toolbarButtonActiveStyle : '')}
         title="Título 1"
      >
        <Heading1 className="h-4 w-4" />
      </Button>
       <Button
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        data-active={editor.isActive('heading', { level: 2 })}
        className={cn(toolbarButtonStyle, editor.isActive('heading', { level: 2 }) ? toolbarButtonActiveStyle : '')}
         title="Título 2"
      >
        <Heading2 className="h-4 w-4" />
      </Button>
       <Button
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        data-active={editor.isActive('bulletList')}
        className={cn(toolbarButtonStyle, editor.isActive('bulletList') ? toolbarButtonActiveStyle : '')}
         title="Lista (•)"
      >
        <List className="h-4 w-4" />
      </Button>
       <Button
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        data-active={editor.isActive('orderedList')}
        className={cn(toolbarButtonStyle, editor.isActive('orderedList') ? toolbarButtonActiveStyle : '')}
         title="Lista (1.)"
      >
        <ListOrdered className="h-4 w-4" />
      </Button>
       <Button onClick={addImage} className={toolbarButtonStyle} title="Imagem">
         <ImageIcon className="h-4 w-4" />
       </Button>
      {/* Adicione mais botões conforme necessário (underline, strike, blockquote, code, etc.) */}
    </div>
  );
};

export default EditorToolbar;