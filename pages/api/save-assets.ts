
import { IncomingForm } from 'formidable';
import fs from 'fs';
import { join, extname } from 'path';
import { v4 as uuidv4 } from 'uuid';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const uploadDir = join(process.cwd(), 'public', 'uploads');
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

  const form = new IncomingForm({ multiples: true, uploadDir, keepExtensions: true });

  form.parse(req, async (err, fields, files) => {
    if (err) {
      console.error('[UPLOAD ERROR]', err);
      return res.status(500).json({ error: 'Erro no upload' });
    }

    try {
      const output = [];
      const uploaded = Array.isArray(files.files) ? files.files : [files.files];
      for (const file of uploaded) {
        const ext = extname(file.originalFilename || '');
        const filename = uuidv4() + ext;
        const newPath = join(uploadDir, filename);
        fs.renameSync(file.filepath, newPath);
        output.push({ src: `/uploads/${filename}` });
      }
      res.status(200).json(output);
    } catch (err) {
      console.error('[PROCESS ERROR]', err);
      res.status(500).json({ error: 'Erro ao salvar arquivo' });
    }
  });
}
