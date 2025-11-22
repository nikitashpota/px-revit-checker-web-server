-- ===================================================
-- Тестовые данные для Revit Axis Dashboard
-- ===================================================
-- Этот скрипт создает примерные данные для тестирования дашборда
-- Выполните его в MySQL после инициализации БД через C# приложение

USE getBIMChecker_db;

-- Очистка существующих данных (если нужно)
-- DELETE FROM AxisErrors;
-- DELETE FROM AxisCheckResults;
-- DELETE FROM Axes;
-- DELETE FROM Models;
-- DELETE FROM Directories;

-- ===================================================
-- 1. Создание директорий (проектов)
-- ===================================================

INSERT INTO Directories (code, created_at) VALUES
('Сертолово', '2024-01-10 10:00:00'),
('Химки_К1', '2024-01-15 14:30:00'),
('Москва_Сити', '2024-02-01 09:00:00');

-- ===================================================
-- 2. Создание эталонных моделей для каждой директории
-- ===================================================

-- Эталонная модель для Сертолово
INSERT INTO Models (directory_id, model_name, updated_at) VALUES
(1, '_Reference', NOW());

-- Эталонная модель для Химки_К1
INSERT INTO Models (directory_id, model_name, updated_at) VALUES
(2, '_Reference', NOW());

-- Эталонная модель для Москва_Сити
INSERT INTO Models (directory_id, model_name, updated_at) VALUES
(3, '_Reference', NOW());

-- ===================================================
-- 3. Создание эталонных осей
-- ===================================================

-- Эталонные оси для Сертолово (model_id = 1)
INSERT INTO Axes (model_id, axis_name, x1, y1, x2, y2) VALUES
(1, 'А', 0, 0, 0, 12000),
(1, 'Б', 6000, 0, 6000, 12000),
(1, 'В', 12000, 0, 12000, 12000),
(1, 'Г', 18000, 0, 18000, 12000),
(1, '1', 0, 0, 18000, 0),
(1, '2', 0, 6000, 18000, 6000),
(1, '3', 0, 12000, 18000, 12000);

-- Эталонные оси для Химки_К1 (model_id = 2)
INSERT INTO Axes (model_id, axis_name, x1, y1, x2, y2) VALUES
(2, 'А', 0, 0, 0, 15000),
(2, 'Б', 7000, 0, 7000, 15000),
(2, 'В', 14000, 0, 14000, 15000),
(2, '1', 0, 0, 14000, 0),
(2, '2', 0, 7500, 14000, 7500),
(2, '3', 0, 15000, 14000, 15000);

-- ===================================================
-- 4. Создание рабочих моделей
-- ===================================================

-- Модели для Сертолово
INSERT INTO Models (directory_id, model_name, updated_at) VALUES
(1, 'AR_Building_A.rvt', NOW()),
(1, 'AR_Building_B.rvt', NOW()),
(1, 'KR_Building_A.rvt', NOW());

-- Модели для Химки_К1
INSERT INTO Models (directory_id, model_name, updated_at) VALUES
(2, 'AR_Tower_1.rvt', NOW()),
(2, 'AR_Tower_2.rvt', NOW());

-- Модели для Москва_Сити
INSERT INTO Models (directory_id, model_name, updated_at) VALUES
(3, 'AR_Tower_Moscow.rvt', NOW());

-- ===================================================
-- 5. Создание результатов проверки
-- ===================================================

-- Проверка AR_Building_A.rvt (model_id = 4) - ЕСТЬ ОШИБКИ
INSERT INTO AxisCheckResults (model_id, check_date, check_type, total_axes_in_model, total_reference_axes, error_count) VALUES
(4, '2024-03-15 10:30:00', 'manual', 7, 7, 3);

-- Проверка AR_Building_B.rvt (model_id = 5) - БЕЗ ОШИБОК
INSERT INTO AxisCheckResults (model_id, check_date, check_type, total_axes_in_model, total_reference_axes, error_count) VALUES
(5, '2024-03-16 11:00:00', 'manual', 7, 7, 0);

