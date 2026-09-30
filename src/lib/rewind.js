import { reviewsErasedBy } from "./schedule";

// "R2" / "R2 and R3" / "R2, R3 and R4"
const nameList = (indexes) => {
  const names = indexes.map((i) => `R${i + 1}`);
  return names.length < 2
    ? names.join("")
    : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
};

// The question to ask before going back to review `index`, or null when only
// one review would be erased (going back one step needs no question).
export const rewindConfirm = (entry, index) => {
  const erased = reviewsErasedBy(entry, index);
  if (erased.length < 2) return null;
  return {
    title: `Go back to R${index + 1}?`,
    message: `${nameList(erased)} and their dates will be erased.`,
    confirmLabel: "Go back",
  };
};
