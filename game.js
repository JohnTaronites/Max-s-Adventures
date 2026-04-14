// Import bezpoÅ›redni - dziaÅ‚a lepiej na rÃ³Å¼nych urzÄ…dzeniach
import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

// --- KONFIGURACJA ---
// PrÄ™dkoÅ›Ä‡ bazowa i wzrost per poziom (zamiast ciÄ…gÅ‚ego maÅ‚ego przyrostu)
const SPEED_BASE        = 0.120;  // start bardzo wolno
const SPEED_PER_LEVEL   = 0.016;  // wzrost per poziom
const SCORE_PER_LEVEL   = 400;    // co ile punktÃ³w nowy poziom
const LANE_WIDTH        = 2.5;
const ROAD_WIDTH        = 10;
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
let oreoCount = 0;
let isGameOver = false;
let isPaused   = false;
let isStarted  = false;

// --- DŹWIĘKI ---
function makeSound(src) {
    const a = new Audio(src);
    a.preload = 'auto';
    return a;
}
const sfx = {
    mniam:   makeSound('sounds/mniam.mp3'),
    aumonkey: makeSound('sounds/aumonkey.mp3'),
    owno:    makeSound('sounds/owno.mp3'),
    faster:  makeSound('sounds/itsfaster.mp3'),
    monkey:  makeSound('sounds/monkey-on-theroad.mp3'),
};
function playSound(name) {
    const s = sfx[name];
    if (!s) return;
    s.currentTime = 0;
    s.play().catch(() => {});
}

// Eksponuj funkcje na window dla onclick w HTML
window.startGame = function() {
    isStarted = true;
    document.getElementById('start-screen').style.display = 'none';
};
window.togglePause = function() {
    if (isGameOver || !isStarted) return;
    isPaused = !isPaused;
    document.getElementById('pause-overlay').style.display = isPaused ? 'block' : 'none';
    document.getElementById('pause-btn').textContent = isPaused ? '▶' : '⏸';
};
window.mobileTap = function(dir) {
    changeLane(dir);
};

// Animowane obiekty po kolizji/zebraniu
const dyingObjects = []; // { group, age, vx, vy, vz, type: 'barrel'|'coin' }

// --- INICJALIZACJA SCENY ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB);
scene.fog = new THREE.Fog(0x87CEEB, 40, 90);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 6.5, 14);
camera.lookAt(0, 0.5, -5);

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

// --- OTOCZENIE DROGI (SCROLLOWANE DEKORACJE) ---
const SCENERY_SPACING = 20;
const SCENERY_PER_SIDE = 14;
const sceneryItems = [];

