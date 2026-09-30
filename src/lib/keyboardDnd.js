// Keyboard help for dragging cards between columns.

// Where a dragged card goes when Left (-1) or Right (1) is pressed: the top of
// the next column in that direction, keeping the card centered on it.
// `rect` is the card's rectangle ({ left, top, width, height }); `columns` is
// [{ id, rect }] in any order. Returns { x, y } (the card's new top-left
// corner), or undefined when there is no column in that direction.
export const moveToColumn = (direction, rect, columns) => {
  if (direction !== -1 && direction !== 1) return undefined;
  const sorted = [...columns].sort((a, b) => a.rect.left - b.rect.left);
  if (sorted.length === 0) return undefined;

  // The column the card is over now: the one whose center is closest
  const center = rect.left + rect.width / 2;
  const distance = (column) =>
    Math.abs(column.rect.left + column.rect.width / 2 - center);
  let current = 0;
  sorted.forEach((column, index) => {
    if (distance(column) < distance(sorted[current])) current = index;
  });

  const target = sorted[current + direction];
  if (!target) return undefined;
  return {
    x: target.rect.left + (target.rect.width - rect.width) / 2,
    y: target.rect.top + 8,
  };
};

// Screen reader messages while a card is dragged, with titles instead of ids.
// `cardTitle(id)` and `columnTitle(id)` give the names.
export const dragAnnouncements = (cardTitle, columnTitle) => ({
  onDragStart: ({ active }) => `Picked up ${cardTitle(active.id)}.`,
  onDragOver: ({ active, over }) =>
    over
      ? `${cardTitle(active.id)} is over ${columnTitle(over.id)}.`
      : `${cardTitle(active.id)} is not over a column.`,
  onDragEnd: ({ active, over }) =>
    over
      ? `Dropped ${cardTitle(active.id)} on ${columnTitle(over.id)}.`
      : `${cardTitle(active.id)} was dropped outside the columns.`,
  onDragCancel: ({ active }) =>
    `Moving ${cardTitle(active.id)} was cancelled.`,
});

export const DRAG_INSTRUCTIONS =
  "To move a card, press space or enter to pick it up, use the left and right arrow keys to choose a column, then press space or enter to drop it. Press escape to cancel.";
