// pages/api/upload.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import formidable, { File, Fields, Files } from 'formidable'; // Import tipos necessários
import path from 'path';
import fs from 'fs/promises';
import crypto from 'crypto';
// Assumindo que você pode precisar disso, senão remova
// import { createCreative } from '@/lib/db';

export const config = {
    api: {
        bodyParser: false, // Desabilita o bodyParser padrão do Next.js
    },
};

// --- Constantes para Limite e Diretório ---
const UPLOAD_LIMIT_MB = 50; // Defina seu limite em Megabytes aqui
const MAX_FILE_SIZE_BYTES = UPLOAD_LIMIT_MB * 1024 * 1024; // Calcula em bytes
// Garante que UPLOAD_DIR aponta para a pasta correta RELATIVA ao PROJETO
// process.cwd() geralmente funciona bem em Next.js
const UPLOAD_DIR = path.join(process.cwd(), 'uploads');
// ---------------------------------------

// Função auxiliar para garantir que o diretório exista
async function ensureUploadDirExists() {
    try {
        await fs.mkdir(UPLOAD_DIR, { recursive: true });
        console.log(`[API Upload] Diretório de upload verificado/criado: ${UPLOAD_DIR}`);
    } catch (error) {
        console.error(`[API Upload] ERRO CRÍTICO ao criar diretório de upload ${UPLOAD_DIR}:`, error);
        // Lançar o erro impede que o handler continue se o diretório não puder ser criado
        throw new Error('Falha ao configurar o diretório de upload.');
    }
}

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
    }

    try {
        // Garante que o diretório exista ANTES de configurar o formidable
        await ensureUploadDirExists();

        const form = formidable({
            uploadDir: UPLOAD_DIR,
            keepExtensions: true,
            maxFileSize: MAX_FILE_SIZE_BYTES, // Usa a constante em bytes
            filter: ({ mimetype }) => {
                // Permite apenas imagens e vídeos (ajuste os tipos conforme necessário)
                const allowed = mimetype?.includes('image') || mimetype?.includes('video') || false;
                console.log(`[API Upload] Filtrando tipo: ${mimetype}, Permitido: ${allowed}`);
                return allowed;
            },
            filename: (name, ext, part, form) => {
                const uniqueSuffix = `${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
                // Limpa o nome original para segurança
                const cleanOriginalName = (part.originalFilename || name || 'file').replace(/[^a-zA-Z0-9_.-]/g, '_');
                // Gera um nome de arquivo único e seguro
                const newFilename = `creative-${uniqueSuffix}${ext}`;
                console.log(`[API Upload] Gerando filename: ${newFilename} (Original: ${part.originalFilename || 'N/A'})`);
                return newFilename;
            }
        });

        // Promisify form.parse
        const parseForm = (): Promise<{ fields: Fields<string>; files: Files<string> }> => {
            return new Promise((resolve, reject) => {
                form.parse(req, (err, fields, files) => {
                    if (err) {
                        console.error('[API Upload] Erro durante o parse do formidable:', err);
                        // Verifica especificamente o erro de tamanho
                        const isSizeError = err.message?.includes('maxFileSize exceeded') || (err as any).code === 1009 /* formidable v3 error code */;
                        if (isSizeError) {
                            // Usa a constante UPLOAD_LIMIT_MB para a mensagem
                            const limitMB = UPLOAD_LIMIT_MB;
                            console.error(`[API Upload] ERRO 413 (Parse): Arquivo excede o limite de ${limitMB}MB.`);
                            // Retorna um erro específico para tamanho, mantendo o status 413
                            const sizeError = new Error(`Arquivo excede o limite de ${limitMB}MB.`);
                            (sizeError as any).statusCode = 413;
                            return reject(sizeError);
                        }
                        // Para outros erros de parse, retorna 500
                         const parseError = new Error(`Erro ao processar upload: ${err.message}`);
                         (parseError as any).statusCode = 500;
                         return reject(parseError);
                    }
                    console.log('[API Upload] Parse concluído. Fields:', fields);
                    console.log('[API Upload] Parse concluído. Files:', files);
                    resolve({ fields, files });
                });
            });
        };

        const { fields, files } = await parseForm();

        // Adaptação para pegar o arquivo. 'file' é o nome do campo esperado no FormData do frontend.
        // Formidable v3 pode retornar um array mesmo para um único arquivo.
        const uploadedFileArray = files.file || files.creativeFile; // Tenta 'file' ou 'creativeFile'
        const uploadedFile = Array.isArray(uploadedFileArray) ? uploadedFileArray[0] : uploadedFileArray;

        if (!uploadedFile) {
            console.error('[API Upload] Nenhum arquivo recebido no campo esperado ("file" ou "creativeFile"). Files recebidos:', files);
            return res.status(400).json({ message: 'Nenhum arquivo válido enviado.' });
        }

         // Verifica se o arquivo realmente foi salvo (formidable pode ter problemas silenciosos)
         try {
            await fs.access(uploadedFile.filepath);
            console.log(`[API Upload] Arquivo confirmado em: ${uploadedFile.filepath}`);
         } catch (accessError) {
             console.error(`[API Upload] ERRO: Arquivo não encontrado em ${uploadedFile.filepath} após parse.`, accessError);
             throw new Error("Falha ao salvar o arquivo no servidor.");
         }


        console.log('[API Upload] Arquivo recebido:', uploadedFile.newFilename);
        console.log('[API Upload] Path final:', uploadedFile.filepath); // filepath é o caminho completo final
        console.log('[API Upload] Mimetype:', uploadedFile.mimetype);
        console.log('[API Upload] Tamanho:', uploadedFile.size);

        // Monta o caminho relativo para salvar no DB e retornar ao frontend
        const relativeFilePath = `/uploads/${uploadedFile.newFilename}`;

        // --- SALVAR NO BANCO DE DADOS (Exemplo, descomente e ajuste se necessário) ---
        /*
        const creativeData = {
            name: (Array.isArray(fields.name) ? fields.name[0] : fields.name) || uploadedFile.originalFilename || `creative-${Date.now()}`,
            type: uploadedFile.mimetype?.startsWith('image') ? 'image' : (uploadedFile.mimetype?.startsWith('video') ? 'video' : 'other'),
            content: relativeFilePath, // Salva o caminho relativo
            originalFilename: uploadedFile.originalFilename || undefined,
            campaign_id: (Array.isArray(fields.campaign_id) ? fields.campaign_id[0] : fields.campaign_id) || null,
            // Adicione outros campos se necessário (status, platform, etc.)
        };

        // *** Verifique se a função createCreative está corretamente importada e implementada ***
        // const dbCreative = await createCreative(creativeData);
        // console.log(`[API Upload] Criativo salvo no DB com ID: ${dbCreative.id}`);
        */
        // -------------------------------------------------------------------------

        return res.status(201).json({
            message: 'Upload bem-sucedido!',
            // Retorna o caminho relativo para ser usado no frontend (ex: <img src={fileUrl} />)
            fileUrl: relativeFilePath,
            // Retorne outros dados se precisar, como o ID do DB
            // creative: dbCreative // Exemplo
            success: true, // Adiciona um campo de sucesso explícito
            filePath: relativeFilePath, // Repete para clareza, usado no creatives.tsx
            originalName: uploadedFile.originalFilename // Pode ser útil no frontend
        });

    } catch (error: any) {
        console.error('[API Upload] Erro GERAL no handler:', error);
        // Usa o statusCode definido no reject da Promise ou default 500
        const statusCode = error.statusCode || 500;
        // Usa a mensagem do erro específico ou uma genérica
        const message = error.message || 'Erro interno do servidor ao fazer upload.';
        return res.status(statusCode).json({ message: message, error: error.message });
    }
};

export default handler;