import React from 'react';

const Header = ({ title, subtitle }) => {
  return (
    <header className="bg-white shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {title || 'Отчет об ошибках Revit'}
            </h1>
            {subtitle && (
              <p className="mt-1 text-sm text-gray-500">{subtitle}</p>
            )}
          </div>
          <div className="flex items-center space-x-4">
            <div className="text-right">
              <p className="text-sm text-gray-500">Дата обновления</p>
              <p className="text-sm font-semibold text-gray-900">
                {new Date().toLocaleDateString('ru-RU')}
              </p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
