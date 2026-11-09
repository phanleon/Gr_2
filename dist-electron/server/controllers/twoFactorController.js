"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.get2FaStatus = get2FaStatus;
exports.setup2Fa = setup2Fa;
exports.verifyAndEnable2Fa = verifyAndEnable2Fa;
exports.disable2Fa = disable2Fa;
exports.authenticate2Fa = authenticate2Fa;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const authMiddleware_1 = require("../middleware/authMiddleware");
const database_1 = require("../db/database");
const totp_1 = require("../utils/totp");
const auditLogger_1 = require("../middleware/auditLogger");
async function get2FaStatus(req, res) {
    try {
        const user = req.user;
        const data = (0, database_1.getUser2FaData)(user.id);
        res.json({
            success: true,
            enabled: data?.two_factor_enabled === 1,
        });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
}
async function setup2Fa(req, res) {
    try {
        const user = req.user;
        const secret = (0, totp_1.generateBase32Secret)(20);
        const recoveryCodes = (0, totp_1.generateRecoveryCodes)(8);
        // Save pending secret
        (0, database_1.setUser2FaSecret)(user.id, secret, recoveryCodes);
        const otpauthUrl = `otpauth://totp/SecureWorkspace:${encodeURIComponent(user.username)}?secret=${secret}&issuer=SecureWorkspace`;
        (0, auditLogger_1.logActivity)({ id: user.id, username: user.username, role: user.role }, '2FA_SETUP_INITIATED', { username: user.username });
        res.json({
            success: true,
            secret,
            otpauthUrl,
            recoveryCodes,
        });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
}
async function verifyAndEnable2Fa(req, res) {
    try {
        const user = req.user;
        const { code } = req.body;
        if (!code) {
            return res.status(400).json({ error: 'Mã xác thực 6 số là bắt buộc' });
        }
        const data = (0, database_1.getUser2FaData)(user.id);
        if (!data || !data.two_factor_secret) {
            return res.status(400).json({ error: 'Chưa khởi tạo cấu hình 2FA' });
        }
        const isValid = (0, totp_1.verifyTotp)(data.two_factor_secret, String(code));
        if (!isValid) {
            return res.status(400).json({ error: 'Mã xác thực 6 số không chính xác hoặc đã hết hạn' });
        }
        (0, database_1.enableUser2Fa)(user.id);
        (0, auditLogger_1.logActivity)({ id: user.id, username: user.username, role: user.role }, '2FA_ENABLED', { username: user.username });
        res.json({
            success: true,
            message: 'Đã kích hoạt xác thực 2 bước (2FA) thành công!',
        });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
}
async function disable2Fa(req, res) {
    try {
        const user = req.user;
        const { password } = req.body;
        if (!password) {
            return res.status(400).json({ error: 'Vui lòng nhập mật khẩu tài khoản để xác nhận tắt 2FA' });
        }
        const fullUser = (0, database_1.getUserWithPassword)(user.id);
        if (!fullUser || !bcryptjs_1.default.compareSync(password, fullUser.password_hash)) {
            return res.status(401).json({ error: 'Mật khẩu không chính xác' });
        }
        (0, database_1.disableUser2Fa)(user.id);
        (0, auditLogger_1.logActivity)({ id: user.id, username: user.username, role: user.role }, '2FA_DISABLED', { username: user.username });
        res.json({
            success: true,
            message: 'Đã hủy kích hoạt xác thực 2 bước',
        });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
}
async function authenticate2Fa(req, res) {
    try {
        const { tempToken, code } = req.body;
        if (!tempToken || !code) {
            return res.status(400).json({ error: 'Mã tạm thời và mã xác thực 2FA là bắt buộc' });
        }
        let decoded;
        try {
            decoded = jsonwebtoken_1.default.verify(tempToken, authMiddleware_1.JWT_SECRET);
        }
        catch (e) {
            return res.status(401).json({ error: 'Phiên xác thực 2FA đã hết hạn, vui lòng đăng nhập lại' });
        }
        if (!decoded.is2FaTemp || !decoded.id) {
            return res.status(401).json({ error: 'Mã xác thực không hợp lệ' });
        }
        const user = (0, database_1.getUserById)(decoded.id);
        if (!user || user.is_active === 0) {
            return res.status(403).json({ error: 'Tài khoản không hợp lệ hoặc đã bị khóa' });
        }
        const requestedEdition = (req.headers['x-app-edition'] || '').toUpperCase();
        if (requestedEdition === 'SERVER' && user.role !== 'SERVER_ADMIN') {
            return res.status(403).json({
                error: 'BẢN MÁY CHỦ (SERVER EDITION) chỉ cho phép tài khoản Quản trị viên (SERVER_ADMIN) đăng nhập. Vui lòng sử dụng Bản Client (Client Edition) để đăng nhập.'
            });
        }
        const twoFaData = (0, database_1.getUser2FaData)(user.id);
        if (!twoFaData || twoFaData.two_factor_enabled !== 1) {
            // If 2FA is not enabled, directly issue token
            const token = (0, authMiddleware_1.generateToken)(user);
            return res.json({ token, user });
        }
        const cleanCode = String(code).trim();
        let isSuccess = false;
        // Check TOTP 6-digit code
        if (cleanCode.length === 6 && /^\d+$/.test(cleanCode)) {
            isSuccess = (0, totp_1.verifyTotp)(twoFaData.two_factor_secret, cleanCode);
        }
        // If failed, check if it's a backup recovery code (format XXX-XXX or 8 chars)
        if (!isSuccess && cleanCode.includes('-')) {
            isSuccess = (0, database_1.consumeRecoveryCode)(user.id, cleanCode);
        }
        if (!isSuccess) {
            (0, auditLogger_1.logActivity)({ id: user.id, username: user.username, role: user.role }, '2FA_VERIFY_FAILED', { codeEntered: cleanCode.slice(0, 3) + '***' }, req.ip, 'MEDIUM');
            return res.status(401).json({ error: 'Mã xác thực 2FA hoặc mã khôi phục không chính xác' });
        }
        const token = (0, authMiddleware_1.generateToken)(user);
        (0, auditLogger_1.logActivity)({ id: user.id, username: user.username, role: user.role }, 'LOGIN_SUCCESS_2FA', { role: user.role }, req.ip, 'LOW');
        res.json({
            token,
            user: {
                id: user.id,
                username: user.username,
                full_name: user.full_name,
                role: user.role,
                department: user.department,
                created_at: user.created_at,
            },
        });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
}
