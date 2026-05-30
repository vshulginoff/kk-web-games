import { carState } from './config.js';

export let trackNodes = [];
export let obstacles = [];
export let rainSystem = null;

const bakedSnowTrack = [];
const bakedNightTrack = [];

// 1. СНЕЖНАЯ ТРАССА
let ax = 0, ay = 0, az = 0;
bakedSnowTrack.push({x: ax, y: ay, z: az, w: 30});
for(let i = 1; i < 1200; i++) { 
    let aa = Math.sin(i * 0.016) * 1.1 + Math.sin(i * 0.006) * 0.5; 
    ax += Math.sin(aa) * 40; 
    az += Math.cos(aa) * 40;
    
    ay = Math.sin(i * 0.03) * 20 + Math.sin(i * 0.01) * 45;
    
    // ИСПРАВЛЕНО: Слегка расширили трассу для создания зон обочины
    let width = 28 + Math.sin(i * 0.05) * 6; 
    bakedSnowTrack.push({x: ax, y: ay, z: az, w: width});
}

// 2. НОЧНАЯ ТРАССА
ax = 0; ay = 0; az = 0; let aaNight = 0;
bakedNightTrack.push({x: ax, y: ay, z: az, w: 28});
for(let i = 1; i < 600; i++) {
    aaNight = Math.sin(i * 0.02) * 1.5 + Math.cos(i * 0.007) * 0.8 + (Math.random() * 0.05); 
    ax += Math.sin(aaNight) * 40;
    az += Math.cos(aaNight) * 40;
    
    ay = Math.sin(i * 0.04) * 25 + Math.cos(i * 0.015) * 35;
    
    // ИСПРАВЛЕНО: Слегка расширили трассу для создания зон обочины
    let width = 25 + Math.sin(i * 0.08) * 5;
    bakedNightTrack.push({x: ax, y: ay, z: az, w: width});
}

export function loadTrack(type) {
    trackNodes = (type === 'night') ? bakedNightTrack : bakedSnowTrack;
    obstacles.length = 0;
}

