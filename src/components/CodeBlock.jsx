import { Component, Suspense, lazy } from "react";
import { useTheme } from "../context/ThemeContext";

const HighlightedCode = lazy(() => import("./HighlightedCode"));

const Plain = ({ code }) => (
  <pre className="m-0 overflow-x-auto whitespace-pre-wrap break-words rounded-lg bg-gray-100 dark:bg-gray-900 p-3 text-sm text-gray-900 dark:text-gray-100">
    <code>{code}</code>
  </pre>
);

// If the highlighter fails to load (offline, blocked), the code is still shown.
class Fallback extends Component {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? <Plain code={this.props.code} /> : this.props.children;
  }
}

// Code with syntax colours. The highlighter loads on demand; until then (and if
// it never loads) the code is shown as plain text.
const CodeBlock = ({ code, language }) => {
  const { isDark } = useTheme();
  return (
    <Fallback code={code}>
      <Suspense fallback={<Plain code={code} />}>
        <HighlightedCode code={code} language={language} isDark={isDark} />
      </Suspense>
    </Fallback>
  );
};

export default CodeBlock;
