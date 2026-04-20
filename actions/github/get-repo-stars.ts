export default async function getGithubRepoStars(): Promise<number> {
  try {
    const headers: HeadersInit = {
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "nextcrm-app",
    };

    if (process.env.NEXT_PUBLIC_GITHUB_TOKEN) {
      headers.Authorization = `token ${process.env.NEXT_PUBLIC_GITHUB_TOKEN}`;
    }

    const response = await fetch(
      process.env.NEXT_PUBLIC_GITHUB_REPO_API ||
        "https://api.github.com/repos/pdovhomilja/nextcrm-app",
      {
        headers,
        next: { revalidate: 3600 },
      }
    );

    if (!response.ok) {
      console.error("Error fetching GitHub stars:", response.status, response.statusText);
      return 0;
    }

    const stars = await response.json();
    return typeof stars?.stargazers_count === "number" ? stars.stargazers_count : 0;
  } catch (error) {
    console.error("Error fetching GitHub stars:", error);
    return 0;
  }
}
