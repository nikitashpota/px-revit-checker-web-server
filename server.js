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
        COUNT(DISTINCT CASE WHEN m.model_name NOT LIKE '%Reference%' THEN m.id END) AS total_models,
        -- Axes stats
        COUNT(DISTINCT CASE WHEN latest_acr.error_count > 0 AND m.model_name NOT LIKE '%Reference%' THEN m.id END) AS axis_error_models,
        COALESCE(SUM(CASE WHEN m.model_name NOT LIKE '%Reference%' THEN latest_acr.error_count ELSE 0 END), 0) AS axis_total_errors,
        -- Levels stats
        COUNT(DISTINCT CASE WHEN latest_lcr.error_count > 0 AND m.model_name NOT LIKE '%Reference%' THEN m.id END) AS level_error_models,
        COALESCE(SUM(CASE WHEN m.model_name NOT LIKE '%Reference%' THEN latest_lcr.error_count ELSE 0 END), 0) AS level_total_errors,
        -- Clashes stats
        COUNT(DISTINCT nf.id) AS navisworks_files_count,
        (SELECT COUNT(*) FROM ClashTests ct2 
         JOIN NavisworksFiles nf2 ON ct2.navisworks_file_id = nf2.id 
         WHERE nf2.directory_id = d.id) AS clash_tests_count,
        (SELECT COALESCE(SUM(ct2.summary_new + ct2.summary_active), 0) FROM ClashTests ct2 
         JOIN NavisworksFiles nf2 ON ct2.navisworks_file_id = nf2.id 
         WHERE nf2.directory_id = d.id) AS clash_active_count
      FROM Directories d
      LEFT JOIN Models m ON d.id = m.directory_id
      LEFT JOIN NavisworksFiles nf ON d.id = nf.directory_id
      LEFT JOIN (
        SELECT acr.model_id, acr.error_count FROM AxisCheckResults acr
        INNER JOIN (SELECT model_id, MAX(id) AS latest_check_id FROM AxisCheckResults GROUP BY model_id) latest ON acr.id = latest.latest_check_id
      ) latest_acr ON m.id = latest_acr.model_id
      LEFT JOIN (
        SELECT lcr.model_id, lcr.error_count FROM LevelCheckResults lcr
        INNER JOIN (SELECT model_id, MAX(id) AS latest_check_id FROM LevelCheckResults GROUP BY model_id) latest ON lcr.id = latest.latest_check_id
      ) latest_lcr ON m.id = latest_lcr.model_id
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
      SELECT m.id, m.model_name, m.updated_at,
        -- Axes data
        acr.id AS axis_check_id, acr.check_date AS axis_check_date, acr.check_type AS axis_check_type,
        acr.total_axes_in_model, acr.total_reference_axes, acr.error_count AS axis_error_count,
        (acr.total_axes_in_model - acr.error_count) AS axis_success_count,
        -- Levels data
        lcr.id AS level_check_id, lcr.check_date AS level_check_date, lcr.check_type AS level_check_type,
        lcr.total_levels_in_model, lcr.total_reference_levels, lcr.error_count AS level_error_count,
        (lcr.total_levels_in_model - lcr.error_count) AS level_success_count
      FROM Models m
      LEFT JOIN (SELECT model_id, MAX(id) AS latest_check_id FROM AxisCheckResults GROUP BY model_id) latest_axis ON m.id = latest_axis.model_id
      LEFT JOIN AxisCheckResults acr ON latest_axis.latest_check_id = acr.id
      LEFT JOIN (SELECT model_id, MAX(id) AS latest_check_id FROM LevelCheckResults GROUP BY model_id) latest_level ON m.id = latest_level.model_id
      LEFT JOIN LevelCheckResults lcr ON latest_level.latest_check_id = lcr.id
      WHERE m.directory_id = ? AND m.model_name NOT LIKE '%Reference%' ORDER BY m.model_name ASC
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
  try {
    const { id } = req.params;
    const [checkResults] = await pool.query(`
      SELECT lcr.id, lcr.check_date, lcr.check_type, lcr.total_levels_in_model, lcr.total_reference_levels, lcr.error_count,
        m.model_name, d.code AS directory_code
      FROM LevelCheckResults lcr
      JOIN Models m ON lcr.model_id = m.id
      JOIN Directories d ON m.directory_id = d.id
      WHERE lcr.model_id = ? ORDER BY lcr.check_date DESC LIMIT 1
    `, [id]);
    if (checkResults.length === 0) return res.json({ has_data: false, message: 'No level check results' });
    const report = checkResults[0];
    const [errors] = await pool.query(`
      SELECT id, level_name, element_id, error_types, deviation_mm, is_pinned, workset_name
      FROM LevelErrors WHERE check_result_id = ? ORDER BY level_name
    `, [report.id]);
    res.json({
      has_data: true, ...report,
      success_count: report.total_levels_in_model - report.error_count,
      errors: errors.map(error => ({ ...error, error_types_array: error.error_types.split(';').map(t => t.trim()).filter(Boolean) }))
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Failed to fetch levels report' });
  }
});

