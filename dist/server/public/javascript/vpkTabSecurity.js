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

//----------------------------------------------------------
// Screen handling code for Security tab
//----------------------------------------------------------

//----------------------------------------------------------
// Building the security tree graph

let nodeNum = 0;
let digraphClusterCnt = 0;
let graphVizData;
let nodeData = {};
let graphsData = [];
let connections = [];
let graphvNodeToFnum = {};
let graphvizMaxReached;
let missingSubjectCnt = 0;
let largeRuleSets = {};
let graphsPrintNodeInfo = true;
let graphsPrintData = false;
let graphsPrintRawData = true;
let graphNamespaces = {};
let secData;
let secDataOrig;
let secNS = '';
let secVizInitialized = false;


let securityNamesData = [];
let securityCheckedRows = [];
let securitySelectedNameData = [];

//=========================================

function buildSecGraph(content) {
    reset();
    // Save original data for use with filterig
    secDataOrig = content.data;

    secData = content.data;
    secNS = content.ns;

    buildAll();
}

function reset() {
    nodeNum = 0;
    digraphClusterCnt = 0;
    graphVizData = '';
    nodeData = {};
    graphsData = [];
    connections = [];
    graphvNodeToFnum = {};
    missingSubjectCnt = 0;   // gets appended to subject Missing to create a unique subject name

}

function buildAll() {
    let ns = secNS;
    if (secData.length === 0) {

        document.getElementById('vizWrapper').innerHTML = '<div class="mt-5 ml-5 vpkfont vpkblue">No data for requested namespace: <span class="vpkfont-lg">' + ns + '</span></div>';
        return;
    }
    buildGraphSubjects(secData, ns);
    buildGraphBindings(secData, ns);
    buildGraphRoles(secData, ns);
    buildConnections(secData, ns);
    buildDOTData(ns);            // add and second parm and each line of DOT data will print to console

    createGraph();
}


function getSecurityNames(category) {
    let keys = Object.keys(secDataOrig);
    let data;
    let kind;
    let ns;
    let option = $('#security-ns-filter').select2('data');
    let added = [];
    let addKey;

    securityNamesData = [];

    ns = option[0].text;
    ns = ns.trim();

    for (let i = 0; i < keys.length; i++) {
        if (secDataOrig[keys[i]].ns === ns) {
            if (category === 'S') {
                data = secDataOrig[keys[i]].subjectName
                kind = secDataOrig[keys[i]].subjectKind
            } else if (category === 'B') {
                data = secDataOrig[keys[i]].name
                kind = secDataOrig[keys[i]].kind
            } else if (category === 'R') {
                data = secDataOrig[keys[i]].roleName
                kind = secDataOrig[keys[i]].roleKind
            }
            addKey = data + '.' + kind;
            if (added.includes[addKey]) {
                // Do nothing
            } else {
                added.push(data + '.' + kind);
                securityNamesData.push({ 'state': '', 'name': data, 'kind': kind, 'id': secDataOrig[keys[i]].fnum })
            }
        }
    }

    // securityNamesData.sort();

    // Populate names table with data for the selected category
    $("#tableSecurity").bootstrapTable('load', securityNamesData)
    //$("#tableSecurity").bootstrapTable('hideColumn', 'id');

}


