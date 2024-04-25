export interface AuthenticationCreateRequest {
    email:    string;
    password: string;
    strategy: Strategy;
}

export enum Strategy {
    Local = "local",
}

export interface NewCollection {
    description?: string;
    name:         string;
    status?:      string;
}
