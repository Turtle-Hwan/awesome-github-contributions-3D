import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';

// --- Helper Functions ---
const mapRange = (value, inMin, inMax, outMin, outMax) => {
    return (value - inMin) * (outMax - outMin) / (inMax - inMin) + outMin;
};

function createBuildingTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 64; canvas.height = 32;
    const context = canvas.getContext('2d');
    context.fillStyle = '#282828'; context.fillRect(0, 0, 64, 32);
    context.fillStyle = '#87CEEB';
    const windowWidth = 10, windowHeight = 18, xSpacing = 16;
    for (let x = 8; x < 64 - windowWidth; x += xSpacing) { context.fillRect(x, 7, windowWidth, windowHeight); }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping; texture.wrapT = THREE.RepeatWrapping;
    return texture;
}

function setBuildingHighlight(buildingGroup, emissiveColor) {
    if (!buildingGroup) return;
    buildingGroup.children.forEach(mesh => {
        if (Array.isArray(mesh.material)) {
            mesh.material.forEach(material => material.emissive.setHex(emissiveColor));
        } else {
            mesh.material.emissive.setHex(emissiveColor);
        }
    });
}

// --- UI Elements ---
const usernameInput = document.getElementById('username');
const startDateInput = document.getElementById('startDate');
const endDateInput = document.getElementById('endDate');
const updateButton = document.getElementById('updateButton');
const y1Btn = document.getElementById('1yBtn');
const m6Btn = document.getElementById('6mBtn');
const m3Btn = document.getElementById('3mBtn');
const tooltip = document.getElementById('tooltip');

// --- 3D Scene Setup ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x141928);
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(150, 200, 400);
const renderer = new THREE.WebGLRenderer({ antialias: true });
document.body.appendChild(renderer.domElement);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// --- Lighting ---
const ambientLight = new THREE.AmbientLight(0xcccccc, 0.7);
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
directionalLight.position.set(-1, 1, 1);
scene.add(directionalLight);

// --- Reusable Assets & State ---
let font = null;
const fontLoader = new FontLoader();
const buildingTexture = createBuildingTexture();
const levelColors = [
    new THREE.Color(0x2d332d), new THREE.Color(0x3c503c), new THREE.Color(0x506e50),
    new THREE.Color(0x648c64), new THREE.Color(0x78aa78)
];
let intersectedGroup = null;
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

// --- Core Functions ---

function cleanupScene() {
    const objectsToRemove = [];
    scene.children.forEach(child => {
        if (child.userData.isDeletable) {
            objectsToRemove.push(child);
        }
    });

    objectsToRemove.forEach(obj => {
        obj.traverse(child => {
            if (child.isMesh) {
                child.geometry.dispose();
                if (Array.isArray(child.material)) {
                    child.material.forEach(mat => mat.dispose());
                } else {
                    child.material.dispose();
                }
            }
        });
        scene.remove(obj);
    });
}

async function updateScene(username, startDate, endDate) {
    if (!font) {
        console.log("Font not loaded yet.");
        return;
    }
    cleanupScene();

    const url = `https://github-contributions-api.jogruber.de/v4/${username}?y=last`;
    try {
        const response = await fetch(url);
        const data = await response.json();

        // Handle invalid user or data
        if (!data || !data.contributions) {
            console.error("Invalid data received from API:", data);
            createNameplate(`User '${username}' not found`, { size: 14, y: 130, z: -250, color: 0xFF0000 });
            // Add an empty container so cleanup works next time
            const contributionsContainer = new THREE.Group();
            contributionsContainer.userData.isDeletable = true;
            scene.add(contributionsContainer);
            return;
        }
        
        const filteredContributions = data.contributions.filter(c => {
            const date = new Date(c.date);
            return date >= new Date(startDate) && date <= new Date(endDate);
        });

        const totalContributions = filteredContributions.reduce((sum, c) => sum + c.count, 0);

        // Create Nameplates
        createNameplate(username, { size: 20, y: 150, z: -250, color: 0xFFD700 });
        createNameplate(`Total: ${totalContributions}`, { size: 12, y: 110, z: -250, color: 0xCCCCCC });

        // Create Buildings
        const contributionsContainer = new THREE.Group();
        contributionsContainer.userData.isDeletable = true;
        
        if (filteredContributions.length === 0) {
            scene.add(contributionsContainer); // Add empty container
            return;
        }

        const firstDate = new Date(filteredContributions[0].date);
        const dayOffset = firstDate.getDay();

        const spacing = 18, boxSize = 15, floorHeight = 12;
        let totalWeeks = 0;

        filteredContributions.forEach((c, index) => {
            const dayIndex = index + dayOffset;
            const week = Math.floor(dayIndex / 7);
            const day = dayIndex % 7;
            totalWeeks = Math.max(totalWeeks, week);

            const height = (c.count > 0) ? mapRange(c.count, 1, 20, 10, 200) : 1;
            const buildingGroup = new THREE.Group();

            const bodyGeometry = new THREE.BoxGeometry(boxSize, height, boxSize);
            const textureClone = buildingTexture.clone();
            textureClone.needsUpdate = true;
            textureClone.repeat.set(1, (c.count > 0) ? Math.max(1, Math.floor(height / floorHeight)) : 1);
            const sideMaterial = new THREE.MeshStandardMaterial({ color: levelColors[c.level] || levelColors[0], map: textureClone });
            const roofMaterial = new THREE.MeshStandardMaterial({ color: 0x1a1a1a });
            const bottomMaterial = new THREE.MeshStandardMaterial({ color: 0x101010 });
            const bodyMaterials = [sideMaterial, sideMaterial.clone(), roofMaterial.clone(), bottomMaterial.clone(), sideMaterial.clone(), sideMaterial.clone()];
            const bodyMesh = new THREE.Mesh(bodyGeometry, bodyMaterials);
            bodyMesh.position.y = height / 2;
            buildingGroup.add(bodyMesh);

            if (c.count >= 25) {
                const spireHeight = 40, spireRadius = boxSize * 0.6;
                const spireGeometry = new THREE.ConeGeometry(spireRadius, spireHeight, 4);
                const spireMaterial = new THREE.MeshStandardMaterial({ color: 0xdaa520 });
                const spireMesh = new THREE.Mesh(spireGeometry, spireMaterial.clone());
                spireMesh.position.y = height + spireHeight / 2;
                spireMesh.rotation.y = Math.PI / 4;
                buildingGroup.add(spireMesh);
            }

            buildingGroup.position.set(week * spacing, 0, day * spacing);
            buildingGroup.userData = { date: c.date, count: c.count };
            contributionsContainer.add(buildingGroup);
        });

        const gridWidth = totalWeeks * spacing;
        const gridDepth = 6 * spacing;
        contributionsContainer.position.set(-gridWidth / 2, 0, -gridDepth / 2);
        scene.add(contributionsContainer);

    } catch (error) {
        console.error('Error updating scene:', error);
    }
}

