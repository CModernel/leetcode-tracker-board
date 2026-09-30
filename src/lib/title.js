// The page title with the number of reviews due: "(3) CodeTrack Pro". With
// nothing due it is the plain title.
export const titleWithCount = (baseTitle, dueCount) =>
  dueCount > 0 ? `(${dueCount}) ${baseTitle}` : baseTitle;
