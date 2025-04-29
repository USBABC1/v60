// pages/api/login.ts (Já corrigido anteriormente)
import type { NextApiRequest, NextApiResponse } from 'next';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { getDbPool, initializeUsersTable } from '@/lib/db-mysql';
import mysql from 'mysql2/promise';

type LoginResponse = { token: string; message: string; } | { message: string; error?: string; code?: string; };

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    console.error("\nFATAL ERROR: JWT_SECRET is not defined.\n");
    process.exit(1);
}
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';

export default async function handler( req: NextApiRequest, res: NextApiResponse<LoginResponse>) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ message: `Método ${req.method} não permitido` });
  }
  const { username, password } = req.body;
  if (!username || !password) { return res.status(400).json({ message: 'Usuário e senha são obrigatórios.' }); }
  if (typeof username !== 'string' || typeof password !== 'string') { return res.status(400).json({ message: 'Tipo inválido para usuário ou senha.' }); }

  let dbPool: mysql.Pool | null = null;
  try {
    console.log("[API Login] Tentando obter pool MySQL...");
    dbPool = getDbPool();
    if (!dbPool) { throw new Error("Falha crítica ao obter pool de conexão MySQL."); }
    console.log("[API Login] Pool obtido. Garantindo tabela 'users'...");
    await initializeUsersTable();
    console.log("[API Login] Tabela 'users' garantida. Buscando usuário...");

    const [userRows] = await dbPool.query<mysql.RowDataPacket[]>(
      'SELECT id, username, password FROM users WHERE username = ? LIMIT 1', // Query usa 'password'
      [username]
    );

    if (userRows.length === 0) {
      console.warn(`[API Login] Usuário não encontrado: ${username}`);
      return res.status(401).json({ message: 'Usuário ou senha inválidos.' });
    }
    const user = userRows[0];

    console.log(`[API Login] Verificando senha para usuário: ${username}`);
    const passwordMatch = await bcrypt.compare(password, user.password); // Compara com 'password'
    if (!passwordMatch) {
      console.warn(`[API Login] Senha inválida para usuário: ${username}`);
      return res.status(401).json({ message: 'Usuário ou senha inválidos.' });
    }

    console.log(`[API Login] Senha válida para ${username}.`);
    // Atualização de login_count comentada
    const payload = { userId: user.id, username: user.username };
    console.log(`[API Login] Gerando token JWT para usuário: ${username} (ID: ${user.id})...`);
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    console.log(`[API Login] Usuário '${username}' autenticado.`);
    return res.status(200).json({ token: token, message: 'Login bem-sucedido!' });
  } catch (error: any) {
    console.error('[API Login] Erro:', error);
    return res.status(500).json({ message: 'Erro interno durante o login.', code: error.code, error: error.message });
  }
}
