export type ParsedRepoUrl = {
  owner: string;
  name: string;
  cloneUrl: string;
};

/**
 * Accepts a GitHub URL in the common forms people paste in:
 * https://github.com/owner/repo, https://github.com/owner/repo.git,
 * github.com/owner/repo, or owner/repo shorthand.
 */
export function parseGitHubUrl(input: string): ParsedRepoUrl | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  let owner: string | undefined;
  let name: string | undefined;

  const shorthand = /^([\w.-]+)\/([\w.-]+?)(?:\.git)?$/.exec(trimmed);
  if (shorthand && !trimmed.includes("://") && !trimmed.includes(" ")) {
    owner = shorthand[1];
    name = shorthand[2];
  } else {
    try {
      const withScheme = trimmed.match(/^https?:\/\//)
        ? trimmed
        : `https://${trimmed}`;
      const url = new URL(withScheme);
      if (!/(^|\.)github\.com$/.test(url.hostname)) return null;
      const parts = url.pathname.split("/").filter(Boolean);
      if (parts.length < 2) return null;
      owner = parts[0];
      name = parts[1].replace(/\.git$/, "");
    } catch {
      return null;
    }
  }

  if (!owner || !name) return null;
  if (!/^[\w.-]+$/.test(owner) || !/^[\w.-]+$/.test(name)) return null;

  return {
    owner,
    name,
    cloneUrl: `https://github.com/${owner}/${name}.git`,
  };
}
