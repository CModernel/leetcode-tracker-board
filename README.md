# 🧠 CodeTrack Pro - LeetCode Tracker & Board

A modern, interactive web application to track your progress through the famous LeetCode problems, as a table or as a Kanban board, with built-in spaced repetition system for long-term retention.

![LeetCode Tracker](https://img.shields.io/badge/React-18.2.0-blue.svg)
![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-3.4.0-38B2AC.svg)
![Vite](https://img.shields.io/badge/Vite-5.0.0-646CFF.svg)

## ✨ Features

### 📊 Progress Tracking

- **Complete Problem Tracking**: Mark problems as solved with automatic date tracking
- **Visual Progress Stats**: See your progress across Easy, Medium, and Hard difficulties
- **Category Filtering**: Filter by problem categories (Arrays & Hashing, Two Pointers, etc.)
- **Difficulty Filtering**: Filter by Easy, Medium, or Hard problems

### 🔄 Spaced Repetition System

- **Scientifically-Based Intervals**: Review problems at optimal intervals (1, 3, 7, 14, 30 days)
- **Smart Review Scheduling**: Automatic calculation of review due dates. Reviews must be done in order, and a late review moves the next ones back
- **Due Today Filter**: Quickly see which problems need review today
- **Visual Review Status**: Color-coded review buttons showing completion status

### 🗂️ Kanban Board

A second view of the same progress, at `/board`. Anything you do in the board changes the tracker table, and the other way around.

- **Four columns**: To Do, In Progress, Reviewing and Mastered
- **Drag & drop** (mouse, touch or keyboard) to start a problem, solve it or move it back, with a confirmation before reviews are erased and an **Undo** message
- **Reorder** the cards inside In Progress
- **Reviewing sections**: inside Reviewing, the cards are split into Overdue, Today and Upcoming, so what to review now is on top
- A **Complete** button on every card that is waiting for a review
- **Due count in the tab title**, for example `(3) CodeTrack Pro`
- The list and filters at the top apply to both views

### 📝 Notes

One short note per problem (up to 300 characters), to read before a review: the key idea, or what made it hard. It is for notes and explanations, not for code.

- **Tracker**: turn on **Show notes** for a Notes column, then click a note (or **Add note**) to edit it in place. **Ctrl/Cmd+Enter** or leaving the field saves, **Escape** discards. The choice of showing the column is remembered.
- **Board**: the note icon on each card opens the note in a dialog to read or edit it.
- Both views share the same note. It is kept when you unsolve or move a problem, and it is included in the export/import file.
- Reading a note never changes the review schedule.

### 🧭 Review outcomes

Completing a review is one click: it counts as **solved it myself**. If you opened the note (or a solution) that day, you are asked **How did it go?** first, and each answer shows its real dates before you choose:

- **Solved it myself**: the next review follows the schedule.
- **Needed the note**: the same review is repeated in 2 days.
- **Needed the solution**: the problem goes one review back (R4 to R3), not a full reset.

- Works the same in the tracker, and on the board cards, with an **Undo** message.
- Every attempt is saved in a history (date, review and help needed) that is kept when a problem steps back, and included in the export/import file. It is only erased by **Clear All**.

### 🏆 Mark as mastered

If you already know a problem, you do not need to tap R1 to R5: mark it as mastered.

- **Tracker**: the small **Mastered** button next to **Solved** (it works on problems you have not solved yet too). A mastered problem shows **Mastered** and a very light green row.
- **Board**: drag a card onto **Mastered**, or use **Mark as mastered** in its ⋯ menu.
- It asks first only when the problem has reviews done, because their dates are lost. From **To Do**, **In Progress** or with no review done yet it is done at once, with a message and **Undo**.
- From **R5** that button (or dropping the card on Mastered) just completes that last review.
- It does not invent attempts in the history. Going back with R1 to R5 starts the reviews again.

### 💾 Data Persistence

- **Local Storage**: All progress automatically saved to browser's local storage
- **Export/Import**: Backup your progress with JSON export/import functionality
- **Cross-Session Persistence**: Progress survives browser restarts and refreshes

### 🎨 Modern UI/UX

- **Responsive Design**: Works perfectly on desktop, tablet, and mobile devices
- **Clean Interface**: Modern, distraction-free design using Tailwind CSS
- **Interactive Elements**: Hover effects, color-coded status indicators
- **Informative Tooltips**: Helpful information displayed on hover

## 🚀 Live Demo

[View Live Demo](https://track-leetcode.vercel.app)

## 🛠️ Installation

### Prerequisites

- Node.js
- npm or yarn

### Setup

1. **Clone the repository**

   ```bash
   git clone https://github.com/javydevx/leetcode-tracker.git
   cd leetcode-tracker
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Start development server**

   ```bash
   npm run dev
   ```

4. **Open your browser**
   Navigate to `http://localhost:5173`

## 📦 Build for Production

```bash
npm run build
```

The built files will be in the `dist/` directory, ready for deployment.

## 🎯 How to Use

### Getting Started

1. **Mark Problems as Solved**: Click the circle icon next to any problem when you complete it
2. **Review Schedule Appears**: Once solved, you'll see 5 review buttons (R1-R5) with due dates
3. **Complete Reviews**: Click review buttons when you successfully review the problem
4. **Track Progress**: Use filters and stats to monitor your overall progress

### Spaced Repetition Schedule

- **R1**: Review after 1 day
- **R2**: Review after 3 days  
- **R3**: Review after 7 days (1 week)
- **R4**: Review after 14 days (2 weeks)
- **R5**: Review after 30 days (1 month)

These are the dates when every review is done on time. If you do a review late, the next one is counted from the day you really did it.

### Color Coding

- 🟢 **Green**: Review completed
- 🟡 **Yellow**: Due today
- 🔴 **Red**: Overdue
- ⚪ **Gray**: Future review

### Data Management

- **Export**: Download your progress as a JSON file for backup
- **Import**: Restore progress from a previously exported file
- **Clear All**: Reset all progress (with confirmation dialog)

## 🔧 Technologies Used

- **Frontend Framework**: React 19.1.1
- **Build Tool**: Vite 7.1.7
- **Styling**: Tailwind CSS 3.4.18
- **Icons**: Lucide React 0.544.0
- **Data Storage**: Browser LocalStorage
- **Language**: JavaScript (ES6+)

## 📱 Browser Compatibility

- ✅ Chrome (recommended)
- ✅ Firefox
- ✅ Safari
- ✅ Edge
- ✅ Mobile browsers

## 📋 Roadmap

- [x] Dark mode support
- [x] Notes per problem
- [x] Kanban board synchronized with the tracker
- [x] Review outcomes by help needed
- [ ] Custom problem sets
- [ ] Study streaks tracking
- [ ] Performance analytics
- [ ] Social features (optional)
- [ ] Mobile app version

## ❓ FAQ

**Q: Will my progress be lost if I clear browser data?**
A: Yes, since data is stored in localStorage. Use the export feature to backup your progress.

**Q: Can I access my progress from different devices?**
A: Currently no, as data is stored locally. You can export from one device and import to another.

**Q: Will I get a reminder when a review is due?**
A: Not yet. The app only works while its tab is open: the number of due reviews shows in the tab title, and the Reviewing column puts what is overdue or due today on top.

**Q: Can I add custom problems?**
A: Not currently, but this feature is planned for future releases.

## 🙏 Acknowledgments

- **NeetCode**: For the excellent problem curation and learning resources
- **Spaced Repetition Research**: Based on cognitive science research for optimal learning
- **React Community**: For the amazing ecosystem and tools

---

⭐ **Star this repository if it helped you ace your coding interviews!**

Made with ❤️ for the coding community
