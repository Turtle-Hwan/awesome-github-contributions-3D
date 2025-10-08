import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';

// --- THEME COLORS ---
const lightThemeColors = {
    background: 0xf0f2f5,
    buildingLevels: [ 0xebedf0, 0xbde0d1, 0x8acdaa, 0x59b983, 0x30a14e ],
    nameplate: 0x003d7a, // Dark Blue
    totalPlate: 0x444444,
    nameplatePanel: 0xffffff,
    roof: 0xeaeaea,
    bottom: 0xd0d0d0,
    ambientLight: 0x707070,
    directionalLight: 0xffffff
};

const darkThemeColors = {
    background: 0x141928,
    buildingLevels: [ 0x2d332d, 0x3c503c, 0x506e50, 0x648c64, 0x78aa78 ],
    nameplate: 0xFFD700, // Gold
    totalPlate: 0xCCCCCC,
    nameplatePanel: 0x111122,
    roof: 0x1a1a1a,
    bottom: 0x101010,
    spire: 0xdaa520, // Gold
    ambientLight: 0xcccccc,
    directionalLight: 0xffffff
};

// --- UI Elements ---
const usernameInput = document.getElementById('username');
const startDateInput = document.getElementById('startDate');
const endDateInput = document.getElementById('endDate');
const updateButton = document.getElementById('updateButton');
const y1Btn = document.getElementById('1yBtn');
const m6Btn = document.getElementById('6mBtn');
const m3Btn = document.getElementById('3mBtn');
const exportBtn = document.getElementById('exportBtn');
const shareBtn = document.getElementById('shareBtn');
const themeToggleCheckbox = document.getElementById('themeToggleCheckbox');
const tooltip = document.getElementById('tooltip');

// --- 3D Scene Setup ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(); // Initialize background property
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(150, 200, 400);
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
document.body.appendChild(renderer.domElement);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
const ambientLight = new THREE.AmbientLight();
const directionalLight = new THREE.DirectionalLight();
scene.add(ambientLight, directionalLight);

// --- Reusable Assets & State ---
let font = null;
const fontLoader = new FontLoader();
let currentTheme = 'dark';
let intersectedGroup = null;
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

// --- Helper Functions ---
const mapRange = (v, iA, iB, oA, oB) => (v - iA) * (oB - oA) / (iB - iA) + oA;

function createBuildingTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 64; canvas.height = 32;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#282828'; ctx.fillRect(0, 0, 64, 32);
    ctx.fillStyle = '#87CEEB';
    const w = 10, h = 18, s = 16;
    for (let x = 8; x < 64 - w; x += s) { ctx.fillRect(x, 7, w, h); }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping; texture.wrapT = THREE.RepeatWrapping;
    return texture;
}
const buildingTexture = createBuildingTexture();

function setBuildingHighlight(b, c) { if (b) b.children.forEach(m => Array.isArray(m.material) ? m.material.forEach(mat => mat.emissive.setHex(c)) : m.material.emissive.setHex(c)); }

// --- Core Functions ---

function cleanupScene() {
    scene.children.filter(c => c.userData.isDeletable).forEach(obj => {
        obj.traverse(child => {
            if (child.isMesh) {
                child.geometry.dispose();
                if (Array.isArray(child.material)) child.material.forEach(mat => mat.dispose());
                else child.material.dispose();
            }
        });
        scene.remove(obj);
    });
}

