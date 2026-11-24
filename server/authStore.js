import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const DATA_DIR = path.resolve(process.cwd(), '.data');
const STORE_PATH = path.join(DATA_DIR, 'auth-store.json');
const TOKEN_SECRET = process.env.JWT_SECRET || 'formflow-dev-session-secret-2026';

export function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password, storedHash) {
  const [salt, key] = String(storedHash).split(':');
  if (!salt || !key) return false;
  const derived = crypto.scryptSync(password, salt, 64);
  const keyBuf = Buffer.from(key, 'hex');
  if (derived.length !== keyBuf.length) return false;
  return crypto.timingSafeEqual(derived, keyBuf);
}

function signToken(payload, expiresInSeconds) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(
    JSON.stringify({
      ...payload,
      exp: Math.floor(Date.now() / 1000) + expiresInSeconds,
    })
  ).toString('base64url');
  const signature = crypto
    .createHmac('sha256', TOKEN_SECRET)
    .update(`${header}.${body}`)
    .digest('base64url');
  return `${header}.${body}.${signature}`;
}

export function verifyToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, body, sig] = parts;
  const expected = crypto
    .createHmac('sha256', TOKEN_SECRET)
    .update(`${header}.${body}`)
    .digest('base64url');
  if (sig !== expected) return null;
  try {
    const decoded = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (!decoded.exp || decoded.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}

function ensureStore() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(STORE_PATH)) {
    const seed = {
      users: [
        {
          id: 1,
          fullName: 'Alex Morgan',
          email: 'demo@formflow.io',
          phone: '+91 98765 43210',
          aadhaar: '482910384712',
          photoDataUrl: '',
          passwordHash: hashPassword('Demo@1234'),
          role: 'ADMIN',
          createdAt: new Date().toISOString(),
        },
      ],
      resetTokens: [],
      newsletter: [],
    };
    fs.writeFileSync(STORE_PATH, JSON.stringify(seed, null, 2));
  }
}

export function readAuthStore() {
  ensureStore();
  return JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
}

export function writeAuthStore(store) {
  ensureStore();
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2));
}

export function sanitizeUser(user) {
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    phone: user.phone || '',
    aadhaar: user.aadhaar || '',
    photoDataUrl: user.photoDataUrl || '',
    role: user.role,
    createdAt: user.createdAt,
  };
}

export function getAuthenticatedUser(authHeader) {
  const raw = String(authHeader || '');
  const token = raw.startsWith('Bearer ') ? raw.slice(7) : '';
  const decoded = verifyToken(token);
  if (!decoded) return null;
  const store = readAuthStore();
  return store.users.find((u) => u.id === decoded.sub) || null;
}

