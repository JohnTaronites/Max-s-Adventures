// Import bezpośredni - działa lepiej na różnych urządzeniach
import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

// --- KONFIGURACJA ---
const SPEED_START = 0.25; // ZNACZNIE WOLNIEJ NA START
const SPEED_INCREMENT = 0.00003; // Wolniejsze przyspieszanie
const LANE_WIDTH = 2.5;
let gameSpeed = SPEED_START;
let score = 0;
let lives = 3;
let isGameOver = false;

// --- INICJALIZACJA SCENY ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB);
scene.fog = new THREE.Fog(0x87CEEB, 10, 50);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 3, 7); // Kamera nieco dalej
camera.lookAt(0, 0, -5);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
// Ważne dla ostrości na telefonach:
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); 
renderer.shadowMap.enabled = true;
document.getElementById('canvas-container').appendChild(renderer.domElement);

// --- OŚWIETLENIE ---
const ambientLight = new THREE.HemisphereLight(0xffffff, 0xffeedd, 0.6);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(5, 10, 7);
dirLight.castShadow = true;
scene.add(dirLight);

// --- ELEMENTY ŚWIATA ---
const groundGeo = new THREE.PlaneGeometry(100, 200);
const groundMat = new THREE.MeshStandardMaterial({ color: 0xeebb99 });
const ground = new THREE.Mesh(groundGeo, groundMat);
ground.rotation.x = -Math.PI / 2;
ground.position.z = -50;
ground.receiveShadow = true;
scene.add(ground);

// Dekoracje (Góry)
function createDecoration(x, z, scale) {
    const geo = new THREE.ConeGeometry(2, 5, 4);
    const mat = new THREE.MeshStandardMaterial({ color: 0xcc8855, flatShading: true });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, 2.5 * scale, z);
    mesh.scale.set(scale, scale, scale);
    scene.add(mesh);
}
for(let i=0; i<25; i++) {
    createDecoration(-18, -i * 10, 1 + Math.random());
    createDecoration(18, -i * 10, 1 + Math.random());
}

// --- GRACZ (SAMOCHÓD) ---
const playerGroup = new THREE.Group();

const bodyGeo = new THREE.BoxGeometry(1.2, 0.6, 2);
const bodyMat = new THREE.MeshStandardMaterial({ color: 0xffcc00 });
const body = new THREE.Mesh(bodyGeo, bodyMat);
body.position.y = 0.6;
body.castShadow = true;
playerGroup.add(body);

const cabinGeo = new THREE.BoxGeometry(1, 0.5, 1);
const cabinMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
const cabin = new THREE.Mesh(cabinGeo, cabinMat);
cabin.position.y = 1.15;
cabin.position.z = -0.2;
playerGroup.add(cabin);

const wheelGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.4, 12);
const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
function addWheel(x, z) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(x, 0.3, z);
    playerGroup.add(wheel);
}
addWheel(0.7, 0.6); addWheel(-0.7, 0.6);
addWheel(0.7, -0.6); addWheel(-0.7, -0.6);

scene.add(playerGroup);

// --- PRZESZKODY I ZNAJDŹKI ---
const obstacles = [];
const collectibles = [];

function spawnObstacle() {
    if(isGameOver) return;
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
    const mesh = new THREE.Mesh(geo, mat);
    // Dalszy spawn (-70) daje więcej czasu na reakcję
    const lane = Math.floor(Math.random() * 3) - 1; 
    mesh.position.set(lane * LANE_WIDTH, 0.5, -70); 
    mesh.castShadow = true;
    scene.add(mesh);
    obstacles.push(mesh);
}

function spawnCollectible() {
    if(isGameOver) return;
    const geo = new THREE.SphereGeometry(0.4, 8, 8);
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff });
    const mesh = new THREE.Mesh(geo, mat);
    const lane = Math.floor(Math.random() * 3) - 1;
    mesh.position.set(lane * LANE_WIDTH, 0.5, -70);
    scene.add(mesh);
    collectibles.push(mesh);
}

// Interwały
setInterval(spawnObstacle, 1800); // Rzadziej
setInterval(spawnCollectible, 2500);

// --- STEROWANIE (KLAWIATURA + DOTYK) ---
let currentX = 0; // Aktualna pozycja
let targetX = 0;  // Gdzie chcemy jechać
let keyInput = 0; // -1 (lewo), 0 (środek), 1 (prawo)

// 1. Klawiatura (PC)
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

// 2. Dotyk (Mobile) - Przesuwanie palcem
document.addEventListener('touchmove', (e) => {
    e.preventDefault();
    // Mapujemy pozycję palca na szerokość ekranu (-1 do 1)
    const touchX = (e.touches[0].clientX / window.innerWidth) * 2 - 1;
    
    // Zwiększamy czułość (x4) i ograniczamy zakres
    let move = touchX * 4;
    // Blokujemy wyjazd poza mapę
    if(move < -1) move = -1;
    if(move > 1) move = 1;
    
    keyInput = move; // Nadpisuje klawiaturę
}, { passive: false });

document.addEventListener('touchend', () => {
    keyInput = 0; // Wycentruj/zatrzymaj skręt po puszczeniu (opcjonalne)
});


// --- PĘTLA GRY ---
function animate() {
    requestAnimationFrame(animate);
    
    // Logika ruchu gracza
    if (!isGameOver) {
        // Przesuwamy targetX w stronę wciśniętego klawisza
        // Jeśli keyInput to -1, jedziemy w lewo, jeśli 1 w prawo
        targetX += keyInput * 0.15; 
        
        // Ograniczamy max wychylenie (szerokość drogi)
        targetX = Math.max(-3.5, Math.min(3.5, targetX));
        
        // Płynne podążanie (lerp)
        playerGroup.position.x += (targetX - playerGroup.position.x) * 0.1;
        
        // Efekty wizualne skrętu
        playerGroup.rotation.z = (playerGroup.position.x - targetX) * 0.1; // Przechył
        playerGroup.rotation.x = Math.sin(Date.now() * 0.01) * 0.05; // Wibracje
    }

    // Renderowanie sceny
    renderer.render(scene, camera);

    if (isGameOver) return;

    // Obsługa Przeszkód
    for (let i = obstacles.length - 1; i >= 0; i--) {
        let obj = obstacles[i];
        obj.position.z += gameSpeed;
        
        // Kolizja
        const dist = playerGroup.position.distanceTo(obj.position);
        if (dist < 1.3 && obj.position.z > -1.5 && obj.position.z < 1.5) {
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

    // Obsługa Znajdziek
    for (let i = collectibles.length - 1; i >= 0; i--) {
        let obj = collectibles[i];
        obj.position.z += gameSpeed;
        
        const dist = playerGroup.position.distanceTo(obj.position);
        if (dist < 1.3 && obj.position.z > -1.5 && obj.position.z < 1.5) {
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
    let hearts = "";
    for(let i=0; i<lives; i++) hearts += "❤";
    document.getElementById('hearts').innerText = hearts;
    
    playerGroup.position.y += 0.5;
    setTimeout(() => playerGroup.position.y = 0, 100);

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

// Prosty debug na telefon, jeśli nadal byłby problem
window.onerror = function(msg, source, lineno) {
    // Odkomentuj linię poniżej, jeśli gra nadal nie wstaje na tel, pokaże błąd na ekranie
    // alert("Błąd: " + msg);
};

animate();