/**
 * create-admin — SAFAAR `admin_users` jadvaliga BITTA yozuv qo'shadi.
 *
 * Nega SQL emas: `scripts/hash-password.ts` singari, ilovaning O'Z argon2
 * kutubxonasi bilan hash qiladi va parametrlangan yagona INSERT bajaradi.
 * Sof mantiq (`src/admin/create-admin.core.ts`) alohida unit-test qilingan.
 *
 * XAVFSIZLIK:
 *  - `--role` MAJBURIY, default yo'q => `super_admin` hech qachon jimgina tanlanmaydi.
 *  - `--dry-run` => validatsiya + duplikat tekshiruvi + hash, lekin INSERT YO'Q.
 *  - Duplikat email (soft-deleted bo'lsa ham) => XATO bilan to'xtaydi.
 *  - Parol: `--password` (tavsiya etilmaydi) > `ADMIN_PASSWORD` env > interaktiv (2 marta).
 *  - Parol hech qachon logga/faylga/gitga yozilmaydi; xatolarda ham ko'rsatilmaydi.
 *  - `totp_secret` doim NULL.
 *  - DB'ga faqat `INSERT INTO admin_users` — UPDATE/DELETE/DDL yo'q.
 *
 * Ishlatish:
 *   npm run admin:create -w @safaar/backend -- --email a@b.uz --role admin --dry-run
 */
import 'dotenv/config';
import * as readlinePromises from 'node:readline/promises';
import { Writable } from 'node:stream';
import { stdin as input, stdout as output } from 'node:process';
import { Client } from 'pg';
import * as argon2 from 'argon2';
import {
  buildInsertPlan,
  parseCreateAdminArgs,
  renderDryRun,
  resolvePasswordSource,
  USAGE,
  validatePassword,
} from '../src/admin/create-admin.core';

const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 65_536,
  timeCost: 3,
  parallelism: 4,
} as const;

async function questionHidden(promptText: string): Promise<string> {
  output.write(promptText);
  // Kiritilayotgan belgilar ekranga chiqmasin.
  const mute = new Writable({ write: (_chunk, _enc, cb) => cb() });
  const rl = readlinePromises.createInterface({
    input,
    output: mute,
    terminal: true,
  });
  try {
    const answer = await rl.question('');
    output.write('\n');
    return answer;
  } finally {
    rl.close();
  }
}

async function promptForPassword(): Promise<string> {
  if (!input.isTTY) {
    throw new Error(
      "interaktiv so'rov uchun TTY yo'q — parolni ADMIN_PASSWORD env orqali bering",
    );
  }
  const first = await questionHidden('Yangi admin paroli: ');
  const second = await questionHidden('Parolni takrorlang: ');
  if (first !== second) {
    throw new Error('parollar mos kelmadi');
  }
  return first;
}

async function main(): Promise<void> {
  const parsed = parseCreateAdminArgs(process.argv.slice(2));

  if (parsed.help) {
    output.write(USAGE + '\n');
    return;
  }
  if (!parsed.options || parsed.errors.length > 0) {
    for (const message of parsed.errors) {
      process.stderr.write(`xato: ${message}\n`);
    }
    process.stderr.write('\n' + USAGE + '\n');
    process.exitCode = 1;
    return;
  }
  const options = parsed.options;

  // --- Parol manbasini aniqlash ---
  const source = resolvePasswordSource({
    flag: options.passwordFromFlag,
    env: process.env.ADMIN_PASSWORD,
  });
  let password =
    source.source === 'prompt'
      ? await promptForPassword()
      : (source.value as string);

  const passwordError = validatePassword(password);
  if (passwordError) {
    password = '';
    process.stderr.write(`xato: ${passwordError}\n`);
    process.exitCode = 1;
    return;
  }
  if (source.source === 'flag') {
    process.stderr.write(
      "ogohlantirish: --password 'ps'/shell history'da ko'rinadi; " +
        'keyingi safar ADMIN_PASSWORD env yoki interaktiv so‘rovdan foydalaning\n',
    );
  }

  // --- Hash (ilovaning argon2'si) ---
  const passwordHash = await argon2.hash(password, ARGON2_OPTIONS);
  password = ''; // xotiradan tezroq chiqarish

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL o'rnatilmagan — .env faylini tekshiring");
  }

  const client = new Client({ connectionString });
  await client.connect();
  try {
    const duplicate = await client.query(
      'select id::text from admin_users where lower(email) = lower($1) limit 1',
      [options.email],
    );
    const duplicateExists = (duplicate.rowCount ?? 0) > 0;

    if (options.dryRun) {
      output.write(
        renderDryRun({
          email: options.email,
          fullName: options.fullName,
          role: options.role,
          status: options.status,
          passwordSource: source.source,
          hashAlgo: 'argon2id',
          hashLength: passwordHash.length,
          duplicateExists,
        }) + '\n',
      );
      return;
    }

    if (duplicateExists) {
      throw new Error(
        `admin_users da '${options.email}' allaqachon mavjud ` +
          "(soft-deleted bo'lsa ham). Avval o'sha yozuvni tiklang yoki butunlay o'chiring.",
      );
    }

    const plan = buildInsertPlan(options, passwordHash);
    await client.query('begin');
    let created: Record<string, unknown>;
    try {
      const result = await client.query(plan.sql, plan.params);
      await client.query('commit');
      created = result.rows[0] as Record<string, unknown>;
    } catch (error) {
      await client.query('rollback').catch(() => undefined);
      throw error;
    }

    output.write('Admin yaratildi:\n');
    output.write(
      JSON.stringify(
        {
          id: created.id,
          email: created.email,
          full_name: created.full_name,
          role: created.role,
          status: created.status,
          created_at: created.created_at,
        },
        null,
        2,
      ) + '\n',
    );
    output.write(
      '\nParol ko‘rsatilmaydi. Login: POST /v1/auth/admin/login { email, password }.\n',
    );
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  // argon2/pg xatolari parolni oshkor qilmaydi — faqat message chiqadi.
  process.stderr.write(
    (error instanceof Error ? error.message : String(error)) + '\n',
  );
  process.exitCode = 1;
});
