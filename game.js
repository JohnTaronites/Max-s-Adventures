// Import bezpoÅ›redni - dziaÅ‚a lepiej na rÃ³Å¼nych urzÄ…dzeniach
import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

// --- KONFIGURACJA ---
// PrÄ™dkoÅ›Ä‡ bazowa i wzrost per poziom (zamiast ciÄ…gÅ‚ego maÅ‚ego przyrostu)
const SPEED_BASE        = 0.042;  // start bardzo wolno
const SPEED_PER_LEVEL   = 0.016;  // wzrost per poziom
const SCORE_PER_LEVEL   = 400;    // co ile punktÃ³w nowy poziom
const LANE_WIDTH        = 2.5;
const ROAD_WIDTH        = 8;
const ROAD_LENGTH       = 300;
const DASH_COUNT        = 20;
const DASH_SPACING      = 10;

// OÅ› Z gracza = 4 (playerGroup.position.z = 4)
const PLAYER_Z          = 4;
const COLLISION_Z_MIN   = PLAYER_Z - 2.2;   // ~1.8
const COLLISION_Z_MAX   = PLAYER_Z + 2.2;   // ~6.2
const COLLISION_XZ_DIST = 1.3;

let gameSpeed = SPEED_BASE;
let score     = 0;
let level     = 1;
let lives     = 3;
let isGameOver = false;

// Animowane obiekty po kolizji/zebraniu
const dyingObjects = []; // { group, age, vx, vy, vz, type: 'barrel'|'coin' }

// --- INICJALIZACJA SCENY ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB);
scene.fog = new THREE.Fog(0x87CEEB, 40, 90);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 3.5, 8);
camera.lookAt(0, 0, -5);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
document.getElementById('canvas-container').appendChild(renderer.domElement);

// --- OÅšWIETLENIE ---
const ambientLight = new THREE.HemisphereLight(0xffffff, 0xaaddaa, 0.7);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 0.9);
dirLight.position.set(5, 10, 7);
dirLight.castShadow = true;
scene.add(dirLight);

// --- TRAWA (PODÅOÅ»E) ---
const grassGeo = new THREE.PlaneGeometry(100, ROAD_LENGTH);
const grassMat = new THREE.MeshStandardMaterial({ color: 0x4a9e4a });
const grass = new THREE.Mesh(grassGeo, grassMat);
grass.rotation.x = -Math.PI / 2;
grass.position.set(0, 0, -ROAD_LENGTH / 2 + 10);
grass.receiveShadow = true;
scene.add(grass);

// --- DROGA (ASFALT) ---
const roadGeo = new THREE.PlaneGeometry(ROAD_WIDTH, ROAD_LENGTH);
const roadMat = new THREE.MeshStandardMaterial({ color: 0x444444 });
const road = new THREE.Mesh(roadGeo, roadMat);
road.rotation.x = -Math.PI / 2;
road.position.set(0, 0.01, -ROAD_LENGTH / 2 + 10);
road.receiveShadow = true;
scene.add(road);

// --- KRAWÄ˜Å»NIKI ---
const curbGeo = new THREE.BoxGeometry(0.35, 0.15, ROAD_LENGTH);
const curbMat = new THREE.MeshStandardMaterial({ color: 0xdddddd });
const curbL = new THREE.Mesh(curbGeo, curbMat);
curbL.position.set(-(ROAD_WIDTH / 2 + 0.175), 0.075, -ROAD_LENGTH / 2 + 10);
scene.add(curbL);
const curbR = new THREE.Mesh(curbGeo, curbMat);
curbR.position.set(ROAD_WIDTH / 2 + 0.175, 0.075, -ROAD_LENGTH / 2 + 10);
scene.add(curbR);

// --- LINIE JEZDNI (SCROLLOWANE) ---
const dashGeo = new THREE.PlaneGeometry(0.18, 3);
const dashMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
const dashLines = [];
for (let i = 0; i < DASH_COUNT; i++) {
    const zPos = -i * DASH_SPACING;
    [-LANE_WIDTH, LANE_WIDTH].forEach(xPos => {
        const dash = new THREE.Mesh(dashGeo, dashMat);
        dash.rotation.x = -Math.PI / 2;
        dash.position.set(xPos, 0.02, zPos);
        scene.add(dash);
        dashLines.push(dash);
    });
}

