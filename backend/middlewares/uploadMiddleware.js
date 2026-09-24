const multer = require('multer');

const TAMANHO_MAXIMO_MB = 5;
// Formatos de imagem que o Gemini entende
const TIPOS_PERMITIDOS = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];

// memoryStorage: a imagem fica na RAM (req.file.buffer), nunca no disco do Render
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: TAMANHO_MAXIMO_MB * 1024 * 1024, files: 1 },
    fileFilter: (req, arquivo, callback) => {
        if (!TIPOS_PERMITIDOS.includes(arquivo.mimetype)) {
            return callback(new Error('TIPO_INVALIDO'));
        }
        callback(null, true);
    }
});

/**
 * Recebe UM arquivo no campo "imagem" e trata os erros
 * devolvendo 400 (Bad Request) com uma mensagem amigável.
 */
function receberImagem(req, res, next) {
    upload.single('imagem')(req, res, (erro) => {
        if (!erro) return next();

        if (erro.message === 'TIPO_INVALIDO') {
            return res.status(400).json({ erro: 'Formato não suportado. Envie uma imagem JPG, PNG ou WEBP.' });
        }
        if (erro.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ erro: `Imagem muito grande. O limite é ${TAMANHO_MAXIMO_MB} MB.` });
        }
        if (erro instanceof multer.MulterError) {
            return res.status(400).json({ erro: 'Envie apenas uma imagem no campo "imagem".' });
        }
        return next(erro);
    });
}

module.exports = { receberImagem, TAMANHO_MAXIMO_MB };