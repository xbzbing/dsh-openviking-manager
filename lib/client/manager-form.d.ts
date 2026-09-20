import { type Translation } from "./i18n.js";
export interface ConfigView {
    url: string;
    account: string;
    user: string;
    apiKeySet: boolean;
    apiKeyMasked: string;
}
export interface ManagerFormProps {
    apiPrefix?: string;
    fetchFn?: typeof fetch;
    t?: Translation;
}
export declare function ManagerForm({ apiPrefix, fetchFn, t }: ManagerFormProps): import("react").JSX.Element;
