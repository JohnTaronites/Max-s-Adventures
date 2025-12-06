import * as THREE from 'three';

// --- KONFIGURACJA ---
const SPEED_START = 0.5;
const LANE_WIDTH = 2.5; // Szerokość pasa ruchu
let gameSpeed = SPEED_START;
let score = 0;
let lives = 3;
let isGameOver = false;

// --- INICJALIZACJA SCENY ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB); // Błękitne niebo
scene.fog = new THREE.Fog(0x87CEEB, 10, 50); // Mgła dla efektu głębi

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 3, 6);
camera.lookAt(0, 0, -5);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
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
// Podłoga (Pustynia)
const groundGeo = new THREE.PlaneGeometry(100, 200);
const groundMat = new THREE.MeshStandardMaterial({ color: 0xeebb99 }); // Kolor piasku
const ground = new THREE.Mesh(groundGeo, groundMat);
ground.rotation.x = -Math.PI / 2;
ground.position.z = -50;
ground.receiveShadow = true;
scene.add(ground);

// Dekoracje (Góry po bokach - Low Poly)
function createDecoration(x, z, scale) {
    const geo = new THREE.ConeGeometry(2, 5, 4); // Piramida
    const mat = new THREE.MeshStandardMaterial({ color: 0xcc8855, flatShading: true });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, 2.5 * scale, z);
    mesh.scale.set(scale, scale, scale);
    scene.add(mesh);
}
// Generuj góry
for(let i=0; i<20; i++) {
    createDecoration(-15, -i * 10, 1 + Math.random());
    createDecoration(15, -i * 10, 1 + Math.random());
}

// --- GRACZ (SAMOCHÓD) ---
const playerGroup = new THREE.Group();

// Karoseria
const bodyGeo = new THREE.BoxGeometry(1.2, 0.6, 2);
const bodyMat = new THREE.MeshStandardMaterial({ color: 0xffcc00 }); // Żółty
const body = new THREE.Mesh(bodyGeo, bodyMat);
body.position.y = 0.6;
body.castShadow = true;
playerGroup.add(body);

// Kabina
const cabinGeo = new THREE.BoxGeometry(1, 0.5, 1);
const cabinMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
const cabin = new THREE.Mesh(cabinGeo, cabinMat);
cabin.position.y = 1.15;
cabin.position.z = -0.2;
playerGroup.add(cabin);

// Koła (4 sztuki)
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
    
    // Przeszkoda (Skrzynia ze znakiem zapytania - tutaj brązowy klocek)
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshStandardMaterial({ color: 0x8B4513 }); // Brązowy
    const mesh = new THREE.Mesh(geo, mat);
    
    // Losowa pozycja X (-3, 0, 3)
    const lane = Math.floor(Math.random() * 3) - 1; // -1, 0, 1
    mesh.position.set(lane * LANE_WIDTH, 0.5, -60); // Start daleko
    mesh.castShadow = true;
    
    scene.add(mesh);
    obstacles.push(mesh);
}

function spawnCollectible() {
    if(isGameOver) return;
    
    // Znajdźka (Biała kula - "Głowa królika")
    const geo = new THREE.SphereGeometry(0.4, 8, 8);
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff });
    const mesh = new THREE.Mesh(geo, mat);
    
    const lane = Math.floor(Math.random() * 3) - 1;
    mesh.position.set(lane * LANE_WIDTH, 0.5, -60);
    
    scene.add(mesh);
    collectibles.push(mesh);
}

// Spawnowanie w interwałach
setInterval(spawnObstacle, 1500);
setInterval(spawnCollectible, 2000); // Rzadziej

// --- STEROWANIE (MYSZKA / DOTYK) ---
let targetX = 0;

function handleInput(xNormalized) {
    // xNormalized to wartość od 0 (lewo) do 1 (prawo)
    const range = 7; // Nieco węższy zakres, żeby nie wyjeżdżać za daleko
    targetX = (xNormalized - 0.5) * range;
}

// Obsługa myszy
document.addEventListener('mousemove', (e) => {
    handleInput(e.clientX / window.innerWidth);
});

// Obsługa dotyku (Mobile)
document.addEventListener('touchmove', (e) => {
    // Zapobiegamy przewijaniu strony podczas grania
    e.preventDefault(); 
    handleInput(e.touches[0].clientX / window.innerWidth);
}, { passive: false });


// --- PĘTLA GRY ---
function animate() {
    requestAnimationFrame(animate);
    
    // To jest ta linijka, której brakowało! Rysuje scenę:
    renderer.render(scene, camera); 
    
    if (isGameOver) return;

    // 1. Ruch gracza (płynne podążanie za myszką/palcem)
    playerGroup.position.x += (targetX - playerGroup.position.x) * 0.1;
    
    // Ograniczenie wyjazdu poza drogę
    playerGroup.position.x = Math.max(-4, Math.min(4, playerGroup.position.x));
    
    // Efekt "bujania się" auta przy skręcie
    playerGroup.rotation.z = (playerGroup.position.x - targetX) * 0.05;
    playerGroup.rotation.x = Math.sin(Date.now() * 0.01) * 0.05; // Wibracje silnika

    // 2. Obsługa Przeszkód
    for (let i = obstacles.length - 1; i >= 0; i--) {
        let obj = obstacles[i];
        obj.position.z += gameSpeed;
        obj.rotation.x += 0.02; // Obrót dla efektu

        // Kolizja
        const dist = playerGroup.position.distanceTo(obj.position);
        // Sprawdzamy dystans tylko jeśli obiekt jest blisko gracza w osi Z
        if (dist < 1.2 && obj.position.z > -1 && obj.position.z < 2) {
            handleCollision();
            scene.remove(obj);
            obstacles.splice(i, 1);
            continue;
        }

        // Usuwanie jeśli minie gracza
        if (obj.position.z > 10) {
            scene.remove(obj);
            obstacles.splice(i, 1);
            updateScore(10);
        }
    }

    // 3. Obsługa Znajdziek
    for (let i = collectibles.length - 1; i >= 0; i--) {
        let obj = collectibles[i];
        obj.position.z += gameSpeed;
        
        // Zebranie
        const dist = playerGroup.position.distanceTo(obj.position);
        if (dist < 1.2 && obj.position.z > -1 && obj.position.z < 2) {
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

    // Przyspieszanie gry
    gameSpeed += 0.0001;
}

function updateScore(val) {
    score += val;
    document.getElementById('score-val').innerText = score;
    // Level up co 500 pkt
    const lvl = Math.floor(score / 500) + 1;
    document.getElementById('level-val').innerText = lvl;
}

function handleCollision() {
    lives--;
    let hearts = "";
    for(let i=0; i<lives; i++) hearts += "❤";
    document.getElementById('hearts').innerText = hearts;

    // Efekt wstrząsu (prosty)
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

// Responsywność (zmiana rozmiaru okna)
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

animate();