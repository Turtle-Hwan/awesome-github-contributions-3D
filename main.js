import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// 1. Scene, Camera, Renderer 설정
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x141928);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(150, 200, 400);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// 2. OrbitControls 추가 (마우스 드래그, 줌)
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.screenSpacePanning = false;
controls.minDistance = 50;
controls.maxDistance = 800;
controls.zoomSpeed = 1.5; // 줌 속도 증가

// 3. 조명 추가
const ambientLight = new THREE.AmbientLight(0xcccccc, 0.5);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(-1, 1, 1);
scene.add(directionalLight);

// 4. Raycaster 및 UI 요소 설정 (마우스오버용)
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const tooltip = document.getElementById('tooltip');
let intersectedObject = null;

// 5. 데이터 로드 및 3D 객체 생성
const githubUsername = "Turtle-Hwan";
const url = `https://github-contributions-api.jogruber.de/v4/${githubUsername}?y=last`;

const contributionGroup = new THREE.Group();

const mapRange = (value, inMin, inMax, outMin, outMax) => {
    return (value - inMin) * (outMax - outMin) / (inMax - inMin) + outMin;
};

fetch(url)
    .then(response => response.json())
    .then(data => {
        const contributions = data.contributions;
        if (!contributions) return;

        const spacing = 18;
        const boxSize = 15;

        const materials = [
            new THREE.MeshStandardMaterial({ color: 0x2d332d }), // Level 0
            new THREE.MeshStandardMaterial({ color: 0x3c503c }), // Level 1
            new THREE.MeshStandardMaterial({ color: 0x506e50 }), // Level 2
            new THREE.MeshStandardMaterial({ color: 0x648c64 }), // Level 3
            new THREE.MeshStandardMaterial({ color: 0x78aa78 })  // Level 4
        ];

        let totalWeeks = 0;

        for (let i = 0; i < contributions.length; i++) {
            const c = contributions[i];
            const week = Math.floor(i / 7);
            const day = i % 7;
            totalWeeks = Math.max(totalWeeks, week);

            const height = (c.count > 0)
                ? mapRange(c.count, 1, 20, 10, 200)
                : 1;

            const geometry = new THREE.BoxGeometry(boxSize, height, boxSize);
            const material = materials[c.level] || materials[0];
            
            const cube = new THREE.Mesh(geometry, material.clone()); // 재질 복제하여 사용
            cube.position.set(week * spacing, height / 2, day * spacing);
            
            // 마우스오버 시 사용할 데이터 저장
            cube.userData = { date: c.date, count: c.count };

            contributionGroup.add(cube);
        }

        const gridWidth = totalWeeks * spacing;
        const gridDepth = 6 * spacing;
        contributionGroup.position.set(-gridWidth / 2, 0, -gridDepth / 2);

        scene.add(contributionGroup);
    })
    .catch(error => console.error('Error fetching GitHub data:', error));

// 6. 마우스오버 이벤트 핸들러
function onMouseMove(event) {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = - (event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(contributionGroup.children);

    if (intersects.length > 0) {
        const newIntersected = intersects[0].object;

        if (intersectedObject !== newIntersected) {
            if (intersectedObject) {
                intersectedObject.material.emissive.setHex(0x000000);
            }
            intersectedObject = newIntersected;
            intersectedObject.material.emissive.setHex(0x555555); // 하이라이트 색상
        }

        tooltip.style.display = 'block';
        tooltip.style.left = `${event.clientX + 10}px`;
        tooltip.style.top = `${event.clientY + 10}px`;
        tooltip.innerHTML = `<strong>${intersectedObject.userData.date}</strong><br>${intersectedObject.userData.count} contributions`;

    } else {
        if (intersectedObject) {
            intersectedObject.material.emissive.setHex(0x000000);
        }
        intersectedObject = null;
        tooltip.style.display = 'none';
    }
}

// 7. 애니메이션 루프
function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}

// 8. 윈도우 이벤트 리스너
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
window.addEventListener('mousemove', onMouseMove);

animate();
