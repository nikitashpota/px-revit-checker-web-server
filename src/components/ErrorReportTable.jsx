import React, { useState } from 'react';

const ErrorReportTable = ({ report }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);

  // Пагинация
  const totalPages = Math.ceil((report.errors?.length || 0) / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentErrors = report.errors?.slice(startIndex, endIndex) || [];

  // Сброс страницы при изменении itemsPerPage
  const handleItemsPerPageChange = (newValue) => {
    setItemsPerPage(newValue);
    setCurrentPage(1);
  };

  // Функция для получения текста типа ошибки
  const getErrorTypeText = (errorType) => {
    const errorTypes = {
      'Deviation': 'Отклонение от эталона',
      'NonParallel': 'Непараллельность',
      'NotPinned': 'Не закреплена',
      'WrongWorkset': 'Неправильный рабочий набор',
      'NotInReference': 'Отсутствует в эталоне',
      'NotInModel': 'Отсутствует в модели',
    };
    return errorTypes[errorType] || errorType;
  };

  // Компонент пагинации
  const Pagination = () => {
    if (totalPages <= 1) return null;

    return (
      <div className="flex items-center justify-center gap-2 mt-4">
        <button
          onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
          className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Назад
        </button>

        <div className="flex gap-1">
          {[...Array(Math.min(5, totalPages))].map((_, i) => {
            let pageNum;
            if (totalPages <= 5) {
              pageNum = i + 1;
            } else if (currentPage <= 3) {
              pageNum = i + 1;
            } else if (currentPage >= totalPages - 2) {
              pageNum = totalPages - 4 + i;
            } else {
              pageNum = currentPage - 2 + i;
            }

            return (
              <button
                key={pageNum}
                onClick={() => setCurrentPage(pageNum)}
                className={`w-8 h-8 text-sm rounded ${
                  currentPage === pageNum
                    ? 'bg-blue-600 text-white'
                    : 'border border-gray-300 hover:bg-gray-50'
                }`}
              >
                {pageNum}
              </button>
            );
          })}
        </div>

        <button
          onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages}
          className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Вперед
        </button>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-lg shadow">
      {/* Заголовок и статистика */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Детальный отчет проверки
          </h3>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-gray-600">
              Показывать:
            </span>
            <select
              value={itemsPerPage}
              onChange={(e) => handleItemsPerPageChange(Number(e.target.value))}
              className="border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={report.errors?.length || 0}>
                Все ({report.errors?.length || 0})
              </option>
            </select>
          </div>
        </div>

        {/* Статистика */}
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
            <div className="text-xs text-gray-600 mb-1">Всего осей</div>
            <div className="text-2xl font-bold text-blue-700">
              {report.total_axes_in_model}
            </div>
          </div>
          <div className="bg-green-50 rounded-lg p-3 border border-green-200">
            <div className="text-xs text-gray-600 mb-1">Без ошибок</div>
            <div className="text-2xl font-bold text-green-700">
              {report.success_count}
            </div>
          </div>
          <div className="bg-red-50 rounded-lg p-3 border border-red-200">
            <div className="text-xs text-gray-600 mb-1">С ошибками</div>
            <div className="text-2xl font-bold text-red-700">
              {report.error_count}
            </div>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
            <div className="text-xs text-gray-600 mb-1">Эталонных осей</div>
            <div className="text-2xl font-bold text-gray-700">
              {report.total_reference_axes}
            </div>
          </div>
        </div>

        <div className="mt-4 text-sm text-gray-500">
          Дата проверки: {new Date(report.check_date).toLocaleString('ru-RU')}
        </div>
      </div>

      {/* Таблица ошибок */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                ElementId
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Имя оси
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Типы ошибок
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Смещение (мм)
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Закреплена
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Рабочий набор
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {currentErrors.map((error, idx) => (
              <tr key={idx} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {error.element_id || 'NULL'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {error.axis_name}
                </td>
                <td className="px-6 py-4 text-sm text-gray-900">
                  <div className="space-y-1">
                    {error.error_types_array.map((type, i) => (
                      <div
                        key={i}
                        className="inline-block mr-1 mb-1 px-2 py-1 bg-red-100 text-red-800 rounded text-xs"
                      >
                        {getErrorTypeText(type)}
                      </div>
                    ))}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {error.deviation_mm !== null
                    ? parseFloat(error.deviation_mm).toFixed(4)
                    : '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  {error.is_pinned !== null ? (
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        error.is_pinned
                          ? 'bg-green-100 text-green-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}
                    >
                      {error.is_pinned ? 'Да' : 'Нет'}
                    </span>
                  ) : (
                    '-'
                  )}
                </td>
                <td className="px-6 py-4 text-sm text-gray-500">
                  {error.workset_name || '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Пагинация */}
      <div className="px-6 py-4 border-t border-gray-200">
        <div className="flex items-center justify-between text-sm text-gray-500 mb-2">
          <span>
            Показано {startIndex + 1}–{Math.min(endIndex, report.errors?.length || 0)} из{' '}
            {report.errors?.length || 0}
          </span>
        </div>
        <Pagination />
      </div>
    </div>
  );
};

export default ErrorReportTable;