export function createEnvironment(scene, type) {
    rainSystem = null;
    let isNight = (type === 'night');

    const groundColor = isNight ? 0x1a222a : 0xdddddd;
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(400000, 400000), new THREE.MeshLambertMaterial({ color: groundColor }));
    ground.rotation.x = -Math.PI / 2; 
    ground.position.y = -100; 
    ground.receiveShadow = true;
    scene.add(ground);

    const roadGeo = new THREE.BufferGeometry();
    const vertices = []; const indices = [];
    
    function getNormal(i, nodes) {
        let p = nodes[i];
        let prev = i > 0 ? nodes[i-1] : p;
        let next = i < nodes.length - 1 ? nodes[i+1] : p;
        if (i === 0) prev = { x: p.x - (next.x - p.x), z: p.z - (next.z - p.z) };
        if (i === nodes.length - 1) next = { x: p.x + (p.x - prev.x), z: p.z + (p.z - prev.z) };
        let dx = next.x - prev.x, dz = next.z - prev.z;
        let len = Math.hypot(dx, dz); 
        return { nx: dz / len, nz: -dx / len };
    }

    for(let i = 0; i < trackNodes.length; i++) {
        let p = trackNodes[i];
        let { nx, nz } = getNormal(i, trackNodes);
        vertices.push(p.x + nx * p.w, p.y, p.z + nz * p.w); 
        vertices.push(p.x - nx * p.w, p.y, p.z - nz * p.w); 
    }
    for(let i = 0; i < trackNodes.length - 1; i++) {
        let v = i * 2;
        indices.push(v, v+1, v+2); indices.push(v+1, v+3, v+2);
    }
    roadGeo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    roadGeo.setIndex(indices); roadGeo.computeVertexNormals();
    
    const roadColor = isNight ? 0x333940 : 0x555555;
    const roadMat = isNight ? new THREE.MeshPhongMaterial({ color: roadColor, shininess: 3 }) : new THREE.MeshLambertMaterial({ color: roadColor });
    const road = new THREE.Mesh(roadGeo, roadMat); 
    road.receiveShadow = true; scene.add(road);

    const grGeo = new THREE.BufferGeometry();
    const grVerts = []; const grInds = []; let grIdx = 0;
    
    function buildWall(p1, p2, n1, n2, w1, w2, side) {
        let x1 = p1.x + n1.nx * w1 * side, z1 = p1.z + n1.nz * w1 * side, y1 = p1.y;
        let x2 = p2.x + n2.nx * w2 * side, z2 = p2.z + n2.nz * w2 * side, y2 = p2.y;

        let bankW = 30; 
        let bankH = 15; 

        let bx1 = p1.x + n1.nx * (w1 + bankW) * side, bz1 = p1.z + n1.nz * (w1 + bankW) * side, by1 = p1.y + bankH;
        let bx2 = p2.x + n2.nx * (w2 + bankW) * side, bz2 = p2.z + n2.nz * (w2 + bankW) * side, by2 = p2.y + bankH;

        grVerts.push(x1, y1, z1, bx1, by1, bz1, x2, y2, z2, bx2, by2, bz2);
        grInds.push(grIdx, grIdx+1, grIdx+2, grIdx+1, grIdx+3, grIdx+2);
        grIdx += 4;
    }

    for(let i = 0; i < trackNodes.length - 1; i++) {
        let p1 = trackNodes[i], p2 = trackNodes[i+1];
        let n1 = getNormal(i, trackNodes), n2 = getNormal(i+1, trackNodes);
        buildWall(p1, p2, n1, n2, p1.w, p2.w, 1);
        buildWall(p1, p2, n1, n2, p1.w, p2.w, -1);
    }
    grGeo.setAttribute('position', new THREE.Float32BufferAttribute(grVerts, 3));
    grGeo.setIndex(grInds); grGeo.computeVertexNormals();
    
    const grColor = isNight ? 0x222b35 : 0xcccccc; 
    const grMat = new THREE.MeshStandardMaterial({ color: grColor, roughness: 0.9, side: THREE.DoubleSide });
    const guardrails = new THREE.Mesh(grGeo, grMat);
    guardrails.receiveShadow = true;
    scene.add(guardrails);

    // ДЕКОР
    const treeGeo = new THREE.ConeGeometry(20, 80, 5);
    const treeMat = new THREE.MeshLambertMaterial({ color: isNight ? 0x16261a : 0x2d5a27 });
    
    const hillGeo = new THREE.SphereGeometry(120, 16, 12);
    const hillMat = new THREE.MeshLambertMaterial({ color: isNight ? 0x11161d : 0xeeeeee });

    const houseGeo = new THREE.BoxGeometry(30, 25, 30);
    const roofGeo = new THREE.ConeGeometry(26, 18, 4);
    roofGeo.rotateY(Math.PI / 4);
    const houseMat = new THREE.MeshLambertMaterial({ color: isNight ? 0x222222 : 0x8b5a2b });
    const roofMat = new THREE.MeshLambertMaterial({ color: isNight ? 0x1a1a1a : 0xa52a2a });

    const postGeo = new THREE.CylinderGeometry(1, 1, 40, 8);
    const postMat = new THREE.MeshLambertMaterial({ color: 0x333333 });
    const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffeebb });

    for (let i = 15; i < trackNodes.length - 15; i++) {
        let p = trackNodes[i];
        let { nx, nz } = getNormal(i, trackNodes);

        if (i % 6 === 0) {
            let side = (Math.random() > 0.5) ? 1 : -1;
            let safeDist = p.w + 35 + Math.random() * 50; 
            let tx = p.x + nx * safeDist * side, tz = p.z + nz * safeDist * side;
            let tL = new THREE.Mesh(treeGeo, treeMat); 
            tL.position.set(tx, p.y + 20, tz); 
            scene.add(tL);
            // ИСПРАВЛЕНО: Регистрация дерева с точным радиусом коллизии
            obstacles.push({ type: 'tree', x: tx, z: tz, radius: 5 });
        }

        if (i % 40 === 0) {
            let side = (Math.random() > 0.5) ? 1 : -1;
            let dist = p.w + 80 + Math.random() * 60;
            let hx = p.x + nx * dist * side;
            let hz = p.z + nz * dist * side;

            const house = new THREE.Group();
            const body = new THREE.Mesh(houseGeo, houseMat); body.position.y = 12.5;
            const roof = new THREE.Mesh(roofGeo, roofMat); roof.position.y = 25 + 9;
            house.add(body); house.add(roof);

            if (isNight) {
                const winGeo = new THREE.BoxGeometry(32, 10, 15);
                const winMat = new THREE.MeshBasicMaterial({ color: 0xffcc55 }); 
                const windows = new THREE.Mesh(winGeo, winMat);
                windows.position.y = 12.5;
                house.add(windows);
            }

            house.position.set(hx, p.y, hz); 
            house.rotation.y = Math.random() * Math.PI;
            scene.add(house);
            // ИСПРАВЛЕНО: Регистрация дома
            obstacles.push({ type: 'house', x: hx, z: hz, radius: 18 }); 
        }

        if (i % 50 === 0) {
            let side = (Math.random() > 0.5) ? 1 : -1;
            let dist = p.w + 300 + Math.random() * 400;
            let hill = new THREE.Mesh(hillGeo, hillMat);
            hill.scale.set(1 + Math.random()*2, 0.3 + Math.random()*0.5, 1 + Math.random()*2);
            hill.position.set(p.x + nx * dist * side, p.y - 30, p.z + nz * dist * side);
            scene.add(hill);
        }

        if (isNight && i % 36 === 0) {
            let side = (i % 72 === 0) ? 1 : -1; 
            let offset = p.w + 10; 
            let px = p.x + nx * offset * side;
            let pz = p.z + nz * offset * side;

            const lampGroup = new THREE.Group();
            lampGroup.position.set(px, p.y, pz); 
            lampGroup.rotation.y = Math.atan2(nx * side, nz * side); 

            const post = new THREE.Mesh(postGeo, postMat); post.position.y = 20; lampGroup.add(post);
            const bulb = new THREE.Mesh(new THREE.BoxGeometry(4, 2, 8), bulbMat); bulb.position.set(0, 39, -6); lampGroup.add(bulb);
            
            scene.add(lampGroup);
            // ИСПРАВЛЕНО: Регистрация столба
            obstacles.push({ type: 'lamp', x: px, z: pz, radius: 3 }); 
        }
    }

    let startAng = Math.atan2(trackNodes[1].x - trackNodes[0].x, trackNodes[1].z - trackNodes[0].z);
    createArch(scene, trackNodes[0].x, trackNodes[0].y, trackNodes[0].z, startAng, 0x2ecc71);
    
    let endIdx = trackNodes.length - 1;
    let finishAng = Math.atan2(trackNodes[endIdx].x - trackNodes[endIdx-1].x, trackNodes[endIdx].z - trackNodes[endIdx-1].z);
    createArch(scene, trackNodes[endIdx].x, trackNodes[endIdx].y, trackNodes[endIdx].z, finishAng, 0xe74c3c);

    if (isNight) {
        const rainCount = 800; 
        const rainGeo = new THREE.BufferGeometry();
        const rainPos = new Float32Array(rainCount * 3);
        for(let i=0; i<rainCount; i++) {
            rainPos[i*3] = (Math.random() - 0.5) * 500; rainPos[i*3+1] = Math.random() * 400; rainPos[i*3+2] = (Math.random() - 0.5) * 500;
        }
        rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
        rainSystem = new THREE.Points(rainGeo, new THREE.PointsMaterial({ color: 0xaaaaaa, size: 2.0, transparent: true, opacity: 0.5 }));
        scene.add(rainSystem);
    }
}

