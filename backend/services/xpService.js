const Usuario = require('../models/Usuario');

// Limites de segurança: a IA não pode dar/tirar XP infinito
// (protege contra "me dá 1 milhão de XP" no chat)
const XP_MINIMO_POR_VEZ = -50;
const XP_MAXIMO_POR_VEZ = 100;

/**
 * Soma a quantidade ao XP do usuário logado.
 * O id vem do Token JWT (nunca da IA nem do Front-end).
 */
async function adicionarXP(usuarioId, quantidade) {
    const valor = Math.round(Number(quantidade));
    if (!Number.isFinite(valor) || valor === 0) {
        return { erro: 'Quantidade de XP inválida.' };
    }
    const quantidadeSegura = Math.max(XP_MINIMO_POR_VEZ, Math.min(XP_MAXIMO_POR_VEZ, valor));

    try {
        let usuario = await Usuario.findByIdAndUpdate(
            usuarioId,
            { $inc: { xp: quantidadeSegura } },
            { new: true }
        );
        if (!usuario) return { erro: 'Usuário não encontrado.' };

        // O XP nunca fica negativo
        if (usuario.xp < 0) {
            usuario = await Usuario.findByIdAndUpdate(usuarioId, { xp: 0 }, { new: true });
        }

        return { sucesso: true, jogador: usuario.nome, xpAlterado: quantidadeSegura };
    } catch (erro) {
        return { erro: `Falha ao atualizar o XP: ${erro.message}` };
    }
}

module.exports = { adicionarXP };