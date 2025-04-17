<topicKey installing/>
<topicBack id="topicNext" link="snapshots"/>
<topicNext id="topicBack" link="introduction"/>

<a style="float: right;" href="javascript:docNextTopic()">&nbsp;&nbsp;Next&nbsp;<i class="fa fa-lg fa-arrow-right"></i></a>
<a style="float: right;" href="javascript:docNextTopic('toc')">&nbsp;&nbsp;TOC&nbsp;&nbsp;</a>
<a style="float: right;" href="javascript:docPrevTopic()"><i class="fa fa-lg fa-arrow-left"></i>&nbsp;Prev&nbsp;&nbsp;</a>

### Installing and run VpK locally

Vpk is an application that can run locally on your computer as a node.js application or run inside a Docker container.  

The VpK software source code is available from the following GitHub repository:  

__https://github.com/k8svisual/vpk.git__  

The VpK software docker image is available from the following Docker Hub.

__https://hub.docker.com/k8svisual/u/k8svisual__ 

#### Prerequisites
The prerequisite software must be available prior to running VpK.  This does require that additional software be installed that is not provided by VpK.
#### Prerequisite software to run locally

- browser - must support html 5 for the user interface 
- node.js and npm - install node packages and run the VpK server component 
- kubectl - Kubernetes command line tool or other CLI used to communicate with a K8s cluster 

#### Prerequisite software to run Docker container

- Docker desktop or equivalent software.

<hr style="border:1px solid #aaaaaa">

### Install and run VpK locally

Clone the source code repository or download the zip.  If using zip file, unzip file into a directory.  Change to the directory where the software is located and install the required node.js packages using the following command: 

```
npm install
```

Local installation of VpK is completed at this point.

### Running VpK locally

Ensure to have changed to the directory where the software is installed.  Start the VpK server software by using this command: 

```
npm start
```

The server portion of VpK is started using the default port 4200.

Access the VpK server by opening a browser with the following URL:

```
http://localhost:4200
```

The above URL assumes the VpK server is running on the same machine where the browser is launched.  If not the server is not running on the same machine as the browser replace the 'localhost' with the server address.

!!! Info

    See the below section __Optional start parameters__ for more information on the options when starting and running the VpK server.


<hr style="border:1px solid #aaaaaa">

### Install and run VpK from a container

To install VpK using a container image use the following command.  The following command assumes the use of Docker.  If other software is used replace the docker command with the appropriate command.  

The VpK container is available on Docker Hub.  If another location is desired the new image must be built and deployed to the desired repository.  The ‘Dockerfile’ that was used to create the image is available at the same location as the source code (see above).

```
docker pull k8svisual/vpk
```

### Running VpK from a container

The container runs the VpK server and hosts the web application at the default port 4200.

Two parameters are used when starting the container.

| Parm | Req/Opt | Description | Default |
|---|---|:--|:--|
| -v | Required | Volume parameter to define the location of the 'snapshot' files on the host machine. | none |
| -p | Optional | Port to access the VpK web site running in the container. | 4200 |

Example command to run VpK from a Docker container. 

Replace __SNAPDIR__ with the directory for the local stored snapshots. 

```
docker run -v SNAPDIR:/vpk/cluster
```

Example command to run VpK from a Docker container with parameters for snapshot data directory and mapping local port 8000 to the default 4200 port. Replace __SNAPDIR__ with the directory for the local stored snapshots. 

```
docker run -v SNAPDIR:/vpk/cluster -p 8000:4200 k8svisual/vpk
```

<br>

!!! Info

    Refer to the Snapshots section of this documentation for detailed information about creating the snapshot files from a Kubernetes cluster.

<hr style="border:1px solid #aaaaaa">


### Optional start parameters 

VpK has the following start parameters.  Default values will be used if no start parameters are provided. 

!!! Warn

    These are not parameters for Docker! These parameters are used by VpK when the server is started.

<br>

| &nbsp;Start Parameter&nbsp; | Usage description | Default | Example |
|:---:|---|---|---|
| -c | Indicate the VpK server/application is running in a container. <br> This enables the ability to send commands from the UI to the container and use the ssh feature to communicate with the container host to create a K8s snapshot. | &lt;blank&gt; | -c Yes |
| -p | Control the port where the server can be accessed from a browser. | 4200 | -p 5400 |
| -s | Control the location of snapshot directories and files | &lt;blank&gt; | -s /Users/snap |

<hr style="border:1px solid #aaaaaa">


