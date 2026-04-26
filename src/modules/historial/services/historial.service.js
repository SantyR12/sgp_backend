const { v4: uuidv4 } = require('uuid');
const db = require('../../../config/db');

// ─────────────────────────────────────────────────────────────────────────────
// PB-09: Crear historia clínica
// ─────────────────────────────────────────────────────────────────────────────

async function createRecord(data, medicoId, device = 'Unknown') {
  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const pacienteId = uuidv4();
    const historiaId = uuidv4();

    // Verificar documento único (PB-10 criterio 5)
    const existe = await client.query(
      'SELECT id FROM pacientes WHERE tipo_documento=$1 AND numero_documento=$2',
      [data.tipoDocumento, data.numeroDocumento]
    );
    if (existe.rows.length > 0) {
      const err = new Error('Ya existe un paciente con ese número y tipo de documento');
      err.status = 409;
      throw err;
    }

    // Insertar paciente
    await client.query(
      `INSERT INTO pacientes
         (id, nombre_completo, tipo_documento, numero_documento,
          fecha_nacimiento, sexo, direccion, telefono, correo,
          contacto_emergencia_nombre, contacto_emergencia_telefono, creado_en)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW())`,
      [
        pacienteId, data.nombreCompleto, data.tipoDocumento,
        data.numeroDocumento, data.fechaNacimiento, data.sexo,
        data.direccion || null, data.telefono || null, data.correo || null,
        data.contactoEmergencia?.nombre || null,
        data.contactoEmergencia?.telefono || null,
      ]
    );

    // Insertar historia clínica
    await client.query(
      `INSERT INTO historias_clinicas
         (id, paciente_id, estado, ultimo_editado_por, ultimo_editado_desde, ultima_edicion_en, creado_en)
       VALUES ($1,$2,'activa',$3,$4,NOW(),NOW())`,
      [historiaId, pacienteId, medicoId, device]
    );

    await client.query('COMMIT');

    return getRecordByPatientId(pacienteId);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PB-09: Obtener historia clínica por pacienteId
// ─────────────────────────────────────────────────────────────────────────────

async function getRecordByPatientId(pacienteId) {
  const result = await db.query(
    `SELECT
       hc.id, hc.estado, hc.ultimo_editado_por,
       hc.ultimo_editado_desde, hc.ultima_edicion_en, hc.creado_en,
       p.id as paciente_id, p.nombre_completo, p.tipo_documento,
       p.numero_documento, p.fecha_nacimiento, p.sexo,
       p.direccion, p.telefono, p.correo,
       p.contacto_emergencia_nombre, p.contacto_emergencia_telefono
     FROM historias_clinicas hc
     JOIN pacientes p ON p.id = hc.paciente_id
     WHERE hc.paciente_id = $1`,
    [pacienteId]
  );

  if (result.rows.length === 0) {
    const err = new Error('Historia clínica no encontrada');
    err.status = 404;
    throw err;
  }

  return formatRecord(result.rows[0]);
}

// ─────────────────────────────────────────────────────────────────────────────
// PB-09: Actualizar historia clínica
// ─────────────────────────────────────────────────────────────────────────────

async function updateRecord(recordId, data, medicoId, device = 'Unknown') {
  const result = await db.query(
    `UPDATE historias_clinicas
     SET ultimo_editado_por=$1, ultimo_editado_desde=$2, ultima_edicion_en=NOW()
     WHERE id=$3
     RETURNING id, paciente_id`,
    [medicoId, device, recordId]
  );

  if (result.rows.length === 0) {
    const err = new Error('Historia no encontrada');
    err.status = 404;
    throw err;
  }

  const { paciente_id } = result.rows[0];

  // Actualizar datos del paciente
  await db.query(
    `UPDATE pacientes SET
       nombre_completo=$1, tipo_documento=$2, numero_documento=$3,
       fecha_nacimiento=$4, sexo=$5, direccion=$6, telefono=$7, correo=$8,
       contacto_emergencia_nombre=$9, contacto_emergencia_telefono=$10
     WHERE id=$11`,
    [
      data.nombreCompleto, data.tipoDocumento, data.numeroDocumento,
      data.fechaNacimiento, data.sexo, data.direccion || null,
      data.telefono || null, data.correo || null,
      data.contactoEmergencia?.nombre || null,
      data.contactoEmergencia?.telefono || null,
      paciente_id,
    ]
  );

  return getRecordByPatientId(paciente_id);
}

// ─────────────────────────────────────────────────────────────────────────────
// PB-09 criterio 5: Archivar (nunca eliminar)
// ─────────────────────────────────────────────────────────────────────────────

async function archiveRecord(recordId) {
  const result = await db.query(
    `UPDATE historias_clinicas SET estado='archivada' WHERE id=$1
     RETURNING paciente_id`,
    [recordId]
  );

  if (result.rows.length === 0) {
    const err = new Error('Historia no encontrada');
    err.status = 404;
    throw err;
  }

  return getRecordByPatientId(result.rows[0].paciente_id);
}

// ─────────────────────────────────────────────────────────────────────────────
// PB-14: Búsqueda de pacientes
// ─────────────────────────────────────────────────────────────────────────────

async function searchPatients({ nombre, documento, fechaNacimiento }) {
  let query = `
    SELECT
      p.id, p.nombre_completo, p.tipo_documento, p.numero_documento,
      p.fecha_nacimiento, p.sexo,
      u.nombre as ultimo_medico_tratante
    FROM pacientes p
    LEFT JOIN historias_clinicas hc ON hc.paciente_id = p.id
    LEFT JOIN usuarios u ON u.id = hc.ultimo_editado_por
    WHERE 1=1
  `;
  const params = [];

  if (nombre) {
    params.push(`%${nombre.toLowerCase()}%`);
    query += ` AND LOWER(p.nombre_completo) LIKE $${params.length}`;
  }
  if (documento) {
    params.push(documento);
    query += ` AND p.numero_documento = $${params.length}`;
  }
  if (fechaNacimiento) {
    params.push(fechaNacimiento);
    query += ` AND DATE(p.fecha_nacimiento) = $${params.length}`;
  }

  query += ' LIMIT 50'; // máximo 50 resultados

  const result = await db.query(query, params);
  return result.rows.map((r) => ({
    id: r.id,
    nombreCompleto: r.nombre_completo,
    tipoDocumento: r.tipo_documento,
    numeroDocumento: r.numero_documento,
    fechaNacimiento: r.fecha_nacimiento,
    sexo: r.sexo,
    ultimoMedicoTratante: r.ultimo_medico_tratante,
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: formatear registro de la BD al formato que espera Flutter
// ─────────────────────────────────────────────────────────────────────────────

function formatRecord(r) {
  return {
    id: r.id,
    pacienteId: r.paciente_id,
    estado: r.estado,
    ultimoEditadoPor: r.ultimo_editado_por,
    ultimoEditadoDesde: r.ultimo_editado_desde,
    ultimaEdicionEn: r.ultima_edicion_en,
    creadoEn: r.creado_en,
    paciente: {
      id: r.paciente_id,
      nombreCompleto: r.nombre_completo,
      tipoDocumento: r.tipo_documento,
      numeroDocumento: r.numero_documento,
      fechaNacimiento: r.fecha_nacimiento,
      sexo: r.sexo,
      direccion: r.direccion,
      telefono: r.telefono,
      correo: r.correo,
      contactoEmergencia:
        r.contacto_emergencia_nombre
          ? {
              nombre: r.contacto_emergencia_nombre,
              telefono: r.contacto_emergencia_telefono,
            }
          : null,
    },
    alergiasIds: [],
    medicamentosActivosIds: [],
    diagnosticosIds: [],
    consultasPreviasIds: [],
  };
}

module.exports = {
  createRecord,
  getRecordByPatientId,
  updateRecord,
  archiveRecord,
  searchPatients,
};