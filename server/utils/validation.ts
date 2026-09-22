import { createError, readBody, type H3Event } from 'h3'
import type { ZodType } from 'zod'

export async function readValidatedJson<T>(event: H3Event, schema: ZodType<T>): Promise<T> {
  const result = schema.safeParse(await readBody<unknown>(event))
  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid request body',
      data: { issues: result.error.issues.map(issue => ({
        path: issue.path.join('.'), message: issue.message
      })) }
    })
  }
  return result.data
}
