require('dotenv').config();
const axios = require('axios');

async function obtenerTokens(code) {
    try {
        const response = await axios.post('https://accounts.zoho.com/oauth/v2/token', null, {
            params: {
                code: code,
                client_id: process.env.ZOHO_CLIENT_ID,
                client_secret: process.env.ZOHO_CLIENT_SECRET,
                redirect_uri: 'http://127.0.0.1:5000/oauth/callback',
                grant_type: 'authorization_code',
            },
        });

        const { access_token, refresh_token, expires_in } = response.data;

        console.log('Access Token:', access_token);
        console.log('Refresh Token:', refresh_token);
        console.log(`Access Token Expira en: ${expires_in} segundos`);

        // Guarda estos tokens en tu base de datos o sistema seguro
    } catch (error) {
        console.error('Error al obtener el token:', error.response.data);
    }
}

// Función para renovar el Access Token
async function renovarAccessToken(refreshToken) {
    try {
        const response = await axios.post('https://accounts.zoho.com/oauth/v2/token', null, {
            params: {
                refresh_token: refreshToken,
                client_id: process.env.ZOHO_CLIENT_ID,
                client_secret: process.env.ZOHO_CLIENT_SECRET,
                grant_type: 'refresh_token',
            },
        });

        const { access_token, expires_in } = response.data;

        console.log('Nuevo Access Token:', access_token);
        console.log(`Access Token Expira en: ${expires_in} segundos`);

        return { access_token, expires_in };
    } catch (error) {
        console.error('Error al renovar el token:', error.response?.data || error.message);
        throw error;
    }
}


module.exports = { obtenerTokens,renovarAccessToken};