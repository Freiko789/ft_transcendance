/* ************************************************************************** */
/*                                                                            */
/*                                                        :::      ::::::::   */
/*   loadIsland.mjs                                     :+:      :+:    :+:   */
/*                                                    +:+ +:+         +:+     */
/*   By: fabperei <fabperei@student.42.fr>          +#+  +:+       +#+        */
/*                                                +#+#+#+#+#+   +#+           */
/*   Created: 2024/07/26 16:25:21 by phudyka           #+#    #+#             */
/*   Updated: 2024/11/19 08:22:10 by fabperei         ###   ########.fr       */
/*                                                                            */
/* ************************************************************************** */

import * as THREE from '/game_server/node_modules/three/build/three.module.js';
import { GLTFLoader } from '/game_server/node_modules/three/examples/jsm/loaders/GLTFLoader.js';

export default async function loadModel(scene, onLoad) {
    const loader = new GLTFLoader();
    let ocean;

    try {
        const gltf = await loader.loadAsync('/game_server/scenes/pongScene_V6.glb');
        const model = gltf.scene;

        model.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
            }
            if(child.isMesh && (
                child.name === "socle_sable_parfait" || 
                child.name === "ile_sable_imparfait" || 
                child.name === "eau" || 
                child.name === "socle_turquoise_scene" || 
                child.name === "Plan001")) {
                child.receiveShadow = true;
                child.castShadow = false;
            }
        });

        const waterGeometry = new THREE.BoxGeometry(500, 500, 2);

        const waterMaterial = new THREE.MeshStandardMaterial({
            color: 0x1e90ff,
            transparent: true,
            opacity: 0.7,
            roughness: 0.3,
            metalness: 0.2,
            depthWrite: false,
        });

        ocean = new THREE.Mesh(waterGeometry, waterMaterial);
        ocean.receiveShadow = true;
        ocean.rotation.x = - Math.PI / 2;

        scene.add(ocean);

        const mixer = new THREE.AnimationMixer(model);

        const actions = {};

        gltf.animations.forEach((clip) => {
            if (clip.name === 'Palmier' || clip.name === 'Palmier2' || clip.name === 'Drapeau' || clip.name === 'Sketchfab_modelAction' || clip.name === 'Swim') {
                const action = mixer.clipAction(clip);
                actions[clip.name] = action;
                action.play();
            }
        });

        model.scale.set(1.5, 1.5, 1.28);
        scene.add(model);
        // console.log(model);
        onLoad(mixer, actions);
    } catch (error) {
        console.error('Error : Loading Island', error);
    }
}
