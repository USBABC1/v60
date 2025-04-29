// pages/api/health.ts
import type { NextApiRequest, NextApiResponse } from 'next';

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ status: string }>
) {
  // Simplesmente retorna 200 OK se a API estiver rodando
  res.status(200).json({ status: 'ok' });
}