// --- DRZEWA (DEKORACJE) ---
function createTree(x, z, scale) {
    const group = new THREE.Group();
    const trunkGeo = new THREE.CylinderGeometry(0.2 * scale, 0.3 * scale, 1.5 * scale, 8);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x8B5E3C });
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = 0.75 * scale;
    trunk.castShadow = true;
    group.add(trunk);
    const crownGeo = new THREE.ConeGeometry(1.2 * scale, 2.5 * scale, 8);
    const crownMat = new THREE.MeshStandardMaterial({ color: 0x2d7a2d, flatShading: true });
    const crown = new THREE.Mesh(crownGeo, crownMat);
    crown.position.y = 2.75 * scale;
    crown.castShadow = true;
    group.add(crown);
    group.position.set(x, 0, z);
    scene.add(group);
}
for (let i = 0; i < 22; i++) {
    createTree(-13 - Math.random() * 5, -i * 10 - 5, 0.8 + Math.random() * 0.5);
    createTree(13 + Math.random() * 5, -i * 10 - 5, 0.8 + Math.random() * 0.5);
}

// --- GRACZ (SAMOCHÃ“D) ---
const playerGroup = new THREE.Group();

const bodyGeo = new THREE.BoxGeometry(1.3, 0.5, 2.4);
const bodyMat = new THREE.MeshStandardMaterial({ color: 0xee3333 });
const body = new THREE.Mesh(bodyGeo, bodyMat);
body.position.y = 0.55;
body.castShadow = true;
playerGroup.add(body);

const cabinGeo = new THREE.BoxGeometry(1.0, 0.45, 1.1);
const cabinMat = new THREE.MeshStandardMaterial({ color: 0xcc2222 });
const cabin = new THREE.Mesh(cabinGeo, cabinMat);
cabin.position.set(0, 1.05, -0.2);
playerGroup.add(cabin);

const windshieldGeo = new THREE.BoxGeometry(0.9, 0.35, 0.05);
const windshieldMat = new THREE.MeshStandardMaterial({ color: 0x88ccff, transparent: true, opacity: 0.65 });
const windshield = new THREE.Mesh(windshieldGeo, windshieldMat);
windshield.position.set(0, 1.05, 0.36);
playerGroup.add(windshield);

const wheelGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.38, 14);
const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
const hubGeo  = new THREE.CylinderGeometry(0.16, 0.16, 0.39, 6);
const hubMat  = new THREE.MeshStandardMaterial({ color: 0xbbbbbb });
function addWheel(x, z) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(x, 0.32, z);
    wheel.castShadow = true;
    playerGroup.add(wheel);
    const hub = new THREE.Mesh(hubGeo, hubMat);
    hub.rotation.z = Math.PI / 2;
    hub.position.set(x, 0.32, z);
    playerGroup.add(hub);
}
addWheel(0.8, 0.8);  addWheel(-0.8, 0.8);
addWheel(0.8, -0.8); addWheel(-0.8, -0.8);

playerGroup.position.set(0, 0, PLAYER_Z);
scene.add(playerGroup);

// --- FABRYKI MESH ---
function makeBarrelGroup() {
    const g = new THREE.Group();
    const barrelBodyGeo   = new THREE.CylinderGeometry(0.45, 0.45, 1.0, 12);
    const barrelBodyMat   = new THREE.MeshStandardMaterial({ color: 0xdd1100, roughness: 0.7 });
    const barrelStripeGeo = new THREE.CylinderGeometry(0.46, 0.46, 0.15, 12);
    const barrelStripeMat = new THREE.MeshStandardMaterial({ color: 0xffcc00 });
    const barrelTopGeo    = new THREE.CylinderGeometry(0.45, 0.45, 0.08, 12);
    const barrelTopMat    = new THREE.MeshStandardMaterial({ color: 0xaa0a00 });
    const b = new THREE.Mesh(barrelBodyGeo, barrelBodyMat);
    b.castShadow = true;
    g.add(b);
    const s1 = new THREE.Mesh(barrelStripeGeo, barrelStripeMat); s1.position.y =  0.32; g.add(s1);
    const s2 = new THREE.Mesh(barrelStripeGeo, barrelStripeMat); s2.position.y = -0.32; g.add(s2);
    const t  = new THREE.Mesh(barrelTopGeo, barrelTopMat);       t.position.y  =  0.54; g.add(t);
    return g;
}

