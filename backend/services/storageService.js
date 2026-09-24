const cloudinary = require('cloudinary').v2;

// Credenciais do "Disco Virtual" (vêm do .env / Render)
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true
});

const PASTA = 'olho-de-rapina';

/**
 * Envia o Buffer (imagem na memória RAM) direto para o Cloudinary.
 * Nada é salvo no disco do Render.
 * Retorna a URL segura (https) da imagem.
 */
function enviarImagemParaNuvem(buffer) {
    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            { folder: PASTA, resource_type: 'image' },
            (erro, resultado) => {
                if (erro) return reject(erro);
                resolve(resultado.secure_url);
            }
        );
        stream.end(buffer);
    });
}

module.exports = { enviarImagemParaNuvem };