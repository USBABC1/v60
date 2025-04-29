import { NextApiRequest, NextApiResponse } from 'next';
import { createConnection } from 'mysql2/promise';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required' });
  }

  let connection;
  try {
    connection = await createConnection({
      host: process.env.MYSQLHOST,
      user: process.env.MYSQLUSER,
      password: process.env.MYSQLPASSWORD,
      database: process.env.MYSQL_DATABASE,
      port: parseInt(process.env.MYSQLPORT || '3306', 10),
    });

    const [rows]: any = await connection.execute('SELECT * FROM users WHERE username = ?', [username]);

    if (rows.length === 0) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    const user = rows[0];
    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    const token = jwt.sign({ userId: user.id, username: user.username }, process.env.JWT_SECRET as string, { expiresIn: '1h' });

    res.status(200).json({ token });

  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  } finally {
    if (connection) {
      await connection.end();
    }
  }
};

export default handler;
