/**
 * Activa o genera una semana específica del curso Open Class.
 *
 * Uso básico:
 *   npm run semana -- 1
 *   npm run semana -- 3 --title "Sensores y actuadores" --date "Junio 15 de 2026"
 *
 * Este comando:
 * - Mantiene el curso en 8 semanas.
 * - Agrega la semana indicada a generation.activeWeeks.
 * - Actualiza los metadatos de la semana si se pasan flags.
 * - Regenera portal, lanzadores, scripts y decks.
 * - No sobrescribe el contenido ya editado en semanas/*.md, salvo con --force-content.
 */
import fs from "node:fs";
import { spawnSync } from "node:child_process";

const args = process.argv.slice(2);

function valueAfter(flag) {
  const i = args.indexOf(flag);
  if (i >= 0 && args[i + 1]) return args[i + 1];
  const pair = args.find((arg) => arg.startsWith(`${flag}=`));
  if (pair) return pair.slice(flag.length + 1);
  return undefined;
}

function fail(message) {
  console.error(`\n❌ ${message}\n`);
  process.exit(1);
}

function readJson(filePath) {
  if (!fs.existsSync(filePath)) fail(`No se encontró ${filePath}. Ejecuta primero npm run nuevo o crea openclass.config.json.`);
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch (error) {
    fail(`No se pudo leer ${filePath}. Revisa que sea JSON válido.\n${error.message}`);
  }
}

function toWeekNumber() {
  const fromFlag = valueAfter("--week") || valueAfter("-w");
  const positional = args.find((arg) => /^\d+$/.test(arg));
  const value = Number(fromFlag || positional);
  if (!Number.isInteger(value) || value < 1 || value > 8) {
    fail("Debes indicar una semana entre 1 y 8. Ejemplo: npm run semana -- 3");
  }
  return value;
}

function normalizeWeek(weekNumber, existing = {}) {
  const title = String(existing.title || `Título semana ${weekNumber}`).trim();
  return {
    number: weekNumber,
    title,
    date: String(existing.date || new Date().getFullYear()).trim(),
    centralTheme: String(existing.centralTheme || existing.theme || title || "Tema central de la semana").trim(),
    activity: String(existing.activity || "Actividad o evaluación relacionada").trim(),
    duration: String(existing.duration || "90 minutos").trim(),
    status: String(existing.status || "active").trim(),
  };
}

const weekNumber = toWeekNumber();
const configPath = valueAfter("--config") || "openclass.config.json";
const forceContent = args.includes("--force-content");
const removeOtherWeeks = args.includes("--only");

const title = valueAfter("--title");
const date = valueAfter("--date");
const centralTheme = valueAfter("--theme") || valueAfter("--central-theme");
const activity = valueAfter("--activity");
const duration = valueAfter("--duration");

const config = readJson(configPath);
config.course ||= {};
config.generation ||= {};
config.weeks = Array.isArray(config.weeks) ? config.weeks : [];

config.generation.weeksTotal = 8;
config.generation.overwriteLaunchers = true;
config.generation.overwritePortal = true;
config.generation.overwriteDecks = true;
config.generation.overwritePackageScripts = true;
config.generation.overwriteWeekContent = forceContent;

const byNumber = new Map(config.weeks.map((week) => [Number(week.number), week]));
for (let i = 1; i <= 8; i++) {
  byNumber.set(i, normalizeWeek(i, byNumber.get(i)));
}

const target = byNumber.get(weekNumber);
if (title) target.title = title;
if (date) target.date = date;
if (centralTheme) target.centralTheme = centralTheme;
if (activity) target.activity = activity;
if (duration) target.duration = duration;
target.status = "active";

const previousActive = Array.isArray(config.generation.activeWeeks) ? config.generation.activeWeeks.map(Number) : [];
const nextActive = removeOtherWeeks ? [weekNumber] : [...new Set([...previousActive, weekNumber])];
config.generation.activeWeeks = nextActive.filter((n) => Number.isInteger(n) && n >= 1 && n <= 8).sort((a, b) => a - b);
config.weeks = Array.from(byNumber.values()).sort((a, b) => a.number - b.number);

fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n", "utf-8");

console.log("\n┌──────────────────────────────────────────┐");
console.log("│ Generar / activar semana Open Class      │");
console.log("└──────────────────────────────────────────┘\n");
console.log(`Configuración : ${configPath}`);
console.log(`Semana        : ${weekNumber}`);
console.log(`Activas       : ${config.generation.activeWeeks.join(", ")}`);
console.log(`Contenido     : ${forceContent ? "se sobrescribirá" : "se conserva si ya existe"}\n`);

const generatorArgs = ["scripts/generar-desde-config.mjs", "--config", configPath, ...(forceContent ? ["--force-content"] : [])];
const result = spawnSync(process.execPath, generatorArgs, {
  stdio: "inherit",
  shell: false,
});

process.exit(result.status ?? 0);
