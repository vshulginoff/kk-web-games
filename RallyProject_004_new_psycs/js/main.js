import { appSettings, carState, gameData, loadSettings } from './config.js';
import { setupControls } from './controls.js';
import { loadTrack, createEnvironment, updateWorldEnv, trackNodes } from './world.js';
import { car, createCar, updatePhysics, updateParticles } from './car.js';
import { setupUI, updateHUD, renderMinimap } from './ui.js';

window.RALLY_DEBUG_DATA = [`System Init: ${new Date().toISOString()}`];
window.RALLY_LOG = function(msg) {
    let entry = `[${new Date().toLocaleTimeString()}] ${msg}`;
    window.RALLY_DEBUG_DATA.push(entry);
    if(window.RALLY_DEBUG_DATA.length > 500) window.RALLY_DEBUG_DATA.shift();
};
window.onerror = function(message, source, lineno, colno, error) {
    window.RALLY_LOG(`CRITICAL ERROR: ${message} at ${source}:${lineno}:${colno}`);
    return false; 
};

let camera, scene, renderer, minimapCtx;

function init() {
    window.RALLY_LOG("Starting initialization...");
    loadSettings();

    renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('gameCanvas'), antialias: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5)); 
    renderer.setSize(window.innerWidth, document.getElementById('game-container').clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.BasicShadowMap;

    minimapCtx = document.getElementById('minimap-canvas').getContext('2d');
    
    window.addEventListener('resize', () => {
        if(camera) {
            camera.aspect = window.innerWidth / document.getElementById('game-container').clientHeight;
            camera.updateProjectionMatrix();
        }
        renderer.setSize(window.innerWidth, document.getElementById('game-container').clientHeight);
    });

    setupControls();
    setupUI(); 
    
    window.startLevel = startLevel;
    window.pauseGame = pauseGame;
    window.resumeGame = resumeGame;
    window.goToMainMenu = goToMainMenu;
    window.toggleHeadlights = toggleHeadlights; 

    startLevel('snow', true); 
    animate();
}

function startLevel(trackId, isBackgroundMode = false) {
    window.RALLY_LOG(`Starting level: ${trackId}. Background mode: ${isBackgroundMode}`);
    gameData.track = trackId;
    
    scene = new THREE.Scene();

    if (trackId === 'snow') {
        scene.background = new THREE.Color(0xa8d5e5);
        scene.add(new THREE.AmbientLight(0xffffff, 0.7));
        const sun = new THREE.DirectionalLight(0xffffff, 0.8);
        sun.position.set(-100, 300, 100);
        sun.castShadow = true;
        scene.add(sun);
    } else {
        const nightColor = 0x0c1420;
        scene.background = new THREE.Color(nightColor);
        
        scene.add(new THREE.AmbientLight(0x556688, 1.1)); 

        const moonLight = new THREE.DirectionalLight(0xddeeff, 1.0);
        moonLight.position.set(200, 600, 300);
        moonLight.castShadow = true;
        scene.add(moonLight);

        const moonGeo = new THREE.SphereGeometry(80, 32, 32);
        const moonMat = new THREE.MeshBasicMaterial({ color: 0xffffee });
        const moonVisible = new THREE.Mesh(moonGeo, moonMat);
        moonVisible.position.set(300, 500, 1500); 
        scene.add(moonVisible);
    }

    camera = new THREE.PerspectiveCamera(60, window.innerWidth / document.getElementById('game-container').clientHeight, 1, 4000); 
    camera.rotation.order = 'YXZ'; 

    loadTrack(trackId);
    createEnvironment(scene, trackId);
    createCar(scene);

    if (!isBackgroundMode) {
        document.getElementById('start-menu').classList.add('hidden');
        document.getElementById('finish-menu').classList.add('hidden');
        document.getElementById('pause-menu').classList.add('hidden');
        document.getElementById('settings-menu').classList.add('hidden');
        
        document.getElementById('btn-pause').classList.remove('hidden');
        document.getElementById('btn-toggle-lights').innerText = gameData.headlightsOn ? "💡 HEADLIGHTS: ON" : "💡 HEADLIGHTS: OFF";

        gameData.state = 'PLAYING'; 
        gameData.startTime = Date.now();
        
        // ИСПРАВЛЕНО: Учитываем Y координату спавна
        carState.x = trackNodes[0].x; 
        carState.y = trackNodes[0].y; 
        carState.z = trackNodes[0].z;
        carState.vx = 0; carState.vz = 0;
        carState.angle = Math.atan2(trackNodes[1].x - trackNodes[0].x, trackNodes[1].z - trackNodes[0].z); 
        carState.speed = 0; carState.closestNode = 0;
        carState.pitch = 0; carState.roll = 0;
        
        car.position.set(carState.x, carState.y, carState.z);
        car.rotation.set(0, carState.angle, 0);
        car.smoothDrift = 0;
    } else {
        gameData.state = 'MENU';
    }
}

