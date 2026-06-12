import fs from "fs/promises";

const FILE =
  process.env.DATA_FILE ||
  "./data/episodes.json";

export async function loadEpisodes() {
  try {
    const data = await fs.readFile(FILE, "utf-8");

    if (!data.trim()) {
      return [];
    }

    return JSON.parse(data);
  } catch (err) {
    if (err.code === "ENOENT") {
      return [];
    }

    return [];
  }
}

export async function saveEpisodes(episodes) {
  await fs.writeFile(
    FILE,
    JSON.stringify(episodes, null, 2)
  );
}

export function limitEpisodes(list, max = 7) {
  return list
    .sort(
      (a, b) =>
        new Date(b.date) - new Date(a.date)
    )
    .slice(0, max);
}
