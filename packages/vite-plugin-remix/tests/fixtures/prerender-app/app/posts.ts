export interface Post {
    slug: string;
    title: string;
}

export let posts: Post[] = [
    { slug: "hello-world", title: "Hello world" },
    { slug: "second-post", title: "Second post" },
];
