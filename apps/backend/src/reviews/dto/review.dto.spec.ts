import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateReviewDto } from './review.dto';

/**
 * Uy uslubi: `common/dto-validation.spec.ts` bilan bir xil — soxta pipe
 * emas, global `ValidationPipe` ICHKARIDA ishlatadigan aynan shu
 * class-transformer + class-validator juftligi to'g'ridan-to'g'ri
 * chaqiriladi (`whitelist: true, forbidNonWhitelisted: true`), shuning
 * uchun bu testlar HAQIQIY validatsiya xatti-harakatini tekshiradi.
 */
async function validateReview(payload: Record<string, unknown>) {
  const dto = plainToInstance(CreateReviewDto, payload);
  const errors = await validate(dto, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  return { dto, errors };
}

const VALID_TARGET_ID = '11111111-1111-1111-1111-111111111111';

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    target_type: 'hotel',
    target_id: VALID_TARGET_ID,
    rating: 5,
    body: "Xona juda toza edi, xizmat a'lo darajada.",
    ...overrides,
  };
}

describe('CreateReviewDto — reyting validatsiyasi (talab #6)', () => {
  it('rating maydoni umuman yuborilmasa rad etiladi (missing)', async () => {
    const withoutRating: Record<string, unknown> = { ...validBody() };
    delete withoutRating.rating;
    const { errors } = await validateReview(withoutRating);
    expect(errors.some((e) => e.property === 'rating')).toBe(true);
  });

  it.each<[string, unknown]>([
    ['0 (minimaldan past, @Min(1) buziladi)', 0],
    ['6 (maksimaldan yuqori, @Max(5) buziladi)', 6],
    ['NaN (class-validator sukut bo`yicha allowNaN=false)', NaN],
    ['Infinity (sukut bo`yicha allowInfinity=false)', Infinity],
    ['"5" — raqam emas, satr (@Type majburlash ataylab yo`q)', '5'],
    ['null', null],
    [
      '4.55 — @IsNumber({maxDecimalPlaces:1}) ruxsat etilgandan ko`p kasr xona',
      4.55,
    ],
  ])('rating=%s bo`lsa rad etiladi', async (_label, value) => {
    const { errors } = await validateReview({ ...validBody(), rating: value });
    expect(errors.some((e) => e.property === 'rating')).toBe(true);
  });

  it("to'g'ri rating (masalan 4.5, bitta kasr xona) qabul qilinadi — sog'lom yo'l regressiya emasligini tasdiqlaydi", async () => {
    const { errors } = await validateReview({ ...validBody(), rating: 4.5 });
    expect(errors).toHaveLength(0);
  });
});

describe('CreateReviewDto — matn (body) validatsiyasi va sanitizatsiya (talab #7)', () => {
  it('body maydoni umuman yuborilmasa rad etiladi (missing)', async () => {
    const withoutBody: Record<string, unknown> = { ...validBody() };
    delete withoutBody.body;
    const { errors } = await validateReview(withoutBody);
    expect(errors.some((e) => e.property === 'body')).toBe(true);
  });

  it("bo'sh satr ('') @MinLength(1) tomonidan rad etiladi", async () => {
    const { errors } = await validateReview({ ...validBody(), body: '' });
    expect(errors.some((e) => e.property === 'body')).toBe(true);
  });

  it("faqat probellardan iborat matn ('   ') @Transform tomonidan trim qilingach @MinLength(1)da rad etiladi", async () => {
    const { errors } = await validateReview({ ...validBody(), body: '   ' });
    expect(errors.some((e) => e.property === 'body')).toBe(true);
  });

  it('faqat boshqaruv belgilaridan (C0/C1) iborat matn sanitizatsiyadan keyin bo`sh qoladi va rad etiladi', async () => {
    const controlOnly = '\u0000\u0001\u0002\u001f\u007f\u009f';
    const { dto, errors } = await validateReview({
      ...validBody(),
      body: controlOnly,
    });
    expect(dto.body).toBe('');
    expect(errors.some((e) => e.property === 'body')).toBe(true);
  });

  // POZITIV holat — ustidan filtrlash (over-filtering) HAQIQIY xato
  // bo'lardi: O'zbek tilidagi oʻ/gʻ harflari MODIFIER LETTER TURNED
  // COMMA (U+02BB) belgisini ishlatadi, u boshqaruv belgisi EMAS va
  // sanitizeReviewText uni buzmasligi SHART.
  it("o'zbek tilidagi maxsus harflar (oʻ/gʻ, U+02BB) sanitizatsiyadan BUZILMASDAN o'tadi", async () => {
    const text = 'Xona juda oʻzbekona did bilan jihozlangan, gʻalati emas edi.';
    const { dto, errors } = await validateReview({
      ...validBody(),
      body: text,
    });
    expect(dto.body).toBe(text);
    expect(errors).toHaveLength(0);
  });

  it('rus tilidagi kirill matn sanitizatsiyadan BUZILMASDAN o`tadi', async () => {
    const text = 'Отличный сервис, спасибо большое администрации!';
    const { dto, errors } = await validateReview({
      ...validBody(),
      body: text,
    });
    expect(dto.body).toBe(text);
    expect(errors).toHaveLength(0);
  });

  it('\\n va \\t saqlanadi, chetlardagi probel esa qirqiladi (sanitizeReviewText shartnomasi)', async () => {
    const text = '  Birinchi qator\nIkkinchi qator\tTab bilan  ';
    const { dto, errors } = await validateReview({
      ...validBody(),
      body: text,
    });
    expect(dto.body).toBe('Birinchi qator\nIkkinchi qator\tTab bilan');
    expect(errors).toHaveLength(0);
  });
});

describe("CreateReviewDto — mehmon user_id'ni soxtalashtira olmaydi (talab #3, DTO qatlami)", () => {
  it("so'rov tanasida user_id kelsa, forbidNonWhitelisted butun so'rovni rad etadi", async () => {
    const { errors } = await validateReview({
      ...validBody(),
      user_id: '99999999-9999-9999-9999-999999999999',
    });
    expect(errors.some((e) => e.property === 'user_id')).toBe(true);
  });
});

describe('CreateReviewDto — ruxsatsiz mass-assignment maydonlari rad etiladi (talab #17)', () => {
  const forbiddenFields: Record<string, unknown> = {
    status: 'published',
    author_type: 'USER',
    created_at: '2020-01-01T00:00:00.000Z',
    updated_at: '2020-01-01T00:00:00.000Z',
    id: '22222222-2222-2222-2222-222222222222',
    partner_id: '33333333-3333-3333-3333-333333333333',
    createdBy: 'attacker',
    verified: true,
  };

  it.each(Object.entries(forbiddenFields))(
    "DTO '%s' maydonini rad etadi (forbidNonWhitelisted)",
    async (field, value) => {
      const { errors } = await validateReview({
        ...validBody(),
        [field]: value,
      });
      expect(errors.some((e) => e.property === field)).toBe(true);
    },
  );

  it("to'liq to'g'ri (faqat ruxsat etilgan maydonlar bilan) so'rov XATOSIZ o'tadi — sog'lom yo'l regressiya emasligini tasdiqlaydi", async () => {
    const { errors } = await validateReview(validBody());
    expect(errors).toHaveLength(0);
  });
});
