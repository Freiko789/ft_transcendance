/* ************************************************************************** */
/*                                                                            */
/*                                                        :::      ::::::::   */
/*   main.mjs                                           :+:      :+:    :+:   */
/*                                                    +:+ +:+         +:+     */
/*   By: fabperei <fabperei@student.42.fr>          +#+  +:+       +#+        */
/*                                                +#+#+#+#+#+   +#+           */
/*   Created: 2024/07/26 16:25:09 by phudyka           #+#    #+#             */
/*   Updated: 2024/11/19 08:28:59 by fabperei         ###   ########.fr       */
/*                                                                            */
/* ************************************************************************** */

import * as THREE from '/game_server/node_modules/three/build/three.module.js';
import Light from './light.mjs';
import Camera from './camera.mjs';
import Graphic from './graphic.mjs';
import Logo from './logo.mjs';
import { fadeOutLogoAndStartAnimation } from './animation.mjs';
import { Pad } from './pad.mjs';
import { OrbitControls } from '/game_server/node_modules/three/examples/jsm/controls/OrbitControls.js';
import loadModel from './loadIsland.mjs';
import { Ball } from './ball.mjs';
import { hitPadEvent, initSocketEvent, SoundLobby } from './socketEvent.mjs';
import Sound from './sounds.mjs';
import { updateUserStats } from './api.mjs';

const socket = io('https://c1r4p6.42nice.fr:8080', {
    transports: ['websocket'],
    path: '/g_socket.io'
});

let username;
let token;
let csrfToken;
let avatar;

window.addEventListener('message', function(event) {
    if (event.origin === 'https://c1r4p6.42nice.fr:8080' && event.data.type == 'gameInvitation') {
        // console.log(event);
        const to = event.data.to;
        const from = event.data.from;
        // console.log('to recu:', to);
        // console.log('from recu :', from);
        socket.emit('invite', {to, from});
    } else {
        // console.warn('Origine non autorisée:', event.origin);
    }
});

window.addEventListener('message', function(event) {
    if (event.origin === 'https://c1r4p6.42nice.fr:8080' && event.data.type == undefined) {
        username = event.data.username;
        token = event.data.token;
        csrfToken = event.data.csrfToken;
        avatar = event.data.avatar;
        // console.log('Nom d utilisateur recu:', username);
        // console.log('token recu :', token);
        // console.log('csrfToken recu :', csrfToken);
        // console.log('avatar recu :', avatar);
        socket.emit('username', { username, token, avatar });

    } else {
        // console.warn('Origine non autorisée:', event.origin);
    }
});

let controlledPad = null;
let controlledPads = null;
export let pad1, pad2, pad3, pad4, ball;
export let scene, camera, renderer, listener;
let logo
let mixer, action;
export let gameState = {
    choice: false
};
let controls;
export let sounds = [];

const clock = new THREE.Clock();

