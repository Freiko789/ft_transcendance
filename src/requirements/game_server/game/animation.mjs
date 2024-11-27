import * as THREE from './node_modules/three/build/three.module.js';
import Clouds from './clouds.mjs'



export async function fadeOutLogoAndStartAnimation(logo, scene, camera, renderer) {
    const fadeDuration = 2000;
    const startTime = performance.now();

    function fadeOut() {
        const elapsedTime = performance.now() - startTime;
        const opacity = 1 - (elapsedTime / fadeDuration);
        logo.material.opacity = Math.max(opacity, 0);

        if (elapsedTime < fadeDuration) {
            requestAnimationFrame(fadeOut);
        } else {
            scene.remove(logo);
            logo.geometry.dispose();
            logo.material.dispose();
            startCameraAnimation(scene, camera, renderer)
        }

        renderer.render(scene, camera);
    }

    fadeOut();
}

function startCameraAnimation(scene, camera, renderer) {
    scene.background = new THREE.Color(0x00ffff);

    const clouds = new Clouds(scene);

        const startOpacity = 2;
        const endOpacity = 0.0;
        const startPosition = {
            x: camera.position.x,
            y: camera.position.y,
            z: camera.position.z
        };
        const endPosition = {
            x: 0,
            y: 8,
            z: 20
        };
        const duration = 2000;
        const interval = 16;
        let elapsedTime = 0;

        const cameraAnimation = setInterval(() => {
            elapsedTime += interval;

            const newX = easeInOutExpo(elapsedTime, startPosition.x, endPosition.x - startPosition.x, duration);
            const newY = easeInOutExpo(elapsedTime, startPosition.y, endPosition.y - startPosition.y, duration);
            const newZ = easeInOutExpo(elapsedTime, startPosition.z, endPosition.z - startPosition.z, duration);
            const newOpacity = easeInOutExpo(elapsedTime, startOpacity, endOpacity - startOpacity, duration);

            camera.position.set(newX, newY, newZ);
            clouds.material.opacity = newOpacity;
            camera.lookAt(0, 0, 0);

            if (elapsedTime >= duration) {
                camera.position.set(endPosition.x, endPosition.y, endPosition.z);
                camera.lookAt(0, 0, 0);
                document.getElementById('menu').classList.remove('hidden');
                clearInterval(cameraAnimation);
                scene.remove(clouds);
                clouds.geometry.dispose();
                clouds.material.dispose();
            }

            renderer.render(scene, camera);
        }, interval);
        
    }

    
    function easeInOutExpo(t, b, c, d) {
        if (t == 0) return b;
        if (t == d) return b + c;
        if ((t /= d / 2) < 1) return c / 2 * Math.pow(2, 10 * (t - 1)) + b;
        return c / 2 * (-Math.pow(2, -10 * --t) + 2) + b;
    }