function makeCoinGroup() {
    const g = new THREE.Group();
    const coinGeo    = new THREE.CylinderGeometry(0.42, 0.42, 0.12, 20);
    const coinMat    = new THREE.MeshStandardMaterial({ color: 0xffd700, roughness: 0.15, metalness: 0.85, transparent: true });
    const coinRimGeo = new THREE.TorusGeometry(0.42, 0.04, 8, 20);
    const coinRimMat = new THREE.MeshStandardMaterial({ color: 0xffaa00, metalness: 0.9, transparent: true });
    g.add(new THREE.Mesh(coinGeo, coinMat));
    g.add(new THREE.Mesh(coinRimGeo, coinRimMat));
    return g;
}

// --- SPAWNING (FALE - MAKS 2 PASY ZABLOKOWANE) ---
const obstacles   = [];
const collectibles = [];

function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function spawnWave() {
    if (isGameOver) return;
    const lanes = shuffle([-1, 0, 1]);
    // Zawsze zostawiamy przynajmniej 1 wolny pas (max 2 beczki na falÄ™)
    const count = Math.random() < 0.3 ? 2 : 1;
    // Spawn z dostosowany do prędkości — ~300 klatek dojazdu
    const spawnZ = -(PLAYER_Z + 300 * gameSpeed);
    for (let k = 0; k < count; k++) {
        const g = makeBarrelGroup();
        g.position.set(lanes[k] * LANE_WIDTH, 0.5, spawnZ);
        scene.add(g);
        obstacles.push(g);
    }
}

function spawnCollectible() {
    if (isGameOver) return;
    const g = makeCoinGroup();
    const lane = Math.floor(Math.random() * 3) - 1;
    const spawnZ = -(PLAYER_Z + 300 * gameSpeed);
    g.position.set(lane * LANE_WIDTH, 1.1, spawnZ);
    g.rotation.x = Math.PI / 2;
    scene.add(g);
    collectibles.push(g);
}

setInterval(spawnWave, 2400);
setInterval(spawnCollectible, 2900);

// --- STEROWANIE (KLAWIATURA + DOTYK) ---
let targetX  = 0;
let keyInput = 0;

document.addEventListener('keydown', (event) => {
    if (isGameOver) return;
    if (event.key === 'ArrowLeft'  || event.key === 'a' || event.key === 'A') keyInput = -1;
    else if (event.key === 'ArrowRight' || event.key === 'd' || event.key === 'D') keyInput = 1;
});
document.addEventListener('keyup', (event) => {
    if ((event.key === 'ArrowLeft'  || event.key === 'a' || event.key === 'A') && keyInput === -1) keyInput = 0;
    if ((event.key === 'ArrowRight' || event.key === 'd' || event.key === 'D') && keyInput ===  1) keyInput = 0;
});
document.addEventListener('touchmove', (e) => {
    e.preventDefault();
    let move = ((e.touches[0].clientX / window.innerWidth) * 2 - 1) * 4;
    move = Math.max(-1, Math.min(1, move));
    keyInput = move;
}, { passive: false });
document.addEventListener('touchend', () => { keyInput = 0; });

// --- HELPER: kolizja XZ (ignoruje Y, bo monety sÄ… wyÅ¼ej niÅ¼ beczki) ---
function collidesXZ(objPos) {
    const dx = playerGroup.position.x - objPos.x;
    const dz = playerGroup.position.z - objPos.z;
    return Math.sqrt(dx * dx + dz * dz) < COLLISION_XZ_DIST;
}

// --- ANIMACJA ÅšMIERCI BECZKI (odlatuje w bok i spada) ---
function killBarrel(group) {
    // UsuÅ„ z tablicy aktywnych przed animacjÄ…
    const dir = (group.position.x >= 0) ? 1 : -1;
    dyingObjects.push({
        group,
        age:  0,
        vx:   dir * (0.18 + Math.random() * 0.12),
        vy:   0.12,
        vz:   0.04,
        rotX: 0.08 + Math.random() * 0.06,
        rotZ: dir * 0.1,
        type: 'barrel'
    });
}

// --- ANIMACJA ZEBRANIA MONETY (leci w gÃ³rÄ™ i zanika) ---
function collectCoin(group) {
    dyingObjects.push({
        group,
        age:  0,
        vx:   0,
        vy:   0.18,
        vz:   0,
        rotX: 0,
        rotZ: 0.1,
        type: 'coin'
    });
    // WyÅ‚Ä…cz floating/rotation kontrolowane przez pÄ™tlÄ™ gry
    group.userData.dying = true;
}

