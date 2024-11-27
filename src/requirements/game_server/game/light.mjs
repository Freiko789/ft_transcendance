/* ************************************************************************** */
/*                                                                            */
/*                                                        :::      ::::::::   */
/*   light.mjs                                          :+:      :+:    :+:   */
/*                                                    +:+ +:+         +:+     */
/*   By: phudyka <phudyka@student.42.fr>            +#+  +:+       +#+        */
/*                                                +#+#+#+#+#+   +#+           */
/*   Created: 2024/07/26 16:25:19 by phudyka           #+#    #+#             */
/*   Updated: 2024/07/26 16:25:20 by phudyka          ###   ########.fr       */
/*                                                                            */
/* ************************************************************************** */

import { AmbientLight, HemisphereLight, PointLight, DirectionalLight } from './node_modules/three/build/three.module.js';

export default class Light {
    constructor(scene) {
        this.sunLight = new DirectionalLight(0xfffff0, 2);
        this.sunLight.castShadow = true;
        this.sunLight.position.set(-6, 11, -10);
        this.sunLight.shadow.mapSize.width = 2048;
        this.sunLight.shadow.mapSize.height = 2048;
        this.sunLight.shadow.camera.near = 0.5;
        this.sunLight.shadow.camera.far = 500;
        this.sunLight.shadow.camera.left = -10;
        this.sunLight.shadow.camera.right = 10;
        this.sunLight.shadow.camera.top = 10;
        this.sunLight.shadow.camera.bottom = -10;
        
        this.Sun = new DirectionalLight(0xfffff0, 1);
        this.Sun.position.set(-5, 20, -15);
        
        this.pointLight = new PointLight(0xffa95c, 0.5, 100);
        this.pointLight.position.set(0, 50, 50);
        
        this.hemiLight = new HemisphereLight(0xfffff0, 0x080820, 1);
        this.hemiLight.position.set(0, 200, 0);
        
        this.ambientLight = new AmbientLight(0xfffff0, 0.5);
        
        scene.add(this.sunLight);
        scene.add(this.Sun);
        scene.add(this.pointLight);
        scene.add(this.hemiLight);
        scene.add(this.ambientLight);
    }
}
