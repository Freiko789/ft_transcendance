/* ************************************************************************** */
/*                                                                            */
/*                                                        :::      ::::::::   */
/*   routes.mjs                                         :+:      :+:    :+:   */
/*                                                    +:+ +:+         +:+     */
/*   By: phudyka <phudyka@student.42.fr>            +#+  +:+       +#+        */
/*                                                +#+#+#+#+#+   +#+           */
/*   Created: 2024/07/26 16:25:26 by phudyka           #+#    #+#             */
/*   Updated: 2024/07/26 16:27:16 by phudyka          ###   ########.fr       */
/*                                                                            */
/* ************************************************************************** */

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

router.use(express.static(path.join(__dirname, 'public')));

router.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, 'public/index.html'));
});

router.get('/main.mjs', (req, res) => {
    res.setHeader('Content-Type', 'application/javascript');
    res.sendFile(path.join(__dirname, 'main.mjs'));
});

router.use('/node_modules', express.static(path.join(__dirname, 'node_modules')));

router.use((req, res) => {
    res.status(404).send('404 Not Found');
});

export default router;