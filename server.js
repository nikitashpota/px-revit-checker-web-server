import express from 'express';
import mysql from 'mysql2/promise';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// MySQL Connection Pool
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// ==============================================
// API ENDPOINTS
// ==============================================

/**
 * GET /api/directories
 * Получить список всех директорий с статистикой (только последние проверки)
 */
app.get('/api/directories', async (req, res) => {
  try {
    const [directories] = await pool.query(`
      SELECT 
        d.id,
        d.code AS name,
        d.created_at,
        COUNT(DISTINCT m.id) AS total_models,
        COUNT(DISTINCT CASE WHEN latest_acr.error_count > 0 THEN m.id END) AS error_models,
        COALESCE(SUM(latest_acr.error_count), 0) AS total_errors
      FROM Directories d
      LEFT JOIN Models m ON d.id = m.directory_id AND m.model_name != '_Reference'
      LEFT JOIN (
        SELECT 
          acr.model_id,
          acr.error_count
        FROM AxisCheckResults acr
        INNER JOIN (
          SELECT 
            model_id,
            MAX(id) AS latest_check_id
          FROM AxisCheckResults
          GROUP BY model_id
        ) latest ON acr.id = latest.latest_check_id
      ) latest_acr ON m.id = latest_acr.model_id
      GROUP BY d.id, d.code, d.created_at
      ORDER BY d.created_at DESC
    `);

    res.json(directories);
  } catch (error) {
    console.error('Error fetching directories:', error);
    res.status(500).json({ error: 'Failed to fetch directories' });
  }
});

/**
 * GET /api/directories/:id/models
 * Получить модели директории с последними результатами проверки
 */
app.get('/api/directories/:id/models', async (req, res) => {
  try {
    const { id } = req.params;

    const [models] = await pool.query(`
      SELECT 
        m.id,
        m.model_name,
        m.updated_at,
        acr.id AS check_id,
        acr.check_date,
        acr.total_axes_in_model,
        acr.total_reference_axes,
        acr.error_count,
        (acr.total_axes_in_model - acr.error_count) AS success_count
      FROM Models m
      LEFT JOIN (
        SELECT 
          model_id,
          MAX(id) AS latest_check_id
        FROM AxisCheckResults
        GROUP BY model_id
      ) latest ON m.id = latest.model_id
      LEFT JOIN AxisCheckResults acr ON latest.latest_check_id = acr.id
      WHERE m.directory_id = ? AND m.model_name != '_Reference'
      ORDER BY acr.check_date DESC, m.model_name ASC
    `, [id]);

    res.json(models);
  } catch (error) {
    console.error('Error fetching models:', error);
    res.status(500).json({ error: 'Failed to fetch models' });
  }
});

/**
 * GET /api/models/:id/check-report
 * Получить детальный отчет проверки модели (последняя проверка)
 */
app.get('/api/models/:id/check-report', async (req, res) => {
  try {
    const { id } = req.params;

    // Получаем последний отчет проверки
    const [checkResults] = await pool.query(`
      SELECT 
        acr.id,
        acr.check_date,
        acr.check_type,
        acr.total_axes_in_model,
        acr.total_reference_axes,
        acr.error_count,
        m.model_name,
        d.code AS directory_code
      FROM AxisCheckResults acr
      JOIN Models m ON acr.model_id = m.id
      JOIN Directories d ON m.directory_id = d.id
      WHERE acr.model_id = ?
      ORDER BY acr.check_date DESC
      LIMIT 1
    `, [id]);

    if (checkResults.length === 0) {
      return res.status(404).json({ error: 'No check results found for this model' });
    }

    const report = checkResults[0];

    // Получаем детальные ошибки
    const [errors] = await pool.query(`
      SELECT 
        ae.id,
        ae.axis_name,
        ae.element_id,
        ae.error_types,
        ae.deviation_mm,
        ae.is_pinned,
        ae.workset_name
      FROM AxisErrors ae
      WHERE ae.check_result_id = ?
      ORDER BY ae.axis_name
    `, [report.id]);

    // Формируем полный отчет
    const fullReport = {
      ...report,
      success_count: report.total_axes_in_model - report.error_count,
      errors: errors.map(error => ({
        ...error,
        error_types_array: error.error_types.split(';').map(t => t.trim()).filter(Boolean)
      }))
    };

    res.json(fullReport);
  } catch (error) {
    console.error('Error fetching check report:', error);
    res.status(500).json({ error: 'Failed to fetch check report' });
  }
});