function makeSceneryGroup(type) {
    const g = new THREE.Group();
    if (type === 'tree') {
        const scale = 0.8 + Math.random() * 0.5;
        const trunk = new THREE.Mesh(
            new THREE.CylinderGeometry(0.2*scale, 0.3*scale, 1.5*scale, 8),
            new THREE.MeshStandardMaterial({ color: 0x8B5E3C })
        );
        trunk.position.y = 0.75 * scale;
        g.add(trunk);
        const crown = new THREE.Mesh(
            new THREE.ConeGeometry(1.2*scale, 2.5*scale, 8),
            new THREE.MeshStandardMaterial({ color: 0x2d7a2d, flatShading: true })
        );
        crown.position.y = 2.75 * scale;
        g.add(crown);
    } else if (type === 'barn') {
        const body = new THREE.Mesh(
            new THREE.BoxGeometry(3, 2.5, 4),
            new THREE.MeshStandardMaterial({ color: 0xb03030 })
        );
        body.position.y = 1.25;
        g.add(body);
        const roof = new THREE.Mesh(
            new THREE.ConeGeometry(2.5, 1.5, 4),
            new THREE.MeshStandardMaterial({ color: 0x8B0000 })
        );
        roof.position.y = 3.25;
        roof.rotation.y = Math.PI / 4;
        g.add(roof);
        const win = new THREE.Mesh(
            new THREE.BoxGeometry(0.6, 0.6, 0.1),
            new THREE.MeshStandardMaterial({ color: 0xffffaa })
        );
        win.position.set(0, 1.8, 2.05);
        g.add(win);
    } else if (type === 'tractor') {
        const body = new THREE.Mesh(
            new THREE.BoxGeometry(1.5, 1, 3),
            new THREE.MeshStandardMaterial({ color: 0x228822 })
        );
        body.position.y = 1.2;
        g.add(body);
        const cabin = new THREE.Mesh(
            new THREE.BoxGeometry(1.3, 0.9, 1.4),
            new THREE.MeshStandardMaterial({ color: 0x33aa33 })
        );
        cabin.position.set(0, 2.1, -0.4);
        g.add(cabin);
        [[0.85, 0.65, 0.6], [-0.85, 0.65, 0.6]].forEach(([wx, wy, wz]) => {
            const wh = new THREE.Mesh(
                new THREE.CylinderGeometry(0.6, 0.6, 0.35, 10),
                new THREE.MeshStandardMaterial({ color: 0x111111 })
            );
            wh.rotation.z = Math.PI / 2;
            wh.position.set(wx, wy, wz);
            g.add(wh);
        });
        [[0.75, 0.45, -0.9], [-0.75, 0.45, -0.9]].forEach(([wx, wy, wz]) => {
            const wh = new THREE.Mesh(
                new THREE.CylinderGeometry(0.4, 0.4, 0.25, 8),
                new THREE.MeshStandardMaterial({ color: 0x111111 })
            );
            wh.rotation.z = Math.PI / 2;
            wh.position.set(wx, wy, wz);
            g.add(wh);
        });
        const pipe = new THREE.Mesh(
            new THREE.CylinderGeometry(0.08, 0.08, 1, 6),
            new THREE.MeshStandardMaterial({ color: 0x888888 })
        );
        pipe.position.set(0.4, 2.6, -0.6);
        g.add(pipe);
    } else if (type === 'cow') {
        const body = new THREE.Mesh(
            new THREE.BoxGeometry(1.2, 0.7, 2),
            new THREE.MeshStandardMaterial({ color: 0xffffff })
        );
        body.position.y = 1.05;
        g.add(body);
        const spot = new THREE.Mesh(
            new THREE.BoxGeometry(0.5, 0.71, 0.7),
            new THREE.MeshStandardMaterial({ color: 0x222222 })
        );
        spot.position.set(0.2, 1.05, 0.2);
        g.add(spot);
        const head = new THREE.Mesh(
            new THREE.BoxGeometry(0.7, 0.6, 0.7),
            new THREE.MeshStandardMaterial({ color: 0xffffff })
        );
        head.position.set(0, 1.3, -1.15);
        g.add(head);
        [-0.4, 0.4].forEach(hx => {
            const ear = new THREE.Mesh(
                new THREE.BoxGeometry(0.15, 0.2, 0.1),
                new THREE.MeshStandardMaterial({ color: 0xffcccc })
            );
            ear.position.set(hx, 1.6, -1.15);
            g.add(ear);
        });
        [[-0.4, 0.35, 0.55], [0.4, 0.35, 0.55], [-0.4, 0.35, -0.55], [0.4, 0.35, -0.55]].forEach(([lx, ly, lz]) => {
            const leg = new THREE.Mesh(
                new THREE.BoxGeometry(0.2, 0.7, 0.2),
                new THREE.MeshStandardMaterial({ color: 0xffffff })
            );
            leg.position.set(lx, ly, lz);
            g.add(leg);
        });
    } else if (type === 'haystack') {
        const base = new THREE.Mesh(
            new THREE.CylinderGeometry(1.2, 1.4, 1.4, 10),
            new THREE.MeshStandardMaterial({ color: 0xd4aa30 })
        );
        base.position.y = 0.7;
        g.add(base);
        const top = new THREE.Mesh(
            new THREE.SphereGeometry(1.1, 8, 6),
            new THREE.MeshStandardMaterial({ color: 0xc49a20 })
        );
        top.position.y = 1.7;
        g.add(top);
    } else if (type === 'sunflowers') {
        for (let idx = 0; idx < 4; idx++) {
            const stem = new THREE.Mesh(
                new THREE.CylinderGeometry(0.06, 0.08, 1.8, 6),
                new THREE.MeshStandardMaterial({ color: 0x3a7a1a })
            );
            stem.position.set((idx - 1.5) * 0.7, 0.9, 0);
            g.add(stem);
            const flower = new THREE.Mesh(
                new THREE.CylinderGeometry(0.35, 0.35, 0.1, 10),
                new THREE.MeshStandardMaterial({ color: 0xffdd00 })
            );
            flower.position.set((idx - 1.5) * 0.7, 1.85, 0);
            g.add(flower);
            const center = new THREE.Mesh(
                new THREE.CylinderGeometry(0.15, 0.15, 0.12, 8),
                new THREE.MeshStandardMaterial({ color: 0x663300 })
            );
            center.position.set((idx - 1.5) * 0.7, 1.92, 0);
            g.add(center);
        }
    }
    return g;
}

