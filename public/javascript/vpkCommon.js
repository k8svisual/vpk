/*
Copyright (c) 2018-2023 k8sVisual

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
// build common vars and functions
//----------------------------------------------------------

// Global vars 

// control what tab to return to 
let returnWhere;

// 3D view related
let clusterPanelIsClosed = true;
let foundNSNamesBuilt = false;
let sceneColorR = 0.9;
let sceneColorG = 0.9;
let sceneColorB = 0.9;
let sceneStars = false;
let sceneClouds = false;
let stickColorDark = true;
let soundFor3D = true;

// global
var version = 'Get from server';  // Version of the software 
var runMode = 'L';                // mode running, L - locally, C - container
var socket = io.connect();
// var svgE = 0;
var baseDir;                      // Name of directory where snapshot is located
var validDir;
//var newDir;

// var editor;
var selectedDef;
var chartType;
var chartWhat;
var currentTab = "instructions"
var rootDir;
var k8cData;
var dsCounts;
var dsToggle = 'kind';
var bootstrapModalCounter = 0;
var documentationTabTopic = 'toc';

// objects that contain html sections that are dnynamically shown
let svgInfo = {};            			// tool tip pop-ups
let workloadEventsInfo = {};			// workload events
let nsResourceInfo = {};				// namespace resource lists

// security arrays
let securityRoleInfo = {};				// roles
let securityRoleBindingInfo = {};		// role bindings
let securitySubjectInfo = {};			// subjects
let securityArraysLoaded = false;       // indicate if data loaded in security arrays


//let iCnt = 1;
//let oldNS = '@';
//let first = true;

//let height = 0;
// let fnum;

// browser details
let usageBrowserName;
let usageFullVersion;
let usageMajorVersion;
let usageNavigatorAppName;
let usageNavigatorUserAgent;
let usageJSHeapSizeLimit = 0;
let usageJSHeapTotal = 0;
let usageJSHeapUsed = 0;

let storageData = '';
//let storageInfoID = 0;

let helmData = '';
let imageRegistryData = '';

let explainInfo = [];

let eventsInfo;

let clusterFilters = {};

// Not sure if Zoom code is needed
let zoom = d3.zoom()
	.on('zoom', handleZoom);

function initZoom() {
	d3.select('svg')
		.call(zoom);
}

function handleZoom(e) {
	d3.select('svg g')
		.attr('transform', e.transform);
}

function returnToWhereTab() {
	if (returnWhere === 'Cluster') {
		$('[href="#cluster"]').tab('show');
	} else if (returnWhere === 'Event') {
		$('[href="#evtMsgs"]').tab('show');
	}
}

function checkIfDataLoaded() {
	if (rootDir === 'No snapshot connected' || rootDir === '-none-') {
		showMessage('No snapshot or running cluster has been connected.', 'fail');
	} else {
		hideMessage();
	}
}

function setBaseDir(dir) {
	if (dir === '-none-' || dir === '') {
		dir = 'No snapshot connected';
	}
	rootDir = dir;
	$("#baseDir").empty();
	$("#baseDir").html('');
	$("#baseDir").html(dir);
	$("#tableSearch").bootstrapTable('removeAll')
}


//----------------------------------------------------------
console.log('loaded vpkCommon.js');
