export const keys = { up: false, down: false, left: false, right: false, handbrake: false };

export function setupControls() {
    const bindBtn = (id, key) => {
        const el = document.getElementById(id);
        if (!el) return; // Защита на случай, если элемент еще не отрендерился
        const press = (val) => (e) => { e.preventDefault(); keys[key] = val; el.classList.toggle('active', val); };
        el.ontouchstart = press(true); el.ontouchend = press(false);
        el.onmousedown = press(true); el.onmouseup = press(false);
    };
    
    bindBtn('btn-a', 'up'); 
    bindBtn('btn-b', 'down'); 
    bindBtn('btn-l', 'left'); 
    bindBtn('btn-r', 'right');
    // ИСПРАВЛЕНО: Биндим кнопку ручника из интерфейса
    bindBtn('btn-hb', 'handbrake'); 

    window.addEventListener('keydown', (e) => { 
        if(e.code === 'ArrowUp') keys.up = true; 
        if(e.code === 'ArrowDown') keys.down = true; 
        if(e.code === 'ArrowLeft') keys.left = true; 
        if(e.code === 'ArrowRight') keys.right = true; 
        // ИСПРАВЛЕНО: Пробел для ручника на клавиатуре
        if(e.code === 'Space') keys.handbrake = true; 
    });
    
    window.addEventListener('keyup', (e) => { 
        if(e.code === 'ArrowUp') keys.up = false; 
        if(e.code === 'ArrowDown') keys.down = false; 
        if(e.code === 'ArrowLeft') keys.left = false; 
        if(e.code === 'ArrowRight') keys.right = false; 
        // ИСПРАВЛЕНО: Отпускание пробела
        if(e.code === 'Space') keys.handbrake = false; 
    });
}

