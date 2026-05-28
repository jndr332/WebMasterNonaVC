require('dotenv').config();
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

const WHATSAPP_NUMBER = process.env.WHATSAPP_NUMBER;

/* ─── Price helper ────────────────────────────────────────────────────────── */
function esSoloHomenaje(curso) {
  return curso.startsWith('Homenaje');
}

function getOfrenda(curso) {
  if (esSoloHomenaje(curso))          return null;    // gratis
  if (curso.includes('Ángeles') && !curso.includes('Om Mani') && !curso.includes('Ambos') && !curso.includes('3 Eventos')) return '$105';
  if (curso.includes('Om Mani')  && !curso.includes('Ángeles') && !curso.includes('Ambos') && !curso.includes('3 Eventos')) return '$150';
  if (curso.includes('Ambos') || curso.includes('3 Eventos')) return '$255';
  return '$105'; // fallback
}

/** HTML block with bank account info + WA button for payment emails */
function bancoBlock(ofrenda, waLink) {
  return `
    <!-- Datos bancarios -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
           style="background-color:#ffffff;border:1px solid rgba(201,154,46,0.32);
                  border-radius:14px;margin:20px 0;">
      <tr>
        <td style="padding:18px 20px;">
          <p style="margin:0 0 10px;font-size:13px;font-weight:bold;color:#5C2D6E;
                     font-family:Arial,sans-serif;">🏦 Datos para el depósito / transferencia:</p>
          <table role="presentation" cellpadding="0" cellspacing="0" style="font-family:Arial,sans-serif;font-size:13px;">
            <tr><td style="padding:2px 8px 2px 0;color:rgba(92,45,110,0.55);">Banco:</td>
                <td style="padding:2px 0;color:#5C2D6E;font-weight:bold;">Jardín Azuayo</td></tr>
            <tr><td style="padding:2px 8px 2px 0;color:rgba(92,45,110,0.55);">Tipo:</td>
                <td style="padding:2px 0;color:#5C2D6E;font-weight:bold;">Ahorros</td></tr>
            <tr><td style="padding:2px 8px 2px 0;color:rgba(92,45,110,0.55);">N° cuenta:</td>
                <td style="padding:2px 0;color:#5C2D6E;font-weight:bold;">2507381</td></tr>
            <tr><td style="padding:2px 8px 2px 0;color:rgba(92,45,110,0.55);">Titular:</td>
                <td style="padding:2px 0;color:#5C2D6E;font-weight:bold;">Edwin Vásquez</td></tr>
            <tr><td style="padding:2px 8px 2px 0;color:rgba(92,45,110,0.55);">CI:</td>
                <td style="padding:2px 0;color:#5C2D6E;font-weight:bold;">0301071163</td></tr>
            <tr><td style="padding:6px 8px 2px 0;color:rgba(92,45,110,0.55);">Valor:</td>
                <td style="padding:6px 0 2px;color:#C99A2E;font-weight:bold;font-size:15px;">${ofrenda}</td></tr>
          </table>
        </td>
      </tr>
    </table>

    <p style="margin:0 0 16px;font-size:14px;color:rgba(92,45,110,0.65);font-family:Arial,sans-serif;text-align:center;">
      Una vez realizado el depósito, envía tu comprobante por WhatsApp:
    </p>
  `;
}

/* ─── Helpers ─────────────────────────────────────────────────────────────── */

/** Shared inline-CSS email wrapper (light pastel, table-based, email-safe) */
function emailWrapper(bodyContent) {
  return `<!DOCTYPE html>
<html lang="es" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>Máster Nona · Cursos</title>
</head>
<body style="margin:0;padding:0;background-color:#F0E6F6;font-family:Arial,Helvetica,sans-serif;">

  <!-- Outer wrapper -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
         style="background:linear-gradient(160deg,#F7EBDD 0%,#EFD9D8 40%,#C9BDD9 75%,#B78FA8 100%);background-color:#F0E6F6;min-height:100%;padding:40px 20px;">
    <tr>
      <td align="center" valign="top">

        <!-- Card -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
               style="max-width:560px;background-color:#ffffff;border-radius:24px;overflow:hidden;
                      box-shadow:0 8px 40px rgba(92,45,110,0.14);border:1px solid rgba(92,45,110,0.12);">

          <!-- Header strip -->
          <tr>
            <td style="background:linear-gradient(135deg,#5C2D6E 0%,#7B3F8A 60%,#C99A2E 100%);
                        padding:36px 40px 32px;text-align:center;">
              <div style="display:inline-block;width:52px;height:52px;line-height:52px;
                          border-radius:50%;background:rgba(255,255,255,0.18);
                          font-size:26px;margin-bottom:12px;">🪷</div>
              <p style="margin:0;font-family:Georgia,serif;font-size:22px;font-weight:bold;
                         color:#ffffff;letter-spacing:1px;">Máster Nona · Cursos</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:36px 40px 32px;">
              ${bodyContent}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#F7EBDD;padding:20px 40px;text-align:center;
                        border-top:1px solid rgba(92,45,110,0.1);">
              <p style="margin:0;font-size:12px;color:rgba(92,45,110,0.55);font-family:Arial,sans-serif;">
                Con amor y luz &nbsp;·&nbsp; <em>Máster Nona</em>
              </p>
              <p style="margin:6px 0 0;font-size:11px;color:rgba(92,45,110,0.35);font-family:Arial,sans-serif;">
                Este correo fue enviado automáticamente. Si tienes preguntas, contáctanos por WhatsApp.
              </p>
            </td>
          </tr>

        </table>
        <!-- /Card -->

      </td>
    </tr>
  </table>

</body>
</html>`;
}

