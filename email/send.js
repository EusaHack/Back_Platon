require('dotenv').config();
const nodemailer = require("nodemailer");
const fs = require("fs");
const path = require("path");
const handlebars = require("handlebars");
const jwt = require("jsonwebtoken");


// Ruta correcta al archivo HTML dentro de "templates"
const templatePath = path.join(__dirname, "../templates", "emailTemplate.html");
// Leer el archivo HTML
const templateSource = fs.readFileSync(templatePath, "utf8");
// Compilar la plantilla con Handlebars
const template = handlebars.compile(templateSource);
// Imagenes Logos
const logoRedes = [
            {
                filename: "logo-azul.png",
                path: path.join(__dirname, "../templates","logo-azul.png"),
                cid: "logo_cid", // Coincide con el src="cid:logo_cid" en el HTML
            },
            {
              filename: "facebook.png",
              path: path.join(__dirname, "../templates","facebook.png"),
              cid: "face_cid", // Coincide con el src="cid:logo_cid" en el HTML
            },
            {
              filename: "instagram.png",
              path: path.join(__dirname, "../templates","instagram.png"),
              cid: "ins_cid", // Coincide con el src="cid:logo_cid" en el HTML
            },
            {
              filename: "tik-tok.png",
              path: path.join(__dirname, "../templates","tik-tok.png"),
              cid: "tik_cid", // Coincide con el src="cid:logo_cid" en el HTML
            },

      ]


// Configuración de Nodemailer
const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
      },
});

const sendEmailInfo = async (Nombre, Email, Telefono, Empresa, Puesto) => {
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
        to: [Email,"eusacrafter@gmail.com"],
        subject: "Cotización solicitada – Servicio Empresarial",
        html: emailTemplate,
        attachments: logoRedes,
    };

    try {
        await transporter.sendMail(mailOptions);
        return { success: true, message: "Correo enviado con éxito" };
    } catch (error) {
        return { success: false, message: "Error al enviar el correo", error };
    }
};

const sendEmailContraseña = async (email,user) => {
    // Generar token de recuperación con JWT
    const token = jwt.sign({ id: user.data[0].ID }, process.env.JWT_SECRET, { expiresIn: "1h" });
    // Enviar el enlace por correo
    const resetLink = `http://localhost:5173/reset-password/${token}`;

    const replacements = {
        MensajeBody: "Hemos recibido una solicitud para restablecer tu contraseña. Para continuar, haz clic en el siguiente enlace:",
        resetLink,
    };

    // Generar el HTML final con los valores
    const emailTemplate = template(replacements);

    // Opciones del correo
    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: "Recuperación de contraseña",
        html: emailTemplate,
        attachments: logoRedes,
    };

    try {
        await transporter.sendMail(mailOptions);
        return { success: true, message: "Correo enviado con éxito" };
    } catch (error) {
        return { success: false, message: "Error al enviar el correo", error };
    }
};




module.exports = {transporter,sendEmailInfo,sendEmailContraseña};