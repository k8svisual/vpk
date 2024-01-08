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
// Print a html div section 
//----------------------------------------------------------

// print Div 
function printDiv(id) {
    id = '#' + id;
    //ToDo replace this with parsing of public/views/partials/head.ejs
    let = html = '<html><head><meta charset="UTF-8" />'
        + '<meta name="viewport" content="width=device-width, initial-scale=1.0" />'
        + '<meta http-equiv="X-UA-Compatible" content="ie=edge" />'
        + '<link rel="icon" type="image/png" href="images/vpk.png">'
        + '<title>VpK Print</title>'
        + '<link rel="stylesheet" href="stylesheets/bootstrap.min.css">'
        + '<link rel="stylesheet" href="stylesheets/bootstrap-toggle.min.css">'
        + '<link rel="stylesheet" href="stylesheets/all.min.css">'
        + '<link rel="stylesheet" href="stylesheets/bootstrap-table.min.css" >'
        + '<link rel="stylesheet" href="stylesheets/vpk.css">'

    // how to from:
    // https://www.aspsnippets.com/Articles/Print-DIV-contents-with-CSS-using-JavaScript-and-jQuery.aspx
    /* a dynamic IFRAME is created and the extracted contents of the HTML DIV are written to the IFRAME 
       along with the link to the external CSS file and finally the IFRAME document is printed using the 
       JavaScript Window Print command and the IFRAME is removed from the pag
    */


    var contents = $(id).html();
    var frame1 = $('<iframe />');
    frame1[0].name = "frame1";
    frame1.css({
        "position": "absolute",
        "top": "-1000000px"
    });

    $("body").append(frame1);
    var frameDoc = frame1[0].contentWindow ? frame1[0].contentWindow : frame1[0].contentDocument.document ? frame1[0].contentDocument.document : frame1[0].contentDocument;
    frameDoc.document.open();
    //Create a new HTML document.
    frameDoc.document.write('<html><head><title>VpK Print</title>');
    frameDoc.document.write(html);   //added this to ensure iframe has needed css and scripts
    frameDoc.document.write('<style> body { background-color:white !important; }'
        + ' @page { size: 14.0in 8.5in; margin: 1cm 2cm 1cm 1cm; } '
        + ' @page :left :footer { content: "Page " decimal(pageno); } '
        + ' @page :right :footer { content: "Page " decimal(pageno); } '
        + '</style>');
    frameDoc.document.write('</head><body>');
    // Append the contents.
    // frameDoc.document.write('<div class="m-3">' + contents + '</div>');
    frameDoc.document.write(contents);
    frameDoc.document.write('</body></html>');
    frameDoc.document.close();
    setTimeout(function () {
        window.frames["frame1"].focus();
        window.frames["frame1"].print();
        frame1.remove();
    }, 500);
}


//----------------------------------------------------------
console.log('loaded vpkPrintDiv.js');
