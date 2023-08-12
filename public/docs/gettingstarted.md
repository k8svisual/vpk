<topicKey gettingstarted/>
<topicBack id="topicNext" link="generalusage"/>
<topicNext id="topicBack" link="toc"/>

<a style="float: right;" href="javascript:docNextTopic()">&nbsp;&nbsp;Next&nbsp;<i class="fas fa-lg fa-arrow-right"></i></a>
<a style="float: right;" href="javascript:docNextTopic('toc')">&nbsp;&nbsp;TOC&nbsp;&nbsp;</a>
<a style="float: right;" href="javascript:docPrevTopic()"><i class="fas fa-lg fa-arrow-left"></i>&nbsp;Prev&nbsp;&nbsp;</a>

###### Getting started

---

How to get started with VpK, installaing and starting.  

<div style="margin-left: 150px;">
    <iframe width="700" height="390" src="https://www.youtube.com/embed/oLnhPCZa_fo">
    </iframe>
</div>

---

Vpk is an application that runs on your computer using required software. The prerequiste software:

- __browser__ - that supports html 5 for the user interface 
- __node.js and npm__ - install node packages and run the server software component 
- __kubectl__ - Kubernetes command line tool or other CLI used to communicate with a cluster 


VpK software is available from https://github.com/k8debug/vpk.git Clone the repo or download the zip.  If using zip file, unzip file into a directory.

Change to the directory where the software is cloned or copied and install the required node packages by running: npm install

Start the software by running command: npm start

Optionally VpK can be started with a different port.  This requires the use of a different start command using node instead of npm.  A start parameter "-p" is used to define the port.  Example:

node server.js -p 5400

The above command starts the VpK server and hosts the application on port 5400.

---

<a style="float: right;" href="javascript:docNextTopic()">&nbsp;&nbsp;Next&nbsp;<i class="fas fa-lg fa-arrow-right"></i></a>
<a style="float: right;" href="javascript:docNextTopic('toc')">&nbsp;&nbsp;TOC&nbsp;&nbsp;</a>
<a style="float: right;" href="javascript:docPrevTopic()"><i class="fas fa-lg fa-arrow-left"></i>&nbsp;Prev&nbsp;&nbsp;</a>

