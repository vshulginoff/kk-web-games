import { appSettings, carState, gameData } from './config.js';
import { keys } from './controls.js';
import { trackNodes, obstacles } from './world.js'; 

export let car;
export const particles = [];

export function createCar(scene) {
    car = new THREE.Group();
    car.rotation.order = 'YXZ'; 
    
    const blue = new THREE.MeshPhongMaterial({ color: 0x0984e3, flatShading: true });
    const black = new THREE.MeshPhongMaterial({ color: 0x111111, flatShading: true });
    const gold = new THREE.MeshPhongMaterial({ color: 0xd4af37, flatShading: true });

    const body = new THREE.Mesh(new THREE.BoxGeometry(15, 5, 30), blue); body.position.y = 4.5; body.castShadow = true; car.add(body);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(13, 4.5, 14), black); cabin.position.set(0, 9.25, -2); cabin.castShadow = true; car.add(cabin);

    const spoiler = new THREE.Mesh(new THREE.BoxGeometry(15, 1, 4), blue); spoiler.position.set(0, 10, -14); car.add(spoiler);
    const spL = new THREE.Mesh(new THREE.BoxGeometry(1, 3, 3), blue); spL.position.set(-6, 8.5, -14); car.add(spL);
    const spR = new THREE.Mesh(new THREE.BoxGeometry(1, 3, 3), blue); spR.position.set(6, 8.5, -14); car.add(spR);

    const lightGeo = new THREE.BoxGeometry(3, 2, 1);
    const lightMat = new THREE.MeshBasicMaterial({ color: 0xffffcc });
    const lFgl = new THREE.Mesh(lightGeo, lightMat); lFgl.position.set(-5, 4.5, 15); car.add(lFgl);
    const lFgr = new THREE.Mesh(lightGeo, lightMat); lFgr.position.set(5, 4.5, 15); car.add(lFgr);

    car.wheels = [];
    const wGeo = new THREE.CylinderGeometry(4, 4, 2.5, 8);
    const pos = [{x: -8, z: 10, f: true}, {x: 8, z: 10, f: true}, {x: -8, z: -10, f: false}, {x: 8, z: -10, f: false}];
    pos.forEach(p => {
        const pivot = new THREE.Group(); pivot.position.set(p.x, 4, p.z);
        const w = new THREE.Mesh(wGeo, gold); w.rotation.z = Math.PI / 2; w.castShadow = true;
        pivot.add(w); car.add(pivot); car.wheels.push({ pivot: pivot, mesh: w, isFront: p.f });
    });
    
    let isNight = (gameData.track === 'night');
    if (isNight) {
        const headlights = new THREE.Group();
        const target = new THREE.Object3D(); target.position.set(0, 0, 100); headlights.add(target);

        const hLightL = new THREE.SpotLight(0xffffee, gameData.headlightsOn ? 7 : 0, 1200, Math.PI/3, 0.6, 1);
        hLightL.position.set(-5, 5, 15); hLightL.target = target; hLightL.castShadow = false; headlights.add(hLightL);

        const hLightR = new THREE.SpotLight(0xffffee, gameData.headlightsOn ? 7 : 0, 1200, Math.PI/3, 0.6, 1);
        hLightR.position.set(5, 5, 15); hLightR.target = target; hLightR.castShadow = false; headlights.add(hLightR);
        
        car.add(headlights);
        car.headlights = headlights; 
    }

    scene.add(car); 
}

export function createParticle(scene, x, y, z) {
    const pColor = gameData.track === 'night' ? 0x332211 : 0xffffff;
    const p = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), new THREE.MeshBasicMaterial({ color: pColor, transparent: true, opacity: 0.8 }));
    p.position.set(x, y + 2, z); p.userData = { vx: (Math.random() - 0.5) * 2, vy: Math.random() * 2 + 1, vz: (Math.random() - 0.5) * 2, life: 1.0 };
    scene.add(p); particles.push(p);
}

export function updateParticles(scene) {
    for (let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i];
        p.position.x += p.userData.vx; p.position.y += p.userData.vy; p.position.z += p.userData.vz;
        p.userData.life -= 0.05; p.scale.setScalar(p.userData.life); p.material.opacity = p.userData.life;
        if (p.userData.life <= 0) { scene.remove(p); particles.splice(i, 1); }
    }
}

