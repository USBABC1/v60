// tailwind.config.js
/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  // Garanta que todos os diretórios relevantes estão aqui
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
    // Adicione outros diretórios se necessário
    './lib/**/*.{ts,tsx}',
    './entities/**/*.{ts,tsx}',
    './styles/**/*.{ts,tsx}' // Incluir styles pode ajudar em alguns casos
  ],
  prefix: "",
  theme: {
    container: { /* ... */ },
    extend: {
      // Mapeamento de cores usando as variáveis CSS
      colors: {
          border: "hsl(var(--border))",
          input: "hsl(var(--input-border))", // Ou hsl(var(--element-bg-inset))
          ring: "hsl(var(--ring))",
          background: "hsl(var(--background))",
          foreground: "hsl(var(--foreground))",
          primary: { DEFAULT: "hsl(var(--primary))", foreground: "hsl(var(--primary-foreground))" },
          secondary: { DEFAULT: "hsl(var(--element-bg))", foreground: "hsl(var(--element-foreground))" }, // Ajustado para neumorfismo
          destructive: { DEFAULT: "hsl(var(--destructive))", foreground: "hsl(var(--destructive-foreground))" },
          muted: { DEFAULT: "hsl(var(--muted))", foreground: "hsl(var(--muted-foreground))" },
          accent: { DEFAULT: "hsl(var(--accent))", foreground: "hsl(var(--accent-foreground))" },
          popover: { DEFAULT: "hsl(var(--popover-background))", foreground: "hsl(var(--popover-foreground))" },
          card: { DEFAULT: "hsl(var(--element-bg-raised))", foreground: "hsl(var(--element-foreground))" }, // Usando raised bg
          sidebar: { background: "hsl(var(--sidebar-background))", foreground: "hsl(var(--sidebar-foreground))", border: "hsl(var(--sidebar-border))", accent: "hsl(var(--sidebar-accent))", 'accent-foreground': "hsl(var(--sidebar-accent-foreground))", },
          chart: { '1': "hsl(var(--chart-1))", /* ... */ '5': "hsl(var(--chart-5))" },
      },
      borderRadius: { lg: "var(--radius)", md: "calc(var(--radius) - 2px)", sm: "calc(var(--radius) - 4px)" },
      keyframes: { /* ... (manter keyframes do Shadcn) ... */ "accordion-down": { from: { height: '0' }, to: { height: 'var(--radix-accordion-content-height)' } }, "accordion-up": { from: { height: 'var(--radix-accordion-content-height)' }, to: { height: '0' } }, "caret-blink": { "0%,70%,100%": { opacity: "1" }, "20%,50%": { opacity: "0" } } },
      animation: { /* ... (manter animações do Shadcn) ... */ "accordion-down": "accordion-down 0.2s ease-out", "accordion-up": "accordion-up 0.2s ease-out", "caret-blink": "caret-blink 1.25s ease-out infinite" },
      // Mapeamento das sombras neumórficas para utilitários Tailwind
      boxShadow: {
          'neumorphic-outset': 'var(--neumorphic-shadow-outset)',
          'neumorphic-inset': 'var(--neumorphic-shadow-inset)',
          'neumorphic-pressed': 'var(--neumorphic-shadow-pressed)',
       },
       textShadow: { // Utilidade opcional para text-shadow
          'neumorphic': 'var(--neumorphic-text-shadow)',
       }
    },
  },
  plugins: [require("tailwindcss-animate")],
}