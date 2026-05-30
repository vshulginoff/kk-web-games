import { carState, gameData, appSettings, saveSettings } from './config.js';
import { trackNodes } from './world.js'; 

export function setupUI() {
    const menu = document.getElementById('settings-menu');
    const minimap = document.getElementById('minimap-container');
    
    minimap.addEventListener('click', () => menu.classList.toggle('hidden'));
    document.getElementById('btn-close').addEventListener('click', () => menu.classList.toggle('hidden'));

    document.getElementById('btn-export').addEventListener('click', () => {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(appSettings, null, 2));
        const dlAnchorElem = document.createElement('a');
        dlAnchorElem.setAttribute("href", dataStr);
        dlAnchorElem.setAttribute("download", "rally_physics_config.json");
        dlAnchorElem.click();
    });

    const defaultSettings = { 
        dist: 35, height: 15, lookY: 5, lerp: 0.2, sway: 0.8,
        maxSpd: 25.0, acc: 0.35, grip: 0.12, turn: 0.05, drag: 0.985
    };

    document.getElementById('btn-reset').addEventListener('click', () => {
        localStorage.removeItem('rallyAppConfig');
        Object.assign(appSettings, defaultSettings);
        const inputsMap = { 'dist': 'dist', 'height': 'height', 'look': 'lookY', 'lerp': 'lerp', 'sway': 'sway', 'spd': 'maxSpd', 'acc': 'acc', 'grip': 'grip', 'turn': 'turn', 'drag': 'drag' };
        for (const [id, key] of Object.entries(inputsMap)) {
            document.getElementById(`inp-${id}`).value = appSettings[key];
            document.getElementById(`val-${id}`).innerText = appSettings[key];
        }
    });

    const inputsMap = {
        'dist': 'dist', 'height': 'height', 'look': 'lookY', 'lerp': 'lerp', 'sway': 'sway',
        'spd': 'maxSpd', 'acc': 'acc', 'grip': 'grip', 'turn': 'turn', 'drag': 'drag'
    };

    for (const [id, key] of Object.entries(inputsMap)) {
        const el = document.getElementById(`inp-${id}`);
        const valEl = document.getElementById(`val-${id}`);
        el.value = appSettings[key];
        valEl.innerText = appSettings[key];
        el.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            appSettings[key] = val;      
            valEl.innerText = val;       
            saveSettings();              
        });
    }

    document.querySelectorAll('.adj-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const isPlus = e.target.classList.contains('plus');
            const targetId = e.target.getAttribute('data-target');
            const inputEl = document.getElementById(targetId);
            const step = parseFloat(inputEl.step) || 1;
            let val = parseFloat(inputEl.value);
            if (isPlus) val = Math.min(parseFloat(inputEl.max), val + step);
            else val = Math.max(parseFloat(inputEl.min), val - step);
            const decimals = (inputEl.step.split('.')[1] || '').length;
            inputEl.value = val.toFixed(decimals);
            inputEl.dispatchEvent(new Event('input'));
        });
    });

    const scrollArea = document.querySelector('.settings-content');
    let isDown = false, startY, scrollTop;
    scrollArea.addEventListener('mousedown', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON') return;
        isDown = true; startY = e.pageY - scrollArea.offsetTop; scrollTop = scrollArea.scrollTop;
    });
    scrollArea.addEventListener('mouseleave', () => { isDown = false; });
    scrollArea.addEventListener('mouseup', () => { isDown = false; });
    scrollArea.addEventListener('mousemove', (e) => {
        if (!isDown) return;
        e.preventDefault();
        scrollArea.scrollTop = scrollTop - ((e.pageY - scrollArea.offsetTop) - startY) * 1.5;
    });

    document.getElementById('btn-track-snow').addEventListener('click', () => { if(window.startLevel) window.startLevel('snow'); });
    document.getElementById('btn-track-night').addEventListener('click', () => { if(window.startLevel) window.startLevel('night'); });
    
    document.getElementById('btn-pause').addEventListener('click', () => { if(window.pauseGame) window.pauseGame(); });
    document.getElementById('btn-resume').addEventListener('click', () => { if(window.resumeGame) window.resumeGame(); });
    
    document.getElementById('btn-toggle-lights').addEventListener('click', (e) => { 
        if(window.toggleHeadlights) {
            const isOn = window.toggleHeadlights();
            e.target.innerText = isOn ? "💡 HEADLIGHTS: ON" : "💡 HEADLIGHTS: OFF";
        }
    });

    document.getElementById('btn-restart-pause').addEventListener('click', () => { if(window.startLevel) window.startLevel(gameData.track); });
    document.getElementById('btn-main-menu').addEventListener('click', () => { if(window.goToMainMenu) window.goToMainMenu(); });
    
    document.getElementById('btn-restart').addEventListener('click', () => { if(window.startLevel) window.startLevel(gameData.track); });
    document.getElementById('btn-menu-from-finish').addEventListener('click', () => { if(window.goToMainMenu) window.goToMainMenu(); });
}

