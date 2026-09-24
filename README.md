# 👁️ Mestre do Jogo — IA Multimodal e Cloud Storage

API de um **Mestre de Jogo** com **Google Gemini**, agora como um **SaaS seguro**: só usuários cadastrados e logados (senha com **bcrypt** + token **JWT**) conseguem jogar e ver o ranking. Agora o agente também **enxerga imagens** (Gemini Vision): o usuário anexa uma foto, ela vai para o **Cloudinary** (Object Storage) e a IA analisa pixels + texto ao mesmo tempo.

A IA propõe charadas de tecnologia e, sozinha, chama a função `adicionarXP` para premiar ou penalizar o jogador. O XP fica salvo no usuário, no **MongoDB Atlas**, e aparece num **Ranking Global (Top 10)**. O agente também mantém as ferramentas de **clima** (OpenWeatherMap) e **moedas** (AwesomeAPI).

Projeto da disciplina **Serviços em Nuvem** — IFPR Campus Assis Chateaubriand.

## 🧠 Como funciona o Function Calling

```
Usuário pergunta
      ↓
Gemini decide: responder direto OU pedir uma ferramenta (functionCall)
      ↓                                   ↓
Resposta em texto          Servidor executa a função local (clima / moeda)
                                          ↓
                           Servidor devolve o resultado (functionResponse)
                                          ↓
                           Gemini formula a resposta final
```

## 🛠️ Ferramentas do Agente

| Ferramenta | O que faz | API |
|---|---|---|
| `buscarClimaTempoReal(cidade)` | Temperatura, sensação térmica e descrição do clima atual | OpenWeatherMap |
| `converterMoeda(valor, moedaOrigem, moedaDestino)` | Converte valores com a cotação atual | AwesomeAPI |
| `adicionarXP(quantidade)` | Soma ou tira XP do usuário logado (limite de -50 a +100 por vez) | MongoDB (`$inc`) |

> 🔒 O jogador **não** é parâmetro da IA: o servidor pega o usuário de dentro do **Token JWT**, então ninguém consegue jogar ou pontuar no lugar de outra pessoa.

## 🔐 Segurança

```
Cadastro  → senha criptografada com bcrypt ($2a$10$...) → MongoDB
Login     → bcrypt.compare() → jwt.sign({ id, nome }) → Token (7 dias)
Front-end → localStorage('token_saas') → Header: Authorization: Bearer <token>
Back-end  → autenticarToken (middleware) → jwt.verify() → req.usuario → rota
             ↳ sem token ou token inválido → 401 Unauthorized
```

## 👁️ Visão Multimodal (Olho de Rapina)

```
Front (FormData: imagem + prompt + Bearer Token)
      ↓
autenticarToken → multer.memoryStorage() (imagem só na RAM, nunca no disco do Render)
      ↓                                   ↓   (ao mesmo tempo)
Cloudinary (upload_stream)        Gemini (texto + inlineData base64)
      ↓                                   ↓
URL segura (https)                Resposta da IA
      └──────────────┬────────────────────┘
               MongoDB (pergunta + imagemUrl + resposta)
                     ↓
      Front mostra a imagem pela URL do Cloudinary
```

| Por que Cloudinary e não MongoDB? | |
|---|---|
| MongoDB | Guarda só a **URL** (texto leve) |
| Cloudinary | Guarda o **arquivo binário** (Object Storage feito para mídia) |
| Render | Apaga arquivos locais ao reiniciar → por isso nada é salvo no disco |

**Regras de upload:** JPG, PNG, WEBP (ou HEIC) · até **5 MB** · outros formatos ou arquivos maiores → `400 Bad Request`.

## 🎮 Regras do Jogo

| Ação do jogador | XP |
|---|---|
| Acertou a charada | **+50** |
| Pediu a resposta / desistiu | **-10** |
| Foi especialmente educado | **+10** (bônus) |

**Títulos no ranking:** Novato (< 100 XP) · Aventureiro (100–499) · Lenda (≥ 500)