export function handleAuthRequest(method, urlPath, body, authHeader) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (method === 'POST' && urlPath === '/api/auth/register') {
    const fullName = String(body?.fullName || '').trim();
    const email = String(body?.email || '').trim().toLowerCase();
    const password = String(body?.password || '');

    if (fullName.length < 2) {
      return { status: 400, data: { message: 'Full name must be at least 2 characters.' } };
    }
    if (!emailRegex.test(email)) {
      return { status: 400, data: { message: 'Please enter a valid email address.' } };
    }
    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      return {
        status: 400,
        data: { message: 'Password must be at least 8 characters and include both letters and numbers.' },
      };
    }

    const store = readAuthStore();
    if (store.users.some((u) => u.email === email)) {
      return { status: 409, data: { message: 'An account with this email already exists.' } };
    }

    const newUser = {
      id: store.users.length ? Math.max(...store.users.map((u) => u.id)) + 1 : 1,
      fullName,
      email,
      phone: '',
      aadhaar: '',
      photoDataUrl: '',
      passwordHash: hashPassword(password),
      role: 'OWNER',
      createdAt: new Date().toISOString(),
    };
    store.users.push(newUser);
    writeAuthStore(store);

    const token = signToken({ sub: newUser.id, email: newUser.email }, 60 * 60 * 24 * 7);
    return {
      status: 201,
      data: {
        message: 'Account created successfully.',
        token,
        user: sanitizeUser(newUser),
      },
    };
  }

  if (method === 'POST' && urlPath === '/api/auth/login') {
    const email = String(body?.email || '').trim().toLowerCase();
    const password = String(body?.password || '');
    const rememberMe = Boolean(body?.rememberMe);

    if (!emailRegex.test(email) || !password) {
      return { status: 400, data: { message: 'Email and password are required.' } };
    }

    const store = readAuthStore();
    const user = store.users.find((u) => u.email === email);
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return { status: 401, data: { message: 'Invalid email or password. Please check your credentials.' } };
    }

    const ttl = rememberMe ? 60 * 60 * 24 * 30 : 60 * 60 * 24;
    const token = signToken({ sub: user.id, email: user.email }, ttl);
    return {
      status: 200,
      data: {
        message: 'Signed in successfully.',
        token,
        user: sanitizeUser(user),
      },
    };
  }

  if (method === 'POST' && urlPath === '/api/auth/forgot-password') {
    const email = String(body?.email || '').trim().toLowerCase();
    if (!emailRegex.test(email)) {
      return { status: 400, data: { message: 'Please enter a valid email address.' } };
    }

    const store = readAuthStore();
    const user = store.users.find((u) => u.email === email);

    let resetToken = null;
    if (user) {
      resetToken = crypto.randomBytes(24).toString('hex');
      store.resetTokens = store.resetTokens.filter((t) => t.userId !== user.id);
      store.resetTokens.push({
        token: resetToken,
        userId: user.id,
        expiresAt: Date.now() + 1000 * 60 * 30,
      });
      writeAuthStore(store);
    }

    return {
      status: 200,
      data: {
        message: 'If an account matches this email, recovery instructions have been generated.',
        resetToken,
      },
    };
  }

  if (method === 'POST' && urlPath === '/api/auth/reset-password') {
    const token = String(body?.token || '').trim();
    const newPassword = String(body?.newPassword || '');

    if (!token) {
      return { status: 400, data: { message: 'Reset code is missing or invalid.' } };
    }
    if (newPassword.length < 8 || !/[A-Za-z]/.test(newPassword) || !/\d/.test(newPassword)) {
      return {
        status: 400,
        data: { message: 'New password must be at least 8 characters and include both letters and numbers.' },
      };
    }

    const store = readAuthStore();
    const record = store.resetTokens.find((t) => t.token === token);
    if (!record || record.expiresAt < Date.now()) {
      return { status: 400, data: { message: 'This password reset link is invalid or has expired.' } };
    }

    const user = store.users.find((u) => u.id === record.userId);
    if (!user) {
      return { status: 404, data: { message: 'User account not found.' } };
    }

    user.passwordHash = hashPassword(newPassword);
    store.resetTokens = store.resetTokens.filter((t) => t.token !== token);
    writeAuthStore(store);

    return {
      status: 200,
      data: { message: 'Your password has been updated. You can now sign in.' },
    };
  }

  if (method === 'GET' && urlPath === '/api/auth/me') {
    const user = getAuthenticatedUser(authHeader);
    if (!user) {
      return { status: 401, data: { message: 'Unauthorized session.' } };
    }
    return { status: 200, data: { user: sanitizeUser(user) } };
  }

  if (method === 'POST' && urlPath === '/api/newsletter') {
    const email = String(body?.email || '').trim().toLowerCase();
    if (!emailRegex.test(email)) {
      return { status: 400, data: { message: 'Please enter a valid email address.' } };
    }
    const store = readAuthStore();
    if (!store.newsletter.includes(email)) {
      store.newsletter.push(email);
      writeAuthStore(store);
    }
    return {
      status: 200,
      data: { message: 'Subscribed to FormFlow product updates.' },
    };
  }

  return null;
}
