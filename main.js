import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// --- Helper Functions ---
const mapRange = (value, inMin, inMax, outMin, outMax) => {
    return (value - inMin) * (outMax - outMin) / (inMax - inMin) + outMin;
};

function createBuildingTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 32;
    const context = canvas.getContext('2d');
    context.fillStyle = '#282828';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = '#87CEEB';
    const windowWidth = 10, windowHeight = 18, xSpacing = 16;
    for (let x = 8; x < canvas.width - windowWidth; x += xSpacing) {
        context.fillRect(x, 7, windowWidth, windowHeight);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    return texture;
}

// 하이라이트 색상을 적용/제거하는 헬퍼 함수
function setBuildingHighlight(buildingGroup, emissiveColor) {
    if (!buildingGroup) return;
    buildingGroup.children.forEach(mesh => {
        if (Array.isArray(mesh.material)) {
            mesh.material.forEach(material => {
                material.emissive.setHex(emissiveColor);
            });
        } else {
            mesh.material.emissive.setHex(emissiveColor);
        }
    });
}

// --- Main Scene Setup ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x141928);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(150, 200, 400);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.zoomSpeed = 1.5;

const ambientLight = new THREE.AmbientLight(0xcccccc, 0.7);
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
directionalLight.position.set(-1, 1, 1);
scene.add(directionalLight);

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const tooltip = document.getElementById('tooltip');
let intersectedGroup = null;

const githubUsername = "Turtle-Hwan";
const url = `https://github-contributions-api.jogruber.de/v4/${githubUsername}?y=last`;

const contributionsContainer = new THREE.Group();

const buildingTexture = createBuildingTexture();
const roofMaterial = new THREE.MeshStandardMaterial({ color: 0x1a1a1a });
const spireMaterial = new THREE.MeshStandardMaterial({ color: 0xdaa520 }); // Gold color for spire
const bottomMaterial = new THREE.MeshStandardMaterial({ color: 0x101010 });
const levelColors = [
    new THREE.Color(0x2d332d), new THREE.Color(0x3c503c), new THREE.Color(0x506e50),
    new THREE.Color(0x648c64), new THREE.Color(0x78aa78)
];

fetch(url)
    .then(response => response.json())
    .then(data => {
        const contributions = data.contributions;
        if (!contributions) return;

        const spacing = 18, boxSize = 15, floorHeight = 12;
        let totalWeeks = 0;

        for (let i = 0; i < contributions.length; i++) {
            const c = contributions[i];
            const week = Math.floor(i / 7);
            const day = i % 7;
            totalWeeks = Math.max(totalWeeks, week);

            const height = (c.count > 0) ? mapRange(c.count, 1, 20, 10, 200) : 1;
            const buildingGroup = new THREE.Group();

            // --- Create Building Body ---
            const bodyGeometry = new THREE.BoxGeometry(boxSize, height, boxSize);
            const textureClone = buildingTexture.clone();
            textureClone.needsUpdate = true;
            textureClone.repeat.set(1, (c.count > 0) ? Math.max(1, Math.floor(height / floorHeight)) : 1);
            const sideMaterial = new THREE.MeshStandardMaterial({ color: levelColors[c.level] || levelColors[0], map: textureClone });
            const bodyMaterials = [sideMaterial, sideMaterial.clone(), roofMaterial.clone(), bottomMaterial.clone(), sideMaterial.clone(), sideMaterial.clone()];
            const bodyMesh = new THREE.Mesh(bodyGeometry, bodyMaterials);
            bodyMesh.position.y = height / 2;
            buildingGroup.add(bodyMesh);

            // --- Create Spire for tall buildings ---
            if (c.count >= 25) {
                const spireHeight = 40;
                const spireRadius = boxSize * 0.6;
                const spireGeometry = new THREE.ConeGeometry(spireRadius, spireHeight, 4);
                const spireMesh = new THREE.Mesh(spireGeometry, spireMaterial.clone()); // 재질 복제
                spireMesh.position.y = height + spireHeight / 2;
                spireMesh.rotation.y = Math.PI / 4;
                buildingGroup.add(spireMesh);
            }

            buildingGroup.position.set(week * spacing, 0, day * spacing);
            buildingGroup.userData = { date: c.date, count: c.count };
            contributionsContainer.add(buildingGroup);
        }

        const gridWidth = totalWeeks * spacing;
        const gridDepth = 6 * spacing;
        contributionsContainer.position.set(-gridWidth / 2, 0, -gridDepth / 2);
        scene.add(contributionsContainer);
    })
    .catch(error => console.error('Error fetching GitHub data:', error));

function onMouseMove(event) {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = - (event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(contributionsContainer.children, true);

    let currentGroup = null;
    if (intersects.length > 0) {
        let object = intersects[0].object;
        while (object.parent && !object.userData.date) {
            object = object.parent;
        }
        currentGroup = object.userData.date ? object : null;
    }

    if (intersectedGroup !== currentGroup) {
        setBuildingHighlight(intersectedGroup, 0x000000); // 이전 하이라이트 제거
        intersectedGroup = currentGroup;
        setBuildingHighlight(intersectedGroup, 0x555555); // 새 하이라이트 적용
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
        case 'ArrowUp':
            camera.position.z -= moveSpeed;
            controls.target.z -= moveSpeed;
            break;
        case 'ArrowDown':
            camera.position.z += moveSpeed;
            controls.target.z += moveSpeed;
            break;
        case 'ArrowLeft':
            camera.position.x -= moveSpeed;
            controls.target.x -= moveSpeed;
            break;
        case 'ArrowRight':
            camera.position.x += moveSpeed;
            controls.target.x += moveSpeed;
            break;
    }
}

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
window.addEventListener('mousemove', onMouseMove);
window.addEventListener('keydown', handleKeyDown);

animate();
