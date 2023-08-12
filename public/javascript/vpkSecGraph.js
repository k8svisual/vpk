/*
Copyright (c) 2018-2022 K8Debug

Permission is hereby granted, free of charge, to any person obtaining a copy of this software
and associated documentation files (the "Software"), to deal in the Software without restriction,
including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense,
and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so,
data to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial
portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT
LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/


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

//=========================================

function buildSecGraph(content) {

    nodeNum = 0;
    digraphClusterCnt = 0;
    graphVizData = '';
    nodeData = {};
    graphsData = [];
    connections = [];
    graphvNodeToFnum = {};
    missingSubjectCnt = 0;   // gets appended to subject Missing to create a unique subject name

    let data = content.data;
    let ns = content.ns

    if (data.length === 0) {
        console.log('Nothing')
        document.getElementById('vizWrapper').innerHTML = '<div class="mt-5 ml-5 vpkfont vpkcolor">No data for requested namespace: <span class="vpkfont-lg">' + ns + '</span></div>';
        return;
    }


    buildGraphSubjects(data, ns);
    buildGraphBindings(data, ns);
    buildGraphRoles(data, ns);
    buildConnections(data, ns);
    buildDOTData(ns);            // add and second parm and each line of DOT data will print to console
    createGraph();

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
            console.log(graphsData[p]);
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
    rule.push(`
    </table>>,
    penwidth="1.0",shape="note"]`)


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
    } catch (e) {
        console.log('Error in parseRulePart - data: ' + data[p] + '  mag: ' + err.message)
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
            //console.log(`Found dup binding: ${data[c].subjectName}.${data[c].subjectKind}.${subNS}.${data[c].fnum}`)
            continue;
        } else {
            checkSubjectBindings[`${data[c].subjectName}.${data[c].subjectKind}.${subNS}.${data[c].fnum}`] = 'Y';
        }

        try {
            beginKey = data[c].subjectName + '.' + data[c].subjectKind + '.' + subNS
            begin = nodeData[beginKey].node;
        } catch (e) {
            console.log(`Error locating subject connection: ${beginKey}`);
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
            console.log('Link Subject-Binding did not find endKey: ' + endKey)
            return;
        }

        end = nodeData[endKey].node;


        if (begin !== '' && end !== '') {
            if (typeof checkLinks[`${begin}.${end}.${data[c].ns}`] === 'undefined') {
                checkLinks[`${begin}.${end}.${data[c].ns}`]
                connections.push({ 'link': begin + '->' + end + '[dir="back"]', 'ns': data[c].ns });
            }
        } else {
            console.log('Failed to build subject to binding link\n'
                + '- begin: ' + beginKey + '\n'
                + '- end: ' + endKey)
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
            console.log('Link Role-Binding did not find endKey: ' + endKey)
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
            console.log('Failed to build binding to role link\n'
                + '- begin: ' + beginKey + '\n'
                + '- end: ' + endKey)
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
    } else {
        console.log(`Node: ${node} already exists.`)
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
        if (data[s].subjectName === 'Missing') {
            missingSubjectCnt++;
            data[s].subjectName = 'Missing' + missingSubjectCnt++;
            if (data[s].kind === 'ClusterRoleBinding') {
                data[s].subjectNS = 'Missing'
                data[s].subjectKind = 'Missing'
            }
        }


        if (typeof checkSubjects[`${data[s].subjectNname}.${data[s].subjectKind}.${data[s].fnum}`] !== 'undefined') {
            console.log(`Found dup subject: ${data[s].subjectName} . ${data[s].subjectKind} . ${data[s].fnum}`)
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

//-------------------------------------------------------------------------
// build all Bindings 
function buildGraphBindings(data, ns) {
    let bindNS;
    let checkBinds = {};
    for (let b = 0; b < data.length; b++) {

        if (typeof checkBinds[`${data[b].name}.${data[b].kind}.${data[b].fnum}`] !== 'undefined') {
            //console.log(`Found dup binding: ${data[b].name} . ${data[b].kind} . ${data[b].fnum}`)
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

    for (let r = 0; r < data.length; r++) {

        beginFnum = ''
        if (typeof checkRoles[`${data[r].name}.${data[r].kind}.${data[r].fnum}`] !== 'undefined') {
            //console.log(`Found dup role: ${data[r].name} . ${data[r].kind} . ${data[r].fnum}`)
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
                    console.log(`Null rules for role: ${data[r].roleName} namespace: ${roleNS}`)
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
                }
            }
        }
    }
}

//-------------------------------------------------------------------------
// create the d3/graphviz graph
function createGraph() {
    let height = '150000pt';
    // clear the div that contains the 
    document.getElementById('vizWrapper').innerHTML = '';
    document.getElementById('vizWrapper').innerHTML = '<div id="secViz" style="text-align: center;"></div>'
    let viz = d3.select("#secViz");
    viz
        .graphviz({ useWorker: false })
        .zoom(true)
        .height(height)
        .renderDot(graphVizData)
        .on("end", addGraphvizOnClick);
}

function addGraphvizOnClick() {
    let nodes = d3.selectAll('.node,.edge');
    nodes
        .on("click", function () {
            var title = d3.select(this).selectAll('title').text().trim();
            // var text = d3.select(this).selectAll('text').text();
            // var id = d3.select(this).attr('id');
            // var class1 = d3.select(this).attr('class');
            // dotElement = title.replace('->', ' -> ');
            // console.log('Element id="%s" class="%s" title="%s" text="%s" dotElement="%s"', id, class1, title, text, dotElement);
            if (title.startsWith('RN')) {
                // skip
            } else {
                showNodeFnum(title)
            }
        });
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
        //document.getElementById("security-ns-filter").value = val;
        //$('#security-ns-filter').change();
        //$("#select2").val(value).trigger('change');
    } catch (e) {
        // continue even if error occurs
    }
    $('.nav-tabs a[href="#security"]').tab('show');
    getSecurityViewData(ns);
}


function examples() {

    let source = `https://stackoverflow.com/questions/67626414/scale-and-center-d3-graphviz-graph`
    // https://stackoverflow.com/questions/67626414/scale-and-center-d3-graphviz-graph
    // function attributer(datum, index, nodes) {
    //     var selection = d3.select(this);
    //     if (datum.tag == "svg") {
    //         datum.attributes = {
    //             ...datum.attributes,
    //             width: '100%',
    //             height: '100%',
    //         };
    //         // svg is constructed by hpcc-js/wasm, which uses pt instead of px, so need to convert
    //         const px2pt = 3 / 4;

    //         // get graph dimensions in px. These can be grabbed from the viewBox of the svg
    //         // that hpcc-js/wasm generates
    //         const graphWidth = datum.attributes.viewBox.split(' ')[2] / px2pt;
    //         const graphHeight = datum.attributes.viewBox.split(' ')[3] / px2pt;

    //         // new viewBox width and height
    //         const w = graphWidth / scale;
    //         const h = graphHeight / scale;

    //         // new viewBox origin to keep the graph centered
    //         const x = -(w - graphWidth) / 2;
    //         const y = -(h - graphHeight) / 2;

    //         const viewBox = `${x * px2pt} ${y * px2pt} ${w * px2pt} ${h * px2pt}`;
    //         selection.attr('viewBox', viewBox);
    //         datum.attributes.viewBox = viewBox;
    //     }
    // }

    // <div id="graph" style="width: 300px; height: 300px; border: 1px solid black"></div>

    // d3.select("#graph").graphviz()
    //     .attributer(attributer)
    //     .renderDot('digraph  {a -> b -> c ->d -> e}');


}

//----------------------------------------------------------
console.log('loaded vpkSecGraph.js');
