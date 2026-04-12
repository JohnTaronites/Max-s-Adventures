// Import bezpośredni - działa lepiej na różnych urządzeniach
import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

// --- KONFIGURACJA ---
const SPEED_START = 0.07;         // Wolny, komfortowy start
const SPEED_INCREMENT = 0.000012; // Bardzo stopniowe przyspieszanie
const LANE_WIDTH = 2.5;
const ROAD_WIDTH = 8;
const ROAD_LENGTH = 300;
const DASH_COUNT = 20;
const DASH_SPACING = 10;

let gameSpeed = SPEED_START;
let score = 0;
let lives = 3;
let isGameOver = false;

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

// --- OŚWIETLENIE ---
const ambientLight = new THREE.HemisphereLight(0xffffff, 0xaaddaa, 0.7);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 0.9);
dirLight.position.set(5, 10, 7);
dirLight.castShadow = true;
scene.add(dirLight);

// --- TRAWA (PODŁOŻE) ---
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

// --- KRAWĘŻNIKI ---
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

// --- GRACZ (SAMOCHÓD) ---
const playerGroup = new THREE.Group();

// Nadwozie
const bodyGeo = new THREE.BoxGeometry(1.3, 0.5, 2.4);
const bodyMat = new THREE.MeshStandardMaterial({ color: 0xee3333 });
const body = new THREE.Mesh(bodyGeo, bodyMat);
body.position.y = 0.55;
body.castShadow = true;
playerGroup.add(body);

// Kabina
const cabinGeo = new THREE.BoxGeometry(1.0, 0.45, 1.1);
const cabinMat = new THREE.MeshStandardMaterial({ color: 0xcc2222 });
const cabin = new THREE.Mesh(cabinGeo, cabinMat);
cabin.position.set(0, 1.05, -0.2);
playerGroup.add(cabin);

// Szyba przednia
const windshieldGeo = new THREE.BoxGeometry(0.9, 0.35, 0.05);
const windshieldMat = new THREE.MeshStandardMaterial({ color: 0x88ccff, transparent: true, opacity: 0.65 });
const windshield = new THREE.Mesh(windshieldGeo, windshieldMat);
windshield.position.set(0, 1.05, 0.36);
playerGroup.add(windshield);

// Koła + felgi
const wheelGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.38, 14);
const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
const hubGeo = new THREE.CylinderGeometry(0.16, 0.16, 0.39, 6);
const hubMat = new THREE.MeshStandardMaterial({ color: 0xbbbbbb });
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

playerGroup.position.set(0, 0, 4);
scene.add(playerGroup);

// --- PRZESZKODY (CZERWONE BECZKI) I ZNAJDŹKI (ZŁOTE MONETY) ---
const obstacles = [];
const collectibles = [];

const barrelBodyGeo  = new THREE.CylinderGeometry(0.45, 0.45, 1.0, 12);
const barrelBodyMat  = new THREE.MeshStandardMaterial({ color: 0xdd1100, roughness: 0.7 });
const barrelStripeGeo = new THREE.CylinderGeometry(0.46, 0.46, 0.15, 12);
const barrelStripeMat = new THREE.MeshStandardMaterial({ color: 0xffcc00 });
const barrelTopGeo   = new THREE.CylinderGeometry(0.45, 0.45, 0.08, 12);
const barrelTopMat   = new THREE.MeshStandardMaterial({ color: 0xaa0a00 });

const coinGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.12, 20);
const coinMat = new THREE.MeshStandardMaterial({ color: 0xffd700, roughness: 0.15, metalness: 0.85 });
const coinRimGeo = new THREE.TorusGeometry(0.42, 0.04, 8, 20);
const coinRimMat = new THREE.MeshStandardMaterial({ color: 0xffaa00, metalness: 0.9 });

function spawnObstacle() {
    if (isGameOver) return;
    const group = new THREE.Group();
    const barrel = new THREE.Mesh(barrelBodyGeo, barrelBodyMat);
    barrel.castShadow = true;
    group.add(barrel);
    const s1 = new THREE.Mesh(barrelStripeGeo, barrelStripeMat);
    s1.position.y = 0.32;
    group.add(s1);
    const s2 = new THREE.Mesh(barrelStripeGeo, barrelStripeMat);
    s2.position.y = -0.32;
    group.add(s2);
    const top = new THREE.Mesh(barrelTopGeo, barrelTopMat);
    top.position.y = 0.54;
    group.add(top);
    group.position.y = 0.5;
    const lane = Math.floor(Math.random() * 3) - 1;
    group.position.set(lane * LANE_WIDTH, 0.5, -70);
    scene.add(group);
    obstacles.push(group);
}