function buildDOTData(ns) {
    // build the DOT data array
    graphsData = [];
    graphVizData = '';
    graphsData.push(`digraph { `);
    graphsData.push(`subgraph cluster_${digraphClusterCnt++} {`);   // Namespace & ClusterLevel
    graphsData.push(`subgraph cluster_${digraphClusterCnt++} {`);   // Namespace
    if (ns === 'cluster-level') {
        graphsData.push(`  label="${ns}";fontname="Times 100";fontsize="25.00";style="invis";`);
    } else {
        graphsData.push(`  label="${ns}";fontname="Times 100";fontsize="25.00";style="rounded, dashed";`);
    }
    getNodesAndLinks(ns);
    graphsData.push(`ranksep = 1;`)
    graphsData.push('}');
    graphsData.push(`  label="cluster-level";style="invis";`);
    if (ns !== 'cluster-level') {
        getNodesAndLinks('cluster-level');
    }
    graphsData.push(`ranksep = 1;`)
    graphsData.push('}');
    graphsData.push('}');
    // build the string of DOT data and print if the show parameter is found
    for (let p = 0; p < graphsData.length; p++) {
        if (graphsPrintData) {
            console.log(`${graphsData[p]}`);
        }
        graphVizData = graphVizData + '   ' + graphsData[p];
    }
}

//-------------------------------------------------------------------------
// build all Subjects
function buildRules(data) {
    if (data === null) {
        return null;
    }

    let a, r, n, v, u;
    let rule = [];
    let rtn = '';
    let reducedRtn = '';
    let reducedRules = [];
    let maxReached;

    rule.push(`
    [fillcolor="#999999",fontsize="10",label=<`);

    rule.push(`	
    <table border="0" align="left">
      <tr>
        <td align="left" border="1" sides="b">ApiGroup</td>
        <td align="left" border="1" sides="b">Resources</td>
        <td align="left" border="1" sides="b">Names</td>
        <td align="left" border="1" sides="b">Verbs</td>
        <td align="left" border="1" sides="b">NonResourceURI</td>
      </tr>`);

    // parse array of rules and buiild table row for each  
    for (let s = 0; s < data.length; s++) {

        a = '';  // apiGroup
        r = '';  // resources
        n = '';  // resourceNames
        v = '';  // verbs
        u = '';  // nonResourceURLs

        if (typeof data[s].apiGroups !== 'undefined') {
            a = parseRulePart(data[s].apiGroups, 'a')
        } else {
            a = '*';
        }

        if (typeof data[s].resources !== 'undefined') {
            r = parseRulePart(data[s].resources)
        } else {
            r = '*';
        }

        if (typeof data[s].verbs !== 'undefined') {
            v = parseRulePart(data[s].verbs)
        } else {
            v = '*';
        }

        if (typeof data[s].resourceNames !== 'undefined') {
            n = parseRulePart(data[s].resourceNames)
        } else {
            n = '*';
        }

        if (typeof data[s].nonResourceURLs !== 'undefined') {
            u = parseRulePart(data[s].nonResourceURLs)
        }
        rule.push(`	  
        <tr>
		  <td align="left">${a}</td>
		  <td align="left">${r}</td>
		  <td align="left">${n}</td>
		  <td align="left">${v}</td>
		  <td align="left">${u}</td>
	    </tr>`)
    }
    rule.push(`</table>>, penwidth="1.0", shape="note"]`)


    for (let x = 0; x < rule.length; x++) {
        rtn = rtn + rule[x];
    }

    // build return data
    if (data.length > 36) {
        maxReached = true;
        for (let i = 0; i < 36; i++) {
            reducedRules.push(rule[i])
        }
        reducedRules.push(`
        <tr>
          <td colspan="5" align="center" bgcolor="#77DD77">${data.length - 35} rules not shown. Select above rule definition to view all rules</td>
        </tr>`)
        reducedRules.push(`
        </table>>,
        penwidth="1.0",shape="note"]`)
        reducedRtn = '';
        for (let x = 0; x < reducedRules.length; x++) {
            reducedRtn = reducedRtn + reducedRules[x];
        }
    } else {
        maxReached = false;
        reducedRules = '';
    }

    // for (let x = 0; x < rule.length; x++) {
    //     rtn = rtn + rule[x];
    // }
    return { 'maxReached': maxReached, 'reducedRules': reducedRtn, 'allRules': rtn }
}