const SCENERY_TYPES = ['tree', 'tree', 'tree', 'barn', 'tractor', 'cow', 'haystack', 'sunflowers'];
for (let i = 0; i < SCENERY_PER_SIDE; i++) {
    const z = -i * SCENERY_SPACING;
    [-1, 1].forEach(side => {
        const type = SCENERY_TYPES[Math.floor(Math.random() * SCENERY_TYPES.length)];
        const grp = makeSceneryGroup(type);
        grp.position.set(side * (ROAD_WIDTH / 2 + 3 + Math.random() * 3), 0, z);
        scene.add(grp);
        sceneryItems.push({ group: grp, side });
    });
}

// --- GRACZ (MONSTER TRUCK) ---
const playerGroup = new THREE.Group();

function makeCanvasTex(w, h, drawFn) {
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    drawFn(cv.getContext('2d'));
    return new THREE.CanvasTexture(cv);
}
const tex10 = makeCanvasTex(128, 128, (ctx) => {
    ctx.clearRect(0, 0, 128, 128);
    ctx.font = 'bold 86px Arial Black,Arial';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.strokeStyle = '#000'; ctx.lineWidth = 7;
    ctx.strokeText('10', 64, 68);
    ctx.fillStyle = '#ffffff'; ctx.fillText('10', 64, 68);
});
const texPlate = makeCanvasTex(256, 96, (ctx) => {
    ctx.fillStyle = '#f5f5dc'; ctx.fillRect(0, 0, 256, 96);
    ctx.strokeStyle = '#333'; ctx.lineWidth = 5; ctx.strokeRect(3, 3, 250, 90);
    ctx.font = 'bold 60px Arial Black,Arial';
    ctx.fillStyle = '#111'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('MAX', 128, 52);
});
const texFlame = makeCanvasTex(256, 128, (ctx) => {
    ctx.clearRect(0, 0, 256, 128);
    const g = ctx.createLinearGradient(0, 128, 0, 0);
    g.addColorStop(0, '#ff3300'); g.addColorStop(0.5, '#ff9900'); g.addColorStop(1, 'rgba(255,238,0,0)');
    ctx.fillStyle = g;
    const pts = [0,128, 25,65, 48,100, 72,38, 96,88, 120,28, 148,82, 172,35, 196,95, 220,55, 256,128];
    ctx.beginPath(); ctx.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i+1]);
    ctx.closePath(); ctx.fill();
    ctx.font = 'bold 50px Arial Black,Arial';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.strokeStyle = '#000'; ctx.lineWidth = 5; ctx.strokeText('MAX', 128, 82);
    ctx.fillStyle = '#fff'; ctx.fillText('MAX', 128, 82);
});

// Chassis
const chassis = new THREE.Mesh(
    new THREE.BoxGeometry(1.45, 0.22, 3.0),
    new THREE.MeshStandardMaterial({ color: 0x1a1a1a })
);
chassis.position.y = 0.86; chassis.castShadow = true;
playerGroup.add(chassis);

