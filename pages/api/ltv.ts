// pages/api/ltv.ts
import type { NextApiRequest, NextApiResponse } from 'next';
// <<< IMPORTAR CONEXÃO MYSQL E INICIALIZADOR DE TABELA >>>
import { getDbPool, initializeCampaignsTable } from '@/lib/db-mysql';
import mysql from 'mysql2/promise';

// Estrutura esperada pelo frontend
interface LtvInputs { avgTicket: number; purchaseFrequency: number; customerLifespan: number; }
interface LtvData { inputs: LtvInputs; result: number; }

// Valores padrão se dados não encontrados
const DEFAULT_AVG_TICKET = 100;
const DEFAULT_PURCHASE_FREQUENCY = 1.5;
const DEFAULT_CUSTOMER_LIFESPAN = 12;


export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<LtvData | { message: string }>
) {
  if (req.method === 'GET') {
    let dbPool: mysql.Pool | null = null;
    try {
        dbPool = getDbPool();
        if (!dbPool) throw new Error("Falha ao obter pool de conexão MySQL.");

        // Garante que a tabela campaigns exista
        await initializeCampaignsTable();

        const { campaignId } = req.query; // startDate e endDate não são usados aqui
        console.log(`[API /api/ltv] GET Req: campaignId=${campaignId}`);

        let inputs: LtvInputs = {
            avgTicket: DEFAULT_AVG_TICKET,
            purchaseFrequency: DEFAULT_PURCHASE_FREQUENCY,
            customerLifespan: DEFAULT_CUSTOMER_LIFESPAN,
        };

        // Se um ID de campanha foi fornecido e não é 'all' ou 'manual', busca dados reais
        if (campaignId && typeof campaignId === 'string' && campaignId !== 'all' && campaignId !== 'manual') {
            console.log(`[API /api/ltv] Buscando dados da campanha ID: ${campaignId}`);
            const sql = 'SELECT avgTicket, purchaseFrequency, customerLifespan FROM campaigns WHERE id = ?';
            const [rows] = await dbPool.query<mysql.RowDataPacket[]>(sql, [campaignId]);

            if (rows.length > 0) {
                const campaignData = rows[0];
                console.log(`[API /api/ltv] Dados encontrados para campanha ${campaignId}:`, campaignData);
                // Usa os dados do banco OU os defaults se os campos forem NULL no banco
                inputs = {
                    avgTicket: campaignData.avgTicket ?? DEFAULT_AVG_TICKET,
                    purchaseFrequency: campaignData.purchaseFrequency ?? DEFAULT_PURCHASE_FREQUENCY,
                    customerLifespan: campaignData.customerLifespan ?? DEFAULT_CUSTOMER_LIFESPAN,
                };
            } else {
                console.warn(`[API /api/ltv] Campanha ${campaignId} não encontrada no DB. Usando valores padrão.`);
                // Mantém os valores padrão se a campanha não for encontrada
            }
        } else {
             console.log(`[API /api/ltv] Usando valores padrão (sem campaignId ou 'all'/'manual').`);
             // Mantém os valores padrão se nenhum ID específico foi pedido
        }

        // Calcula o LTV com os inputs (reais ou padrão)
        const ltvResult = (inputs.avgTicket || 0) * (inputs.purchaseFrequency || 0) * (inputs.customerLifespan || 0);

        const responseData: LtvData = {
            inputs: { // Garante formatação numérica correta
                avgTicket: parseFloat(Number(inputs.avgTicket).toFixed(2)),
                purchaseFrequency: parseFloat(Number(inputs.purchaseFrequency).toFixed(1)),
                customerLifespan: inputs.customerLifespan,
             },
            result: parseFloat(ltvResult.toFixed(2)),
        };

        res.status(200).json(responseData);

    } catch (error: any) {
      console.error("[API /api/ltv] Erro:", error);
      res.status(500).json({ message: `Erro Interno: ${error.message || 'Erro desconhecido'}` });
    }
    // Não feche o pool
  } else {
    res.setHeader('Allow', ['GET']);
    res.status(405).json({ message: `Método ${req.method} Não Permitido` });
  }
}
