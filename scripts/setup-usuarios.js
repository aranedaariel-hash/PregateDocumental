#!/usr/bin/env node
/**
 * scripts/setup-usuarios.js
 * Crea los usuarios iniciales de DocuTransporte en Supabase Auth
 * e inserta sus roles en la tabla `usuarios`.
 *
 * ANTES DE CORRER:
 *   npm install @supabase/supabase-js
 *
 * CORRER:
 *   node scripts/setup-usuarios.js
 *
 * AL TERMINAR:
 *   rm scripts/setup-usuarios.js
 */

'use strict';

const readline = require('readline');

// ─────────────────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────────────────
const SUPABASE_URL = 'https://hgeevmzxfywyzvfyfsmt.supabase.co';

const USUARIOS_INICIALES = [
  { email: 'admin@sgl.local',   password: 'Admin2024!',   rol: 'admin'   },
  { email: 'auditor@sgl.local', password: 'Auditor2024!', rol: 'auditor' },
];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers de log
// ─────────────────────────────────────────────────────────────────────────────
const log = {
  ok:   (m) => console.log(`  \x1b[32m✓\x1b[0m ${m}`),
  err:  (m) => console.log(`  \x1b[31m✗\x1b[0m ${m}`),
  info: (m) => console.log(`  \x1b[36m·\x1b[0m ${m}`),
  warn: (m) => console.log(`  \x1b[33m⚠\x1b[0m ${m}`),
  sep:  ()  => console.log('  ' + '─'.repeat(44)),
};

