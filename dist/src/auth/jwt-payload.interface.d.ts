export type UserRole = 'USER' | 'ADMIN' | 'MANAGER' | 'STAFF' | 'OTHER' | string;
export interface JwtUserPayload {
    userId: string;
    username: string;
    role?: UserRole;
}
