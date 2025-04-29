// pages/api/register.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import bcrypt from 'bcrypt';
// <<< USA initializeAllTables do db-mysql >>>
import { getDbPool, initializeAllTables } from '@/lib/db-mysql';
import mysql from 'mysql2/promise';

const SALT_ROUNDS = 10;

type RegisterResponse = {
    message: string;
    error?: string;
    user?: { id: number | string; username: string; created_at?: string };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<RegisterResponse>
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ message: `Método ${req.method} não permitido` });
  }

  const { username, password } = req.body;

  // Validações
  if (!username || !password) return res.status(400).json({ message: 'Usuário e senha são obrigatórios.' });
  if (typeof username !== 'string' || typeof password !== 'string') return res.status(400).json({ message: 'Tipo inválido para usuário ou senha.' });
  if (password.length < 6) return res.status(400).json({ message: 'Senha deve ter pelo menos 6 caracteres.' });
  if (username.length < 3) return res.status(400).json({ message: 'Usuário deve ter pelo menos 3 caracteres.' });
  if (!/^[a-zA-Z0-9_]+$/.test(username)) return res.status(400).json({ message: 'Nome de usuário pode conter apenas letras, números e underscore (_).' });

  let dbPool: mysql.Pool | null = null;

  try {
    dbPool = getDbPool();
    if (!dbPool) throw new Error("Falha ao obter pool de conexão MySQL.");

    // <<< GARANTE TODAS AS TABELAS >>>
    await initializeAllTables();

    // Verifica se usuário já existe
    const [existingUserRows] = await dbPool.query<mysql.RowDataPacket[]>(
      'SELECT id FROM users WHERE username = ? LIMIT 1',
      [username]
    );

    if (existingUserRows.length > 0) {
      console.warn(`[API Register] Tentativa de registrar usuário já existente: ${username}`);
      return res.status(409).json({ message: 'Nome de usuário já existe.' });
    }

    // Cria o hash da senha
    console.log(`[API Register] Gerando hash para senha do usuário: ${username}`);
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    // Cria o usuário no banco de dados
    const [insertResult] = await dbPool.query<mysql.ResultSetHeader>(
      'INSERT INTO users (username, password_hash) VALUES (?, ?)',
      [username, passwordHash]
    );

    const newUserId = insertResult.insertId;
    console.log(`[API Register] Usuário '${username}' criado com ID: ${newUserId}`);

    // Buscar dados básicos do usuário recém-criado para retornar
    const [newUserRows] = await dbPool.query<mysql.RowDataPacket[]>(
        'SELECT id, username, created_at FROM users WHERE id = ?',
        [newUserId]
    );

    if (newUserRows.length === 0) {
        throw new Error("Não foi possível encontrar o usuário recém-criado.");
    }

    // Retorna sucesso
    return res.status(201).json({ message: 'Usuário criado com sucesso!', user: newUserRows[0] as any });

  } catch (error: any) {
    console.error('[API Register] Erro:', error);
    const isDuplicateError = error.code === 'ER_DUP_ENTRY';
    const clientMessage = isDuplicateError
      ? 'Nome de usuário já existe.'
      : 'Erro interno ao registrar usuário.';
    return res.status(isDuplicateError ? 409 : 500).json({ message: clientMessage, error: error.message });
  }
}