## 📁 Estrutura

```
├── controllers/
│   ├── authController.js   # Cadastro, login e perfil
│   ├── chatController.js   # Regras do jogo + loop de ferramentas
│   ├── rankingController.js# Top 10 + títulos dinâmicos
│   └── pdfController.js    # Gera o PDF com o resumo da conversa
├── models/
│   ├── Mensagem.js         # Histórico por usuário (+ imagemUrl)
│   └── Usuario.js          # nome, email (único), senha (bcrypt), xp
├── middlewares/
│   ├── authMiddleware.js   # autenticarToken (JWT)
│   └── uploadMiddleware.js # multer (memoryStorage) + erros 400
├── routes/
│   ├── authRoutes.js       # /api/auth
│   ├── chatRoutes.js       # /api/chat
│   ├── pdfRoutes.js        # /api/pdf
│   └── rankingRoutes.js    # /api/ranking
├── services/
│   ├── climaService.js     # Chamada à OpenWeatherMap
│   ├── moedaService.js     # Chamada à AwesomeAPI
│   ├── storageService.js   # Upload para o Cloudinary
│   └── xpService.js        # adicionarXP (MongoDB)
├── tools/
│   └── ferramentas.js      # Declarações (JSON Schema) + mapa de funções
├── .env.example
├── package.json
└── server.js
```

## 🔌 Rotas

| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| POST | `/api/auth/register` | Pública | `{ nome, email, senha }` → cria a conta |
| POST | `/api/auth/login` | Pública | `{ email, senha }` → `{ token, nome }` |
| GET | `/api/auth/perfil` | 🔒 Token | Nome, e-mail e XP do usuário logado |
| POST | `/api/chat` | 🔒 Token | `{ pergunta }` → `{ resposta, xpGanho }` |
| POST | `/api/chat/vision` | 🔒 Token | `multipart/form-data`: `imagem` + `prompt` → `{ resposta, imagemUrl }` |
| GET | `/api/chat/historico` | 🔒 Token | Últimas 50 mensagens (com as imagens) para redesenhar o chat |
| DELETE | `/api/chat/limpar` | 🔒 Token | Apaga o histórico do usuário (o XP continua) |
| GET | `/api/ranking` | 🔒 Token | Top 10 por XP, com título |
| POST | `/api/pdf` | 🔒 Token | `{ historico }` → PDF com o resumo |

## ▶️ Como rodar

1. `npm install`
2. Copie `.env.example` para `.env` e preencha:
   - `GEMINI_API_KEY` → https://aistudio.google.com/apikey
   - `MONGO_URI` → MongoDB Atlas (Connect → Drivers)
   - `WEATHER_API_KEY` → https://home.openweathermap.org/api_keys
   - `JWT_SECRET` → invente um texto longo e difícil (é a "chave" que assina os tokens)
   - `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` → painel do https://cloudinary.com
   - `GEMINI_MODEL` (opcional) → modelo do Gemini; o padrão é `gemini-2.5-flash`
3. `npm start` → `http://localhost:3000`

## 🧪 Testes de aceite

| Teste | Comportamento esperado |
|---|---|
| Foto de um cachorro + "Que raça de cachorro é essa?" | A IA identifica a raça |
| Painel do Cloudinary → pasta `olho-de-rapina` | A imagem aparece lá |
| F5 na página | O histórico volta do MongoDB com as imagens renderizadas |
| Enviar PDF ou imagem > 5 MB | `400 Bad Request` com mensagem amigável |
| 🚀 Desafio: foto de cupom fiscal + "Extraia os dados... em JSON" | A IA devolve `{ "Nome do Mercado", "Data", "Valor Total" }` |
| Rotas sem Token | `401 Unauthorized` |

## 🛠️ Tecnologias

Node.js · Express · Multer · Cloudinary · Gemini Vision · bcryptjs · JSON Web Token · Mongoose · MongoDB Atlas · Google Gemini (Function Calling) · canvas-confetti · OpenWeatherMap · AwesomeAPI · PDFKit