const API =
  import.meta.env.VITE_API ||
  "http://localhost:3000";

async function request(path) {
  const res = await fetch(`${API}${path}`);

  if (!res.ok) {
    throw new Error("API request failed");
  }

  return await res.json();
}

export async function getEpisodes() {
  console.log("in frontend/src/api/getEpisodes")

  return await request("/episodes");
}

export async function getLatestEpisode() {
  console.log("in frontend/src/api/getLatestEpisode")

  return await request("/episodes/latest");
}

export async function getEpisode(id) {
  console.log(`in frontend/src/api/getLatestEpisode: ${id}`);
  return await request(`/episodes/${id}`);
}

export async function generateEpisode() {
  console.log("in frontend/src/api/generateEpisode")

  const res = await fetch(
    `${API}/episodes`,
    {
      method: "POST",
      headers: {
        "Content-Type":"application/json"
      },
      body: JSON.stringify({})
    }
  );

  return await res.json();
}