function pauseGame() {
    if (gameData.state !== 'PLAYING') return;
    gameData.state = 'PAUSED'; gameData.pauseTime = Date.now();
    document.getElementById('pause-menu').classList.remove('hidden'); document.getElementById('btn-pause').classList.add('hidden');
}

function resumeGame() {
    if (gameData.state !== 'PAUSED') return;
    gameData.state = 'PLAYING'; gameData.startTime += (Date.now() - gameData.pauseTime); 
    document.getElementById('pause-menu').classList.add('hidden'); document.getElementById('btn-pause').classList.remove('hidden');
}

function goToMainMenu() {
    document.getElementById('pause-menu').classList.add('hidden'); document.getElementById('finish-menu').classList.add('hidden');
    document.getElementById('settings-menu').classList.add('hidden'); document.getElementById('btn-pause').classList.add('hidden');
    document.getElementById('start-menu').classList.remove('hidden');
    startLevel('snow', true); 
}

function toggleHeadlights() {
    gameData.headlightsOn = !gameData.headlightsOn;
    if (car && car.headlights) {
        car.headlights.children.forEach(light => {
            if (light instanceof THREE.SpotLight) {
                light.intensity = gameData.headlightsOn ? 7 : 0; 
            }
        });
    }
    return gameData.headlightsOn;
}

function updateCamera() {
    let actualSpeed = Math.hypot(carState.vx, carState.vz);
    let moveAngle = Math.atan2(carState.vx, carState.vz);
    let rawDrift = 0;
    
    if (actualSpeed > 0.5 && carState.speed > 0) {
        rawDrift = moveAngle - carState.angle;
        while(rawDrift > Math.PI) rawDrift -= Math.PI*2; 
        while(rawDrift < -Math.PI) rawDrift += Math.PI*2;
    }
    
    if (typeof car.smoothDrift === 'undefined') car.smoothDrift = 0;
    car.smoothDrift += (rawDrift - car.smoothDrift) * 0.1;

    let speedFactor = Math.min(1, actualSpeed / 2.0);
    let camAngle = carState.angle + (car.smoothDrift * appSettings.sway * speedFactor);

    let targetCamX = carState.x - Math.sin(camAngle) * appSettings.dist;
    let targetCamZ = carState.z - Math.cos(camAngle) * appSettings.dist;

    camera.position.x += (targetCamX - camera.position.x) * appSettings.lerp;
    camera.position.z += (targetCamZ - camera.position.z) * appSettings.lerp;
    // Мягко следуем за холмами (координата Y)
    camera.position.y += ((carState.y || 0) + appSettings.height - camera.position.y) * appSettings.lerp;

    // ИСПРАВЛЕНО: Динамическое изменение FOV для ощущения скорости
    let baseFov = 60;
    let targetFov = baseFov + (actualSpeed * 1.5); 
    camera.fov += (targetFov - camera.fov) * 0.1;
    camera.updateProjectionMatrix();

    camera.up.set(0, 1, 0); 
    camera.lookAt(carState.x, (carState.y || 0) + appSettings.lookY, carState.z);
}

function animate() {
    requestAnimationFrame(animate);
    if (gameData.state === 'PLAYING') {
        updatePhysics(scene); updateParticles(scene); updateWorldEnv(carState.x, carState.z); 
        updateCamera(); updateHUD(); renderMinimap(minimapCtx);
        if (carState.closestNode >= trackNodes.length - 2) {
            gameData.state = 'FINISHED'; document.getElementById('btn-pause').classList.add('hidden');
            document.getElementById('finish-menu').classList.remove('hidden');
            document.getElementById('final-time-text').innerText = "TIME: " + document.getElementById('timer').innerText;
        }
    } else if (gameData.state === 'MENU' || gameData.state === 'PAUSED') {
        if (car) {
            const time = Date.now() * 0.0003;
            camera.position.x = car.position.x + Math.sin(time) * 40;
            camera.position.z = car.position.z + Math.cos(time) * 40;
            camera.position.y = (carState.y || 0) + 20; // ИСПРАВЛЕНО: Меню-камера тоже учитывает Y
            camera.lookAt(car.position);
        }
    }
    if(renderer && scene && camera) renderer.render(scene, camera);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

