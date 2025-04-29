// pages/api/file/[...filePath].ts
import type { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';
import mime from 'mime-types';
import crypto from 'crypto'; // Usar crypto para IDs únicos

const CWD = process.cwd();
console.log(`[API File Init] Current Working Directory (CWD): ${CWD}`);

// RESOLVE para o caminho absoluto da pasta 'uploads' na raiz do projeto
const UPLOAD_DIR = path.resolve(CWD, 'uploads');
console.log(`[API File Init] Resolved Upload Directory: ${UPLOAD_DIR}`);

// Verifica se o diretório de upload existe na inicialização
if (!fs.existsSync(UPLOAD_DIR)) {
    console.error(`[API File Init] ERRO CRÍTICO: Diretório de uploads NÃO ENCONTRADO na inicialização: ${UPLOAD_DIR}`);
    // Considerar lançar um erro fatal ou ter uma flag para indicar que a API de servir arquivos não funcionará
} else {
     console.log(`[API File Init] Diretório de uploads ENCONTRADO na inicialização: ${UPLOAD_DIR}`);
}

// Desabilita o bodyParser padrão do Next.js
// Embora não estritamente necessário para GET, é uma boa prática manter se a API puder evoluir
export const config = {
    api: {
        bodyParser: false,
    },
};


export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
    // Gera um ID único para cada requisição para facilitar o rastreamento nos logs
    const reqId = crypto.randomUUID();
    console.log(`\n[API File ${reqId} - ${req.method}] Start - URL: ${req.url}`);

    // Apenas lida com requisições GET para servir arquivos
    if (req.method !== 'GET') {
        res.setHeader('Allow', ['GET']);
        console.warn(`[API File ${reqId}] Method ${req.method} not allowed.`);
        return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
    }

    const { filePath } = req.query;

    // Verifica se o parâmetro de caminho foi fornecido corretamente pela rota dinâmica
    if (!filePath || !Array.isArray(filePath) || filePath.length === 0) {
        console.warn(`[API File ${reqId}] Invalid filePath query:`, filePath);
        return res.status(400).json({ error: 'Caminho do arquivo inválido na URL.' });
    }

    // Filtra e decodifica os segmentos do caminho para segurança.
    // Remove segmentos vazios, tentativas de "subir" diretórios (..) e barras internas.
    const safeSegments = filePath
        .map(segment => decodeURIComponent(segment)) // Decodifica segmentos da URL (ex: %20 para espaço)
        .filter(segment => segment && segment !== '..' && !segment.includes('/') && !segment.includes('\\')); // Remove inválidos

    // Se após a filtragem, não sobrar nenhum segmento válido, retorna erro
    if (safeSegments.length === 0) {
         console.error(`[API File ${reqId}] Invalid path after initial filtering. Original: ${filePath.join('/')}`);
         return res.status(400).json({ error: 'Caminho inválido após filtragem de segurança.' });
    }

    // --- CORREÇÃO AQUI: Processa os segmentos para obter o caminho RELATIVO a UPLOAD_DIR ---
    // Esperamos que a URL seja algo como /api/file/uploads/seu/caminho/arquivo.png
    // O parâmetro filePath será ['uploads', 'seu', 'caminho', 'arquivo.png']
    // O caminho que realmente precisamos dentro de UPLOAD_DIR é 'seu/caminho/arquivo.png'

    let relevantSegments: string[] = [];
    // Verifica se o primeiro segmento é 'uploads' e se há mais segmentos após ele
    if (safeSegments[0] === 'uploads' && safeSegments.length > 1) {
        relevantSegments = safeSegments.slice(1); // Remove 'uploads' do início
    } else if (safeSegments[0] !== 'uploads' && safeSegments.length === 1) {
         // Caso a URL fosse direto /api/file/arquivo.png (não esperado pelo upload, mas seguro)
         relevantSegments = safeSegments;
    } else {
        // Lida com casos inesperados ou apenas '/api/file/uploads'
        console.error(`[API File ${reqId}] Unexpected path structure after filtering: ${safeSegments.join('/')}`);
        return res.status(400).json({ error: 'Estrutura de caminho inesperada.' });
    }

    // Constrói o caminho relativo CORRETO combinando os segmentos relevantes
    const relativePathToServe = path.join(...relevantSegments);

    // Constrói o caminho absoluto combinando UPLOAD_DIR com o caminho relativo correto
    const absolutePath = path.resolve(UPLOAD_DIR, relativePathToServe);

    console.log(`[API File ${reqId}] Relative Path (within uploads): ${relativePathToServe}`);
    console.log(`[API File ${reqId}] Absolute Path to check: ${absolutePath}`); // Este log deve parar de duplicar 'uploads'

    // Security Check Final: Garante que o caminho resolvido ESTÁ DENTRO do diretório de uploads
    // Impede "Path Traversal Attacks" (acesso a arquivos fora da pasta uploads)
    if (!absolutePath.startsWith(UPLOAD_DIR + path.sep) && absolutePath !== UPLOAD_DIR) {
        console.error(`[API File ${reqId}] FORBIDDEN! Path ${absolutePath} is outside ${UPLOAD_DIR}`);
        return res.status(403).json({ error: 'Acesso proibido: Caminho fora do diretório de uploads.' });
    }
    console.log(`[API File ${reqId}] Security check passed.`);

    try {
        // Verifica se o arquivo existe e se o servidor tem permissão de leitura
        await fs.promises.access(absolutePath, fs.constants.R_OK);
        console.log(`[API File ${reqId}] File exists and is readable: ${absolutePath}`);

        // Obtém informações do arquivo (tamanho, se é um arquivo, etc.)
        const stats = await fs.promises.stat(absolutePath);
        if (!stats.isFile()) {
             console.warn(`[API File ${reqId}] Path does not point to a file: ${absolutePath}`);
             return res.status(404).json({ error: 'Recurso não é um arquivo.' });
        }

        // Determina o tipo MIME do arquivo para o header Content-Type
        const mimeType = mime.lookup(absolutePath) || 'application/octet-stream';
        const totalSize = stats.size;
        const rangeHeader = req.headers.range; // Header usado para streaming de vídeo/áudio
        const filename = path.basename(absolutePath); // Apenas o nome do arquivo
        const encodedFilename = encodeURIComponent(filename); // Codifica para uso em headers

        console.log(`[API File ${reqId}] MimeType: ${mimeType}, Size: ${totalSize}`);

        // Define headers comuns para servir arquivos
        res.setHeader('Content-Type', mimeType);
        // Cache: públicos, válidos por uma semana, imutáveis (bom para arquivos estáticos como uploads)
        res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
        res.setHeader('Accept-Ranges', 'bytes'); // Indica suporte a requisições de range (streaming)

        // Define o header Content-Disposition (inline para exibir no navegador, attachment para download)
        if (mimeType.startsWith('image/') || mimeType.startsWith('video/') || mimeType === 'application/pdf' || mimeType.startsWith('text/')) {
             // Tenta exibir no navegador
             res.setHeader('Content-Disposition', `inline; filename="${filename}"; filename*=UTF-8''${encodedFilename}`);
        } else {
             // Oferece para download
             res.setHeader('Content-Disposition', `attachment; filename="${filename}"; filename*=UTF-8''${encodedFilename}`);
        }

        // --- Lógica para lidar com Requisições de Range (Streaming) ---
        // Principalmente útil para vídeos e áudios
        if (rangeHeader && (mimeType.startsWith('video/') || mimeType.startsWith('audio/'))) {
            console.log(`[API File ${reqId}] Handling Range Request: ${rangeHeader}`);
            const rangeMatch = rangeHeader.match(/bytes=(\d+)-(\d+)?/);

            if (!rangeMatch) {
                console.warn(`[API File ${reqId}] Invalid Range format: ${rangeHeader}`);
                res.setHeader('Content-Range', `bytes */${totalSize}`);
                return res.status(416).send('Range Not Satisfiable'); // 416 = Range solicitado inválido
            }

            let start = parseInt(rangeMatch[1], 10);
            let end = rangeMatch[2] ? parseInt(rangeMatch[2], 10) : totalSize - 1; // Se o fim não for especificado, vai até o final

            // Garante que os valores de start e end estejam dentro dos limites do arquivo
            start = Math.max(0, start);
            end = Math.min(end, totalSize - 1);

            // Verifica a validade final dos ranges
            if (isNaN(start) || isNaN(end) || start > end || start >= totalSize ) {
                 console.warn(`[API File ${reqId}] Invalid Range values after clamp: start=${start}, end=${end}, Total Size: ${totalSize}`);
                 res.setHeader('Content-Range', `bytes */${totalSize}`);
                 return res.status(416).send('Range Not Satisfiable');
            }


            const chunksize = (end - start) + 1; // Tamanho do chunk a ser enviado
            console.log(`[API File ${reqId}] Serving Range: bytes ${start}-${end}/${totalSize} (${chunksize} bytes)`);

            // Define headers para resposta de Range (206 Partial Content)
            res.writeHead(206, {
                'Content-Range': `bytes ${start}-${end}/${totalSize}`,
                'Content-Length': chunksize,
                // Outros headers (Content-Type, Cache-Control, etc.) já foram definidos acima
            });

            // Cria um stream de leitura APENAS para o range solicitado do arquivo
            const fileStream = fs.createReadStream(absolutePath, { start, end });
            // Envia o stream diretamente para a resposta HTTP
            fileStream.pipe(res);

            // Lida com erros no stream (importante para evitar que a requisição "trave")
            fileStream.on('error', (streamErr) => {
                console.error(`[API File ${reqId}] Stream Range Error:`, streamErr);
                // Se a resposta ainda não foi finalizada, tenta encerrá-la (pode não funcionar dependendo do erro)
                if (!res.writableEnded) res.end();
            });
            // Loga quando o stream termina de enviar dados
            fileStream.on('end', () => { console.log(`[API File ${reqId}] Stream Range finished.`); });

        } else {
            // --- Lógica para servir o Arquivo Completo ---
            console.log(`[API File ${reqId}] Serving Full File`);
            res.setHeader('Content-Length', totalSize.toString()); // Define o tamanho total do conteúdo
            res.writeHead(200); // Status 200 OK para arquivo completo

            // Cria um stream de leitura para o arquivo completo
            const fileStream = fs.createReadStream(absolutePath);
             // Envia o stream completo diretamente para a resposta HTTP
            fileStream.pipe(res);

             // Lida com erros no stream do arquivo completo
            fileStream.on('error', (streamErr) => {
                console.error(`[API File ${reqId}] Stream Full Error:`, streamErr);
                 if (!res.writableEnded) res.end();
            });
             // Loga quando o stream termina de enviar dados
            fileStream.on('end', () => { console.log(`[API File ${reqId}] Stream Full finished.`); });
        }

    } catch (error: any) {
        // Lida com erros de acesso ao arquivo (mais comuns: não encontrado ou permissão negada)
         if (error.code === 'ENOENT') {
            // Arquivo não encontrado
            console.error(`[API File ${reqId}] ERROR 404: ENOENT. Path checked: ${absolutePath}`);
            res.status(404).json({ error: 'Arquivo não encontrado.', pathChecked: relativePathToServe }); // Retorna o caminho relativo
        } else if (error.code === 'EACCES') {
            // Permissão negada
             console.error(`[API File ${reqId}] ERROR 403: EACCES. Path checked: ${absolutePath}`);
             res.status(403).json({ error: 'Permissão negada para acessar o arquivo.', pathChecked: relativePathToServe }); // Retorna o caminho relativo
        } else {
            // Lida com outros erros inesperados durante o acesso ao arquivo ou streaming
            console.error(`[API File ${reqId}] SERVER ERROR processing ${absolutePath}:`, error);
            // Verifica se a resposta já foi parcialmente enviada antes de tentar enviar um 500
            if (!res.writableEnded) {
                 res.status(500).json({ error: 'Erro interno do servidor ao acessar arquivo.', details: error.message });
            } else {
                 console.log(`[API File ${reqId}] Response already ended, cannot send 500 for unexpected error.`);
            }
        }
    } finally {
         // Este bloco garante que esta mensagem de log sempre aparecerá ao final da requisição
         console.log(`[API File ${reqId}] --- Request End ---`);
    }
}