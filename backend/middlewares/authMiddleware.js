const jwt = require('jsonwebtoken');

/**
 * "Segurança do Prédio": só deixa passar quem tem um crachá (JWT) válido.
 * Espera o header -> Authorization: Bearer <TOKEN>
 */
function autenticarToken(req, res, next) {
    const header = req.headers.authorization || '';
    const [tipo, token] = header.split(' ');

    if (tipo !== 'Bearer' || !token) {
        return res.status(401).json({ erro: 'Acesso negado. Faça login para continuar.' });
    }

    try {
        const dados = jwt.verify(token, process.env.JWT_SECRET);
        req.usuario = { id: dados.id, nome: dados.nome }; // quem está falando
        return next();
    } catch (erro) {
        return res.status(401).json({ erro: 'Sessão inválida ou expirada. Faça login novamente.' });
    }
}

module.exports = { autenticarToken };