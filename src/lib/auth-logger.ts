/**
 * Auth Logger - Para diagnóstico detalhado
 */

export const authLogger = {
  log: (source: string, message: string, data?: any) => {
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    const prefix = `[${timestamp}] [${source}]`;
    if (data) {
      console.log(`${prefix} ${message}`, data);
    } else {
      console.log(`${prefix} ${message}`);
    }
  },
  
  sessionStorage: () => {
    if (typeof window === 'undefined') return {};
    const data: Record<string, any> = {};
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key) {
        try {
          data[key] = JSON.parse(sessionStorage.getItem(key) || '');
        } catch {
          data[key] = sessionStorage.getItem(key);
        }
      }
    }
    return data;
  }
};
