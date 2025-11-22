import React from 'react';

const ModelCard = ({ model, onClick }) => {
  const hasErrors = model.error_count > 0;
  const successRate = model.total_axes_in_model > 0
    ? ((model.success_count / model.total_axes_in_model) * 100).toFixed(1)
    : 0;

  const getStatusInfo = () => {
    if (!model.check_date) {
      return {
        color: 'gray',
        label: 'Не проверена',
        bgClass: 'bg-gray-100',
        borderClass: 'border-gray-300',
        textClass: 'text-gray-700',
      };
    }
    if (!hasErrors) {
      return {
        color: 'green',
        label: 'Без ошибок',
        bgClass: 'bg-green-50',
        borderClass: 'border-green-500',
        textClass: 'text-green-700',
      };
    }
    if (model.error_count < 5) {
      return {
        color: 'yellow',
        label: 'Требует внимания',
        bgClass: 'bg-yellow-50',
        borderClass: 'border-yellow-500',
        textClass: 'text-yellow-700',
      };
    }
    return {
      color: 'red',
      label: 'Критично',
      bgClass: 'bg-red-50',
      borderClass: 'border-red-500',
      textClass: 'text-red-700',
    };
  };

  const status = getStatusInfo();

  return (
    <div
      onClick={onClick}
      className={`bg-white border-2 ${status.borderClass} rounded-lg p-5 hover:shadow-lg transition-all cursor-pointer`}
    >
      {/* Заголовок */}
      <div className="mb-4">
        <h4 className="text-lg font-semibold text-gray-900 mb-2 line-clamp-2">
          {model.model_name}
        </h4>
        <div className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${status.bgClass} ${status.textClass}`}>
          {status.label}
        </div>
      </div>

      {/* Информация о проверке */}
      {model.check_date ? (
        <>
          <div className="space-y-2 mb-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Последняя проверка:</span>
              <span className="font-medium text-gray-900">
                {new Date(model.check_date).toLocaleDateString('ru-RU')}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Всего осей:</span>
              <span className="font-semibold text-gray-900">
                {model.total_axes_in_model}
              </span>
            </div>
          </div>

          {/* Прогресс-бар */}
          <div className="mb-4">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-gray-600">Корректных осей</span>
              <span className="font-semibold text-gray-900">{successRate}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full ${
                  hasErrors ? 'bg-red-500' : 'bg-green-500'
                }`}
                style={{ width: `${successRate}%` }}
              />
            </div>
          </div>

          {/* Статистика */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-green-50 rounded p-3 border border-green-200">
              <div className="text-xs text-gray-600 mb-1">Без ошибок</div>
              <div className="text-xl font-bold text-green-700">
                {model.success_count}
              </div>
            </div>
            <div className="bg-red-50 rounded p-3 border border-red-200">
              <div className="text-xs text-gray-600 mb-1">С ошибками</div>
              <div className="text-xl font-bold text-red-700">
                {model.error_count}
              </div>
            </div>
          </div>

          {/* Кнопка просмотра отчета */}
          {hasErrors && (
            <div className="mt-4">
              <button className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition text-sm font-medium">
                Просмотреть отчет →
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-6 text-gray-400 text-sm">
          Модель еще не проверялась
        </div>
      )}
    </div>
  );
};

export default ModelCard;
