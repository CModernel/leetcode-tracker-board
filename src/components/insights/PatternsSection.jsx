import ProblemList from "./ProblemList";
import { MIN_ATTEMPTS } from "../../lib/insights";

const percent = (rate) => `${Math.round(rate * 100)}%`;
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

const Panel = ({ title, children }) => (
  <div className="min-w-0 rounded-lg border border-gray-100 p-4 dark:border-gray-700">
    <h3 className="mb-2 text-sm font-semibold text-gray-800 dark:text-white">{title}</h3>
    {children}
  </div>
);

const Note = ({ children }) => (
  <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">{children}</p>
);

// How each review went: bars of the share solved alone at R1..R5.
const Retention = ({ rows }) => (
  <Panel title="Retention by review">
    <ul className="space-y-1.5">
      {rows.map((row, index) => (
        <li key={index} className="flex items-center gap-2 text-xs">
          <span className="w-6 font-medium text-gray-600 dark:text-gray-300">R{index + 1}</span>
          <div
            className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700"
            role="img"
            aria-label={`R${index + 1}: ${row.rate === null ? "not enough data" : `${percent(row.rate)} solved alone`}`}
          >
            {row.rate !== null && (
              <div className="h-full rounded-full bg-green-500 dark:bg-green-600" style={{ width: percent(row.rate) }} />
            )}
          </div>
          <span className="w-9 text-right tabular-nums text-gray-700 dark:text-gray-200">
            {row.rate === null ? "-" : percent(row.rate)}
          </span>
        </li>
      ))}
    </ul>
    <Note>Solved alone, by review. A review needs {MIN_ATTEMPTS} attempts to show.</Note>
  </Panel>
);

// Reviews done on the day they were due or before, against late ones.
const Punctuality = ({ data }) => {
  const help = [];
  if (data.helpOnTime !== null) help.push(`on time ${percent(data.helpOnTime)}`);
  if (data.helpLate !== null) help.push(`late ${percent(data.helpLate)}`);
  return (
    <Panel title="Punctuality">
      {data.onTimeRate === null ? (
        <>
          <p className="text-xl font-bold text-gray-400 dark:text-gray-500">-</p>
          <Note>Needs {MIN_ATTEMPTS} reviews ({data.count}).</Note>
        </>
      ) : (
        <>
          <p className="text-xl font-bold tabular-nums text-gray-800 dark:text-white">
            {percent(data.onTimeRate)} <span className="text-sm font-medium">on time</span>
          </p>
          <Note>
            {data.late} of {plural(data.count, "review")} {data.late === 1 ? "was" : "were"} late.
          </Note>
          {help.length > 0 && <Note>Needed help: {help.join(" · ")}</Note>}
        </>
      )}
    </Panel>
  );
};

const notesLine = (notes) => {
  if (notes.withNote.rate === null || notes.without.rate === null) {
    return `Notes: needs ${MIN_ATTEMPTS} reviews with and without a note.`;
  }
  return `Needed help: with a note ${percent(notes.withNote.rate)} · without ${percent(notes.without.rate)}`;
};

// Easy and Medium problems that cost more than their label says, and the effect
// of notes on the help needed.
const Harder = ({ items, notes, onOpen }) => (
  <Panel title="Harder than they look">
    <ProblemList
      items={items.map(({ problem, attempts, helped }) => ({
        problem,
        detail: `needed help in ${helped} of ${plural(attempts, "review")}`,
      }))}
      onOpen={onOpen}
      empty="None yet."
    />
    <Note>{notesLine(notes)}</Note>
  </Panel>
);

const NotPracticed = ({ items }) => (
  <Panel title="Not practiced lately">
    {items.length === 0 ? (
      <p className="text-sm text-gray-500 dark:text-gray-400">Nothing solved yet.</p>
    ) : (
      <ul className="divide-y divide-gray-100 dark:divide-gray-700">
        {items.map((item) => (
          <li key={item.category} className="flex justify-between gap-3 py-2 text-sm">
            <span className="font-medium text-gray-800 dark:text-gray-100">{item.category}</span>
            <span className="flex-shrink-0 text-gray-500 dark:text-gray-400">
              {item.daysAgo === 0 ? "today" : `${plural(item.daysAgo, "day")} ago`}
            </span>
          </li>
        ))}
      </ul>
    )}
  </Panel>
);

// The second round of analytics in four small panels (one column on phones):
// retention by review, punctuality, problems harder than they look (with the
// effect of notes) and the categories not practiced for the longest time.
// With no review history at all it is a single sentence.
const PatternsSection = ({ retention, punctuality, harder, notes, notPracticed, onOpen }) => {
  const anyHistory = retention.some((row) => row.attempts > 0);
  if (!anyHistory) {
    return (
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Complete some reviews and this will show how well each review goes, how punctual you are and which problems
        and categories need attention.
      </p>
    );
  }
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <Retention rows={retention} />
      <Punctuality data={punctuality} />
      <Harder items={harder} notes={notes} onOpen={onOpen} />
      <NotPracticed items={notPracticed} />
    </div>
  );
};

export default PatternsSection;
