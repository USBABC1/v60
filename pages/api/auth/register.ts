// pages/api/auth/register.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import bcrypt from 'bcrypt';
import { getDbPool, initializeUsersTable } from '@/lib/db-mysql';
import mysql from 'mysql2/promise';
import { v4 as uuidv4 } from 'uuid'; // Para gerar o token
import { sendConfirmationEmail } from '@/lib/email'; // Importar a função de envio de e-mail

export default async function handler( req: NextApiRequest, res: NextApiResponse<{ message: string } | { error: string }> ) {
    if (req.method !== 'POST') { res.setHeader('Allow', ['POST']); return res.status(405).json({ error: 'Method Not Allowed' }); }

    const { username, email, password } = req.body;

    if (!username || !email || !password) { return res.status(400).json({ error: 'Username, email, and password are required.' }); }

    const dbPool = getDbPool();
    if (!dbPool) { console.error("[API Register] Falha pool."); return res.status(500).json({ error: 'Internal server error (DB Pool)' }); }

    try {
        // Garante que a tabela users existe (opcional, se já for chamada em outro lugar)
        await initializeUsersTable();

        // Verificar se o usuário ou e-mail já existem
        const [existingUsers] = await dbPool.query<mysql.RowDataPacket[]>(
            'SELECT id FROM users WHERE username = ? OR email = ?',
            [username, email]
        );

        if (existingUsers.length > 0) {
            return res.status(409).json({ error: 'Username or email already exists.' });
        }

        // Criptografar a senha
        const hashedPassword = await bcrypt.hash(password, 10);

        // Gerar token de confirmação
        const confirmationToken = uuidv4();

        // Inserir novo usuário no banco de dados (com token e is_confirmed = FALSE)
        const [result] = await dbPool.query<mysql.OkPacket>(
            'INSERT INTO users (username, email, password, confirmation_token, is_confirmed) VALUES (?, ?, ?, ?, FALSE)',
            [username, email, hashedPassword, confirmationToken]
        );

        const userId = result.insertId;

        // --- Enviar E-mail de Confirmação ---
        // A URL de confirmação deve ser a URL base da sua aplicação + o caminho da página de confirmação
        const confirmationUrl = `${process.env.NEXT_PUBLIC_API_URL}/confirm-email`; // Use a variável de ambiente para a URL base

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
             // Mesmo que o e-mail falhe, o usuário é registrado. Eles precisarão solicitar reenvio ou contato.
             res.status(201).json({ message: 'Usuário registrado. Falha ao enviar e-mail de confirmação. Por favor, tente novamente mais tarde ou entre em contato.' });
        }


    } catch (error: any) {
        console.error('[API Register] Erro ao registrar usuário:', error);
        res.status(500).json({ error: `Internal server error: ${error.message}` });
    }
}
