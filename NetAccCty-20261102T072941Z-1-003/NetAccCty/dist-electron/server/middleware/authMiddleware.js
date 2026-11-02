"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.JWT_SECRET = void 0;
exports.generateToken = generateToken;
exports.authenticateToken = authenticateToken;
exports.requireRole = requireRole;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const database_1 = require("../db/database");
exports.JWT_SECRET = process.env.JWT_SECRET || 'zero-trust-secret-key-2026-production';
function generateToken(user) {
    return jsonwebtoken_1.default.sign({
        id: user.id,
        username: user.username,
        role: user.role,
        department: user.department,
        full_name: user.full_name,
    }, exports.JWT_SECRET, { expiresIn: '7d' });
}
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : req.query.token;
    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }
    jsonwebtoken_1.default.verify(token, exports.JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid or expired access token' });
        }
        const user = (0, database_1.getUserById)(decoded.id);
        if (!user || user.is_active === 0) {
            return res.status(403).json({ error: 'User account is deactivated or no longer exists' });
        }
        req.user = {
            id: user.id,
            username: user.username,
            role: user.role,
            department: user.department,
            full_name: user.full_name,
        };
        next();
    });
}
function requireRole(...allowedRoles) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthenticated' });
        }
        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({
                error: `Permission denied: Required role (${allowedRoles.join(', ')}), but current role is ${req.user.role}`,
            });
        }
        next();
    };
}
