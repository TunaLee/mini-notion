export type Todo = { id: string; text: string; done: boolean };

export type PageContent = { title: string; body: string; todos: Todo[] };

export type PageSummary = { id: number; parentId: number | null; title: string };

export type Page = PageContent & PageSummary & { version: number };
