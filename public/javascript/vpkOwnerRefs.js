/*
Copyright (c) 2018-2023 k8sVisual

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

//-------------------------------------------------------------------------
// Owner reference variables to create graph
let oRefData = [];
let oRefNS = [];
let clusterCntORef = 0;
let connectionsORef = [];
let nodeDataORef = {};
let graphVizDataORef = '';
let graphsDataORef = [];
let graphvNodeToFnumORef = {};
let uidLookupORef = {};
let fnumLookupORef = {};
let nodeNumORef = 0;
let nsORefSelected = "";
let optionsORef = "";
let oRefLinks = [];     // Data from server via websocket call

//-------------------------------------------------------------------------
// invoked when the button on the UI is pressed
function getOwnerRefViewData() {
    let ns;
    hideMessage();
    oRefData = [];
    oRefNS = [];
    optionsORef = $('#ownerRef-ns-filter').select2('data');
    //for (let i = 0; i < optionsORef.length; i++) {
    ns = optionsORef[0].text;
    ns = ns.trim();
    if (ns.text === '' || ns.length === 0) {
        showMessage('Select a namespace it cannot be blank.')
    }
    // save which namespaces to report
    oRefNS.push(ns);
    nsORefSelected = ns;

    // Reset variables 
    clusterCntORef = 0;
    connectionsORef = [];
    nodeDataORef = {};
    graphVizDataORef = '';
    graphsDataORef = [];
    graphvNodeToFnumORef = {};
    graphsPrintData = true;       // Set to true will print the graphViz data
    uidLookupORef = {};
    fnumLookupORef = {};
    nodeNumORef = 0;
    optionsORef = "";
    // get started processing
    filterDataORef()
}

//-------------------------------------------------------------------------
// reduce the data to only the requested namespace
function filterDataORef() {
    let ns;
    try {
        for (let i = 0; i < oRefLinks.length; i++) {
            if (oRefNS.includes(oRefLinks[i].ns)) {
                oRefData.push(oRefLinks[i]);
            }
        }
        buildAllORef();
    } catch (e) {
        console.log('Error in ownerRefLinks reducing the data, message: ' + e.message);
        return;
    }
}

//-------------------------------------------------------------------------
// build lookup table with uid and the associated nodeID
function buildAllORef() {
    if (oRefData.length === 0) {
        console.log('Nothing')
        document.getElementById('oRefWrapper').innerHTML = '<div class="mt-5 ml-5 vpkfont vpkcolor">No data located for requested namespace</div>';
        return;
    }
    buildNodesORef();
    buildConnectionsORef();
    buildDOTDataORef(nsORefSelected);            // add and second parm and each line of DOT data will print to console
    createGraphORef();
}

//-------------------------------------------------------------------------
// build lookup table with uid and the associated nodeID
// along the building the lookup for nodeID TO fnum
function uidToNode(uid, fnum) {
    if (typeof uidLookupORef[uid] !== 'undefined') {
        return uidLookupORef[uid]
    } else {
        nodeNumORef++;
        uidLookupORef[uid] = 'N' + nodeNumORef;
        fnumLookupORef['N' + nodeNumORef] = fnum;
        return uidLookupORef[uid];
    }
}

//-------------------------------------------------------------------------
// build all node entiies (boxes shown in graph) 
function buildNodesORef() {
    let child;
    let parent;
    for (let i = 0; i < oRefData.length; i++) {
        // Handle child
        if (typeof nodeDataORef[oRefData[i].child] === 'undefined') {
            child = uidToNode(oRefData[i].child, oRefData[i].childFnum)
            nodeDataORef[child] = {
                'node': child,
                'content': setNodeContentORef(oRefData[i].childName, oRefData[i].childKind),
                'fnum': oRefData[i].childFnum,
                'ns': oRefData[i].ns
            }
            //addNodeFnum(child, oRefData[i].fnum);
        }
        // Handle parent
        if (typeof nodeDataORef[oRefData[i].parent] === 'undefined') {
            parent = uidToNode(oRefData[i].parent, oRefData[i].parentFnum)
            nodeDataORef[parent] = {
                'node': parent,
                'content': setNodeContentORef(oRefData[i].parentName, oRefData[i].parentKind),
                'fnum': oRefData[i].parentFnum,
                'ns': oRefData[i].ns
            }
            //addNodeFnum(parent, oRefData[i].fnum);
        }
    }
}

//-------------------------------------------------------------------------
// build the Links for the viz graph and save in the connections object
function buildConnectionsORef() {
    let child;
    let parent;
    for (let i = 0; i < oRefData.length; i++) {
        child = uidToNode(oRefData[i].child, oRefData[i].childFnum);
        parent = uidToNode(oRefData[i].parent, oRefData[i].parentFnum);
        connectionsORef.push({ 'link': parent + '->' + child, 'ns': oRefData[i].ns })
    }
}

//-------------------------------------------------------------------------
// build the DOT formatted data that will be used to create the digraph 
function buildDOTDataORef(ns) {
    // build the DOT data array
    graphsDataORef = [];
    graphVizDataORef = '';
    graphsDataORef.push(`digraph { `);
    graphsDataORef.push(`subgraph cluster_${clusterCntORef++} {`);   // Namespace & ClusterLevel
    graphsDataORef.push(`subgraph cluster_${clusterCntORef++} {`);   // Namespace
    graphsDataORef.push(`  label="${'  ' + ns + '  '}";fontname="Times 100";fontsize="25.00";style="rounded, dashed";`);

    getNodesAndLinksORef();

    graphsDataORef.push(`  ranksep = 1;   }`)
    graphsDataORef.push(`  label="cluster-level";style="invis";ranksep = 1; } }`);

    for (let p = 0; p < graphsDataORef.length; p++) {
        if (graphsPrintData) {
            console.log(graphsDataORef[p]);
        }
        graphVizDataORef = graphVizDataORef + '   ' + graphsDataORef[p];
    }
}

//-------------------------------------------------------------------------
// build data for the digraph from the two objects that contain the nodes
// and links
function getNodesAndLinksORef() {
    let nKeys;
    let nKey;
    let cKeys;
    let cKey;
    // node definitions
    nKeys = Object.keys(nodeDataORef);
    for (let n = 0; n < nKeys.length; n++) {
        nKey = nKeys[n];
        graphsDataORef.push('  ' + nodeDataORef[nKey].node + nodeDataORef[nKey].content + ';')
    }
    // link definitions
    cKeys = Object.keys(connectionsORef);
    for (let c = 0; c < connectionsORef.length; c++) {
        cKey = cKeys[c]
        graphsDataORef.push('  ' + connectionsORef[cKey].link + ';');
    }
}

//-------------------------------------------------------------------------
// code that runs when a box in the viz graph is selected
function showNodeFnumORef(node) {
    if (typeof fnumLookupORef[node] !== 'undefined') {
        let fnum = fnumLookupORef[node]
        getDefFnum(fnum);
    } else {
        getDefFnum('missing');
    }
}

//-------------------------------------------------------------------------
// create the d3/graphviz graph
function createGraphORef() {
    try {
        let height = '150000pt';
        // clear the div that contains the 
        document.getElementById('oRefWrapper').innerHTML = '';
        document.getElementById('oRefWrapper').innerHTML = '<div id="oRefViz" style="text-align: center;"></div>'
        let viz = d3.select("#oRefViz");
        viz
            .graphviz({ useWorker: false })
            .zoom(true)
            .height(height)
            .renderDot(graphVizDataORef)
            .on("end", addGraphvizOnClickORef);
    } catch (e) {
        console.log(`createGraph`)
    }
}

//-------------------------------------------------------------------------
// gets added to the generated viz graph
function addGraphvizOnClickORef() {
    let nodes = d3.selectAll('.node,.edge');
    nodes
        .on("click", function () {
            var title = d3.select(this).selectAll('title').text().trim();
            showNodeFnumORef(title)
        });
}

//-------------------------------------------------------------------------
// create the viz node information 
function setNodeContentORef(name, kind) {
    let color;
    let fill;
    let shape;
    let oKind = '';
    let margin = '';

    shape = 'box';
    oKind = "\\n(" + kind + ")";

    margin = 'margin="0.3,0.11"';
    color = "#ffffff";
    switch (kind) {
        case 'Pod':
            fill = "#17a2b8";
            break;
        case 'Deployment':
            fill = "#dab894";
            break;
        case 'ReplicaSet':
            fill = "#dc3545";
            break;
        case 'ConfigMap':
            fill = "#cc89d6";
            break;
        case 'Secret':
            fill = "#5b9877";
            break;
        case 'ClusterServiceVersion':
            fill = "#d5aaff";
            break;
        case 'Service':
            fill = "#afcbff";
            break
        case 'Certificate':
            fill = "#6eb5ff";
            break
        case 'ServiceAccount':
            fill = "#aff8d8";
            break
        case 'RoleBinding':
            fill = "#f6aa90";
            break
        case 'Role':
            fill = "#fbd206";
            break
        case 'EndpointSlice':
            fill = "#feaf8a";
            break
        case 'Route':
            fill = "#fd7a8c";
            break
        case 'StatefulSet':
            fill = "#99f692";
            break
        case 'DaemonSet':
            fill = "#77bad4";
            break
        case 'Job':
            fill = "#b4547c";
            break
        case 'CertificateRequest':
            fill = "#6eb566";
            break
        case 'ControllerRevision':
            fill = "#fbd206";
            break
        case 'Node':
            fill = "#804040";
            break
        case 'Lease':
            fill = "#c06c84";
            break

        default:
            fill = "#000000"
    }

    if (name.startsWith('Missing')) {
        name = '<not defined>'
    }
    name = "&nbsp;" + name + "&nbsp;";
    return `[color="${color}",
    fillcolor="${fill}",
    fontcolor="white",
    fontname="Times 100",
    label="${name + oKind}",
    penwidth="1.0",
    shape="${shape}",
    style="filled",
    ${margin}]`;

}


function examplesORef() {

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
console.log('loaded vpkOwnerRefLinks2.js');
