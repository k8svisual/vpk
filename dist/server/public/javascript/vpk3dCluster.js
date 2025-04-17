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
// Create the 3d view for the cluster
//----------------------------------------------------------

// chrome browser mods: disabling chrome://flags/#enable-gpu-rasterization

let ownerRefButton;
let ownerRefFnum;
let ownerRefName;
let ownerRefNS;
let CSIItems;
let nodeEndAngles = [];
// 3D view related
let clusterPanelIsClosed = true;
let foundNSNamesBuilt = false;
let sceneColorR = 0.9;
let sceneColorG = 0.9;
let sceneColorB = 0.9;
let sceneStars = false;
let sceneSky = false;
let stickColorDark = true;
let soundFor3D = true;
let scToPVLink = {};
let scToPVNumber = 0;
let ptrCSIWall = -1;
let sharedEndpoint = [];
let epToPodLinks = {};
let oldSkybox = '';

$('#cluster3DView').show();

canvas = document.getElementById('clusterCanvas');
engine = null;
camera = null;
scene = null;
sceneToRender = null;

createDefaultEngine = function () {
    return new BABYLON.Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true, disableWebGL2Support: true });
};

// External link to open K8s API documentation
function k8sDocSite() {
    window.open('https://kubernetes.io/docs/reference/kubernetes-api/', '_blank');
}

// If ownerRef exists for this resource create the view OwnerRef button
function checkOwnerRef(chkFnum, chkNS, chkKind) {
    if (typeof ownerRefExist[chkFnum] !== 'undefined') {
        return (
            '<button type="button" class="ml-1 mt-2 btn btn-primary btn-sm vpkButton" ' +
            ' onclick="showOwnRef(\'' +
            chkFnum +
            "','" +
            chkNS +
            "','" +
            chkKind +
            "','Cluster')\">OwnerRef</button>&nbsp;"
        );
    } else {
        return '';
    }
}

// Print the existing 3D Babylon screen
function print3Dscene() {
    if (engine !== null) {
        BABYLON.Tools.CreateScreenshot(engine, camera, { width: 1250, height: 700 }, function (data) {
            $('#clusterScreenShot').html("<img src='" + data + "'/>");
            printDiv('clusterPicture');
        });
    } else {
        console.log(`Did not locate 3D image to print`);
    }
}

