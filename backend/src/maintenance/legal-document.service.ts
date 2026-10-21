import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'

import {
  InjectRepository,
} from '@nestjs/typeorm'

import {
  DataSource,
  Repository,
} from 'typeorm'

import {
  createHash,
} from 'crypto'

import {
  LegalDocument,
  LegalDocumentType,
} from './legal-document.entity'

@Injectable()
export class LegalDocumentService {
  constructor(
    @InjectRepository(
      LegalDocument,
    )
    private readonly legalRepo:
      Repository<LegalDocument>,

    private readonly dataSource:
      DataSource,
  ) {}

  private documentHash(
    content: string,
  ) {
    return createHash(
      'sha256',
    )
      .update(
        content,
        'utf8',
      )
      .digest(
        'hex',
      )
  }

  private cleanType(
    value: unknown,
  ): LegalDocumentType {
    const normalized =
      String(
        value || '',
      )
        .trim()
        .toUpperCase()
        .replace(
          /-/g,
          '_',
        )

    const aliases:
      Record<
        string,
        LegalDocumentType
      > = {
        TERMS:
          'TERMS',

        PRIVACY:
          'PRIVACY',

        SALES:
          'SALES_PARTNER_AGREEMENT',

        SALES_AGREEMENT:
          'SALES_PARTNER_AGREEMENT',

        SALES_PARTNER_AGREEMENT:
          'SALES_PARTNER_AGREEMENT',
      }

    const result =
      aliases[
        normalized
      ]

    if (!result) {
      throw new BadRequestException(
        'Invalid legal document type.',
      )
    }

    return result
  }

  private cleanVersion(
    value: unknown,
  ) {
    const version =
      String(
        value || '',
      ).trim()

    if (
      version.length < 1 ||
      version.length > 64
    ) {
      throw new BadRequestException(
        'Document version is required and must be 64 characters or fewer.',
      )
    }

    return version
  }

  private cleanTitle(
    value: unknown,
  ) {
    const title =
      String(
        value || '',
      ).trim()

    if (
      title.length < 3 ||
      title.length > 255
    ) {
      throw new BadRequestException(
        'Document title must be between 3 and 255 characters.',
      )
    }

    return title
  }

  private cleanContent(
    value: unknown,
  ) {
    const content =
      String(
        value || '',
      ).trim()

    if (
      content.length < 20
    ) {
      throw new BadRequestException(
        'Legal document content is too short.',
      )
    }

    return content
  }

  private cleanEffectiveDate(
    value: unknown,
  ) {
    const effectiveDate =
      String(
        value || '',
      ).trim()

    if (
      !/^\d{4}-\d{2}-\d{2}$/
        .test(
          effectiveDate,
        )
    ) {
      throw new BadRequestException(
        'Effective date must use YYYY-MM-DD.',
      )
    }

    const parsed =
      new Date(
        `${effectiveDate}T00:00:00Z`,
      )

    if (
      Number.isNaN(
        parsed.getTime(),
      ) ||
      parsed
        .toISOString()
        .slice(
          0,
          10,
        ) !==
        effectiveDate
    ) {
      throw new BadRequestException(
        'Effective date is invalid.',
      )
    }

    return effectiveDate
  }

  async list() {
    const documents =
      await this.legalRepo.find({
        order: {
          documentType:
            'ASC',

          createdAt:
            'DESC',
        },
      })

    return {
      documents,
    }
  }

  async createDraft(
    body: {
      documentType?: unknown
      version?: unknown
      title?: unknown
      effectiveDate?: unknown
      content?: unknown
      requiresReacceptance?: unknown
    },
  ) {
    const documentType =
      this.cleanType(
        body.documentType,
      )

    const version =
      this.cleanVersion(
        body.version,
      )

    const title =
      this.cleanTitle(
        body.title,
      )

    const effectiveDate =
      this.cleanEffectiveDate(
        body.effectiveDate,
      )

    const content =
      this.cleanContent(
        body.content,
      )

    const existing =
      await this.legalRepo
        .findOne({
          where: {
            documentType,
            version,
          },
        })

    if (existing) {
      throw new BadRequestException(
        'That document version already exists.',
      )
    }

    const document =
      this.legalRepo.create({
        documentType,
        version,
        title,
        effectiveDate,
        status:
          'DRAFT',
        content,
        contentHash:
          this.documentHash(
            content,
          ),
        requiresReacceptance:
          body.requiresReacceptance ===
          true,
        publishedAt:
          null,
        archivedAt:
          null,
      })

    const saved =
      await this.legalRepo.save(
        document,
      )

    return {
      success:
        true,

      document:
        saved,
    }
  }

