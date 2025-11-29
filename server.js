import express from 'express';
import mysql from 'mysql2/promise';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

const ADMIN_CREDENTIALS = {
  username: process.env.ADMIN_USERNAME || 'admin',
  password: process.env.ADMIN_PASSWORD || 'getBIM2024!'
};

app.use(cors());
app.use(express.json());

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'dist')));
}

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

const checkAdminAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    return res.status(401).json({ error: 'Authorization required' });
  }
  const base64Credentials = authHeader.split(' ')[1];
  const credentials = Buffer.from(base64Credentials, 'base64').toString('utf8');
  const [username, password] = credentials.split(':');
  if (username === ADMIN_CREDENTIALS.username && password === ADMIN_CREDENTIALS.password) {
    next();
  } else {
    res.status(403).json({ error: 'Invalid credentials' });
  }
};

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (username === ADMIN_CREDENTIALS.username && password === ADMIN_CREDENTIALS.password) {
    res.json({ success: true, message: 'OK', isAdmin: true });
  } else {
    res.status(401).json({ success: false, error: 'Invalid credentials' });
  }
});

app.post('/api/auth/verify', (req, res) => {
  const { username, password } = req.body;
  if (username === ADMIN_CREDENTIALS.username && password === ADMIN_CREDENTIALS.password) {
    res.json({ valid: true, isAdmin: true });
  } else {
    res.json({ valid: false, isAdmin: false });
  }
});

app.get('/api/directories', async (req, res) => {
  try {
    const [directories] = await pool.query(`
      SELECT d.id, d.code AS name, d.created_at,
        COUNT(DISTINCT CASE WHEN m.model_name != '_Reference' THEN m.id END) AS total_models,
        COUNT(DISTINCT CASE WHEN latest_acr.error_count > 0 AND m.model_name != '_Reference' THEN m.id END) AS error_models,
        COALESCE(SUM(CASE WHEN m.model_name != '_Reference' THEN latest_acr.error_count ELSE 0 END), 0) AS total_errors
      FROM Directories d
      LEFT JOIN Models m ON d.id = m.directory_id
      LEFT JOIN (
        SELECT acr.model_id, acr.error_count FROM AxisCheckResults acr
        INNER JOIN (SELECT model_id, MAX(id) AS latest_check_id FROM AxisCheckResults GROUP BY model_id) latest ON acr.id = latest.latest_check_id
      ) latest_acr ON m.id = latest_acr.model_id
      GROUP BY d.id, d.code, d.created_at ORDER BY d.created_at DESC
    `);
    res.json(directories);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Failed to fetch directories' });
  }
});

app.get('/api/directories/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const [directories] = await pool.query(`SELECT d.id, d.code AS name, d.created_at FROM Directories d WHERE d.id = ?`, [id]);
    if (directories.length === 0) return res.status(404).json({ error: 'Directory not found' });
    res.json(directories[0]);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Failed to fetch directory' });
  }
});

app.get('/api/directories/:id/models', async (req, res) => {
  try {
    const { id } = req.params;
    const [models] = await pool.query(`
      SELECT m.id, m.model_name, m.updated_at, acr.id AS check_id, acr.check_date, acr.check_type,
        acr.total_axes_in_model, acr.total_reference_axes, acr.error_count,
        (acr.total_axes_in_model - acr.error_count) AS success_count
      FROM Models m
      LEFT JOIN (SELECT model_id, MAX(id) AS latest_check_id FROM AxisCheckResults GROUP BY model_id) latest ON m.id = latest.model_id
      LEFT JOIN AxisCheckResults acr ON latest.latest_check_id = acr.id
      WHERE m.directory_id = ? AND m.model_name != '_Reference' ORDER BY m.model_name ASC
    `, [id]);
    res.json(models);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Failed to fetch models' });
  }
});

