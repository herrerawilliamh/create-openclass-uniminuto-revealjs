import { execSync } from 'child_process';

const fecha = new Date().toLocaleString('es-CO', {
  timeZone: 'America/Bogota',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

const mensaje = `Actualización de diapositivas - ${fecha}`;

function run(cmd) {
  execSync(cmd, { stdio: 'inherit' });
}

console.log('\n🔍 Verificando cambios...');
const status = execSync('git status --porcelain').toString().trim();

if (!status) {
  console.log('⚠️  No hay cambios para publicar.');
  process.exit(0);
}

console.log('\n📦 Preparando archivos...');
run('git add -A');

console.log('\n💾 Confirmando cambios...');
run(`git commit -m "${mensaje}"`);

console.log('\n🚀 Subiendo a GitHub...');
run('git push');

console.log(`\n✅ Publicado: ${mensaje}`);
console.log('   GitHub Actions desplegará el sitio automáticamente.\n');
