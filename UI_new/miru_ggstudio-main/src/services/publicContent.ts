import { z } from 'zod';
import { api, parseApi } from './api';

export const PublicIdentityAliasResponseSchema = z.object({
  success: z.boolean(),
  link: z.record(z.unknown()).optional(),
});

export type PublicIdentityAliasResponse = z.infer<typeof PublicIdentityAliasResponseSchema>;

const PublicIdentityAliasResponseSchemaForParse =
  PublicIdentityAliasResponseSchema as unknown as z.ZodType<PublicIdentityAliasResponse>;

export async function aliasPublicIdentity(payload: {
  anonymous_id: string;
  session_id?: string | null;
}) {
  return parseApi(
    api.post('/api/public/identity/alias', payload),
    PublicIdentityAliasResponseSchemaForParse
  );
}
