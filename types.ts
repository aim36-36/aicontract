export interface User {
    name: string;
    role: string;
    email: string;
    avatar: string;
}

export enum Page {
    LOGIN = 'LOGIN',
    PROFILE = 'PROFILE',
    REVIEW = 'REVIEW',
}

export interface NavigationItem {
    label: string;
    icon: string;
    path: string;
    active?: boolean;
}