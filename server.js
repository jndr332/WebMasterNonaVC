require('dotenv').config();

const express    = require('express');
const cors       = require('cors');
const path       = require('path');
const { getDb }  = require('./database');
const { sendConfirmationEmail, sendPaymentConfirmedEmail, sendReminderEmail, sendHomenajeEmail } = require('./mailer');

const app  = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin2026';
const WHATSAPP_NUMBER = process.env.WHATSAPP_NUMBER || '';

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// ─── Páginas HTML ─────────────────────────────────────────────────────────────
app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/admin', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/registro_p', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'registro_p.html'));
});

// ─── API: Config pública ──────────────────────────────────────────────────────
app.get('/api/config', (_req, res) => {
  res.json({ whatsappNumber: WHATSAPP_NUMBER });
});

// ─── API: Registro de nueva inscripción ───────────────────────────────────────
app.post('/api/registro', async (req, res) => {
  const { nombre, correo, celular, cedula, curso } = req.body;

  if (!nombre || !correo || !celular || !cedula || !curso) {
    return res.status(400).json({ ok: false, mensaje: 'Todos los campos son obligatorios.' });
  }

  const db = getDb();

  const existe = db.prepare('SELECT id FROM inscripciones WHERE cedula = ?').get(cedula);
  if (existe) {
    return res.status(409).json({ ok: false, mensaje: 'Ya existe un registro con esa cédula.' });
  }

  const cursoTrim     = curso.trim();
  const esSoloHomenaje = cursoTrim.startsWith('Homenaje');
  const tiene3Eventos  = cursoTrim.includes('3 Eventos');
  // Solo el homenaje puro es gratuito (sin pago necesario)
  const estadoPago    = esSoloHomenaje ? 1 : 0;

  try {
    const stmt = db.prepare(`
      INSERT INTO inscripciones (nombre, correo, celular, cedula, curso, estado_pago)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      nombre.trim(),
      correo.trim().toLowerCase(),
      celular.trim(),
      cedula.trim(),
      cursoTrim,
      estadoPago
    );

    // Routing de correos según tipo de evento
    if (esSoloHomenaje) {
      // Solo homenaje → solo correo de confirmación gratuita
      sendHomenajeEmail({ nombre, correo, curso: cursoTrim }).catch(err =>
        console.error('[Mailer] Error homenaje:', err.message)
      );
    } else if (tiene3Eventos) {
      // Los 3 eventos → correo de pago (por los cursos) + correo del homenaje
      sendConfirmationEmail({ nombre, correo, curso: cursoTrim }).catch(err =>
        console.error('[Mailer] Error confirmación:', err.message)
      );
      sendHomenajeEmail({ nombre, correo, curso: cursoTrim }).catch(err =>
        console.error('[Mailer] Error homenaje:', err.message)
      );
    } else {
      // Cursos regulares → solo correo de pago
      sendConfirmationEmail({ nombre, correo, curso: cursoTrim }).catch(err =>
        console.error('[Mailer] Error confirmación:', err.message)
      );
    }

    res.json({
      ok: true,
      id: Number(result.lastInsertRowid),
      mensaje: 'Registro exitoso.',
      whatsappNumber: WHATSAPP_NUMBER,
      esSoloHomenaje,
    });
  } catch (err) {
    console.error('[DB] Error en registro:', err.message);
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor.' });
  }
});

// ─── API: Auth admin ──────────────────────────────────────────────────────────
app.post('/api/admin/auth', (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    res.json({ ok: true });
  } else {
    res.status(401).json({ ok: false, mensaje: 'Contraseña incorrecta.' });
  }
});

// ─── API: Obtener todas las inscripciones ─────────────────────────────────────
app.get('/api/admin/inscripciones', (req, res) => {
  const { password } = req.headers;
  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ ok: false, mensaje: 'No autorizado.' });
  }

  const db   = getDb();
  const rows = db.prepare(`
    SELECT id, nombre, correo, celular, cedula, curso,
           estado_pago, asistencia, created_at
    FROM inscripciones
    ORDER BY created_at DESC
  `).all();

  const total      = rows.length;
  const pagados    = rows.filter(r => r.estado_pago).length;
  const pendientes = total - pagados;
  const presentes  = rows.filter(r => r.asistencia).length;

  res.json({ ok: true, stats: { total, pagados, pendientes, presentes }, inscripciones: rows });
});

// ─── API: Toggle estado_pago ──────────────────────────────────────────────────
app.put('/api/admin/inscripciones/:id/pago', async (req, res) => {
  const { password } = req.headers;
  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ ok: false, mensaje: 'No autorizado.' });
  }

  const { id }         = req.params;
  const { estado_pago } = req.body;
  const db             = getDb();

  const inscripcion = db.prepare('SELECT * FROM inscripciones WHERE id = ?').get(id);
  if (!inscripcion) {
    return res.status(404).json({ ok: false, mensaje: 'Inscripción no encontrada.' });
  }

  db.prepare('UPDATE inscripciones SET estado_pago = ? WHERE id = ?').run(estado_pago ? 1 : 0, id);

  if (estado_pago && !inscripcion.estado_pago) {
    sendPaymentConfirmedEmail(inscripcion).catch(err =>
      console.error('[Mailer] Error al enviar confirmación de pago:', err.message)
    );
  }

  res.json({ ok: true, mensaje: 'Estado actualizado.' });
});

// ─── API: Check-in presencial ────────────────────────────────────────────────
app.post('/api/checkin', (req, res) => {
  const { cedula } = req.body;

  if (!cedula) {
    return res.status(400).json({ ok: false, tipo: 'error', mensaje: 'Ingresa tu número de cédula.' });
  }

  const db          = getDb();
  const inscripcion = db.prepare('SELECT * FROM inscripciones WHERE cedula = ?').get(cedula.trim());

  if (!inscripcion) {
    return res.status(404).json({
      ok:      false,
      tipo:    'no_encontrado',
      mensaje: 'No encontramos tu cédula. Verifica el número o regístrate primero.',
    });
  }

  if (!inscripcion.estado_pago) {
    return res.status(403).json({
      ok:      false,
      tipo:    'pendiente_pago',
      nombre:  inscripcion.nombre,
      curso:   inscripcion.curso,
      mensaje: 'Tu registro está pendiente de pago. Contacta a la organización.',
      whatsappNumber: WHATSAPP_NUMBER,
    });
  }

  if (inscripcion.asistencia) {
    return res.json({
      ok:      true,
      tipo:    'ya_registrado',
      nombre:  inscripcion.nombre,
      curso:   inscripcion.curso,
      mensaje: '¡Ya registraste tu asistencia! Bienvenido/a de nuevo.',
    });
  }

  db.prepare('UPDATE inscripciones SET asistencia = 1 WHERE cedula = ?').run(cedula.trim());

  res.json({
    ok:      true,
    tipo:    'exito',
    nombre:  inscripcion.nombre,
    curso:   inscripcion.curso,
    mensaje: '¡Bienvenido/a! Tu asistencia fue registrada exitosamente.',
  });
});

// ─── API: Enviar recordatorio de pago ────────────────────────────────────────
app.post('/api/admin/inscripciones/:id/recordatorio', async (req, res) => {
  const { password } = req.headers;
  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ ok: false, mensaje: 'No autorizado.' });
  }

  const { id } = req.params;
  const db     = getDb();

  const inscripcion = db.prepare('SELECT * FROM inscripciones WHERE id = ?').get(id);
  if (!inscripcion) {
    return res.status(404).json({ ok: false, mensaje: 'Inscripción no encontrada.' });
  }

  if (inscripcion.curso.startsWith('Homenaje')) {
    return res.status(409).json({ ok: false, mensaje: 'El homenaje es gratuito. No aplica recordatorio de pago.' });
  }

  if (inscripcion.estado_pago) {
    return res.status(409).json({ ok: false, mensaje: 'Esta persona ya pagó. No es necesario enviar recordatorio.' });
  }

  try {
    await sendReminderEmail(inscripcion);
    res.json({ ok: true, mensaje: `Recordatorio enviado a ${inscripcion.correo}.` });
  } catch (err) {
    console.error('[Mailer] Error al enviar recordatorio:', err.message);
    res.status(500).json({ ok: false, mensaje: 'No se pudo enviar el recordatorio. Revisa la configuración del correo.' });
  }
});

// ─── API: Editar correo de una inscripción ────────────────────────────────────
app.put('/api/admin/inscripciones/:id/correo', (req, res) => {
  const { password } = req.headers;
  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ ok: false, mensaje: 'No autorizado.' });
  }

  const { id }     = req.params;
  const { correo } = req.body;

  if (!correo || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo.trim())) {
    return res.status(400).json({ ok: false, mensaje: 'Ingresa un correo electrónico válido.' });
  }

  const db = getDb();
  const inscripcion = db.prepare('SELECT id FROM inscripciones WHERE id = ?').get(id);
  if (!inscripcion) {
    return res.status(404).json({ ok: false, mensaje: 'Inscripción no encontrada.' });
  }

  const correoNorm = correo.trim().toLowerCase();
  db.prepare('UPDATE inscripciones SET correo = ? WHERE id = ?').run(correoNorm, id);

  res.json({ ok: true, mensaje: 'Correo actualizado correctamente.', correo: correoNorm });
});

// ─── Iniciar servidor ─────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n✨ Servidor Cursosphe corriendo en http://localhost:${PORT}`);
  console.log(`   Admin panel : http://localhost:${PORT}/admin`);
  console.log(`   Check-in    : http://localhost:${PORT}/registro_p\n`);
  getDb();
});
