// src/middleware/auth.js
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';

const JWT_SECRET = process.env.JWT_SECRET || 'supersecret';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'superrefreshsecret';

// Usuarios de prueba (deberías reemplazar con tu base de datos)
const users = [
  { id: 1, username: 'juan', password: '1234' },
  { id: 2, username: 'admin', password: 'admin' }
];

// Generar tokens
export function generateTokens(user) {
  const accessToken = jwt.sign(
    { id: user.id, username: user.username },
    JWT_SECRET,
    { expiresIn: '15m' }
  );

  const refreshToken = jwt.sign(
    { id: user.id, username: user.username },
    JWT_REFRESH_SECRET,
    { expiresIn: '7d' }
  );

  return { accessToken, refreshToken };
}

// Middleware para validar token de acceso
export function requireAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return res.status(401).json({ error: 'Token requerido' });

  const token = authHeader.split(' ')[1];

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Token inválido o expirado' });
    req.user = user;
    next();
  });
}

// Login
export function login(req, res) {
  const { username, password } = req.body;
  const user = users.find(u => u.username === username && u.password === password);

  if (!user) return res.status(401).json({ error: 'Credenciales inválidas' });

  const tokens = generateTokens(user);
  res.json(tokens);
}

// Registro (ejemplo simple)
export function register(req, res) {
  const { username, password } = req.body;

  if (users.some(u => u.username === username)) {
    return res.status(400).json({ error: 'Usuario ya existe' });
  }

  const newUser = { id: users.length + 1, username, password };
  users.push(newUser);

  const tokens = generateTokens(newUser);
  res.json(tokens);
}

// Refrescar token
export function refreshToken(req, res) {
  const { token } = req.body;
  if (!token) return res.status(401).json({ error: 'Refresh token requerido' });

  jwt.verify(token, JWT_REFRESH_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Refresh token inválido o expirado' });

    const tokens = generateTokens(user);
    res.json(tokens);
  });
}

// Middleware para verificar roles
export const requireRole = (role) => (req, res, next) => {
  if (!req.user || req.user.role !== role) {
    return res.status(403).json({ error: 'No tienes permisos para acceder a este recurso' });
  }
  next();
};

// Middleware específico para admin
export const requireAdmin = requireRole('admin');


// Rate limiter para auth
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10, // máx 10 intentos
  message: { error: 'Demasiados intentos, intente más tarde' }
});
