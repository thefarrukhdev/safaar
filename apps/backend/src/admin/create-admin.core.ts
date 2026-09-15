/**
 * `scripts/create-admin.ts` CLI uchun SOF (I/O'siz) yordamchi mantiq:
 * argument tahlili, validatsiya, `--dry-run` ko'rinishi va parametrlangan
 * INSERT rejasini quradi.
 *
 * Bu faylda DB / argon2 / `console` / `process` yo'q — shuning uchun u
 * to'liq unit-test qilinadi (`create-admin.core.spec.ts`). Haqiqiy I/O
 * (parol so'rovi, `pg` ulanishi, argon2 hash, INSERT) `scripts/create-admin.ts`da.
 */

/**
 * `admin_users.role` ustunida saqlanadigan kanonik qiymatlar — kichik harfda,
 * `auth.service.ts` `normalizeAdminRole()` aliaslariga mos.
 * DIQQAT: bu yerda default YO'Q — `--role` MAJBURIY. Shu sabab `super_admin`
 * hech qachon "jimgina" tanlanmaydi; uni faqat aniq `--role super_admin` beradi.
 */
export const ADMIN_ROLES = [
  'admin',
  'super_admin',
  'finance_admin',
  'content_admin',
  'support_admin',
  'moderator',
] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];

/** `admin_users.status` — schema default `active`; login faqat `active`da ishlaydi. */
export const ADMIN_STATUSES = ['active', 'disabled'] as const;
export type AdminStatus = (typeof ADMIN_STATUSES)[number];

export const MIN_PASSWORD_LENGTH = 12;

export interface CreateAdminOptions {
  email: string;
  fullName: string | null;
  role: AdminRole;
  status: AdminStatus;
  dryRun: boolean;
  /** faqat `--password <value>` flagi orqali kelgan bo'lsa (tavsiya etilmaydi). */
  passwordFromFlag: string | null;
}

export interface ParseResult {
  help: boolean;
  options: CreateAdminOptions | null;
  errors: string[];
}

export const USAGE = `create-admin — SAFAAR admin_users uchun bitta yozuv qo'shadi (argon2id).

Ishlatish:
  npm run admin:create -w @safaar/backend -- --email <e> --role <r> [--full-name <n>] [--status <s>] [--dry-run]

Majburiy:
  --email <email>          Yangi admin emaili (unikal bo'lishi shart).
  --role <role>            ${ADMIN_ROLES.join(' | ')}
                           Default YO'Q — 'super_admin' faqat aniq berilганda.

Ixtiyoriy:
  --full-name <name>       To'liq ism.
  --status <status>        ${ADMIN_STATUSES.join(' | ')}  (default: active)
  --dry-run                Validatsiya + duplikat tekshiruvi + hash, lekin INSERT YO'Q.
  --password <value>       Parolni argument sifatida berish (TAVSIYA ETILMAYDI —
                           'ps'/shell history'da ko'rinadi). Afzali: interaktiv
                           so'rov yoki ADMIN_PASSWORD muhit o'zgaruvchisi.
  --help, -h               Shu yordamni ko'rsatadi.

Parol manbai (ustuvorlik): --password  >  ADMIN_PASSWORD env  >  interaktiv so'rov.
Parol hech qachon logga/gitga/argon2-hashdan tashqari joyga yozilmaydi.
totp_secret doim NULL — 2FA keyin ilova orqali yoqiladi.`;

const KNOWN_FLAGS = new Set([
  '--email',
  '--role',
  '--full-name',
  '--status',
  '--password',
  '--dry-run',
  '--help',
  '-h',
]);

/** `--key value` va `--key=value` ikkala shaklni ham qo'llaydi. */
export function parseCreateAdminArgs(argv: readonly string[]): ParseResult {
  const errors: string[] = [];
  const raw: Record<string, string> = {};
  let dryRun = false;
  let help = false;

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--help' || token === '-h') {
      help = true;
      continue;
    }
    if (token === '--dry-run') {
      dryRun = true;
      continue;
    }
    if (!token.startsWith('--')) {
      errors.push(`kutilmagan argument: '${token}'`);
      continue;
    }
    const eq = token.indexOf('=');
    const key = eq === -1 ? token : token.slice(0, eq);
    if (!KNOWN_FLAGS.has(key)) {
      errors.push(`noma'lum flag: '${key}'`);
      continue;
    }
    let value: string;
    if (eq !== -1) {
      value = token.slice(eq + 1);
    } else {
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) {
        errors.push(`'${key}' uchun qiymat kerak`);
        continue;
      }
      value = next;
      i += 1;
    }
    raw[key] = value;
  }

  if (help) {
    return { help: true, options: null, errors };
  }

  const email = (raw['--email'] ?? '').trim().toLowerCase();
  if (!email) {
    errors.push("'--email' majburiy");
  } else {
    const emailErr = validateEmail(email);
    if (emailErr) errors.push(emailErr);
  }

  const roleRaw = raw['--role'];
  if (roleRaw === undefined) {
    errors.push(
      "'--role' majburiy (default yo'q). Ruxsat etilganlar: " +
        ADMIN_ROLES.join(', '),
    );
  } else if (!isAdminRole(roleRaw)) {
    errors.push(
      `noto'g'ri '--role': '${roleRaw}'. Ruxsat etilganlar: ` +
        ADMIN_ROLES.join(', '),
    );
  }

  const statusRaw = raw['--status'];
  let status: AdminStatus = 'active';
  if (statusRaw !== undefined) {
    if (!isAdminStatus(statusRaw)) {
      errors.push(
        `noto'g'ri '--status': '${statusRaw}'. Ruxsat etilganlar: ` +
          ADMIN_STATUSES.join(', '),
      );
    } else {
      status = statusRaw;
    }
  }

  const fullNameRaw = raw['--full-name'];
  const fullName =
    fullNameRaw === undefined || fullNameRaw.trim() === ''
      ? null
      : fullNameRaw.trim();

  const passwordFromFlag =
    raw['--password'] !== undefined && raw['--password'] !== ''
      ? raw['--password']
      : null;

  if (errors.length > 0) {
    return { help: false, options: null, errors };
  }

  return {
    help: false,
    errors: [],
    options: {
      email,
      fullName,
      role: roleRaw as AdminRole,
      status,
      dryRun,
      passwordFromFlag,
    },
  };
}

