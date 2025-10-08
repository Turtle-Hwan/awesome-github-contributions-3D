let contributions = [];

// 데이터를 불러오는 함수
function preload() {
  // 본인의 GitHub 유저네임으로 변경하여 테스트해보세요.
  const githubUsername = "Turtle-Hwan";
  const url = `https://github-contributions-api.jogruber.de/v4/${githubUsername}?y=last`;

  loadJSON(url, (data) => {
    contributions = data.contributions;
  });
}

function setup() {
  createCanvas(windowWidth, windowHeight, WEBGL);

  // 마우스로 3D 뷰(회전, 줌)를 쉽게 조작할 수 있게 해주는 기능
  orbitControl();
}

function draw() {
  background(20, 25, 40); // 배경색

  // 3D 객체가 입체적으로 보이게 조명을 추가
  ambientLight(80, 80, 80);
  pointLight(255, 255, 255, 0, -300, 200);

  // 도시의 중심이 화면 중앙에 오도록 조정
  translate(-width / 2.5, height / 4, -height / 4);
  rotateX(PI / 3); // 살짝 기울여서 보기 좋게 만듭니다.

  // '빌딩'들의 간격과 크기
  const spacing = 18;
  const boxSize = 15;

  // 회색빛 초록색 컬러 스킴
  const colors = [
    color(45, 51, 45),   // Level 0
    color(60, 80, 60),   // Level 1
    color(80, 110, 80),  // Level 2
    color(100, 140, 100),// Level 3
    color(120, 170, 120) // Level 4
  ];

  // 데이터를 기반으로 바닥과 빌딩(box) 그리기
  for (let i = 0; i < contributions.length; i++) {
    const data = contributions[i];
    const week = Math.floor(i / 7);
    const day = i % 7;

    // 컨트리뷰션 수에 따라 높이 결정 (0일 경우 최소 높이)
    const height = (data.count > 0)
      ? map(data.count, 0, 20, 10, 200, true)
      : 2; // 바닥 타일의 높이

    push();

    // 박스 위치로 이동 (높이의 절반만큼 위로 올려서 바닥에 붙임)
    translate(week * spacing, -height / 2, day * spacing);

    // 박스 스타일 설정
    noStroke();
    specularMaterial(colors[data.level]); // 레벨에 맞는 색상 적용

    // 박스 그리기
    box(boxSize, height, boxSize);

    pop();
  }
}

// 브라우저 창 크기가 변경될 때 캔버스 크기도 조절
function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}
