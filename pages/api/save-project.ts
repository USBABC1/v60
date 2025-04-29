
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '5mb',
    },
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    const folderPath = join(process.cwd(), 'public', 'projects');
    if (!existsSync(folderPath)) {
      mkdirSync(folderPath, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filePath = join(folderPath, `project-${timestamp}.json`);

    const projectJson = JSON.stringify(req.body, null, 2);
    writeFileSync(filePath, projectJson);

    return res.status(200).json({ message: 'Projeto salvo com sucesso.', file: filePath });
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao salvar projeto', detail: error.message });
  }
}