async function updateScene(username, startDate, endDate) {
    if (!font) { return; }

    // Update URL query string
    const params = new URLSearchParams();
    params.set('username', username);
    params.set('startDate', startDate);
    params.set('endDate', endDate);
    params.set('theme', currentTheme);
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.pushState({path: newUrl}, '', newUrl);

    cleanupScene();

    const theme = currentTheme === 'light' ? lightThemeColors : darkThemeColors;
    scene.background.set(theme.background);
    ambientLight.color.set(theme.ambientLight); ambientLight.intensity = 0.7;
    directionalLight.color.set(theme.directionalLight); directionalLight.intensity = 1.0;
    directionalLight.position.set(-1, 1, 1);

    const url = `https://github-contributions-api.jogruber.de/v4/${username}?y=last`;
    try {
        const response = await fetch(url);
        const data = await response.json();

        if (!data || !data.contributions) {
            createNameplate(`User '${username}' not found`, { size: 14, y: 130, z: 200, color: 0xFF0000 }, theme);
            return;
        }
        
        const filtered = data.contributions.filter(c => new Date(c.date) >= new Date(startDate) && new Date(c.date) <= new Date(endDate));
        const total = filtered.reduce((s, c) => s + c.count, 0);

        createNameplate(username, { size: 20, y: 150, z: 200, color: theme.nameplate }, theme);
        createNameplate(`Total: ${total}`, { size: 12, y: 110, z: 200, color: theme.totalPlate }, theme);

        const container = new THREE.Group();
        container.name = 'buildingsContainer';
        container.userData.isDeletable = true;
        if (filtered.length === 0) { scene.add(container); return; }

        const dayOffset = new Date(filtered[0].date).getDay();
        let totalWeeks = 0;

        filtered.forEach((c, i) => {
            const dayIndex = i + dayOffset;
            const week = Math.floor(dayIndex / 7);
            const day = dayIndex % 7;
            totalWeeks = Math.max(totalWeeks, week);

            const h = (c.count > 0) ? mapRange(c.count, 1, 20, 10, 200) : 1;
            const group = new THREE.Group();

            const geom = new THREE.BoxGeometry(15, h, 15);
            const tex = buildingTexture.clone();
            tex.needsUpdate = true;
            tex.repeat.set(1, (c.count > 0) ? Math.max(1, Math.floor(h / 12)) : 1);
            
            const sideMat = new THREE.MeshStandardMaterial({ color: theme.buildingLevels[c.level] || theme.buildingLevels[0], map: tex });
            const roofMat = new THREE.MeshStandardMaterial({ color: theme.roof });
            const bottomMat = new THREE.MeshStandardMaterial({ color: theme.bottom });
            
            const body = new THREE.Mesh(geom, [sideMat, sideMat.clone(), roofMat, bottomMat, sideMat.clone(), sideMat.clone()]);
            body.position.y = h / 2;
            group.add(body);

            group.position.set(week * 18, 0, day * 18);
            group.userData = { date: c.date, count: c.count };
            container.add(group);
        });

        container.position.set(-(totalWeeks * 18) / 2, 0, -(6 * 18) / 2);
        scene.add(container);

    } catch (error) { console.error('Error updating scene:', error); }
}

function createNameplate(text, { size, y, z, color }, theme) {
    const geom = new TextGeometry(text, { font, size, height: 2, curveSegments: 12, bevelEnabled: true, bevelThickness: 0.5, bevelSize: 0.3, bevelSegments: 5 });
    geom.center();
    const mat = new THREE.MeshStandardMaterial({ color, metalness: 0.8, roughness: 0.4 });
    const mesh = new THREE.Mesh(geom, mat);

    const box = new THREE.Box3().setFromObject(mesh);
    const panelSize = new THREE.Vector3();
    box.getSize(panelSize);
    const panelGeom = new THREE.BoxGeometry(panelSize.x + 20, panelSize.y + 20, 2);
    const panelMat = new THREE.MeshStandardMaterial({ color: theme.nameplatePanel, metalness: 0.1, roughness: 0.8 });
    const panel = new THREE.Mesh(panelGeom, panelMat);
    panel.position.z = -2;

    const group = new THREE.Group();
    group.add(mesh, panel);
    group.position.set(0, y, z);
    group.userData.isDeletable = true;
    scene.add(group);
}

