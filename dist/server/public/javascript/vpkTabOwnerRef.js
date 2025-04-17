/*
Copyright (c) 2018-2023 Dave Weilert

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
// Owner reference variables to create ownerRef view
let ownerRefExist = {};
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
let nsORefSelected = '';
let optionsORef = '';
let oRefLinks = [];

let selectedKinds = [];
let oRefKindsData = [];
let oRefNamesData = [];
let oRef = '';

//Invoked when Cluster tab 'View OwnerRef' button pressed
function showOwnRef(oRefFnum, oRefNameSpace, oRefKind, where) {
    returnWhere = where; // Always set to Cluster
    hideMessage();
    oRefData = [];
    oRefNS = [];
    oRefNamesData = [];
    $('#ownerRef-kind-filter').select2({
        dropdownCssClass: 'vpkselect2',
        selectionCssClass: 'vpkselect2',
        placeholder: 'select kinds(s), default is ALL kinds',
        multiple: false,
        width: 300,
    });
    populateORefKinds([]);
    $('#tableORef').bootstrapTable('load', oRefNamesData);
    $('#tableORef').bootstrapTable('hideColumn', 'id');
    clusterORefRequest(oRefFnum, oRefNameSpace, oRefKind);
}

function openTabOwnerRef() {
    $('[href="#ownerlinks"]').tab('show');
}

//-------------------------------------------------------------------------
// Invoked when the OwnerRef button on the OwnerRef tab is pressed
function getOwnerRefData() {
    let ns;
    hideMessage();
    oRefData = [];
    oRefNS = [];
    // Get the namespaces selected from the drop down field
    optionsORef = $('#ownerRef-ns-filter').select2('data');
    ns = optionsORef[0].text;
    ns = ns.trim();
    if (ns.text === '' || ns.length === 0) {
        showMessage('Select a namespace it cannot be blank.');
        return;
    }
    // Save which namespaces to report
    oRefNS.push(ns);
    nsORefSelected = ns;

    $('#statusProcessing').show();
    // Reset a variables
    resetVars();
    // get started processing
    filterDataORef();
    findORefKinds();
}

function resetVars() {
    // Reset variables
    clusterCntORef = 0;
    connectionsORef = [];
    nodeDataORef = {};
    graphVizDataORef = '';
    graphsDataORef = [];
    graphvNodeToFnumORef = {};
    graphsPrintData = false; // Set to true will print the graphViz data
    uidLookupORef = {};
    fnumLookupORef = {};
    nodeNumORef = 0;
    optionsORef = '';
}

//-------------------------------------------------------------------------
// Reduce the data to only the requested namespace
function filterDataORef() {
    let ns;
    try {
        $('#oRefSelectedNS').html(oRefNS[0]);
        for (let i = 0; i < oRefLinks.length; i++) {
            if (oRefNS.includes(oRefLinks[i].ns)) {
                oRefData.push(oRefLinks[i]);
            }
        }
        buildAllORef(false); // false = not a Cluster OwnerRef request
    } catch (err) {
        console.log(`Error in reducing the ownerRefLinks data, message: ${err.message}`);
        console.log(`Error stack: ${err.stack}`);
        return;
    }
}

//-------------------------------------------------------------------------
// Reduce the data to only the requested namespace
function findORefKinds() {
    let oRefKinds = [];
    try {
        for (let i = 0; i < oRefData.length; i++) {
            if (oRefKinds.includes(oRefData[i].childKind)) {
                //
            } else {
                oRefKinds.push(oRefData[i].childKind);
            }
        }
        populateORefKinds(oRefKinds);
    } catch (err) {
        console.log(`Error in reducing the ownerRefLinks data, message: message: ${err.message}`);
        console.log(`Error stack: ${err.stack}`);
        return;
    }
}

// Build the OwnerRef for the selcted item from the Cluster view button press
function clusterORefRequest(oRefFnum, oRefNameSpace, oRefKind) {
    try {
        for (let i = 0; i < oRefLinks.length; i++) {
            if (oRefLinks[i].ns === oRefNameSpace) {
                if (oRefKind === 'Endpoints' || oRefKind === 'EndpointSlice') {
                    if (oRefLinks[i].childKind.startsWith('Endpoint') === oRefKind) {
                        if (oRefLinks[i].childFnum === oRefFnum) {
                            oRefData.push(oRefLinks[i]);
                            //parents.push(oRefLinks[i].parent)
                            checkChild(oRefLinks[i].parent);
                        }
                    }
                } else {
                    if (oRefLinks[i].childKind === oRefKind) {
                        if (oRefLinks[i].childFnum === oRefFnum) {
                            oRefData.push(oRefLinks[i]);
                            //parents.push(oRefLinks[i].parent)
                            checkChild(oRefLinks[i].parent);
                        }
                    }
                }
            }
        }
        resetVars();
        nsORefSelected = oRefNameSpace;
        buildAllORef(true); // true = this is a Cluster view button click OwnerRef request
    } catch (err) {
        console.log(`Error in ownerRefLinks reducing the data, message: message: ${err.message}`);
        console.log(`Error stack: ${err.stack}`);
        return;
    }
}

function checkChild(child) {
    let stay = true;
    let value;
    let cnt = 0;
    while (stay === true) {
        cnt++;
        value = getParents(child, cnt);
        if (value === '') {
            stay = false;
        } else {
            child = value;
        }
    }
}

// Find the parent a a child OwnerRef
function getParents(child, cnt) {
    try {
        for (let i = 0; i < oRefLinks.length; i++) {
            if (oRefLinks[i].child === child) {
                oRefData.push(oRefLinks[i]);
                if (oRefLinks[i].parent !== '') {
                    return oRefLinks[i].parent;
                }
            }
        }
        return ''; // Indicates there is no Parent
    } catch (err) {
        console.log(`Error in ownerRefLinks reducing the data, message: message: ${err.message}`);
        console.log(`Error stack: ${err.stack}`);
        return;
    }
}

//-------------------------------------------------------------------------
// build lookup table with uid and the associated nodeID
function buildAllORef(clusterORef) {
    if (oRefData.length === 0) {
        document.getElementById('oRefWrapper').innerHTML = '<div class="mt-5 ml-5 vpkfont vpkblue">No data located for requested namespace</div>';
        return;
    }
    buildNodesORef();
    buildConnectionsORef();
    buildDOTDataORef(nsORefSelected);
    createGraphORef(clusterORef);
}

//-------------------------------------------------------------------------
// build lookup table with uid and the associated nodeID
// along the building the lookup for nodeID TO fnum
function uidToNode(uid, fnum) {
    if (typeof uidLookupORef[uid] !== 'undefined') {
        return uidLookupORef[uid];
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
            child = uidToNode(oRefData[i].child, oRefData[i].childFnum);
            nodeDataORef[child] = {
                node: child,
                content: setNodeContentORef(oRefData[i].childName, oRefData[i].childKind),
                fnum: oRefData[i].childFnum,
                ns: oRefData[i].ns,
            };
        }
        // Handle parent
        if (typeof nodeDataORef[oRefData[i].parent] === 'undefined') {
            parent = uidToNode(oRefData[i].parent, oRefData[i].parentFnum);
            nodeDataORef[parent] = {
                node: parent,
                content: setNodeContentORef(oRefData[i].parentName, oRefData[i].parentKind),
                fnum: oRefData[i].parentFnum,
                ns: oRefData[i].ns,
            };
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
        connectionsORef.push({ link: parent + '->' + child, ns: oRefData[i].ns });
    }
}

//-------------------------------------------------------------------------
// build the DOT formatted data that will be used to create the digraph
function buildDOTDataORef(ns) {
    // build the DOT data array
    graphsDataORef = [];
    graphVizDataORef = '';
    graphsDataORef.push(`digraph { `);
    graphsDataORef.push(`subgraph cluster_${clusterCntORef++} {`); // Namespace & ClusterLevel
    graphsDataORef.push(`subgraph cluster_${clusterCntORef++} {`); // Namespace
    graphsDataORef.push(`  label="${'  ' + ns + '  '}";fontname="Times 100";fontsize="25.00";style="rounded, dashed";`);

    getNodesAndLinksORef();

    graphsDataORef.push(`  ranksep = 1;   }`);
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
        graphsDataORef.push('  ' + nodeDataORef[nKey].node + nodeDataORef[nKey].content + ';');
    }
    // link definitions
    cKeys = Object.keys(connectionsORef);
    for (let c = 0; c < connectionsORef.length; c++) {
        cKey = cKeys[c];
        graphsDataORef.push('  ' + connectionsORef[cKey].link + ';');
    }
}

//-------------------------------------------------------------------------
// code that runs when a box in the viz graph is selected
function showNodeFnumORef(node) {
    if (typeof fnumLookupORef[node] !== 'undefined') {
        let fnum = fnumLookupORef[node];
        getDefFnum(fnum);
    } else {
        getDefFnum('missing');
    }
}


//-------------------------------------------------------------------------
// create the d3/graphviz graph with zoom enabled
function createGraphORef(clusterORef) {
    try {
        const wrapper = $('#oRefWrapper');
        wrapper.empty(); // Clear old content

        // If coming from the cluster tab, show the Return button
        if (clusterORef === true) {
            wrapper.append(
                '<div class="vpkfont vpk-rtn-bg mt-1 mb-2 ml-2">' +
                '<button type="button" class="mt-1 mb-1 btn btn-sm btn-secondary vpkButtons ml-2 px-2" ' +
                " onclick=\"returnToWhereTab('Cluster','oRefWrapper')\">Return</button>" +
                '<span class="px-2 vpkfont">to Cluster tab</span></div>'
            );
        }

        // Render the graph with zoom and pan support
        graphvizManager.renderGraph('oRefWrapper', graphVizDataORef, oRefData.length, {
            zoom: true,
            trackContext: true,
            onRenderEnd: addGraphvizOnClickORef,
        });

        if (clusterORef === true) {
            openTabOwnerRef();
        }
    } catch (err) {
        $('#statusProcessing').hide();
        console.error(`createGraphORef error: ${err.message}`);
        console.error(err.stack);
    }
}




//-------------------------------------------------------------------------
// gets added to the generated viz graph
function addGraphvizOnClickORef() {
    let nodes = d3.selectAll('.node,.edge');
    nodes.on('click', function () {
        var title = d3.select(this).selectAll('title').text().trim();
        showNodeFnumORef(title);
    });
    $('#statusProcessing').hide();
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
    oKind = '\\n(' + kind + ')';

    margin = 'margin="0.3,0.11"';
    color = '#ffffff';
    switch (kind) {
        case 'Pod':
            fill = '#17a2b8';
            break;
        case 'Deployment':
            fill = '#dab894';
            break;
        case 'ReplicaSet':
            fill = '#dc3545';
            break;
        case 'ConfigMap':
            fill = '#cc89d6';
            break;
        case 'Secret':
            fill = '#5b9877';
            break;
        case 'ClusterServiceVersion':
            fill = '#d5aaff';
            break;
        case 'Service':
            fill = '#afcbff';
            break;
        case 'Certificate':
            fill = '#6eb5ff';
            break;
        case 'ServiceAccount':
            fill = '#aff8d8';
            break;
        case 'RoleBinding':
            fill = '#f6aa90';
            break;
        case 'Role':
            fill = '#fbd206';
            break;
        case 'EndpointSlice':
            fill = '#feaf8a';
            break;
        case 'Endpoints':
            fill = '#feaf8a';
            break;
        case 'Route':
            fill = '#fd7a8c';
            break;
        case 'StatefulSet':
            fill = '#99f692';
            break;
        case 'DaemonSet':
            fill = '#77bad4';
            break;
        case 'Job':
            fill = '#b4547c';
            break;
        case 'CertificateRequest':
            fill = '#6eb566';
            break;
        case 'ControllerRevision':
            fill = '#fbd206';
            break;
        case 'Node':
            fill = '#804040';
            break;
        case 'Lease':
            fill = '#c06c84';
            break;

        default:
            fill = '#000000';
    }

    if (name.startsWith('Missing')) {
        name = '<not defined>';
    }
    name = '&nbsp;' + name + '&nbsp;';
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

// Build a object with all the keys that have OwnerRefs
// This is used in vpk3DCluster.js to determine if a
// OwnerRef button should be built
function buildOwnerRefExists() {
    let oFnum;
    try {
        for (let i = 0; i < oRefLinks.length; i++) {
            oFnum = oRefLinks[i].childFnum;
            if (oRefLinks[i].parentFnum !== '') {
                ownerRefExist[oFnum] = oRefLinks[i].child;
            }
        }
    } catch (err) {
        console.log(`Error in ownerRefLinks reducing the data, message: message: ${err.message}`);
        console.log(`Error stack: ${err.stack}`);
        return;
    }
}

/////////////////////////////// Filter Modal related //////////////////////////

// Schematic related variables
let ownerRefKeys = {};
let ownerRefWKeys = [];
let ownerRefCheckedRows = [];
let ownerRefData;
let ownerRefDataOrig;
let singleOwnerRefData = '';
let ownerRefClusterView = false;

function ownerRefFilterShow() {
    $('#ownerRefFilterModal').modal('show');
}

function applyOwnerRefFilter() {
    oRefFilterSelectData();
    $('#ownerRefFilterModal').modal('hide');
    //formatFilterSVG();
}

// Clear the selected filter setting in the filter UI
// and populate the tab UI with all the returned data
function clearAllOwnerRefFilters() {
    oRefData = [];
    oRefNS = [];
    oRefNamesData = [];
    $('#ownerRef-kind-filter').select2({
        dropdownCssClass: 'vpkselect2',
        selectionCssClass: 'vpkselect2',
        placeholder: 'select kinds(s), default is ALL kinds',
        multiple: false,
        width: 300,
    });

    $('#ownerRefFilterModal').modal('hide');
    $('#statusProcessing').show();
    setTimeout(function () {
        populateORefKinds([]);
        $('#tableORef').bootstrapTable('load', oRefNamesData);
        $('#tableORef').bootstrapTable('hideColumn', 'id');
        $('#ownerRefFilterModal').modal('hide');
        getOwnerRefData();
    }, 1000);
}

function formatFilterOwnerRef() {
    // If being shown from the Cluster View do not build a filter modal table
    if (ownerRefClusterView === true) {
        $('#ownerRefFilterModal').modal('hide');
        return;
    }
    let nsCount = 0;
    let newData2 = {};
    if (ownerRefCheckedRows.length > 0) {
        let id = '';
        let ns = '';
        for (let i = 0; i < ownerRefCheckedRows.length; i++) {
            id = ownerRefCheckedRows[i].id;
            ns = ownerRefCheckedRows[i].ns;
            if (typeof newData2[ns] === 'undefined') {
                newData2[ns] = {};
                nsCount++;
            }
            let tmp = schematicData[ns][id];
            newData2[ns][id] = tmp;
        }
    }
    let html = formatSchematicSVG({ data: newData2 });
    $('#ownerRefFilterModal').modal('hide');
    $('#ownerRefLinksDetail').html(html);
}

function findORefNames() {
    try {
        // Get the kinds from the drop down and locate oRef data
        //
        selectedKinds = [];
        oRefKindsData = [];
        oRefNamesData = [];
        oRefKinds = $('#ownerRef-kind-filter').select2('data');

        if (oRefKinds.length === 0) {
            selectedKinds.push('all-kinds');
        } else {
            for (let i = 0; i < oRefKinds.length; i++) {
                selectedKinds.push(oRefKinds[i].text);
            }
        }

        // Parse the already Namespace selected data
        for (let i = 0; i < oRefData.length; i++) {
            if (selectedKinds.includes(oRefData[i].childKind)) {
                oRefKindsData.push(oRefData[i]);
                oRefNamesData.push({
                    state: '',
                    kind: oRefData[i].childKind,
                    name: oRefData[i].childName,
                    id: oRefData[i].childFnum,
                    ns: oRefNS[0],
                });
            } else {
                if (selectedKinds[0] === 'all-kinds') {
                    oRefKindsData.push(oRefData[i]);
                    oRefNamesData.push({
                        state: '',
                        kind: oRefData[i].childKind,
                        name: oRefData[i].childName,
                        id: oRefData[i].childFnum,
                        ns: oRefNS[0],
                    });
                }
            }
        }
    } catch (err) {
        console.log(`Error in findORefNames(): message: ${err.message}`);
        console.log(`Error stack: ${err.stack}`);
    }
    // build the table
    $('#tableORef').bootstrapTable('load', oRefNamesData);
    $('#tableORef').bootstrapTable('hideColumn', 'id');
}

function oRefFilterSelectData() {
    oRefSelectedNameData = [];
    try {
        for (let i = 0; i < oRefNamesData.length; i++) {
            if (oRefNamesData[i].state === true) {
                oRefSelectedNameData.push({
                    fnum: oRefNamesData[i].id,
                    ns: oRefNamesData[i].ns,
                    kind: oRefNamesData[i].kind,
                });
            }
        }
        // This data structure is what needs to be shown
        hideMessage();
        oRefData = [];
        oRefNS = [];
        for (let i = 0; i < oRefSelectedNameData.length; i++) {
            clusterORefRequest(oRefSelectedNameData[i].fnum, oRefSelectedNameData[i].ns, oRefSelectedNameData[i].kind);
        }
        resetVars();
        oRefNameSpace = oRefSelectedNameData[0].ns;
        nsORefSelected = oRefSelectedNameData[0].ns;
        buildAllORef(false); // false  = this is not a Cluster view request
    } catch (e) {}
}

//----------------------------------------------------------
console.log('loaded vpkTabOwnerRef.js');