//-------------------------------------------------------------------------
// parse rule part
function parseRulePart(data, part) {
    let rtn = '';
    let p;
    try {
        for (p = 0; p < data.length; p++) {
            if (typeof part !== 'undefined') {
                if (part === 'a') {
                    if (data[p] === '' || data[p].length === 0) {
                        data[p] = 'core';
                    }
                }
            }
            if (p === 0) {
                rtn = data[p];
            } else {
                rtn = rtn + ',' + data[p];
            }
        }
    } catch (err) {
        console.log(`Error in parseRulePart() - data: ${data[p]} ${err.message}`)
        return 'failed to parse';
    }
    return rtn;
}

//-------------------------------------------------------------------------
// build connections between subjects and bindings
function buildConnections(data, ns) {

    let subNS;
    let bindNS;
    let beginKey;
    let begin;
    let endKey;
    let end;
    let checkLinks = {}
    let checkSubjectBindings = {};

    for (let c = 0; c < data.length; c++) {
        if (typeof data[c] !== 'undefined') {
            // Build link between Subject and Binding
            begin = '';
            end = '';
            if (typeof data[c].subjectNS === 'undefined') {
                subNS = '<blank>';
            } else {
                subNS = data[c].subjectNS;
            }

            //  check for duplicate subject bindings    
            if (typeof checkSubjectBindings[`${data[c].subjectName}.${data[c].subjectKind}.${subNS}.${data[c].fnum}`] !== 'undefined') {
                continue;
            } else {
                checkSubjectBindings[`${data[c].subjectName}.${data[c].subjectKind}.${subNS}.${data[c].fnum}`] = 'Y';
            }

            try {
                beginKey = data[c].subjectName + '.' + data[c].subjectKind + '.' + subNS
                begin = nodeData[beginKey].node;
            } catch (err) {
                console.log(`buildConnections() Error locating subject connection: ${beginKey} message: ${err.message}`);
            }


            if (typeof data[c].ns !== 'undefined') {
                bindNS = data[c].ns;
            }
            if (typeof data[c].ns === 'undefined' && data[c].kind === 'ClusterRoleBinding') {
                bindNS = "<blank>";
            }
            key = data[c].name + '.' + data[c].kind + '.' + bindNS;
            endKey = data[c].name + '.' + data[c].kind + '.' + bindNS

            if (typeof nodeData[endKey] === 'undefined') {
                console.log(`buildConnections() Link Subject-Binding did not find endKey: ${endKey}`)
                return;
            }

            end = nodeData[endKey].node;


            if (begin !== '' && end !== '') {
                if (typeof checkLinks[`${begin}.${end}.${data[c].ns}`] === 'undefined') {
                    checkLinks[`${begin}.${end}.${data[c].ns}`]
                    connections.push({ 'link': begin + '->' + end + '[dir="back"]', 'ns': data[c].ns });
                }
            } else {
                console.log(`buildConnections() Failed to build subject to binding link
                    - begin: ${beginKey}
                    - end:   ${endKey}`)
            }

            // now use the binding as the start
            begin = end;
            end = '';

            if (typeof data[c].ns !== 'undefined') {
                roleNS = data[c].ns;
            }
            if (typeof data[c].ns === 'undefined' && data[c].kind === 'ClusterRoleBinding') {
                roleNS = "<blank>";
            }

            endKey = data[c].roleName + '.' + data[c].roleKind + '.' + roleNS;
            if (typeof nodeData[endKey] === 'undefined') {
                console.log(`buildConnections() Link Role-Binding did not find endKey: ${endKey}`)
                return;
            }

            end = nodeData[endKey].node;

            if (begin !== '' && end !== '') {
                if (typeof checkLinks[`${begin}.${end}.${data[c].ns}`] === 'undefined') {
                    checkLinks[`${begin}.${end}.${data[c].ns}`]
                    connections.push({ 'link': begin + '->' + end + '[dir="back"]', 'ns': data[c].ns });
                }

                //connections.push({ 'link': begin + '->' + end, 'ns': data[c].ns });
            } else {
                console.log(`buildConnections() Failed to build binding to role link'
                    - begin: ${beginKey}
                    - end:   ${endKey}`)

            }
        }
    }
}