/** Reusable gold CTA button */
function goldButton(href, label) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px auto 0;">
    <tr>
      <td style="border-radius:50px;background:linear-gradient(135deg,#C99A2E,#E8B84B,#C99A2E);
                  box-shadow:0 4px 18px rgba(201,154,46,0.38);">
        <a href="${href}"
           style="display:inline-block;padding:14px 36px;font-family:Arial,sans-serif;
                  font-size:15px;font-weight:bold;color:#3A1558;text-decoration:none;
                  letter-spacing:0.5px;border-radius:50px;">
          ${label}
        </a>
      </td>
    </tr>
  </table>`;
}

/** Reusable info row inside a light card */
function infoRow(icon, label, value) {
  return `<tr>
    <td style="padding:8px 12px;vertical-align:top;">
      <span style="font-size:16px;">${icon}</span>
    </td>
    <td style="padding:8px 0;font-size:13px;color:rgba(92,45,110,0.6);font-family:Arial,sans-serif;vertical-align:top;">
      ${label}
    </td>
    <td style="padding:8px 12px;font-size:13px;color:#5C2D6E;font-weight:bold;font-family:Arial,sans-serif;vertical-align:top;">
      ${value}
    </td>
  </tr>`;
}

/* ─── sendConfirmationEmail ─────────────────────────────────────────────────
   Sent immediately after registration. Tone: warm welcome, next step = pay.
─────────────────────────────────────────────────────────────────────────── */
async function sendConfirmationEmail(inscripcion) {
  const { nombre, correo, curso } = inscripcion;
  const ofrenda = getOfrenda(curso);
  const waText = encodeURIComponent(
    `Hola, soy ${nombre}. Me registré para "${curso}" (ofrenda: ${ofrenda}) y quiero enviar mi comprobante de pago.`
  );
  const waLink = `https://wa.me/${WHATSAPP_NUMBER}?text=${waText}`;

  const body = `
    <!-- Greeting -->
    <p style="margin:0 0 6px;font-family:Georgia,serif;font-size:26px;font-weight:bold;color:#5C2D6E;">
      ¡Bienvenid@, ${nombre}!
    </p>
    <p style="margin:0 0 24px;font-size:15px;color:rgba(92,45,110,0.7);font-family:Arial,sans-serif;">
      Tu pre-registro fue recibido exitosamente. ✨
    </p>

    <!-- Info card -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
           style="background-color:#F7EBDD;border-radius:14px;border:1px solid rgba(201,154,46,0.28);
                  margin-bottom:24px;">
      <tbody>
        ${infoRow('📚', 'Curso seleccionado:', curso)}
        ${infoRow('💰', 'Ofrenda:', ofrenda)}
        ${infoRow('☕', 'Incluye:', '2 refrigerios')}
      </tbody>
    </table>

    <!-- Next step -->
    <p style="margin:0 0 8px;font-size:15px;font-weight:bold;color:#5C2D6E;font-family:Arial,sans-serif;">
      Próximo paso: confirmar tu lugar
    </p>
    <p style="margin:0 0 4px;font-size:14px;color:rgba(92,45,110,0.65);font-family:Arial,sans-serif;">
      Realiza tu depósito o transferencia con los siguientes datos y envía el comprobante por WhatsApp.
    </p>

    ${bancoBlock(ofrenda, waLink)}
    ${goldButton(waLink, '📲 Enviar comprobante por WhatsApp')}

    <p style="margin:28px 0 0;font-size:12px;color:rgba(92,45,110,0.4);font-family:Arial,sans-serif;text-align:center;">
      Si el botón no funciona, copia este enlace en tu navegador:<br/>
      <span style="color:#C99A2E;">${waLink}</span>
    </p>
  `;

  const text = `¡Bienvenid@, ${nombre}!

Tu pre-registro para "${curso}" fue recibido exitosamente.

Ofrenda: ${ofrenda} · Incluye 2 refrigerios.

Datos para el depósito:
  Banco: Jardín Azuayo (Ahorros)
  N° cuenta: 2507381
  Titular: Edwin Vásquez · CI: 0301071163
  Valor: ${ofrenda}

Una vez realizado, envía tu comprobante por WhatsApp:
${waLink}

Con amor y luz · Máster Nona`;

  await transporter.sendMail({
    from:    `"Máster Nona · Cursos" <${process.env.GMAIL_USER}>`,
    to:      correo,
    replyTo: process.env.GMAIL_USER,
    subject: `Tu registro está listo - ${curso}`,
    text,
    html:    emailWrapper(body),
  });
}

