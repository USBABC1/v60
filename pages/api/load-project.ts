
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    const dir = join(process.cwd(), 'public', 'projects');
    const files = readdirSync(dir)
      .filter(name => name.endsWith('.json'))
      .sort()
      .reverse(); // Pega o mais recente

    if (!files.length) {
      return res.status(200).json({});
    }

    const latest = files[0];
    const content = readFileSync(join(dir, latest), 'utf-8');
    return res.status(200).json(JSON.parse(content));
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao carregar projeto', detail: err.message });
  }
}