//-------------------------------------------------------------------------
// build data for the digraph
function getNodesAndLinks(ns) {
    let nKeys;
    let nKey;
    let cKeys;
    let cKey;
    // node definitions
    nKeys = Object.keys(nodeData);
    for (let n = 0; n < nKeys.length; n++) {
        nKey = nKeys[n];
        if (nodeData[nKey].ns === ns) {
            graphsData.push('  ' + nodeData[nKey].node + nodeData[nKey].content + ';')
        }
    }

    // link definitions
    cKeys = Object.keys(connections);
    for (let c = 0; c < connections.length; c++) {
        cKey = cKeys[c]
        if (connections[cKey].ns === ns) {
            if (connections[c].ns === ns) {
                graphsData.push('  ' + connections[c].link + ';');
            }
        }
    }
}

function addNodeFnum(node, fnum) {
    if (typeof graphvNodeToFnum[node] === 'undefined') {
        graphvNodeToFnum[node] = fnum;
    }
}

function showNodeFnum(node) {
    if (typeof graphvNodeToFnum[node] !== 'undefined') {
        getDefFnum(graphvNodeToFnum[node]);
    } else {
        getDefFnum('missing');
    }
}

//-------------------------------------------------------------------------
// build all Subjects
function buildGraphSubjects(data, ns) {
    let subNS;
    let checkSubjects = {};
    for (let s = 0; s < data.length; s++) {
        // If subjectName is Missing change to create ar unique
        // name to it will graph as a single subject 
        if (typeof data[s] !== 'undefined') {
            if (data[s].subjectName === 'Missing') {
                missingSubjectCnt++;
                data[s].subjectName = 'Missing' + missingSubjectCnt++;
                if (data[s].kind === 'ClusterRoleBinding') {
                    data[s].subjectNS = 'Missing'
                    data[s].subjectKind = 'Missing'
                }
            }
            if (typeof checkSubjects[`${data[s].subjectNname}.${data[s].subjectKind}.${data[s].fnum}`] !== 'undefined') {
                console.log(`buildGraphSubjects() Found dup subject: ${data[s].subjectName} . ${data[s].subjectKind} . ${data[s].fnum}`)
                continue;
            } else {
                checkSubjects[`${data[s].subjectName}.${data[s].subjectKind}.${data[s].fnum}`] = 'Y';
            }

            if (typeof data[s].subjectNS === 'undefined') {
                subNS = '<blank>';
            } else {
                subNS = data[s].subjectNS;
            }

            key = data[s].subjectName + '.' + data[s].subjectKind + '.' + subNS
            if (typeof nodeData[key] === 'undefined') {
                nodeNum++;
                nodeData[key] = {
                    'node': 'S' + nodeNum,
                    //'content': setNodeContent('Subject', data[s].subjectName, data[s].subjectKind),
                    'content': setNodeContent('Subject', data[s].subjectName, data[s].subjectKind),
                    'fnum': data[s].fnum,
                    'ns': data[s].ns
                }
                addNodeFnum('S' + nodeNum, data[s].fnum);
            }
        }
    }
}

