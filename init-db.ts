// init-db.ts
import { getDbPool, initializeAllTables } from './lib/db-mysql';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function runDbInitialization() {
  console.log("Executing database initialization script...");
  try {
    // Garante que o pool de conexão está criado
    getDbPool();
    // Inicializa todas as tabelas
    await initializeAllTables();
    console.log("Database initialization script finished successfully.");
    // Opcional: Adicionar um pequeno delay para garantir que as operações de DB sejam concluídas
    console.log("Waiting a few seconds for DB schema changes to apply...");
    await delay(5000); // Espera 5 segundos
    console.log("Delay finished. Proceeding to start application.");
    process.exit(0); // Sai com sucesso
  } catch (error) {
    console.error("Database initialization script failed:", error);
    process.exit(1); // Sai com erro
  }
}

runDbInitialization();
