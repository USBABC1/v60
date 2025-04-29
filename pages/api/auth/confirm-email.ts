// pages/api/auth/confirm-email.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getDbPool, initializeUsersTable } from '@/lib/db-mysql'; // Importe initializeUsersTable se não for chamado em outro lugar crítico
import mysql from 'mysql2/promise';

export default async function handler( req: NextApiRequest, res: NextApiResponse<{ message: string } | { error: string }> ) {
    if (req.method !== 'GET') { res.setHeader('Allow', ['GET']); return res.status(405).json({ error: 'Method Not Allowed' }); }

    const { token } = req.query;

    if (!token || typeof token !== 'string') { return res.status(400).json({ error: 'Token de confirmação inválido ou ausente.' }); }

    const dbPool = getDbPool();
    if (!dbPool) { console.error("[API ConfirmEmail] Falha pool."); return res.status(500).json({ error: 'Internal server error (DB Pool)' }); }

    try {
        // Garante que a tabela users existe (opcional, se já for chamada em outro lugar)
        await initializeUsersTable();

        // Buscar usuário pelo token e verificar se ainda não foi confirmado
        const [rows] = await dbPool.query<mysql.RowDataPacket[]>(
            'SELECT id FROM users WHERE confirmation_token = ? AND is_confirmed = FALSE LIMIT 1',
            [token]
        );

        if (rows.length === 0) {
            // Token inválido, expirado ou usuário já confirmado
            return res.status(404).json({ error: 'Token inválido ou usuário já confirmado.' });
        }

        const userId = rows[0].id;

        // Atualizar usuário para confirmado e limpar o token
        await dbPool.query(
            'UPDATE users SET is_confirmed = TRUE, confirmation_token = NULL WHERE id = ?',
            [userId]
        );

        console.log(`[API ConfirmEmail] Usuário ${userId} confirmado com sucesso.`);
        res.status(200).json({ message: 'E-mail confirmado com sucesso! Você já pode fazer login.' });

    } catch (error: any) {
        console.error('[API ConfirmEmail] Erro ao confirmar e-mail:', error);
        res.status(500).json({ error: `Erro interno ao processar a confirmação: ${error.message}` });
    }
}