// --- PÄ˜TLA GRY ---
function animate() {
    requestAnimationFrame(animate);

    if (!isGameOver) {
        targetX += keyInput * 0.15;
        targetX = Math.max(-3.5, Math.min(3.5, targetX));
        playerGroup.position.x += (targetX - playerGroup.position.x) * 0.1;
        playerGroup.rotation.z = (playerGroup.position.x - targetX) * 0.08;
        playerGroup.rotation.x = Math.sin(Date.now() * 0.01) * 0.04;
    }

    // Scrollowanie linii jezdni — tylko gdy gra trwa
    if (!isGameOver) {
        for (const dash of dashLines) {
            dash.position.z += gameSpeed;
            if (dash.position.z > 10) dash.position.z -= DASH_COUNT * DASH_SPACING;
        }
    }

    renderer.render(scene, camera);

    if (isGameOver) return;

    // --- ObsÅ‚uga przeszkÃ³d (beczki) ---
    for (let i = obstacles.length - 1; i >= 0; i--) {
        const obj = obstacles[i];
        obj.position.z += gameSpeed;
        obj.rotation.y += 0.02;

        // Kolizja: sprawdzamy XZ i zakres Z zbliÅ¼ony do gracza
        if (
            obj.position.z > COLLISION_Z_MIN &&
            obj.position.z < COLLISION_Z_MAX &&
            collidesXZ(obj.position)
        ) {
            obstacles.splice(i, 1);
            killBarrel(obj);
            handleCollision();
            continue;
        }

        // Beczka minÄ™Å‚a gracza â€” usuÅ„, dodaj punkty za unik
        if (obj.position.z > PLAYER_Z + 8) {
            scene.remove(obj);
            obstacles.splice(i, 1);
            updateScore(10);
        }
    }

    // --- ObsÅ‚uga znajdziek (monety) ---
    for (let i = collectibles.length - 1; i >= 0; i--) {
        const obj = collectibles[i];
        if (obj.userData.dying) continue; // juÅ¼ w animacji

        obj.position.z += gameSpeed;
        obj.rotation.z += 0.06;
        obj.position.y = 1.1 + Math.sin(Date.now() * 0.003 + i * 1.7) * 0.25;

        if (
            obj.position.z > COLLISION_Z_MIN &&
            obj.position.z < COLLISION_Z_MAX &&
            collidesXZ(obj.position)
        ) {
            collectibles.splice(i, 1);
            collectCoin(obj);
            updateScore(50);
            continue;
        }

        if (obj.position.z > PLAYER_Z + 8) {
            scene.remove(obj);
            collectibles.splice(i, 1);
        }
    }

    // --- Animacje obiektÃ³w ginÄ…cych ---
    for (let i = dyingObjects.length - 1; i >= 0; i--) {
        const d = dyingObjects[i];
        d.age++;
        d.group.position.x += d.vx;
        d.group.position.y += d.vy;
        d.group.position.z += d.vz;
        d.group.rotation.x += d.rotX;
        d.group.rotation.z += d.rotZ;

        if (d.type === 'barrel') {
            d.vy -= 0.012; // grawitacja
            // SpÅ‚aszcz beczkÄ™
            if (d.group.scale.y > 0.15) d.group.scale.y -= 0.04;
        }

        if (d.type === 'coin') {
            // Zanikanie
            d.group.children.forEach(mesh => {
                if (mesh.material && mesh.material.transparent) {
                    mesh.material.opacity = Math.max(0, 1 - d.age / 22);
                }
            });
        }

        // UsuÅ„ po ~35 klatkach lub gdy spadnie pod podÅ‚oÅ¼e
        if (d.age > 35 || d.group.position.y < -3) {
            scene.remove(d.group);
            dyingObjects.splice(i, 1);
        }
    }
}

function updateScore(val) {
    score += val;
    document.getElementById('score-val').innerText = score;
    const newLevel = Math.floor(score / SCORE_PER_LEVEL) + 1;
    if (newLevel !== level) {
        level = newLevel;
        gameSpeed = SPEED_BASE + (level - 1) * SPEED_PER_LEVEL;
        document.getElementById('level-val').innerText = level;
    }
}

function handleCollision() {
    lives--;
    let hearts = '';
    for (let i = 0; i < lives; i++) hearts += '\u2764';
    document.getElementById('hearts').innerText = hearts;

    // MigniÄ™cie autka
    playerGroup.position.y += 0.4;
    setTimeout(() => { playerGroup.position.y = 0; }, 150);

    if (lives <= 0) gameOver();
}

function gameOver() {
    isGameOver = true;
    document.getElementById('game-over').style.display = 'block';
    document.getElementById('final-score').innerText = score;
}

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

window.onerror = function (msg) {
    console.error('Game error:', msg);
};

animate();
