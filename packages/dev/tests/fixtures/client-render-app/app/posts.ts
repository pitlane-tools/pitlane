export interface Post {
    id: string;
    title: string;
}

export let posts: Post[] = [
    { id: "hello-world", title: "Hello world" },
    { id: "second-post", title: "Second post" },
];
