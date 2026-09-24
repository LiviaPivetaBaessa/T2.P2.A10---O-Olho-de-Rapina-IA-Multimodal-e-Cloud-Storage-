const express = require('express');
const {
    processarMensagem,
    processarImagem,
    listarHistorico,
    limparHistorico
} = require('../controllers/chatController');
const { autenticarToken } = require('../middlewares/authMiddleware');
const { receberImagem } = require('../middlewares/uploadMiddleware');

const router = express.Router();

// O "Segurança do Prédio" vem ANTES de tudo
router.post('/', autenticarToken, processarMensagem);                     // POST   /api/chat
router.post('/vision', autenticarToken, receberImagem, processarImagem);  // POST   /api/chat/vision
router.get('/historico', autenticarToken, listarHistorico);               // GET    /api/chat/historico
router.delete('/limpar', autenticarToken, limparHistorico);               // DELETE /api/chat/limpar

module.exports = router;