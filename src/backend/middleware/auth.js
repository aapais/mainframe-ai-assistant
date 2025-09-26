/**
 * Authentication Middleware
 * Handles JWT authentication for API routes
 */

const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your-jwt-secret-change-this-in-production';

/**
 * Authenticate user from JWT token
 */
const authenticateUser = (req, res, next) => {
  try {
    // Get token from Authorization header or FormData
    const authHeader = req.headers.authorization;
    let token = null;

    console.log('[AUTH DEBUG] Headers:', req.headers);
    console.log('[AUTH DEBUG] Auth header:', authHeader);
    console.log('[AUTH DEBUG] Body authToken:', req.body?.authToken);

    // Try to get token from Authorization header first
    if (authHeader) {
      token = authHeader.startsWith('Bearer ')
        ? authHeader.slice(7)
        : authHeader;
    }
    // If no header token, try to get from FormData
    else if (req.body && req.body.authToken) {
      token = req.body.authToken;
      console.log('[AUTH DEBUG] Using token from FormData');
    }

    if (!token) {
      return res.status(401).json({ error: 'No authorization token provided' });
    }

    console.log('[AUTH DEBUG] Token extracted:', token ? token.substring(0, 50) + '...' : 'NO TOKEN');

    if (!token || token === 'default' || token === 'null' || token === 'undefined') {
      console.log('[AUTH DEBUG] Invalid token detected:', token);
      return res.status(401).json({ error: 'Invalid authorization format' });
    }

    // Verify token
    console.log('[AUTH DEBUG] Verifying token with secret:', JWT_SECRET.substring(0, 10) + '...');

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      console.log('[AUTH DEBUG] Token decoded successfully:', decoded);

      // Attach user to request
      req.user = {
        id: decoded.userId || decoded.id,
        email: decoded.email,
        role: decoded.role
      };

      next();
      return; // Important: return here to avoid executing the error handlers below
    } catch (verifyError) {
      console.log('[AUTH DEBUG] JWT Verification failed:', verifyError.message);
      console.log('[AUTH DEBUG] Token that failed:', token.substring(0, 50) + '...');

      if (verifyError.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Token expired' });
      } else if (verifyError.name === 'JsonWebTokenError') {
        return res.status(401).json({ error: 'Invalid token' });
      }

      throw verifyError; // Re-throw to be caught by outer try/catch
    }
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    } else if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }

    console.error('Authentication error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
};

/**
 * Generate JWT token for user
 */
const generateToken = (user) => {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role || 'user'
    },
    JWT_SECRET,
    {
      expiresIn: '7d'
    }
  );
};

/**
 * Verify token without middleware
 */
const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
};

module.exports = {
  authenticateUser,
  generateToken,
  verifyToken
};