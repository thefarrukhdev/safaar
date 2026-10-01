import { BadRequestException, NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AppCacheService } from '../infrastructure/cache.service';
import { PostgresService } from '../infrastructure/postgres.service';
import { CreateHeroBackgroundDto } from './dto/create-hero-background.dto';
import { HeroBackgroundQueryDto } from './dto/hero-background-query.dto';
import { ReorderHeroBackgroundDto } from './dto/reorder-hero-background.dto';
import { ToggleHeroBackgroundDto } from './dto/toggle-hero-background.dto';
import { UpdateHeroBackgroundDto } from './dto/update-hero-background.dto';
import { HeroBackgroundsService } from './hero-backgrounds.service';

describe('HeroBackgroundsService', () => {
  let service: HeroBackgroundsService;
  let postgres: { query: jest.Mock; transaction: jest.Mock };
  let cache: {
    getOrSet: jest.Mock;
    del: jest.Mock;
    delByPattern: jest.Mock;
  };

  const sampleRow = {
    id: '00000000-0000-7010-0000-000000000004',
    page: 'transport',
    title: {
      uz: 'Avto Ijarasi va Transfer Xizmatlari',
      ru: 'Аренда авто и трансфер',
      en: 'Car Rental and Transfer Services',
    },
    subtitle: {
      uz: "O'zbekiston bo'ylab qulay sayohat qilish uchun avtomobil ijarasi",
      ru: 'Аренда авто по Узбекистану',
      en: 'Car rental across Uzbekistan',
    },
    image_url: '/images/heroes/transport_hero.jpg',
    is_active: true,
    sort_order: 4,
    metadata: { overlayOpacity: 0.4 },
    created_at: new Date('2026-10-01T10:00:00.000Z'),
    updated_at: new Date('2026-10-01T10:00:00.000Z'),
  };

  beforeEach(() => {
    const txQuery = jest
      .fn()
      .mockResolvedValue([{ id: '00000000-0000-7010-0000-000000000004' }]);
    postgres = {
      query: jest.fn(),
      transaction: jest.fn(async (cb: (tx: unknown) => Promise<unknown>) =>
        cb({ query: txQuery }),
      ),
    };
    cache = {
      getOrSet: jest.fn(
        async <T>(
          _key: string,
          _ttl: number,
          producer: () => Promise<T> | T,
        ): Promise<T> => Promise.resolve(producer()),
      ),
      del: jest.fn().mockResolvedValue(undefined),
      delByPattern: jest.fn().mockResolvedValue(undefined),
    };

    service = new HeroBackgroundsService(
      postgres as unknown as PostgresService,
      cache as unknown as AppCacheService,
    );
  });

  describe('findPublic', () => {
    it('returns all active hero backgrounds sorted by sort_order and created_at', async () => {
      postgres.query.mockResolvedValue([sampleRow]);

      const result = await service.findPublic();

      expect(cache.getOrSet).toHaveBeenCalledWith(
        'hero-backgrounds:public:all',
        300,
        expect.any(Function),
      );
      expect(postgres.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE is_active = true'),
        [],
      );
      expect(result).toHaveLength(1);
      expect(result[0].page).toBe('transport');
      expect(result[0].imageUrl).toBe('/images/heroes/transport_hero.jpg');
      expect(result[0].image_url).toBe('/images/heroes/transport_hero.jpg');
      expect(result[0].title_text).toBe('Avto Ijarasi va Transfer Xizmatlari');
      expect(result[0].isActive).toBe(true);
      expect(result[0].is_active).toBe(true);
    });

    it('filters by page when page parameter is provided', async () => {
      postgres.query.mockResolvedValue([sampleRow]);

      const result = await service.findPublic('transport');

      expect(cache.getOrSet).toHaveBeenCalledWith(
        'hero-backgrounds:public:page:transport',
        300,
        expect.any(Function),
      );
      expect(postgres.query).toHaveBeenCalledWith(
        expect.stringContaining('AND LOWER(page) = LOWER($1)'),
        ['transport'],
      );
      expect(result[0].page).toBe('transport');
    });

    it('handles Postgres 42P01 error (undefined table) gracefully by returning empty array', async () => {
      const pgError = Object.assign(
        new Error('relation "hero_backgrounds" does not exist'),
        { code: '42P01' },
      );
      postgres.query.mockRejectedValue(pgError);

      const result = await service.findPublic();
      expect(result).toEqual([]);
    });

    it('re-throws other non-42P01 Postgres errors', async () => {
      postgres.query.mockRejectedValue(new Error('Connection lost'));
      await expect(service.findPublic()).rejects.toThrow('Connection lost');
    });
  });

  describe('findPublicByPage', () => {
    it('returns the active hero background for the given page', async () => {
      postgres.query.mockResolvedValue([sampleRow]);

      const result = await service.findPublicByPage('transport');

      expect(result.page).toBe('transport');
      expect(result.imageUrl).toBe('/images/heroes/transport_hero.jpg');
    });

    it('throws BadRequestException if page is empty or whitespace', async () => {
      await expect(service.findPublicByPage('  ')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws NotFoundException if no active hero background is found for page', async () => {
      postgres.query.mockResolvedValue([]);

      await expect(service.findPublicByPage('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findPublicMap', () => {
    it('returns a dictionary keyed by page with active hero backgrounds', async () => {
      postgres.query.mockResolvedValue([sampleRow]);

      const result = await service.findPublicMap();

      expect(result.transport).toBeDefined();
      expect(result.transport.imageUrl).toBe(
        '/images/heroes/transport_hero.jpg',
      );
      expect(result.transport.title_text).toBe(
        'Avto Ijarasi va Transfer Xizmatlari',
      );
    });
  });

  describe('findAll (Admin)', () => {
    it('returns all hero backgrounds matching query filters (camelCase isActive)', async () => {
      postgres.query.mockResolvedValue([sampleRow]);

      const result = await service.findAll({
        page: 'transport',
        isActive: true,
        search: 'avto',
        limit: 10,
        offset: 0,
      });

      expect(postgres.query).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT $4 OFFSET $5'),
        expect.arrayContaining(['transport', true, '%avto%', 10, 0]),
      );
      expect(result).toHaveLength(1);
    });

    it('returns all hero backgrounds matching query filters (snake_case is_active)', async () => {
      postgres.query.mockResolvedValue([sampleRow]);

      const result = await service.findAll({
        page: 'transport',
        is_active: false,
        limit: 20,
      });

      expect(postgres.query).toHaveBeenCalledWith(
        expect.stringContaining('is_active = $2'),
        expect.arrayContaining(['transport', false, 20]),
      );
      expect(result).toHaveLength(1);
    });
  });

  describe('findOne (Admin)', () => {
    it('returns single hero background by valid UUID', async () => {
      postgres.query.mockResolvedValue([sampleRow]);

      const result = await service.findOne(sampleRow.id);

      expect(result.id).toBe(sampleRow.id);
      expect(result.page).toBe('transport');
    });

    it('throws BadRequestException if ID is not a valid UUID', async () => {
      await expect(service.findOne('not-a-uuid')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws NotFoundException if record not found', async () => {
      postgres.query.mockResolvedValue([]);

      await expect(
        service.findOne('00000000-0000-0000-0000-000000000000'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('create (Admin)', () => {
    it('inserts a new hero background, invalidates caches, and returns created item', async () => {
      const createdRow = {
        ...sampleRow,
        id: '11111111-1111-7010-0000-000000000001',
        page: 'hotels',
        image_url: '/images/heroes/hotels_hero.jpg',
      };
      postgres.query.mockResolvedValue([createdRow]);

      const result = await service.create({
        page: 'hotels',
        imageUrl: '/images/heroes/hotels_hero.jpg',
        title: { uz: 'Mehmonxonalar' },
        subtitle: { uz: 'Qulay mehmonxonalar' },
        isActive: true,
        sortOrder: 2,
        metadata: { badge: 'Popular' },
      });

      expect(postgres.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO hero_backgrounds'),
        expect.arrayContaining([
          'hotels',
          JSON.stringify({ uz: 'Mehmonxonalar' }),
          JSON.stringify({ uz: 'Qulay mehmonxonalar' }),
          '/images/heroes/hotels_hero.jpg',
          true,
          2,
        ]),
      );
      expect(cache.delByPattern).toHaveBeenCalledWith('hero-backgrounds:*');
      expect(cache.del).toHaveBeenCalledWith('settings:public');
      expect(result.page).toBe('hotels');
      expect(result.imageUrl).toBe('/images/heroes/hotels_hero.jpg');
    });

    it('supports snake_case image_url, is_active, and sort_order in create', async () => {
      const createdRow = {
        ...sampleRow,
        id: '11111111-1111-7010-0000-000000000002',
        page: 'restaurants',
        image_url: '/images/heroes/hero.png',
      };
      postgres.query.mockResolvedValue([createdRow]);

      const result = await service.create({
        page: 'restaurants',
        image_url: '/images/heroes/hero.png',
        is_active: false,
        sort_order: 5,
      });

      expect(postgres.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO hero_backgrounds'),
        expect.arrayContaining([
          'restaurants',
          '/images/heroes/hero.png',
          false,
          5,
        ]),
      );
      expect(result.page).toBe('restaurants');
    });

    it('throws BadRequestException if imageUrl and image_url are both missing or empty', async () => {
      await expect(
        service.create({ page: 'hotels', imageUrl: '   ' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('update (Admin)', () => {
    it('updates existing hero background, invalidates caches, and returns updated item', async () => {
      const updatedRow = {
        ...sampleRow,
        image_url: '/images/heroes/transport_hero_v2.jpg',
      };
      postgres.query
        .mockResolvedValueOnce([sampleRow])
        .mockResolvedValueOnce([updatedRow]);

      const result = await service.update(sampleRow.id, {
        imageUrl: '/images/heroes/transport_hero_v2.jpg',
      });

      expect(postgres.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE hero_backgrounds'),
        expect.arrayContaining([
          sampleRow.page,
          '/images/heroes/transport_hero_v2.jpg',
          sampleRow.id,
        ]),
      );
      expect(cache.delByPattern).toHaveBeenCalledWith('hero-backgrounds:*');
      expect(cache.del).toHaveBeenCalledWith('settings:public');
      expect(result.imageUrl).toBe('/images/heroes/transport_hero_v2.jpg');
    });

    it('supports snake_case fields in update', async () => {
      const updatedRow = {
        ...sampleRow,
        image_url: '/images/heroes/transport_v3.jpg',
        is_active: false,
        sort_order: 10,
      };
      postgres.query
        .mockResolvedValueOnce([sampleRow])
        .mockResolvedValueOnce([updatedRow]);

      const result = await service.update(sampleRow.id, {
        image_url: '/images/heroes/transport_v3.jpg',
        is_active: false,
        sort_order: 10,
      });

      expect(postgres.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE hero_backgrounds'),
        expect.arrayContaining([
          '/images/heroes/transport_v3.jpg',
          false,
          10,
          sampleRow.id,
        ]),
      );
      expect(result.isActive).toBe(false);
    });

    it('throws BadRequestException if updating image_url to an empty string', async () => {
      postgres.query.mockResolvedValueOnce([sampleRow]);

      await expect(
        service.update(sampleRow.id, { imageUrl: '   ' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('remove (Admin)', () => {
    it('deletes hero background, invalidates cache, and returns success object', async () => {
      postgres.query
        .mockResolvedValueOnce([sampleRow]) // findOne
        .mockResolvedValueOnce([]); // delete

      const result = await service.remove(sampleRow.id);

      expect(postgres.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM hero_backgrounds'),
        [sampleRow.id],
      );
      expect(cache.delByPattern).toHaveBeenCalledWith('hero-backgrounds:*');
      expect(cache.del).toHaveBeenCalledWith('settings:public');
      expect(result).toEqual({ success: true, id: sampleRow.id });
    });
  });

  describe('toggleActive (Admin)', () => {
    it('toggles isActive status and invalidates cache', async () => {
      const toggledRow = {
        ...sampleRow,
        is_active: false,
      };
      postgres.query
        .mockResolvedValueOnce([sampleRow]) // findOne
        .mockResolvedValueOnce([toggledRow]); // update

      const result = await service.toggleActive(sampleRow.id, false);

      expect(postgres.query).toHaveBeenCalledWith(
        expect.stringContaining('SET is_active = $1'),
        [false, sampleRow.id],
      );
      expect(cache.delByPattern).toHaveBeenCalledWith('hero-backgrounds:*');
      expect(cache.del).toHaveBeenCalledWith('settings:public');
      expect(result.isActive).toBe(false);
    });
  });

  describe('reorder (Admin)', () => {
    it('updates sort orders inside transaction and invalidates cache', async () => {
      const result = await service.reorder({
        orderedIds: [sampleRow.id],
      });

      expect(postgres.transaction).toHaveBeenCalled();
      expect(cache.delByPattern).toHaveBeenCalledWith('hero-backgrounds:*');
      expect(cache.del).toHaveBeenCalledWith('settings:public');
      expect(result).toEqual({ success: true, updatedCount: 1 });
    });

    it('updates sort orders using items array with sortOrder', async () => {
      const result = await service.reorder({
        items: [{ id: sampleRow.id, sortOrder: 10 }],
      });

      expect(postgres.transaction).toHaveBeenCalled();
      expect(cache.delByPattern).toHaveBeenCalledWith('hero-backgrounds:*');
      expect(result).toEqual({ success: true, updatedCount: 1 });
    });

    it('updates sort orders using items array with snake_case sort_order', async () => {
      const result = await service.reorder({
        items: [{ id: sampleRow.id, sort_order: 15 }],
      });

      expect(postgres.transaction).toHaveBeenCalled();
      expect(result).toEqual({ success: true, updatedCount: 1 });
    });

    it('throws BadRequestException if payload has no valid items or orderedIds', async () => {
      await expect(service.reorder({})).rejects.toThrow(BadRequestException);
    });
  });

  describe('DTO Validation Strictness (ValidationPipe whitelist & forbidNonWhitelisted)', () => {
    it('CreateHeroBackgroundDto validates with camelCase', async () => {
      const dto = plainToInstance(CreateHeroBackgroundDto, {
        page: 'home',
        imageUrl: '/registon.jpg',
        isActive: true,
        sortOrder: 1,
      });
      const errors = await validate(dto, {
        whitelist: true,
        forbidNonWhitelisted: true,
      });
      expect(errors).toHaveLength(0);
    });

    it('CreateHeroBackgroundDto validates with snake_case', async () => {
      const dto = plainToInstance(CreateHeroBackgroundDto, {
        page: 'home',
        image_url: '/registon.jpg',
        is_active: true,
        sort_order: 1,
      });
      const errors = await validate(dto, {
        whitelist: true,
        forbidNonWhitelisted: true,
      });
      expect(errors).toHaveLength(0);
    });

    it('CreateHeroBackgroundDto rejects missing both imageUrl and image_url', async () => {
      const dto = plainToInstance(CreateHeroBackgroundDto, {
        page: 'home',
      });
      const errors = await validate(dto, {
        whitelist: true,
        forbidNonWhitelisted: true,
      });
      expect(errors.length).toBeGreaterThan(0);
    });

    it('UpdateHeroBackgroundDto validates partial fields without requiring image_url', async () => {
      const dto = plainToInstance(UpdateHeroBackgroundDto, {
        isActive: false,
      });
      const errors = await validate(dto, {
        whitelist: true,
        forbidNonWhitelisted: true,
      });
      expect(errors).toHaveLength(0);
    });

    it('ToggleHeroBackgroundDto accepts either isActive or is_active', async () => {
      const dtoCamel = plainToInstance(ToggleHeroBackgroundDto, {
        isActive: false,
      });
      const errorsCamel = await validate(dtoCamel, {
        whitelist: true,
        forbidNonWhitelisted: true,
      });
      expect(errorsCamel).toHaveLength(0);

      const dtoSnake = plainToInstance(ToggleHeroBackgroundDto, {
        is_active: false,
      });
      const errorsSnake = await validate(dtoSnake, {
        whitelist: true,
        forbidNonWhitelisted: true,
      });
      expect(errorsSnake).toHaveLength(0);
    });

    it('HeroBackgroundQueryDto accepts both isActive and is_active', async () => {
      const dto = plainToInstance(HeroBackgroundQueryDto, {
        page: 'hotels',
        is_active: 'true',
        limit: '20',
      });
      const errors = await validate(dto, {
        whitelist: true,
        forbidNonWhitelisted: true,
      });
      expect(errors).toHaveLength(0);
      expect(dto.is_active).toBe(true);
      expect(dto.limit).toBe(20);
    });

    it('ReorderHeroBackgroundDto accepts items with sort_order', async () => {
      const dto = plainToInstance(ReorderHeroBackgroundDto, {
        items: [
          {
            id: '00000000-0000-7010-0000-000000000001',
            sort_order: 1,
          },
        ],
      });
      const errors = await validate(dto, {
        whitelist: true,
        forbidNonWhitelisted: true,
      });
      expect(errors).toHaveLength(0);
    });
  });
});
