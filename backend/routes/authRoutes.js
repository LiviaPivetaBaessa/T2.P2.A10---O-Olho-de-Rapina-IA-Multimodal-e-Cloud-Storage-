const express = require('express');
const { registrar, login, perfil } = require('../controllers/authController');
const { autenticarToken } = require('../middlewares/authMiddleware');

const router = express.Router();

// Públicas
router.post('/register', registrar); // POST /api/auth/register
router.post('/login', login);        // POST /api/auth/login

// Protegida
router.get('/perfil', autenticarToken, perfil); // GET /api/auth/perfil

module.exports = router;