app.get('/api/models/:id/sites-report', async (req, res) => {
  res.json({ has_data: false, message: 'Sites monitoring in development' });
});

// ==================== CLASHES API ====================

// Получить отчет о коллизиях для директории
app.get('/api/directories/:id/clashes-report', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Получаем файлы Navisworks для директории
    const [files] = await pool.query(`
      SELECT nf.id, nf.filename, nf.created_at, nf.updated_at,
        COUNT(ct.id) AS tests_count,
        COALESCE(SUM(ct.summary_total), 0) AS total_clashes,
        COALESCE(SUM(ct.summary_new), 0) AS new_clashes,
        COALESCE(SUM(ct.summary_active), 0) AS active_clashes,
        COALESCE(SUM(ct.summary_reviewed), 0) AS reviewed_clashes,
        COALESCE(SUM(ct.summary_approved), 0) AS approved_clashes,
        COALESCE(SUM(ct.summary_resolved), 0) AS resolved_clashes
      FROM NavisworksFiles nf
      LEFT JOIN ClashTests ct ON nf.id = ct.navisworks_file_id
      WHERE nf.directory_id = ?
      GROUP BY nf.id, nf.filename, nf.created_at, nf.updated_at
      ORDER BY nf.filename
    `, [id]);

    if (files.length === 0) {
      return res.json({ has_data: false, message: 'No Navisworks files found' });
    }

    // Общая статистика
    const totals = files.reduce((acc, f) => ({
      total_clashes: acc.total_clashes + parseInt(f.total_clashes),
      new_clashes: acc.new_clashes + parseInt(f.new_clashes),
      active_clashes: acc.active_clashes + parseInt(f.active_clashes),
      reviewed_clashes: acc.reviewed_clashes + parseInt(f.reviewed_clashes),
      approved_clashes: acc.approved_clashes + parseInt(f.approved_clashes),
      resolved_clashes: acc.resolved_clashes + parseInt(f.resolved_clashes),
      tests_count: acc.tests_count + parseInt(f.tests_count)
    }), { total_clashes: 0, new_clashes: 0, active_clashes: 0, reviewed_clashes: 0, approved_clashes: 0, resolved_clashes: 0, tests_count: 0 });

    res.json({
      has_data: true,
      files_count: files.length,
      ...totals,
      files
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Failed to fetch clashes report' });
  }
});

