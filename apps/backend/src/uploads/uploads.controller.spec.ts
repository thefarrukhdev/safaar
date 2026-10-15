import { BadRequestException } from '@nestjs/common';
import { Role } from '@safaar/types';
import { UploadsController } from './uploads.controller';
import { UploadsService, type UploadedFile } from './uploads.service';

describe('UploadsController', () => {
  let controller: UploadsController;
  let service: {
    create: jest.Mock;
    createMany: jest.Mock;
    delete: jest.Mock;
    download: jest.Mock;
    presign: jest.Mock;
  };

  const actor = {
    id: '00000000-0000-2001-0000-000000000001',
    actorType: 'user' as const,
    role: Role.PARTNER,
    roles: [Role.PARTNER],
  };

  beforeEach(() => {
    service = {
      create: jest.fn(),
      createMany: jest.fn(),
      delete: jest.fn(),
      download: jest.fn(),
      presign: jest.fn(),
    };
    controller = new UploadsController(service as unknown as UploadsService);
  });

  describe('POST /uploads/images', () => {
    it('handles a single uploaded file and returns its metadata with items array', async () => {
      const file: UploadedFile = {
        originalname: 'facade.jpg',
        mimetype: 'image/jpeg',
        size: 1024,
        buffer: Buffer.from('dummy'),
      };
      service.create.mockResolvedValueOnce({
        id: 'img-1',
        url: 'https://cdn.safaar.uz/facade.jpg',
        mime_type: 'image/jpeg',
        size: 1024,
        visibility: 'public',
        caption: null,
      });

      const result = await controller.image(actor, {}, [file]);

      expect(service.create).toHaveBeenCalledWith(actor, 'image', {}, file);
      expect(result).toMatchObject({
        id: 'img-1',
        url: 'https://cdn.safaar.uz/facade.jpg',
        items: [{ id: 'img-1', url: 'https://cdn.safaar.uz/facade.jpg' }],
        count: 1,
      });
    });

    it('handles multiple (3) uploaded files at once and returns all items', async () => {
      const files: UploadedFile[] = [
        {
          originalname: 'photo1.jpg',
          mimetype: 'image/jpeg',
          size: 1000,
          buffer: Buffer.from('1'),
        },
        {
          originalname: 'photo2.jpg',
          mimetype: 'image/jpeg',
          size: 2000,
          buffer: Buffer.from('2'),
        },
        {
          originalname: 'photo3.jpg',
          mimetype: 'image/jpeg',
          size: 3000,
          buffer: Buffer.from('3'),
        },
      ];
      service.createMany.mockResolvedValueOnce([
        { id: 'img-1', url: 'https://cdn.safaar.uz/1.jpg' },
        { id: 'img-2', url: 'https://cdn.safaar.uz/2.jpg' },
        { id: 'img-3', url: 'https://cdn.safaar.uz/3.jpg' },
      ]);

      const result = await controller.image(actor, {}, files);

      expect(service.createMany).toHaveBeenCalledWith(
        actor,
        'image',
        files,
        {},
      );
      expect(result).toMatchObject({
        count: 3,
        id: 'img-1',
        url: 'https://cdn.safaar.uz/1.jpg',
        items: [
          { id: 'img-1', url: 'https://cdn.safaar.uz/1.jpg' },
          { id: 'img-2', url: 'https://cdn.safaar.uz/2.jpg' },
          { id: 'img-3', url: 'https://cdn.safaar.uz/3.jpg' },
        ],
      });
    });

    it('handles image upload via URL without files', async () => {
      service.create.mockResolvedValueOnce({
        id: 'img-url-1',
        url: 'https://cdn.safaar.uz/external.jpg',
      });

      const result = await controller.image(
        actor,
        { url: 'https://cdn.safaar.uz/external.jpg' },
        undefined,
      );

      expect(service.create).toHaveBeenCalledWith(
        actor,
        'image',
        { url: 'https://cdn.safaar.uz/external.jpg' },
        undefined,
      );
      expect(result).toMatchObject({
        id: 'img-url-1',
        url: 'https://cdn.safaar.uz/external.jpg',
      });
    });
  });

  describe('POST /uploads/images/batch', () => {
    it('uploads 3 images in batch and returns items array with count', async () => {
      const files: UploadedFile[] = [
        {
          originalname: '1.png',
          mimetype: 'image/png',
          size: 10,
          buffer: Buffer.from('1'),
        },
        {
          originalname: '2.png',
          mimetype: 'image/png',
          size: 20,
          buffer: Buffer.from('2'),
        },
        {
          originalname: '3.png',
          mimetype: 'image/png',
          size: 30,
          buffer: Buffer.from('3'),
        },
      ];
      service.createMany.mockResolvedValueOnce([
        { id: 'id-1', url: '/1.png' },
        { id: 'id-2', url: '/2.png' },
        { id: 'id-3', url: '/3.png' },
      ]);

      const result = await controller.batchImages(actor, {}, files);

      expect(service.createMany).toHaveBeenCalledWith(
        actor,
        'image',
        files,
        {},
      );
      expect(result).toEqual({
        items: [
          { id: 'id-1', url: '/1.png' },
          { id: 'id-2', url: '/2.png' },
          { id: 'id-3', url: '/3.png' },
        ],
        count: 3,
      });
    });

    it('throws BadRequestException when no files are uploaded to batch endpoint', async () => {
      await expect(
        controller.batchImages(actor, {}, []),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        controller.batchImages(actor, {}, undefined),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
