// pages/api/auth/register.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import bcrypt from 'bcrypt';
import { getDbPool, initializeUsersTable } from '@/lib/db-mysql';
import { RowDataPacket, OkPacket } from 'mysql2/promise';
import { v4 as uuidv4 } from 'uuid';
import { sendConfirmationEmail } from '@/lib/email';

export default async function handler( req: NextApiRequest, res: NextApiResponse<{ message: string } | { error: string }> ) {
    if (req.method !== 'POST') { res.setHeader('Allow', ['POST']); return res.status(405).json({ error: 'Method Not Allowed' }); }

    const { username, email, password } = req.body;

    if (!username || !email || !password) { return res.status(400).json({ error: 'Username, email, and password are required.' }); }

    const dbPool = getDbPool();
    if (!dbPool) { console.error("[API Register] Falha pool."); return res.status(500).json({ error: 'Internal server error (DB Pool)' }); }

    try {
        await initializeUsersTable();

        const [existingUsers] = await dbPool.query<RowDataPacket[]>(
            'SELECT id FROM users WHERE username = ? OR email = ?',
            [username, email]
        );

        if (existingUsers.length > 0) {
            return res.status(409).json({ error: 'Username or email already exists.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const confirmationToken = uuidv4();

        const [result] = await dbPool.query<OkPacket>(
            'INSERT INTO users (username, email, password, confirmation_token, is_confirmed) VALUES (?, ?, ?, ?, FALSE)',
            [username, email, hashedPassword, confirmationToken]
        );

        const userId = result.insertId;
        const confirmationUrl = `${process.env.NEXT_PUBLIC_API_URL}/confirm-email`;

        const emailSent = await sendConfirmationEmail({
            to: email,
            username: username,
            token: confirmationToken,
            confirmationUrl: confirmationUrl,
        });

        if (emailSent) {
             console.log(`[API Register] Usuário ${userId} registrado. E-mail de confirmação enviado para ${email}.`);
             res.status(201).json({ message: 'Usuário registrado com sucesso! Por favor, confirme seu e-mail.' });
        } else {
             console.warn(`[API Register] Usuário ${userId} registrado, mas falha ao enviar e-mail para ${email}.`);
             res.status(201).json({ message: 'Usuário registrado. Falha ao enviar e-mail de confirmação. Por favor, tente novamente mais tarde ou entre em contato.' });
        }

    } catch (error: any) {
        console.error('[API Register] Erro ao registrar usuário:', error);
        res.status(500).json({ error: `Internal server error: ${error.message}` });
    }
}