// Получить тесты коллизий для файла Navisworks
app.get('/api/navisworks-files/:id/clash-tests', async (req, res) => {
  try {
    const { id } = req.params;
    
    const [file] = await pool.query(`
      SELECT nf.*, d.code AS directory_name
      FROM NavisworksFiles nf
      JOIN Directories d ON nf.directory_id = d.id
      WHERE nf.id = ?
    `, [id]);

    if (file.length === 0) {
      return res.status(404).json({ error: 'Navisworks file not found' });
    }

    const [tests] = await pool.query(`
      SELECT id, name, test_type, status, tolerance,
        left_locator, right_locator,
        summary_total, summary_new, summary_active, 
        summary_reviewed, summary_approved, summary_resolved,
        updated_at
      FROM ClashTests
      WHERE navisworks_file_id = ?
      ORDER BY name
    `, [id]);

    res.json({
      file: file[0],
      tests
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Failed to fetch clash tests' });
  }
});

// Получить результаты коллизий для теста
app.get('/api/clash-tests/:id/results', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const [test] = await pool.query(`
      SELECT ct.*, nf.filename, d.code AS directory_name
      FROM ClashTests ct
      JOIN NavisworksFiles nf ON ct.navisworks_file_id = nf.id
      JOIN Directories d ON nf.directory_id = d.id
      WHERE ct.id = ?
    `, [id]);

    if (test.length === 0) {
      return res.status(404).json({ error: 'Clash test not found' });
    }

    // Базовое условие
    let whereClause = 'WHERE clash_test_id = ?';
    const countParams = [id];
    const selectParams = [id];

    if (status) {
      whereClause += ' AND status = ?';
      countParams.push(status);
      selectParams.push(status);
    }

    // Отдельный запрос для подсчёта
    const [countResult] = await pool.query(
      `SELECT COUNT(*) as total FROM ClashResults ${whereClause}`,
      countParams
    );
    const total = countResult[0].total;

    // Запрос данных с пагинацией
    selectParams.push(parseInt(limit), offset);
    const [results] = await pool.query(`
      SELECT id, guid, name, status, distance, description, grid_location,
        point_x, point_y, point_z, created_date,
        item1_id, item1_name, item1_type, item1_layer, item1_source_file,
        item2_id, item2_name, item2_type, item2_layer, item2_source_file
      FROM ClashResults
      ${whereClause}
      ORDER BY created_date DESC
      LIMIT ? OFFSET ?
    `, selectParams);

    res.json({
      test: test[0],
      results,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Failed to fetch clash results' });
  }
});

// Получить историю коллизий для директории (для графика)
app.get('/api/directories/:id/clashes-history', async (req, res) => {
  try {
    const { id } = req.params;
    const { test_ids, days = 30 } = req.query;

    const parsedTestIds = test_ids 
      ? test_ids.split(',').map(id => parseInt(id)).filter(id => !isNaN(id))
      : [];

    // 1. Получаем историю из ClashTestHistory
    let historyQuery = `
      SELECT 
        cth.record_date,
        cth.clash_test_id,
        cth.test_name,
        cth.summary_total,
        cth.summary_new,
        cth.summary_active,
        cth.summary_reviewed,
        cth.summary_approved,
        cth.summary_resolved
      FROM ClashTestHistory cth
      JOIN NavisworksFiles nf ON cth.navisworks_file_id = nf.id
      WHERE nf.directory_id = ?
        AND cth.record_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
    `;
    const historyParams = [id, parseInt(days)];

    if (parsedTestIds.length > 0) {
      historyQuery += ` AND cth.clash_test_id IN (${parsedTestIds.map(() => '?').join(',')})`;
      historyParams.push(...parsedTestIds);
    }

    historyQuery += ` ORDER BY cth.record_date ASC`;

    const [history] = await pool.query(historyQuery, historyParams);

    // 2. Получаем текущие данные из ClashTests
    let currentQuery = `
      SELECT 
        CURDATE() as record_date,
        ct.id as clash_test_id,
        ct.name as test_name,
        ct.summary_total,
        ct.summary_new,
        ct.summary_active,
        ct.summary_reviewed,
        ct.summary_approved,
        ct.summary_resolved
      FROM ClashTests ct
      JOIN NavisworksFiles nf ON ct.navisworks_file_id = nf.id
      WHERE nf.directory_id = ?
    `;
    const currentParams = [id];

    if (parsedTestIds.length > 0) {
      currentQuery += ` AND ct.id IN (${parsedTestIds.map(() => '?').join(',')})`;
      currentParams.push(...parsedTestIds);
    }

    const [current] = await pool.query(currentQuery, currentParams);

    // Группируем по датам
    const dateMap = new Map();
    
    const addToDateMap = (row, dateKey) => {
      if (!dateMap.has(dateKey)) {
        dateMap.set(dateKey, {
          date: dateKey,
          total: 0,
          new: 0,
          active: 0,
          reviewed: 0,
          approved: 0,
          resolved: 0,
          tests: []
        });
      }
      const entry = dateMap.get(dateKey);
      entry.total += row.summary_total || 0;
      entry.new += row.summary_new || 0;
      entry.active += row.summary_active || 0;
      entry.reviewed += row.summary_reviewed || 0;
      entry.approved += row.summary_approved || 0;
      entry.resolved += row.summary_resolved || 0;
      entry.tests.push({
        test_id: row.clash_test_id,
        test_name: row.test_name,
        total: row.summary_total,
        new: row.summary_new,
        active: row.summary_active
      });
    };

    // Добавляем историю
    history.forEach(row => {
      const dateKey = row.record_date.toISOString().split('T')[0];
      addToDateMap(row, dateKey);
    });

    // Добавляем текущие данные (сегодня)
    const today = new Date().toISOString().split('T')[0];
    current.forEach(row => {
      addToDateMap(row, today);
    });

    // Сортируем по дате
    const sortedHistory = Array.from(dateMap.values()).sort((a, b) => 
      new Date(a.date) - new Date(b.date)
    );

    res.json({
      history: sortedHistory,
      raw: [...history, ...current]
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Failed to fetch clashes history' });
  }
});

// Получить список тестов для мультиселекта
app.get('/api/directories/:id/clash-tests-list', async (req, res) => {
  try {
    const { id } = req.params;
    const { sort = 'name', order = 'asc' } = req.query;

    let orderClause;
    switch (sort) {
      case 'total':
        orderClause = `ct.summary_total ${order === 'desc' ? 'DESC' : 'ASC'}`;
        break;
      case 'active':
        orderClause = `(ct.summary_new + ct.summary_active) ${order === 'desc' ? 'DESC' : 'ASC'}`;
        break;
      case 'new':
        orderClause = `ct.summary_new ${order === 'desc' ? 'DESC' : 'ASC'}`;
        break;
      default:
        orderClause = `ct.name ${order === 'desc' ? 'DESC' : 'ASC'}`;
    }

    const [tests] = await pool.query(`
      SELECT 
        ct.id,
        ct.name,
        ct.test_type,
        ct.summary_total,
        ct.summary_new,
        ct.summary_active,
        ct.summary_reviewed,
        ct.summary_approved,
        ct.summary_resolved,
        nf.filename
      FROM ClashTests ct
      JOIN NavisworksFiles nf ON ct.navisworks_file_id = nf.id
      WHERE nf.directory_id = ?
      ORDER BY ${orderClause}
    `, [id]);

    res.json(tests);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Failed to fetch clash tests list' });
  }
});

// Получить изображение коллизии
app.get('/api/clash-results/:id/image', async (req, res) => {
  try {
    const { id } = req.params;
    const [result] = await pool.query(`SELECT image FROM ClashResults WHERE id = ?`, [id]);
    
    if (result.length === 0 || !result[0].image) {
      return res.status(404).json({ error: 'Image not found' });
    }

    res.setHeader('Content-Type', 'image/png');
    res.send(result[0].image);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Failed to fetch image' });
  }
});

// Удалить файл Navisworks (с каскадным удалением тестов и результатов)
app.delete('/api/navisworks-files/:id', checkAdminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const [existing] = await pool.query(`SELECT id, filename FROM NavisworksFiles WHERE id = ?`, [id]);
    if (existing.length === 0) return res.status(404).json({ error: 'File not found' });
    
    await pool.query(`DELETE FROM NavisworksFiles WHERE id = ?`, [id]);
    res.json({ success: true, message: 'File deleted' });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Failed to delete file' });
  }
});

// ==================== END CLASHES API ====================

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

app.get('/api/directories/:id/reference-levels', async (req, res) => {
  try {
    const { id } = req.params;
    const [levels] = await pool.query(`
      SELECT l.id, l.level_name, l.elevation, l.created_at
      FROM Levels l JOIN Models m ON l.model_id = m.id
      WHERE m.directory_id = ? AND m.model_name = '_Reference' ORDER BY l.elevation
    `, [id]);
    res.json(levels);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Failed to fetch reference levels' });
  }
});

app.get('/api/stats/overall', async (req, res) => {
  try {
    const [stats] = await pool.query(`
      SELECT COUNT(DISTINCT d.id) AS total_directories,
        COUNT(DISTINCT CASE WHEN m.model_name NOT LIKE '%Reference%' THEN m.id END) AS total_models,
        -- Axes stats
        COUNT(DISTINCT CASE WHEN latest_acr.error_count > 0 AND m.model_name NOT LIKE '%Reference%' THEN m.id END) AS axis_models_with_errors,
        COALESCE(SUM(CASE WHEN m.model_name NOT LIKE '%Reference%' THEN latest_acr.error_count ELSE 0 END), 0) AS axis_total_errors,
        -- Levels stats
        COUNT(DISTINCT CASE WHEN latest_lcr.error_count > 0 AND m.model_name NOT LIKE '%Reference%' THEN m.id END) AS level_models_with_errors,
        COALESCE(SUM(CASE WHEN m.model_name NOT LIKE '%Reference%' THEN latest_lcr.error_count ELSE 0 END), 0) AS level_total_errors
      FROM Directories d
      LEFT JOIN Models m ON d.id = m.directory_id
      LEFT JOIN (
        SELECT acr.model_id, acr.error_count FROM AxisCheckResults acr
        INNER JOIN (SELECT model_id, MAX(id) AS latest_check_id FROM AxisCheckResults GROUP BY model_id) latest ON acr.id = latest.latest_check_id
      ) latest_acr ON m.id = latest_acr.model_id
      LEFT JOIN (
        SELECT lcr.model_id, lcr.error_count FROM LevelCheckResults lcr
        INNER JOIN (SELECT model_id, MAX(id) AS latest_check_id FROM LevelCheckResults GROUP BY model_id) latest ON lcr.id = latest.latest_check_id
      ) latest_lcr ON m.id = latest_lcr.model_id
    `);

    // Добавляем статистику по коллизиям
    const [clashStats] = await pool.query(`
      SELECT 
        COUNT(DISTINCT nf.id) AS navisworks_files_count,
        COUNT(DISTINCT ct.id) AS clash_tests_count,
        COALESCE(SUM(ct.summary_total), 0) AS clash_total,
        COALESCE(SUM(ct.summary_new + ct.summary_active), 0) AS clash_active
      FROM NavisworksFiles nf
      LEFT JOIN ClashTests ct ON nf.id = ct.navisworks_file_id
    `);

    res.json({ ...stats[0], ...clashStats[0] });
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