// Body with license plate on rear face (+z)
const bodyGeo = new THREE.BoxGeometry(1.6, 0.72, 2.85);
const bodyMats = [
    new THREE.MeshStandardMaterial({ color: 0xcc0000 }),
    new THREE.MeshStandardMaterial({ color: 0xcc0000 }),
    new THREE.MeshStandardMaterial({ color: 0xdd0000 }),
    new THREE.MeshStandardMaterial({ color: 0x880000 }),
    new THREE.MeshStandardMaterial({ map: texPlate }),
    new THREE.MeshStandardMaterial({ color: 0xaa0000 }),
];
const body = new THREE.Mesh(bodyGeo, bodyMats);
body.position.y = 1.38; body.castShadow = true;
playerGroup.add(body);

// Cabin
const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(1.42, 0.68, 1.35),
    new THREE.MeshStandardMaterial({ color: 0xaa0000 })
);
cabin.position.set(0, 2.08, -0.2); cabin.castShadow = true;
playerGroup.add(cabin);

// Windshield
const windshield = new THREE.Mesh(
    new THREE.BoxGeometry(1.3, 0.5, 0.06),
    new THREE.MeshStandardMaterial({ color: 0x88ccff, transparent: true, opacity: 0.6 })
);
windshield.position.set(0, 2.06, -0.89);
playerGroup.add(windshield);

// Bull bar at FRONT of truck (-z side, facing obstacles)
[1.32, 1.08].forEach(yy => {
    const bar = new THREE.Mesh(
        new THREE.BoxGeometry(1.55, 0.18, 0.12),
        new THREE.MeshStandardMaterial({ color: 0xffcc00, metalness: 0.85, roughness: 0.2 })
    );
    bar.position.set(0, yy, -1.47); playerGroup.add(bar);
});

// Vertical bull bar struts
[-0.55, 0.55].forEach(xx => {
    const strut = new THREE.Mesh(
        new THREE.BoxGeometry(0.1, 0.38, 0.1),
        new THREE.MeshStandardMaterial({ color: 0xffcc00, metalness: 0.85 })
    );
    strut.position.set(xx, 1.2, -1.47); playerGroup.add(strut);
});

// Exhaust pipes — behind cabin (rear side, +z)
[1, -1].forEach(side => {
    const exh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.07, 0.09, 1.1, 8),
        new THREE.MeshStandardMaterial({ color: 0x999999, metalness: 0.9 })
    );
    exh.position.set(side * 0.82, 2.38, 0.45);
    playerGroup.add(exh);
});

// Headlights at FRONT of truck (-z side)
[0.55, -0.55].forEach(xPos => {
    const lgt = new THREE.Mesh(
        new THREE.CylinderGeometry(0.17, 0.17, 0.09, 12),
        new THREE.MeshStandardMaterial({ color: 0xffffcc, emissive: 0xffff88, emissiveIntensity: 0.9 })
    );
    lgt.rotation.x = Math.PI / 2; lgt.position.set(xPos, 1.44, -1.47);
    playerGroup.add(lgt);
});

// Taillights at REAR of truck (+z side, facing camera) — red
[0.55, -0.55].forEach(xPos => {
    const tail = new THREE.Mesh(
        new THREE.CylinderGeometry(0.15, 0.15, 0.08, 12),
        new THREE.MeshStandardMaterial({ color: 0xff1111, emissive: 0xff0000, emissiveIntensity: 1.0 })
    );
    tail.rotation.x = Math.PI / 2; tail.position.set(xPos, 1.44, 1.47);
    playerGroup.add(tail);
});

// "10" decals on sides
[1, -1].forEach(side => {
    const d = new THREE.Mesh(
        new THREE.PlaneGeometry(0.7, 0.7),
        new THREE.MeshStandardMaterial({ map: tex10, transparent: true, alphaTest: 0.08, depthWrite: false })
    );
    d.position.set(side * 0.82, 1.38, 0.35);
    d.rotation.y = side * Math.PI / 2;
    playerGroup.add(d);
});

