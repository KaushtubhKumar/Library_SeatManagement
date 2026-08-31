// lib/sectionImages.ts
// Maps a Zone's `name` (as seeded in scripts/seed-floor1.ts) to the
// real-life photo of that physical section. Drop your photos into
// public/library-sections/ using these exact filenames, or edit the
// paths below to match whatever you name them.

// export const SECTION_IMAGES: Record<string, string> = {
//   "Window Row A": "/library-sections/window-row-a.jpg",
//   "Window Block B": "/library-sections/window-block-b.jpg",
//   "Reading Block C": "/library-sections/reading-block-c.jpg",
//   "Group Table D": "/library-sections/group-table-d.jpg",
//   "Window Row E": "/library-sections/window-row-e.jpg",
//   "Discussion Room 1": "/library-sections/discussion-room-1.jpg",
//   "Discussion Room 2": "/library-sections/discussion-room-2.jpg",
// };

export const SECTION_IMAGES: Record<string, string> = {
  "Window Row A": "/library-sections/1.jpg",
  "Window Block B": "/library-sections/2.jpg",
  "Reading Block C": "/library-sections/3.jpg",
  "Group Table D": "/library-sections/4.jpg",
  "Window Row E": "/library-sections/5.jpg",
  "Discussion Room 1": "/library-sections/d1.jpg",
  "Discussion Room 2": "/library-sections/d2.jpg",
};

export function getSectionImage(zoneName: string): string | null {
  return SECTION_IMAGES[zoneName] ?? null;
}