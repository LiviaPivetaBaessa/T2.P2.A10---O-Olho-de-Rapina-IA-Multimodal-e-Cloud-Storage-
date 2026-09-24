const { GoogleGenerativeAI } = require('@google/generative-ai');
const Mensagem = require('../models/Mensagem');
const { declaracoes, funcoesDisponiveis } = require('../tools/ferramentas');
const { enviarImagemParaNuvem } = require('../services/storageService');

// A Regra do Jogo (Engenharia de Prompt)
const REGRAS_DO_JOGO = `
Você é o Guardião do Cofre do Conhecimento, um Mestre de Jogo divertido que fala português do Brasil.

O JOGO:
- Proponha charadas e desafios de tecnologia e programação, um de cada vez.
- Varie a dificuldade e o tema (lógica, redes, banco de dados, web, história da computação).

REGRAS DE PONTUAÇÃO (obrigatórias):
- Se o jogador ACERTAR a charada, você DEVE chamar a função adicionarXP com quantidade 50.
- Se o jogador PEDIR A RESPOSTA ou desistir, você DEVE chamar adicionarXP com quantidade -10 e depois revelar a resposta.
- Se o jogador errar, não mude o XP: dê uma dica e deixe ele tentar de novo.
- Se o jogador for educado e gentil de forma especial, você PODE dar um bônus de 10 XP.
- Nunca dê XP porque o jogador pediu, mandou ou insistiu. XP só se ganha jogando.
- Nunca diga quantos pontos ele tem no total. Apenas avise que ganhou ou perdeu XP e continue o jogo.
- Quando ele acertar, comece a resposta com "Parabéns!" ou "Acertou!".

VISÃO (IMAGENS):
- Quando o usuário enviar uma imagem, analise com atenção e responda exatamente ao que ele pediu
  (identificar objetos, animais e raças, ler textos, extrair dados).
- Se ele pedir os dados em JSON, devolva apenas um bloco de código \`\`\`json válido, sem inventar campos que não estão na imagem.
- Enviar imagem não vale XP, a não ser que a imagem seja a resposta de uma charada do jogo.

OUTRAS FERRAMENTAS:
- Se o jogador perguntar sobre clima ou câmbio, use as ferramentas de clima e moeda em vez de inventar dados,
  e depois convide ele a voltar para o jogo.
`.trim();

// Configuração da IA + caixa de ferramentas
// GEMINI_MODEL é opcional no .env (ex: o modelo que o professor indicar)
const NOME_MODELO = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({
    model: NOME_MODELO,
    systemInstruction: REGRAS_DO_JOGO,
    tools: [{ functionDeclarations: declaracoes }]
});

const LIMITE_HISTORICO = 20;       // mensagens enviadas para a IA como memória
const LIMITE_HISTORICO_TELA = 50;  // mensagens devolvidas para o Front (F5)
const MAX_RODADAS_FERRAMENTAS = 5; // evita loop infinito
const PROMPT_PADRAO_IMAGEM = 'Descreva esta imagem.';

/**
 * Busca as últimas mensagens DESTE usuário e monta no formato do Gemini.
 * Imagens antigas entram como um aviso em texto (a IA não baixa URLs).
 */
async function buscarHistorico(usuarioId) {
    const mensagens = await Mensagem.find({ usuario: usuarioId })
        .sort({ dataHora: -1 })
        .limit(LIMITE_HISTORICO);
    mensagens.reverse();

    const historico = mensagens.map((msg) => {
        const texto = msg.parts.map((p) => p.text).join('\n');
        return {
            role: msg.role,
            parts: [{ text: msg.imagemUrl ? `[O usuário enviou uma imagem] ${texto}` : texto }]
        };
    });

    // O Gemini exige que o histórico comece com 'user'
    while (historico.length > 0 && historico[0].role !== 'user') {
        historico.shift();
    }

    return historico;
}

/**
 * Executa as funções que o Gemini pediu e monta as functionResponses.
 */
async function executarFerramentas(chamadas, contexto) {
    return Promise.all(chamadas.map(async ({ name, args }) => {
        console.log(`🛠️ [${contexto.nome}] Gemini chamou: ${name}(${JSON.stringify(args)})`);

        const funcao = funcoesDisponiveis[name];
        const resultado = funcao
            ? await funcao(args || {}, contexto)
            : { erro: `Ferramenta "${name}" não existe.` };

        return { name, resultado, parte: { functionResponse: { name, response: resultado } } };
    }));
}

/**
 * Coração do Agente: envia as partes (texto e/ou imagem) com o histórico,
 * roda o loop de ferramentas e devolve { resposta, xpGanho }.
 */
