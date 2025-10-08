import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// 1. Scene, Camera, Renderer 설정
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x141928); // p5.js의 background(20, 25, 40)와 유사

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(150, 200, 400); // 카메라 위치 조정

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

// 3. 조명 추가
const ambientLight = new THREE.AmbientLight(0xcccccc, 0.5);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(-1, 1, 1);
scene.add(directionalLight);

// 4. 데이터 로드 및 3D 객체 생성
const githubUsername = "Turtle-Hwan";
const url = `https://github-contributions-api.jogruber.de/v4/${githubUsername}?y=last`;

const contributionGroup = new THREE.Group();

// p5.js의 map 함수와 동일한 역할
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

        // 회색빛 초록색 컬러 스킴 (Three.js Material)
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
                ? mapRange(c.count, 1, 20, 10, 200) // 1 이상일 때 최소 높이 10
                : 1; // 바닥 타일의 높이

            const geometry = new THREE.BoxGeometry(boxSize, height, boxSize);
            const material = materials[c.level] || materials[0];
            
            const cube = new THREE.Mesh(geometry, material);
            cube.position.set(week * spacing, height / 2, day * spacing);
            
            contributionGroup.add(cube);
        }

        // 전체 그리드를 중앙에 배치
        const gridWidth = totalWeeks * spacing;
        const gridDepth = 6 * spacing; // 7 days (0-6)
        contributionGroup.position.set(-gridWidth / 2, 0, -gridDepth / 2);

        scene.add(contributionGroup);
    })
    .catch(error => console.error('Error fetching GitHub data:', error));


// 5. 애니메이션 루프
function animate() {
    requestAnimationFrame(animate);
    controls.update(); // Damping을 위해 매 프레임 호출
    renderer.render(scene, camera);
}

// 6. 윈도우 리사이즈 핸들러
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

animate();
