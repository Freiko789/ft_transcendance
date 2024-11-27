/* ************************************************************************** */
/*                                                                            */
/*                                                        :::      ::::::::   */
/*   server.mjs                                         :+:      :+:    :+:   */
/*                                                    +:+ +:+         +:+     */
/*   By: fabperei <fabperei@student.42.fr>          +#+  +:+       +#+        */
/*                                                +#+#+#+#+#+   +#+           */
/*   Created: 2024/07/26 16:25:31 by phudyka           #+#    #+#             */
/*   Updated: 2024/11/14 09:54:34 by fabperei         ###   ########.fr       */
/*                                                                            */
/* ************************************************************************** */

import express from 'express';
import { createServer } from 'https';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import routes from './routes.mjs';
import setupSockets from './sockets.mjs';
import fs from 'fs';
import cors from 'cors';

const options = {
    key: fs.readFileSync('/app/ssl_certificates/game_server.key'),
    cert: fs.readFileSync('/app/ssl_certificates/game_server.crt')
};
const app = express();

app.use(cors({
    origin: ["https://c1r4p6.42nice.fr:8080"],
    methods: ["GET", "POST"],
    credentials: true
}));


const server = createServer(options, app);
const io = new Server(server);
const port = 443;


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.static(__dirname));
app.use(routes);

setupSockets(io);

server.listen(port, () => {
    console.log('Server listening on port ', port);
});