  async updateDraft(
    idValue: unknown,
    body: {
      version?: unknown
      title?: unknown
      effectiveDate?: unknown
      content?: unknown
      requiresReacceptance?: unknown
    },
  ) {
    const id =
      String(
        idValue || '',
      ).trim()

    const document =
      await this.legalRepo
        .findOne({
          where: {
            id,
          },
        })

    if (!document) {
      throw new NotFoundException(
        'Legal document not found.',
      )
    }

    if (
      document.status !==
      'DRAFT'
    ) {
      throw new BadRequestException(
        'Published or archived legal documents are immutable.',
      )
    }

    if (
      body.version !==
      undefined
    ) {
      const nextVersion =
        this.cleanVersion(
          body.version,
        )

      if (
        nextVersion !==
        document.version
      ) {
        const duplicate =
          await this.legalRepo
            .findOne({
              where: {
                documentType:
                  document.documentType,

                version:
                  nextVersion,
              },
            })

        if (duplicate) {
          throw new BadRequestException(
            'That document version already exists.',
          )
        }

        document.version =
          nextVersion
      }
    }

    if (
      body.title !==
      undefined
    ) {
      document.title =
        this.cleanTitle(
          body.title,
        )
    }

    if (
      body.effectiveDate !==
      undefined
    ) {
      document.effectiveDate =
        this.cleanEffectiveDate(
          body.effectiveDate,
        )
    }

    if (
      body.content !==
      undefined
    ) {
      document.content =
        this.cleanContent(
          body.content,
        )

      document.contentHash =
        this.documentHash(
          document.content,
        )
    }

    if (
      body.requiresReacceptance !==
      undefined
    ) {
      document.requiresReacceptance =
        body.requiresReacceptance ===
        true
    }

    const saved =
      await this.legalRepo.save(
        document,
      )

    return {
      success:
        true,

      document:
        saved,
    }
  }

  async publish(
    idValue: unknown,
  ) {
    const id =
      String(
        idValue || '',
      ).trim()

    return this.dataSource
      .transaction(
        async (
          manager,
        ) => {
          const repo =
            manager.getRepository(
              LegalDocument,
            )

          const target =
            await repo.findOne({
              where: {
                id,
              },
              lock: {
                mode:
                  'pessimistic_write',
              },
            })

          if (!target) {
            throw new NotFoundException(
              'Legal document not found.',
            )
          }

          if (
            target.status !==
            'DRAFT'
          ) {
            throw new BadRequestException(
              'Only a draft may be published.',
            )
          }

          const current =
            await repo.findOne({
              where: {
                documentType:
                  target.documentType,

                status:
                  'PUBLISHED',
              },

              lock: {
                mode:
                  'pessimistic_write',
              },
            })

          const now =
            new Date()

          if (current) {
            current.status =
              'ARCHIVED'

            current.archivedAt =
              now

            await repo.save(
              current,
            )
          }

          target.status =
            'PUBLISHED'

          target.publishedAt =
            now

          target.archivedAt =
            null

          target.contentHash =
            this.documentHash(
              target.content,
            )

          const saved =
            await repo.save(
              target,
            )

          return {
            success:
              true,

            document:
              saved,
          }
        },
      )
  }

  async archive(
    idValue: unknown,
  ) {
    const id =
      String(
        idValue || '',
      ).trim()

    const document =
      await this.legalRepo
        .findOne({
          where: {
            id,
          },
        })

    if (!document) {
      throw new NotFoundException(
        'Legal document not found.',
      )
    }

    if (
      document.status ===
      'ARCHIVED'
    ) {
      return {
        success:
          true,

        document,
      }
    }

    if (
      document.status ===
      'PUBLISHED'
    ) {
      throw new BadRequestException(
        'A published legal document cannot be archived directly. Publish a replacement version instead.',
      )
    }

    document.status =
      'ARCHIVED'

    document.archivedAt =
      new Date()

    const saved =
      await this.legalRepo.save(
        document,
      )

    return {
      success:
        true,

      document:
        saved,
    }
  }

  async getPublished(
    typeValue: unknown,
  ) {
    const documentType =
      this.cleanType(
        typeValue,
      )

    const document =
      await this.legalRepo
        .findOne({
          where: {
            documentType,
            status:
              'PUBLISHED',
          },
        })

    if (!document) {
      throw new NotFoundException(
        'No published legal document is available.',
      )
    }

    return {
      documentType:
        document.documentType,

      title:
        document.title,

      version:
        document.version,

      effectiveDate:
        document.effectiveDate,

      contentHash:
        document.contentHash,

      requiresReacceptance:
        document.requiresReacceptance,

      publishedAt:
        document.publishedAt,

      content:
        document.content,
    }
  }
}