//-------------------------------------------------------------------------
// build all Bindings 
function buildGraphBindings(data, ns) {
    let bindNS;
    let checkBinds = {};
    try {
        for (let b = 0; b < data.length; b++) {
            if (typeof data[b] !== 'undefined') {
                if (typeof checkBinds[`${data[b].name}.${data[b].kind}.${data[b].fnum}`] !== 'undefined') {
                    continue;
                } else {
                    checkBinds[`${data[b].name}.${data[b].kind}.${data[b].fnum}`] = 'Y';
                }

                if (typeof data[b].ns !== 'undefined') {
                    bindNS = data[b].ns;
                }
                if (typeof data[b].ns === 'undefined' && data[b].kind === 'ClusterRoleBinding') {
                    bindNS = "<blank>";
                }

                key = data[b].name + '.' + data[b].kind + '.' + bindNS;
                if (typeof nodeData[key] === 'undefined') {
                    nodeNum++;
                    nodeData[key] = {
                        'node': 'B' + nodeNum,
                        'content': setNodeContent('Binding', data[b].name, data[b].kind),
                        'fnum': data[b].fnum,
                        'ns': data[b].ns
                    }
                    addNodeFnum('B' + nodeNum, data[b].fnum);
                }
            }
        }
    } catch (e) {
        console.log(`buildGraphBindings() Error: ${e}`);
        console.log(`Error stack: ${e.stack}`);
    }
}

//-------------------------------------------------------------------------
// build all Roles nodes
function buildGraphRoles(data, ns) {
    let roleNS;
    let rules;
    let key;
    let begin;
    let end
    let checkRoles = {};
    let beginFnum;
    // FNUM FIX
    let fnum;

    for (let r = 0; r < data.length; r++) {

        if (typeof data[r] !== 'undefined') {
            beginFnum = ''
            if (typeof checkRoles[`${data[r].name}.${data[r].kind}.${data[r].fnum}`] !== 'undefined') {
                continue;
            } else {
                checkRoles[`${data[r].name}.${data[r].kind}.${data[r].fnum}`] = 'Y';
            }

            if (typeof data[r].ns !== 'undefined') {
                roleNS = data[r].ns;
            }
            if (typeof data[r].ns === 'undefined' && data[r].kind === 'ClusterRoleBinding') {
                roleNS = "<blank>";
            }
            key = data[r].roleName + '.' + data[r].roleKind + '.' + roleNS;
            if (typeof nodeData[key] === 'undefined') {
                nodeNum++;
                nodeData[key] = {
                    'node': 'R' + nodeNum,
                    'content': setNodeContent('Role', data[r].roleName, data[r].roleKind, fnum, 'R' + nodeNum),
                    'fnum': data[r].roleFnum,
                    'ns': data[r].ns
                }
                addNodeFnum('R' + nodeNum, data[r].roleFnum);
                begin = 'R' + nodeNum;
                beginFnum = data[r].roleFnum
            }

            // build rule information
            if (typeof data[r].rules !== 'undefined') {
                let holdRules;
                let returnData;
                key = data[r].roleName + '.' + data[r].roleKind + '.' + roleNS + '.RULE';
                if (typeof nodeData[key] === 'undefined') {
                    returnData = buildRules(data[r].rules);
                    if (returnData === null) {
                        console.log(`buildGraphRoles() Null rules for role: ${data[r].roleName} namespace: ${roleNS}`)
                        continue;
                    }

                    graphvizMaxReached = returnData.maxReached;

                    if (graphvizMaxReached) {
                        holdRules = returnData.allRules;
                        rules = returnData.reducedRules;
                    } else {
                        rules = returnData.allRules;
                    }

                    nodeNum++;
                    nodeData[key] = {
                        'node': 'RULES' + nodeNum,
                        'content': rules,
                        'fnum': data[r].roleFnum,
                        'ns': data[r].ns
                    }
                    if (graphvizMaxReached) {
                        largeRuleSets[key] = holdRules;
                    }
                    end = 'RULES' + nodeNum;
                    connections.push({ 'link': begin + '->' + end + '[dir="back"]', 'ns': data[r].ns });
                    addNodeFnum('RULES' + nodeNum, data[r].roleFnum);

                    // check if the maximum number of rules are shown
                    if (graphvizMaxReached) {
                        begin = end;   //save the rules node id 
                        let content = `[
                    fillcolor="#ff0000",
                    fontcolor="red",
                    fontsize="16",
                    label=<Total rules: ${data[r].rules.length}>,
                    penwidth="1.0",
                    shape="component"]`
                        key = data[r].roleName + '.' + data[r].roleKind + '.' + roleNS + data[r].roleKind + data[r].fnum + '.MAXRULES';
                        nodeNum++;
                        if (typeof nodeData[key] === 'undefined') {
                            nodeData[key] = {
                                'node': 'MAXRULES' + nodeNum,
                                'content': content,
                                'fnum': data[r].roleFnum,
                                'ns': data[r].ns
                            }
                            connections.push({ 'link': begin + '->' + 'MAXRULES' + nodeNum + '[dir="back"]', 'ns': data[r].ns });
                        }
                        // graphvNodeToFnum[node] === 'undefined') {
                        addNodeFnum('MAXRULES' + nodeNum, data[r].roleFnum);
                    }
                }
            }
        }
    }
}

