import axios from 'axios';

const API_BASE_URL = 'http://localhost:3001/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * API сервис для работы с бэкендом
 */
export const axisAPI = {
  /**
   * Получить список всех директорий
   */
  getDirectories: async () => {
    const response = await api.get('/directories');
    return response.data;
  },

  /**
   * Получить модели директории
   */
  getDirectoryModels: async (directoryId) => {
    const response = await api.get(`/directories/${directoryId}/models`);
    return response.data;
  },

  /**
   * Получить детальный отчет проверки модели
   */
  getModelCheckReport: async (modelId) => {
    const response = await api.get(`/models/${modelId}/check-report`);
    return response.data;
  },

  /**
   * Получить эталонные оси директории
   */
  getReferenceAxes: async (directoryId) => {
    const response = await api.get(`/directories/${directoryId}/reference-axes`);
    return response.data;
  },

  /**
   * Получить общую статистику
   */
  getOverallStats: async () => {
    const response = await api.get('/stats/overall');
    return response.data;
  },
};

export default api;
