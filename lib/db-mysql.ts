// lib/db-mysql.ts
import mysql from 'mysql2/promise';

let pool: mysql.Pool | null = null;

export function getDbPool(): mysql.Pool {
  if (!pool) {
    console.log("MySQL: Criando pool de conexão...");
    if (!process.env.DB_HOST || !process.env.DB_USER || !process.env.DB_PASSWORD || !process.env.DB_NAME || !process.env.DB_PORT) {
        console.error("MySQL: ERRO CRÍTICO - Variáveis de ambiente do banco de dados não definidas!");
        throw new Error("Variáveis de ambiente do banco de dados críticas estão ausentes.");
    }
    try {
      pool = mysql.createPool({
        host: process.env.DB_HOST, user: process.env.DB_USER, password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME, port: parseInt(process.env.DB_PORT, 10),
        waitForConnections: true, connectionLimit: 10, queueLimit: 0, connectTimeout: 30000
      });
      console.log("MySQL: Pool de conexão criado com sucesso.");
    } catch (error) { console.error("MySQL: ERRO CRÍTICO AO CRIAR POOL!", error); pool = null; throw error; }
  }
  return pool as mysql.Pool;
}

async function addColumnIfNotExistsMysql(connection: mysql.PoolConnection | mysql.Pool, tableName: string, columnName: string, columnDefinition: string) {
    try {
        const [rows] = await connection.query<mysql.RowDataPacket[]>( `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`, [tableName, columnName] );
        if (rows.length === 0) { await connection.query(`ALTER TABLE ${connection.escapeId(tableName)} ADD COLUMN ${connection.escapeId(columnName)} ${columnDefinition}`); console.log(`MySQL: Coluna ${tableName}.${columnName} adicionada.`); }
    } catch (error: any) { if (error.code !== 'ER_DUP_FIELDNAME') { console.error(`MySQL: Erro col ${tableName}.${columnName}:`, error); } }
}

async function addForeignKeyIfNotExists(connection: mysql.PoolConnection | mysql.Pool, tableName: string, constraintName: string, fkDefinition: string) {
   try {
       const [rows] = await connection.query<mysql.RowDataPacket[]>( `SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND CONSTRAINT_NAME = ?`, [tableName, constraintName] );
       if (rows.length === 0) { await connection.query(`ALTER TABLE ${connection.escapeId(tableName)} ADD CONSTRAINT ${connection.escapeId(constraintName)} ${fkDefinition};`); console.log(`MySQL: FK '${constraintName}' p/ '${tableName}' adicionada.`); }
   } catch (fkError: any) { if (fkError.code !== 'ER_FK_DUP_NAME' && fkError.code !== 'ER_CANNOT_ADD_FOREIGN' && fkError.code !== 'ER_KEY_COLUMN_DOES_NOT_EXITS') { console.error(`MySQL: Erro FK '${constraintName}' em '${tableName}':`, fkError); throw fkError; } else if (fkError.code !== 'ER_FK_DUP_NAME') { console.warn(`MySQL: Aviso FK '${constraintName}' em '${tableName}' (${fkError.code}).`); } }
}

export async function initializeUsersTable() {
    const pool = getDbPool();
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(255) NOT NULL UNIQUE,
                email VARCHAR(255) NOT NULL UNIQUE,
                password VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        // ADICIONADO: Adicionar colunas de confirmação de e-mail
        await addColumnIfNotExistsMysql(pool, 'users', 'confirmation_token', 'VARCHAR(255) UNIQUE NULL');
        await addColumnIfNotExistsMysql(pool, 'users', 'is_confirmed', 'BOOLEAN DEFAULT FALSE');

    } catch (error){ console.error("Erro init users:", error); throw error; }
}