export function formatTime(ms) {
    let m = Math.floor(ms/60000).toString().padStart(2,'0');
    let s = Math.floor((ms%60000)/1000).toString().padStart(2,'0');
    let c = Math.floor((ms%1000)/10).toString().padStart(2,'0');
    return `${m}:${s}.${c}`;
}

export function updateHUD() { 
    if (gameData.state === 'PLAYING') {
        document.getElementById('timer').innerText = formatTime(Date.now() - gameData.startTime);
    }
}

// НОВАЯ МИНИКАРТА-РАДАР
export function renderMinimap(minimapCtx) {
    const W = 110;
    const H = 110;
    
    minimapCtx.clearRect(0, 0, W, H);
    minimapCtx.save();

    // 1. Центрируем радар
    minimapCtx.translate(W / 2, H / 2);
    
    // 2. Вращаем карту так, чтобы машина ВСЕГДА смотрела вверх экрана
    minimapCtx.rotate(-carState.angle + Math.PI); 

    // 3. Масштаб приближения
    const scale = 0.035; 
    minimapCtx.scale(scale, scale);
    
    // 4. Сдвигаем мир вокруг координат машины
    minimapCtx.translate(-carState.x, -carState.z);

    // Рисуем дорогу (Только ближайшие участки, чтобы не лагало)
    minimapCtx.strokeStyle = '#555'; 
    minimapCtx.lineWidth = 140; 
    minimapCtx.lineCap = 'round'; 
    minimapCtx.lineJoin = 'round';
    
    minimapCtx.beginPath();
    let isDrawing = false;
    for (let i = 0; i < trackNodes.length; i++) {
        let p = trackNodes[i];
        // Рисуем только узлы в радиусе 2500 от машины
        if (Math.hypot(p.x - carState.x, p.z - carState.z) < 2500) {
            if (!isDrawing) { 
                minimapCtx.moveTo(p.x, p.z); 
                isDrawing = true; 
            } else { 
                minimapCtx.lineTo(p.x, p.z); 
            }
        } else {
            isDrawing = false; // Разрываем линию, если узел слишком далеко
        }
    }
    minimapCtx.stroke();

    // Рисуем финиш (если он рядом)
    let finish = trackNodes[trackNodes.length - 1];
    if (Math.hypot(finish.x - carState.x, finish.z - carState.z) < 2500) {
        minimapCtx.fillStyle = '#e74c3c';
        minimapCtx.beginPath(); 
        minimapCtx.arc(finish.x, finish.z, 200, 0, Math.PI * 2); 
        minimapCtx.fill();
    }

    minimapCtx.restore();

    // Рисуем саму машинку (Неподвижный бирюзовый треугольник по центру радара)
    minimapCtx.fillStyle = '#00f7ff';
    minimapCtx.beginPath(); 
    minimapCtx.moveTo(W/2, H/2 - 8); 
    minimapCtx.lineTo(W/2 + 6, H/2 + 8); 
    minimapCtx.lineTo(W/2 - 6, H/2 + 8); 
    minimapCtx.fill();
}