export function isAdminRole(value: string): value is AdminRole {
  return (ADMIN_ROLES as readonly string[]).includes(value);
}

export function isAdminStatus(value: string): value is AdminStatus {
  return (ADMIN_STATUSES as readonly string[]).includes(value);
}

/** Oddiy, ammo qat'iy email shakli tekshiruvi. Xato bo'lsa — matn, aks holda null. */
export function validateEmail(email: string): string | null {
  if (!email) return "email bo'sh bo'lishi mumkin emas";
  if (/\s/.test(email)) return 'email probel saqlamasligi kerak';
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return `email shakli noto'g'ri: '${email}'`;
  }
  if (email.length > 255) return 'email 255 belgidan oshmasligi kerak';
  return null;
}

/** Xato bo'lsa — matn, aks holda null. Parolning O'ZI qaytarilmaydi/loglanmaydi. */
export function validatePassword(password: string): string | null {
  if (typeof password !== 'string' || password.length === 0) {
    return 'parol kiritilmadi';
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `parol kamida ${MIN_PASSWORD_LENGTH} ta belgidan iborat bo'lishi kerak`;
  }
  if (password.length > 512) {
    return 'parol 512 belgidan oshmasligi kerak';
  }
  if (/^\s|\s$/.test(password)) {
    return "parol boshi/oxirida probel bo'lmasligi kerak";
  }
  return null;
}

export type PasswordSource = 'flag' | 'env' | 'prompt';

/** Parol manbasini ustuvorlik bo'yicha aniqlaydi. Qiymatni O'ZGARTIRMAYDI. */
export function resolvePasswordSource(inputs: {
  flag: string | null;
  env: string | undefined;
}): { source: PasswordSource; value: string | null } {
  if (inputs.flag != null && inputs.flag !== '') {
    return { source: 'flag', value: inputs.flag };
  }
  if (inputs.env != null && inputs.env !== '') {
    return { source: 'env', value: inputs.env };
  }
  return { source: 'prompt', value: null };
}

export interface InsertPlan {
  sql: string;
  /** [email, passwordHash, fullName, role, status] — shu tartibda. */
  params: unknown[];
}

/**
 * Parametrlangan yagona INSERT. Foydalanuvchi kiritган qiymatlar SQL matniga
 * hech qachon konkatenatsiya qilinmaydi. `id` — `gen_random_uuid()`,
 * `totp_secret` — berilmaydi => NULL (ustun nullable).
 */
export function buildInsertPlan(
  options: CreateAdminOptions,
  passwordHash: string,
): InsertPlan {
  return {
    sql: `insert into admin_users
            (id, email, password_hash, full_name, role, status, created_at, updated_at)
          values
            (gen_random_uuid(), $1, $2, $3, $4, $5, now(), now())
          returning id::text, email, full_name, role, status, created_at`,
    params: [
      options.email,
      passwordHash,
      options.fullName,
      options.role,
      options.status,
    ],
  };
}

export interface DryRunInfo {
  email: string;
  fullName: string | null;
  role: AdminRole;
  status: AdminStatus;
  passwordSource: PasswordSource;
  hashAlgo: string;
  hashLength: number;
  duplicateExists: boolean;
}

/**
 * `--dry-run` uchun inson o'qiydigan xulosa. Parolni ham, hash matnini ham
 * O'Z ICHIGA OLMAYDI — faqat algoritm nomi va uzunligi.
 */
export function renderDryRun(info: DryRunInfo): string {
  const lines = [
    '── create-admin --dry-run ──',
    `email:          ${info.email}`,
    `full_name:      ${info.fullName ?? '(yo‘q)'}`,
    `role:           ${info.role}`,
    `status:         ${info.status}`,
    `password:       ${info.passwordSource} orqali berildi — ko‘rsatilmaydi`,
    `password_hash:  ${info.hashAlgo}, ${info.hashLength} belgi — ko‘rsatilmaydi`,
    `totp_secret:    NULL`,
    `email band (admin_users): ${info.duplicateExists ? 'HA — INSERT rad etiladi' : 'yo‘q'}`,
    info.duplicateExists
      ? 'NATIJA: real ishga tushirilsa XATO bilan to‘xtaydi.'
      : 'NATIJA: real ishga tushirilsa 1 ta admin_users yozuvi qo‘shiladi.',
    'HOZIR HECH NARSA YOZILMADI (--dry-run).',
  ];
  return lines.join('\n');
}
