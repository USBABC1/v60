// lib/email.ts
import nodemailer from 'nodemailer';

// Configuração de transporte (Exemplo usando Ethereal - para testes)
// Você precisará substituir por sua configuração real (SendGrid, SMTP, etc.)
const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_SERVER_HOST || 'smtp.ethereal.email', // Exemplo Ethereal
    port: parseInt(process.env.EMAIL_SERVER_PORT || '587', 10) || 587, // Exemplo Ethereal
    secure: process.env.EMAIL_SERVER_SECURE === 'true', // true para 465, false para outras portas
    auth: {
        user: process.env.EMAIL_SERVER_USER || 'exemplo@ethereal.email', // Seu usuário
        pass: process.env.EMAIL_SERVER_PASSWORD || 'senhaexemplo', // Sua senha
    },
});

interface SendConfirmationEmailParams {
    to: string;
    username: string;
    token: string;
    confirmationUrl: string;
}

export async function sendConfirmationEmail({ to, username, token, confirmationUrl }: SendConfirmationEmailParams) {
    try {
        const mailOptions = {
            from: process.env.EMAIL_FROM || '"USBMKT" <no-reply@usbmkt.com>', // Remetente
            to: to, // Destinatário
            subject: 'Confirme seu e-mail para o USBMKT', // Assunto
            text: `Olá ${username},\n\nPor favor, confirme seu endereço de e-mail clicando no link abaixo:\n\n${confirmationUrl}?token=${token}\n\nSe você não se registrou no USBMKT, por favor, ignore este e-mail.\n`, // Corpo em texto plano
            html: `<p>Olá ${username},</p><p>Por favor, confirme seu endereço de e-mail clicando no link abaixo:</p><p><a href="${confirmationUrl}?token=${token}">Confirmar E-mail</a></p><p>Se você não se registrou no USBMKT, por favor, ignore este e-mail.</p>`, // Corpo em HTML
        };

        const info = await transporter.sendMail(mailOptions);

        console.log(`[Email] E-mail de confirmação enviado para ${to}. Preview URL: ${nodemailer.getTestMessageUrl(info)}`);
        return true;

    } catch (error) {
        console.error('[Email] Erro ao enviar e-mail de confirmação:', error);
        return false;
    }
}

// Exemplo de uso (não será executado, apenas para referência)
// async function testEmail() {
//     const success = await sendConfirmationEmail({
//         to: 'teste@example.com',
//         username: 'TestUser',
//         token: 'some-fake-token',
//         confirmationUrl: 'http://localhost:3000/confirm-email', // Substituir pela URL real
//     });
//     if (success) {
//         console.log("Teste de envio de e-mail OK.");
//     } else {
//         console.error("Teste de envio de e-mail FALHOU.");
//     }
// }
// testEmail();
