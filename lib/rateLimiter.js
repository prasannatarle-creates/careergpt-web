// Simple In-Memory Rate Limiter
// Tracks requests by IP; prevents brute force attacks

const store = new Map(); // { "ip:endpoint": { count, resetAt } }

class RateLimiter {
  constructor(windowMs = 15 * 60 * 1000, maxRequests = 5) {
    this.windowMs = windowMs; // Time window in ms (default: 15 min)
    this.maxRequests = maxRequests; // Max requests per window (default: 5)
  }

  getKey(ip, endpoint = '') {
    return `${ip}:${endpoint}`;
  }

  getClientIp(request) {
    // Get IP from headers (handles proxies)
    const forwarded = request.headers.get('x-forwarded-for');
    if (forwarded) return forwarded.split(',')[0].trim();
    
    const xRealIp = request.headers.get('x-real-ip');
    if (xRealIp) return xRealIp;
    
    // Fallback (development mode)
    return '127.0.0.1';
  }

  isLimited(ip, endpoint = '') {
    const key = this.getKey(ip, endpoint);
    const now = Date.now();

    // Clean up expired entries
    if (store.has(key)) {
      const entry = store.get(key);
      if (now > entry.resetAt) {
        store.delete(key);
      }
    }

    // Check if rate limited
    if (!store.has(key)) {
      store.set(key, {
        count: 1,
        resetAt: now + this.windowMs,
      });
      return false;
    }

    const entry = store.get(key);
    if (entry.count < this.maxRequests) {
      entry.count++;
      return false;
    }

    return true;
  }

  getRemainingTime(ip, endpoint = '') {
    const key = this.getKey(ip, endpoint);
    if (!store.has(key)) return 0;
    
    const entry = store.get(key);
    const remaining = Math.max(0, entry.resetAt - Date.now());
    return Math.ceil(remaining / 1000); // Return seconds
  }

  getStatus(ip, endpoint = '') {
    const key = this.getKey(ip, endpoint);
    if (!store.has(key)) return { count: 0, limit: this.maxRequests, resetIn: 0 };
    
    const entry = store.get(key);
    return {
      count: entry.count,
      limit: this.maxRequests,
      resetIn: this.getRemainingTime(ip, endpoint),
    };
  }

  reset(ip, endpoint = '') {
    const key = this.getKey(ip, endpoint);
    store.delete(key);
  }

  resetAll() {
    store.clear();
  }
}

// Create pre-configured limiters
const authLimiter = new RateLimiter(15 * 60 * 1000, 5); // 5 attempts per 15 mins
const registerLimiter = new RateLimiter(60 * 60 * 1000, 3); // 3 registrations per hour
const generalLimiter = new RateLimiter(60 * 1000, 30); // 30 requests per minute

module.exports = { RateLimiter, authLimiter, registerLimiter, generalLimiter };