export async function initializeCampaignsTable() {
    const pool = getDbPool(); try { await pool.query(` CREATE TABLE IF NOT EXISTS campaigns ( id VARCHAR(255) PRIMARY KEY, name VARCHAR(255) NOT NULL, client_name VARCHAR(255), product_name VARCHAR(255), objective JSON NULL, target_audience TEXT, budget DECIMAL(15, 2) DEFAULT 0.00, start_date DATE NULL, end_date DATE NULL, status ENUM('active', 'paused', 'completed', 'draft', 'archived') DEFAULT 'draft', cost_traffic DECIMAL(15, 2) DEFAULT 0.00, cost_creative DECIMAL(15, 2) DEFAULT 0.00, cost_operational DECIMAL(15, 2) DEFAULT 0.00, industry VARCHAR(255) NULL, platform JSON NULL, daily_budget DECIMAL(15, 2) NULL, segmentation TEXT, adFormat JSON NULL, duration INT NULL, avgTicket DECIMAL(15, 2) NULL DEFAULT NULL, purchaseFrequency DECIMAL(10, 2) NULL DEFAULT NULL, customerLifespan INT NULL DEFAULT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci; `); await addColumnIfNotExistsMysql(pool, 'campaigns', 'cost_traffic', 'DECIMAL(15, 2) DEFAULT 0.00'); await addColumnIfNotExistsMysql(pool, 'campaigns', 'cost_creative', 'DECIMAL(15, 2) DEFAULT 0.00'); await addColumnIfNotExistsMysql(pool, 'campaigns', 'cost_operational', 'DECIMAL(15, 2) DEFAULT 0.00'); await addColumnIfNotExistsMysql(pool, 'campaigns', 'objective', 'JSON NULL'); await addColumnIfNotExistsMysql(pool, 'campaigns', 'platform', 'JSON NULL'); await addColumnIfNotExistsMysql(pool, 'campaigns', 'adFormat', 'JSON NULL'); await addColumnIfNotExistsMysql(pool, 'campaigns', 'avgTicket', 'DECIMAL(15, 2) NULL DEFAULT NULL'); await addColumnIfNotExistsMysql(pool, 'campaigns', 'purchaseFrequency', 'DECIMAL(10, 2) NULL DEFAULT NULL'); await addColumnIfNotExistsMysql(pool, 'campaigns', 'customerLifespan', 'INT NULL DEFAULT NULL'); } catch (error){ console.error("Erro init campaigns:", error); throw error; }
}

export async function initializeCreativesTable() {
    const pool = getDbPool();
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS creatives (
                id VARCHAR(255) PRIMARY KEY,
                campaign_id VARCHAR(255) NULL,
                name VARCHAR(255),
                type ENUM('image', 'video', 'text', 'carousel', 'other') DEFAULT 'other',
                file_url VARCHAR(1024),
                content TEXT,
                metrics JSON,
                status ENUM('active', 'inactive', 'draft', 'archived') DEFAULT 'draft',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        try {
            await pool.query(`ALTER TABLE copies CHANGE COLUMN name title VARCHAR(255);`);
            console.log("MySQL: Coluna 'name' renomeada para 'title' em 'copies'.");
        } catch (renameError: any) {
            if (renameError.code !== 'ER_BAD_FIELD_ERROR' && renameError.code !== 'ER_DUP_FIELDNAME') {
                console.error("Erro ao renomear coluna name->title:", renameError);
            }
        }
        await addColumnIfNotExistsMysql(pool, 'creatives', 'campaign_id', 'VARCHAR(255) NULL');
        await addForeignKeyIfNotExists(pool, 'creatives', 'fk_creative_campaign', 'FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE SET NULL');
    } catch (error: any) {
        console.error("Erro init creatives:", error);
        throw error;
    }
}

