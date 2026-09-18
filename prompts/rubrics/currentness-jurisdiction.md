# Rubric: currentness-jurisdiction

**Stage:** RESEARCH_DOSSIER. **Lens:** is every time-sensitive fact the current version, and is every rule attributed to the jurisdiction where it actually applies?

## Read

1. The brief's `jurisdictions` and `currentnessRequirements`.
2. `sources.jsonl` (date, version, accessed, jurisdiction, currentnessNotes) and `claims.jsonl` (category, jurisdiction, qualifications).
3. Use web tools to check the current consolidated version or edition of every legal instrument and standard cited for core claims, and the latest release of any statistic.

## Checks

- [ ] **Current legislation.** Each cited act, regulation or code is the current consolidation; amendments in force or scheduled are noted. Repealed or renumbered provisions are not cited as current.
- [ ] **Current editions.** Standards and guidance are the current edition or version, or the dossier explains why an older edition is used (for example because legislation incorporates that edition).
- [ ] **Version recorded.** `version`, `date` and `accessed` are recorded for time-sensitive sources; `currentnessNotes` flags pending changes.
- [ ] **Statistics.** Numbers are the latest available release, with year stated; older figures are labelled as such.
- [ ] **Jurisdiction attribution.** Each `law-regulation` claim names the jurisdiction; rules from one jurisdiction are not presented as universal; federal and provincial (or equivalent) layers are not conflated.
- [ ] **Cross-jurisdiction contrasts.** Where the course audience may work in several jurisdictions, differences that matter are noted rather than hidden.
- [ ] **`version-currentness` claims.** Claims about what is in force are correct as of the access date.

In `evidence`, give the source or claim ID, the version recorded, and the current version you found (URL and date).

## Severity calibration

- `critical`: a core requirement cited from a superseded or repealed provision; a rule from one jurisdiction taught as applying in the course's primary jurisdiction.
- `major`: an outdated standard edition or statistic used without explanation; missing jurisdiction on legal claims; pending amendments that will change core content not noted.
- `minor`: missing accessed date or version label where the content is still current.
- `style`: formatting of dates.

## Not your job

Whether sources support claims (evidence-source) or coverage of questions (domain-completeness).

## Categories

`currentness`, `accuracy`