/* ─── sendPaymentConfirmedEmail ─────────────────────────────────────────────
   Sent when admin marks estado_pago = 1. Tone: celebration, you're in!
─────────────────────────────────────────────────────────────────────────── */
async function sendPaymentConfirmedEmail(inscripcion) {
  const { nombre, correo, curso } = inscripcion;

  const body = `
    <!-- Celebration icon -->
    <div style="text-align:center;margin-bottom:20px;">
      <span style="font-size:52px;">🌟</span>
    </div>

    <!-- Greeting -->
    <p style="margin:0 0 6px;font-family:Georgia,serif;font-size:26px;font-weight:bold;color:#5C2D6E;text-align:center;">
      ¡Tu lugar está asegurado!
    </p>
    <p style="margin:0 0 24px;font-size:15px;color:rgba(92,45,110,0.7);font-family:Arial,sans-serif;text-align:center;">
      Hola <strong style="color:#5C2D6E;">${nombre}</strong>, tu pago fue confirmado. ✅
    </p>

    <!-- Status card -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
           style="background:linear-gradient(135deg,rgba(92,45,110,0.06),rgba(201,154,46,0.06));
                  border-radius:14px;border:1px solid rgba(92,45,110,0.15);margin-bottom:24px;">
      <tbody>
        ${infoRow('📚', 'Curso:', curso)}
        ${infoRow('✅', 'Estado:', 'PAGADO · Inscripción completa')}
        ${infoRow('☕', 'Incluye:', '2 refrigerios durante el evento')}
        ${infoRow('📓', 'Recuerda:', 'Traer una libreta para tus notas')}
      </tbody>
    </table>

    <p style="margin:0 0 4px;font-size:15px;color:rgba(92,45,110,0.75);font-family:Arial,sans-serif;text-align:center;">
      Te esperamos con mucho amor y luz. ¡Prepárate para una experiencia transformadora!
    </p>
  `;

  const text = `¡Tu lugar está asegurado, ${nombre}!

Tu pago para el curso "${curso}" fue confirmado.

Estado: PAGADO · Inscripción completa
Incluye: 2 refrigerios
Recuerda: traer una libreta para tus notas.

Te esperamos con mucho amor y luz.

Con amor y luz · Máster Nona`;

  await transporter.sendMail({
    from:    `"Máster Nona · Cursos" <${process.env.GMAIL_USER}>`,
    to:      correo,
    replyTo: process.env.GMAIL_USER,
    subject: `Pago confirmado - Tu lugar en "${curso}" está listo`,
    text,
    html:    emailWrapper(body),
  });
}