// ─────────────────────────────────────────────────────────────────────────────
// Leer input oculto (sin mostrar caracteres en pantalla)
// ─────────────────────────────────────────────────────────────────────────────
function readSecret(prompt) {
  return new Promise((resolve) => {
    process.stdout.write(prompt);

    if (process.stdin.isTTY) {
      // Modo raw: capturar char a char sin echo
      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.setEncoding('utf8');

      let input = '';

      const onData = (char) => {
        switch (char) {
          case '\r':
          case '\n':
          case '': // EOF (Ctrl+D)
            process.stdin.setRawMode(false);
            process.stdin.pause();
            process.stdin.removeListener('data', onData);
            process.stdout.write('\n');
            resolve(input);
            break;

          case '': // Ctrl+C
            process.stdout.write('\n');
            process.exit(0);
            break;

          case '': // Backspace
          case '\b':
            if (input.length > 0) input = input.slice(0, -1);
            break;

          default:
            // Ignorar caracteres de control no manejados arriba
            if (char >= ' ') input += char;
        }
      };

      process.stdin.on('data', onData);
    } else {
      // Sin TTY (piped): readline normal (no se puede ocultar)
      log.warn('stdin no es TTY — la key será visible en el input.');
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
      rl.once('line', (line) => {
        rl.close();
        resolve(line.trim());
      });
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Verificar que @supabase/supabase-js está instalado
// ─────────────────────────────────────────────────────────────────────────────
function loadSupabase() {
  try {
    return require('@supabase/supabase-js');
  } catch {
    console.error('\n  \x1b[31m✗\x1b[0m Falta la dependencia. Ejecutá primero:\n');
    console.error('      npm install @supabase/supabase-js\n');
    process.exit(1);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Buscar UUID de usuario existente por email
// ─────────────────────────────────────────────────────────────────────────────
async function findUserByEmail(adminClient, email) {
  // listUsers devuelve máximo 1000 por página; para este setup es suficiente
  const { data, error } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw new Error(`listUsers: ${error.message}`);
  return data.users.find(u => u.email === email) || null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n\x1b[1m╔══════════════════════════════════════════════╗\x1b[0m');
  console.log('\x1b[1m║   DocuTransporte — Setup de usuarios          ║\x1b[0m');
  console.log('\x1b[1m╚══════════════════════════════════════════════╝\x1b[0m\n');

  const { createClient } = loadSupabase();

  // Pedir service_role key
  console.log('  Necesitás la \x1b[1mservice_role key\x1b[0m de tu proyecto Supabase.');
  console.log('  Supabase Dashboard → Settings → API → service_role\n');

  const serviceKey = await readSecret('  Service role key: ');

  if (!serviceKey || serviceKey.length < 40) {
    console.error('\n  \x1b[31m✗\x1b[0m Key demasiado corta. Verificá que copiaste la key completa.\n');
    process.exit(1);
  }

  console.log();

  const supabase = createClient(SUPABASE_URL, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession:   false,
    },
  });

  // Verificar conexión con una query simple
  const { error: pingErr } = await supabase.from('usuarios').select('id').limit(1);
  if (pingErr && !pingErr.message.includes('0 rows')) {
    // Un error de permisos aquí indicaría key incorrecta
    if (pingErr.message.includes('permission') || pingErr.message.includes('JWT')) {
      log.err(`Key inválida o sin permisos: ${pingErr.message}`);
      process.exit(1);
    }
    // Otros errores (tabla vacía, etc.) son aceptables
  }
  log.ok('Conexión con Supabase OK');
  console.log();

  // ── Procesar cada usuario ──────────────────────────────────────────────────
  const resumen = { creados: [], existentes: [], erroresAuth: [], erroresTabla: [] };

  for (const usuario of USUARIOS_INICIALES) {
    log.sep();
    console.log(`\n  Procesando: \x1b[1m${usuario.email}\x1b[0m (rol: ${usuario.rol})\n`);

    // Paso 1 — Crear en Supabase Auth
    let uuid;

    const { data: created, error: createErr } = await supabase.auth.admin.createUser({
      email:         usuario.email,
      password:      usuario.password,
      email_confirm: true,   // confirmar email automáticamente
    });

    if (!createErr) {
      uuid = created.user.id;
      log.ok(`Creado en Auth    UUID: ${uuid}`);
      resumen.creados.push(usuario.email);
    } else {
      const yaExiste =
        createErr.message?.toLowerCase().includes('already registered') ||
        createErr.message?.toLowerCase().includes('already been registered') ||
        createErr.message?.toLowerCase().includes('already exists') ||
        createErr.status === 422;

      if (yaExiste) {
        log.info('Ya existe en Auth — buscando UUID…');
        try {
          const found = await findUserByEmail(supabase, usuario.email);
          if (!found) {
            log.err(`No se encontró ${usuario.email} en la lista de Auth.`);
            resumen.erroresAuth.push(usuario.email);
            continue;
          }
          uuid = found.id;
          log.ok(`UUID encontrado:  ${uuid}`);
          resumen.existentes.push(usuario.email);
        } catch (findErr) {
          log.err(`Error al buscar usuario: ${findErr.message}`);
          resumen.erroresAuth.push(usuario.email);
          continue;
        }
      } else {
        log.err(`Error al crear en Auth: ${createErr.message}`);
        if (createErr.status)  log.err(`HTTP ${createErr.status}`);
        resumen.erroresAuth.push(usuario.email);
        continue;
      }
    }

    // Paso 2 — Insertar/actualizar en tabla usuarios
    const { error: upsertErr } = await supabase
      .from('usuarios')
      .upsert(
        { id: uuid, email: usuario.email, rol: usuario.rol },
        { onConflict: 'id' }
      );

    if (upsertErr) {
      log.err(`Error al insertar en tabla usuarios:`);
      log.err(`  message: ${upsertErr.message}`);
      if (upsertErr.details) log.err(`  details: ${upsertErr.details}`);
      if (upsertErr.hint)    log.err(`  hint:    ${upsertErr.hint}`);
      if (upsertErr.code)    log.err(`  code:    ${upsertErr.code}`);
      resumen.erroresTabla.push(usuario.email);
    } else {
      log.ok(`Insertado en tabla usuarios (rol: \x1b[1m${usuario.rol}\x1b[0m)`);
    }

    console.log();
  }

  // ── Resumen final ──────────────────────────────────────────────────────────
  log.sep();
  console.log('\n  \x1b[1mResumen\x1b[0m\n');

  if (resumen.creados.length)
    log.ok(`Creados en Auth:      ${resumen.creados.join(', ')}`);

  if (resumen.existentes.length)
    log.info(`Ya existían en Auth:  ${resumen.existentes.join(', ')}`);

  if (resumen.erroresAuth.length)
    log.err(`Errores en Auth:      ${resumen.erroresAuth.join(', ')}`);

  if (resumen.erroresTabla.length)
    log.err(`Errores en tabla:     ${resumen.erroresTabla.join(', ')}`);

  const hayErrores = resumen.erroresAuth.length + resumen.erroresTabla.length > 0;
  console.log();
  if (!hayErrores) {
    log.ok('\x1b[32mSetup completado sin errores.\x1b[0m');
  } else {
    log.warn('\x1b[33mSetup completado con errores — revisá los mensajes de arriba.\x1b[0m');
  }

  console.log();
  log.sep();
  console.log();
  log.warn('\x1b[1mACCIÓN REQUERIDA\x1b[0m: Borrá este script para no exponer credenciales:');
  console.log();
  console.log('      \x1b[1mrm scripts/setup-usuarios.js\x1b[0m');
  console.log();
  log.sep();
  console.log();

  process.exit(hayErrores ? 1 : 0);
}

main().catch((e) => {
  console.error('\n  \x1b[31m✗\x1b[0m Error inesperado:', e.message);
  if (process.env.DEBUG) console.error(e.stack);
  process.exit(1);
});