// MAX flame decals on sides
[1, -1].forEach(side => {
    const f = new THREE.Mesh(
        new THREE.PlaneGeometry(1.8, 0.9),
        new THREE.MeshStandardMaterial({ map: texFlame, transparent: true, alphaTest: 0.04, depthWrite: false })
    );
    f.position.set(side * 0.82, 1.0, -0.25);
    f.rotation.y = side * Math.PI / 2;
    playerGroup.add(f);
});

// Monster truck wheels
const mtWheelGeo = new THREE.CylinderGeometry(0.62, 0.62, 0.52, 16);
const mtWheelMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.95 });
const mtHubGeo   = new THREE.CylinderGeometry(0.24, 0.24, 0.54, 6);
const mtHubMat   = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.8 });
const mtTreadGeo = new THREE.TorusGeometry(0.62, 0.09, 6, 18);
const mtTreadMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 1.0 });
const axleGeo    = new THREE.CylinderGeometry(0.065, 0.065, 2.6, 8);
const axleMat    = new THREE.MeshStandardMaterial({ color: 0x555555, metalness: 0.7 });
function addMonsterWheel(side, zPos) {
    const x = side * 1.22; const y = 0.65;
    const wh = new THREE.Mesh(mtWheelGeo, mtWheelMat);
    wh.rotation.z = Math.PI / 2; wh.position.set(x, y, zPos); wh.castShadow = true;
    playerGroup.add(wh);
    const tr = new THREE.Mesh(mtTreadGeo, mtTreadMat);
    tr.rotation.y = Math.PI / 2; tr.position.set(x, y, zPos);
    playerGroup.add(tr);
    const hb = new THREE.Mesh(mtHubGeo, mtHubMat);
    hb.rotation.z = Math.PI / 2; hb.position.set(x, y, zPos);
    playerGroup.add(hb);
}
addMonsterWheel( 1,  1.1); addMonsterWheel(-1,  1.1);
addMonsterWheel( 1, -1.1); addMonsterWheel(-1, -1.1);
[-1.1, 1.1].forEach(zPos => {
    const ax = new THREE.Mesh(axleGeo, axleMat);
    ax.rotation.z = Math.PI / 2; ax.position.set(0, 0.65, zPos);
    playerGroup.add(ax);
});

playerGroup.position.set(0, 0, PLAYER_Z);
scene.add(playerGroup);
// --- FABRYKI MESH ---
function makeBarrelGroup() {
    // Monkey face obstacle
    const g = new THREE.Group();
    const brownMat  = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
    const ltBrwnMat = new THREE.MeshStandardMaterial({ color: 0xD2934A });
    const darkMat   = new THREE.MeshStandardMaterial({ color: 0x1a0a00 });
    const whiteMat  = new THREE.MeshStandardMaterial({ color: 0xffffff });
    const pinkMat   = new THREE.MeshStandardMaterial({ color: 0xff9999 });

    // Head
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.55, 16, 12), brownMat);
    head.position.y = 0.55; head.castShadow = true;
    g.add(head);

    // Muzzle (flat lighter sphere facing camera = +z)
    const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 8), ltBrwnMat);
    muzzle.scale.z = 0.55;
    muzzle.position.set(0, 0.38, 0.42);
    g.add(muzzle);

    // Ears
    [-0.58, 0.58].forEach(ex => {
        const ear = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), brownMat);
        ear.position.set(ex, 0.72, 0);
        g.add(ear);
        const earInner = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), pinkMat);
        earInner.position.set(ex * 1.04, 0.72, 0.06);
        g.add(earInner);
    });

    // Eyes (white + dark pupil) facing camera = +z
    [-0.2, 0.2].forEach(ex => {
        const eyeWhite = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), whiteMat);
        eyeWhite.position.set(ex, 0.68, 0.48);
        g.add(eyeWhite);
        const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 5), darkMat);
        pupil.position.set(ex, 0.68, 0.56);
        g.add(pupil);
    });

    // Nostrils facing camera = +z
    [-0.1, 0.1].forEach(nx => {
        const nostril = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 4), darkMat);
        nostril.position.set(nx, 0.35, 0.65);
        g.add(nostril);
    });

    // Eyebrows facing camera = +z
    [-0.2, 0.2].forEach(ex => {
        const brow = new THREE.Mesh(
            new THREE.BoxGeometry(0.18, 0.05, 0.06),
            darkMat
        );
        brow.position.set(ex, 0.81, 0.5);
        brow.rotation.z = ex < 0 ? 0.3 : -0.3;
        g.add(brow);
    });

    return g;
}

