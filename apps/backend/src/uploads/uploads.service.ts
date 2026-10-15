import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Role } from '@safaar/types';
import { randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { RequestActor } from '../common/actor';
import { PostgresService } from '../infrastructure/postgres.service';

// `CreateMediaDto`/`PresignUploadDto` (controller'dan) va boshqa
// xizmatlardan keladigan oddiy obyektlar (masalan hotel rasm yuklash
// oqimi) — ikkalasi ham shu minimal maydonlar to'plamiga mos keladi.
interface MediaInputFields {
  url?: unknown;
  mime_type?: unknown;
  mimeType?: unknown;
  size?: unknown;
  type?: unknown;
  filename?: unknown;
  caption?: unknown;
}

export interface UploadedFile {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}

interface StoreMediaOptions {
  bucket?: string;
  maxSize?: number;
}

interface StoredUpload {
  absolutePath?: string;
  objectKey: string;
  url: string;
}

interface R2StorageConfig {
  region: string;
  endpoint: string;
  publicBucket: string;
  privateBucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle: boolean;
  publicBaseUrl?: string;
}

interface MediaFileRow {
  id: string;
  owner_id: string;
  bucket: string;
  object_key: string;
  url: string | null;
  visibility: string;
}

@Injectable()
export class UploadsService implements OnModuleInit {
  private readonly logger = new Logger(UploadsService.name);

  constructor(private readonly pg: PostgresService) {}

  async onModuleInit(): Promise<void> {
    await this.validateObjectStorage();
  }

  async create(
    actor: RequestActor | undefined,
    type: 'image' | 'document',
    body: MediaInputFields,
    file?: UploadedFile,
  ) {
    const currentActor = this.requireActor(actor);
    return this.storeMedia(
      currentActor.actorType,
      currentActor.id,
      type,
      body,
      file,
    );
  }

  async createMany(
    actor: RequestActor | undefined,
    type: 'image' | 'document',
    files: UploadedFile[],
    body: MediaInputFields = {},
  ) {
    const currentActor = this.requireActor(actor);
    const results: Array<Record<string, unknown>> = [];

    for (const file of files) {
      const stored = await this.storeMedia(
        currentActor.actorType,
        currentActor.id,
        type,
        body,
        file,
      );
      results.push(stored);
    }
    return results;
  }

  async createForOwner(
    ownerType: string,
    ownerId: string,
    type: 'image' | 'document',
    body: MediaInputFields,
    file: UploadedFile,
    options: StoreMediaOptions = {},
  ) {
    return this.storeMedia(ownerType, ownerId, type, body, file, options);
  }

  async presign(actor: RequestActor | undefined, body: MediaInputFields) {
    const currentActor = this.requireActor(actor);
    const type =
      String(body.type ?? 'image') === 'document' ? 'document' : 'image';
    const mimeType = String(body.mime_type ?? body.mimeType ?? '');
    const size = Number(body.size ?? 0);
    this.assertUploadAllowed(type, mimeType, size);
    const filename = this.safeFilename(String(body.filename ?? `${type}.bin`));
    const maxSize = this.maxSize(type);
    const expiresInSeconds = 900;

    const config = this.r2Config();
    if (config) {
      const objectKey = `${type}/${randomUUID()}${this.extensionForMime(mimeType)}`;
      const target = this.r2TargetForBucket(type, config);
      const client = this.r2Client(config);

      try {
        const uploadUrl = await getSignedUrl(
          client,
          new PutObjectCommand({
            Bucket: target.bucket,
            Key: objectKey,
            ContentType: mimeType,
          }),
          { expiresIn: expiresInSeconds },
        );

        return {
          owner_id: currentActor.id,
          upload_url: uploadUrl,
          method: 'PUT',
          fields: {},
          headers: {
            'content-type': mimeType,
          },
          expires_in_seconds: expiresInSeconds,
          filename,
          mime_type: mimeType,
          max_size: maxSize,
          bucket: type,
          object_key: objectKey,
          url: this.r2PublicUrl(config, target.bucket, objectKey),
        };
      } catch (error) {
        throw this.storageError('create presigned upload URL', error);
      }
    }

    return {
      owner_id: currentActor.id,
      upload_url: `${this.publicOrigin()}/uploads/${type === 'document' ? 'documents' : 'images'}`,
      method: 'POST',
      fields: {},
      expires_in_seconds: expiresInSeconds,
      filename,
      mime_type: mimeType,
      max_size: maxSize,
    };
  }

  async delete(actor: RequestActor | undefined, id: string) {
    const currentActor = this.requireActor(actor);

    const file = await this.findMediaFile(id);
    this.assertMediaAccess(currentActor, file);

    await this.deleteStoredObject(file);

    await this.pg.query(
      'UPDATE media_files SET deleted_at = $1 WHERE id = $2',
      [new Date().toISOString(), id],
    );

    return { id, deleted: true };
  }

  async download(actor: RequestActor | undefined, id: string) {
    const currentActor = this.requireActor(actor);
    const file = await this.findMediaFile(id);
    this.assertMediaAccess(currentActor, file);

    const expiresInSeconds = 900;
    const config = this.r2Config();
    if (config && file.object_key) {
      const target = this.r2TargetForBucket(file.bucket, config);
      if (
        target.bucket === config.publicBucket &&
        file.visibility === 'public' &&
        file.url
      ) {
        return {
          id: file.id,
          download_url: file.url,
          expires_in_seconds: null,
        };
      }

      try {
        const downloadUrl = await getSignedUrl(
          this.r2Client(config),
          new GetObjectCommand({
            Bucket: target.bucket,
            Key: file.object_key,
          }),
          { expiresIn: expiresInSeconds },
        );
        return {
          id: file.id,
          download_url: downloadUrl,
          expires_in_seconds: expiresInSeconds,
        };
      } catch (error) {
        throw this.storageError('create signed download URL', error);
      }
    }

    if (file.url) {
      return {
        id: file.id,
        download_url: file.url,
        expires_in_seconds: null,
      };
    }

    throw new NotFoundException({
      code: 'UPLOAD_DOWNLOAD_NOT_AVAILABLE',
      message: 'Fayl yuklab olish manzili topilmadi',
    });
  }

  /**
   * Ichki (backend-generatsiya qilingan) hujjatlarni — masalan export
   * fayllarini — R2'ning PRIVATE bucket'iga yozadi. Foydalanuvchi
   * yuklamalaridan farqli o'laroq, bu yerda hech qanday content-type/hajm
   * validatsiyasi qilinmaydi, chunki chaqiruvchi (server kodi) fayl
   * mazmunini o'zi generatsiya qiladi, tashqi kirish emas.
   */
  async uploadDocument(
    objectKey: string,
    buffer: Buffer,
    contentType: string,
  ): Promise<{ objectKey: string }> {
    const config = this.r2Config();
    if (!config) {
      throw new InternalServerErrorException({
        code: 'OBJECT_STORAGE_ERROR',
        message: "Fayl saqlash xizmati sozlanmagan (R2 konfiguratsiyasi yo'q)",
      });
    }

    const target = this.r2TargetForBucket('document', config);
    const client = this.r2Client(config);

    try {
      await client.send(
        new PutObjectCommand({
          Bucket: target.bucket,
          Key: objectKey,
          Body: buffer,
          ContentType: contentType,
        }),
      );
    } catch (error) {
      throw this.storageError('upload document', error);
    }

    return { objectKey };
  }

  /**
   * `uploadDocument` orqali yozilgan ichki hujjat uchun vaqtinchalik
   * (default 5 daqiqa) yuklab olish havolasi yaratadi.
   */
  async signDocumentDownload(
    objectKey: string,
    expiresInSeconds = 300,
  ): Promise<string> {
    const config = this.r2Config();
    if (!config) {
      throw new InternalServerErrorException({
        code: 'OBJECT_STORAGE_ERROR',
        message: "Fayl saqlash xizmati sozlanmagan (R2 konfiguratsiyasi yo'q)",
      });
    }

    const target = this.r2TargetForBucket('document', config);

    try {
      return await getSignedUrl(
        this.r2Client(config),
        new GetObjectCommand({ Bucket: target.bucket, Key: objectKey }),
        { expiresIn: expiresInSeconds },
      );
    } catch (error) {
      throw this.storageError('create signed download URL', error);
    }
  }

  private assertUploadAllowed(
    type: 'image' | 'document',
    mimeType: string,
    size: number,
    maxSizeOverride?: number,
  ) {
    const allowed =
      type === 'image'
        ? ['image/jpeg', 'image/png', 'image/webp']
        : ['application/pdf', 'image/jpeg', 'image/png'];

    if (!allowed.includes(mimeType)) {
      throw new BadRequestException({
        code: 'UPLOAD_MIME_NOT_ALLOWED',
        message: 'Fayl turi ruxsat etilmagan',
      });
    }

    const maxSize = maxSizeOverride ?? this.maxSize(type);
    if (!Number.isFinite(size) || size <= 0 || size > maxSize) {
      throw new BadRequestException({
        code: 'UPLOAD_SIZE_INVALID',
        message: 'Fayl hajmi ruxsat etilgan chegaradan tashqarida',
      });
    }
  }

  private requireActor(actor: RequestActor | undefined): RequestActor {
    if (!actor) {
      throw new UnauthorizedException({
        code: 'AUTH_TOKEN_INVALID',
        message: 'Sessiya topilmadi yoki token yaroqsiz',
      });
    }
    return actor;
  }

  private async findMediaFile(id: string): Promise<MediaFileRow> {
    const [file] = await this.pg.query<MediaFileRow>(
      'SELECT id, owner_id, bucket, object_key, url, visibility FROM media_files WHERE id = $1 AND deleted_at IS NULL',
      [id],
    );

    if (!file) {
      throw new NotFoundException({
        code: 'UPLOAD_NOT_FOUND',
        message: 'Fayl topilmadi',
      });
    }

    return file;
  }

  private assertMediaAccess(actor: RequestActor, file: MediaFileRow): void {
    if (
      actor.role !== Role.SUPER_ADMIN &&
      actor.actorType !== 'admin' &&
      file.owner_id !== actor.id
    ) {
      throw new ForbiddenException({
        code: 'UPLOAD_FORBIDDEN',
        message: 'Bu fayl sizga tegishli emas',
      });
    }
  }

  private async deleteStoredObject(file: MediaFileRow): Promise<void> {
    const config = this.r2Config();
    if (!config || !file.object_key) {
      return;
    }

    const target = this.r2TargetForBucket(file.bucket, config);
    try {
      await this.r2Client(config).send(
        new DeleteObjectCommand({
          Bucket: target.bucket,
          Key: file.object_key,
        }),
      );
    } catch (error) {
      throw this.storageError('delete object', error);
    }
  }

  private async storeMedia(
    ownerType: string,
    ownerId: string,
    type: 'image' | 'document',
    body: MediaInputFields,
    file?: UploadedFile,
    options: StoreMediaOptions = {},
  ) {
    const mimeType =
      file?.mimetype ?? String(body.mime_type ?? body.mimeType ?? '');
    const size = file?.size ?? Number(body.size ?? 0);
    this.assertUploadAllowed(type, mimeType, size, options.maxSize);

    const id = randomUUID();
    const now = new Date().toISOString();
    const bucket = options.bucket ?? type;
    if (file) {
      this.assertFileSignature(file);
    }
    const stored = file ? await this.persistFile(bucket, file) : undefined;
    const providedUrl = this.safeProvidedUrl(body.url);
    if (!stored && !providedUrl) {
      throw new BadRequestException({
        code: 'UPLOAD_FILE_REQUIRED',
        message: 'Fayl yoki real URL yuborilishi kerak',
      });
    }
    // `providedUrl` ikki xil manbadan kelishi mumkin: (a) presign+to'g'ridan-
    // to'g'ri-R2-ga-yuklash oqimi (bizning o'z bucket'imiz) yoki (b) tashqi
    // CMS URL (`CreateMediaDto.url` — bu holatda haqiqatan ham tashqi manba,
    // bizda emas). Faqat (a) holatda — obyekt bizning bucket'imizda ekanini
    // aniqlasak — R2'dan haqiqiy bayt-imzoni o'qib, mijoz e'lon qilgan
    // `mimeType` bilan solishtiramiz. Bu — to'g'ridan-to'g'ri multipart
    // yuklashda ishlatiladigan `assertFileSignature()` bilan bir xil
    // himoyani presign yo'liga ham olib keladi (Content-Type spoofing'ga
    // qarshi, PHASE 14E).
    if (!stored && providedUrl) {
      await this.verifyRemoteObjectSignatureIfOwned(providedUrl, mimeType);
    }
    const objectKey =
      stored?.objectKey ?? `${ownerType}/${ownerId}/${randomUUID()}`;
    const url = stored?.url ?? providedUrl;
    const visibility = this.visibilityForBucket(bucket);
    const caption = body.caption ? String(body.caption).slice(0, 255) : null;

    try {
      const [media] = await this.pg.query(
        `INSERT INTO media_files (id, owner_type, owner_id, bucket, object_key, url, mime_type, size, visibility, caption, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING *`,
        [
          id,
          ownerType,
          ownerId,
          bucket,
          objectKey,
          url,
          mimeType,
          size,
          visibility,
          caption,
          now,
        ],
      );
      return media;
    } catch (error) {
      if (stored?.absolutePath) {
        await unlink(stored.absolutePath).catch(() => undefined);
      }
      throw error;
    }
  }

  private async persistFile(bucket: string, file: UploadedFile) {
    const r2Config = this.r2Config();
    if (r2Config) {
      return this.persistR2File(bucket, file, r2Config);
    }
    return this.persistLocalFile(bucket, file);
  }

  private async persistLocalFile(
    bucket: string,
    file: UploadedFile,
  ): Promise<StoredUpload> {
    const extension = this.extensionForMime(file.mimetype);
    const filename = `${randomUUID()}${extension}`;
    const relativePath = join(bucket, filename);
    const absolutePath = join(this.uploadRoot(), relativePath);

    await mkdir(dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, file.buffer, { flag: 'wx' });

    return {
      absolutePath,
      objectKey: relativePath,
      url: `${this.publicOrigin()}/uploads/${relativePath.replace(/\\/g, '/')}`,
    };
  }

  private async persistR2File(
    bucket: string,
    file: UploadedFile,
    config: R2StorageConfig,
  ): Promise<StoredUpload> {
    const extension = this.extensionForMime(file.mimetype);
    const objectKey = `${bucket}/${randomUUID()}${extension}`;
    const target = this.r2TargetForBucket(bucket, config);
    const client = this.r2Client(config);

    try {
      await client.send(
        new PutObjectCommand({
          Bucket: target.bucket,
          Key: objectKey,
          Body: file.buffer,
          ContentType: file.mimetype,
        }),
      );
    } catch (error) {
      throw this.storageError('upload object', error);
    }

    return {
      objectKey,
      url: this.r2PublicUrl(config, target.bucket, objectKey),
    };
  }

  private async validateObjectStorage(): Promise<void> {
    if (process.env.NODE_ENV === 'test') {
      this.logger.log('Object storage startup validation skipped in test');
      return;
    }

    const config = this.r2Config();
    if (!config) {
      this.logger.log(
        'Object storage is not configured; local upload storage is active',
      );
      return;
    }

    const client = this.r2Client(config);
    const buckets = Array.from(
      new Set([config.publicBucket, config.privateBucket]),
    );

    try {
      await Promise.all(
        buckets.map((bucket) => this.verifyR2BucketAccess(client, bucket)),
      );
      this.logger.log(
        `Cloudflare R2 storage ready: endpoint=${redactEndpoint(config.endpoint)}, public_bucket=${config.publicBucket}, private_bucket=${config.privateBucket}`,
      );
    } catch (error) {
      this.logger.error(
        `Cloudflare R2 startup validation failed: ${describeStorageError(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  private async verifyR2BucketAccess(
    client: S3Client,
    bucket: string,
  ): Promise<void> {
    try {
      await client.send(new HeadBucketCommand({ Bucket: bucket }));
      this.logger.log(`Cloudflare R2 bucket access verified: ${bucket}`);
    } catch (error) {
      throw this.storageError(`verify bucket access for ${bucket}`, error);
    }
  }

  private r2Client(config: R2StorageConfig): S3Client {
    return new S3Client({
      region: config.region,
      endpoint: config.endpoint,
      forcePathStyle: config.forcePathStyle,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  }

  private r2TargetForBucket(
    logicalBucket: string,
    config: R2StorageConfig,
  ): { bucket: string } {
    if (logicalBucket === 'document' || logicalBucket === 'documents') {
      return { bucket: config.privateBucket };
    }

    return { bucket: config.publicBucket };
  }

  private visibilityForBucket(logicalBucket: string): 'public' | 'private' {
    if (logicalBucket === 'document' || logicalBucket === 'documents') {
      return 'private';
    }

    return 'public';
  }

  private uploadRoot(): string {
    return process.env.UPLOADS_DIR ?? join(process.cwd(), 'uploads');
  }

  private publicOrigin(): string {
    return (
      process.env.PUBLIC_API_ORIGIN ??
      `http://localhost:${process.env.PORT ?? '4000'}`
    ).replace(/\/$/, '');
  }

  private extensionForMime(mimeType: string): string {
    switch (mimeType) {
      case 'image/jpeg':
        return '.jpg';
      case 'image/png':
        return '.png';
      case 'image/webp':
        return '.webp';
      case 'application/pdf':
        return '.pdf';
      default:
        return '.bin';
    }
  }

  private maxSize(type: 'image' | 'document'): number {
    return type === 'image' ? 5 * 1024 * 1024 : 10 * 1024 * 1024;
  }

  private assertFileSignature(file: UploadedFile) {
    if (!Buffer.isBuffer(file.buffer) || file.buffer.length < 4) {
      throw new BadRequestException({
        code: 'UPLOAD_SIGNATURE_INVALID',
        message: 'Fayl tarkibi ruxsat etilgan turga mos emas',
      });
    }

    if (!matchesSignature(file.buffer, file.mimetype)) {
      throw new BadRequestException({
        code: 'UPLOAD_SIGNATURE_INVALID',
        message: 'Fayl tarkibi ruxsat etilgan turga mos emas',
      });
    }
  }

  /**
   * Presign+to'g'ridan-to'g'ri-R2-ga-yuklash oqimida fayl baytlari backend
   * orqali hech qachon o'tmaydi — shu sabab mijoz e'lon qilgan Content-Type
   * (`mimeType`) tekshirilmagan bo'lib qolar edi (PHASE 14D MEDIUM-3).
   * Agar `url` bizning o'z R2 bucket'imizdagi obyektga ishora qilsa, uning
   * dastlabki baytlarini (Range so'rovi bilan, to'liq faylni emas) o'qib,
   * haqiqiy bayt-imzoni e'lon qilingan `mimeType` bilan solishtiramiz —
   * xuddi to'g'ridan-to'g'ri yuklashda ishlatiladigan tekshiruv kabi.
   *
   * `url` tashqi (bizning bucket'imizga tegishli bo'lmagan) manba bo'lsa —
   * bu tekshiruv butunlay o'tkazib yuboriladi (bu — alohida, mavjud
   * ishonch modeli: `CreateMediaDto.url`ning o'zi tashqi CMS URL'lariga
   * ham ruxsat beradi).
   */
  private async verifyRemoteObjectSignatureIfOwned(
    url: string,
    mimeType: string,
  ): Promise<void> {
    const config = this.r2Config();
    if (!config) return;

    const owned = this.resolveOwnR2Object(url, config);
    if (!owned) return;

    // Faqat imzo-tekshiruvi qamrab olgan turlar uchun (image/document) —
    // boshqa MIME allaqachon `assertUploadAllowed()` orqali rad etilgan
    // bo'ladi, shuning uchun bu yerga faqat ruxsat etilgan 4 tadan biri
    // yetib keladi.
    let signatureBytes: Buffer;
    try {
      const client = this.r2Client(config);
      const response = await client.send(
        new GetObjectCommand({
          Bucket: owned.bucket,
          Key: owned.objectKey,
          Range: 'bytes=0-15',
        }),
      );
      signatureBytes = await streamToBuffer(response.Body);
    } catch (error) {
      throw this.storageError('verify uploaded object signature', error);
    }

    if (!matchesSignature(signatureBytes, mimeType)) {
      throw new BadRequestException({
        code: 'UPLOAD_SIGNATURE_INVALID',
        message: 'Fayl tarkibi ruxsat etilgan turga mos emas',
      });
    }
  }

  /**
   * `url` bizning o'z R2 konfiguratsiyamiz (`r2PublicUrl()`) tomonidan
   * generatsiya qilingan bo'lishi mumkin bo'lgan ikkala shaklni ham
   * (public base URL orqali VA to'g'ridan-to'g'ri endpoint/bucket/key
   * orqali) tan oladi. Mos kelmasa — `undefined` (tashqi URL, tekshirilmaydi).
   */
  private resolveOwnR2Object(
    url: string,
    config: R2StorageConfig,
  ): { bucket: string; objectKey: string } | undefined {
    if (config.publicBaseUrl) {
      const base = `${config.publicBaseUrl.replace(/\/$/, '')}/`;
      if (url.startsWith(base)) {
        const objectKey = url.slice(base.length);
        return objectKey
          ? { bucket: config.publicBucket, objectKey }
          : undefined;
      }
    }

    const endpointBase = `${config.endpoint.replace(/\/$/, '')}/`;
    if (url.startsWith(endpointBase)) {
      const rest = url.slice(endpointBase.length);
      const slashIndex = rest.indexOf('/');
      if (slashIndex <= 0) return undefined;
      const bucket = rest.slice(0, slashIndex);
      const objectKey = rest.slice(slashIndex + 1);
      if (
        (bucket === config.publicBucket || bucket === config.privateBucket) &&
        objectKey
      ) {
        return { bucket, objectKey };
      }
    }

    return undefined;
  }

  private safeProvidedUrl(value: unknown): string | undefined {
    if (typeof value !== 'string') {
      return undefined;
    }

    const url = value.trim();
    if (!url) {
      return undefined;
    }

    if (hasControlChars(url)) {
      throw new BadRequestException({
        code: 'UPLOAD_URL_INVALID',
        message: 'Fayl URL manzili yaroqsiz',
      });
    }

    if (url.startsWith('/') && !url.startsWith('//')) {
      return url;
    }

    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new BadRequestException({
        code: 'UPLOAD_URL_INVALID',
        message: 'Fayl URL manzili yaroqsiz',
      });
    }

    if (
      (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') ||
      parsed.username ||
      parsed.password
    ) {
      throw new BadRequestException({
        code: 'UPLOAD_URL_INVALID',
        message: 'Fayl URL manzili yaroqsiz',
      });
    }

    return parsed.toString();
  }

  private r2Config(): R2StorageConfig | undefined {
    const publicBucket = firstNonEmpty(process.env.STORAGE_BUCKET_PUBLIC);
    const privateBucket = firstNonEmpty(
      process.env.STORAGE_BUCKET_PRIVATE,
      publicBucket,
    );
    const accessKeyId = firstNonEmpty(process.env.STORAGE_ACCESS_KEY_ID);
    const secretAccessKey = firstNonEmpty(
      process.env.STORAGE_SECRET_ACCESS_KEY,
    );
    const endpoint = firstNonEmpty(process.env.STORAGE_ENDPOINT);

    if (
      !endpoint ||
      !publicBucket ||
      !privateBucket ||
      !accessKeyId ||
      !secretAccessKey
    ) {
      if (
        endpoint ||
        publicBucket ||
        privateBucket ||
        accessKeyId ||
        secretAccessKey
      ) {
        this.logger.warn(
          'Cloudflare R2 environment is incomplete; local upload storage is active',
        );
      }
      return undefined;
    }

    const forcePathStyle = firstNonEmpty(process.env.STORAGE_FORCE_PATH_STYLE);

    return {
      publicBucket,
      privateBucket,
      accessKeyId,
      secretAccessKey,
      region: firstNonEmpty(process.env.STORAGE_REGION) ?? 'auto',
      endpoint,
      forcePathStyle:
        forcePathStyle === undefined
          ? isCloudflareR2Endpoint(endpoint)
          : forcePathStyle.toLowerCase() === 'true',
      publicBaseUrl: firstNonEmpty(process.env.STORAGE_PUBLIC_BASE_URL),
    };
  }

  private r2PublicUrl(
    config: R2StorageConfig,
    bucket: string,
    objectKey: string,
  ): string {
    if (bucket === config.publicBucket && config.publicBaseUrl) {
      return `${config.publicBaseUrl.replace(/\/$/, '')}/${objectKey}`;
    }

    if (config.endpoint) {
      return `${config.endpoint.replace(/\/$/, '')}/${bucket}/${objectKey}`;
    }

    return `https://${bucket}.s3.${config.region}.amazonaws.com/${objectKey}`;
  }

  private storageError(operation: string, error: unknown) {
    const detail = describeStorageError(error);
    this.logger.error(`Cloudflare R2 ${operation} failed: ${detail}`);
    return new InternalServerErrorException({
      code: 'OBJECT_STORAGE_ERROR',
      message: 'Fayl saqlash xizmatida xatolik yuz berdi',
    });
  }

  private safeFilename(value: string): string {
    return value
      .replace(/[/\\?%*:|"<>]/g, '-')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 120);
  }
}

function isJpeg(buffer: Buffer): boolean {
  return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
}

function isPng(buffer: Buffer): boolean {
  return buffer
    .subarray(0, 8)
    .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
}

function isWebp(buffer: Buffer): boolean {
  return (
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  );
}

function isPdf(buffer: Buffer): boolean {
  return buffer.subarray(0, 5).toString('ascii') === '%PDF-';
}

async function streamToBuffer(
  body: import('@aws-sdk/client-s3').GetObjectCommandOutput['Body'],
): Promise<Buffer> {
  const chunks: Buffer[] = [];
  // AWS SDK v3'ning Node.js runtime'idagi `Body` — `Readable` stream
  // (browser/edge runtime'da boshqacha bo'lardi, backend bu yerda doim
  // Node.js'da ishlaydi).
  for await (const chunk of body as AsyncIterable<Buffer | Uint8Array>) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

function matchesSignature(buffer: Buffer, mimetype: string): boolean {
  return (
    (mimetype === 'image/jpeg' && isJpeg(buffer)) ||
    (mimetype === 'image/png' && isPng(buffer)) ||
    (mimetype === 'image/webp' && isWebp(buffer)) ||
    (mimetype === 'application/pdf' && isPdf(buffer))
  );
}

function hasControlChars(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code <= 31 || code === 127) {
      return true;
    }
  }
  return false;
}

function firstNonEmpty(
  ...values: Array<string | undefined>
): string | undefined {
  for (const value of values) {
    if (value && value.trim()) {
      return value.trim();
    }
  }
  return undefined;
}

function isCloudflareR2Endpoint(endpoint: string): boolean {
  try {
    return new URL(endpoint).hostname.endsWith('.r2.cloudflarestorage.com');
  } catch {
    return false;
  }
}

function redactEndpoint(endpoint: string): string {
  try {
    const url = new URL(endpoint);
    url.username = '';
    url.password = '';
    return url.toString().replace(/\/$/, '');
  } catch {
    return 'configured-endpoint';
  }
}

function describeStorageError(error: unknown): string {
  if (!error || typeof error !== 'object') {
    return 'unknown storage error';
  }

  const value = error as {
    name?: string;
    message?: string;
    Code?: string;
    $metadata?: {
      httpStatusCode?: number;
      requestId?: string;
      extendedRequestId?: string;
    };
  };
  const parts = [
    value.name ?? value.Code,
    value.message,
    value.$metadata?.httpStatusCode
      ? `status=${value.$metadata.httpStatusCode}`
      : undefined,
    value.$metadata?.requestId
      ? `request_id=${value.$metadata.requestId}`
      : undefined,
  ].filter(Boolean);

  return parts.length ? parts.join(' | ') : 'unknown storage error';
}
