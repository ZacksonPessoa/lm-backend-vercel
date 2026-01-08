import pkg from 'pg';
const { Pool } = pkg;

// Configuração da conexão com Supabase PostgreSQL
const pool = new Pool({
  host: process.env.DB_HOST || 'db.tuhlfuwflvmvbtxdemim.supabase.co',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'postgres',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  ssl: {
    rejectUnauthorized: false // Necessário para Supabase
  },
  max: 20, // Máximo de conexões no pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Testar conexão
pool.on('connect', () => {
  console.log('✅ Conectado ao banco de dados PostgreSQL');
});

pool.on('error', (err) => {
  console.error('❌ Erro inesperado no pool de conexões:', err);
});

export { pool };

// Função helper para executar queries
export async function query(text, params) {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log('Executada query', { text, duration, rows: res.rowCount });
    return res;
  } catch (error) {
    console.error('Erro na query:', { text, error: error.message });
    throw error;
  }
}

