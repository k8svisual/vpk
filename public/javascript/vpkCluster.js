/*
Copyright (c) 2018-2022 K8Debug

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
// build data for cluster tab
//----------------------------------------------------------

/**
 * 
 */
function buildClusterTable() {
	//$('#c3DFilter').prop('disabled',true);
	$('#cluster3DView').hide();
	$("#clusterDetail").show();
	$("#renderCanvas").html('');
	let html = clusterTabTable();
	$("#resourceProps").html('');
	$("#clusterDetail").html(html);
}

//----------------------------------------------------------
// build 3D data for cluster tab
//----------------------------------------------------------

function buildCluster3D() {
	//$('#c3DFilter').prop('disabled',false); 
	build3DJSON();
	$('#cluster3DView').show();
	build3DView();
	$("#resourceProps").html('')
}

async function showSchematic(ns, fnum) {
	let schematicsPromise = new Promise(function (resolve, reject) {
		resolve(openNamespace(ns))
	});

	let cont = await schematicsPromise;

	let tab = 'schematic';
	$('.nav-tabs a[href="#' + tab + '"]').tab('show');

	let element = document.getElementById("fnum-" + fnum);
	element.scrollIntoView();

}

//----------------------------------------------------------
console.log('loaded vpkCluster.js');
