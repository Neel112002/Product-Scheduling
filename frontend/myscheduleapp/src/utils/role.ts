// src/utils/role.ts

export const getRoleName = (user: any): string => {
    return user?.role?.name?.toLowerCase() || "";
};

export const isOwner = (user: any): boolean =>
    getRoleName(user) === "owner";

export const isManager = (user: any): boolean =>
    getRoleName(user) === "manager";

export const isAdmin = (user: any): boolean =>
    isOwner(user) || isManager(user);