app.get('/api/models/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const [models] = await pool.query(`
      SELECT m.id, m.model_name, m.directory_id, m.updated_at, d.code AS directory_name,
        acr.id AS check_id, acr.check_date, acr.check_type, acr.total_axes_in_model, acr.total_reference_axes, acr.error_count,
        (acr.total_axes_in_model - acr.error_count) AS success_count
      FROM Models m
      JOIN Directories d ON m.directory_id = d.id
      LEFT JOIN (SELECT model_id, MAX(id) AS latest_check_id FROM AxisCheckResults GROUP BY model_id) latest ON m.id = latest.model_id
      LEFT JOIN AxisCheckResults acr ON latest.latest_check_id = acr.id
      WHERE m.id = ?
    `, [id]);
    if (models.length === 0) return res.status(404).json({ error: 'Model not found' });
    res.json(models[0]);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Failed to fetch model' });
  }
});

app.delete('/api/models/:id', checkAdminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const [existing] = await pool.query(`SELECT id, model_name FROM Models WHERE id = ?`, [id]);
    if (existing.length === 0) return res.status(404).json({ error: 'Model not found' });
    await pool.query(`DELETE FROM Models WHERE id = ?`, [id]);
    res.json({ success: true, message: 'Model deleted' });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Failed to delete model' });
  }
});

app.get('/api/models/:id/check-report', async (req, res) => {
  try {
    const { id } = req.params;
    const [checkResults] = await pool.query(`
      SELECT acr.id, acr.check_date, acr.check_type, acr.total_axes_in_model, acr.total_reference_axes, acr.error_count,
        m.model_name, d.code AS directory_code
      FROM AxisCheckResults acr
      JOIN Models m ON acr.model_id = m.id
      JOIN Directories d ON m.directory_id = d.id
      WHERE acr.model_id = ? ORDER BY acr.check_date DESC LIMIT 1
    `, [id]);
    if (checkResults.length === 0) return res.json({ has_data: false, message: 'No check results' });
    const report = checkResults[0];
    const [errors] = await pool.query(`
      SELECT id, axis_name, element_id, error_types, deviation_mm, is_pinned, workset_name
      FROM AxisErrors WHERE check_result_id = ? ORDER BY axis_name
    `, [report.id]);
    res.json({
      has_data: true, ...report,
      success_count: report.total_axes_in_model - report.error_count,
      errors: errors.map(error => ({ ...error, error_types_array: error.error_types.split(';').map(t => t.trim()).filter(Boolean) }))
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Failed to fetch check report' });
  }
});

app.get('/api/models/:id/levels-report', async (req, res) => {
  res.json({ has_data: false, message: 'Levels monitoring in development' });
});

app.get('/api/models/:id/sites-report', async (req, res) => {
  res.json({ has_data: false, message: 'Sites monitoring in development' });
});

app.get('/api/models/:id/clashes-report', async (req, res) => {
  res.json({ has_data: false, message: 'Clashes monitoring in development' });
});

app.get('/api/directories/:id/reference-axes', async (req, res) => {
  try {
    const { id } = req.params;
    const [axes] = await pool.query(`
      SELECT a.id, a.axis_name, a.x1, a.y1, a.x2, a.y2, a.created_at
      FROM Axes a JOIN Models m ON a.model_id = m.id
      WHERE m.directory_id = ? AND m.model_name = '_Reference' ORDER BY a.axis_name
    `, [id]);
    res.json(axes);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Failed to fetch reference axes' });
  }
});

app.get('/api/stats/overall', async (req, res) => {
  try {
    const [stats] = await pool.query(`
      SELECT COUNT(DISTINCT d.id) AS total_directories,
        COUNT(DISTINCT CASE WHEN m.model_name != '_Reference' THEN m.id END) AS total_models,
        COUNT(DISTINCT CASE WHEN latest_acr.error_count > 0 AND m.model_name != '_Reference' THEN m.id END) AS models_with_errors,
        COALESCE(SUM(CASE WHEN m.model_name != '_Reference' THEN latest_acr.error_count ELSE 0 END), 0) AS total_errors
      FROM Directories d
      LEFT JOIN Models m ON d.id = m.directory_id
      LEFT JOIN (
        SELECT acr.model_id, acr.error_count FROM AxisCheckResults acr
        INNER JOIN (SELECT model_id, MAX(id) AS latest_check_id FROM AxisCheckResults GROUP BY model_id) latest ON acr.id = latest.latest_check_id
      ) latest_acr ON m.id = latest_acr.model_id
    `);
    res.json(stats[0]);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

app.get('/api/models/:id/check-history', async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 20 } = req.query;
    const [history] = await pool.query(`
      SELECT id, check_date, check_type, total_axes_in_model, total_reference_axes, error_count,
        (total_axes_in_model - error_count) AS success_count
      FROM AxisCheckResults WHERE model_id = ? ORDER BY check_date DESC LIMIT ?
    `, [id, parseInt(limit)]);
    res.json(history);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

app.delete('/api/check-results/:id', checkAdminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const [result] = await pool.query(`DELETE FROM AxisCheckResults WHERE id = ?`, [id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Failed to delete' });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

process.on('SIGINT', async () => {
  await pool.end();
  process.exit(0);
});
