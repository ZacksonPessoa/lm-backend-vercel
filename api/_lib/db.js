import pkg from "pg";
const { Pool } = pkg;

// Pool PostgreSQL local (Docker). Em Docker: DATABASE_URL=postgresql://postgres:postgres@postgres:5432/ml_dashboard
// Fora do Docker (host): DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ml_dashboard
const connectionString =
  process.env.DATABASE_URL ||
  `postgresql://${process.env.DB_USER || "postgres"}:${process.env.DB_PASSWORD || "postgres"}@${
    process.env.DB_HOST || "localhost"
  }:${process.env.DB_PORT || "5432"}/${process.env.DB_NAME || "ml_dashboard"}`;

const pool = new Pool({
  connectionString,
  // SSL desligado por padrão para Postgres local. Para hosts gerenciados, defina DB_SSL=1.
  ssl: process.env.DB_SSL === "1" ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on("connect", () => {
  console.log("✅ Conectado ao PostgreSQL local");
});

pool.on("error", (err) => {
  console.error("❌ Erro inesperado no pool PostgreSQL:", err);
});

export { pool };

export async function query(text, params) {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log("Executada query", { text, duration, rows: res.rowCount });
    return res;
  } catch (error) {
    console.error("Erro na query:", { text, error: error.message });
    throw error;
  }
}
