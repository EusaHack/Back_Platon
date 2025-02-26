require('dotenv').config();
const axios = require('axios');



const obtenerUsuariosZoho = async (ZOHO_API_URL, ZOHO_AUTH_TOKEN, email) => {
  try {
    const response = await axios.get(`${ZOHO_API_URL}?Email=${email}`, {
      headers: {
        Authorization: `Zoho-oauthtoken ${ZOHO_AUTH_TOKEN}`,
      },
    });
    return response.data;
  } catch (error) {
    console.error('Error al obtener datos de Zoho Creator:', error.response ? error.response.data : error.message);
    return false;
  }
};

const ValidateUsuarioZoho = async (ZOHO_API_URL, ZOHO_AUTH_TOKEN, email) => {
  try {
    const response = await axios.get(`${ZOHO_API_URL}?Email=${email}`, {
      headers: {
        Authorization: `Zoho-oauthtoken ${ZOHO_AUTH_TOKEN}`,
      },
    });
    // Si se encuentran datos asociados al email, retorna true
    return response.data.data.length > 0;
  } catch (error) {
    // Loguear el error pero retornar false en vez de lanzar una excepción
    return false;
  }
};

const ObtenerPsicologos = async (ZOHO_API_URL,ZOHO_AUTH_TOKEN) =>{
  try{
    const response = await axios.get(ZOHO_API_URL, {
      headers: {
        Authorization: `Zoho-oauthtoken ${ZOHO_AUTH_TOKEN}`,
      },
    });
    return response.data;
  }catch (error){
    console.error('Error al obtener datos de Zoho Creator:', error.response ? error.response.data : error.message);
    throw new Error('No se pudieron obtener los datos de Zoho Creator.');
  }
};

const ObtenerClientes = async (ZOHO_API_URL,ZOHO_AUTH_TOKEN) =>{
  try{
    const response = await axios.get(ZOHO_API_URL, {
      headers: {
        Authorization: `Zoho-oauthtoken ${ZOHO_AUTH_TOKEN}`,
      },
    });
    return response.data;
  }catch (error){
    console.error('Error al obtener datos de Zoho Creator:', error.response ? error.response.data : error.message);
    throw new Error('No se pudieron obtener los datos de Zoho Creator.');
  }
};


const ActualizarData = async (ZOHO_API_URL_DATOS_USER_DB_NEW,ACCESS_TOKEN, data) => {
  try {

    const payload = { ...data };

    const response = await axios.put(
      `${ZOHO_API_URL_DATOS_USER_DB_NEW}/${payload.ID}`, // Zoho necesita el ID en la URL
      {
        data: [payload], // Enviar los datos en formato de array
      },
      {
        headers: {
          Authorization: `Zoho-oauthtoken ${ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
      }
    );
    return response.data;
  } catch (error) {
    console.error('Error al actualizar la contraseña en Zoho Creator:', error.response ? error.response.data : error.message);
    throw new Error('No se pudo actualizar la contraseña en Zoho Creator.');
  }
};


//funiciones que no se utilizan 
const obtenerDatosZoho = async (ZOHO_API_URL,ZOHO_AUTH_TOKEN) => {
  try {
    const response = await axios.get(ZOHO_API_URL, {
      headers: {
        Authorization: `Zoho-oauthtoken ${ZOHO_AUTH_TOKEN}`,
      },
    });
    return response.data;
  } catch (error) {
    console.error('Error al obtener datos de Zoho Creator:', error.response ? error.response.data : error.message);
    throw new Error('No se pudieron obtener los datos de Zoho Creator.');
  }
};


module.exports = { obtenerUsuariosZoho,ValidateUsuarioZoho,ObtenerPsicologos,ObtenerClientes,ActualizarData};