function createNameplate(text, { size, y, z, color }) {
    const textGeometry = new TextGeometry(text, {
        font: font,
        size: size,
        height: 2,
        curveSegments: 12,
        bevelEnabled: true, bevelThickness: 0.5, bevelSize: 0.3, bevelSegments: 5
    });
    textGeometry.center();

    const textMaterial = new THREE.MeshStandardMaterial({ color: color, metalness: 0.8, roughness: 0.4 });
    const textMesh = new THREE.Mesh(textGeometry, textMaterial);

    const boundingBox = new THREE.Box3().setFromObject(textMesh);
    const panelSize = new THREE.Vector3();
    boundingBox.getSize(panelSize);

    const panelGeometry = new THREE.BoxGeometry(panelSize.x + 20, panelSize.y + 20, 2);
    const panelMaterial = new THREE.MeshStandardMaterial({ color: 0x111122, metalness: 0.1, roughness: 0.8 });
    const panelMesh = new THREE.Mesh(panelGeometry, panelMaterial);
    panelMesh.position.z = -2;

    const nameplateGroup = new THREE.Group();
    nameplateGroup.add(textMesh);
    nameplateGroup.add(panelMesh);
    nameplateGroup.position.set(0, y, z);
    nameplateGroup.userData.isDeletable = true;
    scene.add(nameplateGroup);
}

// --- Event Handlers & Animation Loop ---

function onMouseMove(event) {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = - (event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const container = scene.children.find(c => c.userData.isDeletable && c.children.length > 0);
    if (!container) return;

    const intersects = raycaster.intersectObjects(container.children, true);
    let currentGroup = null;
    if (intersects.length > 0) {
        let object = intersects[0].object;
        while (object.parent && !object.userData.date) { object = object.parent; }
        currentGroup = object.userData.date ? object : null;
    }

    if (intersectedGroup !== currentGroup) {
        setBuildingHighlight(intersectedGroup, 0x000000);
        intersectedGroup = currentGroup;
        setBuildingHighlight(intersectedGroup, 0x555555);
    }
    
    if (intersectedGroup) {
        tooltip.style.display = 'block';
        tooltip.style.left = `${event.clientX + 10}px`;
        tooltip.style.top = `${event.clientY + 10}px`;
        tooltip.innerHTML = `<strong>${intersectedGroup.userData.date}</strong><br>${intersectedGroup.userData.count} contributions`;
    } else {
        tooltip.style.display = 'none';
    }
}

function handleKeyDown(event) {
    const moveSpeed = 5;
    switch (event.key) {
        case 'ArrowUp': camera.position.z -= moveSpeed; controls.target.z -= moveSpeed; break;
        case 'ArrowDown': camera.position.z += moveSpeed; controls.target.z += moveSpeed; break;
        case 'ArrowLeft': camera.position.x -= moveSpeed; controls.target.x -= moveSpeed; break;
        case 'ArrowRight': camera.position.x += moveSpeed; controls.target.x += moveSpeed; break;
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

    // Set default dates
    const today = new Date();
    const oneYearAgo = new Date(new Date().setFullYear(today.getFullYear() - 1));
    endDateInput.value = today.toISOString().split('T')[0];
    startDateInput.value = oneYearAgo.toISOString().split('T')[0];

    // Load font, then render scene
    font = await new Promise(resolve => fontLoader.load('https://unpkg.com/three@0.160.0/examples/fonts/helvetiker_regular.typeface.json', resolve));

    // --- UI Event Listeners ---
    updateButton.addEventListener('click', () => {
        updateScene(usernameInput.value, startDateInput.value, endDateInput.value);
    });

    const setDateRangeAndUpdate = (months) => {
        const today = new Date();
        const startDate = new Date(new Date().setMonth(today.getMonth() - months));
        endDateInput.value = today.toISOString().split('T')[0];
        startDateInput.value = startDate.toISOString().split('T')[0];
        updateScene(usernameInput.value, startDateInput.value, endDateInput.value);
    };

    y1Btn.addEventListener('click', () => setDateRangeAndUpdate(12));
    m6Btn.addEventListener('click', () => setDateRangeAndUpdate(6));
    m3Btn.addEventListener('click', () => setDateRangeAndUpdate(3));

    await updateScene(usernameInput.value, startDateInput.value, endDateInput.value);
    animate();
}

init();