function makeCoinGroup() {
    // Oreo cookie collectible
    const g = new THREE.Group();
    const darkChoc  = new THREE.MeshStandardMaterial({ color: 0x1a0f05, roughness: 0.8, transparent: true });
    const cream     = new THREE.MeshStandardMaterial({ color: 0xf5f0e8, roughness: 0.6, transparent: true });
    const chocEdge  = new THREE.MeshStandardMaterial({ color: 0x2d1a08, roughness: 0.9, transparent: true });

    // Bottom biscuit disc
    const bot = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.44, 0.12, 24), darkChoc);
    bot.position.y = -0.1;
    g.add(bot);

    // Cream filling
    const fill = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.1, 24), cream);
    fill.position.y = 0;
    g.add(fill);

    // Top biscuit disc
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.44, 0.12, 24), darkChoc);
    top.position.y = 0.1;
    g.add(top);

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
    const count = Math.random() < 0.3 ? 2 : 1;
    const spawnZ = -(PLAYER_Z + 180 * gameSpeed);
    for (let k = 0; k < count; k++) {
        const g = makeBarrelGroup();
        g.position.set(lanes[k] * LANE_WIDTH, 0, spawnZ);
        scene.add(g);
        obstacles.push(g);
    }
    playSound('monkey'); // raz na falę, niezależnie od liczby małpek
}

function spawnCollectible() {
    if (isGameOver) return;
    const spawnZ = -(PLAYER_Z + 180 * gameSpeed);
    const usedLanes = new Set(
        obstacles
            .filter(o => Math.abs(o.position.z - spawnZ) < 12)
            .map(o => Math.round(o.position.x / LANE_WIDTH))
    );
    const freeLanes = [-1, 0, 1].filter(l => !usedLanes.has(l));
    const pool = freeLanes.length > 0 ? freeLanes : [-1, 0, 1];
    const lane = pool[Math.floor(Math.random() * pool.length)];
    const g = makeCoinGroup();
    g.position.set(lane * LANE_WIDTH, 1.6, spawnZ);
    // brak rotation.x — Oreo leży płasko, widoczne z góry
    scene.add(g);
    collectibles.push(g);
}

// Spawning oparte o dystans (nie czas) — gwarantuje stały odstęp wzrokowy
// niezależnie od aktualnej prędkości gry
let obstacleGap      = 28;  // ile jednostek świata do następnej fali
let collectibleGap   = 22;
let obstacleCountdown   = obstacleGap;
let collectibleCountdown = collectibleGap + 6; // moneta trochę po beczce

// --- STEROWANIE (PASY — lane-snap) ---
// 3 pasy: lewy (-1), środkowy (0), prawy (1)
// Każde naciśnięcie przesuwa o jeden pas. Auto zawsze ląduje dokładnie na środku pasa.
let currentLane = 0;   // -1 | 0 | 1
let targetX     = 0;   // LANE_WIDTH * currentLane
let laneCooldown = 0;  // blokada przez kilka klatek żeby jedno naciśnięcie = jeden pas

function changeLane(dir) {
    if (isGameOver || laneCooldown > 0) return;
    currentLane = Math.max(-1, Math.min(1, currentLane + dir));
    targetX = currentLane * LANE_WIDTH;
    laneCooldown = 10; // ~10 klatek blokady przed kolejną zmianą
}

document.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft'  || event.key === 'a' || event.key === 'A') changeLane(-1);
    else if (event.key === 'ArrowRight' || event.key === 'd' || event.key === 'D') changeLane(1);
});

