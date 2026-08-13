// Central API Base URL Configuration
// Uses process.env or VITE_API_URL, falling back to http://localhost:5000 in development
export const API_BASE_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '') || 'http://localhost:5000';

export const getApiUrl = (path) => {
  if (!path) return API_BASE_URL;
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${cleanPath}`;
};

export const apiFetch = async (endpoint, options = {}) => {
  const url = getApiUrl(endpoint);
  try {
    const res = await fetch(url, options);
    const contentType = res.headers.get('content-type') || '';
    
    let data = {};
    if (contentType.includes('application/json')) {
      data = await res.json();
    } else {
      const rawText = await res.text();
      return {
        ok: res.ok,
        status: res.status,
        data: {
          success: false,
          message: res.ok ? 'Server returned unexpected format' : `Server error (${res.status}): Backend endpoint unreachable.`,
          rawText
        }
      };
    }

    return {
      ok: res.ok,
      status: res.status,
      data
    };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      data: {
        success: false,
        message: `Cannot connect to backend server. Please verify backend is running on ${API_BASE_URL}. (${err.message})`
      }
    };
  }
};
