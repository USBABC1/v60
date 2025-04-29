// components/TipTapEditor.tsx
'use client'
import React from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Image from '@tiptap/extension-image';
import EditorToolbar from './EditorToolbar'; // Importa a toolbar
import { cn } from '@/lib/utils';

const TipTapEditor: React.FC = () => {

  // Estilos Neumórficos
  const neonColorHex = '#1E90FF';
  const shadowOutset = `var(--shadow-outset)`;
  const borderColor = `var(--border-color)`;
  const panelBgColor = 'var(--panel-bg-color)'; // ou 'hsl(var(--element-bg-raised))' do globals

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // Configurações do StarterKit (negrito, itálico, heading, parágrafo, etc.)
        heading: { levels: [1, 2, 3] },
        paragraph: {},
        // Adicione outras configurações se necessário
      }),
      Placeholder.configure({
        placeholder: 'Comece a digitar seu conteúdo aqui...',
      }),
      Image.configure({
          inline: false, // Permite imagens como blocos
          allowBase64: true, // Se precisar colar imagens
      }),
    ],
    content: `
      <h2>Bem-vindo ao Editor!</h2>
      <p>Este é um editor de texto rico baseado em blocos.</p>
    `,
    // Adiciona classes ao container do editor para estilização
    editorProps: {
      attributes: {
        class: 'prosemirror-editor-content', // Classe para estilizar conteúdo
      },
    },
  });

  return (
    // Container principal do editor (estilo neumórfico outset)
    <div className={cn(
        "bg-[var(--panel-bg-color)]/90 backdrop-blur-sm",
        "shadow-[var(--shadow-outset)]",
        "rounded-lg border border-[var(--border-color)]",
        "text-[var(--text-color)] flex flex-col overflow-hidden p-3" // Padding interno
    )}>
        <EditorToolbar editor={editor} />
        <div className="editor-scroll-container flex-1 overflow-y-auto rounded bg-[var(--input-bg-color)] shadow-[var(--shadow-inset)] p-2">
            <EditorContent editor={editor} className="h-full" />
        </div>
    </div>
  );
};

export default TipTapEditor;