// --- Event Handlers & Animation Loop ---
function onMouseMove(e) {
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = - (e.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const buildingsContainer = scene.getObjectByName('buildingsContainer');
    if (!buildingsContainer) {
        tooltip.style.display = 'none';
        return;
    }

    const intersects = raycaster.intersectObjects(buildingsContainer.children, true);

    let currentGroup = null;
    if (intersects.length > 0) {
        let obj = intersects[0].object;
        while (obj.parent && !obj.userData.date) {
            obj = obj.parent;
        }
        currentGroup = obj.userData.date ? obj : null;
    }

    if (intersectedGroup !== currentGroup) {
        setBuildingHighlight(intersectedGroup, 0x000000);
        intersectedGroup = currentGroup;
        setBuildingHighlight(intersectedGroup, 0x555555);
    }

    if (intersectedGroup) {
        tooltip.style.display = 'block';
        tooltip.style.left = `${e.clientX + 10}px`;
        tooltip.style.top = `${e.clientY + 10}px`;
        tooltip.innerHTML = `<strong>${intersectedGroup.userData.date}</strong><br>${intersectedGroup.userData.count} contributions`;
    } else {
        tooltip.style.display = 'none';
    }
}

function handleKeyDown(e) {
    const speed = 5;
    switch (e.key) {
        case 'ArrowUp': camera.position.z -= speed; controls.target.z -= speed; break;
        case 'ArrowDown': camera.position.z += speed; controls.target.z += speed; break;
        case 'ArrowLeft': camera.position.x -= speed; controls.target.x -= speed; break;
        case 'ArrowRight': camera.position.x += speed; controls.target.x += speed; break;
    }
}

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}

// --- Initializer ---
async function init() {
    renderer.setSize(window.innerWidth, window.innerHeight);
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('keydown', handleKeyDown);

    // Parse URL query strings
    const params = new URLSearchParams(window.location.search);
    const usernameFromQuery = params.get('username');
    const startDateFromQuery = params.get('startDate');
    const endDateFromQuery = params.get('endDate');
    const themeFromQuery = params.get('theme');

    // Set initial values from query string or defaults
    usernameInput.value = usernameFromQuery || 'Turtle-Hwan';
    currentTheme = themeFromQuery || 'dark'; // 'dark' as default

    if (startDateFromQuery && endDateFromQuery) {
        startDateInput.value = startDateFromQuery;
        endDateInput.value = endDateFromQuery;
    } else {
        const today = new Date();
        endDateInput.value = today.toISOString().split('T')[0];
        startDateInput.value = new Date(new Date().setFullYear(today.getFullYear() - 1)).toISOString().split('T')[0];
    }

    font = await new Promise(r => fontLoader.load('https://unpkg.com/three@0.160.0/examples/fonts/helvetiker_regular.typeface.json', r));

    themeToggleCheckbox.checked = currentTheme === 'dark';
    document.body.className = `${currentTheme}-theme`;
    updateButton.addEventListener('click', () => updateScene(usernameInput.value, startDateInput.value, endDateInput.value));
    
    themeToggleCheckbox.addEventListener('change', () => {
        currentTheme = themeToggleCheckbox.checked ? 'dark' : 'light';
        document.body.className = `${currentTheme}-theme`;
        updateScene(usernameInput.value, startDateInput.value, endDateInput.value);
    });

    const setDateRange = months => {
        const today = new Date();
        endDateInput.value = today.toISOString().split('T')[0];
        startDateInput.value = new Date(today.setMonth(today.getMonth() - months)).toISOString().split('T')[0];
        updateScene(usernameInput.value, startDateInput.value, endDateInput.value);
    };

    y1Btn.addEventListener('click', () => setDateRange(12));
    m6Btn.addEventListener('click', () => setDateRange(6));
    m3Btn.addEventListener('click', () => setDateRange(3));
    exportBtn.addEventListener('click', () => {
        renderer.render(scene, camera);
        const link = document.createElement('a');
        link.download = 'github-3d-grass.png';
        link.href = renderer.domElement.toDataURL('image/png');
        link.click();
    });

    shareBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(window.location.href).then(() => {
            alert('URL copied to clipboard!');
        }, () => {
            alert('Failed to copy URL.');
        });
    });

    await updateScene(usernameInput.value, startDateInput.value, endDateInput.value);
    animate();
}

init();
