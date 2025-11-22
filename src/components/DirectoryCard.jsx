import React from 'react';

const DirectoryCard = ({ directory, onClick }) => {
  const errorRate = directory.total_models > 0
    ? ((directory.error_models / directory.total_models) * 100).toFixed(1)
    : 0;

  const getStatusColor = () => {
    if (directory.error_models === 0) return 'green';
    if (errorRate < 30) return 'yellow';
    return 'red';
  };

  const statusColor = getStatusColor();

  const colorClasses = {
    green: 'border-green-500 bg-green-50',
    yellow: 'border-yellow-500 bg-yellow-50',
    red: 'border-red-500 bg-red-50',
  };

  const dotClasses = {
    green: 'bg-green-500',
    yellow: 'bg-yellow-500',
    red: 'bg-red-500',
  };

  return (
    <div
      onClick={onClick}
      className="bg-white border-2 border-gray-200 rounded-lg p-6 hover:border-blue-500 hover:shadow-lg transition-all cursor-pointer"
    >
      {/* Заголовок с индикатором статуса */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <div className={`w-4 h-4 rounded-full ${dotClasses[statusColor]}`} />
            <h3 className="text-xl font-bold text-gray-900">{directory.name}</h3>
          </div>
          <p className="text-sm text-gray-500">
            Создано: {new Date(directory.created_at).toLocaleDateString('ru-RU')}
          </p>
        </div>
      </div>

      {/* Статистика */}
      <div className="grid grid-cols-2 gap-4 mt-4">
        {/* Всего моделей */}
        <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
          <div className="text-sm text-gray-600 mb-1">Всего моделей</div>
          <div className="text-3xl font-bold text-blue-700">
            {directory.total_models}
          </div>
        </div>

        {/* Проблемных моделей */}
        <div className={`rounded-lg p-4 border-2 ${colorClasses[statusColor]}`}>
          <div className="text-sm text-gray-600 mb-1">Проблемных моделей</div>
          <div className="text-3xl font-bold text-gray-900">
            {directory.error_models}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {errorRate}% от общего числа
          </div>
        </div>
      </div>

      {/* Дополнительная информация */}
      {directory.total_errors > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Всего ошибок в осях:</span>
            <span className="font-semibold text-red-600">
              {directory.total_errors}
            </span>
          </div>
        </div>
      )}

      {/* Кнопка просмотра */}
      <div className="mt-4">
        <button className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition font-medium">
          Просмотреть модели →
        </button>
      </div>
    </div>
  );
};

export default DirectoryCard;
