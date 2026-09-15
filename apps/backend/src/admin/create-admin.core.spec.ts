import {
  ADMIN_ROLES,
  ADMIN_STATUSES,
  MIN_PASSWORD_LENGTH,
  buildInsertPlan,
  parseCreateAdminArgs,
  renderDryRun,
  resolvePasswordSource,
  validateEmail,
  validatePassword,
  type CreateAdminOptions,
} from './create-admin.core';

const baseArgs = ['--email', 'qa@safaar.test', '--role', 'admin'];

describe('create-admin.core :: parseCreateAdminArgs', () => {
  it('to‘liq to‘g‘ri argumentlarni tahlil qiladi', () => {
    const r = parseCreateAdminArgs([
      '--email',
      'QA@Safaar.Test',
      '--role',
      'admin',
      '--full-name',
      'QA E2E Admin',
      '--status',
      'active',
    ]);
    expect(r.errors).toEqual([]);
    expect(r.help).toBe(false);
    expect(r.options).toEqual<CreateAdminOptions>({
      email: 'qa@safaar.test', // trim + lower
      fullName: 'QA E2E Admin',
      role: 'admin',
      status: 'active',
      dryRun: false,
      passwordFromFlag: null,
    });
  });

  it('--key=value shaklini ham qo‘llaydi', () => {
    const r = parseCreateAdminArgs([
      '--email=qa@safaar.test',
      '--role=moderator',
      '--dry-run',
    ]);
    expect(r.errors).toEqual([]);
    expect(r.options?.role).toBe('moderator');
    expect(r.options?.dryRun).toBe(true);
  });

  it('--email yo‘q => xato, options null', () => {
    const r = parseCreateAdminArgs(['--role', 'admin']);
    expect(r.options).toBeNull();
    expect(r.errors.join(' ')).toMatch(/--email.*majburiy/i);
  });

  it('--role yo‘q => xato, options null, HECH QACHON super_admin ga default bermaydi', () => {
    const r = parseCreateAdminArgs(['--email', 'qa@safaar.test']);
    expect(r.options).toBeNull();
    expect(r.errors.join(' ')).toMatch(/--role.*majburiy/i);
    // hech bir xato matni "super_admin tanlandi" degani emas
    expect(JSON.stringify(r)).not.toContain('"role":"super_admin"');
  });

  it('noto‘g‘ri --role => xato, ruxsat etilgan ro‘yxatni ko‘rsatadi', () => {
    const r = parseCreateAdminArgs([...baseArgs.slice(0, 2), '--role', 'root']);
    expect(r.options).toBeNull();
    expect(r.errors.join(' ')).toContain('root');
    for (const role of ADMIN_ROLES) {
      expect(r.errors.join(' ')).toContain(role);
    }
  });

  it('--role super_admin aniq berilsa qabul qilinadi', () => {
    const r = parseCreateAdminArgs([
      '--email',
      'qa@safaar.test',
      '--role',
      'super_admin',
    ]);
    expect(r.errors).toEqual([]);
    expect(r.options?.role).toBe('super_admin');
  });

  it('--status berilmasa default active', () => {
    const r = parseCreateAdminArgs(baseArgs);
    expect(r.options?.status).toBe('active');
  });

  it('noto‘g‘ri --status => xato', () => {
    const r = parseCreateAdminArgs([...baseArgs, '--status', 'frozen']);
    expect(r.options).toBeNull();
    expect(r.errors.join(' ')).toContain('frozen');
    for (const s of ADMIN_STATUSES) {
      expect(r.errors.join(' ')).toContain(s);
    }
  });

  it('--full-name berilmasa null', () => {
    const r = parseCreateAdminArgs(baseArgs);
    expect(r.options?.fullName).toBeNull();
  });

  it('--password flagi ushlanadi (lekin tavsiya etilmaydi)', () => {
    const r = parseCreateAdminArgs([...baseArgs, '--password', 'x'.repeat(20)]);
    expect(r.options?.passwordFromFlag).toBe('x'.repeat(20));
  });

  it('--help => help:true', () => {
    expect(parseCreateAdminArgs(['--help']).help).toBe(true);
    expect(parseCreateAdminArgs(['-h']).help).toBe(true);
  });

  it('noma‘lum flag => xato', () => {
    const r = parseCreateAdminArgs([...baseArgs, '--totp-secret', 'abc']);
    expect(r.options).toBeNull();
    expect(r.errors.join(' ')).toMatch(/noma'lum flag/i);
  });

  it('qiymatsiz flag => xato', () => {
    const r = parseCreateAdminArgs(['--email', '--role', 'admin']);
    expect(r.options).toBeNull();
    expect(r.errors.join(' ')).toMatch(/qiymat kerak|--email.*majburiy/i);
  });
});

describe('create-admin.core :: validateEmail', () => {
  it('to‘g‘ri email => null', () => {
    expect(validateEmail('a.b+c@safaar.test')).toBeNull();
  });
  it.each(['', 'no-at-sign', 'a b@x.uz', 'a@b', 'a@@b.uz'])(
    "noto‘g‘ri '%s' => xato",
    (bad) => {
      expect(validateEmail(bad)).not.toBeNull();
    },
  );
});

describe('create-admin.core :: validatePassword', () => {
  it(`${MIN_PASSWORD_LENGTH} belgidan qisqa => xato`, () => {
    expect(
      validatePassword('a'.repeat(MIN_PASSWORD_LENGTH - 1)),
    ).not.toBeNull();
  });
  it(`${MIN_PASSWORD_LENGTH}+ belgi => null`, () => {
    expect(validatePassword('a'.repeat(MIN_PASSWORD_LENGTH))).toBeNull();
  });
  it('bo‘sh => xato', () => {
    expect(validatePassword('')).not.toBeNull();
  });
  it('boshi/oxiri probel => xato', () => {
    expect(
      validatePassword(' ' + 'a'.repeat(MIN_PASSWORD_LENGTH)),
    ).not.toBeNull();
  });
});

describe('create-admin.core :: resolvePasswordSource', () => {
  it('flag env dan ustun', () => {
    expect(resolvePasswordSource({ flag: 'fromFlag', env: 'fromEnv' })).toEqual(
      { source: 'flag', value: 'fromFlag' },
    );
  });
  it('flag yo‘q => env', () => {
    expect(resolvePasswordSource({ flag: null, env: 'fromEnv' })).toEqual({
      source: 'env',
      value: 'fromEnv',
    });
  });
  it('ikkalasi ham yo‘q => prompt', () => {
    expect(resolvePasswordSource({ flag: null, env: undefined })).toEqual({
      source: 'prompt',
      value: null,
    });
    expect(resolvePasswordSource({ flag: '', env: '' })).toEqual({
      source: 'prompt',
      value: null,
    });
  });
});

describe('create-admin.core :: buildInsertPlan', () => {
  const opts: CreateAdminOptions = {
    email: 'qa@safaar.test',
    fullName: 'QA Admin',
    role: 'super_admin',
    status: 'active',
    dryRun: false,
    passwordFromFlag: null,
  };
  const HASH = '$argon2id$v=19$m=65536,t=3,p=4$abc$def';

  it('parametrlangan INSERT quradi (foydalanuvchi qiymati SQL matnida yo‘q)', () => {
    const plan = buildInsertPlan(opts, HASH);
    expect(plan.sql).toMatch(/insert into admin_users/i);
    expect(plan.sql).toMatch(/gen_random_uuid\(\)/);
    expect(plan.sql).toMatch(/returning/i);
    expect(plan.sql).not.toContain('qa@safaar.test');
    expect(plan.sql).not.toContain(HASH);
    expect(plan.sql).not.toMatch(/totp_secret/i); // => DB default NULL
  });

  it('params [email, hash, fullName, role, status] tartibida', () => {
    expect(buildInsertPlan(opts, HASH).params).toEqual([
      'qa@safaar.test',
      HASH,
      'QA Admin',
      'super_admin',
      'active',
    ]);
  });

  it('fullName null bo‘lsa param ham null', () => {
    expect(
      buildInsertPlan({ ...opts, fullName: null }, HASH).params[2],
    ).toBeNull();
  });
});

describe('create-admin.core :: renderDryRun', () => {
  const info = {
    email: 'qa@safaar.test',
    fullName: 'QA Admin',
    role: 'super_admin' as const,
    status: 'active' as const,
    passwordSource: 'env' as const,
    hashAlgo: 'argon2id',
    hashLength: 97,
    duplicateExists: false,
  };

  it('email/role/status ni ko‘rsatadi, "yozilmadi" belgisi bor', () => {
    const out = renderDryRun(info);
    expect(out).toContain('qa@safaar.test');
    expect(out).toContain('super_admin');
    expect(out).toContain('active');
    expect(out).toMatch(/HOZIR HECH NARSA YOZILMADI/);
    expect(out).toContain('totp_secret:    NULL');
  });

  it('parolni ham, hash matnini ham OSHKOR QILMAYDI', () => {
    const out = renderDryRun({ ...info });
    expect(out).not.toContain('$argon2');
    expect(out).not.toMatch(/password:\s+\S*\d{4,}/); // hech qanday parolga o‘xshash qiymat
    expect(out).toMatch(/password:.*ko‘rsatilmaydi/);
  });

  it('duplikat bor => real ishga tushirilsa xato beradi deb ogohlantiradi', () => {
    const out = renderDryRun({ ...info, duplicateExists: true });
    expect(out).toMatch(/INSERT rad etiladi/);
    expect(out).toMatch(/XATO bilan to‘xtaydi/);
  });
});
