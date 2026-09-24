const jwt = require('jsonwebtoken');
const Usuario = require('../models/Usuario');

const VALIDADE_TOKEN = '7d'; // o crachá vale 7 dias
const SENHA_MINIMA = 6;
const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function gerarToken(usuario) {
    return jwt.sign(
        { id: usuario._id.toString(), nome: usuario.nome },
        process.env.JWT_SECRET,
        { expiresIn: VALIDADE_TOKEN }
    );
}

/**
 * POST /api/auth/register
 * Body: { nome, email, senha }
 */
async function registrar(req, res) {
    try {
        const nome = String(req.body.nome || '').trim();
        const email = String(req.body.email || '').trim().toLowerCase();
        const senha = String(req.body.senha || '');

        if (nome.length < 2 || nome.length > 20) {
            return res.status(400).json({ erro: 'O nome precisa ter de 2 a 20 caracteres.' });
        }
        if (!REGEX_EMAIL.test(email)) {
            return res.status(400).json({ erro: 'E-mail inválido.' });
        }
        if (senha.length < SENHA_MINIMA) {
            return res.status(400).json({ erro: `A senha precisa ter pelo menos ${SENHA_MINIMA} caracteres.` });
        }

        // Verifica se o e-mail já existe
        const existe = await Usuario.findOne({ email });
        if (existe) {
            return res.status(409).json({ erro: 'Este e-mail já está cadastrado.' });
        }

        // A senha é criptografada com bcrypt.hash() no pre('save') do models/Usuario.js
        await Usuario.create({ nome, email, senha });

        return res.status(201).json({ sucesso: true, mensagem: 'Cadastro realizado! Agora faça login.' });

    } catch (erro) {
        console.error('❌ Erro no cadastro:', erro);
        return res.status(500).json({ erro: 'Erro ao cadastrar usuário.' });
    }
}

/**
 * POST /api/auth/login
 * Body: { email, senha } -> { token, nome }
 */
async function login(req, res) {
    try {
        const email = String(req.body.email || '').trim().toLowerCase();
        const senha = String(req.body.senha || '');

        if (!email || !senha) {
            return res.status(400).json({ erro: 'Informe e-mail e senha.' });
        }

        // +senha: pede o campo que fica escondido por padrão (select: false)
        const usuario = await Usuario.findOne({ email }).select('+senha');

        // Mesma mensagem nos dois casos: não revela se o e-mail existe
        if (!usuario || !(await usuario.compararSenha(senha))) {
            return res.status(401).json({ erro: 'E-mail ou senha inválidos.' });
        }

        const token = gerarToken(usuario);
        return res.status(200).json({ sucesso: true, token, nome: usuario.nome });

    } catch (erro) {
        console.error('❌ Erro no login:', erro);
        return res.status(500).json({ erro: 'Erro ao fazer login.' });
    }
}

/**
 * GET /api/auth/perfil (protegida)
 * Usada pelo Front para confirmar se o token salvo ainda vale (F5).
 */
async function perfil(req, res) {
    try {
        const usuario = await Usuario.findById(req.usuario.id).select('nome email xp');
        if (!usuario) return res.status(401).json({ erro: 'Usuário não encontrado.' });

        return res.status(200).json({ nome: usuario.nome, email: usuario.email, xp: usuario.xp });
    } catch (erro) {
        console.error('❌ Erro no perfil:', erro);
        return res.status(500).json({ erro: 'Erro ao buscar perfil.' });
    }
}

module.exports = { registrar, login, perfil };