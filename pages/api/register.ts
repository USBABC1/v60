// pages/api/register.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import bcrypt from 'bcrypt';
import { getDbPool, initializeAllTables } from '@/lib/db-mysql'; // Usa initializeAllTables
import mysql from 'mysql2/promise';

const SALT_ROUNDS = 10;

type RegisterResponse = {
    message: string;
    error?: string;
    user?: { id: number | string; username: string; email: string; created_at?: string }; // Adicionado email ao tipo
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<RegisterResponse>
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ message: `Método ${req.method} não permitido` });
  }

  // <<< CORREÇÃO: Recebe 'email' do corpo da requisição >>>
  const { username, email, password } = req.body;

  // Validações
  // <<< CORREÇÃO: Adiciona validação para email >>>
  if (!username || !email || !password) return res.status(400).json({ message: 'Usuário, email e senha são obrigatórios.' });
  if (typeof username !== 'string' || typeof email !== 'string' || typeof password !== 'string') return res.status(400).json({ message: 'Tipo inválido para usuário, email ou senha.' });
  if (!/\S+@\S+\.\S+/.test(email)) return res.status(400).json({ message: 'Formato de email inválido.' }); // Validação simples de email
  if (password.length < 6) return res.status(400).json({ message: 'Senha deve ter pelo menos 6 caracteres.' });
  if (username.length < 3) return res.status(400).json({ message: 'Usuário deve ter pelo menos 3 caracteres.' });
  if (!/^[a-zA-Z0-9_]+$/.test(username)) return res.status(400).json({ message: 'Nome de usuário pode conter apenas letras, números e underscore (_).' });

  let dbPool: mysql.Pool | null = null;

  try {
    dbPool = getDbPool();
    if (!dbPool) throw new Error("Falha ao obter pool de conexão MySQL.");

    await initializeAllTables(); // Garante que todas as tabelas existem

    // Verifica se usuário OU email já existe
    const [existingUserRows] = await dbPool.query<mysql.RowDataPacket[]>(
      'SELECT id FROM users WHERE username = ? OR email = ? LIMIT 1',
      [username, email] // <<< CORREÇÃO: Verifica email também
    );

    if (existingUserRows.length > 0) {
      console.warn(`[API Register] Tentativa de registrar usuário/email já existente: ${username}/${email}`);
      // Mensagem mais genérica ajuda a não revelar qual campo já existe
      return res.status(409).json({ message: 'Nome de usuário ou email já cadastrado.' });
    }

    console.log(`[API Register] Gerando hash para senha do usuário: ${username}`);
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    // <<< CORREÇÃO: Insere 'email' e usa a coluna 'password' para o hash >>>
    const [insertResult] = await dbPool.query<mysql.ResultSetHeader>(
      'INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
      [username, email, passwordHash] // <<< CORREÇÃO: Passa email e usa passwordHash na coluna correta
    );

    const newUserId = insertResult.insertId;
    console.log(`[API Register] Usuário '${username}' (${email}) criado com ID: ${newUserId}`);

    // Buscar dados básicos do usuário recém-criado para retornar
    const [newUserRows] = await dbPool.query<mysql.RowDataPacket[]>(
        'SELECT id, username, email, created_at FROM users WHERE id = ?', // <<< CORREÇÃO: Busca email também
        [newUserId]
    );

    if (newUserRows.length === 0) {
        throw new Error("Não foi possível encontrar o usuário recém-criado.");
    }

    return res.status(201).json({ message: 'Usuário criado com sucesso!', user: newUserRows[0] as any });

  } catch (error: any) {
    console.error('[API Register] Erro:', error);
    const isDuplicateError = error.code === 'ER_DUP_ENTRY';
    const clientMessage = isDuplicateError
      ? 'Nome de usuário ou email já cadastrado.' // Mensagem genérica
      : 'Erro interno ao registrar usuário.';
    return res.status(isDuplicateError ? 409 : 500).json({ message: clientMessage, error: error.message });
  }
}
