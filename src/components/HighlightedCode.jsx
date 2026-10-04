import { PrismLight as SyntaxHighlighter } from "react-syntax-highlighter";
import {
  oneDark,
  oneLight,
} from "react-syntax-highlighter/dist/esm/styles/prism";
import c from "react-syntax-highlighter/dist/esm/languages/prism/c";
import cpp from "react-syntax-highlighter/dist/esm/languages/prism/cpp";
import csharp from "react-syntax-highlighter/dist/esm/languages/prism/csharp";
import go from "react-syntax-highlighter/dist/esm/languages/prism/go";
import java from "react-syntax-highlighter/dist/esm/languages/prism/java";
import javascript from "react-syntax-highlighter/dist/esm/languages/prism/javascript";
import kotlin from "react-syntax-highlighter/dist/esm/languages/prism/kotlin";
import python from "react-syntax-highlighter/dist/esm/languages/prism/python";
import rust from "react-syntax-highlighter/dist/esm/languages/prism/rust";
import sql from "react-syntax-highlighter/dist/esm/languages/prism/sql";
import swift from "react-syntax-highlighter/dist/esm/languages/prism/swift";
import typescript from "react-syntax-highlighter/dist/esm/languages/prism/typescript";

// Only these languages are bundled (the light build); this file is loaded on
// demand by CodeBlock, so it does not weigh on the first page load.
const REGISTERED = { c, cpp, csharp, go, java, javascript, kotlin, python, rust, sql, swift, typescript };
Object.entries(REGISTERED).forEach(([name, grammar]) =>
  SyntaxHighlighter.registerLanguage(name, grammar),
);

const HighlightedCode = ({ code, language, isDark }) => (
  <SyntaxHighlighter
    language={language in REGISTERED ? language : "text"}
    style={isDark ? oneDark : oneLight}
    wrapLongLines
    className="rounded-lg overflow-x-auto !m-0 text-sm"
  >
    {code}
  </SyntaxHighlighter>
);

export default HighlightedCode;
