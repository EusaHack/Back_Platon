const express = require('express');
const cors = require('cors');
const fs = require("fs");
const path = require("path");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
const NodeCache = require("node-cache");
const app = express();
require('dotenv').config();
const axios = require('axios');
const { obtenerTokens,renovarAccessToken } = require('./zoho/auth');
const { obtenerUsuariosZoho,ValidateUsuarioZoho,ObtenerPsicologos,ObtenerClientes,ActualizarData } = require('./crud/DatosZoho');
const {transporter} = require('./email/send');
const rateLimit = require("express-rate-limit");
const handlebars = require("handlebars");

const corsOptions = {
  origin: "http://localhost:5173",  // Asegúrate de poner el origen correcto de tu frontend
  methods: ["GET", "POST", "PUT", "DELETE"], // Métodos permitidos
  allowedHeaders: ["Content-Type", "Authorization"], // Cabeceras permitidas
  credentials: true, // Permite el envío de cookies
};


// Middleware
app.use(cors(corsOptions)); // Permite solicitudes desde el frontend
app.use(express.json()); // Para manejar JSON en el body
app.use(bodyParser.json());
app.use(cookieParser());


const SECRET_KEY = "your-secret-key";
let ACCESS_TOKEN = '';
const imageCache = new NodeCache({ stdTTL: 3600 }); // Cache por 1 hora


// limitier para evitar ataques de fuerza bruta
const limiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora (en milisegundos)
  max: 5, // Limita a 5 solicitudes por IP en ese periodo
  message: "Demasiadas solicitudes, por favor inténtelo de nuevo más tarde.",
});

//Actualizacion de Token
const actualizarAccessToken = async () => {
  try {
      const refreshToken = process.env.REFRESH_TOKEN;
      const nuevoToken = await renovarAccessToken(refreshToken); // Obtiene nuevo token de Zoho
      ACCESS_TOKEN = nuevoToken.access_token; // Actualizar la variable global
  } catch (error) {
      console.error('Error al renovar el Access Token:', error);
  }
};
// Llamar la función de actualización cada 40 minutos
setInterval(actualizarAccessToken, 40 * 60 * 1000);
// Ejecutar una primera vez al iniciar el servidor
actualizarAccessToken();

// Obtener refresh token para actualizar el token
app.get('/oauth/callback', async (req, res) => {
    const code = req.query.code;

    if (!code) {
        return res.status(400).send('No se recibió ningún código');
    }

    try {
        // Llama a la función para obtener los tokens
        const tokens = await obtenerTokens(code);
        res.send('Tokens obtenidos correctamente. Revisa la consola para más detalles.');
    } catch (error) {
        res.status(500).send('Error al obtener los tokens');
    }
});



//ENDPOINTS PARA MANIPULAR LOS DATOS DE UN USUARIO 


