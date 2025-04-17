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
// build common vars and functions
//----------------------------------------------------------

// Global vars 

// control what tab to return to 
let returnWhere;



// global
let version = 'Get from server';  // Version of the software 
let runMode = 'L';                // mode running, L - locally, C - container
let socket = io.connect();
// let svgE = 0;
let baseDir;                      // Name of directory where snapshot is located
let validDir;
//let newDir;

// type of nodes by name
let nodeTypes = {};
let podStatusLookup = {};

// let editor;
let selectedDef;

//Filter value for DirStats graph
let dirStatFilter = '';

let currentTab = "instructions"
let rootDir;
let k8cData;

let bootstrapModalCounter = 0;
let documentationTabTopic = 'toc';

// objects that contain html sections that are dnynamically shown
let svgInfo = {};            			// tool tip pop-ups
let workloadEventsInfo = {};			// workload events
let nsResourceInfo = {};				// namespace resource lists

// security arrays
let securityRoleInfo = {};				// roles
let securityRoleBindingInfo = {};		// role bindings
let securitySubjectInfo = {};			// subjects
let securityArraysLoaded = false;       // indicate if data loaded in security arrays

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

let explainInfo = [];

let containerImagesInfo;

// Cluster tab related fields
let clusterFilters = {};
let clusterBack = 'Grey'

// ACE editor theme
let aceTheme = 'chrome'
let aceSearchValue = '';    // Value to find in k8s resource when opening in ACE

let yesNoWhere = '';

//Return stack
let returnStack = {};

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

function returnStackID(to, from) {
	let key = new Date();
	returnStack[key] = { 'to': to, 'from': from }
	return key;
}

function getScreenWidth() {
	return Math.max(
		document.body.scrollWidth,
		document.documentElement.scrollWidth,
		document.body.offsetWidth,
		document.documentElement.offsetWidth,
		document.documentElement.clientWidth
	);
}

function getScreenHeight() {
	return Math.max(
		document.body.scrollHeight,
		document.documentElement.scrollHeight,
		document.body.offsetHeight,
		document.documentElement.offsetHeight,
		document.documentElement.clientHeight
	);
}

