const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const RODADAS_BCRYPT = 10; // custo da criptografia (gera o "$2a$10$..." no banco)

const UsuarioSchema = new mongoose.Schema({
    nome: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    senha: { type: String, required: true, select: false }, // nunca vem nas buscas, só se pedir
    xp: { type: Number, default: 0 } // pontos do jogo (Sprint 2)
}, { timestamps: true });

// Antes de salvar: criptografa a senha (só se ela foi criada ou alterada)
UsuarioSchema.pre('save', async function () {
    if (!this.isModified('senha')) return;
    this.senha = await bcrypt.hash(this.senha, RODADAS_BCRYPT);
});

// Compara a senha digitada com a senha criptografada do banco
UsuarioSchema.methods.compararSenha = function (senhaDigitada) {
    return bcrypt.compare(senhaDigitada, this.senha);
};

const Usuario = mongoose.model('Usuario', UsuarioSchema, 'usuarios');

module.exports = Usuario;