//-------------------------------------------------------------------------
// create the d3/graphviz graph
// function createGraph() {
//     let height = '150000pt';
//     // clear the div that contains the 
//     document.getElementById('vizWrapper').innerHTML = '';
//     document.getElementById('vizWrapper').innerHTML = '<div id="secViz" style="text-align: center;"></div>'
//     let viz = d3.select("#secViz");
//     viz
//         .graphviz({ useWorker: false })
//         .zoom(true)
//         .height(height)
//         .renderDot(graphVizData)
//         .on("end", addGraphvizOnClick);
// }

function createGraph() {
    const wrapper = document.getElementById('vizWrapper');
    const estimatedHeight = Math.min(8000, Math.max(2000, secData.length * 20)); // Dynamically scale height
    const height = `${estimatedHeight}pt`;

    try {
        // Clean up previous graph if exists
        try {
            d3.select("#secViz").graphviz().transition().remove();
        } catch (e) {
            // Safe to ignore if this is first render
        }

        // Rebuild container div
        d3.selectAll('.node,.edge').on('click', null);
        wrapper.innerHTML = '<div id="secViz" style="text-align: center;"></div>';

        // Render the new graph
        d3.select("#secViz")
            .graphviz({ useWorker: false })
            .zoom(secData.length < 500)  // Enable zoom only for small graphs
            .height(height)
            .renderDot(graphVizData)
            .on("end", addGraphvizOnClick);
    } catch (err) {
        console.error(`createGraph error: ${err.message}`);
        console.error(err.stack);
    }

    if (!secVizInitialized) {
        const canvas = document.getElementById('secViz');
        if (canvas) {
            canvas.addEventListener('webglcontextlost', function (e) {
                console.warn('🚨 WebGL context lost in secViz', e);
            }, false);
            secVizInitialized = true;
        }
    }
    

}


function addGraphvizOnClick() {
    let nodes = d3.selectAll('.node,.edge');
    nodes
        .on("click", function () {
            var title = d3.select(this).selectAll('title').text().trim();
            if (title.startsWith('RN')) {
                // skip
            } else {
                showNodeFnum(title)
            }
        });
    $('#statusProcessing').hide();
}