/**
 * GET /api/directories/:id/reference-axes
 * Получить эталонные оси директории
 */
app.get('/api/directories/:id/reference-axes', async (req, res) => {
  try {
    const { id } = req.params;

    const [axes] = await pool.query(`
      SELECT 
        a.id,
        a.axis_name,
        a.x1,
        a.y1,
        a.x2,
        a.y2,
        a.created_at
      FROM Axes a
      JOIN Models m ON a.model_id = m.id
      WHERE m.directory_id = ? AND m.model_name = '_Reference'
      ORDER BY a.axis_name
    `, [id]);

    res.json(axes);
  } catch (error) {
    console.error('Error fetching reference axes:', error);
    res.status(500).json({ error: 'Failed to fetch reference axes' });
  }
});

/**
 * GET /api/stats/overall
 * Получить общую статистику (только последние проверки)
 */
app.get('/api/stats/overall', async (req, res) => {
  try {
    const [stats] = await pool.query(`
      SELECT 
        COUNT(DISTINCT d.id) AS total_directories,
        COUNT(DISTINCT m.id) AS total_models,
        COUNT(DISTINCT CASE WHEN latest_acr.error_count > 0 THEN m.id END) AS models_with_errors,
        COALESCE(SUM(latest_acr.error_count), 0) AS total_errors
      FROM Directories d
      LEFT JOIN Models m ON d.id = m.directory_id AND m.model_name != '_Reference'
      LEFT JOIN (
        SELECT 
          acr.model_id,
          acr.error_count
        FROM AxisCheckResults acr
        INNER JOIN (
          SELECT 
            model_id,
            MAX(id) AS latest_check_id
          FROM AxisCheckResults
          GROUP BY model_id
        ) latest ON acr.id = latest.latest_check_id
      ) latest_acr ON m.id = latest_acr.model_id
    `);

    res.json(stats[0]);
  } catch (error) {
    console.error('Error fetching overall stats:', error);
    res.status(500).json({ error: 'Failed to fetch overall stats' });
  }
});

/**
 * GET /api/models/:id/check-history
 * Получить историю проверок модели
 */
app.get('/api/models/:id/check-history', async (req, res) => {
  try {
    const { id } = req.params;
    const { from, to, limit = 20 } = req.query;

    let query = `
      SELECT 
        acr.id,
        acr.check_date,
        acr.check_type,
        acr.total_axes_in_model,
        acr.total_reference_axes,
        acr.error_count,
        (acr.total_axes_in_model - acr.error_count) AS success_count
      FROM AxisCheckResults acr
      WHERE acr.model_id = ?
    `;

    const params = [id];

    if (from) {
      query += ' AND acr.check_date >= ?';
      params.push(from);
    }

    if (to) {
      query += ' AND acr.check_date <= ?';
      params.push(to);
    }

    query += ' ORDER BY acr.check_date DESC LIMIT ?';
    params.push(parseInt(limit));

    const [history] = await pool.query(query, params);
    res.json(history);
  } catch (error) {
    console.error('Error fetching check history:', error);
    res.status(500).json({ error: 'Failed to fetch check history' });
  }
});

/**
 * DELETE /api/check-results/:id
 * Удалить результат проверки (для очистки старых данных)
 */
app.delete('/api/check-results/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Удаляем результат проверки (AxisErrors удалятся автоматически через CASCADE)
    const [result] = await pool.query(`
      DELETE FROM AxisCheckResults WHERE id = ?
    `, [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Check result not found' });
    }

    res.json({ success: true, message: 'Check result deleted' });
  } catch (error) {
    console.error('Error deleting check result:', error);
    res.status(500).json({ error: 'Failed to delete check result' });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
  console.log(`\n🚀 Revit Axis Dashboard API`);
  console.log(`📡 Server running on http://localhost:${PORT}`);
  console.log(`🗄️  Database: ${process.env.DB_NAME}`);
  console.log(`\nAvailable endpoints:`);
  console.log(`  GET    /api/directories`);
  console.log(`  GET    /api/directories/:id/models`);
  console.log(`  GET    /api/models/:id/check-report`);
  console.log(`  GET    /api/models/:id/check-history`);
  console.log(`  GET    /api/directories/:id/reference-axes`);
  console.log(`  GET    /api/stats/overall`);
  console.log(`  DELETE /api/check-results/:id`);
  console.log(`  GET    /api/health\n`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n⏹️  Shutting down gracefully...');
  await pool.end();
  process.exit(0);
});