//////////////////////////////////////////////////////////////////////////////
// Function to define the cluster usng Babylon
function createScene() {
    // properties and initial values

    let RADIUSINNER = 2; // radius for inner/first wall cylinder
    let bandPositions; // array of band positions
    let WALL_HEIGHT = 0.1; // controls heigth of wall, not bands
    let LINEFACTOR = 0.55;
    let INNERFACTOR = 0.5;
    let INGRESSHEIGHT = 9.5;
    let INGRESSRADIUS = 2.5;
    let OUTTERFACTOR = 1.0;
    let PI2 = 6.283185307179586;
    let ARC = 0.017453293;
    let NODE_ICON_ADJ = 0.75;
    let MST_TYPE = 'Master';
    let WRK_TYPE = 'Worker';
    let NODE_HEIGHT = 1.0;
    let POD_HEIGHT = 0.3;
    let POD_SIZE = 0.2;
    let SLICE_HEIGHT = 0.01;
    let SLICE_SIZE = 0.5;
    let SLICE_SIZE_BIG = 1.6;
    let CONTROLPLANE = 3.5;
    let CLUSTERLEVELPLANE = 4.5;

    let aV = 0;
    let angle = 0;
    let angleArray = [];
    let nodePtr = 0;
    let buildWall = true;
    let pX, sX;
    let pY, sY;
    let pZ, sZ;
    let nodeCnt = cluster.maxNodes;
    let currentNode = 0;
    let maxRings = 0;

    let mstStart = 0;
    let mstStop = 0;
    let mstArc = [];
    let beginArc = 0;
    let endArc = 0;
    let saveEndArc;

    let skybox;
    let skyboxMaterial;

    let podArcSize = 0;

    nodeEndAngles = [];

    if (maxNodeCount < 4) {
        if (maxPodCount < 30) {
            podArcSize = 12;
        }
    }

    // set the maximum to be used to build nodes and walls.  Two times the number of nodes.
    let max = cluster.maxNodes * 2;
    // if no nodes defined set to one empty node
    if (max === 0) {
        max = 2;
    }

    // Reset the sl counter
    sl = 0;

    // build array of all angles that will be used to place pods
    let arc = PI2 / 360;
    for (let a = 0; a < 360; a++) {
        angleArray.push(aV);
        aV += arc;
    }

    // Define the Babylon scene engine, camera, lights, etc
    const scene = new BABYLON.Scene(engine);
    //scene.getEngine().setTargetFps(30);
    const clickSound = new BABYLON.Sound('clickSound', 'sounds/LowDing.wav', scene, null, { loop: false, autoplay: true });

    skybox = BABYLON.MeshBuilder.CreateBox('skyBox', { size: 1000.0 }, scene);
    skyboxMaterial = new BABYLON.StandardMaterial('skyBox', scene);
    skyboxMaterial.backFaceCulling = false;
    skyboxMaterial.reflectionTexture = new BABYLON.CubeTexture('textures/stars', scene, [
        '_px.jpg',
        '_py.jpg',
        '_pz.jpg',
        '_nx.jpg',
        '_ny.jpg',
        '_nz.jpg',
    ]);
    skyboxMaterial.reflectionTexture.coordinatesMode = BABYLON.Texture.SKYBOX_MODE;
    skyboxMaterial.diffuseColor = new BABYLON.Color3(0, 0, 0);
    skyboxMaterial.specularColor = new BABYLON.Color3(0, 0, 0);
    skybox.material = skyboxMaterial;

    if (clusterBack === 'Grey') {
        scene.clearColor = new BABYLON.Color3(sceneColorR, sceneColorG, sceneColorB);
        skybox.isVisible = false;
    } else {
        skybox.isVisible = true;
    }

    camera = new BABYLON.ArcRotateCamera('Camera', (3 * Math.PI) / 2, (3 * Math.PI) / 8, 30, BABYLON.Vector3.Zero());
    camera.attachControl(canvas, true);

    scene.registerBeforeRender(function () {
        if (clusterBack !== oldSkybox) {
            // Condition to change the skybox
            changeSkybox();
        }
    });

    const light = new BABYLON.HemisphericLight('hemi', new BABYLON.Vector3(0, 50, 0));
    const light2 = new BABYLON.HemisphericLight('hemi', new BABYLON.Vector3(10, -50, 0));
    // Build inner band for cluster (small circle in center of cluster)
    const band1 = BABYLON.MeshBuilder.CreateTube(
        'band1',
        {
            path: [new BABYLON.Vector3(0.0, 0.0, 0.0), new BABYLON.Vector3(0.0, WALL_HEIGHT, 0.0)],
            radius: RADIUSINNER,
            sideOrientation: BABYLON.Mesh.DOUBLESIDE,
        },
        scene,
    );
    bandPositions = band1.getVerticesData(BABYLON.VertexBuffer.PositionKind);
    band1.setVerticesData(BABYLON.VertexBuffer.ColorKind, setColor(bandPositions, 0.7, 0.7, 0.7));

    // build materials with colors for nodes and pods
    const mstNodeMat = new BABYLON.StandardMaterial('', scene);
    mstNodeMat.diffuseColor = new BABYLON.Color3.FromHexString('#804040');

    const wrkNodeMat = new BABYLON.StandardMaterial('', scene);
    wrkNodeMat.diffuseColor = new BABYLON.Color3.FromHexString('#c4bec4');

    const podRed = new BABYLON.StandardMaterial('', scene);
    podRed.diffuseColor = new BABYLON.Color3.FromHexString('#bf0000');

    const podGreen = new BABYLON.StandardMaterial('', scene);
    podGreen.diffuseColor = new BABYLON.Color3.FromHexString('#00ff00');

    const podYellow = new BABYLON.StandardMaterial('', scene);
    podYellow.diffuseColor = new BABYLON.Color3.FromHexString('#ffff00');

    const podPurple = new BABYLON.StandardMaterial('', scene);
    podPurple.diffuseColor = new BABYLON.Color3.FromHexString('#00a6ff');

    const podGrey = new BABYLON.StandardMaterial('', scene);
    podGrey.diffuseColor = new BABYLON.Color3.FromHexString('#808080');

    const endpointColor = new BABYLON.StandardMaterial('', scene);
    endpointColor.diffuseColor = new BABYLON.Color3.FromHexString('#0000ef');

    const serviceColor = new BABYLON.StandardMaterial('', scene);
    serviceColor.diffuseColor = new BABYLON.Color3.FromHexString('#80bfbf');

    const vaColor = new BABYLON.StandardMaterial('', scene);
    vaColor.diffuseColor = new BABYLON.Color3.FromHexString('#900c3f');

    const pvColor = new BABYLON.StandardMaterial('', scene);
    pvColor.diffuseColor = new BABYLON.Color3.FromHexString('#ba8759');

    const pvcColor = new BABYLON.StandardMaterial('', scene);
    pvcColor.diffuseColor = new BABYLON.Color3.FromHexString('#bfbf1a');

    const storageClassColor = new BABYLON.StandardMaterial('', scene);
    storageClassColor.diffuseColor = new BABYLON.Color3.FromHexString('#fa9903');

    const nodeStorage = new BABYLON.StandardMaterial('', scene);
    nodeStorage.diffuseColor = new BABYLON.Color3.FromHexString('#aaaaaa');

    const csiNodeColor = new BABYLON.StandardMaterial('', scene);
    csiNodeColor.diffuseColor = new BABYLON.Color3.FromHexString('#ff9903');

    const memoryLimitColor = new BABYLON.StandardMaterial('', scene);
    memoryLimitColor.diffuseColor = new BABYLON.Color3.FromHexString('#f4a8e6');

    const memoryRequestColor = new BABYLON.StandardMaterial('', scene);
    memoryRequestColor.diffuseColor = new BABYLON.Color3.FromHexString('#1e18ef');

    const cpuLimitColor = new BABYLON.StandardMaterial('', scene);
    cpuLimitColor.diffuseColor = new BABYLON.Color3.FromHexString('#ef5818');

    const cpuRequestColor = new BABYLON.StandardMaterial('', scene);
    cpuRequestColor.diffuseColor = new BABYLON.Color3.FromHexString('#66b0aa');

    const nodeCPUColor = new BABYLON.StandardMaterial('', scene);
    nodeCPUColor.diffuseColor = new BABYLON.Color3.FromHexString('#f58b4e');

    const nodeMemoryColor = new BABYLON.StandardMaterial('', scene);
    nodeMemoryColor.diffuseColor = new BABYLON.Color3.FromHexString('#7b737b');

    const nodeStorageColor = new BABYLON.StandardMaterial('', scene);
    nodeStorageColor.diffuseColor = new BABYLON.Color3.FromHexString('#f72141');

    const sliceColor = new BABYLON.StandardMaterial('', scene);
    sliceColor.diffuseColor = new BABYLON.Color3.FromHexString('#ff0000');

    const controlPlaneColor = new BABYLON.StandardMaterial('', scene);
    controlPlaneColor.diffuseColor = new BABYLON.Color3.FromHexString('#725db7');
    controlPlaneColor.alpha = 0.45;

    const cpStickColor = new BABYLON.StandardMaterial('', scene);
    cpStickColor.diffuseColor = new BABYLON.Color3.FromHexString('#725db7');
    cpStickColor.alpha = 0.35;

    const controlPlaneWallColor = new BABYLON.StandardMaterial('', scene);
    controlPlaneWallColor.diffuseColor = new BABYLON.Color3.FromHexString('#725db7');
    controlPlaneWallColor.alpha = 0.25;

    const ingressColor = new BABYLON.StandardMaterial('', scene);
    ingressColor.diffuseColor = new BABYLON.Color3.FromHexString('#ffff00');
    ingressColor.alpha = 0.35;

    const ingressItemColor = new BABYLON.StandardMaterial('', scene);
    ingressItemColor.diffuseColor = new BABYLON.Color3.FromHexString('#ffff00');

    const csiStickColor = new BABYLON.StandardMaterial('', scene);
    csiStickColor.diffuseColor = new BABYLON.Color3.FromHexString('#ff0000');

    const registryColor = new BABYLON.StandardMaterial('', scene);
    registryColor.diffuseColor = new BABYLON.Color3.FromHexString('#66cc33');

    const clusterLevelColor = new BABYLON.StandardMaterial('', scene);
    clusterLevelColor.diffuseColor = new BABYLON.Color3.FromHexString('#777777');
    clusterLevelColor.alpha = 0.45;

    const csiStorageWallColor = new BABYLON.StandardMaterial('', scene);
    csiStorageWallColor.diffuseColor = new BABYLON.Color3.FromHexString('#ff0000');
    csiStorageWallColor.alpha = 0.45;

    // Resource Plane and Sphere colors
    const workloadPlaneColor = new BABYLON.StandardMaterial('', scene);
    workloadPlaneColor.diffuseColor = new BABYLON.Color3.FromHexString('#972AFF');
    workloadPlaneColor.alpha = 0.25;

    const workloadSphereColor = new BABYLON.StandardMaterial('', scene);
    workloadSphereColor.diffuseColor = new BABYLON.Color3.FromHexString('#972AFF');

    const servicePlaneColor = new BABYLON.StandardMaterial('', scene);
    servicePlaneColor.diffuseColor = new BABYLON.Color3.FromHexString('#88BBDD');
    servicePlaneColor.alpha = 0.25;

    const serviceSphereColor = new BABYLON.StandardMaterial('', scene);
    serviceSphereColor.diffuseColor = new BABYLON.Color3.FromHexString('#88BBDD');

    const configStoragePlaneColor = new BABYLON.StandardMaterial('', scene);
    configStoragePlaneColor.diffuseColor = new BABYLON.Color3.FromHexString('#ff4500');
    configStoragePlaneColor.alpha = 0.55;

    const configStorageSphereColor = new BABYLON.StandardMaterial('', scene);
    configStorageSphereColor.diffuseColor = new BABYLON.Color3.FromHexString('#ff4500');

    const authorizePlaneColor = new BABYLON.StandardMaterial('', scene);
    authorizePlaneColor.diffuseColor = new BABYLON.Color3.FromHexString('#CC9900');
    authorizePlaneColor.alpha = 0.25;

    const authorizeSphereColor = new BABYLON.StandardMaterial('', scene);
    authorizeSphereColor.diffuseColor = new BABYLON.Color3.FromHexString('#CC9900');

    const authentPlaneColor = new BABYLON.StandardMaterial('', scene);
    authentPlaneColor.diffuseColor = new BABYLON.Color3.FromHexString('#FFBED7');
    authentPlaneColor.alpha = 0.25;

    const authentSphereColor = new BABYLON.StandardMaterial('', scene);
    authentSphereColor.diffuseColor = new BABYLON.Color3.FromHexString('#FFBED7');

    const policyPlaneColor = new BABYLON.StandardMaterial('', scene);
    policyPlaneColor.diffuseColor = new BABYLON.Color3.FromHexString('#66CC99');
    policyPlaneColor.alpha = 0.25;

    const policySphereColor = new BABYLON.StandardMaterial('', scene);
    policySphereColor.diffuseColor = new BABYLON.Color3.FromHexString('#66CC99');

    const extendPlaneColor = new BABYLON.StandardMaterial('', scene);
    extendPlaneColor.diffuseColor = new BABYLON.Color3.FromHexString('#FFABAB');
    extendPlaneColor.alpha = 0.45;

    const extendSphereColor = new BABYLON.StandardMaterial('', scene);
    extendSphereColor.diffuseColor = new BABYLON.Color3.FromHexString('#FFABAB');

    const clusterPlaneColor = new BABYLON.StandardMaterial('', scene);
    clusterPlaneColor.diffuseColor = new BABYLON.Color3.FromHexString('#BAEEE5');
    clusterPlaneColor.alpha = 0.55;

    const clusterSphereColor = new BABYLON.StandardMaterial('', scene);
    clusterSphereColor.diffuseColor = new BABYLON.Color3.FromHexString('#BAEEE5');

    const otherPlaneColor = new BABYLON.StandardMaterial('', scene);
    otherPlaneColor.diffuseColor = new BABYLON.Color3.FromHexString('#CCCCCC');
    otherPlaneColor.alpha = 0.25;

    const otherSphereColor = new BABYLON.StandardMaterial('', scene);
    otherSphereColor.diffuseColor = new BABYLON.Color3.FromHexString('#CCCCCC');

    const thirdPartyPlaneColor = new BABYLON.StandardMaterial('', scene);
    thirdPartyPlaneColor.diffuseColor = new BABYLON.Color3.FromHexString('#FF0099');
    thirdPartyPlaneColor.alpha = 0.25;

    const thirdPartySphereColor = new BABYLON.StandardMaterial('', scene);
    thirdPartySphereColor.diffuseColor = new BABYLON.Color3.FromHexString('#FF0099');

    let stickColor = new BABYLON.StandardMaterial('', scene);
    if (stickColorDark === false) {
        stickColor.diffuseColor = new BABYLON.Color3.FromHexString('#ffffff');
    } else {
        stickColor.diffuseColor = new BABYLON.Color3.FromHexString('#666666');
    }

    //---------------------------------------------------
    // Build pods for each node
    //---------------------------------------------------
    foundServices = {};
    for (let n = 0; n < cluster.maxNodes; n++) {
        let gblCnt = 360 / nodeCnt;
        let start;
        let stop;

        currentNode++;

        gblCnt = parseInt(gblCnt, 10);
        if (currentNode === 1) {
            stop = gblCnt - 1;
            if (nodeCnt === 48) {
                start = 1;
            } else {
                start = 2;
            }
            buildResources(start, stop, currentNode);
        } else {
            let totV = currentNode * gblCnt;
            start = totV - gblCnt + 3;
            // start = (totV - gblCnt) + 4;
            stop = totV - 4;
            buildResources(start, stop, currentNode);
        }

        // define the arc start and stop points for the control plane
        if (typeof cluster.nodes[currentNode] !== 'undefined') {
            if (typeof cluster.nodes[currentNode].type !== 'undefined') {
                if (cluster.nodes[currentNode].type === 'm') {
                    if (mstStart === 0) {
                        mstStart = currentNode;
                    }
                    mstStop = currentNode;
                }
            }
        }
    }

    //---------------------------------------------------
    // Build outter band/ring and walls for each node
    maxRings = maxRings * LINEFACTOR + RADIUSINNER + OUTTERFACTOR;
    buildOutterRing(maxRings);

    //---------------------------------------------------
    // build node walls and node objects
    mstCount = 0;
    for (let index = 0; index < max; index++) {
        buildNodesAndWall(index);
    }

    //---------------------------------------------------
    // build the control plane
    buildControlPlane();

    //---------------------------------------------------
    // build storage classes
    buildSCs();

    //---------------------------------------------------
    // Ingress related
    buildIngressSlice();
    // return the newly built scene to the calling function

    // scToPVLink has been built and contains the links
    // from the PV to the associated SC

    return scene;

    //////////////////////////////////////////////////////////////////////////////
    //============================= Common functions =============================
    //////////////////////////////////////////////////////////////////////////////

    //==============================================
    function changeSkybox() {
        if (clusterBack === oldSkybox) {
            return;
        }
        oldSkybox = clusterBack;
        if (clusterBack === 'Sky') {
            sceneStars = false;
            sceneSky = true;
            skyboxMaterial.reflectionTexture = new BABYLON.CubeTexture('textures/clouds', scene);
            stickColorDark = true;
            skybox.isVisible = true;
            return;
        } else if (clusterBack === 'Stars') {
            sceneStars = true;
            sceneSky = false;
            skyboxMaterial.reflectionTexture = new BABYLON.CubeTexture('textures/stars', scene);
            stickColorDark = false;
            skybox.isVisible = true;
            return;
        } else if (clusterBack === 'Grey') {
            sceneStars = false;
            sceneSky = false;
            scene.clearColor = new BABYLON.Color3(sceneColorR, sceneColorG, sceneColorB);
            stickColorDark = true;
            skybox.isVisible = false;
            return;
        }
    }

    // Routine to build outter band of cluster
    function buildOutterRing(radius) {
        // Good / Green band
        const band2 = BABYLON.MeshBuilder.CreateTube(
            'band2',
            {
                path: [new BABYLON.Vector3(0.0, 0.0, 0.0), new BABYLON.Vector3(0.0, WALL_HEIGHT, 0.0)],
                radius: radius,
                sideOrientation: BABYLON.Mesh.DOUBLESIDE,
            },
            scene,
        );
        bandPositions = band2.getVerticesData(BABYLON.VertexBuffer.PositionKind);
        band2.setVerticesData(BABYLON.VertexBuffer.ColorKind, setColor(bandPositions, 0.625, 0.625, 0.625));
    }

    //==============================================
    //Set colors for band / ring
    function setColor(positions, c1, c2, c3) {
        let colors = [];
        for (var p = 0; p < positions.length / 3; p++) {
            colors.push(c1, c2, c3, 1);
        }
        return colors;
    }

    //==============================================
    //Sort data
    function dynamicSort(property) {
        var sortOrder = 1;
        if (property[0] === '-') {
            sortOrder = -1;
            property = property.substr(1);
        }
        return function (a, b) {
            /* next line works with strings and numbers,
             * and you may want to customize it to your needs
             */
            var result = a[property] < b[property] ? -1 : a[property] > b[property] ? 1 : 0;
            return result * sortOrder;
        };
    }

    //==============================================
    // Sort multiple
    function dynamicSortMultiple() {
        /*
         * save the arguments object as it will be overwritten
         * note that arguments object is an array-like object
         * consisting of the names of the properties to sort by
         */
        var props = arguments;
        return function (obj1, obj2) {
            var i = 0,
                result = 0,
                numberOfProperties = props.length;
            /* try getting a different result from 0 (equal)
             * as long as we have extra properties to compare
             */
            while (result === 0 && i < numberOfProperties) {
                result = dynamicSort(props[i])(obj1, obj2);
                i++;
            }
            return result;
        };
    }

    //==============================================
    // Add mesh to an array that is used to control showing the mesh object
    function addMesh(obj, ns, type, fnum, status, link) {
        meshArray.push({ ns: ns, type: type, obj: obj, fnum: fnum, status: status, link: link });
    }

    //==============================================
    // Add mesh to an array that is used to control showing the mesh object
    function addSlice(obj, id) {
        sliceArray.push({ id: id, obj: obj });
    }

    //==============================================
    // Add mesh to an array that is used to control showing the mesh object
    function addControlP(obj, id) {
        controlPlaneArray.push({ id: id, obj: obj });
    }

    //==============================================
    // Add mesh to an array that is used to control showing the mesh object
    function addResource(obj, ns, type, fnum) {
        resourceArray.push({ ns: ns, type: type, obj: obj, pod: fnum });
    }

    //==============================================
    // Build the pods to display in the cluster view for this node
    function buildResources(start, stop, node) {
        let lc = 0;
        let nLen = lc * LINEFACTOR + RADIUSINNER + INNERFACTOR;
        let cPtr = start;
        let cCnt = 0;
        let podStatus;
        let podName;
        let podCords;
        let podFnum;
        let svcName;
        let pvcName;
        let pvName;
        let serviceName = '';
        let nCords;
        let podCnt;
        let tmpData;
        let ns;
        let key;
        let endPoint;
        let epName;
        let epInner;
        let epType;
        let highPtr = stop;
        let highAngle = 0;

        // Set node to proper location in cluster by subtracting one
        node = node - 1;

        // Check for no pods in the node
        if (typeof cluster.nodes[node].pods === 'undefined') {
            console.log(`Node: ${cluster.nodes[node].name} has no pods`);
            return;
        }

        // Get the number of pods in the node
        podCnt = cluster.nodes[node].pods.length;

        // Sort pod data for cluster.nodes[].pods
        tmpData = cluster.nodes[node].pods;
        tmpData.sort(dynamicSortMultiple('status', 'name'));
        cluster.nodes[node].pods = tmpData;
        tmpData = null;

        for (cCnt = 0; cCnt < podCnt; cCnt++) {
            let size;

            // check if ring of node is full, if so, add new ring in node
            if (cPtr > stop) {
                // Save ptr if it is greater than highPtr
                if (cPtr > highPtr) {
                    highPtr = cPtr;
                    highAngle = angleArray[highPtr];
                }
                // reset pointer
                cPtr = start;
                // increase length counter
                lc++;
                // increase length pointer
                nLen = lc * LINEFACTOR + RADIUSINNER + INNERFACTOR;
            }

            ///////////////////////////////////////////////////////////////////
            // Pod related namespace, fnum, and status. Status is also used to set color
            ///////////////////////////////////////////////////////////////////
            ns = cluster.nodes[node].pods[cCnt].ns;
            podFnum = cluster.nodes[node].pods[cCnt].fnum;
            podStatus = cluster.nodes[node].pods[cCnt].status;

            // Save the pod status for use in the Storage tab
            podStatusLookup[podFnum] = podStatus;

            podName =
                '<div class="vpkfont vpkblue ml-1">' +
                '<div id="sliceKey">' +
                podFnum +
                '</div>' +
                '<a href="javascript:getDefFnum(\'' +
                podFnum +
                '\')">' +
                '<img src="images/k8/pod.svg" class="icon">' +
                '</a>' +
                '<span class="pl-2 vpkfont-sm">(Press to view resource)' +
                '</span>' +
                '<br>' +
                '<span class="vpkfont-slidein"><b>Pod</b>' +
                '<br><hr class="hrLine">' +
                '<table>' +
                '<tr><td><b>Name:</b></td><td class="pl-2">' +
                cluster.nodes[node].pods[cCnt].name +
                '</td></tr>' +
                '<tr><td><b>Namespace:</b></td><td class="pl-2">' +
                ns +
                '</td></tr>' +
                '<tr><td><b>Status:</b></td><td class="pl-2">' +
                cluster.nodes[node].pods[cCnt].phase +
                '</td></tr>' +
                '</table>' +
                '<br>' +
                '<button type="button" class="ml-1 mt-2 btn btn-primary btn-sm vpkButton" ' +
                ' onclick="showSchematic(\'' +
                ns +
                "','" +
                podFnum +
                "','Cluster')\">Schematic</button>&nbsp;" +
                checkOwnerRef(podFnum, ns, 'Pod');

            podCords = buildPodObj(angleArray[cPtr], nLen, podStatus, podName, ns, podFnum);

            // Memory Limit and Request resource cylinders
            size = cluster.nodes[node].pods[cCnt].memoryLimit;
            if (size > 0) {
                size = size / 1000 / 1000;
                buildMemCPUResource(
                    podCords.x - 0.03,
                    podCords.y + 0.25,
                    podCords.z,
                    size,
                    0.08,
                    3,
                    memoryLimitColor,
                    ns,
                    'MemoryLimit',
                    podFnum,
                    podName,
                );
            }
            size = cluster.nodes[node].pods[cCnt].memoryRequest;
            if (size > 0) {
                size = size / 1000 / 1000;
                buildMemCPUResource(
                    podCords.x,
                    podCords.y + 0.25,
                    podCords.z + 0.03,
                    size,
                    0.08,
                    3,
                    memoryRequestColor,
                    ns,
                    'MemoryRequest',
                    podFnum,
                    podName,
                );
            }
            //----

            // CPU Limit and Requests resource cylinders
            size = cluster.nodes[node].pods[cCnt].cpuLimit;
            if (size > 0) {
                size = size / 1000;
                size = size / 2;
                buildMemCPUResource(podCords.x + 0.03, podCords.y + 0.25, podCords.z, size, 0.08, 3, cpuLimitColor, ns, 'CPULimit', podFnum, podName);
            }
            size = cluster.nodes[node].pods[cCnt].cpuRequest;
            if (size > 0) {
                size = size / 1000;
                size = size / 2;
                buildMemCPUResource(
                    podCords.x,
                    podCords.y + 0.25,
                    podCords.z - 0.03,
                    size,
                    0.08,
                    3,
                    cpuRequestColor,
                    ns,
                    'CPURequest',
                    podFnum,
                    podName,
                );
            }
            //----

            ///////////////////////////////////////////////////////////////////
            // Network related - Service and Endpoint
            ///////////////////////////////////////////////////////////////////
            if (cluster.nodes[node].pods[cCnt].services.length > 0) {
                svcName =
                    '<div class="vpkfont vpkblue ml-1">' +
                    '<div id="sliceKey">' +
                    cluster.nodes[node].pods[cCnt].services[0].fnum +
                    '</div>' +
                    '<a href="javascript:getDefFnum(\'' +
                    cluster.nodes[node].pods[cCnt].services[0].fnum +
                    '\')">' +
                    '<img src="images/k8/svc.svg" class="icon"></a>' +
                    '<span class="pl-2 pb-2 vpkfont-sm">(Press to view resource)' +
                    '</span>' +
                    '<br><span class="vpkfont-slidein"><b>Service</b>' +
                    '<br><hr class="hrLine">' +
                    '<table>' +
                    '<tr><td><b>Name:</b></td><td class="pl-2">' +
                    cluster.nodes[node].pods[cCnt].services[0].name +
                    '</td></tr>' +
                    '<tr><td><b>Namespace:</b></td><td class="pl-2">' +
                    cluster.nodes[node].pods[cCnt].services[0].namespace +
                    '</td></tr>' +
                    '</table>' +
                    '<br>' +
                    checkOwnerRef(cluster.nodes[node].pods[cCnt].services[0].fnum, ns, 'Service') +
                    '</div>';

                // Create a fully qualified name using service name and namespace
                serviceName = cluster.nodes[node].pods[cCnt].services[0].name + '::' + cluster.nodes[node].pods[cCnt].services[0].namespace;

                if (typeof foundServices[serviceName] === 'undefined') {
                    // Save where the pod for this service is located and the pod fnum
                    podCords.fnum = podFnum;
                    foundServices[serviceName] = podCords;
                    nCords = 'build';
                } else {
                    // Use the pod location since it already exists
                    nCords = foundServices[serviceName];
                    // Save to array links to other pods for endpoint and service
                    networkLinks[podFnum] = nCords.fnum;
                }

                // Get the endPoint/endPointSlice fnum
                epFnum = '';
                epType = '';
                epName = '';
                epInner = '';
                if (cluster.nodes[node].pods[cCnt].services[0].ep !== '') {
                    epFnum = cluster.nodes[node].pods[cCnt].services[0].ep;
                    epType = 'ep';
                } else {
                    epFnum = cluster.nodes[node].pods[cCnt].services[0].eps;
                    epType = 'eps';
                }
                if (typeof cluster.nodes[node].pods[cCnt].services[0].epName !== 'undefined') {
                    epName = cluster.nodes[node].pods[cCnt].services[0].epName;
                } else {
                    epName = 'Unknown';
                }

                if (endPoint !== '') {
                    epInner =
                        '<div class="vpkfont vpkblue ml-1">' +
                        '<div id="sliceKey">' +
                        epFnum +
                        '</div>' +
                        '<a href="javascript:getDefFnum(\'' +
                        epFnum +
                        '\')">' +
                        '<img src="images/k8/' +
                        epType +
                        '.svg" class="icon"></a>' +
                        '<span class="pl-2 pb-2 vpkfont-sm">(Press to view resource)' +
                        '</span>' +
                        '<br>' +
                        '<span class="vpkfont-slidein"><b>Endpoints (EP)/ EndpointSlice (EPS)</b>' +
                        '<br>' +
                        '<hr class="hrLine">' +
                        '<table>' +
                        '<tr><td><b>Name:</b></td><td class="pl-2">' +
                        epName +
                        '</td></tr>' +
                        '<tr><td><b>Namespace:</b></td><td class="pl-2">' +
                        cluster.nodes[node].pods[cCnt].services[0].namespace +
                        '</td></tr>' +
                        '</table>' +
                        '<br>' +
                        checkOwnerRef(epFnum, ns, 'EndpointSlice') +
                        checkOwnerRef(epFnum, ns, 'Endpoints') +
                        '</span></div>';
                }

                let svcFnum = cluster.nodes[node].pods[cCnt].services[0].fnum;
                buildServiceObj(podCords, svcName, cluster.nodes[node].pods[cCnt].services[0].namespace, nCords, epInner, podFnum, svcFnum, epFnum);
            }

            ///////////////////////////////////////////////////////////////////
            // Storage related - PV and PVC
            ///////////////////////////////////////////////////////////////////
            if (cluster.nodes[node].pods[cCnt].pvc.length > 0) {
                pvcName =
                    '<div class="vpkfont vpkblue ml-1">' +
                    '<div id="sliceKey">' +
                    cluster.nodes[node].pods[cCnt].pvc[0].fnum +
                    '</div>' +
                    '<a href="javascript:getDefFnum(\'' +
                    cluster.nodes[node].pods[cCnt].pvc[0].fnum +
                    '\')">' +
                    '<img src="images/k8/pvc.svg" class="icon"></a>' +
                    '<span class="pl-2 pb-2 vpkfont-sm">(Press icon to view resource source)' +
                    '</span>' +
                    '<br>' +
                    '<span class="vpkfont-slidein"><b>PersistentVolumeClaim (PVC)</b>' +
                    '<br><hr class="hrLine">' +
                    '<table>' +
                    '<tr><td><b>Name:</b></td><td class="pl-2">' +
                    cluster.nodes[node].pods[cCnt].pvc[0].name +
                    '</td></tr>' +
                    '<tr><td><b>Namespace:</b></td><td class="pl-2">' +
                    cluster.nodes[node].pods[cCnt].ns +
                    '</td></tr>' +
                    '<tr><td><b>Status:</b></td><td class="pl-2">' +
                    cluster.nodes[node].pods[cCnt].phase +
                    '</td></tr>' +
                    '</table>' +
                    '<br>' +
                    checkOwnerRef(cluster.nodes[node].pods[cCnt].pvc[0].fnum, cluster.nodes[node].pods[cCnt].ns, 'PersistentVolumeClaim') +
                    '</div>';

                if (typeof cluster.nodes[node].pods[cCnt].pvc[0].pvName !== 'undefined') {
                    pvName =
                        '<div class="vpkfont vpkblue ml-1">' +
                        '<div id="sliceKey">' +
                        cluster.nodes[node].pods[cCnt].pvc[0].pvFnum +
                        '</div>' +
                        '<a href="javascript:getDefFnum(\'' +
                        cluster.nodes[node].pods[cCnt].pvc[0].pvFnum +
                        '\')">' +
                        '<img src="images/k8/pv.svg" class="icon"></a>' +
                        '<span class="pl-2 pb-2 vpkfont-sm">(Press to view resource)' +
                        '</span>' +
                        '<br>' +
                        '<span class="vpkfont-slidein"><b>PersistentVolume (PV)</b>' +
                        '<br><hr class="hrLine">' +
                        '<table>' +
                        '<tr><td><b>Name:</b></td><td class="pl-2">' +
                        cluster.nodes[node].pods[cCnt].pvc[0].pvName +
                        '</td></tr>' +
                        '</table>' +
                        // + '<span><b>Name :</b><span class="pl-2">' + cluster.nodes[node].pods[cCnt].pvc[0].pvName + '</span></span>'
                        // + '</span>'
                        '<br>' +
                        checkOwnerRef(cluster.nodes[node].pods[cCnt].pvc[0].pvFnum, 'ClusterLevel', 'PersistentVolume') +
                        '</div>';
                } else {
                    pvName = '';
                }

                key = cluster.nodes[node].pods[cCnt].pvc[0].scName;
                if (key > '') {
                    let pvNameText = cluster.nodes[node].pods[cCnt].pvc[0].pvName;
                    let pvcFnum = cluster.nodes[node].pods[cCnt].pvc[0].fnum;
                    let pvFnum = cluster.nodes[node].pods[cCnt].pvc[0].pvFnum;
                    let foundKey = cluster.nodes[node].pods[cCnt].pvc[0].name + '::' + cluster.nodes[node].pods[cCnt].pvc[0].ns;
                    let found;
                    found = buildStorageObj(
                        podCords,
                        pvcName,
                        cluster.nodes[node].pods[cCnt].ns,
                        pvName,
                        podFnum,
                        pvcFnum,
                        pvFnum,
                        foundKey,
                        pvNameText,
                    );

                    // save x,y,z for use with storage class if the PV was built
                    if (found) {
                        podCords.ns = cluster.nodes[node].pods[cCnt].ns;
                        podCords.pFnum = podFnum;
                        podCords.pvFnum = cluster.nodes[node].pods[cCnt].pvc[0].pvFnum;
                        if (typeof foundStorageClasses[key] === 'undefined') {
                            foundStorageClasses[key] = {};
                        }
                        if (typeof foundStorageClasses[key].pv === 'undefined') {
                            foundStorageClasses[key].pv = [];
                        }
                        foundStorageClasses[key].pv.push(podCords);
                        // an object with each PV-to-SC connection
                        // that will be updated with the name of the lines that
                        // connect the two items
                        //scToPVLink[cluster.nodes[node].pods[cCnt].pvc[0].pvFnum + ':' + foundStorageClasses[key].fnum] = 'unknown'
                        scToPVLink[cluster.nodes[node].pods[cCnt].pvc[0].pvFnum] = 'unknown';
                    }
                }
            }

            // Calculate where the wall should be built
            // Control spacing between pods
            if (maxNodeCount > 2) {
                if (lc > 1) {
                    cPtr = cPtr + 4;
                } else {
                    cPtr = cPtr + 5;
                }
            } else {
                if (lc > 1) {
                    cPtr = cPtr + 8;
                } else {
                    cPtr = cPtr + 10;
                }
            }
        }

        nodeEndAngles.push(highAngle);
        nodeEndAngles.push('empty');

        // Update maxRings so outter band/ring is properly placed
        if (maxRings < lc) {
            maxRings = lc;
        }
    }

    //==============================================
    // build a cylinder for the red slice when object is selected
    function buildSlice(x, y, z, fnum, size) {
        let slice_size = SLICE_SIZE;

        if (size === 'b' || size === 'B') {
            slice_size = SLICE_SIZE_BIG;
        }
        slice = BABYLON.MeshBuilder.CreateCylinder('slice', {
            height: SLICE_HEIGHT,
            diameterTop: slice_size,
            diameterBottom: slice_size,
            tessellation: 32,
        });
        slice.position.y = y;
        slice.position.x = x;
        slice.position.z = z;
        slice.material = sliceColor;
        // register click event for object
        slice.actionManager = new BABYLON.ActionManager(scene);
        slice.actionManager.registerAction(
            new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnPickTrigger, function () {
                document.getElementById('resourceProps').innerHTML = '';
                hideRing();
            }),
        );
        slice.setEnabled(false); // always hide the slice when built
        addSlice(slice, fnum);
    }

    //==============================================
    // build a cylinder used for a line to connect objects
    function buildLine(x, y, z, height, type, ns, fnum, nameFnum) {
        if (typeof nameFnum === 'undefined' || nameFnum === null) {
            nameFnum = 'unknown';
        }
        let stick;
        stick = BABYLON.MeshBuilder.CreateCylinder(nameFnum, { height: height, diameterTop: 0.025, diameterBottom: 0.025, tessellation: 4 });
        stick.position.x = x;
        stick.position.y = y;
        stick.position.z = z;
        stick.material = stickColor;
        addMesh(stick, ns, type, fnum, '');
    }

    //==============================================
    // build a cylinder
    function buildCylinder(x, y, z, height, diameter, tess, material, ns, type, fnum, inner, status, nameFnum) {
        if (typeof nameFnum === 'undefined' || nameFnum === null) {
            nameFnum = 'unknown';
        }
        let cyl = BABYLON.MeshBuilder.CreateCylinder(nameFnum, {
            height: height,
            diameterTop: diameter,
            diameterBottom: diameter,
            tessellation: tess,
        });
        cyl.position.x = x;
        cyl.position.y = y;
        cyl.position.z = z;
        cyl.material = material;
        // register click event for object
        cyl.actionManager = new BABYLON.ActionManager(scene);
        cyl.actionManager.registerAction(
            new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnPickTrigger, function () {
                document.getElementById('resourceProps').innerHTML = inner;
                if ($('#clusterFilterSound').prop('checked')) {
                    clickSound.play();
                }
                showRing();
            }),
        );
        addMesh(cyl, ns, type, fnum, status);
    }

    //==============================================
    // build a cylinder
    function buildControlComponent(x, y, z, height, diameter, tess, material, ns, type, fnum, inner, status, link) {
        let cyl = BABYLON.MeshBuilder.CreateCylinder(link, { height: height, diameterTop: diameter, diameterBottom: diameter, tessellation: tess });
        cyl.position.x = x;
        cyl.position.y = y;
        cyl.position.z = z;
        cyl.material = material;

        // register click event for object
        cyl.actionManager = new BABYLON.ActionManager(scene);
        cyl.actionManager.registerAction(
            new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnPickTrigger, function () {
                document.getElementById('resourceProps').innerHTML = inner;
                if ($('#clusterFilterSound').prop('checked')) {
                    clickSound.play();
                }
                showRing();
            }),
        );
        addMesh(cyl, ns, type, fnum, status);
        addControlP(cyl, 'ControlPlaneComponent');
    }

    //==============================================
    // build a CPU or Memory cylinder
    function buildMemCPUCylinder(x, y, z, height, diameter, tess, material, ns, type, fnum, inner) {
        let cyl = BABYLON.MeshBuilder.CreateCylinder('pvc', { height: height, diameterTop: diameter, diameterBottom: diameter, tessellation: tess });
        cyl.position.x = x;
        cyl.position.y = y;
        cyl.position.z = z;
        cyl.material = material;
        // register click event for object
        cyl.actionManager = new BABYLON.ActionManager(scene);
        cyl.actionManager.registerAction(
            new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnPickTrigger, function () {
                document.getElementById('resourceProps').innerHTML = inner;
                if ($('#clusterFilterSound').prop('checked')) {
                    clickSound.play();
                }
                showRing();
            }),
        );
        cyl.setEnabled(false);
        addResource(cyl, ns, type, fnum);
    }

    //==============================================
    // build a memory or cpu resource
    function buildMemCPUResource(x, y, z, height, diameter, tess, material, ns, type, fnum, inner) {
        let newHeight = height / 2;
        y = y + newHeight / 2;
        y = y - 0.1;
        buildMemCPUCylinder(x, y, z, newHeight, diameter, tess, material, ns, type, fnum, inner);
    }

    //==============================================
    // build a shpere
    function buildSphere(x, y, z, diameter, segs, material, ns, type, fnum, inner, nameFnum) {
        // define the sphere
        let sphere = BABYLON.MeshBuilder.CreateSphere(nameFnum, { diameter: diameter, segments: segs }, scene);
        sphere.position.x = x;
        sphere.position.y = y;
        sphere.position.z = z;
        sphere.material = material;
        // register click event for object
        sphere.actionManager = new BABYLON.ActionManager(scene);
        sphere.actionManager.registerAction(
            new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnPickTrigger, function () {
                document.getElementById('resourceProps').innerHTML = inner;
                if ($('#clusterFilterSound').prop('checked')) {
                    clickSound.play();
                }
                showRing();
            }),
        );

        addMesh(sphere, ns, type, fnum, '');
    }

    //==============================================
    // build line to connect Pod to an existing PVC
    function buildPVCLine(cords, pCords, fnum, ns) {
        let epPath = [
            new BABYLON.Vector3(pCords.x, pCords.y, pCords.z),
            new BABYLON.Vector3(pCords.x, pCords.y - 1.35, pCords.z),
            new BABYLON.Vector3(cords.x, cords.y - 2.5, cords.z),
        ];
        let stick = BABYLON.MeshBuilder.CreateTube('tube', { path: epPath, radius: 0.015, sideOrientation: BABYLON.Mesh.DOUBLESIDE }, scene);
        stick.material = stickColor;
        addMesh(stick, ns, 'PVCLine', fnum, '');
    }

    //==============================================
    // build a cylinder for the PVC and PV

    function buildStorageObj(pCords, pvcName, ns, pvName, pFnum, pvcFnum, pvFnum, foundKey, pvNameText) {
        if (typeof foundPVC[foundKey].cords === 'undefined') {
            // define the PVC
            buildCylinder(pCords.x, pCords.y - 2.5, pCords.z, 0.4, 0.25, 16, pvcColor, ns, 'PVC', pFnum, pvcName, '', pvcFnum);
            buildSlice(pCords.x, pCords.y - 2.5, pCords.z, pvcFnum, 'n');
            // Connect PVC to Pod
            buildLine(pCords.x, pCords.y - 1.15, pCords.z, 2.25, 'PVCLine', ns, pFnum, pvcFnum);

            // define the PV
            buildCylinder(pCords.x, pCords.y - 5, pCords.z, 0.4, 0.25, 8, pvColor, ns, 'PV', pFnum, pvName, '', pvFnum);
            buildSlice(pCords.x, pCords.y - 5, pCords.z, pvFnum, 'n');
            // Connect PVC to PV
            buildLine(pCords.x, pCords.y - 3.75, pCords.z, 2.25, 'PVLine', ns, pFnum, pvFnum);

            if (typeof volAttach[pvNameText] !== 'undefined') {
                let vaName;
                let vaFnum;
                let vaInner;
                let yAdj = 0;
                let yBase = 5.0;
                let yNow = 0;
                let yLine = 0;
                for (let i = 0; i < volAttach[pvNameText].length; i++) {
                    vaName = volAttach[pvNameText][i].name;
                    vaFnum = volAttach[pvNameText][i].fnum;
                    yAdj = yAdj + 0.5;
                    yNow = yBase + yAdj;
                    vaInner =
                        '<div class="vpkfont vpkblue ml-1">' +
                        '<div id="sliceKey">' +
                        vaFnum +
                        //'.' +
                        //c +
                        '</div>' +
                        '<a href="javascript:getDefFnum(\'' +
                        vaFnum +
                        '\')">' +
                        '<img src="images/k8/va.svg" class="icon"></a>' +
                        '<span class="pl-2 pb-2 vpkfont-sm">(Press to view resource)' +
                        '</span>' +
                        '<br>' +
                        '<span class="vpkfont-slidein"><b>VolumeAttachment</b>' +
                        '<br><hr class="hrLine">' +
                        '<span><b>Name : </b><span class="pl-2">' +
                        vaName +
                        '</span></span>' +
                        '</span>' +
                        '<br>' +
                        checkOwnerRef(vaFnum, 'cluster-level', 'VA') +
                        '</div>';

                    buildSphere(pCords.x, pCords.y - yNow, pCords.z, 0.175, 32, vaColor, ns, 'VA', pFnum, vaInner, vaFnum);
                    buildSlice(pCords.x, pCords.y - yNow, pCords.z, vaFnum, 'n');
                    // Add connection line between the VolumeAttachment and the PV
                    yLine = yNow - 0.25;
                    buildLine(pCords.x, pCords.y - yLine, pCords.z, 0.5, 'VALine', ns, pFnum, vaFnum);
                }
            }

            //Update the object
            foundPVC[foundKey].cords = pCords;
            return true; // Indicate the objects are new
        } else {
            let cords = foundPVC[foundKey].cords;
            buildPVCLine(cords, pCords, pFnum, ns);
            return false; //Indicate the objects already exist
        }
    }

    //==============================================
    // build spheres for the endpoint and service
    function buildServiceObj(pCords, sName, ns, nCords, epInner, pFnum, svcFnum, epFnum) {
        if (nCords === 'build') {
            // define the Endpoint
            buildSphere(pCords.x, pCords.y + 5, pCords.z, 0.175, 32, endpointColor, ns, 'Endpoints', pFnum, epInner, epFnum);
            buildSlice(pCords.x, pCords.y + 5, pCords.z, epFnum, 'n');
            // Add connection line between the Pod and the Endpoint
            buildLine(pCords.x, pCords.y + 2.55, pCords.z, 5.0, 'EndpointLine', ns, pFnum, epFnum);
            // Save info for Pod-to-EPLine
            if (typeof epToPodLinks[pFnum] === 'undefined') {
                epToPodLinks[pFnum] = [];
            }
            epToPodLinks[pFnum].push({ baseLink: epFnum, pod: pFnum, linkType: 'EndpointLine' });

            // define the Service
            buildSphere(pCords.x, pCords.y + 7, pCords.z, 0.175, 32, serviceColor, ns, 'Service', pFnum, sName, svcFnum);
            buildSlice(pCords.x, pCords.y + 7, pCords.z, svcFnum, 'n');
            // Add connection line between the Service and the Endpoint
            buildLine(pCords.x, pCords.y + 6, pCords.z, 2.0, 'ServiceLine', ns, pFnum, svcFnum);
            // epToPodLinks[pFnum].push({ 'baseLink': epFnum, 'pod': pFnum, 'linkType': 'ServiceLine'  });
        } else {
            // Endpoint / EndpointSlice already defined, link this pod to existing item.
            // Define a map with three points of the stick (start, middle, end)
            const epPath = [
                new BABYLON.Vector3(pCords.x, pCords.y, pCords.z),
                new BABYLON.Vector3(pCords.x, pCords.y + 2, pCords.z),
                new BABYLON.Vector3(nCords.x, nCords.y + 5, nCords.z),
            ];
            sharedEndpoint.push(pFnum);
            let stick = BABYLON.MeshBuilder.CreateTube(pFnum, { path: epPath, radius: 0.015, sideOrientation: BABYLON.Mesh.DOUBLESIDE }, scene);
            stick.material = stickColor;
            // Save info for Pod-to-EPLine
            if (typeof epToPodLinks[pFnum] === 'undefined') {
                epToPodLinks[pFnum] = [];
            }
            epToPodLinks[pFnum].push({ epFnum: epFnum, pod: pFnum, linkType: 'EndpointLine' });
            //pCords.fnum is the pod that this is linking back to
            addMesh(stick, ns, 'EndpointLine', pFnum, '', pCords.fnum);
        }
    }

    //==============================================
    // build a sphere for the pod
    //
    // build Pod and save the center cords for use with network and storage
    // podCords = buildPodObj(angleArray[cPtr], nLen, podStatus, podName, ns, podFnum, podStatus)
    function buildPodObj(iAngle, iLen, pStatus, name, ns, pFnum) {
        let wX;
        let wY;
        let wZ;
        let material;
        // Calculate where is the point to build the Pod
        wX = iLen * Math.sin(iAngle);
        wY = 0;
        wZ = iLen * Math.cos(iAngle);
        // set pod color using the status
        if (pStatus === 1 || pStatus === '1') {
            material = podGreen;
        } else if (pStatus === 2 || pStatus === '2') {
            material = podRed;
        } else if (pStatus === 3 || pStatus === '3') {
            material = podYellow;
        } else if (pStatus === 4 || pStatus === '4') {
            material = podPurple;
        } else if (pStatus === 0 || pStatus === '0') {
            material = podGrey;
        }
        // define the Pod
        buildCylinder(wX, wY, wZ, POD_HEIGHT, POD_SIZE, 6, material, ns, 'Pod', pFnum, name, pStatus, pFnum);
        buildSlice(wX, wY, wZ, pFnum, 'n');
        return { x: wX, y: wY, z: wZ };
    }

    //==============================================
    // Build the walls to seperate the Nodes
    function createWall(x, y, z, sX, sY, sZ, h, i) {
        //Material on front and back of custom mesh
        let wallMat = new BABYLON.StandardMaterial('mat' + i, scene);
        wallMat.backFaceCulling = false;
        wallMat.diffuseColor = new BABYLON.Color3(0.625, 0.625, 0.625);
        //Create a custom mesh for the wall
        let customMesh = new BABYLON.Mesh('wall' + i, scene);
        //Set arrays for positions and indices
        let positions = [sX, sY, sZ, x, y, z, x, h, z, sX, h, sZ];
        let indices = [0, 1, 2, 2, 3, 0];
        //Empty array to contain calculated values
        var normals = [];
        var vertexData = new BABYLON.VertexData();
        BABYLON.VertexData.ComputeNormals(positions, indices, normals);
        //Assign positions, indices and normals to vertexData
        vertexData.positions = positions;
        vertexData.indices = indices;
        vertexData.normals = normals;
        //Apply vertexData to custom mesh
        vertexData.applyToMesh(customMesh);
        customMesh.material = wallMat;
    }

    //==============================================
    // Build the StoreageClass
    function buildSCs() {
        angle = 0;
        let scData;
        let scKeys = Object.keys(foundStorageClasses);
        let index;
        let scTxt;
        let scFnum;
        max = scKeys.length;
        // loop and build storage classes and connect to PVs
        for (index = 0; index < max; index++) {
            scData = foundStorageClasses[scKeys[index]];
            scFnum = scData.fnum;
            scTxt =
                '<div class="vpkfont vpkblue ml-1">' +
                '<div id="sliceKey">' +
                scFnum +
                '</div>' +
                '<a href="javascript:getDefFnum(\'' +
                scFnum +
                '\')">' +
                '<img src="images/k8/sc.svg" class="icon"></a>' +
                '<span class="pl-2 pb-2 vpkfont-sm">(Press to view resource)' +
                '</span>' +
                '<br>' +
                '<span class="vpkfont-slidein""><b>StorageClass (SC)</b>' +
                '<br><hr class="hrLine">' +
                '<span><b>Name :</b><span class="pl-2">' +
                scData.name +
                '</span></span>' +
                '</span></div>' +
                '<button type="button" class="ml-1 mt-4 btn btn-primary btn-sm vpkButton" ' +
                ' onclick="showSC(\'' +
                scData.name +
                "','" +
                scFnum +
                '\')">Storage</button>&nbsp;' +
                '<br>' +
                checkOwnerRef(scFnum, 'cluster-level', 'StorageClass') +
                '</div>';
            //createSC(scTxt, scFnum, scData)
            let adjustment = 0;
            let path;
            let tX, tZ;
            // set x,y,z points for storage class icon
            if (maxRings > 4) {
                adjustment = 3;
            }
            pX = (maxRings - adjustment) * Math.sin(angle);
            pY = 0;
            pZ = (maxRings - adjustment) * Math.cos(angle);
            // define the storage class
            buildCylinder(pX, pY - 7, pZ, 1, 1, 32, storageClassColor, 'ClusterLevel', 'StorageClass', 0, scTxt, '', scFnum);
            buildSlice(pX, pY - 7, pZ, scFnum, 'b');
            // connect StorageClass icon to CSI Storage Wall
            tX = (maxRings + 1.5) * Math.sin(angle);
            tZ = (maxRings + 1.5) * Math.cos(angle);
            path = [new BABYLON.Vector3(pX, pY - 7, pZ), new BABYLON.Vector3(tX, -7, tZ)];
            // If the StorageClass provisioner is the name of a CSIDriver draw the lines
            if (foundCSINames.includes(scData.prov)) {
                let stick = BABYLON.MeshBuilder.CreateTube(scFnum, { path: path, radius: 0.0075, sideOrientation: BABYLON.Mesh.DOUBLESIDE }, scene);
                stick.material = csiStickColor;
                addMesh(stick, 'ClusterLevel', 'csiStorageLine', scFnum, '');

                path = [new BABYLON.Vector3(tX, -7, tZ), new BABYLON.Vector3(tX, -0.85, tZ)];

                let upStick = BABYLON.MeshBuilder.CreateTube(scFnum, { path: path, radius: 0.0075, sideOrientation: BABYLON.Mesh.DOUBLESIDE }, scene);
                upStick.material = csiStickColor;
                addMesh(upStick, 'ClusterLevel', 'csiStorageLine', scFnum, '');

                // CSIDriver shpere
                y = 1.5;
                // let fnum = 600 + index;
                let sphere1 = BABYLON.MeshBuilder.CreateSphere('CSIDriver', { diameter: 0.25, segments: 32 }, scene);
                sphere1.position.x = tX;
                sphere1.position.y = -7;
                sphere1.position.z = tZ;
                sphere1.material = csiStorageWallColor;
                //buildSlice(tX, -7, tZ, fnum.toString(), 'n');

                let csiFnum = 0;
                for (let i = 0; i < foundCSINamesFnum.length; i++) {
                    if (foundCSINamesFnum[i].startsWith(scData.prov)) {
                        let parts = foundCSINamesFnum[i].split('::');
                        csiFnum = parts[1];
                        break;
                    }
                }

                buildSlice(tX, -7, tZ, csiFnum.toString(), 'n');

                let csidriverInner =
                    '<div class="vpkfont vpkblue ml-1">' +
                    '<div id="sliceKey">' +
                    csiFnum +
                    //'.' +
                    // c +
                    '</div>' +
                    '<a href="javascript:getDefFnum(\'' +
                    csiFnum +
                    '\')">' +
                    '<img src="images/k8/csidriver.svg" class="icon"></a>' +
                    '<span class="pl-2 pb-2 vpkfont-sm">(Press to view resource)' +
                    '</span>' +
                    '<br>' +
                    '<span class="vpkfont-slidein"><b>CSIDriver <br>(Container Storage Interface Driver)</b>' +
                    '<br><hr class="hrLine">' +
                    '<span><b>Name : </b><span class="pl-2">' +
                    scData.prov +
                    '</span></span>' +
                    '</span>' +
                    '<br>' +
                    checkOwnerRef(csiFnum, 'cluster-level', 'CSIDriver') +
                    '</div>';

                sphere1.actionManager = new BABYLON.ActionManager(scene);
                sphere1.actionManager.registerAction(
                    new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnPickTrigger, function () {
                        document.getElementById('resourceProps').innerHTML = csidriverInner;
                        if ($('#clusterFilterSound').prop('checked')) {
                            clickSound.play();
                        }
                        showRing();
                    }),
                );

                addMesh(sphere1, 'ClusterLevel', 'CSIDriver', csiFnum, '');
            }
            // connection lines to PVCs
            if (typeof scData.pv[0] !== 'undefined') {
                for (let c = 0; c < scData.pv.length; c++) {
                    path = [new BABYLON.Vector3(pX, pY - 7, pZ), new BABYLON.Vector3(scData.pv[c].x, scData.pv[c].y - 5, scData.pv[c].z)];

                    scToPVNumber++;
                    if (typeof scToPVLink[scData.pv[c].pvFnum] !== 'undefined') {
                        scToPVLink[scData.pv[c].pvFnum] = 'scLink' + scToPVNumber;
                    }

                    let stick = BABYLON.MeshBuilder.CreateTube(
                        'scLink' + scToPVNumber,
                        { path: path, radius: 0.0075, sideOrientation: BABYLON.Mesh.DOUBLESIDE },
                        scene,
                    );
                    stick.material = stickColor;

                    addMesh(stick, 'ClusterLevel', 'StorageClassLine', scData.pv[c].pFnum, '');
                }
            }
            // update angle for next storage class to be defined
            angle += PI2 / max;
        }
    }

    //==============================================
    // Build the Container Storage Interface band
    function buildCSIStoragePlane() {
        // Determin if CSI wall/plane should be created
        if (foundCSINames.length === 0) {
            return;
        }
        // Build the pale read band to link the CSI related items
        let tX, tZ;
        let csiStorageArc1 = [];
        let csiStorageArc2 = [];
        for (let i = 0; i < 361; i++) {
            tX = (maxRings + 1.5) * Math.sin(ARC * i);
            tZ = (maxRings + 1.5) * Math.cos(ARC * i);
            csiStorageArc1.push(new BABYLON.Vector3(tX, -0.66, tZ));
            csiStorageArc2.push(new BABYLON.Vector3(tX, -0.85, tZ));
        }

        let csiStorageWall = BABYLON.MeshBuilder.CreateRibbon('csiStorageWall', {
            pathArray: [csiStorageArc1, csiStorageArc2],
            sideOrientation: BABYLON.Mesh.DOUBLESIDE,
        });
        csiStorageWall.material = csiStorageWallColor;

        let inner =
            '<div class="vpkfont vpkblue ml-1">' +
            '<div id="sliceKey">666.0</div>' +
            '<span>' +
            '<img src="images/k8/sc.svg" class="icon"></span>' +
            '<span>&nbsp;' +
            '</span>' +
            '<br>' +
            '<span class="vpkfont-slidein""><b>CSI related</b>' +
            '<br><hr class="hrLine">' +
            '<span><b>Name : </b><span class="pl-2">CSI (Container Storage Interface) related CSINode, CSIDriver, and CSICapacity</span></span>' +
            '</span></div>';

        csiStorageWall.actionManager = new BABYLON.ActionManager(scene);
        csiStorageWall.actionManager.registerAction(
            new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnPickTrigger, function () {
                document.getElementById('resourceProps').innerHTML = inner;
                if ($('#clusterFilterSound').prop('checked')) {
                    clickSound.play();
                }
                showRing();
            }),
        );
        buildSlice(tX, -0.75, tZ, '666.0', 'n');
        addMesh(csiStorageWall, 'ClusterLevel', 'CSIWall', 100, '');
        // Save to location of the CSI wall in the arrae
        ptrCSIWall = meshArray.length;
    }

    //==============================================
    // Build the Control Plane curved wall
    function buildControlPlane() {
        //Build Control Plane arc
        let controlPlaneInner = '';
        let steps = 360 / nodeCnt;

        mstArc = [];
        let controlPlaneArc1 = [];
        let controlPlaneArc2 = [];

        let tX, tZ;

        if (steps === 0) {
            steps = 360;
        }

        if (nodeCnt === 1) {
            // Ensure a full control plane circle is defined
            beginArc = 0;
            endArc = 180;
        } else {
            // Define control plane arc at master nodes
            beginArc = steps * mstStart;
            endArc = steps * (mstStop + 1);
        }

        if (compStatus.length > 0) {
            endArc = beginArc + compStatus.length * 4 + 4;
        }

        // Save end arc point for use in drawing OthersPlane
        saveEndArc = endArc;

        beginArc = 0;
        endArc = 361;

        for (let i = beginArc; i < endArc; i++) {
            pX = (maxRings + CONTROLPLANE) * Math.sin(ARC * i);
            pZ = (maxRings + CONTROLPLANE) * Math.cos(ARC * i);
            mstArc.push(new BABYLON.Vector3(pX, 0, pZ));

            tX = (maxRings + CONTROLPLANE) * Math.sin(ARC * i);
            tZ = (maxRings + CONTROLPLANE) * Math.cos(ARC * i);
            controlPlaneArc1.push(new BABYLON.Vector3(tX, 0.25, tZ));
            controlPlaneArc2.push(new BABYLON.Vector3(tX, -0.25, tZ));
        }

        controlPlaneInner =
            '<div class="vpkfont vpkblue ml-1">' +
            '<div id="sliceKey">999.9</div>' +
            '<span>' +
            '  <img src="images/k8/control-plane.svg" class="icon"></span>' +
            '<span class="pl-2 pb-2 vpkfont-sm">&nbsp;' +
            '  </span>' +
            '<br>' +
            '<span class="vpkfont-slidein"><b>Cluster Control Plane</b>' +
            '<br><hr class="hrLine"><br>' +
            '<span>Multiple components comprise the Control Plane.  Click on each component to view additional information.</span>' +
            '</span></div>';

        // light purple cylinder around the Nodes for the control plane
        let controlPlaneWall = BABYLON.MeshBuilder.CreateRibbon('controlPlaneWall', {
            pathArray: [controlPlaneArc1, controlPlaneArc2],
            sideOrientation: BABYLON.Mesh.DOUBLESIDE,
        });
        controlPlaneWall.material = controlPlaneWallColor;

        // register click event for object
        controlPlaneWall.actionManager = new BABYLON.ActionManager(scene);
        controlPlaneWall.actionManager.registerAction(
            new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnPickTrigger, function () {
                document.getElementById('resourceProps').innerHTML = controlPlaneInner;
                if ($('#clusterFilterSound').prop('checked')) {
                    clickSound.play();
                }
                showRing();
            }),
        );

        buildSlice(pX, 0, pZ, '999.9', 'n');
        addControlP(controlPlaneWall, 'ControlPlane');

        // Add the control plane components to the tube and curved wall
        buildControlPlaneComponents(beginArc, endArc);

        // The cylinder aroung the spoke wheel that represents
        // the sotrage CSI
        buildCSIStoragePlane(controlPlaneInner);

        // Process all the resource planes
        buildOthers();
    }

    //==============================================
    // Build the Control Plane components that were found with
    // in the ComponentStatus resources
    function buildControlPlaneComponents(beginArc, endArc) {
        beginArc = parseInt(beginArc);
        let aa = beginArc + 4;
        let tX, tZ;
        if (compStatus.length > 0) {
            compStatus.push({ name: 'API Server', fnum: '888.8' });
            for (let p = 0; p < compStatus.length; p++) {
                pX = (maxRings + CONTROLPLANE + 1) * Math.sin(angleArray[aa]);
                pZ = (maxRings + CONTROLPLANE + 1) * Math.cos(angleArray[aa]);

                // Add horizontal line/stick
                tX = (maxRings + CONTROLPLANE) * Math.sin(angleArray[aa]);
                tZ = (maxRings + CONTROLPLANE) * Math.cos(angleArray[aa]);
                let epPath = [new BABYLON.Vector3(tX, 0, tZ), new BABYLON.Vector3(pX, 0, pZ)];
                let controlPlaneStick = BABYLON.MeshBuilder.CreateTube(
                    'tube',
                    { path: epPath, radius: 0.0075, sideOrientation: BABYLON.Mesh.DOUBLESIDE },
                    scene,
                );
                controlPlaneStick.material = cpStickColor;
                addControlP(controlPlaneStick, 'ControlPlaneComponent');

                let img = 'k8.svg';
                let cN = compStatus[p].name;
                if (cN.startsWith('etc')) {
                    img = 'etcd.svg';
                    cN = 'etcd';
                } else if (cN.startsWith('sched')) {
                    img = 'sched.svg';
                    cN = 'Scheduler';
                } else if (cN.startsWith('control')) {
                    img = 'c-m.svg';
                    cN = 'Controller manager';
                } else if (cN.startsWith('API')) {
                    img = 'api.svg';
                    cN = 'API server';
                } else {
                    cN = 'Control Plane component';
                }

                let controlPlaneInner =
                    '<div class="vpkfont vpkblue ml-1">' +
                    '<div id="sliceKey">' +
                    compStatus[p].fnum +
                    '</div>' +
                    '<a href="javascript:getDefFnum(\'' +
                    compStatus[p].fnum +
                    '\')">' +
                    '<img src="images/k8/' +
                    img +
                    '" class="icon"></a>' +
                    '<span class="pl-2 pb-2 vpkfont-sm">(Press to view resource)' +
                    '</span>' +
                    '<br>' +
                    '<span class="vpkfont-slidein"><b>' +
                    cN +
                    '</b>' +
                    '<br><hr class="hrLine">' +
                    '<span><b>Name : </b><span class="pl-2">' +
                    compStatus[p].name +
                    '</span></span>' +
                    '</span></div>';

                buildControlComponent(
                    pX,
                    0,
                    pZ,
                    0.8,
                    0.4,
                    3,
                    controlPlaneColor,
                    'cluster-level',
                    'ControlPlaneComponent',
                    compStatus[p].fnum,
                    controlPlaneInner,
                    '',
                    compStatus[p].fnum,
                );
                buildSlice(pX, 0, pZ, compStatus[p].fnum, 'n');

                if (cN === 'API server') {
                    // Add horizontal line/stick for kubectl
                    let kX = (maxRings + CONTROLPLANE + 4) * Math.sin(angleArray[aa]);
                    let kZ = (maxRings + CONTROLPLANE + 4) * Math.cos(angleArray[aa]);
                    epPath = [new BABYLON.Vector3(tX, 0, tZ), new BABYLON.Vector3(kX, 0, kZ)];

                    let kubectlStick = BABYLON.MeshBuilder.CreateTube(
                        'tube',
                        { path: epPath, radius: 0.0075, sideOrientation: BABYLON.Mesh.DOUBLESIDE },
                        scene,
                    );
                    kubectlStick.material = cpStickColor;
                    addControlP(kubectlStick, 'ControlPlaneComponent');

                    // kubectl link to the API Server
                    let sphere1 = BABYLON.MeshBuilder.CreateSphere('kubectl', { diameter: 0.35, segments: 32 }, scene);
                    sphere1.position.x = kX;
                    sphere1.position.y = 0;
                    sphere1.position.z = kZ;
                    sphere1.material = controlPlaneColor;
                    buildSlice(kX, 0, kZ, '998.9', 'n');

                    let kubectlInner =
                        '<div class="vpkfont vpkblue ml-1">' +
                        '<div id="sliceKey">998.9</div>' +
                        '<span>' +
                        '<img src="images/k8/k8.svg" class="icon"></span>' +
                        '<span class="pl-2 pb-2 vpkfont-sm">&nbsp;' +
                        '</span>' +
                        '<br>' +
                        '<span class="vpkfont-slidein"><b>kubectl</b>' +
                        '<br><hr class="hrLine"><br>' +
                        '<span>CLI (Command Line Interface) that communicates with the cluster.  This is normally installed on the user, developer, or ' +
                        'administrator machine.</span>' +
                        '</span></div>';

                    sphere1.actionManager = new BABYLON.ActionManager(scene);
                    sphere1.actionManager.registerAction(
                        new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnPickTrigger, function () {
                            document.getElementById('resourceProps').innerHTML = kubectlInner;
                            if ($('#clusterFilterSound').prop('checked')) {
                                clickSound.play();
                            }
                            showRing();
                        }),
                    );
                    addControlP(sphere1, 'KubeCTL');
                }

                // position for the next increment in the curved wall
                if (maxRings < 3.5) {
                    aa = aa + 4.0;
                } else {
                    aa = aa + 3.0;
                }
            }
        }
        // ToDo need to determine where this really should be built
        buildRegistry(aa);

        saveEndArc = aa + 3;
    }

    //==============================================
    // Build the stack of registries that were found
    // as the source for the container images
    function buildRegistry(aa) {
        aa = aa + 2;
        if (imageRepository !== '') {
            let y = 0;
            let yInc = -0.3;
            let rFnum = 700;
            let irKeys = Object.keys(imageRepository);

            pX = (maxRings + CONTROLPLANE + 4) * Math.sin(angleArray[aa]);
            pZ = (maxRings + CONTROLPLANE + 4) * Math.cos(angleArray[aa]);

            // Add horizontal line/stick
            tX = (maxRings + CONTROLPLANE) * Math.sin(angleArray[aa]);
            tZ = (maxRings + CONTROLPLANE) * Math.cos(angleArray[aa]);
            let epPath = [new BABYLON.Vector3(tX, 0, tZ), new BABYLON.Vector3(pX, 0, pZ)];
            let controlPlaneStick = BABYLON.MeshBuilder.CreateTube(
                'tube',
                { path: epPath, radius: 0.0075, sideOrientation: BABYLON.Mesh.DOUBLESIDE },
                scene,
            );
            controlPlaneStick.material = cpStickColor;
            addControlP(controlPlaneStick, 'Registry');

            let tmpReg = [];
            let rKey;
            let rTmp;
            let fp;
            for (let p = 0; p < irKeys.length; p++) {
                rKey = imageRepository[irKeys[p]];
                if (rKey < 10) {
                    rKey = '0000' + rKey;
                } else if (rKey < 100) {
                    rKey = '000' + rKey;
                } else if (rKey < 1000) {
                    rKey = '00' + rKey;
                } else if (rKey < 10000) {
                    rKey = '0' + rKey;
                }

                rKey = rKey + '::' + irKeys[p];
                tmpReg.push(rKey);
            }
            tmpReg.sort();
            tmpReg.reverse();
            irKeys = [];
            for (let p = 0; p < tmpReg.length; p++) {
                rTmp = tmpReg[p].split('::');
                irKeys.push(rTmp[1]);
            }
            tmpReg = null;

            for (let p = 0; p < irKeys.length; p++) {
                let img = 'k8.svg';
                let cN = 'Registry';
                let imageRegInner =
                    '<div class="vpkfont vpkblue ml-1">' +
                    '<div id="sliceKey">' +
                    rFnum.toString() +
                    '</div>' +
                    '<span>' +
                    '<img src="images/k8/' +
                    img +
                    '" class="icon"></span>' +
                    '<span class="pl-2 pb-2 vpkfont-sm">&nbsp;' +
                    '</span>' +
                    '<br>' +
                    '<span class="vpkfont-slidein"><b>' +
                    cN +
                    '</b>' +
                    '<br><hr class="hrLine">' +
                    '<table>' +
                    '<tr><td><b>Name:</b></td><td class="pl-2">' +
                    irKeys[p] +
                    '</td></tr>' +
                    '<tr><td><b>Use count:</b></td><td class="pl-2">' +
                    imageRepository[irKeys[p]] +
                    '</td></tr>' +
                    '</table>' +
                    // + '<span><b>Name : </b><span class="pl-2">' + irKeys[p] + '</span></span>'
                    // + '<br>'
                    // + '<span><b>Use count : </b><span class="pl-2">' + imageRepository[irKeys[p]] + '</span></span>'
                    // + '</span>'
                    '<br>' +
                    '<button type="button" class="ml-1 mt-4 btn btn-primary btn-sm vpkButton" ' +
                    ' onclick="showRegistry(\'' +
                    irKeys[p] +
                    "','G','Cluster')\">Container</button>" +
                    '</div>';

                buildControlComponent(
                    pX,
                    y,
                    pZ,
                    0.2,
                    0.4,
                    32,
                    registryColor,
                    'cluster-level',
                    'ControlPlaneComponent',
                    rFnum.toString(),
                    imageRegInner,
                    '',
                    irKeys[p],
                );
                buildSlice(pX, y, pZ, rFnum.toString(), 'n');

                y = y + yInc;
                rFnum++;
            }
        }
    }

    //==============================================
    // build line to connect Node storage to Node
    function buildNodeStorageLine(sX, sY, sZ, eX, eY, eZ, name) {
        let epPath = [new BABYLON.Vector3(sX, sY, sZ), new BABYLON.Vector3(eX, eY, eZ)];

        let stick = BABYLON.MeshBuilder.CreateTube(name, { path: epPath, radius: 0.0075, sideOrientation: BABYLON.Mesh.DOUBLESIDE }, scene);
        stick.material = stickColor;

        // FNUM FIX
        addMesh(stick, 'ClusterLevel', 'Node', '0000.0', '');
    }

    //==============================================
    // build line to connect CSINode to Node
    function buildCSILine(sX, sY, sZ, eX, eY, eZ, name) {
        let epPath = [new BABYLON.Vector3(sX, sY, sZ), new BABYLON.Vector3(eX, eY, eZ)];

        let stick = BABYLON.MeshBuilder.CreateTube(name, { path: epPath, radius: 0.0075, sideOrientation: BABYLON.Mesh.DOUBLESIDE }, scene);
        stick.material = csiStickColor;

        // FNUM FIX
        addMesh(stick, 'ClusterLevel', 'CSILine', '0000.0', '');
    }

    //==============================================
    // build node kubelet and kube-proxy
    function buildKublet(x, y, z, index) {
        // Add line from Node up that will contain the kubelet, kube-proxy and connect to the control plane
        let path = [new BABYLON.Vector3(x, 0, z), new BABYLON.Vector3(x, 1.5, z)];
        let stick = BABYLON.MeshBuilder.CreateTube('tube', { path: path, radius: 0.0075, sideOrientation: BABYLON.Mesh.DOUBLESIDE }, scene);
        stick.material = cpStickColor;
        addControlP(stick, 'Kubelet-Link');

        // Add horizontal line/stick to the same radius as the control plane
        let tX, tZ;
        tX = (maxRings + CONTROLPLANE) * Math.sin(angle);
        tZ = (maxRings + CONTROLPLANE) * Math.cos(angle);
        path = [new BABYLON.Vector3(x, 1.5, z), new BABYLON.Vector3(tX, 1.5, tZ)];
        stick = BABYLON.MeshBuilder.CreateTube('tube', { path: path, radius: 0.0075, sideOrientation: BABYLON.Mesh.DOUBLESIDE }, scene);
        stick.material = cpStickColor;
        addControlP(stick, 'Kubelet-Link');

        // Add line down to the Control Plane
        path = [new BABYLON.Vector3(tX, 0.25, tZ), new BABYLON.Vector3(tX, 1.5, tZ)];
        stick = BABYLON.MeshBuilder.CreateTube('tube', { path: path, radius: 0.0075, sideOrientation: BABYLON.Mesh.DOUBLESIDE }, scene);
        stick.material = cpStickColor;

        addControlP(stick, 'Kubelet-Link');

        // kubelet
        y = 1.5;
        let fnum = 500 + index;
        let sphere1 = BABYLON.MeshBuilder.CreateSphere('k-proxy', { diameter: 0.25, segments: 32 }, scene);
        sphere1.position.x = x;
        sphere1.position.y = y;
        sphere1.position.z = z;
        sphere1.material = controlPlaneColor;
        buildSlice(x, y, z, fnum.toString(), 'n');

        let kubeletInner =
            '<div class="vpkfont vpkblue ml-1">' +
            '<div id="sliceKey">' +
            fnum +
            '</div>' +
            '<span>' +
            '<img src="images/k8/kubelet.svg" class="icon"></span>' +
            '<span class="pl-2 pb-2 vpkfont-sm">&nbsp;' +
            '</span>' +
            '<br>' +
            '<span class="vpkfont-slidein"><b>Node kublet</b>' +
            '<br><hr class="hrLine">' +
            '<span><b>Name : </b><span class="pl-2">&lt;none&gt;</span></span>' +
            '</span></div>';

        sphere1.actionManager = new BABYLON.ActionManager(scene);
        sphere1.actionManager.registerAction(
            new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnPickTrigger, function () {
                document.getElementById('resourceProps').innerHTML = kubeletInner;
                if ($('#clusterFilterSound').prop('checked')) {
                    clickSound.play();
                }
                showRing();
            }),
        );
        addControlP(sphere1, 'Kubelet');

        // kube-proxy
        y = 0.95;
        let pnum = 400 + index;
        let sphere2 = BABYLON.MeshBuilder.CreateSphere('k-proxy', { diameter: 0.25, segments: 32 }, scene);
        sphere2.position.x = x;
        sphere2.position.y = y;
        sphere2.position.z = z;
        sphere2.material = controlPlaneColor;
        buildSlice(x, y, z, pnum.toString(), 'n');

        let proxyInner =
            '<div class="vpkfont vpkblue ml-1">' +
            '<div id="sliceKey">' +
            pnum +
            '</div>' +
            '<span>' +
            '<img src="images/k8/k-proxy.svg" class="icon"></span>' +
            '<span class="pl-2 pb-2 vpkfont-sm">&nbsp;' +
            '</span>' +
            '<br>' +
            '<span class="vpkfont-slidein"><b>Node kube-proxy</b>' +
            '<br><hr class="hrLine">' +
            '<span><b>Name : </b><span class="pl-2">&lt;none&gt;</span></span>' +
            '</span></div>';

        sphere2.actionManager = new BABYLON.ActionManager(scene);
        sphere2.actionManager.registerAction(
            new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnPickTrigger, function () {
                document.getElementById('resourceProps').innerHTML = proxyInner;
                if ($('#clusterFilterSound').prop('checked')) {
                    clickSound.play();
                }
                showRing();
            }),
        );
        addControlP(sphere2, 'Kube-Proxy');
    }

    function buildNodesAndWall(index) {
        let adjF = (PI2 / max) * 2 * -1;
        angle += adjF;
        let size;
        let nName = cluster.nodes[nodePtr].name;
        if (buildWall === false) {
            // set x,y,z points for node icon
            pX = (maxRings + NODE_ICON_ADJ) * Math.sin(angle);
            pY = 0;
            pZ = (maxRings + NODE_ICON_ADJ) * Math.cos(angle);

            let csiDrvX = (maxRings + NODE_ICON_ADJ + 0.75) * Math.sin(angle);
            let csiDrvZ = (maxRings + NODE_ICON_ADJ + 0.75) * Math.cos(angle);

            let node = BABYLON.MeshBuilder.CreateBox(nName, { width: NODE_HEIGHT, height: NODE_HEIGHT, depth: NODE_HEIGHT });
            node.position.y = pY;
            node.position.x = pX;
            node.position.z = pZ;

            // Find the closet angleArray value and use that position in
            // the array as the angle in degrees
            let faceAngle = 0;
            for (let f = 0; f < angleArray.length; f++) {
                if (angleArray[f] > angle) {
                    faceAngle = f;
                    break;
                }
            }

            // Rotate the box so side1 is facing the center of the spoke
            let angleInDegrees = faceAngle;
            let angleInRadians = (angleInDegrees * Math.PI) / 180;
            node.rotation.y = angleInRadians;

            // Link Node to pie slice with horizontial line
            let tX, tZ;
            tX = maxRings * Math.sin(angle);
            tZ = maxRings * Math.cos(angle);

            let path = [new BABYLON.Vector3(tX, 0.05, tZ), new BABYLON.Vector3(pX, 0.05, pZ)];
            let stick = BABYLON.MeshBuilder.CreateTube('tube', { path: path, radius: 0.0075, sideOrientation: BABYLON.Mesh.DOUBLESIDE }, scene);
            stick.material = stickColor;
            addMesh(stick, 'ClusterLevel', 'Node', 'na', 'na');

            // Build kubelet and kube-proxy items
            buildKublet(pX, pY, pZ, index);

            let nType = '';
            let storage = '';
            let storageBase = '';
            let cpu = 0;
            let cpuBase = 0;
            let memory = 0;
            let memoryBase = 0;
            //let nName = cluster.nodes[nodePtr].name;
            let csiFnum;
            let csiInner;
            let csiX = pX;
            let csiHome = pX;

            // "m" is a Master node, otherwise treat as worker node
            if (cluster.nodes[nodePtr].type === 'm') {
                node.material = mstNodeMat;
                nType = MST_TYPE;
                mstCount++;
            } else {
                node.material = wrkNodeMat;
                nType = WRK_TYPE;
            }

            // Node related storage type
            // define the Node storage cylinder
            let nodeStrgX = (maxRings + NODE_ICON_ADJ + 1.75) * Math.sin(angle);
            let nodeStrgY = 0;
            let nodeStrgZ = (maxRings + NODE_ICON_ADJ + 1.75) * Math.cos(angle);

            nodeStorageInner =
                '<div class="vpkfont vpkblue ml-1">' +
                '<div id="sliceKey">' +
                '4444.' +
                cluster.nodes[nodePtr].fnum +
                '</div>' +
                '<a href="javascript:openNodeStorageCounts(\'' +
                nName +
                '\')">' +
                '<img src="images/3d/3d-volume.png" width="60" height"60"></a>' +
                '<span class="pl-2 pb-2 vpkfont-sm">(Press to open Storage tab view)' +
                '</span>' +
                '<br>' +
                '<span class="vpkfont-slidein"><b>Node storage</b>' +
                '<br><hr class="hrLine">' +
                'Storage defined at node i.e. configMap, emptyDir, secret, hostPath, etc.</b></span>' +
                '<br><br>' +
                '<span class="vpkfont-slidein"><b>Node name:  </b>' +
                nName +
                '</span>' +
                '<br>' +
                checkOwnerRef('4444.' + cluster.nodes[nodePtr].fnum, 'cluster-level', 'NODE-Storage') +
                '<button type="button" class="ml-1 mt-4 btn btn-primary btn-sm vpkButton" ' +
                ' onclick="openNodeStorageCounts(\'' +
                nName +
                '\')">Storage</button>' +
                '</div>';

            cluster.nodes[nodePtr];

            //buildCylinder(nodeStrgX, -1.25, nodeStrgZ, .4, .25, 16, nodeStorage, 'ClusterLevel', 'Node', '4444.' + index, nodeStorageInner, '', '4444.' + index)
            //buildSlice(nodeStrgX, -1.25, nodeStrgZ, '4444.' + index, 'n')

            buildCylinder(
                nodeStrgX,
                -1.25,
                nodeStrgZ,
                0.4,
                0.25,
                16,
                nodeStorage,
                'ClusterLevel',
                'Node',
                '4444.' + cluster.nodes[nodePtr].fnum,
                nodeStorageInner,
                '',
                '4444.' + cluster.nodes[nodePtr].fnum,
            );
            buildSlice(nodeStrgX, -1.25, nodeStrgZ, '4444.' + cluster.nodes[nodePtr].fnum, 'n');
            // Connect Cylinder to the Node
            buildNodeStorageLine(nodeStrgX, nodeStrgY, nodeStrgZ, pX, pY, pZ, '4444.' + cluster.nodes[nodePtr].fnum);

            let nsPath = [new BABYLON.Vector3(nodeStrgX, -1.25, nodeStrgZ), new BABYLON.Vector3(nodeStrgX, 0, nodeStrgZ)];
            let upStick = BABYLON.MeshBuilder.CreateTube(
                '4444.' + cluster.nodes[nodePtr].fnum,
                { path: nsPath, radius: 0.0075, sideOrientation: BABYLON.Mesh.DOUBLESIDE },
                scene,
            );
            upStick.material = stickColor;
            //addMesh(upStick, 'ClusterLevel', 'Node', '4444.' + index, '')
            addMesh(upStick, 'ClusterLevel', 'Node', '4444.' + cluster.nodes[nodePtr].fnum, '');

            // CSINode information
            if (typeof cluster.nodes[nodePtr].csiNodes !== 'undefined') {
                if (typeof cluster.nodes[nodePtr].csiNodes[0] !== 'undefined') {
                    data = cluster.nodes[nodePtr].csiNodes;
                    if (cluster.nodes[nodePtr].csiNodes[0].drivers !== null) {
                        let yDown = -0.5;
                        for (let c = 0; c < cluster.nodes[nodePtr].csiNodes[0].drivers.length; c++) {
                            yDown = yDown + -0.5;
                            if (typeof cluster.nodes[nodePtr].csiNodes[0].fnum !== 'undefined') {
                                csiInner =
                                    '<div class="vpkfont vpkblue ml-1">' +
                                    '<div id="sliceKey">' +
                                    cluster.nodes[nodePtr].csiNodes[0].fnum +
                                    '.' +
                                    c +
                                    '</div>' +
                                    '<a href="javascript:getDefFnum(\'' +
                                    cluster.nodes[nodePtr].csiNodes[0].fnum +
                                    '\')">' +
                                    '<img src="images/k8/csinode.svg" class="icon"></a>' +
                                    '<span class="pl-2 pb-2 vpkfont-sm">(Press to view resource)' +
                                    '</span>' +
                                    '<br>' +
                                    '<span class="vpkfont-slidein"><b>CSINode <br>(Container Storage Interface Node)</b>' +
                                    '<br><hr class="hrLine">' +
                                    '<span><b>Name : </b><span class="pl-2">' +
                                    cluster.nodes[nodePtr].csiNodes[0].drivers[c].name +
                                    '</span></span>' +
                                    '</span>' +
                                    '<br>' +
                                    checkOwnerRef(cluster.nodes[nodePtr].csiNodes[0].fnum, 'cluster-level', 'CSINode') +
                                    '</div>';

                                // define the csiNode
                                buildSphere(
                                    csiX,
                                    yDown,
                                    pZ,
                                    0.25,
                                    32,
                                    csiStorageWallColor,
                                    'ClusterLevel',
                                    'CSINode',
                                    cluster.nodes[nodePtr].fnum,
                                    csiInner,
                                    cluster.nodes[nodePtr].csiNodes[0].fnum,
                                );
                                buildSlice(csiX, yDown, pZ, cluster.nodes[nodePtr].csiNodes[0].fnum + '.' + c, 'n');
                                buildCSILine(csiX, yDown, pZ, csiHome, pY, pZ, cluster.nodes[nodePtr].csiNodes[0].fnum);

                                // build csiLine to the csiWall
                                if (c === 0) {
                                    buildCSILine(csiDrvX, -0.75, csiDrvZ, csiHome, -0.75, pZ, cluster.nodes[nodePtr].csiNodes[0].fnum);
                                }

                                //save the volumeAttachments
                                if (typeof cluster.nodes[nodePtr].csiNodes[0].drivers[c].volAtt !== 'undefined') {
                                    if (cluster.nodes[nodePtr].csiNodes[0].drivers[c].volAtt.length > 0) {
                                        for (let v = 0; v < cluster.nodes[nodePtr].csiNodes[0].drivers[c].volAtt.length; v++) {
                                            volKey = cluster.nodes[nodePtr].csiNodes[0].drivers[c].volAtt[v].pvName;
                                            if (typeof pvToVolAttLinks[volKey] === 'undefined') {
                                                pvToVolAttLinks[volKey] = [];
                                            }
                                            pvToVolAttLinks[volKey].push({
                                                fnum: cluster.nodes[nodePtr].csiNodes[0].drivers[c].volAtt[v].fnum,
                                                x: csiX,
                                                y: pY - 5,
                                                z: pZ,
                                            });
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // Node CPU resource cylinder
            if (typeof nodeSpace[nName] !== 'undefined') {
                size = nodeSpace[nName];
                storageBase = size;
                storage = formatBytes(size);
            }

            // Node Memory resource cylinder
            size = cluster.nodes[nodePtr].c_memory;
            size = size.substring(0, size.length - 2);
            if (size > 0) {
                memoryBase = size;
                memory = formatBytes(size * 1024);
            } else {
                memoryBase = 0;
                memory = 'Unknown';
            }

            // Node CPU resource cylinder
            size = cluster.nodes[nodePtr].c_cpu;
            if (size > 0) {
                cpuBase = size;
                cpu = size;
            } else {
                cpu = 'Unknown';
            }

            // Node storage cylinder
            if (typeof nodeSpace[nName] !== 'undefined') {
                size = nodeSpace[nName];
                storage = formatBytes(size);
            } else {
                storage = 'None';
            }

            let nTxt =
                '<div class="vpkfont vpkblue ml-1">' +
                '<div id="sliceKey">' +
                cluster.nodes[nodePtr].fnum +
                '</div>' +
                '<a href="javascript:getDefFnum(\'' +
                cluster.nodes[nodePtr].fnum +
                '\')">' +
                '<img src="images/k8/node.svg" class="icon"></a>' +
                '<span class="pl-2 pb-2 vpkfont-sm">(Press to view resource)' +
                '</span>' +
                '<br>' +
                '<span class="vpkfont-slidein"><b>Node</b>' +
                '<br><hr class="hrLine">' +
                '<table>' +
                '<tr><td><b>Name:</b></td><td class="pl-2">' +
                nName +
                '</td></tr>' +
                '<tr><td><b>Type:</b></td><td class="pl-2">' +
                nType +
                '</td></tr>' +
                '<tr><td><b>CPU:</b></td><td class="pl-2">' +
                cpu +
                '</td></tr>' +
                '<tr><td><b>Memory:</b></td><td class="pl-2">' +
                memory +
                '</td></tr>' +
                '<tr><td><b>Storage:</b></td><td class="pl-2">' +
                storage +
                '</td></tr>' +
                '</table>' +
                '<br>' +
                checkOwnerRef(cluster.nodes[nodePtr].fnum, 'cluster-level', 'Node') +
                '<button type="button" class="ml-1 mt-2 btn btn-primary btn-sm vpkButton" ' +
                ' onclick="openNodeInfo(\'' +
                nName +
                '::' +
                nType +
                '\')">Node Info</button>' +
                '</div>';

            // register click event for each node;
            node.actionManager = new BABYLON.ActionManager(scene);
            node.actionManager.registerAction(
                new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnPickTrigger, function () {
                    document.getElementById('resourceProps').innerHTML = nTxt;
                    if ($('#clusterFilterSound').prop('checked')) {
                        clickSound.play();
                    }
                    showRing();
                }),
            );

            addMesh(node, 'ClusterLevel', 'Node', 'na', 'na');
            buildSlice(pX, pY, pZ, cluster.nodes[nodePtr].fnum, 'b');

            if (memoryBase > 0) {
                size = memoryBase;
                size = memoryBase / 10000 / 1000;
                //buildMemCPUResource(pX - 0.14, pY + .65, pZ + 0.14, size, 0.25, 3, nodeMemoryColor, 'ClusterLevel', 'NodeMemory', fnum, nTxt)
                buildMemCPUResource(pX - 0.14, pY + 0.65, pZ + 0.14, size, 0.25, 3, nodeMemoryColor, 'ClusterLevel', 'NodeMemory', '0000.0', nTxt);
            }

            if (cpuBase > 0) {
                size = cpu / 2;
                //buildMemCPUResource(pX + 0.14, pY + .65, pZ - 0.14, size, 0.25, 3, nodeCPUColor, 'ClusterLevel', 'NodeCPU', fnum, nTxt)
                buildMemCPUResource(pX + 0.14, pY + 0.65, pZ - 0.14, size, 0.25, 3, nodeCPUColor, 'ClusterLevel', 'NodeCPU', '0000.0', nTxt);
            }

            if (storageBase > 0) {
                size = storageBase / 100000;
                size = size / 10000;
                size = size / 50;
                size = size * -1;
                //buildMemCPUResource(pX, pY - .45, pZ, size, 0.10, 3, nodeStorageColor, 'ClusterLevel', 'NodeStorage', fnum, nTxt)
                buildMemCPUResource(pX, pY - 0.45, pZ, size, 0.1, 3, nodeStorageColor, 'ClusterLevel', 'NodeStorage', '0000.0', nTxt);
            }

            buildWall = true;
            nodePtr++;
        } else {
            // set start points for wall and adjust
            if (index === 0) {
                angle = nodeEndAngles[index] - 0.04;
            } else {
                angle = nodeEndAngles[index] - 0.02;
            }

            sX = RADIUSINNER * Math.sin(angle);
            sY = 0;
            sZ = RADIUSINNER * Math.cos(angle);
            // set end points for wall
            pX = maxRings * Math.sin(angle);
            pY = 0;
            pZ = maxRings * Math.cos(angle);
            // if single node in cluster no wall is built
            if (max !== 2) {
                createWall(pX, pY, pZ, sX, sY, sZ, WALL_HEIGHT, index);
                buildWall = false;
            } else {
                buildWall = false;
            }
        }
        // update angle for next item to be defined
        angle += PI2 / max;
    }

    //==============================================
    // build a cylinder for the red slice when object is selected
    function buildIngressSlice() {
        if (ingressArray.length === 0) {
            return;
        }
        let ingSlice = BABYLON.MeshBuilder.CreateCylinder('slice', {
            height: SLICE_HEIGHT,
            diameterTop: INGRESSRADIUS,
            diameterBottom: INGRESSRADIUS,
            tessellation: 32,
        });
        ingSlice.position.y = INGRESSHEIGHT;
        ingSlice.position.x = 0;
        ingSlice.position.z = 0;
        ingSlice.material = ingressColor;
        // register click event for object
        // ingSlice.actionManager = new BABYLON.ActionManager(scene);
        // ingSlice.actionManager.registerAction(new BABYLON.ExecuteCodeAction(
        //     BABYLON.ActionManager.OnPickTrigger,
        //     function () {
        //         document.getElementById("resourceProps").innerHTML = '<p class="mt-3">One or more Ingress are defined</p>';
        //     }
        // ));
        addMesh(ingSlice, 'ClusterLevel', 'ingress', 'na', 'na');
        let iArc = 0;
        let iData;
        for (let i = 0; i < ingressArray.length; i++) {
            iArc = iArc + 30;
            iData = ingressArray[i];
            let ns = iData[0].namespace;
            let inner =
                '<div class="vpkfont vpkblue ml-1">' +
                '<div id="sliceKey">' +
                iData[0].fnum +
                '</div>' +
                '<a href="javascript:getDefFnum(\'' +
                iData[0].fnum +
                '\')">' +
                '<img src="images/k8/ing.svg" class="icon"></a>' +
                '<span class="pl-2 pb-2 vpkfont-sm">(Press to view resource)</span>' +
                '<br><b>Ingress</b>' +
                '<br><hr class="hrLine">' +
                '<table>' +
                '<tr><td><b>Name:</b></td><td class="pl-2">' +
                iData[0].name +
                '</td></tr>' +
                '<tr><td><b>Kind:</b></td><td class="pl-2">' +
                iData[0].kind +
                '</td></tr>' +
                '</table>' +
                // + '<div class="vpkfont vpkblue ml-1">'
                // + '<span><b>Name : </b>' + iData[0].name + '</span></span>'
                // + '<br>'
                // + '<span><b>Kind : </b><span class="pl-2">' + iData[0].kind + '</span></span>'
                ' <br>' +
                '</div>';

            let sphere = BABYLON.MeshBuilder.CreateSphere('other', { diameter: 0.35, segments: 32 }, scene);

            pX = (INGRESSRADIUS - 1.2) * Math.sin(angleArray[iArc]);
            pZ = (INGRESSRADIUS - 1.2) * Math.cos(angleArray[iArc]);

            sphere.position.x = pX;
            sphere.position.y = INGRESSHEIGHT;
            sphere.position.z = pZ;
            sphere.material = ingressItemColor;

            // register click event for object
            sphere.actionManager = new BABYLON.ActionManager(scene);
            sphere.actionManager.registerAction(
                new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnPickTrigger, function () {
                    document.getElementById('resourceProps').innerHTML = inner;
                    if ($('#clusterFilterSound').prop('checked')) {
                        clickSound.play();
                    }
                    showRing();
                }),
            );
            addMesh(sphere, ns, 'ingress', iData[0].fnum, 'na');
            let tFnum = iData[0].fnum;
            tFnum = tFnum.toString();
            buildSlice(pX, INGRESSHEIGHT, pZ, tFnum, 'n');
        }
    }

    //==============================================
    // build other walls after the control plane wall
    function buildOthers() {
        let oFnum = 200;
        let wFnum = 800;
        beginArc = saveEndArc + 3;

        // calculate whole beginArc value
        let chkVal = beginArc - parseInt(beginArc);
        if (chkVal < 0.5) {
            beginArc = beginArc + 0.5;
        }
        beginArc = Math.round(beginArc);

        if (clusterRescWorkload.length > 0) {
            wFnum++;
            buildOtherPlane('Workload', calcPlaneSize(clusterRescWorkload.length), wFnum);
            buildOtherComponents('Workload', clusterRescWorkload, oFnum);
            oFnum = oFnum + clusterRescWorkload.length + 1;
            beginArc = endArc + 5;
        }

        if (clusterRescService.length > 0) {
            wFnum++;
            buildOtherPlane('Service', calcPlaneSize(clusterRescService.length), wFnum);
            buildOtherComponents('Service', clusterRescService, oFnum);
            oFnum = oFnum + clusterRescService.length + 1;
            beginArc = endArc + 5;
        }

        if (clusterRescConfigStorage.length > 0) {
            wFnum++;
            buildOtherPlane('ConfigStorage', calcPlaneSize(clusterRescConfigStorage.length), wFnum);
            buildOtherComponents('ConfigStorage', clusterRescConfigStorage, oFnum);
            oFnum = oFnum + clusterRescConfigStorage.length + 1;
            beginArc = endArc + 5;
        }

        if (clusterRescAuthentication.length > 0) {
            wFnum++;
            buildOtherPlane('Authentication', calcPlaneSize(clusterRescAuthentication.length), wFnum);
            buildOtherComponents('Authentication', clusterRescAuthentication, oFnum);
            oFnum = oFnum + clusterRescAuthentication.length + 1;
            beginArc = endArc + 5;
        }

        if (clusterRescAuthorization.length > 0) {
            wFnum++;
            buildOtherPlane('Authorization', calcPlaneSize(clusterRescAuthorization.length), wFnum);
            buildOtherComponents('Authorization', clusterRescAuthorization, oFnum);
            oFnum = oFnum + clusterRescAuthorization.length + 1;
            beginArc = endArc + 5;
        }

        if (clusterRescPolicy.length > 0) {
            wFnum++;
            buildOtherPlane('Policy', calcPlaneSize(clusterRescPolicy.length), wFnum);
            buildOtherComponents('Policy', clusterRescPolicy, oFnum);
            oFnum = oFnum + clusterRescPolicy.length + 1;
            beginArc = endArc + 5;
        }

        if (clusterRescExtend.length > 0) {
            wFnum++;
            buildOtherPlane('Extend', calcPlaneSize(clusterRescExtend.length), wFnum);
            buildOtherComponents('Extend', clusterRescExtend, oFnum);
            oFnum = oFnum + clusterRescExtend.length + 1;
            beginArc = endArc + 5;
        }

        if (clusterRescCluster.length > 0) {
            wFnum++;
            buildOtherPlane('Cluster', calcPlaneSize(clusterRescCluster.length), wFnum);
            buildOtherComponents('Cluster', clusterRescCluster, oFnum);
            oFnum = oFnum + clusterRescCluster.length + 1;
            beginArc = endArc + 5;
        }

        if (clusterRescOther.length > 0) {
            wFnum++;
            buildOtherPlane('Other', calcPlaneSize(clusterRescOther.length), wFnum);
            buildOtherComponents('Other', clusterRescOther, oFnum);
            beginArc = endArc + 5;
        }

        if (clusterRescThirdParty.length > 0) {
            wFnum++;
            buildOtherPlane('ThirdParty', calcPlaneSize(clusterRescThirdParty.length), wFnum);
            buildOtherComponents('ThirdParty', clusterRescThirdParty, oFnum);
            beginArc = endArc + 5;
        }
    }

    //==============================================
    // determine the size of the plane wall to be built
    function calcPlaneSize(cnt) {
        let w = cnt / 17;
        // Set width
        if (w > 1) {
            beginArc = beginArc - 1;
            endArc = beginArc + w * 2;
        } else {
            // w = parseInt(w, 10);
            beginArc = beginArc - 1;
            endArc = beginArc + 1;
        }

        let r = cnt % 17;
        if (r > 0) {
            endArc = endArc + 1;
        }

        // Calculate Height
        if (cnt < 17) {
            return cnt * 0.5 + 0.5;
        } else {
            return 17 * 0.5 + 0.5;
        }
    }

    //==============================================
    // Build the Control Plane curved wall
    function buildOtherPlane(type, oH, wFnum) {
        //Build Control Plane arc
        let otherPlaneInner = '';
        let otherPlaneArc1 = [];
        let otherPlaneArc2 = [];
        let tX, tZ;
        let startArc = beginArc - 1;

        for (let i = startArc; i < endArc; i++) {
            pX = (maxRings + CLUSTERLEVELPLANE) * Math.sin(ARC * i);
            pZ = (maxRings + CLUSTERLEVELPLANE) * Math.cos(ARC * i);
            mstArc.push(new BABYLON.Vector3(pX, 0.5, pZ));

            tX = (maxRings + CLUSTERLEVELPLANE) * Math.sin(ARC * i);
            tZ = (maxRings + CLUSTERLEVELPLANE) * Math.cos(ARC * i);
            otherPlaneArc1.push(new BABYLON.Vector3(tX, oH + 0.5, tZ));
            otherPlaneArc2.push(new BABYLON.Vector3(tX, 0.5, tZ));
        }

        otherPlaneInner =
            '<div class="vpkfont vpkblue ml-1">' +
            '<div id="sliceKey">' +
            wFnum +
            '</div>' +
            '<span>' +
            '<a href="javascript:k8sDocSite()">' +
            '<img src="images/k8/k8.svg" class="icon"></a>' +
            '<span class="vpkfont-sm">(Press to view K8s API docs)' +
            '</span>' +
            '</span>' +
            '<span class="pl-2 pb-2 vpkfont-sm">&nbsp;' +
            '</span>' +
            '<br>' +
            '<span class="vpkfont-slidein"><b>API category</b>' +
            '<br><hr class="hrLine">' +
            '<span class="vpkfont-slidein pr-2"><b>API Type:</b> ' +
            type +
            ' Resources</b>' +
            '</span><br><br>This is a category/group of APIs. Use search to locate and view specific resource definitions.</div>';

        // Build plane of resources for cluster
        let otherPlaneWall = BABYLON.MeshBuilder.CreateRibbon(type, {
            pathArray: [otherPlaneArc1, otherPlaneArc2],
            sideOrientation: BABYLON.Mesh.DOUBLESIDE,
        });
        // Set color of plane
        if (type === 'Workload') {
            otherPlaneWall.material = workloadPlaneColor;
        } else if (type === 'Service') {
            otherPlaneWall.material = servicePlaneColor;
        } else if (type === 'ConfigStorage') {
            otherPlaneWall.material = configStoragePlaneColor;
        } else if (type === 'Authentication') {
            otherPlaneWall.material = authentPlaneColor;
        } else if (type === 'Authorization') {
            otherPlaneWall.material = authorizePlaneColor;
        } else if (type === 'Policy') {
            otherPlaneWall.material = policyPlaneColor;
        } else if (type === 'Extend') {
            otherPlaneWall.material = extendPlaneColor;
        } else if (type === 'Cluster') {
            otherPlaneWall.material = clusterPlaneColor;
        } else if (type === 'Other') {
            otherPlaneWall.material = otherPlaneColor;
        } else if (type === 'ThirdParty') {
            otherPlaneWall.material = thirdPartyPlaneColor;
        }

        // register click event for object
        otherPlaneWall.actionManager = new BABYLON.ActionManager(scene);
        otherPlaneWall.actionManager.registerAction(
            new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnPickTrigger, function () {
                document.getElementById('resourceProps').innerHTML = otherPlaneInner;
                if ($('#clusterFilterSound').prop('checked')) {
                    clickSound.play();
                }
                showRing();
            }),
        );
        buildSlice(pX, 0.5, pZ, wFnum.toString(), 'n');
        addControlP(otherPlaneWall, type);

        //TODO
        // // Build line from control plane to planes
    }

    //==============================================
    // Build the Control Plane components that were found with
    // in the ComponentStatus resources
    function buildOtherComponents(type, data, fnum) {
        //beginArc = parseInt(beginArc);
        let aa = beginArc;
        let y = 0.5;
        let oCnt = 0;

        if (data.length > 0) {
            for (let p = 0; p < data.length; p++) {
                fnum = fnum + 1;
                oCnt++;
                if (oCnt > 17) {
                    oCnt = 1;
                    y = 1.0;
                    aa = aa + 2;
                } else {
                    y = y + 0.5;
                }
                // intAA = parseInt(aa)
                pX = (maxRings + CLUSTERLEVELPLANE) * Math.sin(angleArray[aa]);
                pZ = (maxRings + CLUSTERLEVELPLANE) * Math.cos(angleArray[aa]);

                let inner =
                    '<div class="vpkfont vpkblue ml-1">' +
                    '<div id="sliceKey">' +
                    fnum +
                    '</div>' +
                    '<img src="images/k8/k8.svg" class="icon"></a>' +
                    '<span class="pl-2 pb-2 vpkfont-sm">' +
                    '</span>' +
                    '<br>' +
                    '<span class="vpkfont-slidein"><b>API category</b>' +
                    '<br><hr class="hrLine">' +
                    '<span class="vpkfont-slidein pr-2"><b>API type:</b>' +
                    type +
                    ' Resources</b>' +
                    '<br><br>' +
                    '<span><b>Kind : </b><span class="pl-2">' +
                    data[p] +
                    '</span></span>' +
                    '</span><br><br>View resource information by pressing the Search button below.</div>' +
                    '<button type="button" class="ml-1 mt-4 btn btn-primary btn-sm vpkButton" ' +
                    ' onclick="openSearch(\'' +
                    data[p] +
                    "','Cluster')\">Search</button>";

                buildOtherSphere(pX, y, pZ, type, inner);
                buildSlice(pX, y, pZ, fnum.toString(), 'n');
            }
        }
    }

    function buildOtherSphere(x, y, z, type, inner) {
        // define the sphere
        let sphere = BABYLON.MeshBuilder.CreateSphere('other', { diameter: 0.25, segments: 32 }, scene);
        sphere.position.x = x;
        sphere.position.y = y;
        sphere.position.z = z;

        if (type === 'Workload') {
            sphere.material = workloadSphereColor;
        } else if (type === 'Service') {
            sphere.material = serviceSphereColor;
        } else if (type === 'ConfigStorage') {
            sphere.material = configStorageSphereColor;
        } else if (type === 'Authentication') {
            sphere.material = authentSphereColor;
        } else if (type === 'Authorization') {
            sphere.material = authorizeSphereColor;
        } else if (type === 'Policy') {
            sphere.material = policySphereColor;
        } else if (type === 'Extend') {
            sphere.material = extendSphereColor;
        } else if (type === 'Cluster') {
            sphere.material = clusterSphereColor;
        } else if (type === 'Other') {
            sphere.material = otherSphereColor;
        } else {
            sphere.material = thirdPartySphereColor;
        }

        // register click event for object
        sphere.actionManager = new BABYLON.ActionManager(scene);
        sphere.actionManager.registerAction(
            new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnPickTrigger, function () {
                document.getElementById('resourceProps').innerHTML = inner;
                if ($('#clusterFilterSound').prop('checked')) {
                    clickSound.play();
                }
                showRing();
            }),
        );
        addControlP(sphere, type);
    }

    //==============================================
    // End of common functions
    //==============================================
}

function build3DView() {
    window.initFunction = async function () {
        var asyncEngineCreation = async function () {
            try {
                return createDefaultEngine();
            } catch (err) {
                console.log(`Failed to create Babylon 3D default engine, error message: ${err}`);
                console.log(`Error stack: ${err.stack}`);
                alert(`Create 3D engine function failed with error: ${err} Creating the default engine instead`);
                return createDefaultEngine();
            }
        };

        window.engine = await asyncEngineCreation();

        if (!engine) {
            throw 'engine should not be null.';
        }

        window.scene = createScene();
        filter3DView();
    };

    initFunction().then(() => {
        sceneToRender = scene;
        engine.runRenderLoop(function () {
            if (sceneToRender && sceneToRender.activeCamera) {
                sceneToRender.render();
            }
        });
    });

    // Resize
    window.addEventListener('resize', function () {
        engine.resize();
    });
}

function buildCluster3D() {
    build3DJSON();
    $('#cluster3DView').show();
    // $("#clusterAttention").html('&nbsp');
    parseClusterResc();
    build3DView();
    $('#resourceProps').html('');
}

function parseClusterResc() {
    if (typeof k8cData !== 'undefined') {
        if (typeof k8cData['0000-clusterLevel'] !== 'undefined') {
            clusterOtherKeys = Object.keys(k8cData['0000-clusterLevel']);
        }
    } else {
        clusterOtherKeys = [];
    }

    clusterRescWorkload = [];
    clusterRescService = [];
    clusterRescConfigStorage = [];
    clusterRescAuthentication = [];
    clusterRescAuthorization = [];
    clusterRescPolicy = [];
    clusterRescExtend = [];
    clusterRescCluster = [];
    clusterRescOther = [];
    clusterRescThirdParty = [];

    for (let i = 0; i < clusterOtherKeys.length; i++) {
        if (rescSkip.includes(clusterOtherKeys[i])) {
            clusterOtherKeys[i] = '<na>';
            continue;
        } else if (rescWorkload.includes(clusterOtherKeys[i])) {
            clusterRescWorkload.push(clusterOtherKeys[i]);
            clusterOtherKeys[i] = '<na>';
            continue;
        } else if (rescService.includes(clusterOtherKeys[i])) {
            clusterRescService.push(clusterOtherKeys[i]);
            clusterOtherKeys[i] = '<na>';
            continue;
        } else if (rescConfigStorage.includes(clusterOtherKeys[i])) {
            clusterRescConfigStorage.push(clusterOtherKeys[i]);
            clusterOtherKeys[i] = '<na>';
            continue;
        } else if (rescAuthentication.includes(clusterOtherKeys[i])) {
            clusterRescAuthentication.push(clusterOtherKeys[i]);
            clusterOtherKeys[i] = '<na>';
            continue;
        } else if (rescAuthorization.includes(clusterOtherKeys[i])) {
            clusterRescAuthorization.push(clusterOtherKeys[i]);
            clusterOtherKeys[i] = '<na>';
            continue;
        } else if (rescPolicy.includes(clusterOtherKeys[i])) {
            clusterRescPolicy.push(clusterOtherKeys[i]);
            clusterOtherKeys[i] = '<na>';
            continue;
        } else if (rescExtend.includes(clusterOtherKeys[i])) {
            clusterRescExtend.push(clusterOtherKeys[i]);
            clusterOtherKeys[i] = '<na>';
            continue;
        } else if (rescCluster.includes(clusterOtherKeys[i])) {
            clusterRescCluster.push(clusterOtherKeys[i]);
            clusterOtherKeys[i] = '<na>';
            continue;
        } else if (rescOther.includes(clusterOtherKeys[i])) {
            clusterRescOther.push(clusterOtherKeys[i]);
            clusterOtherKeys[i] = '<na>';
            continue;
        } else {
            clusterRescThirdParty.push(clusterOtherKeys[i]);
            clusterOtherKeys[i] = '<na>';
            continue;
        }
    }
    // add configMap and secret if they exist
    if (configMapsFound === true) {
        clusterRescConfigStorage.push('ConfigMap');
    }
    if (secretsFound === true) {
        clusterRescConfigStorage.push('Secret');
    }
}

function openNodeInfo(node) {
    let parts = node.split('::');
    let nData = '';
    let tRows = '';
    let nodeIP = 'Unknown';
    for (let i = 0; i < k8cData['0000-clusterLevel'].Node.length; i++) {
        if (k8cData['0000-clusterLevel'].Node[i].name === parts[0]) {
            nData = k8cData['0000-clusterLevel'].Node[i];
        }
    }

    // Get Node IP address
    let data = networkNodes[parts[0]];
    for (let ip = 0; ip < data.addresses.length; ip++) {
        if (data.addresses[ip].type === 'InternalIP') {
            nodeIP = data.addresses[ip].address;
            break;
        }
    }

    let html =
        '<div class="mt-4">' +
        '<table style="border: 1px solid grey; border-collapse: collapse;" width="100%">' +
        '<tr class="text-center" style="background-color: grey; color: white;">' +
        '<th width="250px">Item</th><th>Value</th></tr>';
    tRows =
        tRows +
        '<tr style="border: 1px solid grey; background-color: white;"><td class="px-2">Name</td><td>' +
        parts[0] +
        '</td></tr>' +
        '<tr style="border: 1px solid grey; background-color: white;"><td class="px-2">Type</td><td>' +
        parts[1] +
        '</td></tr>' +
        '<tr style="border: 1px solid grey; background-color: white;"><td class="px-2">IP address</td><td>' +
        nodeIP +
        '</td></tr>';

    if (typeof nData.nodeInfo['architecture'] !== 'undefined') {
        tRows =
            tRows +
            '<tr style="border: 1px solid grey; background-color: white;"><td class="px-2">Node Architecture</td><td>' +
            nData.nodeInfo['architecture'] +
            '</td></tr>';
    }
    if (typeof nData.c_cpu !== 'undefined') {
        tRows = tRows + '<tr style="border: 1px solid grey; background-color: white;"><td class="px-2">CPUs</td><td>' + nData.c_cpu + '</td></tr>';
    }
    if (typeof nData.c_memory !== 'undefined') {
        tRows =
            tRows + '<tr style="border: 1px solid grey; background-color: white;"><td class="px-2">Memory</td><td>' + nData.c_memory + '</td></tr>';
    }
    if (typeof nData.nodeInfo['osImage'] !== 'undefined') {
        tRows =
            tRows +
            '<tr style="border: 1px solid grey; background-color: white;"><td class="px-2">Operating System</td><td>' +
            nData.nodeInfo['osImage'] +
            '</td></tr>';
    }
    if (typeof nData.nodeInfo['kubeletVersion'] !== 'undefined') {
        tRows =
            tRows +
            '<tr style="border: 1px solid grey; background-color: white;"><td class="px-2">Kubelet Version</td><td>' +
            nData.nodeInfo['kubeletVersion'] +
            '</td></tr>';
    }
    if (typeof nData.nodeInfo['kubeProxyVersion'] !== 'undefined') {
        tRows =
            tRows +
            '<tr style="border: 1px solid grey; background-color: white;"><td class="px-2">Kube Proxy Version</td><td>' +
            nData.nodeInfo['kubeProxyVersion'] +
            '</td></tr>';
    }
    if (typeof nData.nodeInfo['containerRuntimeVersion'] !== 'undefined') {
        tRows =
            tRows +
            '<tr style="border: 1px solid grey; background-color: white;"><td class="px-2">Container Runtime (CRI) Version</td><td>' +
            nData.nodeInfo['containerRuntimeVersion'] +
            '</td></tr>';
    }
    html = html + tRows + '</table></div>';
    $('#networkInfoContents').html(html);
    $('#networkInfoModal').modal('show');
}

//----------------------------------------------------------
console.log('loaded vpk3dCluster.js');