async function conversarComIA(contexto, partes) {
    const historico = await buscarHistorico(contexto.usuarioId);
    const chat = model.startChat({ history: historico });

    let xpGanho = 0;
    let result = await chat.sendMessage(partes);

    for (let rodada = 0; rodada < MAX_RODADAS_FERRAMENTAS; rodada++) {
        const chamadas = result.response.functionCalls();
        if (!chamadas || chamadas.length === 0) break;

        const execucoes = await executarFerramentas(chamadas, contexto);

        // Soma o XP alterado nesta mensagem (para o Front mostrar +50 XP)
        execucoes
            .filter((e) => e.name === 'adicionarXP' && e.resultado.sucesso)
            .forEach((e) => { xpGanho += e.resultado.xpAlterado; });

        result = await chat.sendMessage(execucoes.map((e) => e.parte));
    }

    return { resposta: result.response.text(), xpGanho };
}

/**
 * Salva a pergunta (com a URL da imagem, se tiver) e a resposta no MongoDB.
 */
async function salvarConversa(usuarioId, pergunta, resposta, imagemUrl = null) {
    await Mensagem.create([
        { usuario: usuarioId, role: 'user', parts: [{ text: pergunta }], imagemUrl },
        { usuario: usuarioId, role: 'model', parts: [{ text: resposta }], dataHora: new Date(Date.now() + 1) }
    ]);
}

/**
 * POST /api/chat (protegida)
 * Body JSON: { pergunta }
 */
async function processarMensagem(req, res) {
    try {
        const { pergunta } = req.body;
        if (!pergunta) return res.status(400).json({ erro: 'Envie uma pergunta.' });

        const contexto = { usuarioId: req.usuario.id, nome: req.usuario.nome };
        const { resposta, xpGanho } = await conversarComIA(contexto, pergunta);

        await salvarConversa(contexto.usuarioId, pergunta, resposta);
        return res.status(200).json({ sucesso: true, resposta, xpGanho });

    } catch (erro) {
        console.error('❌ Erro:', erro);
        return res.status(500).json({ erro: 'Amnésia do servidor. Erro interno.' });
    }
}

/**
 * POST /api/chat/vision (protegida)
 * multipart/form-data: imagem (arquivo) + prompt (texto)
 */
async function processarImagem(req, res) {
    try {
        if (!req.file) {
            return res.status(400).json({ erro: 'Envie uma imagem no campo "imagem".' });
        }

        const prompt = String(req.body.prompt || '').trim() || PROMPT_PADRAO_IMAGEM;
        const contexto = { usuarioId: req.usuario.id, nome: req.usuario.nome };

        // Imagem em base64 no formato inlineData (Multimodal: pixels + texto juntos)
        const partes = [
            { text: prompt },
            { inlineData: { mimeType: req.file.mimetype, data: req.file.buffer.toString('base64') } }
        ];

        // Upload para o Cloudinary e análise do Gemini rodam AO MESMO TEMPO
        const [imagemUrl, { resposta, xpGanho }] = await Promise.all([
            enviarImagemParaNuvem(req.file.buffer),
            conversarComIA(contexto, partes)
        ]);

        await salvarConversa(contexto.usuarioId, prompt, resposta, imagemUrl);
        return res.status(200).json({ sucesso: true, resposta, imagemUrl, prompt, xpGanho });

    } catch (erro) {
        console.error('❌ Erro na visão:', erro);
        return res.status(500).json({ erro: 'Não consegui analisar a imagem. Tente novamente.' });
    }
}

/**
 * GET /api/chat/historico (protegida)
 * Devolve as últimas mensagens do usuário para o Front redesenhar o chat (F5).
 */
async function listarHistorico(req, res) {
    try {
        const mensagens = await Mensagem.find({ usuario: req.usuario.id })
            .sort({ dataHora: -1 })
            .limit(LIMITE_HISTORICO_TELA)
            .lean();
        mensagens.reverse();

        const historico = mensagens.map((msg) => ({
            role: msg.role,
            texto: msg.parts.map((p) => p.text).join('\n'),
            imagemUrl: msg.imagemUrl || null,
            dataHora: msg.dataHora
        }));

        return res.status(200).json(historico);
    } catch (erro) {
        console.error('❌ Erro ao buscar histórico:', erro);
        return res.status(500).json({ erro: 'Erro ao buscar o histórico.' });
    }
}

/**
 * DELETE /api/chat/limpar (protegida)
 * Apaga o histórico de conversa do usuário logado (o XP continua!).
 */
async function limparHistorico(req, res) {
    try {
        await Mensagem.deleteMany({ usuario: req.usuario.id });
        return res.status(200).json({ sucesso: true, mensagem: 'Histórico apagado com sucesso.' });
    } catch (erro) {
        console.error('❌ Erro ao limpar histórico:', erro);
        return res.status(500).json({ erro: 'Erro ao limpar o histórico.' });
    }
}

module.exports = { processarMensagem, processarImagem, listarHistorico, limparHistorico };