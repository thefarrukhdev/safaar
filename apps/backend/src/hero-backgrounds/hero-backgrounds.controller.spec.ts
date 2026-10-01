/* eslint-disable @typescript-eslint/unbound-method */
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { Role } from '@safaar/types';
import { Permission } from '../common/permissions';
import { PERMISSIONS_KEY } from '../common/permissions.decorator';
import { ROLES_KEY } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';
import { PostgresService } from '../infrastructure/postgres.service';
import { HeroBackgroundsAdminController } from './hero-backgrounds-admin.controller';
import { HeroBackgroundsController } from './hero-backgrounds.controller';
import { HeroBackgroundsService } from './hero-backgrounds.service';

describe('HeroBackgrounds Controllers', () => {
  let publicController: HeroBackgroundsController;
  let adminController: HeroBackgroundsAdminController;
  let service: {
    findPublic: jest.Mock;
    findPublicByPage: jest.Mock;
    findPublicMap: jest.Mock;
    findAll: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    reorder: jest.Mock;
    update: jest.Mock;
    remove: jest.Mock;
    toggleActive: jest.Mock;
  };

  const sampleItem = {
    id: '00000000-0000-7010-0000-000000000004',
    page: 'transport',
    title: { uz: 'Avto Ijarasi' },
    title_text: 'Avto Ijarasi',
    subtitle: { uz: 'Transfer xizmatlari' },
    subtitle_text: 'Transfer xizmatlari',
    imageUrl: '/images/heroes/transport_hero.jpg',
    image_url: '/images/heroes/transport_hero.jpg',
    isActive: true,
    is_active: true,
    sortOrder: 4,
    sort_order: 4,
    metadata: {},
    createdAt: '2026-10-01T10:00:00.000Z',
    created_at: '2026-10-01T10:00:00.000Z',
    updatedAt: '2026-10-01T10:00:00.000Z',
    updated_at: '2026-10-01T10:00:00.000Z',
  };

  beforeEach(async () => {
    service = {
      findPublic: jest.fn().mockResolvedValue([sampleItem]),
      findPublicByPage: jest.fn().mockResolvedValue(sampleItem),
      findPublicMap: jest.fn().mockResolvedValue({ transport: sampleItem }),
      findAll: jest.fn().mockResolvedValue([sampleItem]),
      findOne: jest.fn().mockResolvedValue(sampleItem),
      create: jest.fn().mockResolvedValue(sampleItem),
      reorder: jest.fn().mockResolvedValue({ success: true, updatedCount: 1 }),
      update: jest.fn().mockResolvedValue(sampleItem),
      remove: jest.fn().mockResolvedValue({ success: true, id: sampleItem.id }),
      toggleActive: jest.fn().mockResolvedValue(sampleItem),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HeroBackgroundsController, HeroBackgroundsAdminController],
      providers: [
        {
          provide: HeroBackgroundsService,
          useValue: service,
        },
        {
          provide: PostgresService,
          useValue: { query: jest.fn() },
        },
      ],
    })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    publicController = module.get<HeroBackgroundsController>(
      HeroBackgroundsController,
    );
    adminController = module.get<HeroBackgroundsAdminController>(
      HeroBackgroundsAdminController,
    );
  });

  describe('HeroBackgroundsController (Public)', () => {
    it('findPublic delegates to service.findPublic', async () => {
      const result = await publicController.findPublic('transport');
      expect(service.findPublic).toHaveBeenCalledWith('transport');
      expect(result).toEqual([sampleItem]);
    });

    it('findPublicByPage delegates to service.findPublicByPage', async () => {
      const result = await publicController.findPublicByPage('transport');
      expect(service.findPublicByPage).toHaveBeenCalledWith('transport');
      expect(result).toEqual(sampleItem);
    });

    it('findPublicMap delegates to service.findPublicMap', async () => {
      const result = await publicController.findPublicMap();
      expect(service.findPublicMap).toHaveBeenCalled();
      expect(result).toEqual({ transport: sampleItem });
    });
  });

  describe('HeroBackgroundsAdminController (Admin)', () => {
    it('findAll delegates to service.findAll', async () => {
      const query = { page: 'transport', limit: 10 };
      const result = await adminController.findAll(query);
      expect(service.findAll).toHaveBeenCalledWith(query);
      expect(result).toEqual([sampleItem]);
    });

    it('findOne delegates to service.findOne', async () => {
      const result = await adminController.findOne(sampleItem.id);
      expect(service.findOne).toHaveBeenCalledWith(sampleItem.id);
      expect(result).toEqual(sampleItem);
    });

    it('create delegates to service.create', async () => {
      const dto = {
        page: 'transport',
        imageUrl: '/images/heroes/transport_hero.jpg',
      };
      const result = await adminController.create(dto);
      expect(service.create).toHaveBeenCalledWith(dto);
      expect(result).toEqual(sampleItem);
    });

    it('reorder delegates to service.reorder', async () => {
      const dto = { orderedIds: [sampleItem.id] };
      const result = await adminController.reorder(dto);
      expect(service.reorder).toHaveBeenCalledWith(dto);
      expect(result).toEqual({ success: true, updatedCount: 1 });
    });

    it('update delegates to service.update', async () => {
      const dto = { imageUrl: '/new.jpg' };
      const result = await adminController.update(sampleItem.id, dto);
      expect(service.update).toHaveBeenCalledWith(sampleItem.id, dto);
      expect(result).toEqual(sampleItem);
    });

    it('replace delegates to service.update', async () => {
      const dto = { page: 'hotels', imageUrl: '/hotels.jpg' };
      const result = await adminController.replace(sampleItem.id, dto);
      expect(service.update).toHaveBeenCalledWith(sampleItem.id, dto);
      expect(result).toEqual(sampleItem);
    });

    it('remove delegates to service.remove', async () => {
      const result = await adminController.remove(sampleItem.id);
      expect(service.remove).toHaveBeenCalledWith(sampleItem.id);
      expect(result).toEqual({ success: true, id: sampleItem.id });
    });

    it('toggleActive delegates to service.toggleActive with isActive dto', async () => {
      const result = await adminController.toggleActive(sampleItem.id, {
        isActive: false,
      });
      expect(service.toggleActive).toHaveBeenCalledWith(sampleItem.id, false);
      expect(result).toEqual(sampleItem);
    });

    it('toggleActive delegates to service.toggleActive with is_active dto', async () => {
      const result = await adminController.toggleActive(sampleItem.id, {
        is_active: false,
      });
      expect(service.toggleActive).toHaveBeenCalledWith(sampleItem.id, false);
      expect(result).toEqual(sampleItem);
    });

    it('toggleActive delegates to service.toggleActive without body (toggles)', async () => {
      const result = await adminController.toggleActive(sampleItem.id);
      expect(service.toggleActive).toHaveBeenCalledWith(
        sampleItem.id,
        undefined,
      );
      expect(result).toEqual(sampleItem);
    });

    it('publish delegates to service.toggleActive with true', async () => {
      const result = await adminController.publish(sampleItem.id);
      expect(service.toggleActive).toHaveBeenCalledWith(sampleItem.id, true);
      expect(result).toEqual(sampleItem);
    });

    it('unpublish delegates to service.toggleActive with false', async () => {
      const result = await adminController.unpublish(sampleItem.id);
      expect(service.toggleActive).toHaveBeenCalledWith(sampleItem.id, false);
      expect(result).toEqual(sampleItem);
    });
  });

  describe('Authorization Metadata on Admin Controller', () => {
    const reflector = new Reflector();

    it('HeroBackgroundsAdminController is protected with Role.ADMIN, Role.SUPER_ADMIN, and Role.CONTENT_ADMIN', () => {
      const roles = reflector.get<Role[]>(
        ROLES_KEY,
        HeroBackgroundsAdminController,
      );
      expect(roles).toEqual([Role.ADMIN, Role.SUPER_ADMIN, Role.CONTENT_ADMIN]);
    });

    it('GET methods require Permission.CmsRead', () => {
      const findAllPerms = reflector.get<string[]>(
        PERMISSIONS_KEY,
        HeroBackgroundsAdminController.prototype.findAll,
      );
      const findOnePerms = reflector.get<string[]>(
        PERMISSIONS_KEY,
        HeroBackgroundsAdminController.prototype.findOne,
      );
      expect(findAllPerms).toEqual([Permission.CmsRead]);
      expect(findOnePerms).toEqual([Permission.CmsRead]);
    });

    it('Write methods require Permission.CmsWrite', () => {
      const createPerms = reflector.get<string[]>(
        PERMISSIONS_KEY,
        HeroBackgroundsAdminController.prototype.create,
      );
      const reorderPerms = reflector.get<string[]>(
        PERMISSIONS_KEY,
        HeroBackgroundsAdminController.prototype.reorder,
      );
      const updatePerms = reflector.get<string[]>(
        PERMISSIONS_KEY,
        HeroBackgroundsAdminController.prototype.update,
      );
      const removePerms = reflector.get<string[]>(
        PERMISSIONS_KEY,
        HeroBackgroundsAdminController.prototype.remove,
      );
      expect(createPerms).toEqual([Permission.CmsWrite]);
      expect(reorderPerms).toEqual([Permission.CmsWrite]);
      expect(updatePerms).toEqual([Permission.CmsWrite]);
      expect(removePerms).toEqual([Permission.CmsWrite]);
    });
  });
});