// Dotyk: swipe lewo/prawo
let touchStartX = null;
document.addEventListener('touchstart', (e) => {
    touchStartX = e.touches[0].clientX;
}, { passive: true });
document.addEventListener('touchend', (e) => {
    if (touchStartX === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(dx) > 40) changeLane(dx < 0 ? -1 : 1);
    touchStartX = null;
});

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
    playSound('mniam');
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

    if (!isStarted || isPaused || isGameOver) {
        // Still render the scene so it looks alive on start screen
        renderer.render(scene, camera);
        return;
    }

    if (!isGameOver) {
        if (laneCooldown > 0) laneCooldown--;
        // Płynne lerp do środka aktualnego pasa
        playerGroup.position.x += (targetX - playerGroup.position.x) * 0.16;
        playerGroup.rotation.z = (playerGroup.position.x - targetX) * 0.08;
        // rotation.x intentionally removed — no idle rocking, lean only on turns
    }

    // Scrollowanie linii jezdni — tylko gdy gra trwa
    if (!isGameOver) {
        for (const dash of dashLines) {
            dash.position.z += gameSpeed;
            if (dash.position.z > 10) dash.position.z -= DASH_COUNT * DASH_SPACING;
        }
        // Scroll scenery decorations
        for (const item of sceneryItems) {
            item.group.position.z += gameSpeed;
            if (item.group.position.z > PLAYER_Z + 20) {
                let minZ = Infinity;
                for (const other of sceneryItems) {
                    if (other.side === item.side) minZ = Math.min(minZ, other.group.position.z);
                }
                item.group.position.z = minZ - SCENERY_SPACING;
                const s = item.side;
                item.group.position.x = s * (ROAD_WIDTH / 2 + 3 + Math.random() * 3);
            }
        }
    }

    renderer.render(scene, camera);

    if (isGameOver) return;
    // --- Spawning oparty o dystans ---
    obstacleCountdown -= gameSpeed;
    if (obstacleCountdown <= 0) {
        spawnWave();
        // losowy odstęp 26-32 jednostki między falami
        obstacleCountdown = 26 + Math.random() * 6;
    }
    collectibleCountdown -= gameSpeed;
    if (collectibleCountdown <= 0) {
        spawnCollectible();
        collectibleCountdown = 22 + Math.random() * 8;
    }
    // --- Obsługa przeszkód (małpki) ---
    for (let i = obstacles.length - 1; i >= 0; i--) {
        const obj = obstacles[i];
        obj.position.z += gameSpeed;
        obj.position.y = 0.55 + Math.sin(Date.now() * 0.003 + i * 1.7) * 0.2; // bob góra-dół

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
        obj.rotation.y += 0.04;   // Oreo obraca się płasko
        obj.position.y = 1.6 + Math.sin(Date.now() * 0.003 + i * 1.7) * 0.25;

        if (
            obj.position.z > COLLISION_Z_MIN &&
            obj.position.z < COLLISION_Z_MAX &&
            collidesXZ(obj.position)
        ) {
            collectibles.splice(i, 1);
            collectCoin(obj);
            updateScore(50);
            updateOreo();
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
        playSound('faster');
    }
}

function updateOreo() {
    oreoCount++;
    document.getElementById('oreo-val').innerText = '\uD83C\uDF6A ' + oreoCount;
}

function handleCollision() {
    lives--;
    let hearts = '';
    for (let i = 0; i < lives; i++) hearts += '\u2764';
    document.getElementById('hearts').innerText = hearts;    playSound('aumonkey');
    // MigniÄ™cie autka
    playerGroup.position.y += 0.4;
    setTimeout(() => { playerGroup.position.y = 0; }, 150);

    if (lives <= 0) gameOver();
}

function gameOver() {
    isGameOver = true;
    playSound('owno');
    document.getElementById('game-over').style.display = 'block';
    document.getElementById('final-score').innerText = score;
    document.getElementById('final-oreo').innerText = oreoCount;
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