export async function initializeFlowsTable() {
    const pool = getDbPool(); try { await pool.query(` CREATE TABLE IF NOT EXISTS flows ( id VARCHAR(255) PRIMARY KEY, campaign_id VARCHAR(255) NULL, name VARCHAR(255) NOT NULL, description TEXT, flow_data JSON, status ENUM('active', 'inactive', 'draft', 'archived') DEFAULT 'draft', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci; `); await addColumnIfNotExistsMysql(pool, 'flows', 'campaign_id', 'VARCHAR(255) NULL'); await addForeignKeyIfNotExists(pool, 'flows', 'fk_flow_campaign', 'FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE SET NULL'); } catch (error){ console.error("Erro init flows:", error); throw error; }
}

export async function initializeCopiesTable() {
    const pool = getDbPool(); try { await pool.query(` CREATE TABLE IF NOT EXISTS copies ( id VARCHAR(255) PRIMARY KEY, campaign_id VARCHAR(255) NULL, creative_id VARCHAR(255) NULL, title VARCHAR(255) NOT NULL, content TEXT NOT NULL, cta VARCHAR(255) NULL, target_audience TEXT NULL, type ENUM('headline', 'body', 'cta', 'description', 'other') DEFAULT 'other', status ENUM('active', 'inactive', 'draft', 'archived') DEFAULT 'draft', clicks INT DEFAULT 0, impressions INT DEFAULT 0, conversions INT DEFAULT 0, created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci; `); try { await pool.query(`ALTER TABLE copies CHANGE COLUMN name title VARCHAR(255);`); console.log("MySQL: Coluna 'name' renomeada para 'title' em 'copies'."); } catch (renameError: any) { if (renameError.code !== 'ER_BAD_FIELD_ERROR' && renameError.code !== 'ER_DUP_FIELDNAME') console.error("Erro ao renomear coluna name->title:", renameError);} await addColumnIfNotExistsMysql(pool, 'copies', 'title', 'VARCHAR(255) NOT NULL'); await addColumnIfNotExistsMysql(pool, 'copies', 'cta', 'VARCHAR(255) NULL'); await addColumnIfNotExistsMysql(pool, 'copies', 'target_audience', 'TEXT NULL'); await addColumnIfNotExistsMysql(pool, 'copies', 'campaign_id', 'VARCHAR(255) NULL'); await addColumnIfNotExistsMysql(pool, 'copies', 'creative_id', 'VARCHAR(255) NULL'); await addColumnIfNotExistsMysql(pool, 'copies', 'clicks', 'INT DEFAULT 0'); await addColumnIfNotExistsMysql(pool, 'copies', 'impressions', 'INT DEFAULT 0'); await addColumnIfNotExistsMysql(pool, 'copies', 'conversions', 'INT DEFAULT 0'); await addColumnIfNotExistsMysql(pool, 'copies', 'created_date', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP'); await addForeignKeyIfNotExists(pool, 'copies', 'fk_copy_campaign', 'FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE SET NULL'); await addForeignKeyIfNotExists(pool, 'copies', 'fk_copy_creative', 'FOREIGN KEY (creative_id) REFERENCES creatives(id) ON DELETE SET NULL'); } catch (error){ console.error("Erro init copies:", error); throw error; }
}

export async function initializeAlertsTable() {
    const pool = getDbPool(); try { await pool.query(` CREATE TABLE IF NOT EXISTS alerts ( id INT AUTO_INCREMENT PRIMARY KEY, campaign_id VARCHAR(255) NULL, user_id INT NULL, type VARCHAR(100), message TEXT NOT NULL, is_read BOOLEAN DEFAULT FALSE, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci; `); await addColumnIfNotExistsMysql(pool, 'alerts', 'is_read', 'BOOLEAN DEFAULT FALSE'); await addColumnIfNotExistsMysql(pool, 'alerts', 'user_id', 'INT NULL'); await addColumnIfNotExistsMysql(pool, 'alerts', 'campaign_id', 'VARCHAR(255) NULL'); await addForeignKeyIfNotExists(pool, 'alerts', 'fk_alert_user','FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE'); await addForeignKeyIfNotExists(pool, 'alerts', 'fk_alert_campaign','FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE SET NULL'); } catch (error){ console.error("Erro init alerts:", error); throw error; }
}

export async function initializeDailyMetricsTable() {
    const pool = getDbPool(); try { await pool.query(` CREATE TABLE IF NOT EXISTS daily_metrics ( id INT AUTO_INCREMENT PRIMARY KEY, campaign_id VARCHAR(255) NOT NULL, metric_date DATE NOT NULL, clicks INT DEFAULT 0, impressions INT DEFAULT 0, conversions INT DEFAULT 0, cost DECIMAL(15, 2) DEFAULT 0.00, revenue DECIMAL(15, 2) DEFAULT 0.00, leads INT DEFAULT 0, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, UNIQUE KEY unique_metric (campaign_id, metric_date), INDEX idx_metric_date (metric_date) ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci; `); await addColumnIfNotExistsMysql(pool, 'daily_metrics', 'campaign_id', 'VARCHAR(255) NOT NULL'); await addColumnIfNotExistsMysql(pool, 'daily_metrics', 'leads', 'INT DEFAULT 0'); await addForeignKeyIfNotExists(pool, 'daily_metrics', 'fk_daily_metric_campaign', 'FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE'); } catch (error){ console.error("Erro init daily_metrics:", error); throw error; }
}

export async function initializeMcpHistoryTable() {
    const pool = getDbPool(); const tableName = 'mcp_conversation_history'; try { await pool.query(` CREATE TABLE IF NOT EXISTS ${tableName} ( id INT AUTO_INCREMENT PRIMARY KEY, session_id VARCHAR(255) NOT NULL, message_order INT NOT NULL, role ENUM('system', 'user', 'assistant', 'tool', 'function') NOT NULL, content LONGTEXT, tool_call_id VARCHAR(255) NULL, name VARCHAR(255) NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, INDEX idx_session_order (session_id, message_order) ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci; `); } catch (error) { console.error(`Erro init ${tableName}:`, error); throw error; }
}

// ADICIONADO: Tabela para conversas salvas
export async function initializeMcpSavedConversationsTable() {
    const pool = getDbPool();
    const tableName = 'mcp_saved_conversations';
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS ${tableName} (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                session_id VARCHAR(255) NOT NULL UNIQUE, -- Cada sessão salva tem um nome único por usuário
                name VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY unique_user_session (user_id, session_id),
                UNIQUE KEY unique_user_name (user_id, name), -- Nome da conversa deve ser único por usuário
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        console.log(`MySQL: Tabela ${tableName} OK.`);
    } catch (error) {
        console.error(`Erro init ${tableName}:`, error);
        throw error;
    }
}


let tablesInitialized = false;
export async function initializeAllTables() {
    if (tablesInitialized) { return; }
    console.log("MySQL: Iniciando verificação/inicialização de TODAS as tabelas...");
    try {
        await initializeUsersTable();       console.log("MySQL: Tabela Users OK.");
        await initializeCampaignsTable();   console.log("MySQL: Tabela Campaigns OK.");
        await initializeCreativesTable();   console.log("MySQL: Tabela Creatives OK.");
        await initializeFlowsTable();       console.log("MySQL: Tabela Flows OK.");
        await initializeCopiesTable();      console.log("MySQL: Tabela Copies OK.");
        await initializeAlertsTable();      console.log("MySQL: Tabela Alerts OK.");
        await initializeDailyMetricsTable(); console.log("MySQL: Tabela Daily_Metrics OK.");
        await initializeMcpHistoryTable();  console.log("MySQL: Tabela Mcp_History OK.");
        // ADICIONADO: Inicializar tabela de conversas salvas
        await initializeMcpSavedConversationsTable(); console.log("MySQL: Tabela Mcp_Saved_Conversations OK.");

        tablesInitialized = true;
        console.log("MySQL: TODAS as tabelas principais inicializadas/verificadas com sucesso.");
    } catch (error) { console.error("MySQL: ERRO GRAVE init tabelas:", error); tablesInitialized = false; }
}
