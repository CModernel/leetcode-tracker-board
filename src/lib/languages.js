// The languages of the Patterns page, in the order they are shown (most used on
// LeetCode first). `id` is the key in each pattern's `templates`, `prism` the id
// the syntax highlighter knows it by and `color` the class of its selected
// button. A language is listed only once every pattern has its template (a test
// checks it), so a half-written language never shows.
export const LANGUAGES = [
  { id: "python", name: "Python", prism: "python", color: "bg-blue-500" },
  { id: "java", name: "Java", prism: "java", color: "bg-red-500" },
  { id: "javascript", name: "JavaScript", prism: "javascript", color: "bg-yellow-500" },
  { id: "go", name: "Go", prism: "go", color: "bg-cyan-500" },
];

export const DEFAULT_LANGUAGE = "python";

export const isLanguage = (id) => LANGUAGES.some((language) => language.id === id);