function returnToWhereTab(target, hide) {
	if (hide !== null && hide.length > 0) {
		$('#' + hide).html('');
	}
	if (target === 'Cluster') {
		$('[href="#cluster"]').tab('show');
		$('#storageReturnSection').html('');
	} else if (target === 'Event') {
		$('[href="#evtMsgs"]').tab('show');
	} else if (target === 'Stats') {
		$('[href="#stats"]').tab('show');
	} else if (target === 'Workload') {
		// Clear the filter field
		evtLimitUid = '';
		// Clear the first minute value
		$('#evtPageToStart').val(0);

		// Switch views
		$('[href="#schematic"]').tab('show');
		$("#schemModal").modal('show');
		// Scroll to the proper schematic 
		let elementId = 'fnum-' + evtScrollFnum;
		let targetElement = document.getElementById(elementId);
		if (targetElement) {
			targetElement.scrollIntoView();
		} else {
			console.log(`returnToWhereTab() could not find document elementID: ${elementId}`);
		}
		evtClearFilter();
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

function processModalYesNo(action) {
	if (yesNoWhere === 'Redact') {
		if (action === 'Y') {
			$("#yesNoModal").modal('hide');
			$("#configModal").modal('hide');
		} else {
			$("#yesNoModal").modal('hide');
		}
	} else if (yesNoWhere === 'Close') {
		if (action === 'Y') {
			$("#yesNoModal").modal('hide');
			$("#configModal").modal('hide');
		} else {
			$("#yesNoModal").modal('hide');
		}
	}
}

function setSelectValue(selectName, value) {
	// Update the selected item in a drop-down
	let dropdown = document.getElementById(selectName);
	for (var i = 0; i < dropdown.options.length; i++) {
		if (dropdown.options[i].text === value) {
			dropdown.selectedIndex = i;
			break;
		}
	}
	// Trigger a change event to notify any listeners (like event listeners or frameworks)
	let event = new Event("change");
	dropdown.dispatchEvent(event);
}

function openSearch(val, requestor) {
	let nsVal = '::all-namespaces::';
	let kVal = val;
	let gType = '';
	let where = requestor;
	let nsSelect
	let kindSelect;

	// If the requesting source is the Graphic tab / dirStats report
	if (requestor === 'StatsDirStats') {
		where = 'Stats'
		gType = $("#dirStatType").prop("innerText");
		if (gType.indexOf('Namespace') > -1) {
			if (dirStatFilter === '') {
				nsSelect = val;
				kindSelect = 'all-kinds';
				nsVal = '::' + val + '::';
				kVal = '::all-kinds::'
			} else {
				nsSelect = dirStatFilter;
				kindSelect = val;
				nsVal = '::' + dirStatFilter + '::';
				kVal = '::' + val + '::';
			}
		} else {
			if (dirStatFilter === '') {
				nsSelect = 'all-namespaces';
				kindSelect = val;
				nsVal = '::all-namespaces::';
				kVal = '::' + val + '::';
			} else {
				nsSelect = val;
				kindSelect = dirStatFilter;
				nsVal = '::' + val + '::';
				kVal = '::' + dirStatFilter + '::';
			}
		}
	} else if (requestor === 'StatsDirRpt') {
		let newVal = val.split('::');
		where = 'Stats'
		if (newVal[1] === 'Namespace') {
			nsSelect = newVal[0];
			nsVal = '::' + newVal[0] + '::';
			kindSelect = 'all-kinds'
			kVal = '::all-kinds::'
		}
		if (newVal[1] === 'Kind') {
			nsSelect = 'all-namespaces';
			nsVal = '::all-namespaces::';
			kindSelect = newVal[0];
			kVal = '::' + newVal[0] + '::'
		}

	} else if (requestor === 'StatsDirRptSub') {
		let newVal = val.split('::');
		where = 'Stats'
		if (newVal[2] === 'Namespace') {
			nsSelect = newVal[0];
			nsVal = '::' + newVal[0] + '::';
			kindSelect = newVal[1];
			kVal = '::' + newVal[1] + '::'
		}
		if (newVal[2] === 'Kind') {
			nsSelect = newVal[1];
			nsVal = '::' + newVal[1] + '::';
			kindSelect = newVal[0];
			kVal = '::' + newVal[0] + '::'
		}

	} else if (requestor === 'Cluster') {
		nsSelect = 'all-namespaces';
		nsVal = '::all-namespaces::';
		kindSelect = val;
		kVal = '::' + val + '::'
	}


	// Set the drop-down values for the Search tab
	if (requestor !== 'Cluster') {
		setSelectValue('ns-filter', nsSelect)
	}

	// Set the drop-down values for the Search tab
	if (requestor !== 'StatsDirRpt') {
		setSelectValue('ns-filter', nsSelect)
	}

	// Update the Kind dropDown
	setSelectValue('kind-filter', kindSelect)

	// Build search request and send to server
	let data = {
		"searchValue": '',
		"namespaceFilter": nsVal,
		"kindFilter": kVal
	}
	socket.emit('searchK8Data', data);
	returnWhere = where;

	$('#searchReturn').html(
		'<div class="vpkfont vpkblue vpk-rtn-bg mt-1 mb-1">'
		+ '<hr style="margin-top: 3px; margin-bottom: 3px;">'
		+ '<button type="button" class="btn btn-sm btn-secondary vpkButtons ml-2 px-2"'
		+ '	onclick="returnToWhereTab(\'' + where + '\',\'searchReturn\')">Return</button>'
		+ '<span class="px-1">to</span>' + where + '<span class="px-1">tab</span>'
		+ '<hr style="margin-top: 3px; margin-bottom: 3px;">'
		+ '</div>'
	)

	// Open tab
	$('[href="#searchview"]').tab('show');
}

function tellMe(msg) {
	if (msg === 'schematic-01') {
		showMessage('Once data is retrieved press the blue and/or yellow'
			+ ' buttons shown to toggle the view for the identifed namespace.')
	} else if (msg === 'security-01') {
		viewSecurityLegend();
	} else if (msg === 'ownerRef-01') {
		//viewOwnerRefLegend();
		showMessage('No OwnerRef Link information defined at this time.')
	} else if (msg === 'container-01') {
		viewRepositoryLegend();
		//showMessage('No OwnerRef Link information defined at this time.')
	} else if (msg === 'search-01') {
		searchValues();
	}
}


//----------------------------------------------------------
console.log('loaded vpkCommon.js');