function initGame() {
    scene = new THREE.Scene();
    camera = new Camera();
    renderer = new Graphic(scene, camera);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = false;
    controls.screenSpacePanning = false;
    controls.enableRotate = false;
    controls.enableZoom = false;
    controls.enablePan = false;
    controls.autoRotateSpeed = 0.7;
    controls.autoRotate = true;

    new Light(scene);

    logo = new Logo(scene);

    fadeOutLogoAndStartAnimation(logo, scene, camera, renderer);


    sounds = new Sound(camera);

    pad1 = new Pad(0xFF6600, 0.045, 0.50, 16, -2.10, 3.59, 0);
    pad1.addToScene(scene);

    pad2 = new Pad(0x00A9FF, 0.045, 0.50, 16, 2.10, 3.59, 0);
    pad2.addToScene(scene);

    ball = new Ball(0.07, 32);
    ball.addToScene(scene);


    document.addEventListener('keydown', (event) => {
        const { key } = event;
        if (controlledPads) {
            if (key === 'w') socket.emit('padMove', { pad: 1, direction: 'up', moving: true });
            if (key === 's') socket.emit('padMove', { pad: 1, direction: 'down', moving: true });
            if (key === 'ArrowUp') socket.emit('padMove', { pad: 2, direction: 'up', moving: true });
            if (key === 'ArrowDown') socket.emit('padMove', { pad: 2, direction: 'down', moving: true });
        } else {
            if (controlledPad === 1) {
                if (key === 'w') socket.emit('padMove', { pad: 1, direction: 'up', moving: true });
                if (key === 's') socket.emit('padMove', { pad: 1, direction: 'down', moving: true });
            } else if (controlledPad === 2) {
                if (key === 'ArrowUp') socket.emit('padMove', { pad: 2, direction: 'up', moving: true });
                if (key === 'ArrowDown') socket.emit('padMove', { pad: 2, direction: 'down', moving: true });
            } else if (controlledPad === 3) {
                if (key === 'w') socket.emit('padMove', { pad: 3, direction: 'up', moving: true });
                if (key === 's') socket.emit('padMove', { pad: 3, direction: 'down', moving: true });
            } else if (controlledPad === 4) {
                if (key === 'ArrowUp') socket.emit('padMove', { pad: 4, direction: 'up', moving: true });
                if (key === 'ArrowDown') socket.emit('padMove', { pad: 4, direction: 'down', moving: true });
            }
        }
    });

    document.addEventListener('keyup', (event) => {
        const { key } = event;
        if (controlledPads) {
            if (key === 'w') socket.emit('padMove', { pad: 1, direction: 'up', moving: false });
            if (key === 's') socket.emit('padMove', { pad: 1, direction: 'down', moving: false });
            if (key === 'ArrowUp') socket.emit('padMove', { pad: 2, direction: 'up', moving: false });
            if (key === 'ArrowDown') socket.emit('padMove', { pad: 2, direction: 'down', moving: false });
        } else {
            if (controlledPad === 1) {
                if (key === 'w') socket.emit('padMove', { pad: 1, direction: 'up', moving: false });
                if (key === 's') socket.emit('padMove', { pad: 1, direction: 'down', moving: false });
            } else if (controlledPad === 2) {
                if (key === 'ArrowUp') socket.emit('padMove', { pad: 2, direction: 'up', moving: false });
                if (key === 'ArrowDown') socket.emit('padMove', { pad: 2, direction: 'down', moving: false });
            } else if (controlledPad === 3) {
                if (key === 'w') socket.emit('padMove', { pad: 3, direction: 'up', moving: false });
                if (key === 's') socket.emit('padMove', { pad: 3, direction: 'down', moving: false });
            } else if (controlledPad === 4) {
                if (key === 'ArrowUp') socket.emit('padMove', { pad: 4, direction: 'up', moving: false });
                if (key === 'ArrowDown') socket.emit('padMove', { pad: 4, direction: 'down', moving: false });
            }
        }
    });
    initSocketEvent(socket, ball);
    hitPadEvent(socket, sounds);
    SoundLobby(socket, sounds);
}

document.getElementById('start-game-button').addEventListener('click', () => {
    document.getElementById('start-game-button').classList.add('hidden');
    initGame();
    setTimeout(() => {
        loadModel(scene, (loadedMixer, loadedAction) => {
            mixer = loadedMixer;
            action = loadedAction;
        });
        animateChoice();
        socket.emit('lobby ready');
    }, 2000);
});

function updateAnimation() {
    const delta = clock.getDelta();
    if (mixer) mixer.update(delta);
}

function animateChoice() {
    if (!gameState.choice) {
        requestAnimationFrame(animateChoice);
        controls.update();
        updateAnimation();
        renderer.render(scene, camera);
    }
    else {
        animate();
    }
}

function animate() {
    if (gameState.choice) {
        requestAnimationFrame(animate);
        updateAnimation();
        renderer.render(scene, camera);
    }
    else {
        camera.animCam(0, 8, 20);
        controls.autoRotate = true
        animateChoice();
    }
}

socket.on('start-game', (rooms, roomsTypes) => {
    gameState.choice = true;
    sounds.stop('lobby');
    sounds.play('ambient');
	sounds.playMusic();
    camera.animCam(0, 8, 6.2);
    controls.autoRotate = false;
    controls.update();
    controlledPad = 0;
    controlledPads = 0;
    document.getElementById('menu').classList.add('hidden');
    document.getElementById('multi').classList.add('hidden');
    document.getElementById('tournament-details').classList.add('hidden');
    document.getElementById('tournament-details').classList.remove('flex');
    document.getElementById('waiting').classList.add('hidden');
    document.getElementById('score').classList.remove('hidden');
    document.getElementById('score').classList.add('score-container');

    const [player1, player2, player3, player4] = rooms;

    if (roomsTypes === 'multi-2-local') {
        controlledPads = [1, 2];
    } else {
        if (username === player1 || socket.id === player1) controlledPad = 1;
        else if (username === player2 || socket.id === player2) controlledPad = 2;
        else if (username === player3 || socket.id === player3) controlledPad = 3;
        else if (username === player4 || socket.id === player4) controlledPad = 4;
    }

    if (player4) {
        pad3 = new Pad(0xcc7700, 0.045, 0.50, 16, -0.5, 3.59, 0);
        pad3.addToScene(scene);

        pad4 = new Pad(0x2040df, 0.045, 0.50, 16, 0.5, 3.59, 0);
        pad4.addToScene(scene);
    }
    colorPad(controlledPad);
});

