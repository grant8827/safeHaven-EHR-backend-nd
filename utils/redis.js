const Redis = require('ioredis');

// Create Redis client
const createRedisClient = () => {
  const redisUrl = process.env.REDIS_URL;
  
  if (!redisUrl) {
    console.warn('⚠️  REDIS_URL not configured. Redis features will be disabled.');
    return null;
  }

  const redis = new Redis(redisUrl, {
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
      const delay = Math.min(times * 50, 2000);
      return delay;
    },
    reconnectOnError(err) {
      const targetError = 'READONLY';
      if (err.message.includes(targetError)) {
        // Reconnect when getting READONLY error
        return true;
      }
      return false;
    },
  });

  redis.on('connect', () => {
    console.log('✅ Redis connected successfully');
  });

  redis.on('error', (err) => {
    console.error('❌ Redis connection error:', err.message);
  });

  redis.on('ready', () => {
    console.log('✅ Redis is ready to accept commands');
  });

  redis.on('close', () => {
    console.log('⚠️  Redis connection closed');
  });

  return redis;
};

const redisClient = createRedisClient();

// Session management helpers
const sessionHelpers = {
  /**
   * Store user session in Redis
   * @param {string} userId - User ID
   * @param {object} sessionData - Session data to store
   * @param {number} ttl - Time to live in seconds (default: 7 days)
   */
  setSession: async (userId, sessionData, ttl = 7 * 24 * 60 * 60) => {
    if (!redisClient) return false;
    try {
      const key = `session:${userId}`;
      await redisClient.setex(key, ttl, JSON.stringify(sessionData));
      return true;
    } catch (error) {
      console.error('Error setting session:', error);
      return false;
    }
  },

  /**
   * Get user session from Redis
   * @param {string} userId - User ID
   */
  getSession: async (userId) => {
    if (!redisClient) return null;
    try {
      const key = `session:${userId}`;
      const data = await redisClient.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Error getting session:', error);
      return null;
    }
  },

  /**
   * Delete user session from Redis
   * @param {string} userId - User ID
   */
  deleteSession: async (userId) => {
    if (!redisClient) return false;
    try {
      const key = `session:${userId}`;
      await redisClient.del(key);
      return true;
    } catch (error) {
      console.error('Error deleting session:', error);
      return false;
    }
  },
};

// Token blacklist helpers (for logout functionality)
const tokenHelpers = {
  /**
   * Blacklist a JWT token (for logout)
   * @param {string} token - JWT token to blacklist
   * @param {number} ttl - Time to live in seconds (match token expiry)
   */
  blacklistToken: async (token, ttl = 15 * 60) => {
    if (!redisClient) return false;
    try {
      const key = `blacklist:${token}`;
      await redisClient.setex(key, ttl, '1');
      return true;
    } catch (error) {
      console.error('Error blacklisting token:', error);
      return false;
    }
  },

  /**
   * Check if a token is blacklisted
   * @param {string} token - JWT token to check
   */
  isTokenBlacklisted: async (token) => {
    if (!redisClient) return false;
    try {
      const key = `blacklist:${token}`;
      const result = await redisClient.get(key);
      return result !== null;
    } catch (error) {
      console.error('Error checking token blacklist:', error);
      return false;
    }
  },
};

// Cache helpers (for frequently accessed data)
const cacheHelpers = {
  /**
   * Set cache value
   * @param {string} key - Cache key
   * @param {any} value - Value to cache
   * @param {number} ttl - Time to live in seconds (default: 5 minutes)
   */
  set: async (key, value, ttl = 5 * 60) => {
    if (!redisClient) return false;
    try {
      const cacheKey = `cache:${key}`;
      await redisClient.setex(cacheKey, ttl, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error('Error setting cache:', error);
      return false;
    }
  },

  /**
   * Get cache value
   * @param {string} key - Cache key
   */
  get: async (key) => {
    if (!redisClient) return null;
    try {
      const cacheKey = `cache:${key}`;
      const data = await redisClient.get(cacheKey);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Error getting cache:', error);
      return null;
    }
  },

  /**
   * Delete cache value
   * @param {string} key - Cache key
   */
  delete: async (key) => {
    if (!redisClient) return false;
    try {
      const cacheKey = `cache:${key}`;
      await redisClient.del(cacheKey);
      return true;
    } catch (error) {
      console.error('Error deleting cache:', error);
      return false;
    }
  },

  /**
   * Delete all cache keys matching a pattern
   * @param {string} pattern - Pattern to match (e.g., 'patients:*')
   */
  deletePattern: async (pattern) => {
    if (!redisClient) return false;
    try {
      const keys = await redisClient.keys(`cache:${pattern}`);
      if (keys.length > 0) {
        await redisClient.del(...keys);
      }
      return true;
    } catch (error) {
      console.error('Error deleting cache pattern:', error);
      return false;
    }
  },
};

// Rate limiting helpers
const rateLimitHelpers = {
  /**
   * Check and increment rate limit
   * @param {string} identifier - Identifier (e.g., IP address, user ID)
   * @param {number} maxRequests - Max requests allowed
   * @param {number} windowSeconds - Time window in seconds
   * @returns {object} { allowed: boolean, remaining: number, resetIn: number }
   */
  checkLimit: async (identifier, maxRequests = 100, windowSeconds = 60) => {
    if (!redisClient) return { allowed: true, remaining: maxRequests, resetIn: 0 };
    
    try {
      const key = `ratelimit:${identifier}`;
      const current = await redisClient.incr(key);
      
      if (current === 1) {
        await redisClient.expire(key, windowSeconds);
      }
      
      const ttl = await redisClient.ttl(key);
      const allowed = current <= maxRequests;
      const remaining = Math.max(0, maxRequests - current);
      
      return {
        allowed,
        remaining,
        resetIn: ttl > 0 ? ttl : windowSeconds,
      };
    } catch (error) {
      console.error('Error checking rate limit:', error);
      return { allowed: true, remaining: maxRequests, resetIn: 0 };
    }
  },
};

module.exports = {
  redisClient,
  sessionHelpers,
  tokenHelpers,
  cacheHelpers,
  rateLimitHelpers,
};