function spawnCollectible() {
    if (isGameOver) return;
    const group = new THREE.Group();
    const coin = new THREE.Mesh(coinGeo, coinMat);
    group.add(coin);
    const rim = new THREE.Mesh(coinRimGeo, coinRimMat);
    group.add(rim);
    const lane = Math.floor(Math.random() * 3) - 1;
    group.position.set(lane * LANE_WIDTH, 1.1, -70);
    group.rotation.x = Math.PI / 2;
    scene.add(group);
    collectibles.push(group);
}

setInterval(spawnObstacle, 2200);
setInterval(spawnCollectible, 2800);

// --- STEROWANIE (KLAWIATURA + DOTYK) ---
let targetX = 0;
let keyInput = 0;

document.addEventListener('keydown', (event) => {
    if (isGameOver) return;
    if (event.key === 'ArrowLeft' || event.key === 'a' || event.key === 'A') {
        keyInput = -1;
    } else if (event.key === 'ArrowRight' || event.key === 'd' || event.key === 'D') {
        keyInput = 1;
    }
});

document.addEventListener('keyup', (event) => {
    if (event.key === 'ArrowLeft' || event.key === 'a' || event.key === 'A') {
        if (keyInput === -1) keyInput = 0;
    } else if (event.key === 'ArrowRight' || event.key === 'd' || event.key === 'D') {
        if (keyInput === 1) keyInput = 0;
    }
});

document.addEventListener('touchmove', (e) => {
    e.preventDefault();
    const touchX = (e.touches[0].clientX / window.innerWidth) * 2 - 1;
    let move = touchX * 4;
    if (move < -1) move = -1;
    if (move > 1) move = 1;
    keyInput = move;
}, { passive: false });

document.addEventListener('touchend', () => {
    keyInput = 0;
});


// --- PĘTLA GRY ---
function animate() {
    requestAnimationFrame(animate);

    if (!isGameOver) {
        targetX += keyInput * 0.15;
        targetX = Math.max(-3.5, Math.min(3.5, targetX));
        playerGroup.position.x += (targetX - playerGroup.position.x) * 0.1;
        playerGroup.rotation.z = (playerGroup.position.x - targetX) * 0.08;
        playerGroup.rotation.x = Math.sin(Date.now() * 0.01) * 0.04;
    }

    // Scrollowanie linii jezdni
    for (const dash of dashLines) {
        dash.position.z += gameSpeed;
        if (dash.position.z > 10) {
            dash.position.z -= DASH_COUNT * DASH_SPACING;
        }
    }

    renderer.render(scene, camera);

    if (isGameOver) return;

    // Obsługa przeszkód (beczki)
    for (let i = obstacles.length - 1; i >= 0; i--) {
        const obj = obstacles[i];
        obj.position.z += gameSpeed;
        obj.rotation.y += 0.02;

        const dist = playerGroup.position.distanceTo(obj.position);
        if (dist < 1.25 && obj.position.z > -1.5 && obj.position.z < 2.5) {
            handleCollision();
            scene.remove(obj);
            obstacles.splice(i, 1);
            continue;
        }

        if (obj.position.z > 10) {
            scene.remove(obj);
            obstacles.splice(i, 1);
            updateScore(10);
        }
    }

    // Obsługa znajdziek (monety)
    for (let i = collectibles.length - 1; i >= 0; i--) {
        const obj = collectibles[i];
        obj.position.z += gameSpeed;
        obj.rotation.z += 0.06;
        obj.position.y = 1.1 + Math.sin(Date.now() * 0.003 + i * 1.7) * 0.25;

        const dist = playerGroup.position.distanceTo(obj.position);
        if (dist < 1.2 && obj.position.z > -1.5 && obj.position.z < 2.5) {
            scene.remove(obj);
            collectibles.splice(i, 1);
            updateScore(50);
            continue;
        }

        if (obj.position.z > 10) {
            scene.remove(obj);
            collectibles.splice(i, 1);
        }
    }

    gameSpeed += SPEED_INCREMENT;
}

function updateScore(val) {
    score += val;
    document.getElementById('score-val').innerText = score;
    const lvl = Math.floor(score / 500) + 1;
    document.getElementById('level-val').innerText = lvl;
}

function handleCollision() {
    lives--;
    let hearts = '';
    for (let i = 0; i < lives; i++) hearts += '❤';
    document.getElementById('hearts').innerText = hearts;

    playerGroup.position.y += 0.5;
    setTimeout(() => { playerGroup.position.y = 0; }, 150);

    if (lives <= 0) {
        gameOver();
    }
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