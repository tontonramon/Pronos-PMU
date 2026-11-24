// Génère courses.json depuis l'API PMU (Node 18+). Lancé chaque jour par GitHub Actions.
const fs = require("fs");
const BASE = "https://offline.turfinfo.api.pmu.fr/rest/client/7/programme/";
const TZ = "Europe/Paris";

const parts = new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric" })
  .formatToParts(new Date()).reduce((o, p) => (o[p.type] = p.value, o), {});
const dd = parts.day + parts.month + parts.year;
const label = new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date());
const maj = new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" }).format(new Date());
const hhmm = ms => ms ? new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" }).format(new Date(ms)) : "";

async function get(url) {
  const r = await fetch(url, { headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) PronosPMU/1.0" } });
  if (!r.ok) throw new Error("HTTP " + r.status + " sur " + url);
  return r.json();
}

(async () => {
  console.log("Programme du", dd);
  const prog = await get(BASE + dd + "?specialisation=INTERNET");
  const list = [];
  for (const re of prog.programme?.reunions || [])
    for (const c of re.courses || [])
      list.push({
        key: "R" + (c.numReunion ?? re.numOfficiel) + "C" + c.numOrdre,
        r: c.numReunion ?? re.numOfficiel, c: c.numOrdre,
        hippo: re.hippodrome?.libelleCourt || c.hippodrome?.libelleCourt || "Réunion " + re.numOfficiel,
        lib: c.libelle || "", heure: hhmm(c.heureDepart), disc: (c.discipline || "").replace(/_/g, " "),
      });
  if (!list.length) throw new Error("Aucune course dans le programme.");
  console.log(list.length, "courses au programme");

  const courses = []; let i = 0, erreurs = 0;
  async function worker() {
    while (i < list.length) {
      const c = list[i++];
      try {
        const p = await get(`${BASE}${dd}/R${c.r}/C${c.c}/participants?specialisation=INTERNET`);
        const runners = (p.participants || []).filter(x => x.statut !== "NON_PARTANT").map(x => ({
          n: x.numPmu, nom: x.nom, driver: x.driver || x.jockey || "",
          cote: +(x.dernierRapportDirect?.rapport ?? x.dernierRapportReference?.rapport ?? 0),
          gains: (x.gainsParticipant?.gainsCarriere || 0) / 100, musique: x.musique || "",
        })).filter(x => x.cote > 0);
        if (runners.length >= 3) courses.push({ ...c, runners });
      } catch (e) { erreurs++; console.log("Erreur", c.key, e.message); }
    }
  }
  await Promise.all(Array.from({ length: 6 }, worker));
  courses.sort((a, b) => a.r - b.r || a.c - b.c);
  if (!courses.length) throw new Error("Aucune course avec cotes (" + erreurs + " erreurs).");
  fs.writeFileSync("courses.json", JSON.stringify({ date: dd, label: `${label} · maj ${maj}`, courses }));
  console.log(courses.length, "courses écrites,", erreurs, "erreurs");
})().catch(e => { console.error("ÉCHEC :", e.message); process.exit(1); });