//-------------------------------------------------------------------------
// create the node information for subject, binding, and role
function setNodeContent(type, name, kind) {
    let color;
    let fill;
    let shape;
    let lbl = '';
    let margin = '';

    if (type === 'Subject') {
        shape = 'box';
        lbl = "\\n(" + kind + ")";
        // margin = 'margin="0.22,0.11"';
        margin = 'margin="0.3,0.11"';
        color = "#ffffff";
        switch (kind) {
            case 'ServiceAccount':
                fill = "#17a2b8";
                break;
            case 'Group':
                fill = "#f0ad4e";
                break;
            case 'User':
                fill = "#dc3545";
                break;
            case 'SystemUser':
                fill = "#6c757d";
                break;
            case 'SystemGroup':
                fill = "#007bff";
                break;
            case 'Missing':
                fill = "#0000ff";
                break;
            default:
                fill = "#000000"
        }
    }

    if (type === 'Binding') {
        shape = 'oval';
        switch (kind) {
            case 'RoleBinding':
                fill = "#016601";
                color = "#ffffff";
                break;
            case 'ClusterRoleBinding':
                fill = "#6e03d3";
                color = "#ffffff";
                break;
            default:
                fill = "#000000";
                color = "ffffff";
        }
    }

    if (type === 'Role') {
        shape = 'hexagon';
        switch (kind) {
            case 'Role':
                fill = "#3ad35d";
                color = "#000000";
                break;
            case 'ClusterRole':
                fill = "#dec4f7";
                color = "#000000";
                break;
            default:
                fill = "#000000";
                color = "ffffff";
        }
    }

    if (name.startsWith('Missing')) {
        name = '<not defined>'
    }


    return `[color="${color}",
    fillcolor="${fill}",
    fontcolor="white",
    fontname="Times 100",
    label="${name + lbl}",
    penwidth="1.0",
    shape="${shape}",
    style="filled",
    ${margin}]`;

}

function showSecGraph(ns) {
    try {
        $("#security-ns-filter").val(ns).trigger('change');
    } catch (e) {
        // continue even if error occurs
    }
    $('.nav-tabs a[href="#security"]').tab('show');
    getSecurityViewData(ns);
}

function securityFilterShow() {
    if (typeof secData === 'undefined') {
        showMessage('Filtering requires a selected namespace it cannot be blank.')
        return;
    } else {
        $("#securityFilterModal").modal('show')
    }
}

function checkSelectedCategory() {
    let category = ''
    if ($("#filterSecuritySubject").is(":checked")) {
        category = 'S'
    } else if ($("#filterSecurityBinding").is(":checked")) {
        category = 'B'
    } else if ($("#filterSecurityRole").is(":checked")) {
        category = 'R'
    }
    getSecurityNames(category)
}

function applySecurityFilter() {
    securitySelectedNameData = [];
    let pickedData = [];
    try {
        for (let i = 0; i < securityNamesData.length; i++) {
            if (securityNamesData[i].state === true) {
                securitySelectedNameData.push(securityNamesData[i].id)
            }
        }
        for (let i = 0; i < secDataOrig.length; i++) {
            if (securitySelectedNameData.includes(secDataOrig[i].fnum)) {
                pickedData.push(secDataOrig[i])
            }
        }

        reset();
        secData = pickedData;
        $("#securityFilterModal").modal('hide')
        buildAll();

    } catch (e) {

    }
}

function clearSecurityFilters() {
    reset();
    secData = secDataOrig;
    $("#securityFilterModal").modal('hide')
    buildAll();
}



//----------------------------------------------------------
// send request to server to get security data for a specific
// namespace
function getSecurityViewData(namespace) {
    let ns;
    let option
    if (typeof namespace === 'undefined' || namespace === null) {
        option = $('#security-ns-filter').select2('data');
        ns = option[0].text;
        ns = ns.trim();
        if (ns.text === '' || ns.length === 0) {
            showMessage('Select a namespace it cannot be blank.')
            return;
        }
    } else {
        ns = namespace;
    }

    if (ns === '<cluster-level>') {
        ns = 'cluster-level';
    }
    $("#secViz").empty();
    $("#secViz").html('');
    $('#statusProcessing').show();
    //showMessage('Processing Security request', 'info');
    setTimeout(function () {
        socket.emit('getSecurityViewData', ns);;
    }, 1000);

}
//...
socket.on('getSecurityViewDataResult', function (data) {
    buildSecGraph(data);      // vpkSecGraph.js
});
//==========================================================

// Open and close the legend on the Security tab
function viewSecurityLegend() {
    $("#securityLegendModal").modal('show');
}


//----------------------------------------------------------
console.log('loaded vpkTabSecurity.js');