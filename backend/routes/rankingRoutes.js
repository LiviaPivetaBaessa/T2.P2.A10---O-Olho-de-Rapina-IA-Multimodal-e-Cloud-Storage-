const express = require('express');
const { listarRanking } = require('../controllers/rankingController');
const { autenticarToken } = require('../middlewares/authMiddleware');

const router = express.Router();

// GET /api/ranking -> Top 10 jogadores por XP (só logado)
router.get('/', autenticarToken, listarRanking);

module.exports = router;