function colorPad(number){
    switch (number) {
        case 1:
            pad1.color();
            break;
        case 2:
            pad2.color();
            break;
        case 3:
            pad3.color();
            break;
        case 4:
            pad4.color();
            break;
        default:
            break;
    }
}

socket.on('movePad', (data) => {
    pad1.mesh.position.z = data.pad1;
    pad2.mesh.position.z = data.pad2;
    if (pad4) {
        pad3.mesh.position.z = data.pad3;
        pad4.mesh.position.z = data.pad4;
    }
});

socket.on('matchOver', (data) => {
    const winner = data.winner;
    const currentRoom = data.roomName;
    document.getElementById('score').classList.add('hidden');
    document.getElementById('score').classList.remove('score-container');
    document.getElementById('scoreLeft').textContent = 0;
    document.getElementById('scoreRight').textContent = 0;
    document.getElementById('tournament-details').classList.remove('hidden');
    document.getElementById('tournament-details').classList.add('flex');

    if (winner === socket.id) {
        socket.emit('match-finished', { playerWinner: winner, playerName: username, room: currentRoom, roomType: data.roomType });
    }
    cleanUpGameObjects();
});

socket.on('gameOver', (data) => {
    sounds.play('lobby');
    sounds.stop('ambient');
	sounds.stopMusic();
    gameState.choice = false;
    const winner = data.winner;
    const gameOverSection = document.getElementById('game-over');
    const winnerMessage = document.getElementById('winner-message');
    // console.log('winner contient :', winner);
	if (data.winner === username && data.roomType !== 'multi-2-local'){
		sounds.play('win');
        winnerMessage.textContent = `YOU WIN !`;
        updateUserStats(username, token, true, data.looser);
    }
	else if (data.winner !== username && data.roomType !== 'multi-2-local' && data.roomType !== 'multi-four') {
        sounds.play('loose');
        winnerMessage.textContent = `YOU LOOSE ! ${winner} is the winner`;
        updateUserStats(username, token, false, data.winner);
    }
    else if (data.winner.length === 2 && data.winner[0] === username || data.winner[1] === username){
        winnerMessage.textContent = `YOU WIN ${winner}`;
    }
    else {
        winnerMessage.textContent = `YOU LOOSE the winners is ${winner}`;
        sounds.play('win');
    }
    gameOverSection.style.display = 'flex';

    document.getElementById('score').classList.add('hidden');
    document.getElementById('score').classList.remove('score-container');
    document.getElementById('scoreLeft').textContent = 0;
    document.getElementById('scoreRight').textContent = 0;
    document.getElementById('tournament').classList.remove('active');

    document.getElementById('back-to-menu-button').addEventListener('click', () => {
        gameOverSection.style.display = 'none';
        document.getElementById('menu').classList.remove('hidden');
    });
    cleanUpGameObjects();
    socket.emit('endGame');
});

function removeGameObject(gameObject) {
    if (gameObject) {
        gameObject.removeFromScene(scene);
        gameObject = null;
    }
    return gameObject;
}

function cleanUpGameObjects() {
    pad1 = removeGameObject(pad1);
    pad2 = removeGameObject(pad2);
    pad3 = removeGameObject(pad3);
    pad4 = removeGameObject(pad4);
    ball = removeGameObject(ball);

    pad1 = new Pad(0xcc7700, 0.045, 0.50, 16, -2.10, 3.59, 0);
    pad1.addToScene(scene);

    pad2 = new Pad(0x2FA4FF, 0.045, 0.50, 16, 2.10, 3.59, 0);
    pad2.addToScene(scene);

    ball = new Ball(0.07, 32);
    ball.addToScene(scene);
}

