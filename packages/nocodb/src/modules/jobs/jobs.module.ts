import { forwardRef, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { RecoverDisconnectedTableNames } from './migration-jobs/nc_job_008_recover_disconnected_table_name';
import { MigrateController } from '~/modules/jobs/jobs/export-import/migrate.controller';
import { MigrateService } from '~/modules/jobs/jobs/export-import/migrate.service';
import { NocoModule } from '~/modules/noco.module';
import { getRedisURL, NC_REDIS_TYPE } from '~/helpers/redisHelpers';

// 导入各种作业相关的服务和处理器
// 导出导入相关
import { ExportService } from '~/modules/jobs/jobs/export-import/export.service';
import { ImportService } from '~/modules/jobs/jobs/export-import/import.service';
import { AtImportController } from '~/modules/jobs/jobs/at-import/at-import.controller';
import { AtImportProcessor } from '~/modules/jobs/jobs/at-import/at-import.processor';
import { DuplicateController } from '~/modules/jobs/jobs/export-import/duplicate.controller';
import { DuplicateProcessor } from '~/modules/jobs/jobs/export-import/duplicate.processor';
import { DuplicateService } from '~/modules/jobs/jobs/export-import/duplicate.service';

// 元数据同步相关
import { MetaSyncController } from '~/modules/jobs/jobs/meta-sync/meta-sync.controller';
import { MetaSyncProcessor } from '~/modules/jobs/jobs/meta-sync/meta-sync.processor';

// 数据源管理相关
import { SourceCreateController } from '~/modules/jobs/jobs/source-create/source-create.controller';
import { SourceCreateProcessor } from '~/modules/jobs/jobs/source-create/source-create.processor';
import { SourceDeleteController } from '~/modules/jobs/jobs/source-delete/source-delete.controller';
import { SourceDeleteProcessor } from '~/modules/jobs/jobs/source-delete/source-delete.processor';

// Webhook和数据导出相关
import { WebhookHandlerProcessor } from '~/modules/jobs/jobs/webhook-handler/webhook-handler.processor';
import { DataExportProcessor } from '~/modules/jobs/jobs/data-export/data-export.processor';
import { DataExportController } from '~/modules/jobs/jobs/data-export/data-export.controller';

// 附件和缩略图处理相关
import { ThumbnailGeneratorProcessor } from '~/modules/jobs/jobs/thumbnail-generator/thumbnail-generator.processor';
import { AttachmentCleanUpProcessor } from '~/modules/jobs/jobs/attachment-clean-up/attachment-clean-up';
import { UseWorkerProcessor } from '~/modules/jobs/jobs/use-worker/use-worker.processor';

// 作业处理器和作业映射服务
import { JobsProcessor } from '~/modules/jobs/jobs.processor';
import { JobsMap } from '~/modules/jobs/jobs-map.service';

// 迁移作业相关
import { InitMigrationJobs } from '~/modules/jobs/migration-jobs/init-migration-jobs';
import { AttachmentMigration } from '~/modules/jobs/migration-jobs/nc_job_001_attachment';
import { ThumbnailMigration } from '~/modules/jobs/migration-jobs/nc_job_002_thumbnail';
import { OrderColumnMigration } from '~/modules/jobs/migration-jobs/nc_job_005_order_column';
import { RecoverOrderColumnMigration } from '~/modules/jobs/migration-jobs/nc_job_007_recover_order_column';
import { NoOpMigration } from '~/modules/jobs/migration-jobs/nc_job_no_op';

// 作业模块核心服务
import { JobsLogService } from '~/modules/jobs/jobs/jobs-log.service';
import { JobsController } from '~/modules/jobs/jobs.controller';
import { JobsService } from '~/modules/jobs/redis/jobs.service';
import { JobsEventService } from '~/modules/jobs/jobs-event.service';

// 后备服务（当Redis不可用时使用）
import { JobsService as FallbackJobsService } from '~/modules/jobs/fallback/jobs.service';
import { QueueService as FallbackQueueService } from '~/modules/jobs/fallback/fallback-queue.service';
import { JOBS_QUEUE } from '~/interface/Jobs';
import { RecoverLinksMigration } from '~/modules/jobs/migration-jobs/nc_job_003_recover_links';
import { CleanupDuplicateColumnMigration } from '~/modules/jobs/migration-jobs/nc_job_004_cleanup_duplicate_column';
import { CACHE_PREFIX } from '~/utils/globals';

/**
 * 作业模块的元数据配置
 * 包含模块的导入、控制器、提供者和导出配置
 */
export const JobsModuleMetadata = {
  imports: [
    // 导入NocoModule，使用forwardRef避免循环依赖
    forwardRef(() => NocoModule),
    // 如果Redis可用，配置Bull队列
    ...(getRedisURL(NC_REDIS_TYPE.JOB)
      ? [
          BullModule.forRoot({
            url: getRedisURL(NC_REDIS_TYPE.JOB),
            prefix: CACHE_PREFIX === 'nc' ? undefined : `${CACHE_PREFIX}`,
          }),
          BullModule.registerQueue({
            name: JOBS_QUEUE,
            defaultJobOptions: {
              removeOnComplete: true, // 任务完成后自动删除
              attempts: 1, // 失败重试次数
            },
          }),
        ]
      : []),
  ],
  controllers: [
    JobsController,
    // 如果不是工作容器环境，注册额外的控制器
    ...(process.env.NC_WORKER_CONTAINER !== 'true'
      ? [
          DuplicateController,
          MigrateController,
          AtImportController,
          MetaSyncController,
          SourceCreateController,
          SourceDeleteController,
          DataExportController,
        ]
      : []),
  ],
  providers: [
    // 核心服务
    JobsMap,
    JobsEventService,
    // 根据Redis可用性选择队列服务
    ...(getRedisURL(NC_REDIS_TYPE.JOB) ? [] : [FallbackQueueService]),
    {
      provide: 'JobsService',
      useClass: getRedisURL(NC_REDIS_TYPE.JOB)
        ? JobsService
        : FallbackJobsService,
    },
    JobsLogService,
    JobsProcessor,

    // 各种作业处理器
    ExportService,
    ImportService,
    DuplicateProcessor,
    DuplicateService,
    MigrateService,
    AtImportProcessor,
    MetaSyncProcessor,
    SourceCreateProcessor,
    SourceDeleteProcessor,
    WebhookHandlerProcessor,
    DataExportProcessor,
    ThumbnailGeneratorProcessor,
    AttachmentCleanUpProcessor,
    UseWorkerProcessor,

    // 迁移作业处理器
    InitMigrationJobs,
    AttachmentMigration,
    ThumbnailMigration,
    RecoverLinksMigration,
    CleanupDuplicateColumnMigration,
    OrderColumnMigration,
    NoOpMigration,
    RecoverOrderColumnMigration,
    RecoverDisconnectedTableNames,
  ],
  exports: ['JobsService'], // 导出JobsService供其他模块使用
};

/**
 * 作业模块类
 * 使用@Module装饰器应用模块元数据配置
 */
@Module(JobsModuleMetadata)
export class JobsModule {}
