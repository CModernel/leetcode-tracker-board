import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Check, Code2, Copy } from "lucide-react";
import { patterns } from "../data";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import {
  oneDark,
  oneLight,
} from "react-syntax-highlighter/dist/esm/styles/prism";
import { useTheme } from "../context/ThemeContext";
import { LANGUAGES } from "../lib/languages";
import { PATTERN_LANGUAGE_KEY, parsePatternLanguage } from "../lib/preferences";


// The language picked last time (kept in the browser), else the default.
const savedLanguage = () => {
  try {
    return parsePatternLanguage(localStorage.getItem(PATTERN_LANGUAGE_KEY));
  } catch {
    return parsePatternLanguage(null);
  }
};

const Patterns = () => {
  const [selectedLanguage, setSelectedLanguage] = useState(savedLanguage);
  const [copiedIndex, setCopiedIndex] = useState(null);
  const { isDark } = useTheme();
  // A hint links here with `?pattern=<id>`: that pattern is scrolled into view
  // and highlighted for a moment. An unknown id just shows the page.
  const [params] = useSearchParams();
  const wanted = params.get("pattern");
  const [highlighted, setHighlighted] = useState(null);

  useEffect(() => {
    const target = patterns.find((pattern) => pattern.id === wanted);
    if (!target) return undefined;
    document.getElementById(`pattern-${target.id}`)?.scrollIntoView?.({ block: "center" });
    setHighlighted(target.id);
    const timer = setTimeout(() => setHighlighted(null), 3000);
    return () => clearTimeout(timer);
  }, [wanted]);

  const language = LANGUAGES.find((l) => l.id === selectedLanguage) ?? LANGUAGES[0];

  const chooseLanguage = (id) => {
    setSelectedLanguage(id);
    try {
      localStorage.setItem(PATTERN_LANGUAGE_KEY, id);
    } catch (error) {
      console.error("Error saving the language:", error);
    }
  };

  const copyToClipboard = (text, index) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-6 transition-colors">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-3">
            <h1 className="text-4xl font-bold text-gray-800 dark:text-white">
              LeetCode Patterns Cheat Sheet
            </h1>
            <Code2
              size={36}
              className="text-blue-600 dark:text-blue-400 ml-2"
            />
          </div>
          <p className="text-gray-600 dark:text-gray-300 text-lg">
            Master coding patterns in multiple languages
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 mb-8 sticky top-4 z-10 transition-colors">
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <label
              htmlFor="pattern-language"
              className="text-gray-700 dark:text-gray-300 font-medium"
            >
              Select Language:
            </label>
            {/* Phones: one line (a select). From sm up: the buttons. */}
            <select
              id="pattern-language"
              value={language.id}
              onChange={(event) => chooseLanguage(event.target.value)}
              className="sm:hidden rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-gray-800 dark:text-gray-100"
            >
              {LANGUAGES.map((lang) => (
                <option key={lang.id} value={lang.id}>
                  {lang.name}
                </option>
              ))}
            </select>
            <div className="hidden sm:flex items-center justify-center gap-3 flex-wrap">
              {LANGUAGES.map((lang) => (
                <button
                  key={lang.id}
                  onClick={() => chooseLanguage(lang.id)}
                  aria-pressed={language.id === lang.id}
                  className={`px-4 py-2 rounded-lg font-medium transition-all ${
                    language.id === lang.id
                      ? `${lang.color} text-white shadow-lg scale-105`
                      : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
                  }`}
                >
                  {lang.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {patterns.map((pattern, idx) => {
            const template = pattern.templates?.[language.id];
            return (
            <div
              key={idx}
              id={`pattern-${pattern.id}`}
              className={`bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden hover:shadow-xl transition-all ${
                highlighted === pattern.id ? "ring-4 ring-yellow-400" : ""
              }`}
            >
              <div className="bg-gradient-to-r from-indigo-500 to-blue-500 py-3 px-4">
                <h2 className="text-lg font-bold text-white mb-1">
                  {pattern.title}
                </h2>
                <p className="text-blue-50">{pattern.description}</p>
              </div>

              <div className="p-6">
                <div className="relative mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-gray-600 dark:text-gray-300 uppercase">
                      {language.name} Template
                    </span>
                    <button
                      onClick={() => copyToClipboard(template, idx)}
                      disabled={!template}
                      className="flex items-center gap-2 px-3 py-1 text-sm bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
                    >
                      {copiedIndex === idx ? (
                        <>
                          <Check
                            size={16}
                            className="text-green-600 dark:text-green-400"
                          />
                          <span className="text-green-600 dark:text-green-400">
                            Copied!
                          </span>
                        </>
                      ) : (
                        <>
                          <Copy
                            size={16}
                            className="text-gray-700 dark:text-gray-300"
                          />
                          <span className="text-gray-700 dark:text-gray-300">
                            Copy
                          </span>
                        </>
                      )}
                    </button>
                  </div>
                  {template ? (
                    <SyntaxHighlighter
                      language={language.prism}
                      style={isDark ? oneDark : oneLight}
                      wrapLongLines={true}
                      showLineNumbers={true}
                      className="rounded-lg overflow-x-auto"
                    >
                      {template.replace(/\\n/g, "\n")}
                    </SyntaxHighlighter>
                  ) : (
                    <p className="rounded-lg bg-gray-100 dark:bg-gray-700 p-4 text-sm text-gray-600 dark:text-gray-300">
                      No {language.name} template for this pattern yet.
                    </p>
                  )}
                </div>
                <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-4">
                  <span className="font-semibold text-blue-900 dark:text-blue-300 text-sm">
                    Common Problems:
                  </span>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {pattern.problems.map((problem, pIdx) => (
                      <span
                        key={pIdx}
                        className="px-3 py-1 bg-blue-100 dark:bg-blue-800 text-blue-800 dark:text-blue-100 rounded-full text-sm font-medium"
                      >
                        {problem}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            );
          })}
        </div>

        <div className="mt-12 text-center text-gray-600 dark:text-gray-400">
          <p className="text-sm">
            💡 Practice these patterns regularly to build strong problem-solving
            intuition
          </p>
        </div>
      </div>
    </div>
  );
};

export default Patterns;
