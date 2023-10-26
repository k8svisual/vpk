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


##### Installing VpK locally

Vpk is an application that can run locally on your computer as a node.js application or run inside a container.  The prerequiste software:

- browser - must support html 5 for the user interface 
- node.js and npm - install node packages and run the VpK server component 
- kubectl - Kubernetes command line tool or other CLI used to communicate with a k8s cluster 


VpK software is available from __https://github.com/k8svisual/viewk8s.git__ Clone the repo or download the zip.  If using zip file, unzip file into a directory.

Change to the directory where the software is located and install the required node packages by running: 

```
npm install
```

---

##### Running VpK locally

Ensure to have changed to the directory where the software is installed.  Start the Vpk server software by using this command: 

```
npm start
```

The server portion of VpK is started using the default port 4200.

Access the VpK server by opening a browser with the following url. This url assumes the server is running on the same machine where the browser is launched.  If not
replace the 'localhost' with the server address.

```
http://localhost:4200
```

See the below section __Optional start parameters__ for more information with respect to starting and running the VpK server/application.

---

##### Running VpK from a container
	
VpK is available as a container image on the dockerhub web site: 
https://hub.docker.com/repository/docker/k8svisual/viewk8s/general . 

Select the vpk image from dockerhub.

Example docker pull command: 
```
docker pull k8svisual/vpk
```

The container hosts a web application at the default port 4200.

The container requires a volume parameter to identify the direcotyr that will contain cluster snapshots along with port parameter to allow accessing the user interface via a browser.  

Optionally a second volume parameter can be defined to point to a common user configuration file, usercongi.json. Use of this optional parameter will ensure any settings or user defined x-references are available to the container instance of VpK.

Once the image is pulled it can be run by using a command similar to the following.  For the required volume replace "SNAPDIR" with the directory for the local stored snapshots. 

Parameter for mapping Snapshot volume:
```
-v SNAPDIR:/vpk/cluster
```
Change the value __SNAPDIR__ to the location on the local machine where the snapshot files are located.


Example Docker run command with parameters for snapshot data directory and mapping local port 4200 to the default port:
```
docker run -v /data/snapshot:/vpk/cluster -p 4200:4200 k8svisual/vpk
```

<br>

The cluster snapshot files to be used with the container are created using another progarm available from this same github account.  The repository is for this application is:

git clone https://github.com/k8svisual/snapshot.git/ 

Follow the instructions in the snapshot repository for how to build and install the additional snapshot application.


---

##### Optional start parameters

VpK has the following start parameters.  Default values will be used is no start parameters are provided. 

<br>

| &nbsp;Start Parameter&nbsp; | Usage description | Default | Example |
|:---:|---|---|---|
| c | Indicate the VpK server/application is running in a container. <br> This enables the ability to send commands from the UI to the container and use the ssh feature to communicate with the container host to create a k8s snapshot. | &lt;blank&gt; | -c Yes |
| p | Control the port where the server can be accessed from a browser. | 4200 | -p 5400 |
| s | Control the location of snapshot directories and files | &lt;blank&gt; | -s /Users/snap |


---