// Endpoint para añadir datos de usuario  
app.post('/add-user-data', async (req, res) => {
  const data = req.body; // Datos enviados desde el frontend al backend.
  try {
    const response = await axios.post(
      ZOHO_API_URL_DATOS_USER_NEW,
      {
        data: [data], // Zoho espera un array de objetos para los datos.
      },
      {
        headers: {
          Authorization: `Zoho-oauthtoken ${ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
      }
    );
    if (response.data.result[0].code !== 3000) {
      console.log("error al añadir los datos del usuario",data);
      res.status(400).send({
        message: 'Error al añadir datos a Zoho Creator.',
        zohoResponse: response.data,
      });
    } else {
      console.log("se guardo correctamente los datos del usuario",data);
      res.status(200).send({
        message: 'Datos añadidos exitosamente a Zoho Creator.',
        zohoResponse: response.data,
      });
    }
  } catch (error) {
    console.error('Error al añadir datos:', error.response?.data || error.message);
    res.status(500).send({
      message: 'Error al añadir datos a Zoho Creator.',
      error: error.response?.data || error.message,
    });
  }
});
//Endpoint para validar si existe el usuario
app.post('/validate-user', async (req, res) => {
  const {Email} = req.body;
  try {
    const users = await ValidateUsuarioZoho(ZOHO_API_URL_DATOS_USER_DB_NEW, ACCESS_TOKEN, Email);
    if (users) {
      return res.status(200).send({ validate: true });
    }
    res.status(200).send({
      validate: false
    });
  } catch (error) {
    console.error('Error al validar usuario:', error.response?.data || error.message);
    res.status(500).send({
      message: 'Error al validar usuario.',
      error: error.response?.data || error.message,
      });
  }
});

// Endpoint para obtener el usuario
app.post('/obtener-datos-user', async (req, res) => {
  const { Email, Password } = req.body;
  try {
    // Obtener usuario desde Zoho
    const users = await obtenerUsuariosZoho(ZOHO_API_URL_DATOS_USER_DB_NEW, ACCESS_TOKEN, Email);
    
    if (!users || users.length === 0) {
      console.log(Email,"usuario no encontrado");
      return res.status(404).send({ message: "Usuario no encontrado" });
    }

    const user = users.data[0];

    if (user.Password !== Password) {
      console.log(Email,"contraseña incorrecta");
      return res.status(401).send({ message: "Contraseña incorrecta" });
    }

    // Enviar los datos del usuario en una cookie separada
    res.cookie("userData", JSON.stringify(user), {
      httpOnly: true, // Evita que los datos sean accesibles desde JavaScript
      secure: true, // process.env.NODE_ENV === "production" Solo en HTTPS en producción
      sameSite: "None", // process.env.NODE_ENV === "production" ? "strict" : "lax" Previene el envío de la cookie a otros dominios
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 días en milisegundos
    });

    
    // Generar token JWT
    const token = jwt.sign({ Email: user.Email}, SECRET_KEY, {
      expiresIn: "7d", // El token expira en 7 días
    });

    // Enviar token como una cookie segura (Secure y HttpOnly para producción)
    res.cookie("authToken", token, {
      httpOnly: true, // Evita que el token sea accesible desde JavaScript
      secure: true, // Solo en HTTPS en producción
      sameSite: "None", // Previene el envío de la cookie a otros dominios
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 días en milisegundos
    });
    
    res.status(200).json({
      message: "Inicio de sesión exitoso"
    });
    console.log(Email,"Inicio de sesión exitoso");
  } catch (error) {
    console.error("Error al verificar usuario:", error.message);
    res.status(500).send({
      message: "Error al verificar usuario",
      error: error.message,
    });
  }
});

// Ruta proxy para servir la imagen con encabezados adecuados
app.get("/proxy-image", async (req, res) => {
  const { filepath } = req.query;
  if (!filepath) {
    return res.status(400).send({ message: "El parámetro 'filepath' es obligatorio." });
  }
  
  // Asegúrate de que filepath ya tiene la ruta completa y el formato correcto
  const urlDominio = `https://creator.zoho.com`; 
  // Comprobamos que filepath tiene una parte de la URL adecuada
  const baseUrl = `${urlDominio}${filepath}`;


  // Verificar si la imagen ya está en caché
  const cachedImage = imageCache.get(baseUrl);
  if (cachedImage) {
    // Añadir encabezados para que el navegador también la guarde
    res.set("Content-Type", "image/jpeg"); // Ajusta según el tipo de imagen
    res.set("Cache-Control", "public, max-age=3600"); // Caché en navegador: 1 hora

    return res.send(cachedImage);
  }
  
  try {
    const response = await axios.get(baseUrl, {
      headers: {
        'Authorization': `Zoho-oauthtoken ${ACCESS_TOKEN}`, // Pasa el token de Zoho
      },
      responseType: "arraybuffer", // Para manejar el contenido binario de la imagen
    });

    // Guardar imagen en caché del servidor
    imageCache.set(filepath, response.data);

    // Configurar encabezados para caché en navegador
    res.set("Content-Type", response.headers["content-type"]);
    res.set("Cache-Control", "public, max-age=3600, must-revalidate"); 

    res.send(response.data);

  } catch (error) {
    console.error("Error al obtener la imagen:", error.message);
    res.status(500).send({ message: "Error al obtener la imagen." });
  }
});

// Ruta protegida (requiere autenticación)
app.get("/perfil", async (req, res) => {
  console.log("Cookies recibidas:", req.cookies);
  const token = req.cookies.authToken;
  const userData = req.cookies.userData ? JSON.parse(req.cookies.userData) : null;

  if (!token) {
    return res.status(401).json({ error: "No autorizado. Por favor, inicia sesión." });
  }

  try {
    // Verificar el token
    const decoded = jwt.verify(token, SECRET_KEY);
    res.status(200).json({ message: "Acceso permitido", data: { ...decoded, userData } });
  } catch (error) {
    res.status(401).json({ error: "Token inválido o expirado" });
  }
});

app.put('/update-user-data/:id', async (req, res) => {
  const { id } = req.params; // ID del usuario a actualizar
  const data = req.body; // Datos a actualizar
  try {
    const response = ActualizarData(ZOHO_API_URL_DATOS_USER_DB_NEW, ACCESS_TOKEN, data);
    if (response.status !== 200){
      res.status(400).send({
        message: 'Error al actualizar datos en Zoho Creator.',
        zohoResponse: response.data,
      });
    }

    res.status(200).send({
      message: 'Datos actualizados exitosamente en Zoho Creator.',
      zohoResponse: response.data,
    });

  } catch (error) {
    console.error('Error al actualizar datos:', error.response?.data || error.message);
    res.status(500).send({
      message: 'Error al actualizar datos en Zoho Creator.',
      error: error.response?.data || error.message,
    });
  }
});

//ENDPOINT PARA ENVIAR CORREO BIENEVENIDA Y INFORMACION DE SERVICIOS

app.post("/enviar-correo", async (req, res) => {
  const { Nombre, Email, Telefono, Empresa, Puesto} = req.body;

  // Ruta correcta al archivo HTML dentro de "templates"
  const templatePath = path.join(__dirname, "templates", "emailTemplate.html");

  // Leer el archivo HTML
  const templateSource = fs.readFileSync(templatePath, "utf8");
  
  // Compilar la plantilla con Handlebars
  const template = handlebars.compile(templateSource);
  
  // Definir los valores dinámicos
  const replacements = {
    MensajeBody: "¡Gracias por proporcionarnos tus datos de contacto. Hemos recibido tu información y nos pondremos en contacto contigo en breve!",
    Nombre,
    Email,
    Telefono,
    Empresa,
    Puesto,
  };

  // Generar el HTML final con los valores
  const emailTemplate = template(replacements);
  
  
  // Opciones del correo
  const mailOptions = {
      from: process.env.EMAIL_USER,
      to: "eusa510@gmail.com",
      subject: "Cotización solicitada – Servicio Empresarial",
      html: emailTemplate,
      attachments: [
            {
                filename: "logo-azul.png",
                path: path.join(__dirname, "templates","logo-azul.png"),
                cid: "logo_cid", // Coincide con el src="cid:logo_cid" en el HTML
            },
            {
              filename: "facebook.png",
              path: path.join(__dirname, "templates","facebook.png"),
              cid: "face_cid", // Coincide con el src="cid:logo_cid" en el HTML
            },
            {
              filename: "instagram.png",
              path: path.join(__dirname, "templates","instagram.png"),
              cid: "ins_cid", // Coincide con el src="cid:logo_cid" en el HTML
            },
            {
              filename: "tik-tok.png",
              path: path.join(__dirname, "templates","tik-tok.png"),
              cid: "tik_cid", // Coincide con el src="cid:logo_cid" en el HTML
            },

      ],
  };

  try {
      await transporter.sendMail(mailOptions);
      res.json({ success: true, message: "Correo enviado con éxito" });
  } catch (error) {
      res.json({ success: false, message: "Error al enviar el correo", error });
  }
});

// Ruta para solicitar restablecimiento de contraseña
app.post("/forgot-password", async (req, res) => {
  const { email } = req.body;
  const user = await obtenerUsuariosZoho(ZOHO_API_URL_DATOS_USER_DB_NEW, ACCESS_TOKEN, email);
  if (!user) {
    return res.status(404).json({ message: "Usuario no encontrado" });
  }

  // Generar token de recuperación con JWT
  const token = jwt.sign({ id : user.data[0].ID }, process.env.JWT_SECRET, { expiresIn: "1h" });

  // Enviar el enlace por correo
  const resetLink = `http://localhost:5173/reset-password/${token}`;
  await transporter.sendMail({
    to: email,
    subject: "Recuperación de contraseña",
    html: `<p>Haz clic en el siguiente enlace para cambiar tu contraseña:</p>
           <a href="${resetLink}">${resetLink}</a>`,
  });

  res.json({ message: "Correo enviado con instrucciones" });
});

app.post("/reset-verify/:token", limiter, async (req, res) => {
  const { token } = req.params;

  try {
    // Verificar el token
    jwt.verify(token, process.env.JWT_SECRET);
    console.log("Token válido");
    res.json({ message: "Token válido" });
  } catch (error) {
    console.log("Token inválido");
    res.status(400).json({ message: "Token inválido o expirado" });
  }
});

app.post("/reset-password", async (req, res) => {
  const { token, password } = req.body;

  try {
    // Verificar el token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    data = {
      "ID": decoded.id,
      "Password": password
    }
    ActualizarData(ZOHO_API_URL_DATOS_USER_DB_NEW, ACCESS_TOKEN, data);
    res.json({ message: "Contraseña cambiada con éxito" });
  } catch (error) {
    res.status(400).json({ message: "Token inválido o expirado" });
  }
});

//ENDPOINT PARA CERRAR SESION

app.post("/logout", (req, res) => {
  res.clearCookie("authToken", { path: "/", httpOnly: true, secure: true, sameSite: "None" });
  res.clearCookie("userData", { path: "/", httpOnly: true, secure: true, sameSite: "None" });
  console.log('secion cerrada')
  res.status(200).json({ message: "Sesión cerrada exitosamente" });
});


//ENDPOINTS PARA MANIPULAR LOS DATOS DE UN PSICOLOGO

app.get("/psicologos", async (req, res) => {
  try {
    const psicologos = await ObtenerPsicologos(ZOHO_API_URL_DATOS_PSICOLOGO_DB_NEW, ACCESS_TOKEN);
    res.status(200).json(psicologos);
  } catch (error) {
    console.error('Error al obtener psicólogos:', error.message);
    res.status(500).send({
      message: 'Error al obtener psicólogos.',
      error: error.message,
    });
  }
});


//pruebas


app.get("/pruebas", async (req, res) => {
  try {
    const pruebas = await ObtenerClientes(ZOHO_API_URL_DATOS_USER_DB_NEW, ACCESS_TOKEN);
    res.status(200).json(pruebas);
  } catch (error) {
    console.error('Error al obtener psicólogos:', error.message);
    res.status(500).send({
      message: 'Error al obtener psicólogos.',
      error: error.message,
    });
  }
});




// Puerto
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
