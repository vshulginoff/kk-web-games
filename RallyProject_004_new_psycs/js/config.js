export const appSettings = { 
    dist: 35, height: 15, lookY: 5, lerp: 0.2, sway: 0.8,
    maxSpd: 25.0, acc: 0.35, grip: 0.12, turn: 0.05, drag: 0.985
};

export const carState = {
    x: 0, z: 0, vx: 0, vz: 0, angle: 0, speed: 0, 
    steerAngle: 0, closestNode: 0, maxReverseSpeed: 5.0
};

export const gameData = {
    state: 'MENU',
    startTime: 0,
    pauseTime: 0,
    track: 'snow',
    headlightsOn: true 
};

export function loadSettings() {
    if (localStorage.getItem('rallyAppConfig')) {
        let saved = JSON.parse(localStorage.getItem('rallyAppConfig'));
        Object.assign(appSettings, saved);
    }
}

export function saveSettings() {
    localStorage.setItem('rallyAppConfig', JSON.stringify(appSettings));
}

