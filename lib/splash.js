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

/*----------------------------------------------------------
Startup splash 
*/

'use strict';

import vpk from '../lib/vpk.js';

import commandLineUsage from 'command-line-usage';
import chalk from 'chalk';

export default {

    //------------------------------------------------------------------------------
    // exported functions  
    //------------------------------------------------------------------------------

    help: function (optionDefinitions) {
        var usage = commandLineUsage([
            {
                header: 'Vpk server',
                content: 'Server application that creates and reads snapshots of clusters and hosts the user interface for the browser access to VpK.'
            },
            {
                header: 'Options',
                optionList: optionDefinitions,
                tableOptions: {
                    columns: [
                        {
                            name: 'option',
                            noWrap: true,
                            width: 30,
                            padding: { left: '', right: ' ' },
                        },
                        {
                            name: 'description',
                            width: 50,
                            padding: { left: '  ', right: '' }
                        }
                    ]
                }
            }
        ]);
        console.log(usage);
    },

    pop: function (softwareVersion, port) {
        let bb = chalk.green;
        let VPK_TITLE = chalk.bold.underline('Visually presented Kubernetes');
        let VPK_VERSION;
        let VPK_RUNMODE;
        if (softwareVersion.length === 5) {
            VPK_VERSION = chalk.bold('Version:  ' + softwareVersion);
        } else {
            VPK_VERSION = chalk.bold('Version: ' + softwareVersion);
        }

        let VPK_PORT = chalk.bold('Server Port: ' + port)
        if (vpk.runMode === 'L') {
            VPK_RUNMODE = chalk.bold('RunMode: Local    ')
        } else {
            VPK_RUNMODE = chalk.bold('RunMode: Container')
        }

        var vpk_platform = chalk.bold('Platform: ' + process.platform)

        var tmp = process.platform;
        tmp = tmp.padEnd(8, " ");
        tmp = tmp.substring(0, 8)
        var VPK_PLATFORM = chalk.bold('Platform: ' + tmp)


        // Do not change the spacing of the following VPK_HEADER, and 
        // do not delete the single tick mark
        var VPK_HEADER = `
          ${bb('-----------------------------------------------------------------------')}
          | ${bb(' ___          ___         __    ___')}                                 |              
          |  ${bb('\\\\  \\\\')}        ${bb('/  /')}        ${bb('|  |  /  /')}   ${bb(VPK_TITLE)} |
          |   ${bb('\\\\  \\\\')}      ${bb('/  /')}         ${bb('|  | /  /')}                                  |                  
          |    ${bb('\\\\  \\\\')}    ${bb('/  /')}          ${bb('|  |/  /')}                                   | 
          |     ${bb('\\\\  \\\\')}  ${bb('/  /')}    ${bb('___')}    ${bb('|      \\\\')}           ${bb(VPK_VERSION)}         |
          |      ${bb('\\\\  \\\\')}${bb('/  /')}    ${bb('|   \\\\')}   ${bb('|  | \\\\  \\\\')}          ${bb(VPK_PORT)}       |                                 
          |       ${bb('\\\\')}${bb('    /')}     ${bb('|    |')}  ${bb('|  |  \\\\  \\\\')}         ${bb(VPK_RUNMODE)}      |                                
          |        ${bb('\\\\')}${bb('__/')}      ${bb('|___/')}   ${bb('|__|   \\\\__\\\\')}        ${bb(VPK_PLATFORM)}      | 
          |                  ${bb('|')}                                                  |
          |                  ${bb('|')}                                                  |
          ${bb('-----------------------------------------------------------------------')}
             
          `
        //Do not delete the single tick mark above


        var adv = commandLineUsage([{
            content: VPK_HEADER,
            raw: true,
        }]);
        console.log(adv);
    }
};