import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import Breadcrumbs from './components/Breadcrumbs';
import DirectoryCard from './components/DirectoryCard';
import ModelCard from './components/ModelCard';
import ErrorReportTable from './components/ErrorReportTable';
import { axisAPI } from './services/api';

function App() {
  // Состояние навигации
  const [currentView, setCurrentView] = useState('directories'); // 'directories' | 'models' | 'report'
  const [selectedDirectory, setSelectedDirectory] = useState(null);
  const [selectedModel, setSelectedModel] = useState(null);

  // Данные
  const [directories, setDirectories] = useState([]);
  const [models, setModels] = useState([]);
  const [report, setReport] = useState(null);

  // Загрузка
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // ========================================
  // Загрузка директорий при монтировании
  // ========================================
  useEffect(() => {
    loadDirectories();
  }, []);

  // ========================================
  // Функции загрузки данных
  // ========================================

  const loadDirectories = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await axisAPI.getDirectories();
      setDirectories(data);
    } catch (err) {
      setError('Ошибка загрузки директорий: ' + err.message);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadModels = async (directoryId) => {
    setLoading(true);
    setError(null);
    try {
      const data = await axisAPI.getDirectoryModels(directoryId);
      setModels(data);
    } catch (err) {
      setError('Ошибка загрузки моделей: ' + err.message);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadReport = async (modelId) => {
    setLoading(true);
    setError(null);
    try {
      const data = await axisAPI.getModelCheckReport(modelId);
      setReport(data);
    } catch (err) {
      setError('Ошибка загрузки отчета: ' + err.message);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // ========================================
  // Обработчики навигации
  // ========================================

  const handleDirectoryClick = (directory) => {
    setSelectedDirectory(directory);
    setCurrentView('models');
    loadModels(directory.id);
  };

  const handleModelClick = (model) => {
    setSelectedModel(model);
    setCurrentView('report');
    loadReport(model.id);
  };

  const handleBackToDirectories = () => {
    setCurrentView('directories');
    setSelectedDirectory(null);
    setSelectedModel(null);
    setModels([]);
    setReport(null);
  };

  const handleBackToModels = () => {
    setCurrentView('models');
    setSelectedModel(null);
    setReport(null);
  };

  // ========================================
  // Breadcrumbs
  // ========================================

  const getBreadcrumbs = () => {
    const items = [];

    items.push({
      label: 'Все директории',
      onClick: currentView !== 'directories' ? handleBackToDirectories : null,
    });

    if (selectedDirectory && (currentView === 'models' || currentView === 'report')) {
      items.push({
        label: selectedDirectory.name,
        onClick: currentView === 'report' ? handleBackToModels : null,
      });
    }

    if (selectedModel && currentView === 'report') {
      items.push({
        label: selectedModel.model_name,
      });
    }

    return items;
  };

  // ========================================
  // Рендер различных представлений
  // ========================================

  const renderDirectories = () => (
    <>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Директории проектов
        </h2>
        <p className="text-gray-600">
          Выберите директорию для просмотра моделей
        </p>
      </div>

      {directories.length === 0 && !loading ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <svg
            className="w-16 h-16 mx-auto text-gray-400 mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
            />
          </svg>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Нет директорий
          </h3>
          <p className="text-gray-500">
            Директории будут отображаться после создания в Revit
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {directories.map((directory) => (
            <DirectoryCard
              key={directory.id}
              directory={directory}
              onClick={() => handleDirectoryClick(directory)}
            />
          ))}
        </div>
      )}
    </>
  );

  const renderModels = () => (
    <>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Модели в директории: {selectedDirectory?.name}
        </h2>
        <p className="text-gray-600">
          Выберите модель для просмотра детального отчета
        </p>
      </div>

      {models.length === 0 && !loading ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <svg
            className="w-16 h-16 mx-auto text-gray-400 mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Нет моделей
          </h3>
          <p className="text-gray-500">
            Модели будут отображаться после проверки в Revit
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {models.map((model) => (
            <ModelCard
              key={model.id}
              model={model}
              onClick={() => handleModelClick(model)}
            />
          ))}
        </div>
      )}
    </>
  );

  const renderReport = () => (
    <>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Отчет проверки: {selectedModel?.model_name}
        </h2>
        <p className="text-gray-600">
          Детальный список ошибок в осях модели
        </p>
      </div>

      {report ? (
        <ErrorReportTable report={report} />
      ) : (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <p className="text-gray-500">Загрузка отчета...</p>
        </div>
      )}
    </>
  );

  // ========================================
  // Главный рендер
  // ========================================

  return (
    <div className="min-h-screen bg-gray-50">
      <Header
        title="Мониторинг моделей Revit"
        subtitle="Система контроля качества в моделях Revit"
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumbs */}
        {currentView !== 'directories' && (
          <Breadcrumbs items={getBreadcrumbs()} />
        )}

        {/* Сообщение об ошибке */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center">
              <svg
                className="w-5 h-5 text-red-600 mr-2"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
              <span className="text-red-800">{error}</span>
            </div>
          </div>
        )}

        {/* Индикатор загрузки */}
        {loading && (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
          </div>
        )}

        {/* Контент */}
        {!loading && (
          <>
            {currentView === 'directories' && renderDirectories()}
            {currentView === 'models' && renderModels()}
            {currentView === 'report' && renderReport()}
          </>
        )}
      </main>
    </div>
  );
}

export default App;
