// ============ HYDRATION-SAFE DATE FORMATTER ============
export function formatDate(dateStr) {
  if (!dateStr) return 'N/A';
  try {
    const date = new Date(dateStr);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  } catch {
    return 'N/A';
  }
}

export function formatDateTime(dateStr) {
  if (!dateStr) return 'N/A';
  try {
    const date = new Date(dateStr);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const mins = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${mins}`;
  } catch {
    return 'N/A';
  }
}

// ============ API HELPER ============
const api = {
  token: null,
  _initialized: false,
  setToken(t) { 
    this.token = t; 
    if (typeof window !== 'undefined') {
      if (t) localStorage.setItem('cgpt_token', t); 
      else localStorage.removeItem('cgpt_token'); 
    }
  },
  getToken() { 
    if (!this._initialized && typeof window !== 'undefined') {
      this.token = localStorage.getItem('cgpt_token');
      this._initialized = true;
    }
    return this.token; 
  },
  async fetch(url, options = {}) {
    const headers = { ...options.headers };
    const token = this.getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (options.body && !(options.body instanceof FormData)) headers['Content-Type'] = 'application/json';
    try {
      const res = await fetch(`/api${url}`, { ...options, headers });
      
      if (res.status >= 500) {
        const text = await res.text().catch(() => '');
        console.error(`Server error ${res.status} from:`, url, text.substring(0, 200));
        if (res.status === 520) {
          return { error: 'Connection error. Please try again.' };
        }
        return { error: `Server error (${res.status}). Please try again.` };
      }
      
      const contentType = res.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await res.text().catch(() => '');
        console.error('Non-JSON response from:', url, text.substring(0, 200));
        return { error: 'Unexpected server response. Please try again.' };
      }
      
      const data = await res.json();
      return data;
    } catch (err) {
      console.error('API error for:', url, err);
      if (err.name === 'TypeError' && err.message.includes('fetch')) {
        return { error: 'Network error. Please check your connection.' };
      }
      return { error: `Request failed: ${err.message}` };
    }
  },
  get(url) { return this.fetch(url); },
  post(url, body) { return this.fetch(url, { method: 'POST', body: body instanceof FormData ? body : JSON.stringify(body) }); },
  put(url, body) { return this.fetch(url, { method: 'PUT', body: JSON.stringify(body) }); },
  del(url) { return this.fetch(url, { method: 'DELETE' }); },
};

export default api;
