// pages/api/login.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
// <<< IMPORTAÇÕES CORRETAS DO BANCO DE DADOS >>>
import { getDbPool, initializeUsersTable } from '@/lib/db-mysql';
import mysql from 'mysql2/promise';

type LoginResponse = {
    token: string;
    message: string;
} | {
    message: string;
    error?: string;
    code?: string; // Para incluir códigos de erro como ETIMEDOUT
}

// Busca a chave secreta do ambiente
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    console.error("\nFATAL ERROR: JWT_SECRET is not defined in environment variables.\n");
    // Em produção, é melhor falhar rápido se o segredo não existe.
    // Em desenvolvimento, você poderia ter um fallback, mas é arriscado.
    process.exit(1); // Impede o servidor de iniciar sem a chave
}

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h'; // Token expira em 1 hora por padrão

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<LoginResponse>
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ message: `Método ${req.method} não permitido` });
  }

  const { username, password } = req.body;

  // Validações básicas
  if (!username || !password) {
    return res.status(400).json({ message: 'Usuário e senha são obrigatórios.' });
  }
   if (typeof username !== 'string' || typeof password !== 'string') {
       return res.status(400).json({ message: 'Tipo inválido para usuário ou senha.' });
   }

  let dbPool: mysql.Pool | null = null;

  try {
    console.log("[API Login] Tentando obter pool MySQL...");
    dbPool = getDbPool(); // Obtém o pool MySQL
    if (!dbPool) {
        // Este erro agora vem de dentro de getDbPool se as vars não existirem
        throw new Error("Falha crítica ao obter pool de conexão MySQL.");
    }
    console.log("[API Login] Pool obtido. Garantindo tabela 'users'...");

    // Garante que a tabela USERS existe
    await initializeUsersTable();
    console.log("[API Login] Tabela 'users' garantida. Buscando usuário...");


    // <<< USA MYSQL PARA BUSCAR USUÁRIO >>>
    const [userRows] = await dbPool.query<mysql.RowDataPacket[]>(
      // Seleciona a coluna password_hash
      'SELECT id, username, password_hash, login_count FROM users WHERE username = ? LIMIT 1',
      [username]
    );

    if (userRows.length === 0) {
      console.warn(`[API Login] Usuário não encontrado: ${username}`);
      // Resposta genérica para segurança
      return res.status(401).json({ message: 'Usuário ou senha inválidos.' });
    }

    const user = userRows[0]; // Pega o usuário encontrado

    // <<< COMPARA SENHA COM password_hash >>>
    console.log(`[API Login] Verificando senha para usuário: ${username}`);
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      console.warn(`[API Login] Senha inválida para usuário: ${username}`);
      return res.status(401).json({ message: 'Usuário ou senha inválidos.' });
    }

    // Senha válida!
    console.log(`[API Login] Senha válida para ${username}. Atualizando info de login (async)...`);

    // <<< USA MYSQL PARA ATUALIZAR INFO DE LOGIN (ASSÍNCRONO) >>>
    // Não esperamos essa query terminar para responder ao usuário
    dbPool.query(
        'UPDATE users SET login_count = login_count + 1, last_login_at = CURRENT_TIMESTAMP WHERE id = ?',
        [user.id]
    ).catch(updateError => {
        // Apenas logamos o erro se a atualização assíncrona falhar
        console.error(`[API Login] Falha assíncrona ao atualizar info de login para user ID ${user.id}:`, updateError);
    });

    // Gera o Token JWT (lógica mantida)
    const payload = {
      userId: user.id,
      username: user.username,
      // Adicione outros dados NÃO SENSÍVEIS se necessário
    };
    console.log(`[API Login] Gerando token JWT para usuário: ${username} (ID: ${user.id}) com expiração em ${JWT_EXPIRES_IN}`);
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    console.log(`[API Login] Usuário '${username}' (ID: ${user.id}) autenticado com sucesso.`);

    // Retorna sucesso com o token
    return res.status(200).json({ token: token, message: 'Login bem-sucedido!' });

  } catch (error: any) {
    console.error('[API Login] Erro:', error);
    // Retorna o código de erro específico (como ETIMEDOUT) se disponível
    return res.status(500).json({
        message: 'Erro interno durante o login.',
        code: error.code, // Inclui o código do erro (ex: ETIMEDOUT)
        error: error.message
    });
  }
  // Não feche o pool
}
