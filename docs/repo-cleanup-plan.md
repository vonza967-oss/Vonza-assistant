# Repo cleanup plan

The active app path is `/Users/matepetki/Documents/New project/Vonza `, including a trailing space in the folder name.

## Current risk

- The trailing-space folder name is easy to miss in shells, scripts, editor project pickers, deployment tooling, and backup jobs.
- Duplicate sibling folders should not be removed from inside this task because they may contain user work or alternate repo copies.
- Local-only files such as `.env`, logs, coverage output, reports, and screenshots should remain ignored and out of commits.

## Recommended safe migration

1. Finish or stash any local work in this active folder.
2. From the parent directory, create a clean backup of the active folder.
3. Close editors, terminals, and dev servers that hold the trailing-space path open.
4. Rename the folder from the parent directory to a path without trailing whitespace.
5. Reopen the renamed folder, run `npm install` if needed, then run the standard verification commands.
6. Only after confirming the renamed repo works, review sibling folders manually and delete or archive confirmed duplicates outside the repo.