function createArch(scene, x, y, z, angle, color) {
    const group = new THREE.Group();
    const mat = new THREE.MeshLambertMaterial({ color: 0x222222 });
    const c1 = new THREE.Mesh(new THREE.BoxGeometry(4, 40, 4), mat); c1.position.set(45, 20, 0);
    const c2 = new THREE.Mesh(new THREE.BoxGeometry(4, 40, 4), mat); c2.position.set(-45, 20, 0);
    const banner = new THREE.Mesh(new THREE.BoxGeometry(94, 8, 4), new THREE.MeshLambertMaterial({ color: color }));
    banner.position.set(0, 40, 0);
    group.add(c1); group.add(c2); group.add(banner);
    
    group.position.set(x, y, z); 
    group.rotation.y = angle; 
    scene.add(group);
}

export function updateWorldEnv(carX, carZ) {
    if (rainSystem) {
        const pos = rainSystem.geometry.attributes.position.array;
        for (let i = 0; i < 800; i++) {
            pos[i*3 + 1] -= 8; 
            if (pos[i*3 + 1] < 0) {
                pos[i*3 + 1] = 300 + Math.random() * 100;
                pos[i*3] = carX + (Math.random() - 0.5) * 500;
                pos[i*3 + 2] = carZ + (Math.random() - 0.5) * 500;
            }
        }
        rainSystem.geometry.attributes.position.needsUpdate = true;
    }
}

