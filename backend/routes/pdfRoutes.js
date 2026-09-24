const express = require('express');
const { gerarPDF } = require('../controllers/pdfController');
const { autenticarToken } = require('../middlewares/authMiddleware');

const router = express.Router();

// POST /api/pdf -> gera o PDF com o resumo da conversa (só logado, usa a IA)
router.post('/', autenticarToken, gerarPDF);

module.exports = router;