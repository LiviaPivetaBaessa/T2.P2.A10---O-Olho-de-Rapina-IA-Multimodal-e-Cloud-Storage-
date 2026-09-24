const Usuario = require('../models/Usuario');

const TOP = 10;

// Desafio Hacker (Sprint 2): título dinâmico de acordo com o XP
function definirTitulo(xp) {
    if (xp >= 500) return 'Lenda';
    if (xp >= 100) return 'Aventureiro';
    return 'Novato';
}

/**
 * GET /api/ranking (protegida)
 * Top 10 usuários, do maior XP para o menor.
 * Não devolve e-mail nem id de ninguém, só nome e XP.
 */
async function listarRanking(req, res) {
    try {
        const usuarios = await Usuario.find({ xp: { $gt: 0 } })
            .sort({ xp: -1, updatedAt: 1 }) // empate: quem chegou primeiro fica na frente
            .limit(TOP)
            .select('nome xp')
            .lean();

        const ranking = usuarios.map((u, i) => {
            const titulo = definirTitulo(u.xp);
            return {
                posicao: i + 1,
                nome: u.nome,
                titulo,
                nomeExibicao: `${titulo}: ${u.nome}`,
                xp: u.xp,
                voce: u._id.toString() === req.usuario.id // destaca o usuário logado
            };
        });

        return res.status(200).json(ranking);
    } catch (erro) {
        console.error('❌ Erro ao buscar ranking:', erro);
        return res.status(500).json({ erro: 'Erro ao buscar o ranking.' });
    }
}

module.exports = { listarRanking };