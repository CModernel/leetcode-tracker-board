// One board column. `count` is optional: nothing is shown until it is given.
const KanbanColumn = ({ title, count, children }) => (
  <section className="flex flex-col bg-gray-100 dark:bg-gray-800 rounded-lg p-3 min-h-[200px] transition-colors">
    <header className="flex items-center justify-between mb-3 px-1">
      <h2 className="font-semibold text-gray-800 dark:text-white">{title}</h2>
      {count !== undefined && (
        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
          {count}
        </span>
      )}
    </header>
    <div className="flex flex-col gap-2 max-h-[70vh] overflow-y-auto">
      {children}
    </div>
  </section>
);

export default KanbanColumn;
