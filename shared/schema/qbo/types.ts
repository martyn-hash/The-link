import { z } from 'zod';
import { qboConnections, qboOAuthStates } from './tables';
import { insertQboConnectionSchema, updateQboConnectionSchema, insertQboOAuthStateSchema } from './schemas';

export type QboConnection = typeof qboConnections.$inferSelect;
export type InsertQboConnection = z.infer<typeof insertQboConnectionSchema>;
export type UpdateQboConnection = z.infer<typeof updateQboConnectionSchema>;

export type QboOAuthState = typeof qboOAuthStates.$inferSelect;
export type InsertQboOAuthState = z.infer<typeof insertQboOAuthStateSchema>;

export interface QboConnectionWithClient extends QboConnection {
  client?: {
    id: string;
    name: string;
    companyNumber?: string | null;
  };
  connectedByUser?: {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
  };
}

export interface QboTokens {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: Date;
  refreshTokenExpiresAt: Date;
  realmId: string;
  scope?: string;
}
