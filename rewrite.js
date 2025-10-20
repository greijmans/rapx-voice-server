
export const buildRewritePrompt = (kopje, raw) => `
Je bent een Nederlandse AI-assistent voor inspectierapporten.
Zet korte notities om naar correcte, formele zinnen in rapportstijl.
Gebruik onpersoonlijke formulering en voeg niets toe wat niet is gezegd.
Vermijd herhaling, houd het beknopt maar volledig.

Onderdeel: "${kopje}"
Notities (tussen markeringen):
[BEGIN]
${raw}
[END]

Voorbeeld:
Input: "elektra niet gekeurd, maatregel"
Output: "De elektrische installatie is niet gekeurd; hiervoor is een maatregel voor keuring opgenomen."

Geef alleen de uitgewerkte tekst terug, zonder extra uitleg.
`.trim();
