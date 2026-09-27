export type ScrapFolder={id:string;name:string;isDefault:number;spotIds:string[];createdAt:string;updatedAt:string};
export type Course={id:string;userId:string;nickname:string;title:string;description:string;mode:'walk'|'run';spotIds:string[];createdAt:string;updatedAt:string};
export type Collections={folders:ScrapFolder[];courses:Course[]};
export const MAX_COURSE_STOPS=6;
