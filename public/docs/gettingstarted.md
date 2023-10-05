<topicKey gettingstarted/>
<topicBack id="topicNext" link="generalusage"/>
<topicNext id="topicBack" link="toc"/>

<a style="float: right;" href="javascript:docNextTopic()">&nbsp;&nbsp;Next&nbsp;<i class="fas fa-lg fa-arrow-right"></i></a>
<a style="float: right;" href="javascript:docNextTopic('toc')">&nbsp;&nbsp;TOC&nbsp;&nbsp;</a>
<a style="float: right;" href="javascript:docPrevTopic()"><i class="fas fa-lg fa-arrow-left"></i>&nbsp;Prev&nbsp;&nbsp;</a>

#### Getting started with VpK

---

<!-- <div style="margin-left: 150px;">
    <iframe width="700" height="390" src="https://www.youtube.com/embed/oLnhPCZa_fo">
    </iframe>    
</div> -->


##### Installing VpK

Vpk is an application that runs on your computer using the following required software. The prerequiste software:

- browser - that supports html 5 for the user interface 
- node.js and npm - install node packages and run the server software component 
- kubectl - Kubernetes command line tool or other CLI used to communicate with a cluster 


VpK software is available from __https://github.com/k8svisual/viewk8s.git__ Clone the repo or download the zip.  If using zip file, unzip file into a directory.

Change to the directory where the software is cloned or copied and install the required node packages by running: npm install

<br>

##### Starting VpK software

Start the Vpk server software by using this command: 

``` npm start ```

The server portion of VpK is started using the default port 4200.

Access the VpK server by opening a browser with the following url. This url assumes the server is running on the same machine where the browser is launched.  If not
replace the 'localhost' with the server address.

``` http://localhost:4200 ```

<br>


##### Optional start parameters

VpK has these start parameters as shown in the below table.  All of these start parameters are optional. 

<br>

| Parameter | Usage description | Default | Example |
|:---:|---|---|---|
| c | Indicate VpK server is running in a container. | &lt:blank&gt; | -c Yes |
| p | Control the port where the server can be accessed from a browser. | -p 4200 | -p 5400 |
| s | Control the location of snapshot directories and files | &lt:blank&gt; | -s /Users/bob/snaps |


---
