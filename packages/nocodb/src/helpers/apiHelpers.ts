// 导入 Ajv 库，用于 JSON Schema 验证
import Ajv from 'ajv';
// 导入 ajv-formats 插件，为 Ajv 添加额外的格式验证支持
import addFormats from 'ajv-formats';
// 导入 ErrorObject 类型定义，用于表示 Ajv 验证错误
import type { ErrorObject } from 'ajv';
// 导入 Express 相关类型定义
import type { NextFunction, Request, Response } from 'express';
// 导入 swagger v3 规范
import { swaggerV3 } from '~/schema';
// 导入 swagger 规范
import swagger from '~/schema';
// 导入自定义错误处理类
import { NcError } from '~/helpers/catchError';

/**
 * 将高精度时间转换为毫秒
 * @param hrtime - 高精度时间数组 [秒, 纳秒]
 * @returns 转换后的毫秒数（字符串格式，保留3位小数）
 */
export function parseHrtimeToMilliSeconds(hrtime) {
  const milliseconds = (hrtime[0] * 1000 + hrtime[1] / 1e6).toFixed(3);
  return milliseconds;
}

// 初始化 Ajv 实例，设置不严格模式并启用所有错误收集
const ajv = new Ajv({ strictSchema: false, strict: false, allErrors: true }); // Initialize AJV
// 添加 swagger 规范到 Ajv
ajv.addSchema(swagger, 'swagger.json');
// 添加 swagger v3 规范到 Ajv
ajv.addSchema(swaggerV3, 'swagger-v3.json');
// 为 Ajv 添加格式验证支持
addFormats(ajv);

/**
 * 生成用于验证请求体的中间件
 * @param schema - 用于验证的 schema 引用名称
 * @returns Express 中间件函数
 */
export const getAjvValidatorMw = (schema: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // 获取指定 schema 的验证函数
    const validate = ajv.getSchema(schema);
    // 验证请求体是否符合 schema
    const valid = validate(req.body);

    // 如果请求体验证通过，调用下一个中间件
    if (valid) {
      next();
    } else {
      // 获取验证错误信息
      const errors: ErrorObject[] | null | undefined = ajv.errors;

      // 如果请求体验证失败，返回 400 错误响应
      res.status(400).json({
        message: 'Invalid request body',
        errors,
      });
    }
  };
};

/**
 * 验证数据负载是否符合指定的 schema
 * @param schema - 用于验证的 schema 引用名称
 * @param payload - 需要验证的数据负载
 * @param humanReadableError - 是否需要人类可读的错误信息，默认为 false
 * @throws 如果验证失败，抛出 NcError 错误
 */
export const validatePayload = (
  schema: string,
  payload: any,
  humanReadableError = false,
) => {
  // 获取指定 schema 的验证函数
  const validate = ajv.getSchema(schema);
  // 验证数据负载是否符合 schema
  const valid = validate(payload);

  // 如果数据负载验证失败，抛出错误
  if (!valid) {
    // 获取验证错误信息，优先使用 ajv.errors，如果不存在则使用 validate.errors
    const errors: ErrorObject[] | null | undefined =
      ajv.errors || validate.errors;

    if (humanReadableError) {
      // 以下是被注释掉的代码，用于生成更易读的错误信息
      // let extractedSchema;
      // // extract schema from swagger json
      // if (schema.startsWith('swagger-v3.json#/components/schemas/')) {
      //   extractedSchema =
      //     swaggerV3.components.schemas[
      //       schema.split('swagger-v3.json#/components/schemas/')[1]
      //     ];
      // }
      // errors = betterAjvErrors({
      //   schema: validate.schema,
      //   data: payload,
      //   errors,
      // });
    }

    // 抛出 Ajv 验证错误
    NcError.ajvValidationError({
      message: 'Invalid request body',
      errors,
      humanReadableError,
    });
  }
};