/* ─── sendReminderEmail ─────────────────────────────────────────────────────
   Sent manually from admin panel to unpaid registrants.
   Tone: gentle nudge, not pushy. Reminds them spots are limited.
─────────────────────────────────────────────────────────────────────────── */
async function sendReminderEmail(inscripcion) {
  const { nombre, correo, curso } = inscripcion;
  const ofrenda = getOfrenda(curso);
  const waText = encodeURIComponent(
    `Hola, soy ${nombre}. Me registré para "${curso}" (ofrenda: ${ofrenda}) y quiero confirmar mi pago.`
  );
  const waLink = `https://wa.me/${WHATSAPP_NUMBER}?text=${waText}`;

  const body = `
    <!-- Icon -->
    <div style="text-align:center;margin-bottom:16px;">
      <span style="font-size:44px;">🔔</span>
    </div>

    <!-- Greeting -->
    <p style="margin:0 0 6px;font-family:Georgia,serif;font-size:24px;font-weight:bold;color:#5C2D6E;text-align:center;">
      Hola de nuevo, ${nombre}
    </p>
    <p style="margin:0 0 22px;font-size:15px;color:rgba(92,45,110,0.7);font-family:Arial,sans-serif;text-align:center;">
      Solo queríamos recordarte que tu cupo aún está reservado.
    </p>

    <!-- Info card -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
           style="background-color:#F7EBDD;border-radius:14px;border:1px solid rgba(201,154,46,0.28);
                  margin-bottom:8px;">
      <tbody>
        ${infoRow('📚', 'Curso:', curso)}
        ${infoRow('⏳', 'Estado:', 'Pendiente de pago')}
        ${infoRow('💰', 'Ofrenda:', ofrenda)}
        ${infoRow('☕', 'Incluye:', '2 refrigerios')}
      </tbody>
    </table>

    <!-- Urgency note -->
    <p style="margin:16px 0 4px;font-size:13px;color:rgba(92,45,110,0.55);font-family:Arial,sans-serif;text-align:center;">
      Los cupos son limitados. Completa tu pago para asegurar tu lugar.
    </p>

    ${bancoBlock(ofrenda, waLink)}
    ${goldButton(waLink, '📲 Confirmar mi pago por WhatsApp')}

    <p style="margin:28px 0 0;font-size:12px;color:rgba(92,45,110,0.4);font-family:Arial,sans-serif;text-align:center;">
      Si ya realizaste tu pago, ignora este mensaje. Gracias por tu comprensión.
    </p>
  `;

  const text = `Hola de nuevo, ${nombre}

Tu cupo para "${curso}" sigue reservado, pero aún está pendiente de pago.

Ofrenda: ${ofrenda} · Incluye 2 refrigerios.

Datos para el depósito:
  Banco: Jardín Azuayo (Ahorros)
  N° cuenta: 2507381
  Titular: Edwin Vásquez · CI: 0301071163
  Valor: ${ofrenda}

Una vez realizado, envía tu comprobante por WhatsApp:
${waLink}

Si ya realizaste tu pago, ignora este mensaje.

Con amor y luz · Máster Nona`;

  await transporter.sendMail({
    from:    `"Máster Nona · Cursos" <${process.env.GMAIL_USER}>`,
    to:      correo,
    replyTo: process.env.GMAIL_USER,
    subject: `Tu cupo en "${curso}" sigue reservado`,
    text,
    html:    emailWrapper(body),
  });
}

/* ─── sendHomenajeEmail ─────────────────────────────────────────────────────
   Sent when someone registers for the free birthday event (no payment needed).
   Tone: warm celebration, confirms the spot, gives event details.
─────────────────────────────────────────────────────────────────────────── */
async function sendHomenajeEmail(inscripcion) {
  const { nombre, correo } = inscripcion;

  const body = `
    <!-- Celebration icon -->
    <div style="text-align:center;margin-bottom:16px;">
      <span style="font-size:52px;">🎂</span>
    </div>

    <!-- Greeting -->
    <p style="margin:0 0 6px;font-family:Georgia,serif;font-size:26px;font-weight:bold;color:#5C2D6E;text-align:center;">
      ¡Tu lugar está reservado!
    </p>
    <p style="margin:0 0 22px;font-size:15px;color:rgba(92,45,110,0.7);font-family:Arial,sans-serif;text-align:center;">
      Hola <strong style="color:#5C2D6E;">${nombre}</strong>, te esperamos en este momento especial. ✨
    </p>

    <!-- Event details card -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
           style="background-color:#F7EBDD;border-radius:14px;border:1px solid rgba(201,154,46,0.28);
                  margin-bottom:20px;">
      <tbody>
        ${infoRow('🎉', 'Evento:', 'Homenaje Cumpleaños Máster Nona')}
        ${infoRow('📅', 'Fecha:', 'Sábado 11 de julio de 2026')}
        ${infoRow('🕐', 'Hora:', '7:30 PM')}
        ${infoRow('📍', 'Lugar:', 'Hotel Oro Verde')}
        ${infoRow('💛', 'Costo:', 'Entrada completamente gratuita')}
      </tbody>
    </table>

    <p style="margin:0;font-size:14px;color:rgba(92,45,110,0.65);font-family:Arial,sans-serif;text-align:center;">
      Una noche única de gratitud, amor y luz para honrar a quien ha transformado tantas vidas.<br>
      <strong style="color:#5C2D6E;">¡Con mucho amor te esperamos!</strong>
    </p>
  `;

  const text = `¡Tu lugar está reservado, ${nombre}!

Homenaje Cumpleaños Máster Nona
📅 Sábado 11 de julio de 2026
🕐 7:30 PM
📍 Hotel Oro Verde
💛 Entrada completamente gratuita

Una noche de gratitud, amor y luz. ¡Con mucho amor te esperamos!

Con amor y luz · Máster Nona`;

  await transporter.sendMail({
    from:    `"Máster Nona · Cursos" <${process.env.GMAIL_USER}>`,
    to:      correo,
    replyTo: process.env.GMAIL_USER,
    subject: `Tu lugar está confirmado - Homenaje Cumpleaños Máster Nona`,
    text,
    html:    emailWrapper(body),
  });
}

module.exports = { sendConfirmationEmail, sendPaymentConfirmedEmail, sendReminderEmail, sendHomenajeEmail };
