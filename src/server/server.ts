/*
Copyright (c) 2018-2023 Dave Weilert

Permission is hereby granted, free of charge, to any person obtaining a copy of this software 
and associated documentation files (the "Software"), to deal in the Software without restriction, 
including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, 
and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, 
subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial 
portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT 
LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. 
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, 
WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE 
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

//------------------------------------------------------------------------------
// Software version
//------------------------------------------------------------------------------
const softwareVersion = '6.2.6';

//------------------------------------------------------------------------------
// Require statements
//------------------------------------------------------------------------------
// third-party requires and configuration
import bodyParser from 'body-parser';
import commandLineArgs from 'command-line-args';
import http from 'http';
import express from 'express';
import partials from 'express-partials';
import compression from 'compression';
import cors from 'cors';
import path from 'path';

import clientIO from '../lib/clientIO.js';
import vpk from '../lib/vpk.js';
import vpkReset from '../lib/vpkReset.js';
import indexRouter from '../server/public/routes/index.js';

import { logMessage } from '../utils/logging.js';
import { formatDir } from '../filehandler/formatdir.js';
import { readConfig } from '../filehandler/readconfig.js';
import { readLicenseFile } from '../filehandler/readlicensefile.js';
import { makedir } from '../filehandler/makedir.js';
import { splashHelp, splashPop } from '../splash/splash.js';
import { buildDocumentation } from '../help/buildDocs.js';
import { appURLRoutes } from '../lib/appURLRoutes.js';
import { Server } from 'socket.io';
import { fileURLToPath } from 'url';

// server and socket io configuration
let app: any = express();
let server: any = http.createServer(app);
let io: any = new Server(server);

const __filename: any = fileURLToPath(import.meta.url);
const __dirname: any = path.dirname(__filename);

//------------------------------------------------------------------------------
// Application start parms
//------------------------------------------------------------------------------
let port: number = 4200;
let snapshot: string = 'x';
let startMsg: any[] = [];

let optionDefinitions: any[] = [
    {
        name: 'port',
        description: `Port to provide access for the browser portion of the VpK application. 
        Range is 1 to 65535.`,
        alias: 'p',
        type: Number,
        defaultOption: 4200,
    },
    {
        name: 'snapshot',
        description: `Directory that contains the cluster Snapshot files. 
        Provide the complete path to the snapshot instances.  
        If not defined the directory: ' + cwd + '/cluster will be used.`,
        alias: 's',
        type: String,
    },
    {
        name: 'container',
        description: `Indicates VpK is running from a container. 
            Enables an additional feature to communicate via the web interface to send commands to the container.`,
        alias: 'c',
    },
    {
        name: 'help',
        description: 'Display this usage guide.',
        alias: 'h',
    },
];

//------------------------------------------------------------------------------
// Process start parameters if provided
//------------------------------------------------------------------------------
let options: any = commandLineArgs(optionDefinitions);

// -help used
if (typeof options.help !== 'undefined') {
    splashHelp(optionDefinitions);
    process.exit(0);
}

// -p used
if (typeof options.port !== 'undefined' && options.port !== null) {
    port = options.port;
    if (port < 1 || port > 65535) {
        logMessage('MNL099 - Invalid port number defined.  Valid range is 1 - 65535');
        process.exit(-1);
    }
}

// -s snapshot volume
if (typeof options.snapshot !== 'undefined' && options.snapshot !== null) {
    snapshot = options.snapshot;

    let nd = formatDir(snapshot);

    vpk.snapshotDir = nd;
} else {
    vpk.snapshotDir = 'none';
}

// -c container instance
if (typeof options.container !== 'undefined' && options.container !== null) {
    vpk.runMode = 'C';
    // Vpk running from container
} else {
    vpk.runMode = 'L';
    // Vpk running locally
}

//------------------------------------------------------------------------------
// splash screen
//------------------------------------------------------------------------------
splashPop(softwareVersion, port);

if (startMsg.length > 0) {
    for (let m = 0; m < startMsg.length; m++) {
        logMessage(startMsg[m]);
    }
}

//------------------------------------------------------------------------------
// read vpk configuration file
//------------------------------------------------------------------------------
let gcstatus: any = readConfig();
if (gcstatus !== 'OK') {
    logMessage('MNL095 - Terminating application error processing configuration file vpkconfig.json');
    process.exit(-1);
}

//------------------------------------------------------------------------------
// Define configuration for app
//------------------------------------------------------------------------------
app.use(express.static(__dirname + '/public'));
app.use(bodyParser.json());
app.use(compression());
app.use(cors());
// Partials
app.use(partials());
// Express
app.use(express.urlencoded({ extended: true }));
// Routes
app.use('/', indexRouter);
// Views location and processing engine
app.set('views', __dirname + '/public/views');
app.set('view engine', 'ejs');

//------------------------------------------------------------------------------
// Define app routes / urls
//------------------------------------------------------------------------------
appURLRoutes(app);

//------------------------------------------------------------------------------
// Define Client SocketIO
//------------------------------------------------------------------------------
clientIO.init(io, softwareVersion);

//------------------------------------------------------------------------------
// Reset all vars in global vpk
//------------------------------------------------------------------------------
vpkReset.resetAll();

//------------------------------------------------------------------------------
// start server
//------------------------------------------------------------------------------
function startServer() {
    try {
        server.listen(port); // start server
        // flh is the file handler
        readLicenseFile(); // read license text into global vpk
        makedir('cluster');
        makedir('usage'); // create the usage directory if it does not exist
        buildDocumentation(); // read, parse, and load documentation markdown files into global vpk
    } catch (err) {
        console.log(err.stack);
    }
}

//------------------------------------------------------------------------------
// Begin processing
//------------------------------------------------------------------------------
startServer();
