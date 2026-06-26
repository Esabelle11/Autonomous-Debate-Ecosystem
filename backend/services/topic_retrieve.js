import fs from "fs";
import path from "path";

function parseCSV(text) {
  const lines = text.trim().split("\n");

  const headers = [];
  let current = "";
  let inQuotes = false;

  for (const c of lines[0]) {
    if (c === '"') inQuotes = !inQuotes;
    else if (c === "," && !inQuotes) {
      headers.push(current);
      current = "";
    } else {
      current += c;
    }
  }
  headers.push(current);

  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const values = [];
    let cell = "";
    let quote = false;

    for (const c of lines[i]) {
      if (c === '"') {
        quote = !quote;
      } else if (c === "," && !quote) {
        values.push(cell);
        cell = "";
      } else {
        cell += c;
      }
    }

    values.push(cell);

    const obj = {};

    headers.forEach((h, idx) => {
      obj[h] = values[idx] ?? "";
    });

    rows.push(obj);
  }

  return {
    headers,
    rows
  };
}

function writeCSV(headers, rows) {
  const csv = [
    headers.join(","),
    ...rows.map(r =>
      headers
        .map(h => `"${String(r[h] ?? "").replace(/"/g, '""')}"`)
        .join(",")
    )
  ].join("\n");

  return csv;
}

function randomPick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export async function selectBestTopic() {
  try {
    const dir = path.resolve("data");

    const files = fs.readdirSync(dir)
      .filter(f => f.startsWith("research-") && f.endsWith(".csv"))
      .sort();

    if (!files.length) {
      throw new Error("No research csv found.");
    }

    const latestFile = files[files.length - 1];
    const csvPath = path.join(dir, latestFile);

    console.log("Using:", latestFile);

    const csvText = fs.readFileSync(csvPath, "utf8");

    const { headers, rows } = parseCSV(csvText);

    /*
    Filter:
    average > 9
    selected == 0
    */

    const candidates = rows.filter(r =>
      Number(r.average) >= 9 &&
      Number(r.selected) === 0
    );

    if (!candidates.length) {
      console.log("No available topics.");

      return null;
    }

    /*
    Group by title
    */

    const grouped = {};

    for (const row of candidates) {
      if (!grouped[row.title]) {
        grouped[row.title] = [];
      }

      grouped[row.title].push(row);
    }

    /*
    Pick one representative per title
    */

    const representatives = Object.values(grouped).map(group =>
      randomPick(group)
    );

    /*
    Random final pick
    */

    const chosen = randomPick(representatives);

    /*
    Mark ALL rows sharing title as selected
    */

    rows.forEach(r => {
      if (r.title === chosen.title) {
        r.selected = 1;
      }
    });

    /*
    Rewrite CSV
    */

    const updatedCSV = writeCSV(headers, rows);

    fs.writeFileSync(csvPath, updatedCSV);

    console.log("Selected:");
    console.log(chosen.title);

    return {
      title: chosen.title,
      topic: chosen.topic,
      background: chosen.background,
      framing: chosen.framing_debate,
      mode: chosen.mode,
      average: Number(chosen.average),
      overall: Number(chosen.overall)
    };

  } catch (err) {
    console.log(err.message);
    return null;
  }
}

// selectBestTopic();