export function updatePhysics(scene) {
    let throttle = keys.up ? 1 : (keys.down ? -1 : 0);
    let currentGrip = appSettings.grip;
    let isWheelSpin = false;
    let isHandbrake = keys.handbrake; 

    if (throttle > 0 && Math.abs(carState.speed) < 3.0) { currentGrip *= 0.3; isWheelSpin = true; carState.speed += (appSettings.acc * 0.4); } 
    else if (throttle > 0) { carState.speed += appSettings.acc; }

    if (throttle < 0) {
        if (carState.speed > 0.5) { carState.speed *= 0.90; currentGrip *= 0.2; } 
        else { carState.speed -= appSettings.acc * 0.6; }
    }

    carState.speed *= appSettings.drag;

    if (isHandbrake) {
        currentGrip *= 0.15; 
        carState.speed *= 0.96; 
    }

    carState.speed = Math.max(Math.min(carState.speed, appSettings.maxSpd), -carState.maxReverseSpeed);

    let turnInput = keys.left ? 1 : (keys.right ? -1 : 0);
    
    let turnMultiplier = isHandbrake ? 2.5 : 1.0; 
    carState.steerAngle += (turnInput * 0.6 - carState.steerAngle) * 0.2;
    
    if (Math.abs(carState.speed) > 0.1) { 
        carState.angle += carState.steerAngle * appSettings.turn * turnMultiplier * (carState.speed > 0 ? 1 : -1); 
    }

    let corneringForce = Math.abs(carState.speed * carState.steerAngle);
    let isDrifting = isHandbrake || (corneringForce > 0.8); 

    if (isDrifting && !isHandbrake) { 
        currentGrip *= Math.max(0.35, 1.0 - (corneringForce * 0.3)); 
    }

    let minD = Infinity, cNode = carState.closestNode;
    let trackCenterX = carState.x, trackCenterZ = carState.z;
    let trackCenterY = 0, incline = 0;

    for(let i = Math.max(0, cNode - 3); i < Math.min(trackNodes.length - 1, cNode + 8); i++) {
        let p1 = trackNodes[i];
        let p2 = trackNodes[i+1];
        if (!p2) continue;
        
        let dx = p2.x - p1.x;
        let dz = p2.z - p1.z;
        let l2 = dx*dx + dz*dz; 
        
        let t = Math.max(0, Math.min(1, ((carState.x - p1.x) * dx + (carState.z - p1.z) * dz) / l2));
        let projX = p1.x + t * dx;
        let projZ = p1.z + t * dz;
        
        let d = Math.hypot(carState.x - projX, carState.z - projZ);
        if(d < minD) { 
            minD = d; 
            cNode = i; 
            trackCenterX = projX;
            trackCenterZ = projZ;
            trackCenterY = p1.y + t * (p2.y - p1.y); 
            incline = Math.atan2(p2.y - p1.y, Math.sqrt(l2)); 
        }
    }
    carState.closestNode = cNode;
    carState.y = trackCenterY; 

    let nodeWidth = trackNodes[cNode].w; 
    let terrainDrag = 1.0;

    // --- ИСПРАВЛЕНО: ГРАДИЕНТНЫЕ ЗОНЫ ПОВЕРХНОСТИ ---
    if (minD < nodeWidth - 4) {
        // Зона 1: Идеальная трасса (Максимум сцепления)
    } else if (minD >= nodeWidth - 4 && minD < nodeWidth + 3) {
        // Зона 2: Обочина / Рыхлый снег (Сцепление хуже, машина чуть вязнет)
        currentGrip *= 0.6; 
        terrainDrag = 0.98;
        if (Math.abs(carState.speed) > 5 && Math.random() > 0.4) {
            createParticle(scene, carState.x, carState.y, carState.z);
        }
    } else {
        // Зона 3: Вылет с трассы (Глубокий снег / Трава)
        currentGrip *= 0.3; // Машина теряет контроль
        terrainDrag = 0.88; // Жестко вязнет, теряет скорость
        
        // Математика кювета из world.js (наклон вверх на 15 юнитов шириной 30)
        let bankDepth = minD - nodeWidth;
        carState.y += Math.min(bankDepth * 0.5, 15); 
        
        if (Math.abs(carState.speed) > 2) {
            createParticle(scene, carState.x, carState.y, carState.z);
            createParticle(scene, carState.x, carState.y, carState.z);
        }
    }
    
    // Применяем торможение об грунт
    carState.speed *= terrainDrag;

    // --- ИСПРАВЛЕНО: СТОЛКНОВЕНИЯ С ДЕРЕВЬЯМИ И ДОМАМИ (Зона 4) ---
    let carRadius = 6; 
    for (let i = 0; i < obstacles.length; i++) {
        let obs = obstacles[i];
        
        // Быстрая проверка "на глаз", чтобы не считать квадратный корень для всех объектов
        if (Math.abs(carState.x - obs.x) > 40 || Math.abs(carState.z - obs.z) > 40) continue;
        
        let dist = Math.hypot(carState.x - obs.x, carState.z - obs.z);
        if (dist < obs.radius + carRadius) {
            // Произошел удар!
            let overlap = (obs.radius + carRadius) - dist;
            let nx = (carState.x - obs.x) / dist;
            let nz = (carState.z - obs.z) / dist;
            
            // Выталкиваем машину из дерева
            carState.x += nx * overlap;
            carState.z += nz * overlap;
            
            // Гасим инерцию и делаем отскок
            carState.vx *= -0.3;
            carState.vz *= -0.3;
            carState.speed *= -0.4; 
            
            // Эффект удара (искры/пыль)
            for(let p = 0; p < 8; p++) {
                createParticle(scene, carState.x + (Math.random()-0.5)*10, carState.y + 5, carState.z + (Math.random()-0.5)*10);
            }
        }
    }

    let targetVx = Math.sin(carState.angle) * carState.speed;
    let targetVz = Math.cos(carState.angle) * carState.speed;
    
    carState.vx += (targetVx - carState.vx) * currentGrip;
    carState.vz += (targetVz - carState.vz) * currentGrip;

    let actualSpeed = Math.hypot(carState.vx, carState.vz);
    let slipAngle = Math.abs(targetVx - carState.vx) + Math.abs(targetVz - carState.vz);
    
    if ((isDrifting && slipAngle > 1.0) || isWheelSpin) {
        if(Math.random() > 0.4) {
            let rx = carState.x - Math.sin(carState.angle)*10; let rz = carState.z - Math.cos(carState.angle)*10;
            createParticle(scene, rx + (Math.random()-0.5)*8, carState.y, rz + (Math.random()-0.5)*8);
        }
    }

    let accelForce = throttle > 0 ? -0.05 : (throttle < 0 ? 0.08 : 0);
    // Добавляем к клевку небольшую тряску, если едем по бездорожью (terrainDrag < 1)
    let terrainBump = (terrainDrag < 1.0 && actualSpeed > 5) ? (Math.random() - 0.5) * 0.05 : 0;
    let targetPitch = accelForce - incline + terrainBump;
    
    let targetRoll = -carState.steerAngle * Math.min(actualSpeed * 0.1, 1.0) * 0.25;
    if (isDrifting) targetRoll *= 1.3; 

    carState.pitch = carState.pitch || 0;
    carState.roll = carState.roll || 0;

    carState.pitch += (targetPitch - carState.pitch) * 0.15;
    carState.roll += (targetRoll - carState.roll) * 0.15;

    carState.x += carState.vx;
    carState.z += carState.vz;
    car.position.set(carState.x, carState.y, carState.z);
    car.rotation.set(carState.pitch, carState.angle, carState.roll);

    let moveDir = (carState.speed >= 0) ? 1 : -1;
    car.wheels.forEach(w => {
        let rotationSpeed = isWheelSpin ? (appSettings.acc * 4) : (actualSpeed * 0.4 * moveDir);
        if (isHandbrake && !w.isFront) rotationSpeed = 0; 
        w.mesh.rotation.x += rotationSpeed;
        if (w.isFront) w.pivot.rotation.y = carState.steerAngle;
    });
}

