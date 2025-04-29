// pages/_document.tsx
import { Html, Head, Main, NextScript } from 'next/document'

export default function Document() {
  return (
    <Html lang="pt-BR">
      <Head>
        {/* Remover links CSS do VvvebJs daqui. Eles são carregados pelo editor.html no iframe */}
        {/* Outros links globais podem permanecer */}
      </Head>
      <body>
        <Main /> {/* <== Main renderiza o app Next.js */}
        <NextScript />
      </body>
    </Html>
  )
}