export interface AdminUser {
    userId: string;
    role: string;
}
export interface AdminAccount {
    accountId: string;
}
export interface CreatedIdentity {
    accountId: string;
    userId: string;
    userKey: string;
}
export type AdminFetch = (input: string | URL, init?: RequestInit) => Promise<Response>;
export declare function listAccounts(url: string, rootApiKey: string, fetchFn?: AdminFetch): Promise<AdminAccount[]>;
export declare function listUsers(url: string, rootApiKey: string, accountId: string, fetchFn?: AdminFetch): Promise<AdminUser[]>;
export declare function createAccount(url: string, rootApiKey: string, accountId: string, userId: string, fetchFn?: AdminFetch): Promise<CreatedIdentity>;
export declare function createUser(url: string, rootApiKey: string, accountId: string, userId: string, fetchFn?: AdminFetch): Promise<CreatedIdentity>;
export declare function rotateUserKey(url: string, rootApiKey: string, accountId: string, userId: string, fetchFn?: AdminFetch): Promise<string>;