-- Проверка KR_Building_A.rvt (model_id = 6) - КРИТИЧНО (много ошибок)
INSERT INTO AxisCheckResults (model_id, check_date, check_type, total_axes_in_model, total_reference_axes, error_count) VALUES
(6, '2024-03-16 14:20:00', 'manual', 7, 7, 5);

-- Проверка AR_Tower_1.rvt (model_id = 7) - ЕСТЬ ОШИБКИ
INSERT INTO AxisCheckResults (model_id, check_date, check_type, total_axes_in_model, total_reference_axes, error_count) VALUES
(7, '2024-03-17 09:15:00', 'manual', 6, 6, 2);

-- Проверка AR_Tower_2.rvt (model_id = 8) - БЕЗ ОШИБОК
INSERT INTO AxisCheckResults (model_id, check_date, check_type, total_axes_in_model, total_reference_axes, error_count) VALUES
(8, '2024-03-17 10:00:00', 'manual', 6, 6, 0);

-- Проверка AR_Tower_Moscow.rvt (model_id = 9) - ЕСТЬ ОШИБКИ
INSERT INTO AxisCheckResults (model_id, check_date, check_type, total_axes_in_model, total_reference_axes, error_count) VALUES
(9, '2024-03-18 15:30:00', 'manual', 10, 12, 4);

-- ===================================================
-- 6. Создание детальных ошибок
-- ===================================================

-- Ошибки для AR_Building_A.rvt (check_result_id = 1)
INSERT INTO AxisErrors (check_result_id, axis_name, element_id, error_types, deviation_mm, is_pinned, workset_name) VALUES
(1, 'А', 12345, 'Deviation', 5.2345, 1, 'Оси и уровни'),
(1, 'Б', 12346, 'NotPinned', NULL, 0, 'Оси и уровни'),
(1, 'В', 12347, 'Deviation;NotPinned', 3.1234, 0, 'Оси и уровни');

-- Ошибки для KR_Building_A.rvt (check_result_id = 3)
INSERT INTO AxisErrors (check_result_id, axis_name, element_id, error_types, deviation_mm, is_pinned, workset_name) VALUES
(3, 'А', 23456, 'Deviation', 12.5678, 1, 'Неправильный набор'),
(3, 'Б', 23457, 'NonParallel', 25.3456, 1, 'Оси и уровни'),
(3, 'Г', 23458, 'NotPinned', NULL, 0, 'Оси и уровни'),
(3, '1', 23459, 'WrongWorkset', NULL, 1, 'Другой набор'),
(3, '2', 23460, 'Deviation;NotPinned;WrongWorkset', 8.9123, 0, 'Неправильный набор');

-- Ошибки для AR_Tower_1.rvt (check_result_id = 4)
INSERT INTO AxisErrors (check_result_id, axis_name, element_id, error_types, deviation_mm, is_pinned, workset_name) VALUES
(4, 'А', 34567, 'Deviation', 2.1234, 1, 'Оси и уровни'),
(4, 'В', 34568, 'NotPinned', NULL, 0, 'Оси и уровни');

-- Ошибки для AR_Tower_Moscow.rvt (check_result_id = 6)
INSERT INTO AxisErrors (check_result_id, axis_name, element_id, error_types, deviation_mm, is_pinned, workset_name) VALUES
(6, 'А', 45678, 'Deviation', 15.6789, 1, 'Оси и уровни'),
(6, 'Б-1', NULL, 'NotInModel', NULL, NULL, NULL),
(6, 'Г', 45680, 'NotPinned;WrongWorkset', NULL, 0, 'Неправильный набор'),
(6, '5', 45681, 'NotInReference', NULL, 1, 'Оси и уровни');

-- ===================================================
-- ГОТОВО! Тестовые данные созданы
-- ===================================================

-- Проверка созданных данных:
SELECT 
    d.code AS directory,
    COUNT(DISTINCT m.id) AS models_count,
    COUNT(DISTINCT acr.id) AS checks_count,
    SUM(acr.error_count) AS total_errors
FROM Directories d
LEFT JOIN Models m ON d.id = m.directory_id AND m.model_name != '_Reference'
LEFT JOIN AxisCheckResults acr ON m.id = acr.model_id
GROUP BY d.id, d.code;
